import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { geminiService } from '../../services/geminiService';
import { formatCurrency } from '../../utils/format';

const QUICK_PROMPTS = [
  'Hướng dẫn tôi dùng RoommieMatch',
  'Tìm phòng dưới 4 triệu ở Hà Nội, có wifi và máy lạnh',
  'Tôi muốn phòng yên tĩnh, an toàn, gần trung tâm',
  'Tôi là landlord, cần làm gì để đăng phòng hiệu quả?',
];

const initialMessages = [
  {
    role: 'assistant',
    content: 'Xin chào, mình là trợ lý RoommieMatch. Hãy nói nhu cầu của bạn, mình sẽ hướng dẫn cách dùng app và gợi ý phòng phù hợp từ dữ liệu hiện có.',
  },
];

const AssistantPage = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [criteria, setCriteria] = useState(null);
  const [provider, setProvider] = useState('');
  const [error, setError] = useState('');

  const sendMessage = async (content) => {
    const text = content.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const data = await geminiService.assistantChat({
        message: text,
        conversation: nextMessages,
        context: {
          role: user?.role,
          full_name: user?.full_name,
          current_path: window.location.pathname,
        },
      });

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
      setCriteria(data.criteria || null);
      setProvider(data.provider || '');
    } catch (err) {
      setError(err?.response?.data?.error || 'Không thể kết nối trợ lý AI.');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Mình đang gặp lỗi khi xử lý yêu cầu. Bạn thử lại sau hoặc mô tả ngắn gọn hơn nhé.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="assistant-page">
      <div className="container assistant-shell">
        <section className="assistant-hero animate-slideUp">
          <div>
            <p className="assistant-kicker">AI trợ lý tìm phòng</p>
            <h1>Hỏi để được hướng dẫn và gợi ý phòng phù hợp</h1>
            <p>
              Trợ lý này giúp bạn hiểu cách dùng RoommieMatch, lọc dữ liệu phòng thật từ Supabase,
              và gợi ý những phòng sát nhu cầu nhất.
            </p>
          </div>
          <div className="assistant-hero__badge">
            {provider === 'gemini' ? 'Gemini đang hoạt động' : 'Chế độ gợi ý dự phòng'}
          </div>
        </section>

        <section className="assistant-layout">
          <div className="assistant-chat animate-slideUp">
            <div className="assistant-chat__quick">
              {QUICK_PROMPTS.map(prompt => (
                <button key={prompt} type="button" className="assistant-chip" onClick={() => sendMessage(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>

            <div className="assistant-messages">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`assistant-msg ${message.role === 'user' ? 'assistant-msg--user' : 'assistant-msg--bot'}`}>
                  <div className="assistant-msg__bubble">
                    <p>{message.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="assistant-msg assistant-msg--bot">
                  <div className="assistant-msg__bubble assistant-msg__bubble--loading">
                    Đang phân tích nhu cầu và tìm dữ liệu phù hợp...
                  </div>
                </div>
              )}
            </div>

            <form className="assistant-input" onSubmit={handleSubmit}>
              <textarea
                className="form-input assistant-input__field"
                rows={3}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ví dụ: Tìm phòng dưới 4 triệu ở Hà Nội, có wifi, máy lạnh và chỗ để xe"
              />
              {error && <p className="form-error">{error}</p>}
              <div className="assistant-input__actions">
                <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
                  {loading ? 'Đang hỏi...' : 'Gửi cho trợ lý'}
                </button>
              </div>
            </form>
          </div>

          <aside className="assistant-sidebar animate-slideUp">
            <div className="assistant-panel">
              <h2>Gợi ý phòng</h2>
              {criteria && (
                <div className="assistant-summary">
                  <p><strong>Đã hiểu:</strong></p>
                  <p>
                    {criteria.city ? `Khu vực ${criteria.city}` : 'Chưa chốt khu vực'}
                    {criteria.priceMax ? `, tối đa ${formatCurrency(criteria.priceMax)}` : ''}
                    {criteria.hasSlots ? ', ưu tiên ở ghép' : ''}
                  </p>
                </div>
              )}

              {rooms.length === 0 ? (
                <div className="assistant-empty">
                  <p>Chưa có danh sách gợi ý. Hãy hỏi rõ hơn một chút để mình lọc chính xác hơn.</p>
                </div>
              ) : (
                <div className="assistant-room-list">
                  {rooms.map(room => {
                    const primaryImage = room.image_url;
                    return (
                      <Link key={room.id} to={`/rooms/${room.id}`} className="assistant-room-card">
                        <div className="assistant-room-card__image">
                          {primaryImage ? <img src={primaryImage} alt={room.title} /> : <div className="assistant-room-card__placeholder">🏠</div>}
                        </div>
                        <div className="assistant-room-card__body">
                          <h3>{room.title}</h3>
                          <p>{room.address}, {room.city}</p>
                          <strong>{formatCurrency(room.price)}/tháng</strong>
                          {room.area ? <span>{room.area} m²</span> : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              <div className="assistant-panel__tip">
                <strong>Ví dụ bạn có thể hỏi:</strong>
                <ul>
                  <li>“Tìm phòng cho sinh viên dưới 3 triệu ở Đà Nẵng”</li>
                  <li>“Tôi chưa biết dùng app, hướng dẫn tôi từng bước”</li>
                  <li>“Gợi ý phòng yên tĩnh, có wifi và chỗ để xe”</li>
                </ul>
              </div>
            </div>
          </aside>
        </section>
      </div>

      <style>{assistantStyles}</style>
    </div>
  );
};

const assistantStyles = `
  .assistant-page { padding: 28px 0 64px; }
  .assistant-shell { display: flex; flex-direction: column; gap: 20px; }
  .assistant-hero {
    background: linear-gradient(135deg, var(--bg-surface) 0%, var(--primary-50) 100%);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 24px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }
  .assistant-kicker { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--primary-dark); margin-bottom: 8px; }
  .assistant-hero h1 { font-size: 28px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px; }
  .assistant-hero p { color: var(--text-secondary); max-width: 68ch; line-height: 1.7; }
  .assistant-hero__badge {
    padding: 10px 14px;
    border-radius: var(--radius-full);
    background: var(--bg-surface);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  .assistant-layout { display: grid; grid-template-columns: 1.4fr .9fr; gap: 20px; align-items: start; }
  @media (max-width: 1024px) { .assistant-layout { grid-template-columns: 1fr; } }
  .assistant-chat, .assistant-sidebar {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
  }
  .assistant-chat { padding: 18px; display: flex; flex-direction: column; gap: 16px; min-height: 680px; }
  .assistant-chat__quick { display: flex; flex-wrap: wrap; gap: 8px; }
  .assistant-chip {
    padding: 8px 12px;
    border-radius: var(--radius-full);
    border: 1px solid var(--border);
    background: var(--bg-hover);
    color: var(--text-secondary);
    font-size: 13px;
    transition: var(--transition);
  }
  .assistant-chip:hover { border-color: var(--primary); color: var(--primary-dark); background: var(--primary-50); }
  .assistant-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 4px; }
  .assistant-msg { display: flex; }
  .assistant-msg--user { justify-content: flex-end; }
  .assistant-msg--bot { justify-content: flex-start; }
  .assistant-msg__bubble {
    max-width: 78%;
    padding: 14px 16px;
    border-radius: 18px;
    background: var(--bg-warm);
    color: var(--text-primary);
    border: 1px solid var(--border);
    line-height: 1.7;
    white-space: pre-line;
  }
  .assistant-msg--user .assistant-msg__bubble { background: var(--primary); color: #fff; border-color: transparent; }
  .assistant-msg__bubble--loading { color: var(--text-secondary); font-style: italic; }
  .assistant-input { display: flex; flex-direction: column; gap: 12px; }
  .assistant-input__field { resize: vertical; min-height: 96px; }
  .assistant-input__actions { display: flex; justify-content: flex-end; }
  .assistant-sidebar { padding: 18px; }
  .assistant-panel { display: flex; flex-direction: column; gap: 16px; }
  .assistant-panel h2 { font-size: 18px; font-weight: 700; color: var(--text-primary); }
  .assistant-summary {
    background: var(--primary-50);
    border: 1px solid var(--primary-100);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.6;
  }
  .assistant-empty {
    padding: 24px 18px;
    background: var(--bg-warm);
    border: 1px dashed var(--border);
    border-radius: var(--radius-lg);
    color: var(--text-secondary);
    font-size: 14px;
  }
  .assistant-room-list { display: flex; flex-direction: column; gap: 12px; }
  .assistant-room-card {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 12px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-surface);
    transition: var(--transition);
  }
  .assistant-room-card:hover { border-color: var(--primary-100); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
  .assistant-room-card__image { width: 96px; height: 80px; border-radius: 12px; overflow: hidden; background: var(--bg-hover); }
  .assistant-room-card__image img { width: 100%; height: 100%; object-fit: cover; }
  .assistant-room-card__placeholder { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 28px; color: var(--text-muted); }
  .assistant-room-card__body { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .assistant-room-card__body h3 { font-size: 14px; font-weight: 700; color: var(--text-primary); line-height: 1.4; }
  .assistant-room-card__body p, .assistant-room-card__body span { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
  .assistant-room-card__body strong { font-size: 14px; color: var(--primary-dark); margin-top: 2px; }
  .assistant-panel__tip {
    padding-top: 4px;
    border-top: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.6;
  }
  .assistant-panel__tip ul { margin: 8px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
  @media (max-width: 640px) {
    .assistant-hero { flex-direction: column; }
    .assistant-room-card { grid-template-columns: 1fr; }
    .assistant-room-card__image { width: 100%; height: 180px; }
  }
`;

export default AssistantPage;
