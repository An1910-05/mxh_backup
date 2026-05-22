import { useState, useEffect, useMemo } from 'react';
import { getMyFriends } from '../../services/graphql';
import { API_ORIGIN } from '../../config';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function NewDirectMessageModal({ onClose, onOpen }) {
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getMyFriends();
        if (!cancelled) setFriends(list || []);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Không tải được danh sách bạn bè');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(f =>
      String(f.username || '').toLowerCase().includes(q) ||
      String(f.custom_url || '').toLowerCase().includes(q)
    );
  }, [search, friends]);

  const handleOpen = async (userId) => {
    if (opening) return;
    setOpening(userId);
    try {
      await onOpen(userId);
    } catch {
      setOpening(null);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !opening) onClose?.(); }}
    >
      <div className="modal ndm-modal" role="dialog" aria-label="Nhắn tin mới">
        <div className="modal-header">
          <h3>Nhắn tin mới</h3>
          <button
            type="button"
            className="modal-close"
            onClick={() => !opening && onClose?.()}
            aria-label="Đóng"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="modal-body">
          <div className="cg-search-wrap">
            <i className="bi bi-search cg-search-icon"></i>
            <input
              type="search"
              className="cg-search"
              placeholder="Tìm bạn bè..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="cg-friend-list">
            {loading && <div className="cg-empty">Đang tải...</div>}
            {!loading && filtered.length === 0 && (
              <div className="cg-empty">
                {search ? `Không tìm thấy "${search}"` : 'Chưa có bạn bè nào'}
              </div>
            )}
            {!loading && filtered.map(f => (
              <button
                key={f.id}
                type="button"
                className={`cg-friend-row ndm-friend-row${opening === f.id ? ' cg-friend-row--opening' : ''}`}
                onClick={() => handleOpen(f.id)}
                disabled={!!opening}
              >
                <img
                  className="cg-friend-avatar"
                  src={f.avatar ? `${API_ORIGIN}${f.avatar}` : DEFAULT_AVATAR}
                  alt=""
                />
                <div className="cg-friend-info">
                  <span className="cg-friend-name">{f.username}</span>
                  {f.custom_url && <span className="cg-friend-url">@{f.custom_url}</span>}
                </div>
                {opening === f.id
                  ? <span className="ndm-row-spinner"></span>
                  : <i className="bi bi-chevron-right ndm-row-chevron"></i>
                }
              </button>
            ))}
          </div>

          {error && (
            <div className="cg-error">
              <i className="bi bi-exclamation-circle-fill"></i>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
