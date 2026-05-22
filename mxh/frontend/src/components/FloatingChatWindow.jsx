import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import { useCall } from '../contexts/CallContext';
import { useAIMessages } from '../hooks/useAIMessages';
import ChatWindow from './chat/ChatWindow';
import VerifiedBadge from './VerifiedBadge';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';

// ── AI Floating body ─────────────────────────────────────────────────────────
function renderMarkdown(text) {
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

function TypingDots() {
  return (
    <div className="ai-chat-typing">
      <span /><span /><span />
    </div>
  );
}

function AIFloatingBody() {
  const { messages, loading, sendMessage, clearMessages } = useAIMessages();
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const localInput = useRef('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    const text = localInput.current;
    if (!text.trim() || loading) return;
    sendMessage(text);
    localInput.current = '';
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fcw-body">
      <div className="ai-fcw-messages" style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <div className="ai-fcw-welcome">
            <div className="ai-fcw-welcome-icon">✨</div>
            <p>Hỏi tôi bất cứ điều gì!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`ai-fcw-msg${msg.role === 'user' ? ' ai-fcw-msg--user' : ' ai-fcw-msg--ai'}`}>
            {msg.role === 'assistant' && (
              <div className="ai-fcw-msg-avatar">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <defs><linearGradient id={`aiG${i}`} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#a855f7"/><stop offset="1" stopColor="#3b82f6"/></linearGradient></defs>
                  <circle cx="12" cy="12" r="12" fill={`url(#aiG${i})`}/>
                  <path d="M12 6l1.2 3.7H17l-2.9 2.1 1.1 3.4L12 13.1l-3.2 2.1 1.1-3.4L7 9.7h3.8L12 6z" fill="white"/>
                </svg>
              </div>
            )}
            <div className="ai-fcw-msg-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          </div>
        ))}
        {loading && (
          <div className="ai-fcw-msg ai-fcw-msg--ai">
            <div className="ai-fcw-msg-avatar">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <defs><linearGradient id="aiTypG" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#a855f7"/><stop offset="1" stopColor="#3b82f6"/></linearGradient></defs>
                <circle cx="12" cy="12" r="12" fill="url(#aiTypG)"/>
                <path d="M12 6l1.2 3.7H17l-2.9 2.1 1.1 3.4L12 13.1l-3.2 2.1 1.1-3.4L7 9.7h3.8L12 6z" fill="white"/>
              </svg>
            </div>
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="ai-fcw-input-row">
        <textarea
          ref={inputRef}
          className="ai-fcw-input"
          placeholder="Hỏi Gemini AI..."
          onChange={e => { localInput.current = e.target.value; }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
        />
        <button className="ai-fcw-send-btn" onClick={handleSend} disabled={loading} title="Gửi">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  );
}

// ── Regular + AI floating item ────────────────────────────────────────────────
function FloatingChatItem({ conv, index }) {
  const { closeChat, minimizeChat, conversations, openChat } = useChat();
  const { startCall, callState } = useCall();
  const live = conv.isAI ? conv : (conversations.find(c => c.id === conv.id) || conv);
  const rightOffset = 248 + index * 328;

  const avatarSrc = live.display_avatar ? `${API_ORIGIN}${live.display_avatar}` : DEFAULT_AVATAR;

  return (
    <div
      className={`fcw${conv.minimized ? ' fcw--minimized' : ''}`}
      style={{ right: rightOffset }}
    >
      {/* Header */}
      <div
        className="fcw-header"
        style={conv.isAI ? { background: 'linear-gradient(135deg,#a855f7,#3b82f6)' } : {}}
        onClick={() => minimizeChat(conv.id)}
      >
        <div className="fcw-header-left">
          {conv.isAI ? (
            <>
              <div className="fcw-avatar-wrap">
                <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
                  <defs><linearGradient id="fcwAiGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#a855f7"/><stop offset="1" stopColor="#3b82f6"/></linearGradient></defs>
                  <circle cx="18" cy="18" r="18" fill="url(#fcwAiGrad)"/>
                  <path d="M18 9l1.8 5.5H25l-4.3 3.1 1.6 5.1L18 19.6l-4.3 3.1 1.6-5.1L11 14.5h5.2L18 9z" fill="white"/>
                </svg>
                <span className="fcw-online-dot" style={{ background: '#22c55e' }} />
              </div>
              <div className="fcw-header-info">
                <span className="fcw-name" style={{ color: '#fff' }}>{live.display_name}</span>
                <span className="fcw-status" style={{ color: 'rgba(255,255,255,0.8)' }}>Trợ lý AI</span>
              </div>
            </>
          ) : (
            <Link
              to={`/${live.other_custom_url || live.display_name}`}
              className="fcw-header-profile-link"
              onClick={e => e.stopPropagation()}
              title={`Xem trang cá nhân ${live.display_name}`}
            >
              <div className="fcw-avatar-wrap">
                <img src={avatarSrc} alt="" className="fcw-avatar" onError={e => { e.target.src = DEFAULT_AVATAR; }} />
                {live.is_online && <span className="fcw-online-dot" />}
              </div>
              <div className="fcw-header-info">
                <span className="fcw-name-row">
                  <span className="fcw-name">{live.display_name}</span>
                  {live.other_is_verified && (
                    <VerifiedBadge isVerified ownerId={live.other_user_id} size={13} />
                  )}
                </span>
                {live.is_online
                  ? <span className="fcw-status">Đang hoạt động</span>
                  : <span className="fcw-status fcw-status--offline">Ngoại tuyến</span>
                }
              </div>
            </Link>
          )}
        </div>
        <div className="fcw-header-actions" onClick={e => e.stopPropagation()}>
          {!conv.isAI && (
            <>
              <button
                className="fcw-btn"
                title="Gọi điện thoại"
                disabled={callState !== 'idle'}
                onClick={() => startCall({
                  id: live.other_user_id,
                  username: live.display_name,
                  avatar: live.display_avatar || null,
                })}
              >
                <i className="bi bi-telephone-fill" aria-hidden="true" />
              </button>
              <button className="fcw-btn" title="Gọi video">
                <i className="bi bi-camera-video-fill" aria-hidden="true" />
              </button>
            </>
          )}
          <button
            className="fcw-btn"
            style={conv.isAI ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : {}}
            title={conv.minimized ? 'Mở rộng' : 'Thu nhỏ'}
            onClick={() => minimizeChat(conv.id)}
          >
            <i className={conv.minimized ? 'bi bi-chevron-up' : 'bi bi-dash-lg'} aria-hidden="true" />
          </button>
          <button
            className="fcw-btn"
            style={conv.isAI ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : {}}
            title="Đóng"
            onClick={() => closeChat(conv.id)}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
        {!conv.minimized && !conv.isAI && live.unread_count > 0 && (
          <span className="fcw-unread">{live.unread_count}</span>
        )}
      </div>

      {/* Body */}
      {!conv.minimized && (
        conv.isAI
          ? <AIFloatingBody />
          : <div className="fcw-body"><ChatWindow conversation={live} /></div>
      )}
    </div>
  );
}

export default function FloatingChatManager() {
  const { openChats } = useChat();
  if (!openChats.length) return null;
  return (
    <>
      {openChats.map((conv, i) => (
        <FloatingChatItem key={conv.id} conv={conv} index={i} />
      ))}
    </>
  );
}
