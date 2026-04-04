import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getNotifications, markAllNotificationsRead, markNotificationRead, deleteNotification, deleteAllNotifications } from '../services/graphql';
import { useAuth } from '../hooks/useAuth';

function bumpNotifBadge() { window.dispatchEvent(new Event('mxh-notif-refresh')); }

function formatTime(ts) {
  if (!ts) return '';
  // MySQL trả về "YYYY-MM-DD HH:mm:ss" không có timezone → ép thành UTC
  const utcStr = ts.includes('T') || ts.endsWith('Z') ? ts : ts.replace(' ', 'T') + 'Z';
  const d = new Date(utcStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'vài giây trước';
  if (diff < 3600) return `${Math.floor(diff/60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff/3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff/86400)} ngày trước`;
  return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

const TYPE_LABEL = {
  like: 'đã thích bài viết của bạn',
  comment: 'đã bình luận vào bài viết của bạn',
  mention_post: 'đã tag bạn trong một bài viết',
  mention_comment: 'đã tag bạn trong bình luận',
  friend_request: 'đã gửi lời mời kết bạn',
  friend_accept: 'đã chấp nhận lời mời kết bạn',
};

// SF Symbols — filled variants, 24×24 viewBox
const SF_PATHS = {
  'heart.fill':
    'M12 20.8c-.28 0-.55-.1-.76-.28C5.6 15.52 2 11.86 2 8c0-2.9 2.35-5.25 5.25-5.25 1.64 0 3.17.78 4.17 2.03a.75.75 0 0 0 1.16 0A5.22 5.22 0 0 1 16.75 2.75C19.65 2.75 22 5.1 22 8c0 3.86-3.6 7.52-9.24 12.52-.21.18-.48.28-.76.28Z',
  'bubble.left.fill':
    'M4.5 2.75A2.75 2.75 0 0 0 1.75 5.5v9A2.75 2.75 0 0 0 4.5 17.25H7v4.5l6-4.5h6.5a2.75 2.75 0 0 0 2.75-2.75v-9A2.75 2.75 0 0 0 19.5 2.75h-15Z',
  'at':
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5.5v-1.5H12c-4.69 0-8.5-3.81-8.5-8.5S7.31 3.5 12 3.5s8.5 3.81 8.5 8.5v1.43c0 .83-.67 1.57-1.5 1.57s-1.5-.74-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.63-.56 3.54-1.46.65.9 1.77 1.46 2.96 1.46 1.66 0 3-1.4 3-3.07V12C22 6.48 17.52 2 12 2Zm0 13.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 8.5 12 8.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5Z',
  'person.badge.plus':
    'M10.5 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 7.5c0-2.9 3.13-5.25 7-5.25.9 0 1.76.13 2.55.36A5.74 5.74 0 0 0 12.75 17c0 1.05.28 2.04.78 2.88L3.5 19.87V19.5ZM17.75 13a.75.75 0 0 1 .75.75v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5H14.5a.75.75 0 0 1 0-1.5H17v-2.5a.75.75 0 0 1 .75-.75Z',
  'person.fill.checkmark':
    'M10.5 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 7.5c0-2.9 3.13-5.25 7-5.25.69 0 1.36.08 2 .22l-.55.56a2.65 2.65 0 0 0 0 3.75l2.3 2.3.06.06H3.5v-.64ZM20.78 14.2a.75.75 0 0 0-1.06 0l-4.22 4.22-1.72-1.72a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.75-4.75a.75.75 0 0 0 0-1.06Z',
  'bell.fill':
    'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2Z',
};

const TYPE_BADGE = {
  like:            { symbol: 'heart.fill',            bg: '#ff3b30' },
  comment:         { symbol: 'bubble.left.fill',       bg: '#007aff' },
  mention_post:    { symbol: 'at',                    bg: '#ff9500' },
  mention_comment: { symbol: 'at',                    bg: '#ff9500' },
  friend_request:  { symbol: 'person.badge.plus',     bg: '#34c759' },
  friend_accept:   { symbol: 'person.fill.checkmark', bg: '#30d158' },
};

function SFBadge({ type }) {
  const cfg = TYPE_BADGE[type] || { symbol: 'bell.fill', bg: '#8e8e93' };
  return (
    <span className="notif-lg-type-icon" style={{ background: cfg.bg }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="white" aria-hidden="true">
        <path d={SF_PATHS[cfg.symbol]} />
      </svg>
    </span>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getNotifications(40, 1).then(data => {
      setItems(Array.isArray(data) ? data : []);
    }).catch(err => { console.error('[notifications] fetch failed:', err); setItems([]); }).finally(() => setLoading(false));
  }, [user]);

  const handleItemClick = async (item) => {
    if (!item.read_at) {
      try { await markNotificationRead(item.id); } catch (err) { console.error(err); }
      setItems(prev => prev.map(n => n.id === item.id ? {...n, read_at: new Date().toISOString()} : n));
      bumpNotifBadge();
    }
    if (item.post_id) {
      navigate(`/post/${item.post_id}`);
      return;
    }
    if (item.type === 'friend_request' || item.type === 'friend_accept') {
      navigate('/friends');
    }
  };

  const handleMarkAll = async () => {
    setMarking(true);
    try {
      await markAllNotificationsRead();
      setItems(prev => prev.map(n => ({...n, read_at: n.read_at || new Date().toISOString()})));
      bumpNotifBadge();
    } catch (err) { console.error(err); } finally { setMarking(false); }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setItems(prev => prev.filter(n => n.id !== id));
      bumpNotifBadge();
    } catch (err) { console.error(err); }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Xóa tất cả thông báo?')) return;
    try {
      await deleteAllNotifications();
      setItems([]);
      bumpNotifBadge();
    } catch (err) { console.error(err); }
  };

  const unreadCount = items.filter(n => !n.read_at).length;

  return (
    <div className="apple-main notifications-page">
      <div className="notifications-page-header">
        <div className="notifications-page-title-wrap">
          <h1 className="notifications-lg-title">Thông báo</h1>
          {unreadCount > 0 && (
            <span className="notifications-unread-badge">{unreadCount}</span>
          )}
        </div>
        <div className="notifications-header-actions">
          {unreadCount > 0 && (
            <button type="button" className="notifications-mark-all" onClick={handleMarkAll} disabled={marking}>
              {marking ? '…' : 'Đánh dấu đã đọc'}
            </button>
          )}
          {items.length > 0 && (
            <button type="button" className="notifications-delete-all" onClick={handleDeleteAll}>
              Xóa tất cả
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="notif-lg-loading">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="notif-skeleton" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="notif-lg-empty">
          <div className="notif-lg-empty-icon">🔔</div>
          <div className="notif-lg-empty-title">Chưa có thông báo</div>
          <div className="notif-lg-empty-sub">Khi có người thích hoặc bình luận bài viết của bạn, bạn sẽ thấy ở đây</div>
        </div>
      )}

      <div className="notif-lg-list">
        {!loading && items.map((item, idx) => (
          <div
            key={item.id}
            className={`notif-lg-item${!item.read_at ? ' notif-lg-item--unread' : ''}`}
            onClick={() => handleItemClick(item)}
            role="button"
            style={{ animationDelay: `${idx * 0.045}s` }}
          >
            <Link
              to={item.actor_username ? `/${item.actor_username}` : '/'}
              className="notif-lg-avatar-wrap"
              onClick={e => e.stopPropagation()}
            >
              <img
                className="notif-lg-avatar"
                src={item.actor_avatar
                  ? `${import.meta.env.VITE_API_URL || ''}${item.actor_avatar}`
                  : '/default-avatar.png'}
                alt={item.actor_username}
              />
              <SFBadge type={item.type} />
            </Link>

            <div className="notif-lg-body">
              <div className="notif-lg-text">
                <Link
                  to={item.actor_username ? `/${item.actor_username}` : '/'}
                  onClick={e => e.stopPropagation()}
                  className="notif-lg-actor"
                >
                  {item.actor_username || 'Người dùng'}
                </Link>
                {' '}
                <span className="notif-lg-action">{TYPE_LABEL[item.type] || item.type}</span>
              </div>
              <div className="notif-lg-time">{formatTime(item.created_at)}</div>
            </div>

            {!item.read_at && <span className="notif-lg-dot" />}
            <button
              type="button"
              className="notif-lg-delete"
              onClick={e => handleDelete(e, item.id)}
              title="Xóa thông báo"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
