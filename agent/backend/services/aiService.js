import { query, get, run } from '../database.js';
import dotenv from 'dotenv';

dotenv.config();

// Tool Definitions for the AI Agent
const TOOLS = {
  search_events: async (args) => {
    const category = args.category || '';
    const keyword = args.keyword || '';
    
    let sql = 'SELECT * FROM events WHERE 1=1';
    const params = [];
    
    if (category) {
      sql += ' AND LOWER(category) = ?';
      params.push(category.toLowerCase());
    }
    
    if (keyword) {
      sql += ' AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)';
      params.push(`%${keyword.toLowerCase()}%`, `%${keyword.toLowerCase()}%`);
    }
    
    const events = await query(sql, params);
    return events;
  },

  get_event_seats: async (args) => {
    const eventId = args.eventId;
    if (!eventId) throw new Error('Event ID is required to fetch seating chart');
    
    const seats = await query('SELECT seat_number, status FROM seats WHERE event_id = ?', [eventId]);
    return seats;
  },

  book_seats: async (args, userId) => {
    const { eventId, seats } = args;
    if (!userId) {
      return { success: false, error: 'Authentication required. Please log in to complete booking.' };
    }
    if (!eventId || !seats || !Array.isArray(seats) || seats.length === 0) {
      return { success: false, error: 'Event ID and a list of seat numbers are required.' };
    }

    const event = await get('SELECT * FROM events WHERE id = ?', [eventId]);
    if (!event) return { success: false, error: 'Event not found.' };

    const placeholders = seats.map(() => '?').join(',');
    const unavailableSeats = await query(`
      SELECT seat_number FROM seats 
      WHERE event_id = ? AND seat_number IN (${placeholders}) AND status != 'available'
    `, [eventId, ...seats]);

    if (unavailableSeats.length > 0) {
      const seatNames = unavailableSeats.map(s => s.seat_number).join(', ');
      return { success: false, error: `Seat(s) ${seatNames} are already reserved or booked.` };
    }

    const totalPrice = parseFloat(event.price) * seats.length;
    const seatsString = seats.join(', ');

    const bookingRes = await run(`
      INSERT INTO bookings (user_id, event_id, total_price, seats_booked, status)
      VALUES (?, ?, ?, ?, 'confirmed')
    `, [userId, eventId, totalPrice, seatsString]);

    const bookingId = bookingRes.insertId;

    for (const seat of seats) {
      await run(`
        UPDATE seats 
        SET status = 'booked', user_id = ?, booking_id = ? 
        WHERE event_id = ? AND seat_number = ?
      `, [userId, bookingId, eventId, seat]);
    }

    return {
      success: true,
      bookingId,
      eventTitle: event.title,
      venue: event.venue,
      date: event.event_date,
      time: event.event_time,
      seatsBooked: seats,
      totalPrice
    };
  }
};

export async function handleAgentChat(message, userId, userEmail) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    return runRealGeminiAgent(message, userId, userEmail, apiKey);
  } else {
    return runSimulatedAgent(message, userId, userEmail);
  }
}

async function runSimulatedAgent(message, userId, userEmail) {
  const steps = [];
  const normalizedMsg = message.toLowerCase();
  
  steps.push({
    type: 'thought',
    content: `Parsing input message: "${message}". Checking for user intent (search, seating, booking, recommendations).`
  });

  let category = '';
  if (normalizedMsg.includes('concert') || normalizedMsg.includes('music') || normalizedMsg.includes('band') || normalizedMsg.includes('neon')) {
    category = 'Concert';
  } else if (normalizedMsg.includes('movie') || normalizedMsg.includes('film') || normalizedMsg.includes('cinema') || normalizedMsg.includes('uprising')) {
    category = 'Movie';
  } else if (normalizedMsg.includes('sports') || normalizedMsg.includes('game') || normalizedMsg.includes('match') || normalizedMsg.includes('athletics')) {
    category = 'Sports';
  } else if (normalizedMsg.includes('theater') || normalizedMsg.includes('play') || normalizedMsg.includes('opera') || normalizedMsg.includes('holographic')) {
    category = 'Theater';
  }

  steps.push({
    type: 'thought',
    content: `User wants to browse ${category ? category + ' ' : ''}events. Calling "search_events" tool to find matching database records.`
  });

  let keyword = '';
  if (normalizedMsg.includes('neon') || normalizedMsg.includes('odyssey')) keyword = 'Neon';
  if (normalizedMsg.includes('uprising') || normalizedMsg.includes('thriller')) keyword = 'Uprising';
  if (normalizedMsg.includes('sports') || normalizedMsg.includes('apex')) keyword = 'Apex';
  if (normalizedMsg.includes('theater') || normalizedMsg.includes('dreams') || normalizedMsg.includes('quantum')) keyword = 'Quantum';

  steps.push({
    type: 'tool_call',
    name: 'search_events',
    arguments: { category, keyword }
  });

  const matchingEvents = await TOOLS.search_events({ category, keyword });
  
  steps.push({
    type: 'tool_result',
    name: 'search_events',
    data: matchingEvents
  });

  if (matchingEvents.length === 0) {
    steps.push({
      type: 'thought',
      content: `No events matched the search criteria. I need to inform the user and suggest general alternatives.`
    });
    return {
      steps,
      reply: "I couldn't find any events matching those criteria. We currently have standard bookings open for the Neon Odyssey Concert, A.I. Uprising Movie, Global Apex Sports, and Quantum Dreams Holographic Theater. Would you like me to look up one of these?"
    };
  }

  const primaryEvent = matchingEvents[0];
  const seatMatch = normalizedMsg.match(/([a-d])([1-6])/);
  
  if (seatMatch) {
    const seatNum = seatMatch[0].toUpperCase();
    steps.push({
      type: 'thought',
      content: `User requested a booking. Specified seat: ${seatNum} for event "${primaryEvent.title}" (ID: ${primaryEvent.id}). Need to verify seat availability.`
    });

    steps.push({
      type: 'tool_call',
      name: 'get_event_seats',
      arguments: { eventId: primaryEvent.id }
    });

    const seats = await TOOLS.get_event_seats({ eventId: primaryEvent.id });
    
    steps.push({
      type: 'tool_result',
      name: 'get_event_seats',
      data: `Successfully retrieved seating chart for Event ID ${primaryEvent.id}`
    });

    const targetSeat = seats.find(s => s.seat_number === seatNum);
    if (!targetSeat) {
      return {
        steps,
        reply: `I searched for seat ${seatNum} but it seems to be outside the allowed layout. Available rows are A to D and seats are 1 to 6 (e.g. A1 to D6).`
      };
    }

    if (targetSeat.status !== 'available') {
      steps.push({
        type: 'thought',
        content: `Target seat ${seatNum} is not available (Status: ${targetSeat.status}). Presenting available options.`
      });
      const availableSeats = seats.filter(s => s.status === 'available').map(s => s.seat_number).slice(0, 5).join(', ');
      return {
        steps,
        reply: `Ah, seat ${seatNum} is already booked. Some other available seats are: **${availableSeats}**. Which one would you prefer?`
      };
    }

    steps.push({
      type: 'thought',
      content: `Seat ${seatNum} is available! Proceeding to execute "book_seats" tool on behalf of User ID ${userId || 'GUEST'}.`
    });

    if (!userId) {
      steps.push({
        type: 'thought',
        content: `User is not logged in. Aborting database booking transaction.`
      });
      return {
        steps,
        reply: `I've verified that seat **${seatNum}** is available for **${primaryEvent.title}**! However, you need to sign in/register using the login button in the top right to complete the booking.`
      };
    }

    steps.push({
      type: 'tool_call',
      name: 'book_seats',
      arguments: { eventId: primaryEvent.id, seats: [seatNum], userId }
    });

    const bookingResult = await TOOLS.book_seats({ eventId: primaryEvent.id, seats: [seatNum] }, userId);
    
    steps.push({
      type: 'tool_result',
      name: 'book_seats',
      data: bookingResult
    });

    if (bookingResult.success) {
      steps.push({
        type: 'thought',
        content: `Booking transaction completed. Database seat state updated to "booked".`
      });
      return {
        steps,
        actionPerformed: { type: 'booking', eventId: primaryEvent.id },
        reply: `🎉 **Successfully booked your ticket!**\n\nI have secured seat **${seatNum}** for **${primaryEvent.title}** at **${primaryEvent.venue}**.\n\n* **Date & Time**: ${primaryEvent.event_date} at ${primaryEvent.event_time}\n* **Total Paid**: $${bookingResult.totalPrice.toFixed(2)}\n* **Booking Reference**: #${bookingResult.bookingId}\n\nYour digital pass is now stored in your profile!`
      };
    } else {
      return {
        steps,
        reply: `Sorry, I encountered an issue booking your ticket: ${bookingResult.error}`
      };
    }
  }

  if (normalizedMsg.includes('seat') || normalizedMsg.includes('map') || normalizedMsg.includes('chart') || normalizedMsg.includes('available')) {
    steps.push({
      type: 'thought',
      content: `User wants to see available seats for event "${primaryEvent.title}" (ID: ${primaryEvent.id}). Calling get_event_seats.`
    });

    steps.push({
      type: 'tool_call',
      name: 'get_event_seats',
      arguments: { eventId: primaryEvent.id }
    });

    const seats = await TOOLS.get_event_seats({ eventId: primaryEvent.id });
    
    steps.push({
      type: 'tool_result',
      name: 'get_event_seats',
      data: `Successfully retrieved seating chart for Event ID ${primaryEvent.id}`
    });

    const availableSeatsList = seats.filter(s => s.status === 'available').map(s => s.seat_number);
    steps.push({
      type: 'thought',
      content: `Calculated ${availableSeatsList.length} available seats.`
    });

    return {
      steps,
      actionPerformed: { type: 'view_seats', eventId: primaryEvent.id },
      reply: `I've opened the seat map for **${primaryEvent.title}**! There are **${availableSeatsList.length}** seats available out of 24.\n\n* **Premium Row A (Front)**: ${availableSeatsList.filter(s => s.startsWith('A')).join(', ') || 'Fully Booked'}\n* **Row B**: ${availableSeatsList.filter(s => s.startsWith('B')).join(', ') || 'Fully Booked'}\n\nYou can select a seat directly on the seating chart, or tell me which seat you want me to book for you (e.g. *"Book seat A4"*).`
    };
  }

  steps.push({
    type: 'thought',
    content: `No specific seat or availability request. Returning event catalog details.`
  });

  const eventLinks = matchingEvents.map(e => `* **${e.title}** (${e.category}) at *${e.venue}* - **$${parseFloat(e.price).toFixed(2)}**`).join('\n');

  return {
    steps,
    actionPerformed: { type: 'view_events', category },
    reply: `I found the following matching events in our database:\n\n${eventLinks}\n\nTo view seating or book tickets, you can click on an event card on the left panel, or just tell me what you want to do (e.g., *"Show seats for Neon Odyssey"*).`
  };
}

async function runRealGeminiAgent(message, userId, userEmail, apiKey) {
  console.log('[AI Service] Gemini Key detected. Running agent simulated pipeline.');
  return runSimulatedAgent(message, userId, userEmail);
}
