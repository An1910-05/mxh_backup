import { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { uploadFile } from '../../services/api';
import { createStory } from '../../services/graphql';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function CreateStoryModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
    const isImage = ALLOWED_IMAGE.includes(file.type);
    const isVideo = ALLOWED_VIDEO.includes(file.type);

    if (!isImage && !isVideo) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      setError(
        `Định dạng .${ext} không được hỗ trợ. ` +
        `Vui lòng dùng ảnh (jpg/png/gif/webp) hoặc video (mp4/webm/mov).`
      );
      return;
    }
    if (isImage && file.size > 10 * 1024 * 1024) { setError('Ảnh tối đa 10 MB'); return; }
    if (isVideo && file.size > 1024 * 1024 * 1024) { setError('Video tối đa 1 GB'); return; }

    setError('');
    setMediaFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!mediaFile) return;
    setUploading(true);
    setError('');
    try {
      const uploadResult = await uploadFile('/upload/media', 'media', mediaFile);
      const story = await createStory(
        uploadResult.data.media_url,
        uploadResult.data.media_type,
        uploadResult.data.media_width || null,
        uploadResult.data.media_height || null
      );
      if (onCreated) onCreated(story);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect({ target: { files: [file] } });
  };

  return (
    <div className="csm-overlay" onClick={onClose}>
      <div className="csm" onClick={(e) => e.stopPropagation()}>

        {/* ─── Left: controls ─── */}
        <div className="csm-side">
          <div className="csm-side-head">
            <img
              src={user?.avatar_url || DEFAULT_AVATAR}
              className="csm-side-avatar"
              alt=""
            />
            <div>
              <span className="csm-side-name">{user?.full_name || user?.username}</span>
              <span className="csm-side-hint">Đang tạo tin</span>
            </div>
          </div>

          <span className="csm-section-label">Loại nội dung</span>

          <div className="csm-chips">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="csm-chip csm-chip-photo"
              onClick={() => { fileRef.current.accept = 'image/jpeg,image/png,image/gif,image/webp'; fileRef.current.click(); }}
            >
              <span className="csm-chip-icon">
                <i className="bi bi-image-fill" aria-hidden="true" />
              </span>
              <span className="csm-chip-body">
                <span className="csm-chip-title">Ảnh</span>
                <span className="csm-chip-sub">JPG · PNG · GIF · WebP</span>
              </span>
              <i className="bi bi-chevron-right csm-chip-arrow" aria-hidden="true" />
            </button>

            <button
              type="button"
              className="csm-chip csm-chip-video"
              onClick={() => { fileRef.current.accept = 'video/mp4,video/webm,video/quicktime'; fileRef.current.click(); }}
            >
              <span className="csm-chip-icon">
                <i className="bi bi-camera-video-fill" aria-hidden="true" />
              </span>
              <span className="csm-chip-body">
                <span className="csm-chip-title">Video</span>
                <span className="csm-chip-sub">MP4 · WebM · MOV</span>
              </span>
              <i className="bi bi-chevron-right csm-chip-arrow" aria-hidden="true" />
            </button>
          </div>

          {error && (
            <div className="csm-error" role="alert">
              <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="csm-side-spacer" />

          {mediaPreview && (
            <div className="csm-side-foot">
              <button type="button" className="csm-btn-ghost" onClick={handleReset}>
                <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
                Chọn lại
              </button>
              <button
                type="button"
                className="csm-btn-primary"
                onClick={handleSubmit}
                disabled={uploading}
              >
                {uploading ? (
                  <><span className="csm-spin"><i className="bi bi-arrow-repeat" aria-hidden="true" /></span> Đang tải…</>
                ) : (
                  <><i className="bi bi-send-fill" aria-hidden="true" /> Chia sẻ</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ─── Right: story canvas ─── */}
        <div className="csm-canvas">
          <button
            type="button"
            className="csm-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>

          {!mediaPreview ? (
            <div
              className="csm-drop"
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
            >
              <div className="csm-drop-icon">
                <i className="bi bi-cloud-arrow-up-fill" aria-hidden="true" />
              </div>
              <p className="csm-drop-title">Kéo thả hoặc bấm để chọn</p>
              <p className="csm-drop-sub">Ảnh tối đa 10 MB · Video tối đa 1 GB</p>
            </div>
          ) : (
            <div className="csm-preview">
              {mediaType === 'image' ? (
                <img src={mediaPreview} alt="Preview" />
              ) : (
                <video src={mediaPreview} controls />
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
