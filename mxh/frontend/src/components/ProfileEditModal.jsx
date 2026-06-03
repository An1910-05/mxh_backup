import { useState } from 'react';
import { createPortal } from 'react-dom';
import { updateProfile, updateCustomUrl } from '../services/graphql';

const URL_RE = /^[a-zA-Z0-9._]{3,30}$/;

/**
 * Modal "Chỉnh sửa hồ sơ" (kiểu X): sửa tên hiển thị + tiểu sử + link trang cá
 * nhân (handle) trong một popup, một nút Lưu. Email không sửa ở đây (là định
 * danh đăng nhập).
 */
export default function ProfileEditModal({ profile, onClose, onSaved }) {
  const [name, setName] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [customUrl, setCustomUrl] = useState(profile.custom_url || '');
  const [nameError, setNameError] = useState('');
  const [urlError, setUrlError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const trimmedName = name.trim();
  const nameChanged = trimmedName !== (profile.username || '');
  const bioChanged = bio !== (profile.bio || '');
  const urlChanged = customUrl !== (profile.custom_url || '');
  const dirty = nameChanged || bioChanged || urlChanged;

  const handleSave = async () => {
    setNameError('');
    setUrlError('');
    setFormError('');

    if (!trimmedName) { setNameError('Tên không được để trống'); return; }
    if (trimmedName.length > 50) { setNameError('Tên tối đa 50 ký tự'); return; }
    if (urlChanged && customUrl && !URL_RE.test(customUrl)) {
      setUrlError('Link 3-30 ký tự, chỉ chữ, số, dấu chấm và gạch dưới');
      return;
    }

    setSaving(true);
    try {
      let result = { ...profile };
      if (nameChanged || bioChanged) {
        const updated = await updateProfile(bio, trimmedName);
        result = { ...result, ...updated };
      }
      if (urlChanged && customUrl) {
        const newUrl = await updateCustomUrl(customUrl);
        result = { ...result, custom_url: newUrl };
      }
      onSaved?.(result);
      onClose?.();
    } catch (err) {
      console.error('[ProfileEdit] save error:', err);
      setFormError(err.message || 'Lưu hồ sơ thất bại');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
    >
      <div className="modal profile-edit-modal" role="dialog" aria-label="Chỉnh sửa hồ sơ">
        <div className="modal-header">
          <h3>Chỉnh sửa hồ sơ</h3>
          <button type="button" className="modal-close" onClick={() => !saving && onClose?.()} aria-label="Đóng">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="modal-body">
          <div className="pe-field">
            <label className="pe-label" htmlFor="pe-name">Tên</label>
            <input
              id="pe-name"
              type="text"
              className="pe-input"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              placeholder="Tên hiển thị"
              maxLength={50}
              disabled={saving}
            />
            {nameError && <div className="pe-error">{nameError}</div>}
          </div>

          <div className="pe-field">
            <label className="pe-label" htmlFor="pe-bio">Tiểu sử</label>
            <textarea
              id="pe-bio"
              className="pe-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 300))}
              placeholder="Giới thiệu về bạn..."
              rows={3}
              maxLength={300}
              disabled={saving}
            />
            <span className="pe-count">{bio.length}/300</span>
          </div>

          <div className="pe-field">
            <label className="pe-label" htmlFor="pe-url">Link trang cá nhân</label>
            <div className="pe-url-row">
              <span className="pe-url-prefix">{origin}/</span>
              <input
                id="pe-url"
                type="text"
                className="pe-input"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="ten.trang"
                disabled={saving}
              />
            </div>
            {urlError && <div className="pe-error">{urlError}</div>}
          </div>

          {formError && <div className="pe-error pe-form-error">{formError}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="cg-btn cg-btn--ghost" onClick={() => !saving && onClose?.()} disabled={saving}>
            Hủy
          </button>
          <button
            type="button"
            className="cg-btn cg-btn--primary"
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
