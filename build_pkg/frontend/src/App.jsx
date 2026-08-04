import React, { useState, useEffect } from 'react';
import { Sparkles, LogIn, LogOut, Ticket, Armchair, User, Trash2 } from 'lucide-react';
import EventCard from './components/EventCard';
import SeatingChart from './components/SeatingChart';
import AiAgentPanel from './components/AiAgentPanel';
import AuthModal from './components/AuthModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const [userBookings, setUserBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('book');

  useEffect(() => {
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      setUser(JSON.parse(cachedUser));
    }
    fetchEvents();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserBookings();
    } else {
      setUserBookings([]);
    }
  }, [user]);

  useEffect(() => {
    if (activeCategory === 'All') {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(events.filter(e => e.category.toLowerCase() === activeCategory.toLowerCase()));
    }
  }, [events, activeCategory]);

  const fetchEvents = async () => {
    try {
      const response = await fetch('https://agentic-ai-ticket-booking-4.onrender.com/api/events');
      const data = await response.json();
      setEvents(data);
      if (data.length > 0 && !selectedEvent) {
        handleSelectEvent(data[0]);
      }
    } catch (err) {
      console.error('Failed to load events catalog:', err);
    }
  };

  const handleSelectEvent = async (event) => {
    setSelectedEvent(event);
    setSelectedSeats([]);
    setCheckoutSuccess(false);
    setCheckoutError('');
    
    try {
      const response = await fetch(`https://agentic-ai-ticket-booking-4.onrender.com/api/events/${event.id}`);
      const data = await response.json();
      setSeats(data.seats);
    } catch (err) {
      console.error('Failed to fetch seating details:', err);
    }
  };

  const fetchUserBookings = async () => {
    if (!user) return;
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`https://agentic-ai-ticket-booking-4.onrender.com/api/bookings/user/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setUserBookings(data);
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  };

  const handleToggleSeat = (seatNum) => {
    setCheckoutSuccess(false);
    setCheckoutError('');
    if (selectedSeats.includes(seatNum)) {
      setSelectedSeats(prev => prev.filter(s => s !== seatNum));
    } else {
      setSelectedSeats(prev => [...prev, seatNum]);
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    if (selectedSeats.length === 0) return;

    setCheckoutLoading(true);
    setCheckoutError('');
    setCheckoutSuccess(false);

    const token = localStorage.getItem('token');

    try {
      const response = await fetch('https://agentic-ai-ticket-booking-4.onrender.com/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          seats: selectedSeats
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Checkout process failed.');
      }

      setCheckoutSuccess(true);
      setSelectedSeats([]);
      handleSelectEvent(selectedEvent);
      fetchUserBookings();
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking and release the seats?')) return;
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`https://agentic-ai-ticket-booking-4.onrender.com/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchUserBookings();
        if (selectedEvent) {
          handleSelectEvent(selectedEvent);
        }
      }
    } catch (err) {
      console.error('Cancellation failed:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setActiveTab('book');
  };

  const handleAiBookingCompleted = (action) => {
    console.log('[App] Received Agentic UI callback event:', action);
    if (action.eventId) {
      const matched = events.find(e => e.id === action.eventId);
      if (matched) {
        handleSelectEvent(matched);
      }
    }
    fetchEvents();
    if (user) {
      fetchUserBookings();
    }
  };

  const categories = ['All', 'Concert', 'Movie', 'Sports', 'Theater'];

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand" onClick={() => setActiveTab('book')}>
          <div className="brand-logo">
            <Sparkles size={22} style={{ color: '#06070a' }} />
          </div>
          <span className="brand-text">AETHERPASS</span>
        </div>

        <nav className="nav-actions">
          {user ? (
            <>
              <div 
                className="btn btn-secondary" 
                style={{ cursor: 'pointer', gap: '0.4rem', border: 'none', background: 'transparent' }}
              >
                <User size={16} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: '0.9rem', textTransform: 'none', color: 'var(--text-high)' }}>
                  {user.name}
                </span>
              </div>
              <button 
                className={`btn ${activeTab === 'tickets' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab(activeTab === 'tickets' ? 'book' : 'tickets')}
              >
                <Ticket size={16} />
                My Passes
              </button>
              <button className="btn btn-secondary" onClick={handleLogout}>
                <LogOut size={16} />
                Sign Out
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setIsAuthOpen(true)}>
              <LogIn size={16} />
              Login Portal
            </button>
          )}
        </nav>
      </header>

      <main className="dashboard-grid">
        {activeTab === 'tickets' ? (
          <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
            <h2 className="panel-title">
              <Ticket size={24} style={{ color: 'var(--color-primary)' }} />
              My Digital Passes
            </h2>
            <p style={{ color: 'var(--text-mid)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Verify details of your confirmed high-fidelity seating arrangements.
            </p>

            {userBookings.length === 0 ? (
              <div className="empty-state" style={{ height: '300px' }}>
                <Ticket size={48} />
                <p>No confirmed passes found in your identity profile.</p>
                <button className="btn btn-primary" onClick={() => setActiveTab('book')}>
                  Explore Events
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', overflowY: 'auto', maxHeight: '65vh' }}>
                {userBookings.map((b) => (
                  <div key={b.id} className="event-card" style={{ cursor: 'default', flexDirection: 'column', height: 'fit-content' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <img src={b.image_url} alt={b.title} className="event-img" style={{ width: '80px', height: '80px' }} />
                      <div>
                        <span className="event-tag concert" style={{ fontSize: '0.7rem' }}>
                          Confirmed Pass
                        </span>
                        <h4 className="event-title" style={{ marginTop: '0.4rem' }}>{b.title}</h4>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '10px', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-mid)' }}>
                      <div>📍 <strong>Venue</strong>: {b.venue}</div>
                      <div>📅 <strong>Date</strong>: {b.event_date}</div>
                      <div>🕒 <strong>Time</strong>: {b.event_time}</div>
                      <div>💺 <strong>Seats Secured</strong>: <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{b.seats_booked}</span></div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem', marginTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Paid: <strong>${parseFloat(b.total_price).toFixed(2)}</strong></span>
                        <span>Ref: #{b.id}</span>
                      </div>
                    </div>

                    <button 
                      className="btn btn-secondary" 
                      style={{ marginTop: '1rem', background: 'rgba(255, 42, 109, 0.05)', borderColor: 'rgba(255, 42, 109, 0.2)', color: 'var(--color-danger)' }}
                      onClick={() => handleCancelBooking(b.id)}
                    >
                      <Trash2 size={14} />
                      Cancel Booking
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div className="glass-panel" style={{ flexGrow: 1 }}>
                <h2 className="panel-title">
                  <Sparkles size={20} style={{ color: 'var(--color-primary)' }} />
                  Upcoming Holographic Events
                </h2>
                
                <div className="category-filter">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      className={`filter-pill ${activeCategory === cat ? 'active' : ''}`}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="events-container">
                  {filteredEvents.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      isSelected={selectedEvent?.id === event.id}
                      onSelect={handleSelectEvent}
                    />
                  ))}
                </div>
              </div>

              {selectedEvent && (
                <div className="glass-panel">
                  <h2 className="panel-title">
                    <Armchair size={20} style={{ color: 'var(--color-secondary)' }} />
                    Secure Your Position
                  </h2>
                  <p style={{ color: 'var(--text-mid)', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
                    Select seats for **{selectedEvent.title}**
                  </p>

                  <SeatingChart
                    seats={seats}
                    selectedSeats={selectedSeats}
                    onToggleSeat={handleToggleSeat}
                  />

                  <div className="booking-info-panel">
                    {checkoutError && (
                      <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(255, 42, 109, 0.05)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255, 42, 109, 0.2)' }}>
                        {checkoutError}
                      </div>
                    )}
                    {checkoutSuccess && (
                      <div style={{ color: 'var(--color-primary)', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(0, 255, 204, 0.05)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(0, 255, 204, 0.2)' }}>
                        🎉 Booking successful! Check your tickets in 'My Passes'!
                      </div>
                    )}

                    <div className="summary-row">
                      <span>Seats Selected:</span>
                      <span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
                        {selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None'}
                      </span>
                    </div>
                    <div className="summary-row total">
                      <span>Grand Total:</span>
                      <span style={{ color: 'var(--color-primary)' }}>
                        ${(selectedSeats.length * parseFloat(selectedEvent.price)).toFixed(2)}
                      </span>
                    </div>

                    <button
                      className="btn btn-action"
                      style={{ width: '100%', padding: '0.8rem' }}
                      disabled={selectedSeats.length === 0 || checkoutLoading}
                      onClick={handleCheckout}
                    >
                      {checkoutLoading ? 'Encrypting Booking...' : !user ? 'Login to Confirm booking' : `Confirm Seating Pass`}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <AiAgentPanel
                onBookingCompleted={handleAiBookingCompleted}
                currentEvent={selectedEvent}
              />
            </div>
          </>
        )}
      </main>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(userObj) => setUser(userObj)}
      />
    </div>
  );
}
