import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { chatService } from '../../services/chatService';
import { supabase } from '../../services/supabaseClient';
import { formatDate } from '../../utils/format';

/* ── Avatar helper ── */
const Avatar = ({ user, size = 38 }) => {
  const isEmoji = v => v && [...v].length === 1 && v.codePointAt(0) > 127;
  const initial = (user?.full_name || 'U')[0].toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: isEmoji(user?.avatar_url) ? size * 0.55 : size * 0.42,
      fontWeight: 800, color: '#fff', overflow: 'hidden',
    }}>
      {isEmoji(user?.avatar_url)
        ? user.avatar_url
        : user?.avatar_url?.startsWith('http')
          ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initial
      }
    </div>
  );
};

/* ── Time format ── */
const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60)   return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`;
  return formatDate(d);
};

const ChatPage = () => {
  const { convId } = useParams();
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages]           = useState([]);
  const [activeConv, setActiveConv]       = useState(null);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(true);
  const [msgLoading, setMsgLoading]       = useState(false);
  const [sending, setSending]             = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const realtimeRef    = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!isAuthenticated) navigate('/login'); }, [isAuthenticated]);

  /* ── Load conversations ── */
  const loadConversations = useCallback(async () => {
    try {
      const data = await chatService.getConversations();
      setConversations(data);
    } catch { /* conversations load may fail silently */ }
  }, []);

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  /* ── Handle tạo conversation từ query param (từ RoomDetail) ── */
  useEffect(() => {
    const landlordId = searchParams.get('landlord');
    const occupantId = searchParams.get('occupant');
    const tenantId = searchParams.get('tenant');
    const roomId     = searchParams.get('room');
    if ((landlordId || occupantId || tenantId) && isAuthenticated) {
      chatService.getOrCreate({ landlordId, occupantId, tenantId, roomId }).then(res => {
        const conv = res.conversation;
        loadConversations();
        navigate(`/chat/${conv.id}`, { replace: true });
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isAuthenticated]);

  /* ── Load messages khi chọn conversation ── */
  const loadMessages = useCallback(async (id) => {
    setMsgLoading(true);
    try {
      const res = await chatService.getMessages(id);
      setMessages(res.messages || []);
      setActiveConv(res.conversation);
    } catch {
      setMessages([]);
    } finally {
      setMsgLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, []);

  useEffect(() => {
    if (convId) {
      loadMessages(convId);
      inputRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  /* ── Supabase Realtime subscription ── */
  useEffect(() => {
    if (!convId) return;

    // Hủy subscription cũ
    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current);
    }

    const channel = supabase
      .channel(`messages-${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, async (payload) => {
        // Lấy thêm sender info
        const { data: sender } = await supabase
          .from('users')
          .select('id, full_name, avatar_url')
          .eq('id', payload.new.sender_id)
          .single();

        const newMsg = { ...payload.new, sender };
        setMessages(prev => {
          // Tránh duplicate
          if (prev.find(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // Cập nhật conversation list
        setConversations(prev => prev.map(c =>
          c.id === convId
            ? { ...c, last_message: payload.new.content, last_message_at: payload.new.created_at }
            : c
        ));

        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .subscribe();

    realtimeRef.current = channel;

    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, [convId]);

  /* ── Scroll khi messages thay đổi ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Gửi tin nhắn ── */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !convId || sending) return;

    const content = input.trim();
    setInput('');
    setSending(true);

    // Optimistic UI
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId, content, created_at: new Date().toISOString(),
      sender_id: user.id, sender: user, conversation_id: convId, is_read: false,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      await chatService.sendMessage(convId, content);
    } catch {
      // Rollback nếu lỗi
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  /* ── Tìm đối phương trong conversation ── */
  const getOtherUser = (conv) => conv?.other_user || null;

  if (!isAuthenticated) return null;

  return (
    <div className="chat-page">
      {/* ── Sidebar: Danh sách conversations ── */}
      <div className={`chat-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="chat-sidebar__header">
          <h2>💬 Tin nhắn</h2>
          <button className="chat-sidebar__toggle" onClick={() => setSidebarOpen(v => !v)}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <div className="chat-sidebar__list">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="conv-skeleton" />)
          ) : conversations.length === 0 ? (
            <div className="chat-empty-sidebar">
              <p>💬</p>
              <p>Chưa có tin nhắn nào</p>
              <small>Nhắn tin từ trang chi tiết phòng</small>
            </div>
          ) : (
            conversations.map(conv => {
              const other = getOtherUser(conv);
              const isActive = conv.id === convId;
              return (
                <div
                  key={conv.id}
                  className={`conv-item ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(`/chat/${conv.id}`)}
                >
                  <Avatar user={other} size={44} />
                  <div className="conv-item__info">
                    <div className="conv-item__top">
                      <strong>{other?.full_name || 'Người dùng'}</strong>
                      <span className="conv-item__time">
                        {conv.last_message_at ? timeAgo(conv.last_message_at) : ''}
                      </span>
                    </div>
                    {conv.rooms && (
                      <span className="conv-item__room">🏠 {conv.rooms.title}</span>
                    )}
                    <p className="conv-item__last">
                      {conv.last_message || 'Bắt đầu cuộc trò chuyện...'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Main: Message Area ── */}
      <div className="chat-main">
        {!convId ? (
          /* Empty state */
          <div className="chat-no-conv">
            <div style={{ fontSize: 56, marginBottom: 16 }}>💬</div>
            <h3>Chọn cuộc trò chuyện</h3>
            <p>Chọn một cuộc trò chuyện từ danh sách bên trái, hoặc bắt đầu từ trang chi tiết phòng.</p>
            <Link to="/rooms" className="btn btn-primary" style={{ marginTop: 20 }}>
              🔍 Tìm phòng để nhắn tin
            </Link>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            {activeConv && (() => {
              const other = conversations.find(c => c.id === convId);
              const otherUser = other ? getOtherUser(other) : null;
              const room = other?.rooms;
              return (
                <div className="chat-header">
                  <button className="chat-sidebar-btn" onClick={() => setSidebarOpen(v => !v)}>☰</button>
                  {otherUser && <Avatar user={otherUser} size={40} />}
                  <div className="chat-header__info">
                    <strong>{otherUser?.full_name || 'Người dùng'}</strong>
                    {room && (
                      <Link to={`/rooms/${room.id}`} className="chat-header__room">
                        🏠 {room.title}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Messages */}
            <div className="chat-messages">
              {msgLoading ? (
                <div className="chat-msg-loading">⏳ Đang tải tin nhắn...</div>
              ) : messages.length === 0 ? (
                <div className="chat-msg-empty">
                  👋 Hãy gửi tin nhắn đầu tiên!
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => {
                    const isMine = msg.sender_id === user.id;
                    const isTemp = msg.id?.toString().startsWith('temp-');
                    const showDate = idx === 0 ||
                      new Date(msg.created_at).toDateString() !==
                      new Date(messages[idx - 1].created_at).toDateString();

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="chat-date-divider">
                            <span>{formatDate(msg.created_at)}</span>
                          </div>
                        )}
                        <div className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                          {!isMine && <Avatar user={msg.sender} size={32} />}
                          <div className={`msg-bubble ${isMine ? 'mine' : 'theirs'} ${isTemp ? 'sending' : ''}`}>
                            <p>{msg.content}</p>
                            <span className="msg-time">
                              {timeAgo(msg.created_at)}
                              {isMine && (isTemp ? ' ⏳' : ' ✓')}
                            </span>
                          </div>
                          {isMine && <Avatar user={user} size={32} />}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <form className="chat-input-area" onSubmit={handleSend}>
              <input
                ref={inputRef}
                type="text"
                className="chat-input"
                placeholder="Nhập tin nhắn... (Enter để gửi)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend(e)}
                disabled={sending}
                maxLength={2000}
                autoComplete="off"
              />
              <button
                type="submit"
                className={`chat-send-btn ${sending ? 'sending' : ''}`}
                disabled={!input.trim() || sending}
                id="btn-send-message"
              >
                {sending ? '⏳' : '📤'}
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        /* ── Layout ── */
        .chat-page {
          display: flex;
          height: calc(100vh - 80px);
          overflow: hidden;
          background: var(--bg-surface);
        }

        /* ── Sidebar ── */
        .chat-sidebar {
          width: 300px; flex-shrink: 0;
          background: var(--bg-surface);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          transition: width .25s cubic-bezier(0.25,0,0.2,1);
          overflow: hidden;
        }
        .chat-sidebar.closed { width: 0; }
        @media(max-width: 768px) {
          .chat-sidebar { position: absolute; z-index: 100; height: 100%; left: 0; }
          .chat-sidebar.closed { width: 0; }
          .chat-sidebar.open  { width: 280px; box-shadow: 4px 0 20px rgba(0,0,0,.12); }
        }

        .chat-sidebar__header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 16px; border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .chat-sidebar__header h2 { font-size: 16px; font-weight: 700; color: var(--text-primary); white-space:nowrap; }
        .chat-sidebar__toggle {
          background: var(--bg-hover); border: none; border-radius: 8px;
          padding: 6px 10px; cursor: pointer; color: var(--text-secondary); font-size: 13px;
          transition: var(--transition); flex-shrink: 0;
        }
        .chat-sidebar__toggle:hover { background: var(--primary-50); color: var(--primary); }

        .chat-sidebar__list { flex: 1; overflow-y: auto; padding: 8px; }
        .chat-sidebar__list::-webkit-scrollbar { width: 4px; }
        .chat-sidebar__list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

        /* Conversation item */
        .conv-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px; border-radius: var(--radius-sm); cursor: pointer;
          transition: var(--transition); border: 1px solid transparent;
        }
        .conv-item:hover  { background: var(--bg-hover); }
        .conv-item.active { background: var(--primary-50); border-color: var(--primary-100); }

        .conv-item__info { flex: 1; min-width: 0; }
        .conv-item__top  { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
        .conv-item__top strong { font-size: 14px; color: var(--text-primary); font-weight: 600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px; }
        .conv-item__time { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
        .conv-item__room { font-size: 11px; color: var(--primary); display:block; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .conv-item__last { font-size: 13px; color: var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        /* Skeleton */
        .conv-skeleton { height: 72px; border-radius: var(--radius-sm); margin-bottom: 8px; background: linear-gradient(90deg,var(--bg-hover) 25%,var(--border) 50%,var(--bg-hover) 75%); background-size:200% 100%; animation: shimmer 1.5s infinite; }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

        /* Empty sidebar */
        .chat-empty-sidebar { text-align:center; padding: 40px 16px; color: var(--text-muted); font-size:14px; }
        .chat-empty-sidebar p:first-child { font-size:36px; margin-bottom:8px; }
        .chat-empty-sidebar small { display:block; font-size:12px; margin-top:4px; opacity:.7; }

        /* ── Main ── */
        .chat-main {
          flex: 1; display: flex; flex-direction: column; overflow: hidden;
          min-width: 0;
        }

        /* No conv selected */
        .chat-no-conv {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; padding: 40px;
        }
        .chat-no-conv h3 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
        .chat-no-conv p  { color: var(--text-secondary); max-width: 380px; font-size: 13px; }

        /* Chat header */
        .chat-header {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 20px; border-bottom: 1px solid var(--border);
          background: var(--bg-surface); flex-shrink: 0;
        }
        .chat-sidebar-btn { background: var(--bg-hover); border: none; border-radius: 8px; padding: 8px; cursor: pointer; color:var(--text-secondary); font-size:16px; transition:var(--transition); }
        .chat-sidebar-btn:hover { background: var(--primary-50); color: var(--primary); }
        .chat-header__info strong { display:block; font-size:14px; font-weight:700; color:var(--text-primary); }
        .chat-header__room { font-size:12px; color:var(--primary); text-decoration:none; }
        .chat-header__room:hover { text-decoration: underline; }

        /* Messages area */
        .chat-messages {
          flex: 1; overflow-y: auto; padding: 20px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius:2px; }

        .chat-msg-loading,
        .chat-msg-empty {
          text-align: center; color: var(--text-muted);
          margin: auto; font-size: 15px; padding: 40px;
        }

        /* Date divider */
        .chat-date-divider {
          display: flex; align-items: center; gap: 12px; margin: 16px 0 8px;
        }
        .chat-date-divider::before,
        .chat-date-divider::after {
          content: ''; flex: 1; height: 1px; background: var(--border);
        }
        .chat-date-divider span { font-size: 12px; color: var(--text-muted); white-space:nowrap; }

        /* Message rows */
        .msg-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 8px; }
        .msg-row.mine   { flex-direction: row-reverse; }
        .msg-row.theirs { flex-direction: row; }

        /* Bubbles */
        .msg-bubble {
          max-width: 68%; padding: 10px 14px; border-radius: 16px;
          position: relative; transition: opacity .2s;
        }
        .msg-bubble.mine {
          background: var(--primary);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .msg-bubble.theirs {
          background: var(--bg-warm);
          border: 1px solid var(--border);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
        }
        .msg-bubble.sending { opacity: .6; }
        .msg-bubble p { font-size: 14px; line-height: 1.55; margin: 0; word-break: break-word; }
        .msg-time { font-size: 11px; opacity: .65; margin-top: 4px; display:block; text-align:right; }

        /* Input area */
        .chat-input-area {
          display: flex; gap: 10px; padding: 14px 20px;
          border-top: 1px solid var(--border);
          background: var(--bg-surface); flex-shrink: 0;
        }
        .chat-input {
          flex: 1; padding: 12px 16px;
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: 24px; color: var(--text-primary); font-size: 14px;
          outline: none; transition: var(--transition);
        }
        .chat-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(13,148,136,.12); }
        .chat-input::placeholder { color: var(--text-muted); }
        .chat-send-btn {
          width: 46px; height: 46px; border-radius: 50%;
          background: var(--primary); border: none; cursor: pointer;
          font-size: 20px; display: flex; align-items: center; justify-content: center;
          transition: var(--transition); flex-shrink: 0;
        }
        .chat-send-btn:hover:not(:disabled) { background: var(--primary-dark); }
        .chat-send-btn:disabled { opacity: .4; cursor: not-allowed; }
        .chat-send-btn.sending { animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </div>
  );
};

export default ChatPage;
