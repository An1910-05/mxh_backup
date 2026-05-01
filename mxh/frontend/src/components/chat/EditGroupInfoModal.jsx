import { useState, useEffect } from 'react';
import { updateGroupInfo } from '../../services/chat';
import { uploadFile } from '../../services/api';
import { API_ORIGIN } from '../../config';

export default function EditGroupInfoModal({ conversation, onClose, onSaved }) {
  const [title, setTitle] = useState(conversation?.title || conversation?.display_name || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const currentAvatarSrc = avatarPreview
    ? avatarPreview
    : conversation?.avatar
      ? `${API_ORIGIN}${conversation.avatar}`
      : null;

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
    const newTitle = title.trim();
    if (!newTitle) {
      setError('Tên nhóm không được để trống');
      return;
    }
    setSubmitting(true);
    try {
      let avatarUrl;
      if (avatarFile) {
        const res = await uploadFile('/upload/media', 'media', avatarFile);
        const data = res.data || res;
        avatarUrl = data.media_url || data.url || null;
      }
      const payload = { title: newTitle };
      if (avatarUrl !== undefined) payload.avatarUrl = avatarUrl;
      const updated = await updateGroupInfo(conversation.id, payload);
      onSaved?.(updated);
    } catch (e) {
      setError(e.message || 'Cập nhật thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose?.(); }}>
      <div className="modal create-group-modal create-group-modal--small" role="dialog" aria-label="Sửa thông tin nhóm">
        <div className="modal-header">
          <h3>Sửa thông tin nhóm</h3>
          <button type="button" className="modal-close" onClick={() => !submitting && onClose?.()} aria-label="Đóng">×</button>
        </div>

        <div className="modal-body">
          <div className="cg-row">
            <label className="cg-avatar-picker">
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarSelect} disabled={submitting} />
              <div className="cg-avatar">
                {currentAvatarSrc ? (
                  <img src={currentAvatarSrc} alt="" />
                ) : (
                  <span className="cg-avatar-placeholder">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M14 4l2.59 3H21v12H3V7h4.41L10 4h4m1.5-2h-7L5.91 5H2C.9 5 0 5.9 0 7v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-3.91L15.5 2zm-3.5 6a4 4 0 100 8 4 4 0 000-8z"/></svg>
                  </span>
                )}
              </div>
              <span className="cg-avatar-edit">Đổi ảnh</span>
            </label>
            <div className="cg-title-wrap">
              <input
                type="text"
                className="cg-title-input"
                placeholder="Tên nhóm"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                disabled={submitting}
                maxLength={100}
              />
              <span className="cg-title-count">{title.length}/100</span>
            </div>
          </div>

          {error && <div className="cg-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="cg-btn cg-btn--ghost" onClick={() => onClose?.()} disabled={submitting}>
            Hủy
          </button>
          <button type="button" className="cg-btn cg-btn--primary" onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}
