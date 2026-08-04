import React from 'react';
import { Calendar, MapPin, Clock } from 'lucide-react';

export default function EventCard({ event, isSelected, onSelect }) {
  const getCategoryClass = (category) => {
    switch (category.toLowerCase()) {
      case 'concert': return 'concert';
      case 'movie': return 'movie';
      case 'sports': return 'sports';
      case 'theater': return 'theater';
      default: return '';
    }
  };

  return (
    <div 
      className={`event-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(event)}
    >
      <img src={event.image_url} alt={event.title} className="event-img" />
      <div className="event-info">
        <div className="event-header">
          <span className={`event-tag ${getCategoryClass(event.category)}`}>
            {event.category}
          </span>
          <span className="event-price">${parseFloat(event.price).toFixed(2)}</span>
        </div>
        <h3 className="event-title">{event.title}</h3>
        <p className="event-desc">{event.description}</p>
        <div className="event-footer">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Calendar size={12} /> {event.event_date}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={12} /> {event.event_time}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <MapPin size={12} /> {event.venue.split(',')[0]}
          </span>
        </div>
      </div>
    </div>
  );
}
