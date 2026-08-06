import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { initDatabase, query, get, run } from './database.js';
import { handleAgentChat } from './services/aiService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ [Config] JWT_SECRET is not set in the environment. Refusing to start.');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// ---------- Auth middleware ----------
function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication token missing.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

// Optional auth — used by the AI chat endpoint, which works for guests too
function optionalAuthenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.userEmail = payload.email;
  } catch (err) {
    // Ignore invalid token for optional auth — treat as guest
  }
  next();
}

// ---------- Health check ----------
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'AetherPass API' });
});

// ---------- Auth routes ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are all required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email.toLowerCase(), passwordHash, 'user']
    );

    const user = { id: result.insertId, name, email: email.toLowerCase(), role: 'user' };
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('[Register] Error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const dbUser = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!dbUser) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, dbUser.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = { id: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role };
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (err) {
    console.error('[Login] Error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ---------- Event routes ----------
app.get('/api/events', async (req, res) => {
  try {
    const events = await query('SELECT * FROM events ORDER BY event_date ASC');
    res.json(events);
  } catch (err) {
    console.error('[Events] Error:', err);
    res.status(500).json({ error: 'Failed to load events.' });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await get('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const seats = await query(
      'SELECT seat_number, status FROM seats WHERE event_id = ? ORDER BY seat_number ASC',
      [req.params.id]
    );

    res.json({ ...event, seats });
  } catch (err) {
    console.error('[Event Detail] Error:', err);
    res.status(500).json({ error: 'Failed to load event details.' });
  }
});

// ---------- Booking routes ----------

// IMPORTANT: this specific route must be registered BEFORE '/api/bookings/:id/cancel'
// style routes would only collide if ordered wrong; kept explicit + first for clarity.
app.get('/api/bookings/user/:userId', authenticate, async (req, res) => {
  try {
    const requestedId = parseInt(req.params.userId, 10);
    if (requestedId !== req.userId) {
      return res.status(403).json({ error: 'You can only view your own bookings.' });
    }

    const bookings = await query(
      `SELECT b.id, b.total_price, b.seats_booked, b.status, b.booking_date,
              e.title, e.venue, e.event_date, e.event_time, e.image_url, e.category
       FROM bookings b
       JOIN events e ON e.id = b.event_id
       WHERE b.user_id = ? AND b.status != 'cancelled'
       ORDER BY b.booking_date DESC`,
      [requestedId]
    );

    res.json(bookings);
  } catch (err) {
    console.error('[Booking History] Error:', err);
    res.status(500).json({ error: 'Failed to load booking history.' });
  }
});

app.post('/api/bookings', authenticate, async (req, res) => {
  try {
    const { eventId, seats } = req.body;
    if (!eventId || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ error: 'eventId and a non-empty seats array are required.' });
    }

    const event = await get('SELECT * FROM events WHERE id = ?', [eventId]);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const placeholders = seats.map(() => '?').join(',');
    const unavailable = await query(
      `SELECT seat_number FROM seats WHERE event_id = ? AND seat_number IN (${placeholders}) AND status != 'available'`,
      [eventId, ...seats]
    );
    if (unavailable.length > 0) {
      const names = unavailable.map(s => s.seat_number).join(', ');
      return res.status(409).json({ error: `Seat(s) ${names} are no longer available.` });
    }

    const totalPrice = parseFloat(event.price) * seats.length;
    const seatsString = seats.join(', ');

    const bookingRes = await run(
      `INSERT INTO bookings (user_id, event_id, total_price, seats_booked, status) VALUES (?, ?, ?, ?, 'confirmed')`,
      [req.userId, eventId, totalPrice, seatsString]
    );
    const bookingId = bookingRes.insertId;

    for (const seat of seats) {
      await run(
        `UPDATE seats SET status = 'booked', user_id = ?, booking_id = ? WHERE event_id = ? AND seat_number = ?`,
        [req.userId, bookingId, eventId, seat]
      );
    }

    res.status(201).json({
      success: true,
      bookingId,
      eventTitle: event.title,
      seatsBooked: seats,
      totalPrice
    });
  } catch (err) {
    console.error('[Create Booking] Error:', err);
    res.status(500).json({ error: 'Booking failed. Please try again.' });
  }
});

app.post('/api/bookings/:id/cancel', authenticate, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only cancel your own bookings.' });
    }
    if (booking.status === 'cancelled') {
      return res.status(409).json({ error: 'Booking is already cancelled.' });
    }

    await run(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`, [bookingId]);
    await run(
      `UPDATE seats SET status = 'available', user_id = NULL, booking_id = NULL WHERE booking_id = ?`,
      [bookingId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[Cancel Booking] Error:', err);
    res.status(500).json({ error: 'Cancellation failed. Please try again.' });
  }
});

// ---------- AI agent route ----------
app.post('/api/agent/chat', optionalAuthenticate, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const result = await handleAgentChat(message, req.userId || null, req.userEmail || null);
    res.json(result);
  } catch (err) {
    console.error('[Agent Chat] Error:', err);
    res.status(500).json({ error: 'The AI agent ran into an error processing that request.' });
  }
});

// ---------- 404 fallback ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ---------- Start ----------
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`⚡ [Server] AetherPass API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ [Server] Failed to initialize database:', err);
    process.exit(1);
  });
