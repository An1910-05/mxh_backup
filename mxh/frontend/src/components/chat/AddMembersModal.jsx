import { useState, useEffect, useMemo } from 'react';
import { getMyFriends } from '../../services/graphql';
import { addGroupMembers } from '../../services/chat';
import { API_ORIGIN } from '../../config';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function AddMembersModal({ conversationId, existingMemberIds = [], onClose, onAdded }) {
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getMyFriends();
        if (!cancelled) {
          const existing = new Set(existingMemberIds.map(Number));
          setFriends((list || []).filter(f => !existing.has(Number(f.id))));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Không tải được danh sách bạn bè');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [existingMemberIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(f =>
      String(f.username || '').toLowerCase().includes(q) ||
      String(f.custom_url || '').toLowerCase().includes(q)
    );
  }, [search, friends]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setError('');
    if (selected.size === 0) {
      setError('Chọn ít nhất 1 người để thêm');
      return;
    }
    setSubmitting(true);
    try {
      await addGroupMembers(conversationId, Array.from(selected));
      onAdded?.();
    } catch (e) {
      setError(e.message || 'Thêm thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose?.(); }}>
      <div className="modal create-group-modal" role="dialog" aria-label="Thêm thành viên">
        <div className="modal-header">
          <h3>Thêm thành viên</h3>
          <button type="button" className="modal-close" onClick={() => !submitting && onClose?.()} aria-label="Đóng">×</button>
        </div>

        <div className="modal-body">
          <input
            type="search"
            className="cg-search"
            placeholder="Tìm bạn bè..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={submitting}
          />

          <div className="cg-friend-list">
            {loading && <div className="cg-empty">Đang tải...</div>}
            {!loading && filtered.length === 0 && (
              <div className="cg-empty">
                {search ? `Không tìm thấy "${search}"` : 'Bạn bè của bạn đã ở trong nhóm rồi'}
              </div>
            )}
            {!loading && filtered.map(f => {
              const checked = selected.has(f.id);
              return (
                <label key={f.id} className={`cg-friend-row ${checked ? 'cg-friend-row--checked' : ''}`}>
                  <img
                    className="cg-friend-avatar"
                    src={f.avatar ? `${API_ORIGIN}${f.avatar}` : DEFAULT_AVATAR}
                    alt=""
                  />
                  <span className="cg-friend-name">{f.username}</span>
                  {f.custom_url && <span className="cg-friend-url">@{f.custom_url}</span>}
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(f.id)}
                    disabled={submitting}
                  />
                </label>
              );
            })}
          </div>

          {error && <div className="cg-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="cg-btn cg-btn--ghost" onClick={() => onClose?.()} disabled={submitting}>
            Hủy
          </button>
          <button
            type="button"
            className="cg-btn cg-btn--primary"
            onClick={handleSubmit}
            disabled={submitting || selected.size === 0}
          >
            {submitting ? 'Đang thêm...' : `Thêm ${selected.size > 0 ? `(${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
