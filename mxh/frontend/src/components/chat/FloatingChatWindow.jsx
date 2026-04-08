import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useChat } from '../../contexts/ChatContext';
import { getMessages, sendMessageRest } from '../../services/chat';
import { sendMessage, sendTyping, on, isWsConnected } from '../../services/websocket';
import { timeAgo } from '../../utils/time';
import { API_ORIGIN } from '../../config';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function FloatingChatWindow({ conversation, index, onClose, onMinimize, minimized }) {
  const { user } = useAuth();
  const { markConversationRead, typingUsers } = useChat();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastTypingSent = useRef(0);
  const messagesRef = useRef([]);
  const convId = conversation.id;
  messagesRef.current = messages;

  const rightOffset = 16 + index * (320 + 8);

  // Load messages on mount / when window is opened
  useEffect(() => {
    if (minimized) return;
    setMessages([]);
    setLoading(true);
    loadMessages();
  }, [convId, minimized]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (!minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, minimized]);

  const loadMessages = async () => {
    try {
      const msgs = await getMessages(convId, 30);
      if (msgs && msgs.length > 0) {
        setMessages(msgs);
        markConversationRead(convId, msgs[msgs.length - 1].id);
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    } finally {
      setLoading(false);
    }
  };

  // WebSocket events
  useEffect(() => {
    const unsub = on('updateNewMessage', (msg) => {
      if (msg.conversation_id != convId) return;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      markConversationRead(convId, msg.id);
    });

    const unsubAck = on('ack', (msg) => {
      if (msg.conversation_id != convId) return;
      setMessages(prev => {
        const updated = prev.filter(m => !(m._local && m.client_msg_id === msg.client_msg_id));
        if (updated.some(m => m.id === msg.id)) return updated;
        return [...updated, msg];
      });
    });

    const unsubUnsend = on('updateUnsendMessage', (data) => {
      if (data.conversation_id != convId) return;
      setMessages(prev => prev.map(m =>
        Number(m.id) === Number(data.message_id)
          ? { ...m, is_unsent: true, content: null }
          : m
      ));
    });

    return () => { unsub(); unsubAck(); unsubUnsend(); };
  }, [convId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const clientMsgId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const localMsg = {
      client_msg_id: clientMsgId,
      conversation_id: convId,
      sender_id: user.id,
      username: user.username,
      content: text,
      content_type: 'text',
      created_at: new Date().toISOString(),
      _local: true,
    };

    setMessages(prev => [...prev, localMsg]);
    setInput('');
    setSending(true);

    try {
      if (isWsConnected()) {
        await sendMessage(convId, text, { clientMsgId });
      } else {
        const serverMsg = await sendMessageRest(convId, text);
        serverMsg.client_msg_id = clientMsgId;
        setMessages(prev => {
          const updated = prev.filter(m => !(m._local && m.client_msg_id === clientMsgId));
          return [...updated, serverMsg];
        });
      }
    } catch (e) {
      console.error('Send failed:', e);
      setMessages(prev => prev.filter(m => !(m._local && m.client_msg_id === clientMsgId)));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const now = Date.now();
    if (now - lastTypingSent.current > 2000) {
      sendTyping(convId);
      lastTypingSent.current = now;
    }
  };

  const isOtherTyping = Object.keys(typingUsers).some(
    key => key.startsWith(`${convId}_`) && !key.endsWith(`_${user?.id}`)
  );

  const displayName = conversation.display_name || 'User';
  const displayAvatar = conversation.display_avatar;
  const avatarSrc = displayAvatar ? `${API_ORIGIN}${displayAvatar}` : DEFAULT_AVATAR;

  return (
    <div
      className={`floating-chat${minimized ? ' floating-chat--minimized' : ''}`}
      style={{ right: rightOffset }}
    >
      {/* Header */}
      <div className="floating-chat-header" onClick={onMinimize}>
        <div className="floating-chat-header-user">
          <div className="floating-chat-avatar-wrap">
            <img
              src={avatarSrc}
              alt=""
              className="floating-chat-avatar"
              onError={e => { e.target.src = DEFAULT_AVATAR; }}
            />
            {conversation.is_online && <span className="floating-chat-online-dot" />}
          </div>
          <div className="floating-chat-header-info">
            <span className="floating-chat-name">{displayName}</span>
            {!minimized && (
              <span className="floating-chat-status">
                {isOtherTyping
                  ? 'đang nhập...'
                  : conversation.is_online
                    ? 'Đang hoạt động'
                    : conversation.last_seen
                      ? `Hoạt động ${timeAgo(conversation.last_seen)}`
                      : ''}
              </span>
            )}
          </div>
        </div>
        <div className="floating-chat-header-btns" onClick={e => e.stopPropagation()}>
          <button
            className="floating-chat-btn"
            onClick={onMinimize}
            title={minimized ? 'Mở rộng' : 'Thu nhỏ'}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 13H5v-2h14v2z" />
            </svg>
          </button>
          <button
            className="floating-chat-btn"
            onClick={onClose}
            title="Đóng"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <>
          <div className="floating-chat-messages" ref={el => {
            if (el) {
              // Store ref for scroll to bottom
            }
          }}>
            {loading && (
              <div className="floating-chat-loading">
                <span className="apple-spinner" style={{ width: 20, height: 20 }} />
              </div>
            )}
            {!loading && messages.map((msg, i) => {
              const isOwn = Number(msg.sender_id) === Number(user?.id);
              const prevMsg = messages[i - 1];
              const toDate = s => new Date(s && !String(s).includes('T') ? s + 'Z' : s);
              const showTime = !prevMsg || (toDate(msg.created_at) - toDate(prevMsg.created_at)) > 300000;
              const sameSenderPrev = prevMsg && Number(prevMsg.sender_id) === Number(msg.sender_id) && !showTime;

              return (
                <div key={msg.id || msg.client_msg_id}>
                  {showTime && (
                    <div className="floating-chat-time-divider">
                      {timeAgo(msg.created_at)}
                    </div>
                  )}
                  <div className={`floating-msg-row${isOwn ? ' floating-msg-row--own' : ''}`}>
                    {!isOwn && !sameSenderPrev && (
                      <img
                        src={avatarSrc}
                        alt=""
                        className="floating-msg-avatar"
                        onError={e => { e.target.src = DEFAULT_AVATAR; }}
                      />
                    )}
                    {!isOwn && sameSenderPrev && <div className="floating-msg-avatar-spacer" />}
                    <div className={`floating-msg-bubble${msg.is_unsent ? ' floating-msg-bubble--unsent' : ''}`}>
                      {msg.is_unsent
                        ? <em style={{ opacity: 0.5, fontSize: 12 }}>Tin nhắn đã bị thu hồi</em>
                        : msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            {isOtherTyping && (
              <div className="floating-msg-row">
                <img src={avatarSrc} alt="" className="floating-msg-avatar" onError={e => { e.target.src = DEFAULT_AVATAR; }} />
                <div className="floating-chat-typing">
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="floating-chat-input-area">
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Aa"
              className="floating-chat-input"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="floating-chat-send-btn"
              title="Gửi"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
