import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

const AIInsights = ({ criteria, rooms, profileSummary }) => {
  if (!criteria && rooms.length === 0) return null;

  return (
    <div className="ai-widget__insights">
      {profileSummary && (
        <div className="ai-widget__profile">
          <strong>Mình ghi nhận:</strong>
          <span>{profileSummary}</span>
        </div>
      )}

      {criteria && (
        <div className="ai-widget__summary">
          <strong>Mình hiểu:</strong>
          <span>
            {criteria.city ? ` ${criteria.city}` : ' chưa chốt khu vực'}
            {criteria.priceMax ? `, tối đa ${formatCurrency(criteria.priceMax)}` : ''}
            {criteria.hasSlots ? ', ưu tiên ở ghép' : ''}
          </span>
        </div>
      )}

      {rooms.length > 0 && (
        <div className="ai-widget__rooms">
          {rooms.slice(0, 3).map(room => (
            <Link key={room.id} to={`/rooms/${room.id}`} className="ai-widget__room">
              <div className="ai-widget__room-img">
                {room.image_url ? <img src={room.image_url} alt={room.title} /> : <span>🏠</span>}
              </div>
              <div className="ai-widget__room-body">
                <h3>{room.title}</h3>
                <p>{room.address}, {room.city}</p>
                <strong>{formatCurrency(room.price)}/tháng</strong>
                {room.match_reason && <span className="ai-widget__room-reason">{room.match_reason}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIInsights;
