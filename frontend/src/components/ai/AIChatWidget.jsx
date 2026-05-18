import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { geminiService } from '../../services/geminiService';
import { formatCurrency } from '../../utils/format';

const STORAGE_KEY = 'roommie-ai-widget-state';
const HISTORY_KEY = 'roommie-ai-widget-history';
const MAX_HISTORY = 16;

const QUICK_PROMPTS = [
  'Hướng dẫn tôi dùng app',
  'Tìm phòng dưới 4 triệu ở Hà Nội',
  'Gợi ý phòng có wifi và máy lạnh',
  'Tôi là landlord, nên làm gì để đăng tin tốt?',
];

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'Xin chào, mình là trợ lý RoommieMatch. Bạn có thể hỏi cách dùng app hoặc nhờ mình gợi ý phòng phù hợp từ dữ liệu thật trong hệ thống.',
};

const loadPersisted = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [WELCOME_MESSAGE];
  } catch {
    return [WELCOME_MESSAGE];
  }
};

const loadWidgetOpen = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'false');
  } catch {
    return false;
  }
};

const AIChatWidget = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(loadWidgetOpen);
  const [messages, setMessages] = useState(loadPersisted);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [criteria, setCriteria] = useState(null);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const shouldHide = location.pathname === '/assistant';

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
  }, [open]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, rooms]);

  const conversation = useMemo(() => messages.slice(-MAX_HISTORY), [messages]);

  const sendMessage = async (rawText) => {
    const text = String(rawText || '').trim();
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
          role: user?.role || 'guest',
          full_name: user?.full_name || '',
          current_path: location.pathname,
          current_search: location.search,
        },
      });

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }].slice(-MAX_HISTORY));
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
      setCriteria(data.criteria || null);
    } catch (err) {
      const message = err?.response?.data?.error || 'Không thể kết nối trợ lý AI.';
      setError(message);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Mình gặp lỗi khi xử lý yêu cầu. Bạn thử lại sau nhé.' }].slice(-MAX_HISTORY));
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([WELCOME_MESSAGE]);
    setRooms([]);
    setCriteria(null);
    setError('');
    setInput('');
    localStorage.removeItem(HISTORY_KEY);
  };

  if (shouldHide) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          className="ai-float-trigger animate-scaleIn"
          onClick={() => setOpen(true)}
          aria-label="Mở trợ lý AI"
          title="AI trợ lý"
        >
          <span className="ai-float-trigger__icon">🤖</span>
          <span className="ai-float-trigger__text">AI trợ lý</span>
        </button>
      )}

      {open && (
        <section className="ai-widget animate-slideUp" aria-label="Trợ lý AI RoommieMatch">
          <header className="ai-widget__header">
            <div>
              <p className="ai-widget__eyebrow">AI trợ lý tìm phòng</p>
              <h2>Hỏi nhanh, gợi ý thật</h2>
            </div>
            <div className="ai-widget__header-actions">
              <button type="button" className="ai-widget__icon-btn" onClick={resetChat} title="Làm mới cuộc trò chuyện">
                ↺
              </button>
              <button type="button" className="ai-widget__icon-btn" onClick={() => setOpen(false)} title="Đóng trợ lý">
                ×
              </button>
            </div>
          </header>

          <div className="ai-widget__body">
            <div className="ai-widget__chips">
              {QUICK_PROMPTS.map(prompt => (
                <button key={prompt} type="button" className="ai-widget__chip" onClick={() => sendMessage(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>

            <div className="ai-widget__messages">
              {conversation.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`ai-widget__msg ${message.role === 'user' ? 'ai-widget__msg--user' : 'ai-widget__msg--bot'}`}>
                  <div className="ai-widget__bubble">
                    <p>{message.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="ai-widget__msg ai-widget__msg--bot">
                  <div className="ai-widget__bubble ai-widget__bubble--loading">
                    Đang phân tích nhu cầu của bạn...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {error && <p className="ai-widget__error">{error}</p>}

            {(criteria || rooms.length > 0) && (
              <div className="ai-widget__insights">
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
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            <form className="ai-widget__input" onSubmit={(event) => { event.preventDefault(); sendMessage(input); }}>
              <textarea
                className="form-input ai-widget__textarea"
                rows={3}
                placeholder="Ví dụ: Tìm phòng dưới 4 triệu ở Hà Nội, có wifi và máy lạnh"
                value={input}
                onChange={event => setInput(event.target.value)}
                disabled={loading}
              />
              <div className="ai-widget__footer">
                <span className="ai-widget__hint">Có thể hỏi cách dùng app, tìm phòng, hoặc xin gợi ý.</span>
                <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()}>
                  {loading ? 'Đang gửi...' : 'Gửi'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      <style>{widgetStyles}</style>
    </>
  );
};

const widgetStyles = `
  .ai-float-trigger {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: calc(var(--z-toast) - 1);
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 9999px;
    background: var(--primary);
    color: #fff;
    border: none;
    box-shadow: var(--shadow-float);
    font-weight: 700;
  }
  .ai-float-trigger:hover { transform: translateY(-1px); background: var(--primary-dark); }
  .ai-float-trigger__icon { font-size: 18px; }
  .ai-float-trigger__text { font-size: 14px; }

  .ai-widget {
    position: fixed;
    right: 24px;
    bottom: 24px;
    width: 380px;
    max-width: calc(100vw - 24px);
    height: min(70vh, 720px);
    max-height: calc(100vh - 120px);
    z-index: var(--z-toast);
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 22px;
    box-shadow: var(--shadow-float);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .ai-widget__header {
    padding: 16px 16px 14px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    background: linear-gradient(180deg, var(--bg-surface) 0%, var(--primary-50) 100%);
  }
  .ai-widget__eyebrow {
    font-size: 11px;
    font-weight: 800;
    color: var(--primary-dark);
    text-transform: uppercase;
    letter-spacing: .08em;
    margin-bottom: 4px;
  }
  .ai-widget__header h2 {
    font-size: 16px;
    font-weight: 800;
    color: var(--text-primary);
  }
  .ai-widget__header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .ai-widget__icon-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-size: 18px;
    line-height: 1;
  }
  .ai-widget__icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
  .ai-widget__body {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    flex: 1;
  }
  .ai-widget__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ai-widget__chip {
    padding: 7px 10px;
    border-radius: var(--radius-full);
    border: 1px solid var(--border);
    background: var(--bg-warm);
    color: var(--text-secondary);
    font-size: 12px;
  }
  .ai-widget__chip:hover {
    border-color: var(--primary-100);
    background: var(--primary-50);
    color: var(--primary-dark);
  }
  .ai-widget__messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-right: 2px;
  }
  .ai-widget__msg { display: flex; }
  .ai-widget__msg--user { justify-content: flex-end; }
  .ai-widget__bubble {
    max-width: 88%;
    border-radius: 16px;
    padding: 11px 13px;
    background: var(--bg-warm);
    color: var(--text-primary);
    border: 1px solid var(--border);
    line-height: 1.6;
    white-space: pre-line;
  }
  .ai-widget__msg--user .ai-widget__bubble {
    background: var(--primary);
    color: #fff;
    border-color: transparent;
  }
  .ai-widget__bubble--loading {
    color: var(--text-secondary);
    font-style: italic;
  }
  .ai-widget__error {
    color: var(--danger);
    font-size: 12px;
    background: var(--danger-light);
    border: 1px solid #fecaca;
    padding: 8px 10px;
    border-radius: var(--radius-md);
  }
  .ai-widget__insights {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ai-widget__summary {
    background: var(--primary-50);
    border: 1px solid var(--primary-100);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .ai-widget__rooms {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ai-widget__room {
    display: grid;
    grid-template-columns: 68px 1fr;
    gap: 10px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--bg-surface);
    transition: var(--transition);
  }
  .ai-widget__room:hover {
    border-color: var(--primary-100);
    background: var(--bg-hover);
  }
  .ai-widget__room-img {
    width: 68px;
    height: 56px;
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 22px;
  }
  .ai-widget__room-img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .ai-widget__room-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ai-widget__room-body h3 {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.35;
  }
  .ai-widget__room-body p,
  .ai-widget__room-body strong {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
  }
  .ai-widget__room-body strong {
    color: var(--primary-dark);
  }
  .ai-widget__input {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 4px;
    border-top: 1px solid var(--border);
  }
  .ai-widget__textarea {
    resize: vertical;
    min-height: 90px;
  }
  .ai-widget__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .ai-widget__hint {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.45;
  }
  @media (max-width: 640px) {
    .ai-float-trigger {
      right: 12px;
      bottom: 12px;
      padding: 12px 14px;
    }
    .ai-float-trigger__text { display: none; }
    .ai-widget {
      right: 12px;
      left: 12px;
      bottom: 12px;
      width: auto;
      height: min(76vh, 680px);
    }
  }
`;

export default AIChatWidget;
