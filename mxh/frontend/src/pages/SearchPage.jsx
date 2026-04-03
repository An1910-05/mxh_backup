import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  searchUsers,
  getPendingFriendRequests,
  getSentFriendRequests,
  getMyFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
} from '../services/graphql';
import { formatHandleDisplay } from '../utils/userDisplay';
import { useAuth } from '../hooks/useAuth';
import { API_ORIGIN } from '../config';
const DEFAULT_AVATAR = '/default-avatar.png';

export default function SearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [pending, setPending] = useState([]);
  const [sent, setSent] = useState([]);
  const [friends, setFriends] = useState([]);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(null);
  const resultsRef = useRef(results);
  resultsRef.current = results;

  const refreshFriendships = useCallback(async () => {
    if (!user) {
      setPending([]);
      setSent([]);
      setFriends([]);
      return;
    }
    setRelationsLoading(true);
    try {
      const [p, s, f] = await Promise.all([
        getPendingFriendRequests(),
        getSentFriendRequests(),
        getMyFriends(),
      ]);
      setPending(p || []);
      setSent(s || []);
      setFriends(f || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRelationsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPending([]);
      setSent([]);
      setFriends([]);
      return;
    }
    if (resultsRef.current.length > 0) {
      refreshFriendships();
    }
  }, [user, refreshFriendships]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const data = await searchUsers(query.trim());
      setResults(data);
      setSearched(true);
      if (user && data.length > 0) {
        await refreshFriendships();
      }
    } catch (err) {
      console.error('Search error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (key, fn) => {
    setActionBusy(key);
    try {
      await fn();
      await refreshFriendships();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Thao tác thất bại');
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="apple-main fade-in">
      <div className="feed-header">
        <h2>Tìm bạn bè</h2>
        <p>Tìm theo tên, ID số, @tên hoặc link trang cá nhân</p>
      </div>

      <div className="create-post">
        <form onSubmit={handleSearch} className="comment-form">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập tên, @tên hoặc mã ID..."
          />
          <button type="submit" className="apple-btn apple-btn-primary apple-btn-sm" disabled={loading || !query.trim()}>
            {loading ? '...' : 'Tìm'}
          </button>
        </form>
      </div>

      {loading && (
        <div className="apple-loading"><span className="apple-spinner" /> Đang tìm...</div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="apple-empty">
          <div className="apple-empty-icon">🔍</div>
          <div className="apple-empty-text">Không tìm thấy</div>
          <div className="apple-empty-sub">Thử tìm bằng tên khác hoặc mã ID</div>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="search-results">
          {results.map((u) => {
            const link = u.custom_url ? `/${u.custom_url}` : `/profile_id=${u.id}`;
            const uid = Number(u.id);
            const selfId = user ? Number(user.id) : null;
            const isSelf = selfId !== null && uid === selfId;

            const incoming = user && pending.find((p) => Number(p.id) === uid);
            const outgoing = user && sent.find((s) => Number(s.id) === uid);
            const isFriend = user && friends.some((f) => Number(f.id) === uid);

            const showFriendActions = user && !isSelf;

            return (
              <div key={u.id} className="post-card fade-in search-result-card">
                <Link
                  to={link}
                  className="search-result-card-hit"
                  aria-label={`Xem trang ${u.username}`}
                />
                <div className="search-result-card-inner">
                  <div className="post-avatar search-result-avatar" aria-hidden>
                    <img src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR} alt="" />
                  </div>
                  <div className="search-result-main">
                    <div className="search-result-names">
                      <span className="search-result-display-name">{u.username}</span>
                      <span className="apple-badge search-result-badge">ID: {u.id}</span>
                      {u.custom_url && (
                        <span className="apple-badge search-result-badge">{formatHandleDisplay(u.custom_url)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="search-result-actions">
                  {showFriendActions && incoming && (
                    <>
                      <button
                        type="button"
                        className="apple-btn apple-btn-primary apple-btn-sm"
                        disabled={actionBusy === `acc-${incoming.friendship_id}` || relationsLoading}
                        onClick={() => runAction(`acc-${incoming.friendship_id}`, () => acceptFriendRequest(incoming.friendship_id))}
                      >
                        {actionBusy === `acc-${incoming.friendship_id}` ? '…' : 'Đồng ý kết bạn'}
                      </button>
                      <button
                        type="button"
                        className="apple-btn apple-btn-ghost apple-btn-sm"
                        disabled={actionBusy === `rej-${incoming.friendship_id}` || relationsLoading}
                        onClick={() => runAction(`rej-${incoming.friendship_id}`, () => rejectFriendRequest(incoming.friendship_id))}
                      >
                        {actionBusy === `rej-${incoming.friendship_id}` ? '…' : 'Từ chối'}
                      </button>
                    </>
                  )}
                  {showFriendActions && !incoming && outgoing && (
                    <button
                      type="button"
                      className="apple-btn apple-btn-outline apple-btn-sm"
                      disabled={actionBusy === `can-${outgoing.friendship_id}` || relationsLoading}
                      onClick={() => runAction(`can-${outgoing.friendship_id}`, () => cancelFriendRequest(outgoing.friendship_id))}
                    >
                      {actionBusy === `can-${outgoing.friendship_id}` ? '…' : 'Hủy lời mời'}
                    </button>
                  )}
                  {showFriendActions && !incoming && !outgoing && !isFriend && (
                    <button
                      type="button"
                      className="apple-btn apple-btn-dark apple-btn-sm"
                      disabled={actionBusy === `req-${uid}` || relationsLoading}
                      onClick={() => runAction(`req-${uid}`, () => sendFriendRequest(uid))}
                    >
                      {actionBusy === `req-${uid}` ? '…' : 'Gửi lời kết bạn'}
                    </button>
                  )}
                  {showFriendActions && isFriend && (
                    <span className="search-friend-badge">Bạn bè</span>
                  )}
                  {showFriendActions && (
                    <button
                      type="button"
                      className="apple-btn apple-btn-outline apple-btn-sm"
                      onClick={() => navigate(`/chat?user=${uid}`)}
                    >
                      Nhắn tin
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
