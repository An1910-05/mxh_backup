import { useEffect, useRef } from 'react';
import { useAIMessages } from '../../hooks/useAIMessages';

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

const AI_AVATAR = (
  <svg viewBox="0 0 36 36" width="32" height="32" fill="none">
    <defs>
      <linearGradient id="aiPageGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop stopColor="#a855f7"/><stop offset="1" stopColor="#3b82f6"/>
      </linearGradient>
    </defs>
    <circle cx="18" cy="18" r="18" fill="url(#aiPageGrad)"/>
    <path d="M18 9l1.8 5.5H25l-4.3 3.1 1.6 5.1L18 19.6l-4.3 3.1 1.6-5.1L11 14.5h5.2L18 9z" fill="white"/>
  </svg>
);

export default function AIChatWindow({ onBack }) {
  const { messages, loading, sendMessage, clearMessages } = useAIMessages();
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const [input, setInput] = [useRef('').current, (v) => { inputRef.current && (inputRef.current.value = v); }];

  // Use local input state via ref to avoid re-renders
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
    <div className="ai-chat-window">
      {/* Header */}
      <div className="ai-chat-window-header">
        {onBack && (
          <button className="chat-back-btn" onClick={onBack} title="Quay lại">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>
        )}
        <div className="ai-chat-window-header-avatar">{AI_AVATAR}</div>
        <div className="ai-chat-window-header-info">
          <span className="ai-chat-window-name">Gemini AI</span>
          <span className="ai-chat-window-status">Trợ lý AI · Luôn hoạt động</span>
        </div>
        <button className="ai-chat-window-clear-btn" onClick={clearMessages} title="Xóa lịch sử">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="ai-chat-window-messages">
        {messages.length === 0 && (
          <div className="ai-fcw-welcome">
            <div className="ai-fcw-welcome-icon">✨</div>
            <p>Xin chào! Tôi là <strong>Gemini AI</strong>.</p>
            <p>Hỏi tôi bất cứ điều gì — viết caption, gợi ý bài đăng, hay chỉ trò chuyện!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`ai-fcw-msg${msg.role === 'user' ? ' ai-fcw-msg--user' : ' ai-fcw-msg--ai'}`}>
            {msg.role === 'assistant' && (
              <div className="ai-fcw-msg-avatar">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                  <defs>
                    <linearGradient id="aiMsgGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#a855f7"/><stop offset="1" stopColor="#3b82f6"/>
                    </linearGradient>
                  </defs>
                  <circle cx="12" cy="12" r="12" fill="url(#aiMsgGrad)"/>
                  <path d="M12 6l1.2 3.7H17l-2.9 2.1 1.1 3.4L12 13.1l-3.2 2.1 1.1-3.4L7 9.7h3.8L12 6z" fill="white"/>
                </svg>
              </div>
            )}
            <div
              className="ai-fcw-msg-bubble"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
          </div>
        ))}
        {loading && (
          <div className="ai-fcw-msg ai-fcw-msg--ai">
            <div className="ai-fcw-msg-avatar">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                <defs>
                  <linearGradient id="aiTypingGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a855f7"/><stop offset="1" stopColor="#3b82f6"/>
                  </linearGradient>
                </defs>
                <circle cx="12" cy="12" r="12" fill="url(#aiTypingGrad)"/>
                <path d="M12 6l1.2 3.7H17l-2.9 2.1 1.1 3.4L12 13.1l-3.2 2.1 1.1-3.4L7 9.7h3.8L12 6z" fill="white"/>
              </svg>
            </div>
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="ai-chat-window-input-row">
        <textarea
          ref={inputRef}
          className="ai-chat-window-input"
          placeholder="Nhắn tin với Gemini AI..."
          onChange={e => { localInput.current = e.target.value; }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
        />
        <button
          className="ai-fcw-send-btn"
          onClick={handleSend}
          disabled={loading}
          title="Gửi"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
