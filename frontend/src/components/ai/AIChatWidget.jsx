import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { geminiService } from '../../services/geminiService';
import { roomService } from '../../services/roomService';
import AIChatHeader from './AIChatHeader';
import AIChatInput from './AIChatInput';
import AIInsights from './AIInsights';
import AIMessageList from './AIMessageList';
import AIQuickPrompts from './AIQuickPrompts';
import { widgetStyles } from './AIChatWidget.styles';

const STORAGE_KEY = 'roommie-ai-widget-state';
const HEIGHT_KEY = 'roommie-ai-widget-height';
const HISTORY_KEY = 'roommie-ai-widget-history';
const MAX_HISTORY = 16;
const MIN_HEIGHT = 420;
const MAX_HEIGHT = 760;
const DEFAULT_HEIGHT = 620;

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

const loadWidgetHeight = () => {
  try {
    const stored = Number(localStorage.getItem(HEIGHT_KEY));
    if (Number.isFinite(stored) && stored >= MIN_HEIGHT && stored <= MAX_HEIGHT) {
      return stored;
    }
  } catch {
    // ignore invalid localStorage values
  }
  return DEFAULT_HEIGHT;
};

const buildRoomContext = (data) => {
  const room = data?.room || data;
  if (!room?.id) return null;

  const amenities = (room.room_amenities || data?.room_amenities || [])
    .map(item => item?.amenities?.name)
    .filter(Boolean);
  const reviews = room.reviews || data?.reviews || [];

  return {
    id: room.id,
    title: room.title,
    city: room.city,
    address: room.address,
    price: room.price,
    area: room.area,
    available_slots: room.available_slots,
    description: room.description,
    status: room.status,
    is_available: room.is_available,
    amenities,
    average_rating: reviews.length
      ? (reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / reviews.length).toFixed(1)
      : null,
  };
};

const AIChatWidget = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(loadWidgetOpen);
  const [widgetHeight, setWidgetHeight] = useState(loadWidgetHeight);
  const [messages, setMessages] = useState(loadPersisted);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [criteria, setCriteria] = useState(null);
  const [profileSummary, setProfileSummary] = useState('');
  const [followUpPrompts, setFollowUpPrompts] = useState([]);
  const [error, setError] = useState('');
  const [roomContext, setRoomContext] = useState(null);
  const bottomRef = useRef(null);
  const resizeRef = useRef({ dragging: false, startY: 0, startHeight: DEFAULT_HEIGHT });

  const shouldHide = location.pathname === '/assistant';
  const conversation = useMemo(() => messages.slice(-MAX_HISTORY), [messages]);
  const prompts = followUpPrompts.length > 0 ? followUpPrompts : QUICK_PROMPTS;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
  }, [open]);

  useEffect(() => {
    localStorage.setItem(HEIGHT_KEY, String(widgetHeight));
  }, [widgetHeight]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, rooms]);

  useEffect(() => {
    const match = location.pathname.match(/^\/rooms\/([^/]+)$/);
    const roomId = match?.[1];
    let active = true;

    if (!roomId) {
      setRoomContext(null);
      return () => {};
    }

    roomService.getRoomById(roomId)
      .then((data) => {
        if (active) setRoomContext(buildRoomContext(data));
      })
      .catch(() => {
        if (active) setRoomContext(null);
      });

    return () => {
      active = false;
    };
  }, [location.pathname]);

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
          current_room: roomContext,
        },
      });

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }].slice(-MAX_HISTORY));
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
      setCriteria(data.criteria || null);
      setProfileSummary(data.profile_summary || '');
      setFollowUpPrompts(Array.isArray(data.follow_up_prompts) ? data.follow_up_prompts.slice(0, 4) : []);
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
    setProfileSummary('');
    setFollowUpPrompts([]);
    setError('');
    setInput('');
    localStorage.removeItem(HISTORY_KEY);
  };

  const startResize = (event) => {
    event.preventDefault();
    resizeRef.current = {
      dragging: true,
      startY: event.clientY,
      startHeight: widgetHeight,
    };

    const handleMove = (moveEvent) => {
      if (!resizeRef.current.dragging) return;
      const delta = resizeRef.current.startY - moveEvent.clientY;
      const nextHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizeRef.current.startHeight + delta));
      setWidgetHeight(nextHeight);
    };

    const stopResize = () => {
      resizeRef.current.dragging = false;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stopResize);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopResize);
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
        <section
          className="ai-widget animate-slideUp"
          aria-label="Trợ lý AI RoommieMatch"
          style={{ height: `${widgetHeight}px` }}
        >
          <div className="ai-widget__resize-handle" onPointerDown={startResize} role="presentation" />
          <AIChatHeader onReset={resetChat} onClose={() => setOpen(false)} />

          <div className="ai-widget__body">
            <AIQuickPrompts prompts={prompts} onSend={sendMessage} />

            {location.pathname.startsWith('/rooms/') && roomContext && (
              <div className="ai-widget__context">
                <strong>Đang xem:</strong>
                <span>{roomContext.title}</span>
              </div>
            )}

            <AIMessageList messages={conversation} loading={loading} bottomRef={bottomRef} />

            {error && <p className="ai-widget__error">{error}</p>}

            <AIInsights criteria={criteria} rooms={rooms} profileSummary={profileSummary} />

            <AIChatInput
              input={input}
              loading={loading}
              onInputChange={setInput}
              onSend={sendMessage}
            />
          </div>
        </section>
      )}

      <style>{widgetStyles}</style>
    </>
  );
};

export default AIChatWidget;
