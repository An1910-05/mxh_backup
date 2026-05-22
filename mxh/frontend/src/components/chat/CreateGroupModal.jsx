import { useState, useEffect, useMemo } from 'react';
import { getMyFriends } from '../../services/graphql';
import { createGroup } from '../../services/chat';
import { uploadFile } from '../../services/api';
import { API_ORIGIN } from '../../config';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function CreateGroupModal({ onClose, onCreated }) {
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

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

  const selectedList = useMemo(() => friends.filter(f => selected.has(f.id)), [friends, selected]);

  const autoTitle = useMemo(() => {
    if (title.trim()) return title;
    const names = selectedList.map(f => f.username);
    if (names.length === 0) return '';
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 3).join(', ')} và ${names.length - 3} người khác`;
  }, [title, selectedList]);

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh');
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleSubmit = async () => {
    setError('');
    const finalTitle = (title.trim() || autoTitle || '').trim();
    if (!finalTitle) {
      setError('Vui lòng đặt tên cho nhóm');
      return;
    }
    if (selected.size < 2) {
      setError('Vui lòng chọn ít nhất 2 thành viên');
      return;
    }
    setSubmitting(true);
    try {
      let avatarUrl = null;
      if (avatarFile) {
        const res = await uploadFile('/upload/media', 'media', avatarFile);
        const data = res.data || res;
        avatarUrl = data.media_url || data.url || null;
      }
      const conv = await createGroup(finalTitle, avatarUrl, Array.from(selected));
      onCreated?.(conv);
    } catch (e) {
      setError(e.message || 'Tạo nhóm thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose?.(); }}>
      <div className="modal create-group-modal" role="dialog" aria-label="Tạo nhóm chat">

        <div className="modal-header">
          <h3>Tạo nhóm chat</h3>
          <button type="button" className="modal-close" onClick={() => !submitting && onClose?.()} aria-label="Đóng">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="modal-body">
          <div className="cg-row">
            <label className="cg-avatar-picker">
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarSelect} disabled={submitting} />
              <div className="cg-avatar">
                {avatarPreview
                  ? <img src={avatarPreview} alt="" />
                  : <i className="bi bi-people-fill cg-avatar-placeholder"></i>
                }
                <div className="cg-avatar-camera">
                  <i className="bi bi-camera-fill"></i>
                </div>
              </div>
              <span className="cg-avatar-edit">Đổi ảnh</span>
            </label>

            <div className="cg-title-wrap">
              <label className="cg-title-label" htmlFor="cg-group-name">Tên nhóm</label>
              <input
                id="cg-group-name"
                type="text"
                className="cg-title-input"
                placeholder={autoTitle || 'Nhập tên nhóm...'}
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                disabled={submitting}
                maxLength={100}
              />
              <span className="cg-title-count">{title.length}/100</span>
            </div>
          </div>

          <div className="cg-section">
            <div className="cg-section-title">
              Thành viên
              {selected.size > 0 && <span className="cg-section-badge">{selected.size}</span>}
            </div>

            <div className="cg-search-wrap">
              <i className="bi bi-search cg-search-icon"></i>
              <input
                type="search"
                className="cg-search"
                placeholder="Tìm bạn bè..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={submitting}
              />
            </div>

            {selectedList.length > 0 && (
              <div className="cg-chips">
                {selectedList.map(f => (
                  <span key={f.id} className="cg-chip">
                    <img src={f.avatar ? `${API_ORIGIN}${f.avatar}` : DEFAULT_AVATAR} alt="" />
                    <span className="cg-chip-name">{f.username}</span>
                    <button type="button" onClick={() => toggleSelect(f.id)} aria-label="Bỏ chọn">
                      <i className="bi bi-x"></i>
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="cg-friend-list">
              {loading && <div className="cg-empty">Đang tải...</div>}
              {!loading && filtered.length === 0 && (
                <div className="cg-empty">
                  {search ? `Không tìm thấy "${search}"` : 'Chưa có bạn bè để mời vào nhóm'}
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
                    <div className="cg-friend-info">
                      <span className="cg-friend-name">{f.username}</span>
                      {f.custom_url && <span className="cg-friend-url">@{f.custom_url}</span>}
                    </div>
                    <div className={`cg-check ${checked ? 'cg-check--on' : ''}`}>
                      {checked && <i className="bi bi-check2"></i>}
                    </div>
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
          </div>

          {error && (
            <div className="cg-error">
              <i className="bi bi-exclamation-circle-fill"></i>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="cg-btn cg-btn--ghost" onClick={() => onClose?.()} disabled={submitting}>
            Hủy
          </button>
          <button
            type="button"
            className="cg-btn cg-btn--primary"
            onClick={handleSubmit}
            disabled={submitting || selected.size < 2}
          >
            {submitting ? 'Đang tạo...' : 'Tạo nhóm'}
          </button>
        </div>

      </div>
    </div>
  );
}
