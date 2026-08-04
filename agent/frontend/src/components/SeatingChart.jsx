import React from 'react';

export default function SeatingChart({ seats, selectedSeats, onToggleSeat }) {
  if (!seats || seats.length === 0) {
    return (
      <div className="empty-state">
        <p>No seats configured for this event.</p>
      </div>
    );
  }

  const rows = ['A', 'B', 'C', 'D'];
  const columns = [1, 2, 3, 4, 5, 6];

  const getSeatStatus = (seatNum) => {
    const dbSeat = seats.find(s => s.seat_number === seatNum);
    if (!dbSeat) return 'available';
    return dbSeat.status;
  };

  return (
    <div className="seating-section">
      <div className="screen-visual">
        <div className="screen-text">Holographic Stage / Screen</div>
      </div>

      <div className="seat-grid">
        {rows.map(row => 
          columns.map(col => {
            const seatNum = `${row}${col}`;
            const status = getSeatStatus(seatNum);
            const isSel = selectedSeats.includes(seatNum);

            let seatClass = 'seat ';
            if (status === 'booked') {
              seatClass += 'booked';
            } else if (isSel) {
              seatClass += 'selected';
            } else {
              seatClass += 'available';
            }

            return (
              <button
                key={seatNum}
                className={seatClass}
                disabled={status === 'booked'}
                onClick={() => onToggleSeat(seatNum)}
                title={`Seat ${seatNum} - ${status === 'booked' ? 'Reserved' : isSel ? 'Selected' : 'Available'}`}
              >
                {seatNum}
              </button>
            );
          })
        )}
      </div>

      <div className="seating-legend">
        <div className="legend-item">
          <span className="legend-dot available"></span>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot selected"></span>
          <span>Selected</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot booked"></span>
          <span>Booked</span>
        </div>
      </div>
    </div>
  );
}
