import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useChat } from '../../contexts/ChatContext';
import { getMessages, sendMessageRest, getReadReceipt, unsendMessageRest, hideMessageRest } from '../../services/chat';
import { sendMessage, sendTyping, on, isWsConnected, unsendMessage as wsUnsend, hideMessage as wsHide } from '../../services/websocket';
import { timeAgo } from '../../utils/time';
import MessageBubble from './MessageBubble';
import { uploadFile } from '../../services/api';
import { API_ORIGIN } from '../../config';
const DEFAULT_AVATAR = '/default-avatar.png';
const URL_REGEX = /(https?:\/\/[^\s<>"']+)/;

function InputLinkPreview({ url, onDismiss }) {
  const [og, setOg] = useState(null);
  const [loading, setLoading] = useState(true);

  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/link-preview?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        if (!cancelled && json.success && json.data) setOg(json.data);
      } catch (err) {
        console.error('Preview fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="input-lp">
        <div className="input-lp-loading">
          <span className="apple-spinner" style={{ width: 16, height: 16 }} />
          <span className="input-lp-loading-text">Đang tải xem trước...</span>
        </div>
        <button className="input-lp-close" onClick={onDismiss}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" /></svg>
        </button>
      </div>
    );
  }

  if (!og) return null;

  const hasImage = og.image;
  const title = og.title || og.site_name || hostname;
  const desc = og.description || '';

  return (
    <div className="input-lp">
      <a href={url} target="_blank" rel="noopener noreferrer" className="input-lp-card">
        {hasImage && (
          <div className="input-lp-img">
            <img src={og.image} alt="" onError={(e) => { e.target.parentElement.style.display = 'none'; }} />
          </div>
        )}
        <div className="input-lp-info">
          <span className="input-lp-domain">{og.site_name || hostname}</span>
          <span className="input-lp-title">{title.length > 60 ? title.slice(0, 60) + '…' : title}</span>
          {desc && <span className="input-lp-desc">{desc.length > 80 ? desc.slice(0, 80) + '…' : desc}</span>}
        </div>
      </a>
      <button className="input-lp-close" onClick={onDismiss}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" /></svg>
      </button>
    </div>
  );
}

export default function ChatWindow({ conversation, onBack, refreshKey = 0 }) {
  const { user } = useAuth();
  const { markConversationRead, typingUsers } = useChat();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [otherReadMsgId, setOtherReadMsgId] = useState(null);
  const [otherReadInfo, setOtherReadInfo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const messagesRef = useRef([]);
  const newMsgIds = useRef(new Set());
  const prevScrollH = useRef(0);

  const convId = conversation.id;
  messagesRef.current = messages;

  useEffect(() => {
    setMessages([]);
    setLoading(true);
    setHasMore(true);
    setOtherReadMsgId(null);
    setOtherReadInfo(null);
    newMsgIds.current = new Set();
    loadMessages();
    loadReadReceipt();
  }, [convId, refreshKey]);

  const loadReadReceipt = async () => {
    try {
      const info = await getReadReceipt(convId);
      if (info) {
        setOtherReadMsgId(info.last_read_msg_id ? Number(info.last_read_msg_id) : null);
        setOtherReadInfo({ avatar: info.avatar, username: info.username, read_at: info.last_read_at });
      }
    } catch (e) {
      console.error('Failed to load read receipt:', e);
    }
  };

  const enrichMsg = (msg) => {
    if (!msg.sender_avatar && !msg.username) {
      const existing = messagesRef.current.find(m => Number(m.sender_id) === Number(msg.sender_id) && (m.sender_avatar || m.username));
      if (existing) {
        if (!msg.sender_avatar && existing.sender_avatar) msg.sender_avatar = existing.sender_avatar;
        if (!msg.username && existing.username) msg.username = existing.username;
      }
    }
    if (!msg.sender_avatar && Number(msg.sender_id) !== Number(user?.id) && conversation.display_avatar) {
      msg.sender_avatar = conversation.display_avatar;
    }
    if (!msg.username && Number(msg.sender_id) !== Number(user?.id) && conversation.display_name) {
      msg.username = conversation.display_name;
    }
    return msg;
  };

  useEffect(() => {
    const unsub = on('updateNewMessage', (msg) => {
      if (msg.conversation_id != convId) return;
      const enriched = enrichMsg(msg);
      if (enriched.id) newMsgIds.current.add(String(enriched.id));
      setMessages(prev => {
        if (prev.some(m => m.id === enriched.id)) return prev;
        return [...prev, enriched];
      });
      markConversationRead(convId, enriched.id);
      if (Number(enriched.sender_id) !== Number(user?.id)) {
        const lastOwnInList = messagesRef.current.filter(m => Number(m.sender_id) === Number(user?.id)).pop();
        if (lastOwnInList?.id) {
          setOtherReadMsgId(Number(lastOwnInList.id));
          setOtherReadInfo(prev => prev ? { ...prev, read_at: new Date().toISOString() } : prev);
        }
      }
    });

    const unsubEdit = on('updateEditMessage', (msg) => {
      if (msg.conversation_id != convId) return;
      setMessages(prev => prev.map(m => m.id === msg.id ? enrichMsg(msg) : m));
    });

    const unsubDelete = on('updateDeleteMessage', (data) => {
      if (data.conversation_id != convId) return;
      const delId = Number(data.message_id);
      setMessages(prev => prev.filter(m => Number(m.id) !== delId));
    });

    const unsubAck = on('ack', (msg) => {
      if (msg.conversation_id != convId) return;
      const enriched = enrichMsg(msg);
      setMessages(prev => {
        const updated = prev.filter(m => !(m._local && m.client_msg_id === enriched.client_msg_id));
        if (updated.some(m => m.id === enriched.id)) return updated;
        return [...updated, enriched];
      });
    });

    const unsubRead = on('updateReadHistory', (data) => {
      if (data.conversation_id != convId) return;
      if (Number(data.user_id) !== Number(user?.id)) {
        setOtherReadMsgId(Number(data.max_id));
        setOtherReadInfo(prev => prev ? { ...prev, read_at: new Date().toISOString() } : prev);
      }
    });

    const unsubUnsend = on('updateUnsendMessage', (data) => {
      if (data.conversation_id != convId) return;
      const unsendId = Number(data.message_id);
      setMessages(prev => prev.map(m =>
        Number(m.id) === unsendId ? { ...m, is_unsent: true, content: null, media_url: null } : m
      ));
    });

    return () => { unsub(); unsubEdit(); unsubDelete(); unsubAck(); unsubRead(); unsubUnsend(); };
  }, [convId]);

  const loadMessages = async (beforeId = null) => {
    try {
      const msgs = await getMessages(convId, 50, beforeId);
      if (!msgs || msgs.length === 0) {
        setHasMore(false);
        setLoading(false);
        return;
      }
      if (msgs.length < 50) setHasMore(false);

      if (beforeId) {
        setMessages(prev => [...msgs, ...prev]);
      } else {
        setMessages(msgs);

        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg) markConversationRead(convId, lastMsg.id);
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadOlder = () => {
    if (!hasMore || loading) return;
    const firstMsg = messages[0];
    if (firstMsg) {
      setLoading(true);
      prevScrollH.current = containerRef.current?.scrollHeight || 0;
      loadMessages(firstMsg.id);
    }
  };

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !prevScrollH.current) return;
    const diff = el.scrollHeight - prevScrollH.current;
    if (diff > 0) el.scrollTop -= diff;
    prevScrollH.current = 0;
  }, [messages]);


  const handleSendQuickEmoji = async (emoji) => {
    if (sending) return;
    const clientMsgId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const localMsg = {
      client_msg_id: clientMsgId,
      conversation_id: convId,
      sender_id: user.id,
      username: user.username,
      content: emoji,
      content_type: 'text',
      created_at: new Date().toISOString(),
      _local: true,
    };
    newMsgIds.current.add(clientMsgId);
    setMessages(prev => [...prev, localMsg]);
    setSending(true);
    try {
      if (isWsConnected()) {
        await sendMessage(convId, emoji, { clientMsgId });
      } else {
        const serverMsg = await sendMessageRest(convId, emoji);
        serverMsg.client_msg_id = clientMsgId;
        setMessages(prev => {
          const updated = prev.filter(m => !(m._local && m.client_msg_id === clientMsgId));
          return [...updated, serverMsg];
        });
      }
    } catch (e) {
      console.error('Quick emoji send failed:', e);
      setMessages(prev => prev.filter(m => !(m._local && m.client_msg_id === clientMsgId)));
    } finally {
      setSending(false);
    }
  };

  const handleMediaSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) return;
    setMediaFile(file);
    setMediaPreview({ url: URL.createObjectURL(file), type: isVideo ? 'video' : 'image', name: file.name });
    e.target.value = '';
  };

  const handleMediaRemove = () => {
    if (mediaPreview?.url) URL.revokeObjectURL(mediaPreview.url);
    setMediaFile(null);
    setMediaPreview(null);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !mediaFile) return;
    if (sending || mediaUploading) return;

    const clientMsgId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (mediaFile) {
      const file = mediaFile;
      const preview = mediaPreview;
      setMediaFile(null);
      setMediaPreview(null);
      setInput('');
      setPreviewUrl(null);
      setPreviewDismissed(false);
      if (inputRef.current) inputRef.current.style.height = 'auto';

      const contentType = preview.type === 'video' ? 'video' : 'image';
      const localMsg = {
        client_msg_id: clientMsgId,
        conversation_id: convId,
        sender_id: user.id,
        username: user.username,
        content: text || null,
        content_type: contentType,
        media_url: preview.url,
        created_at: new Date().toISOString(),
        _local: true,
        _uploading: true,
      };
      newMsgIds.current.add(clientMsgId);
      setMessages(prev => [...prev, localMsg]);
      setMediaUploading(true);

      try {
        const uploadRes = await uploadFile('/upload/media', 'media', file);
        const data = uploadRes.data || uploadRes;
        const mediaUrl = data.media_url || data.url;
        const serverMsg = await sendMessageRest(convId, text || '', {
          contentType,
          mediaUrl,
          mediaWidth: data.media_width || null,
          mediaHeight: data.media_height || null,
        });
        serverMsg.client_msg_id = clientMsgId;
        URL.revokeObjectURL(preview.url);
        setMessages(prev => {
          const updated = prev.filter(m => !(m._local && m.client_msg_id === clientMsgId));
          return [...updated, serverMsg];
        });
      } catch (e) {
        console.error('Media send failed:', e);
        URL.revokeObjectURL(preview.url);
        setMessages(prev => prev.filter(m => !(m._local && m.client_msg_id === clientMsgId)));
      } finally {
        setMediaUploading(false);
      }
      return;
    }

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

    newMsgIds.current.add(clientMsgId);
    setMessages(prev => [...prev, localMsg]);
    setInput('');
    setPreviewUrl(null);
    setPreviewDismissed(false);
    if (inputRef.current) inputRef.current.style.height = 'auto';
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

  const handleUnsend = async (msg) => {
    if (!msg.id) return;
    const msgId = Number(msg.id);
    try {
      if (isWsConnected()) {
        await wsUnsend(msgId);
      } else {
        await unsendMessageRest(msgId);
      }
      setMessages(prev => prev.map(m =>
        Number(m.id) === msgId ? { ...m, is_unsent: true, content: null, media_url: null } : m
      ));
    } catch (e) {
      console.error('Unsend failed:', e);
    }
  };

  const handleHide = async (msg) => {
    if (!msg.id) return;
    const msgId = Number(msg.id);
    try {
      if (isWsConnected()) {
        await wsHide(msgId);
      } else {
        await hideMessageRest(msgId);
      }
      setMessages(prev => prev.filter(m => Number(m.id) !== msgId));
    } catch (e) {
      console.error('Hide failed:', e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    setTimeout(autoResize, 0);

    const match = val.match(URL_REGEX);
    if (match && match[0] !== previewUrl) {
      setPreviewUrl(match[0]);
      setPreviewDismissed(false);
    } else if (!match) {
      setPreviewUrl(null);
      setPreviewDismissed(false);
    }

    const now = Date.now();
    if (now - lastTypingSent.current > 2000) {
      sendTyping(convId);
      lastTypingSent.current = now;
    }
  };

  const isOtherTyping = Object.keys(typingUsers).some(
    key => key.startsWith(`${convId}_`) && !key.endsWith(`_${user?.id}`)
  );

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || !hasMore) return;
    const atTop = el.scrollHeight + el.scrollTop - el.clientHeight < 10;
    if (atTop) loadOlder();
  };

  const displayName = conversation.display_name || 'User';
  const displayAvatar = conversation.display_avatar;
  const otherUserId = conversation.other_user_id;

  // Index of the last confirmed (non-local) own message — for "Đã gửi" label
  const lastOwnIdx = (() => {
    for (let k = messages.length - 1; k >= 0; k--) {
      if (Number(messages[k].sender_id) === Number(user?.id) && !messages[k]._local) return k;
    }
    return -1;
  })();

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <button className="chat-back-btn" onClick={onBack}>←</button>
        <Link to={otherUserId ? `/profile_id=${otherUserId}` : '#'} className="chat-header-user">
          <div className="chat-header-avatar">
            {displayAvatar ? (
              <img src={`${API_ORIGIN}${displayAvatar}`} alt="" />
            ) : (
              <img src={DEFAULT_AVATAR} alt="" />
            )}
            {conversation.is_online && <span className="conv-online-dot" />}
          </div>
          <div className="chat-header-info">
            <span className="chat-header-name">{displayName}</span>
            <span className="chat-header-status">
              {isOtherTyping ? 'đang nhập...' : conversation.is_online ? 'Đang hoạt động' : conversation.last_seen ? `Hoạt động ${timeAgo(conversation.last_seen)}` : ''}
            </span>
          </div>
        </Link>
      </div>

      <div className="chat-messages-wrap">
      <div className="chat-messages" ref={containerRef} onScroll={handleScroll}>
        <div className="chat-messages-inner">
          {hasMore && (
            <button className="chat-load-more" onClick={loadOlder} disabled={loading}>
              {loading ? 'Đang tải...' : 'Tải tin nhắn cũ hơn'}
            </button>
          )}

          {messages.map((msg, i) => {
            const isOwn = Number(msg.sender_id) === Number(user?.id);
            const prevMsg = messages[i - 1];
            const nextMsg = messages[i + 1];
            const toDate = (s) => new Date(s && !String(s).includes('T') && !String(s).includes('Z') ? s + 'Z' : s);
            const showTime = !prevMsg || (toDate(msg.created_at) - toDate(prevMsg.created_at)) > 300000;
            const sameSenderPrev = prevMsg && Number(prevMsg.sender_id) === Number(msg.sender_id) && !showTime;
            const sameSenderNext = nextMsg && Number(nextMsg.sender_id) === Number(msg.sender_id) && (toDate(nextMsg.created_at) - toDate(msg.created_at)) <= 300000;
            const isFirst = !sameSenderPrev;
            const isLast = !sameSenderNext;
            const showAvatar = !isOwn && isLast;

            const msgId = msg.id ? Number(msg.id) : null;
            let isSeenHere = false;
            if (isOwn && otherReadMsgId && msgId && msgId <= otherReadMsgId) {
              const nextOwnMsg = messages.slice(i + 1).find(m => Number(m.sender_id) === Number(user?.id));
              const nextOwnId = nextOwnMsg?.id ? Number(nextOwnMsg.id) : null;
              isSeenHere = !nextOwnId || nextOwnId > otherReadMsgId;
            }

            return (
              <MessageBubble
                key={msg.id || msg.client_msg_id}
                message={msg}
                isOwn={isOwn}
                showAvatar={showAvatar}
                showTime={showTime}
                isFirst={isFirst}
                isLast={isLast}
                seenAvatar={isSeenHere ? (otherReadInfo?.avatar?.trim() || displayAvatar?.trim() || DEFAULT_AVATAR) : null}
                seenName={isSeenHere ? (otherReadInfo?.username || displayName) : null}
                seenAt={isSeenHere ? otherReadInfo?.read_at : null}
                showSentTime={isOwn && i === lastOwnIdx && !isSeenHere}
                isNew={newMsgIds.current.has(String(msg.id)) || newMsgIds.current.has(msg.client_msg_id)}
                onUnsend={handleUnsend}
                onHide={handleHide}
              />
            );
          })}

          {isOtherTyping && (
            <div className="chat-typing-indicator">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          )}
        </div>
      </div>
      </div>

      {previewUrl && !previewDismissed && (
        <InputLinkPreview url={previewUrl} onDismiss={() => setPreviewDismissed(true)} />
      )}

      {mediaPreview && (
        <div className="chat-media-preview">
          {mediaPreview.type === 'image' ? (
            <img src={mediaPreview.url} alt="" className="chat-media-preview-img" />
          ) : (
            <video src={mediaPreview.url} className="chat-media-preview-video" controls />
          )}
          {mediaUploading && <div className="chat-media-preview-overlay"><span className="apple-spinner" style={{ width: 24, height: 24 }} /></div>}
          {!mediaUploading && (
            <button type="button" className="chat-media-preview-remove" onClick={handleMediaRemove} title="Xóa">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" /></svg>
            </button>
          )}
        </div>
      )}

      <div className="chat-input-area">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={handleMediaSelect}
        />
        <div className="chat-composer">
          {/* Left action buttons */}
          <div className="chat-composer-actions">
            <button
              type="button"
              className="chat-composer-btn"
              title="Gửi ảnh/video"
              onClick={() => fileInputRef.current?.click()}
              disabled={mediaUploading}
            >
              {/* Image icon */}
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M9.302.5H6.698C5.8.5 5.05.5 4.456.58c-.628.084-1.195.27-1.65.725-.456.456-.642 1.023-.726 1.65C2 3.55 2 4.3 2 5.199v13.604c0 .899 0 1.648.08 2.242.084.628.27 1.195.725 1.65.456.455 1.023.641 1.65.725C5.05 23.5 5.8 23.5 6.698 23.5h10.604c.899 0 1.648 0 2.242-.08.628-.084 1.195-.27 1.65-.725.456-.456.642-1.023.726-1.65.08-.595.08-1.344.08-2.243V5.198c0-.898 0-1.648-.08-2.242-.084-.628-.27-1.195-.726-1.65C20.74.85 20.172.663 19.544.58 18.95.5 18.2.5 17.302.5zM7 6.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0zm4.302 6.677a1.75 1.75 0 0 0-2.475 0L5 16.356l-.43-.43a1.75 1.75 0 0 0-2.474 0l-.596.597V5.25c0-.964.002-1.612.067-2.095.062-.461.169-.659.3-.789.13-.13.327-.237.788-.3C3.138 2.003 3.786 2 4.75 2h14.5c.964 0 1.612.002 2.095.067.461.062.659.169.789.3.13.13.237.327.3.788.064.483.066 1.131.066 2.095v9.772l-.596-.595a1.75 1.75 0 0 0-2.475 0L17 15.356l-2.5-3.01a1.75 1.75 0 0 0-2.667-.007L9 15.356l-1.698-2.429z"/>
              </svg>
            </button>
          </div>

          {/* Input pill */}
          <div className="chat-composer-pill">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Aa"
              rows={1}
              className="chat-input"
            />
          </div>

          {/* Send / Quick-emoji button */}
          <button
            type="button"
            onClick={() => {
              if (!input.trim() && !mediaFile) {
                handleSendQuickEmoji('🥺');
              } else {
                handleSend();
              }
            }}
            disabled={sending || mediaUploading}
            className={`chat-composer-send${(!input.trim() && !mediaFile) ? ' chat-composer-send--like' : ''}`}
            title={(!input.trim() && !mediaFile) ? 'Gửi 🥺' : 'Gửi'}
          >
            {(!input.trim() && !mediaFile) ? (
              <span style={{ fontSize: 22, lineHeight: 1 }}>🥺</span>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
