import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getMyFriends,
  getPendingFriendRequests,
  getSentFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
} from '../services/graphql';
import { timeAgo } from '../utils/time';
import { formatHandleDisplay } from '../utils/userDisplay';
import BlobButton from '../components/BlobButton';
import { API_ORIGIN } from '../config';
const DEFAULT_AVATAR = '/default-avatar.png';

function bumpFriendRequestsBadge() {
  window.dispatchEvent(new Event('mxh-friend-requests-refresh'));
}

function UserCard({ user, link, actions, subtitle }) {
  return (
    <div className="friend-card fade-in">
      <Link to={link} className="friend-card-img">
        {user.avatar ? (
          <img src={`${API_ORIGIN}${user.avatar}`} alt={user.username} />
        ) : (
          <img src={DEFAULT_AVATAR} alt="" />
        )}
      </Link>
      <div className="friend-card-body">
        <Link to={link} className="friend-card-name">{user.username}</Link>
        {subtitle && <span className="friend-card-sub">{subtitle}</span>}
        <div className="friend-card-actions">{actions}</div>
      </div>
    </div>
  );
}

export default function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [sent, setSent] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [f, p, s] = await Promise.all([
        getMyFriends(),
        getPendingFriendRequests(),
        getSentFriendRequests(),
      ]);
      setFriends(f);
      setPending(p);
      setSent(s);
      bumpFriendRequestsBadge();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAccept = async (friendshipId) => {
    try {
      await acceptFriendRequest(friendshipId);
      await fetchAll();
    } catch (err) { console.error(err); }
  };

  const handleReject = async (friendshipId) => {
    try {
      await rejectFriendRequest(friendshipId);
      await fetchAll();
    } catch (err) { console.error(err); }
  };

  const handleCancel = async (friendshipId) => {
    try {
      await cancelFriendRequest(friendshipId);
      await fetchAll();
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="apple-main">
        <div className="apple-loading"><span className="apple-spinner" /> Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="apple-main fade-in">
      <div className="friends-header">
        <h2>Bạn bè</h2>
        <div className="friends-tabs">
          <button onClick={() => setTab('pending')} className={`friends-tab ${tab === 'pending' ? 'friends-tab--active' : ''}`}>
            Lời mời kết bạn {pending.length > 0 && <span className="friends-tab-badge">{pending.length}</span>}
          </button>
          <button onClick={() => setTab('sent')} className={`friends-tab ${tab === 'sent' ? 'friends-tab--active' : ''}`}>
            Đã gửi {sent.length > 0 && <span className="friends-tab-badge">{sent.length}</span>}
          </button>
          <button onClick={() => setTab('friends')} className={`friends-tab ${tab === 'friends' ? 'friends-tab--active' : ''}`}>
            Tất cả bạn bè {friends.length > 0 && <span className="friends-tab-count">{friends.length}</span>}
          </button>
        </div>
      </div>

      {tab === 'pending' && (
        <>
          <div className="friends-section-title">
            {pending.length > 0 ? `${pending.length} lời mời kết bạn` : 'Không có lời mời nào'}
          </div>
          <div className="friend-card-grid">
            {pending.map((r) => (
              <UserCard
                key={r.friendship_id}
                user={r}
                link={`/profile_id=${r.id}`}
                subtitle={timeAgo(r.request_date)}
                actions={
                  <>
                    <BlobButton onClick={() => handleAccept(r.friendship_id)} variant="confirm">Xác nhận</BlobButton>
                    <BlobButton onClick={() => handleReject(r.friendship_id)} variant="danger">Xóa</BlobButton>
                  </>
                }
              />
            ))}
          </div>
        </>
      )}

      {tab === 'sent' && (
        <>
          <div className="friends-section-title">
            {sent.length > 0 ? `${sent.length} lời mời đã gửi` : 'Chưa gửi lời mời nào'}
          </div>
          <div className="friend-card-grid">
            {sent.map((r) => (
              <UserCard
                key={r.friendship_id}
                user={r}
                link={`/profile_id=${r.id}`}
                subtitle={`Đã gửi ${timeAgo(r.request_date)}`}
                actions={
                  <BlobButton onClick={() => handleCancel(r.friendship_id)} variant="danger">Hủy lời mời</BlobButton>
                }
              />
            ))}
          </div>
        </>
      )}

      {tab === 'friends' && (
        <>
          <div className="friends-section-title">
            {friends.length > 0 ? `${friends.length} bạn bè` : 'Chưa có bạn bè'}
          </div>
          {friends.length === 0 ? (
            <div className="apple-empty">
              <div className="apple-empty-icon">👥</div>
              <div className="apple-empty-text">Chưa có bạn bè</div>
              <div className="apple-empty-sub"><Link to="/search">Tìm bạn bè</Link></div>
            </div>
          ) : (
            <div className="friend-card-grid">
              {friends.map((f) => {
                const link = f.custom_url ? `/${f.custom_url}` : `/profile_id=${f.id}`;
                return (
                  <UserCard
                    key={f.id}
                    user={f}
                    link={link}
                    subtitle={f.custom_url ? formatHandleDisplay(f.custom_url) : undefined}
                    actions={
                      <BlobButton href={link} variant="primary">Xem trang cá nhân</BlobButton>
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
