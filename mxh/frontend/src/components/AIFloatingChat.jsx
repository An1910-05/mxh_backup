import { useState, useRef, useEffect } from 'react';
import { API_ORIGIN } from '../config';

const STORAGE_KEY = 'mxh_ai_chat_history';
const MAX_HISTORY = 10;

const AI_AVATAR_SVG = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
    <defs>
      <linearGradient id="aiGradAvatar" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#a855f7"/><stop offset="1" stopColor="#3b82f6"/>
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="12" fill="url(#aiGradAvatar)"/>
    <path d="M12 6l1.2 3.7H17l-2.9 2.1 1.1 3.4L12 13.1l-3.2 2.1 1.1-3.4L7 9.7h3.8L12 6z" fill="white"/>
  </svg>
);

function TypingDots() {
  return (
    <div className="ai-chat-typing">
      <span /><span /><span />
    </div>
  );
}

function renderMarkdown(text) {
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

export default function AIFloatingChat({ open, minimized, onMinimize, onClose, zIndex }) {
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  }, [messages]);

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, minimized]);

  useEffect(() => {
    if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, minimized]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_ORIGIN}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: newMessages.slice(-8) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi kết nối AI');
      setMessages(prev => [...prev, { role: 'assistant', content: data.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (!open) return null;

  return (
    <div
      className={`ai-fcw${minimized ? ' ai-fcw--minimized' : ''}`}
      style={{ zIndex: zIndex || 1100 }}
    >
      <div className="ai-fcw-header" onClick={onMinimize}>
        <div className="ai-fcw-header-left">
          <div className="ai-fcw-avatar">
            <svg viewBox="0 0 36 36" width="32" height="32" fill="none">
              <defs>
                <linearGradient id="aiGradHeader" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#a855f7"/>
                  <stop offset="1" stopColor="#3b82f6"/>
                </linearGradient>
              </defs>
              <circle cx="18" cy="18" r="18" fill="url(#aiGradHeader)"/>
              <path d="M18 9l1.8 5.5H25l-4.3 3.1 1.6 5.1L18 19.6l-4.3 3.1 1.6-5.1L11 14.5h5.2L18 9z" fill="white"/>
            </svg>
            <span className="ai-fcw-online-dot" />
          </div>
          <div className="ai-fcw-header-info">
            <span className="ai-fcw-name">iPock AI</span>
            <span className="ai-fcw-status">Trợ lý AI · Luôn hoạt động</span>
          </div>
        </div>
        <div className="ai-fcw-header-actions" onClick={e => e.stopPropagation()}>
          <button className="ai-fcw-btn" title="Xóa lịch sử" onClick={clearHistory}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
          <button className="ai-fcw-btn" title={minimized ? 'Mở rộng' : 'Thu nhỏ'} onClick={onMinimize}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              {minimized ? <path d="M7 14l5-5 5 5H7z"/> : <path d="M7 10l5 5 5-5H7z"/>}
            </svg>
          </button>
          <button className="ai-fcw-btn" title="Đóng" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z"/>
            </svg>
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="ai-fcw-body">
          <div className="ai-fcw-messages">
            {messages.length === 0 && (
              <div className="ai-fcw-welcome">
                <div className="ai-fcw-welcome-icon">✨</div>
                <p>Xin chào! Tôi là <strong>trợ lý AI của iPock</strong> 🌐</p>
                <p>Hỏi tôi bất cứ điều gì — viết caption, gợi ý bài đăng, hay chỉ trò chuyện thôi!</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`ai-fcw-msg${msg.role === 'user' ? ' ai-fcw-msg--user' : ' ai-fcw-msg--ai'}`}>
                {msg.role === 'assistant' && (
                  <div className="ai-fcw-msg-avatar">{AI_AVATAR_SVG}</div>
                )}
                {msg.role === 'assistant' ? (
                  <div
                    className="ai-fcw-msg-bubble"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                ) : (
                  <div className="ai-fcw-msg-bubble">{msg.content}</div>
                )}
              </div>
            ))}
            {loading && (
              <div className="ai-fcw-msg ai-fcw-msg--ai">
                <div className="ai-fcw-msg-avatar">{AI_AVATAR_SVG}</div>
                <TypingDots />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="ai-fcw-input-row">
            <textarea
              ref={inputRef}
              className="ai-fcw-input"
              placeholder="Hỏi iPock AI..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button
              className="ai-fcw-send-btn"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              title="Gửi"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
