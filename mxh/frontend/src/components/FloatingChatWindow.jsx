import { useRef, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useAIMessages } from '../hooks/useAIMessages';
import ChatWindow from './chat/ChatWindow';
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
          <div className="fcw-avatar-wrap">
            {conv.isAI ? (
              <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
                <defs><linearGradient id="fcwAiGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#a855f7"/><stop offset="1" stopColor="#3b82f6"/></linearGradient></defs>
                <circle cx="18" cy="18" r="18" fill="url(#fcwAiGrad)"/>
                <path d="M18 9l1.8 5.5H25l-4.3 3.1 1.6 5.1L18 19.6l-4.3 3.1 1.6-5.1L11 14.5h5.2L18 9z" fill="white"/>
              </svg>
            ) : (
              <img src={avatarSrc} alt="" className="fcw-avatar" onError={e => { e.target.src = DEFAULT_AVATAR; }} />
            )}
            {conv.isAI
              ? <span className="fcw-online-dot" style={{ background: '#22c55e' }} />
              : live.is_online && <span className="fcw-online-dot" />
            }
          </div>
          <div className="fcw-header-info">
            <span className="fcw-name" style={conv.isAI ? { color: '#fff' } : {}}>{live.display_name}</span>
            {conv.isAI
              ? <span className="fcw-status" style={{ color: 'rgba(255,255,255,0.8)' }}>Trợ lý AI</span>
              : live.is_online
                ? <span className="fcw-status">Đang hoạt động</span>
                : <span className="fcw-status fcw-status--offline">Ngoại tuyến</span>
            }
          </div>
        </div>
        <div className="fcw-header-actions" onClick={e => e.stopPropagation()}>
          {!conv.isAI && (
            <>
              {/* Phone call button */}
              <button className="fcw-btn" title="Gọi điện thoại">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                </svg>
              </button>
              {/* Video call button */}
              <button className="fcw-btn" title="Gọi video">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              </button>
            </>
          )}
          {/* Minimize button */}
          <button
            className="fcw-btn"
            style={conv.isAI ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : {}}
            title={conv.minimized ? 'Mở rộng' : 'Thu nhỏ'}
            onClick={() => minimizeChat(conv.id)}
          >
            {conv.minimized ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M7 14l5-5 5 5H7z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="5" y="11" width="14" height="2" rx="1"/>
              </svg>
            )}
          </button>
          {/* Close button */}
          <button
            className="fcw-btn"
            style={conv.isAI ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : {}}
            title="Đóng"
            onClick={() => closeChat(conv.id)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z"/>
            </svg>
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
