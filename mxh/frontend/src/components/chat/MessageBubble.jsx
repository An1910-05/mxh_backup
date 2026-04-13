import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getPost } from '../../services/graphql';
import VideoPlayer from '../VideoPlayer';
import { API_ORIGIN } from '../../config';
const DEFAULT_AVATAR = '/default-avatar.png';

function resolveSeenAvatarSrc(seenAvatar) {
  if (!seenAvatar || !String(seenAvatar).trim()) return DEFAULT_AVATAR;
  const s = String(seenAvatar).trim();
  if (s.startsWith('http')) return s;
  if (s === DEFAULT_AVATAR || s.endsWith('default-avatar.png')) return DEFAULT_AVATAR;
  return `${API_ORIGIN}${s.startsWith('/') ? s : `/${s}`}`;
}

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g;

function extractPostId(content) {
  if (!content) return null;
  const match = content.match(/\/post\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function isShareMessage(content) {
  return content && content.startsWith('[Chia sẻ bài viết]');
}

function extractUrls(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  return matches || [];
}

function renderTextWithLinks(text, isOwn) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`msg-link${isOwn ? ' msg-link--own' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    URL_REGEX.lastIndex = 0;
    return part;
  });
}

function ExternalLinkPreview({ url }) {
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
        console.error('OG fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="lp-card lp-card--external lp-card--loading">
        <span className="apple-spinner" style={{ width: 16, height: 16 }} />
      </div>
    );
  }

  const hasImage = og && og.image;
  const title = og?.title || og?.site_name || hostname;
  const desc = og?.description || '';

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="lp-card lp-card--external" onClick={(e) => e.stopPropagation()}>
      {hasImage && (
        <div className="lp-media">
          <img src={og.image} alt="" loading="lazy" onError={(e) => { e.target.parentElement.style.display = 'none'; }} />
        </div>
      )}
      <div className="lp-body">
        <span className="lp-domain">{og?.site_name || hostname}</span>
        {title && <span className="lp-title">{title.length > 80 ? title.slice(0, 80) + '…' : title}</span>}
        {desc && <span className="lp-desc">{desc.length > 120 ? desc.slice(0, 120) + '…' : desc}</span>}
      </div>
    </a>
  );
}

function formatChatTime(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).includes('T') || String(dateStr).includes('Z') ? dateStr : dateStr + 'Z';
  return new Date(str).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function formatFullTime(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).includes('T') || String(dateStr).includes('Z') ? dateStr : dateStr + 'Z';
  return new Date(str).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function formatSentTime(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).includes('T') || String(dateStr).includes('Z') ? dateStr : dateStr + 'Z';
  const d = new Date(str);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  const hhmm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  if (diffDays === 0) return `Đã gửi lúc ${hhmm}`;
  if (diffDays === 1) return `Đã gửi hôm qua lúc ${hhmm}`;
  if (diffDays < 7) return `Đã gửi ${days[d.getDay()]} lúc ${hhmm}`;
  return `Đã gửi ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })} lúc ${hhmm}`;
}

function formatChatDivider(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).includes('T') || String(dateStr).includes('Z') ? dateStr : dateStr + 'Z';
  const d = new Date(str);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  const hhmm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  if (diffDays === 0) return `Hôm nay lúc ${hhmm}`;
  if (diffDays === 1) return `Hôm qua lúc ${hhmm}`;
  if (diffDays < 7) return `${weekdays[d.getDay()]} lúc ${hhmm}`;
  return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })} lúc ${hhmm}`;
}

function PostLinkPreview({ postId }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPost(postId);
        if (!cancelled) setPost(data);
      } catch (err) {
        console.error('Preview load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [postId]);

  if (loading) {
    return (
      <div className="lp-card lp-card--loading">
        <span className="apple-spinner" style={{ width: 18, height: 18 }} />
      </div>
    );
  }

  if (!post) {
    return (
      <Link to={`/post/${postId}`} className="lp-card lp-card--error">
        <div className="lp-body">
          <span className="lp-domain">Bài viết không tồn tại</span>
        </div>
      </Link>
    );
  }

  const mediaUrl = post.media_url ? `${API_ORIGIN}${post.media_url}` : null;
  const displayContent = post.content && post.content !== '📷' && post.content !== '🎬' ? post.content : '';

  return (
    <Link to={`/post/${postId}`} className="lp-card" onClick={(e) => e.stopPropagation()}>
      {mediaUrl && post.media_type === 'image' && (
        <div className="lp-media">
          <img src={mediaUrl} alt="" loading="lazy" />
        </div>
      )}
      {mediaUrl && post.media_type === 'video' && (
        <div className="lp-media lp-media--video">
          <video src={mediaUrl} preload="metadata" />
          <div className="lp-play-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      )}
      <div className="lp-body">
        <span className="lp-domain">localhost:5173</span>
        <span className="lp-title">{post.username}</span>
        {displayContent && <span className="lp-desc">{displayContent.length > 100 ? displayContent.slice(0, 100) + '…' : displayContent}</span>}
      </div>
    </Link>
  );
}

export default function MessageBubble({ message, isOwn, showAvatar, showTime, isFirst, isLast, seenAvatar, seenName, seenAt, showSentTime, isNew, onUnsend, onHide }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [hoverRow, setHoverRow] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const msg = message;
  const isUnsent = msg.is_unsent === true || msg.is_unsent === 1 || msg.is_unsent === '1';
  const hasMedia = !isUnsent && msg.media_url && (msg.content_type === 'image' || msg.content_type === 'video');
  const hasText = !isUnsent && !!msg.content;
  // Detect emoji-only message (no background bubble, large display)
  const isEmojiOnly = !isUnsent && hasText && !hasMedia && (() => {
    const t = msg.content.trim();
    if (!t || t.length > 12) return false;
    // Remove all emoji + ZWJ sequences + variation selectors + text chars
    const stripped = t.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\u20E3\s]/gu, '');
    return stripped.length === 0;
  })();
  const sharePostId = isShareMessage(msg.content) ? extractPostId(msg.content) : null;
  const externalUrls = !sharePostId && hasText ? extractUrls(msg.content) : [];
  const hasExternalUrl = externalUrls.length > 0;
  const isUrlOnly = hasExternalUrl && msg.content.trim().match(/^https?:\/\/[^\s]+$/);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowTooltip(false);
        setHoverRow(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const moreRef = useRef(null);
  const rowRef = useRef(null);
  const [tipPos, setTipPos] = useState(null);
  const tipTimer = useRef(null);

  const handleContextMenu = (e) => {
    if (msg._local || isUnsent) return;
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleMoreClick = () => {
    if (!moreRef.current) return;
    const rect = moreRef.current.getBoundingClientRect();
    const menuW = 180;
    const x = isOwn ? Math.max(4, rect.left - menuW) : rect.right;
    const y = rect.bottom + 4;
    setMenuPos({ x, y });
    setShowMenu(true);
  };

  const bubbleCls = [
    'msg-bubble',
    isOwn ? 'msg-bubble--own' : 'msg-bubble--other',
    msg._local ? 'msg-bubble--sending' : '',
    hasMedia && !hasText ? 'msg-bubble--media-only' : '',
    (sharePostId || isUrlOnly) ? 'msg-bubble--link-preview' : '',
    isFirst ? 'msg-bubble--first' : '',
    isLast ? 'msg-bubble--last' : '',
    !isFirst && !isLast ? 'msg-bubble--mid' : '',
    isFirst && isLast ? 'msg-bubble--solo' : '',
    isNew && !msg._local ? (isOwn ? 'msg-bubble--new-own' : 'msg-bubble--new-other') : '',
    isUnsent ? 'msg-bubble--unsent' : '',
    isEmojiOnly ? 'msg-bubble--emoji-only' : '',
  ].filter(Boolean).join(' ');

  const seenAlt = seenAt && seenName
    ? `${seenName} đã xem lúc ${formatFullTime(seenAt)}`
    : seenName
      ? `${seenName} đã xem`
      : 'Đã xem';

  const bubbleBody = (
    <div className={bubbleCls}>
      {isUnsent ? (
        <span className="msg-unsent-text">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          {isOwn ? 'Bạn đã thu hồi tin nhắn' : `${msg.username || 'Người dùng'} đã thu hồi tin nhắn`}
        </span>
      ) : (
        <>
          {msg.content_type === 'image' && msg.media_url && (
            <div className="msg-media">
              <img src={`${API_ORIGIN}${msg.media_url}`} alt="" loading="lazy" />
            </div>
          )}
          {msg.content_type === 'video' && msg.media_url && (
            <div className="msg-media">
              <VideoPlayer src={`${API_ORIGIN}${msg.media_url}`} />
            </div>
          )}
          {hasText && !sharePostId && !isUrlOnly && <span className="msg-text">{renderTextWithLinks(msg.content, isOwn)}</span>}
          {sharePostId && <PostLinkPreview postId={sharePostId} />}
          {hasExternalUrl && (
            <div className="msg-link-previews">
              {externalUrls.map((url, i) => <ExternalLinkPreview key={i} url={url} />)}
            </div>
          )}
        </>
      )}
    </div>
  );

  const bubbleZoneEl = (
    <div
      className="msg-bubble-zone"
      onContextMenu={handleContextMenu}
      onMouseEnter={() => {
        clearTimeout(tipTimer.current);
        setShowTooltip(true);
        tipTimer.current = setTimeout(() => setShowTooltip(false), 4000);
        if (rowRef.current) {
          const bz = rowRef.current.querySelector('.msg-bubble-zone');
          const wrap = rowRef.current.closest('.chat-messages-wrap');
          if (bz && wrap) {
            const br = bz.getBoundingClientRect();
            const wr = wrap.getBoundingClientRect();
            const tipW = 180;
            const fitsRight = br.right + 8 + tipW <= wr.right;
            const cy = Math.max(wr.top + 14, Math.min(br.top + br.height / 2, wr.bottom - 14));
            if (fitsRight) {
              setTipPos({ top: cy, left: br.right + 8, right: undefined });
            } else {
              setTipPos({ top: cy, left: undefined, right: window.innerWidth - br.left + 8 });
            }
          }
        }
      }}
      onMouseLeave={() => { if (!showMenu) { clearTimeout(tipTimer.current); setShowTooltip(false); } }}
    >
      {bubbleBody}
    </div>
  );

  const moreButtonEl = !msg._local && !isUnsent && (hoverRow || showMenu) ? (
    <button
      ref={moreRef}
      className="msg-more-btn"
      onClick={handleMoreClick}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
      </svg>
    </button>
  ) : null;

  const bubbleInlineEl = (
    <div className={`msg-inline-actions ${isOwn ? 'msg-inline-actions--own' : 'msg-inline-actions--other'}`}>
      {isOwn && moreButtonEl}
      {bubbleZoneEl}
      {!isOwn && moreButtonEl}
    </div>
  );

  return (
    <>
      {showTime && (
        <div className="msg-time-divider">
          <span>{formatChatDivider(msg.created_at)}</span>
        </div>
      )}
      <div
        ref={rowRef}
        className={`msg-row ${isOwn ? 'msg-row--own' : 'msg-row--other'} ${isLast ? 'msg-row--last' : ''}`}
        onMouseEnter={() => setHoverRow(true)}
        onMouseLeave={() => { if (!showMenu) setHoverRow(false); }}
      >
        {!isOwn && showAvatar && (
          <div className="msg-avatar">
            {msg.sender_avatar ? (
              <img src={`${API_ORIGIN}${msg.sender_avatar}`} alt="" />
            ) : (
              <img src={DEFAULT_AVATAR} alt="" />
            )}
          </div>
        )}
        {!isOwn && !showAvatar && <div className="msg-avatar-spacer" />}

        {isOwn ? (
          <div className="msg-own-stack">
            {bubbleInlineEl}
            {(seenAvatar != null || seenName != null) && (
              <div className="msg-seen-indicator msg-seen--own">
                <img
                  src={resolveSeenAvatarSrc(seenAvatar)}
                  width={14}
                  height={14}
                  alt=""
                  aria-label={seenAlt}
                  title={seenAt ? `${seenName || ''} đã xem lúc ${formatFullTime(seenAt)}` : `${seenName || ''} đã xem`}
                  draggable={false}
                />
              </div>
            )}
            {showSentTime && (
              <div className="msg-sent-time">{formatSentTime(message.created_at)}</div>
            )}
          </div>
        ) : (
          bubbleInlineEl
        )}

        {showTooltip && !showMenu && tipPos && (
          <span className="msg-tooltip" style={{
            position: 'fixed',
            top: tipPos.top,
            left: tipPos.left,
            right: tipPos.right,
            transform: 'translateY(-50%)',
          }}>
            {formatFullTime(msg.created_at)}
          </span>
        )}

        {showMenu && (
          <div className="msg-context-menu" ref={menuRef} style={{ position: 'fixed', left: menuPos.x, top: menuPos.y }}>
            {isOwn && (
              <button className="msg-context-item msg-context-item--danger" onClick={() => { setShowMenu(false); onUnsend?.(msg); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1l22 22M9 9v10M15 9v10M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                Thu hồi
              </button>
            )}
            <button className="msg-context-item" onClick={() => { setShowMenu(false); onHide?.(msg); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              Xóa ở phía bạn
            </button>
          </div>
        )}
      </div>
    </>
  );
}
