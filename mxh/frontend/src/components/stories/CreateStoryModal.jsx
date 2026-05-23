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
        `Server chỉ chấp nhận: ảnh (jpg/png/gif/webp) hoặc video (mp4/webm/mov). ` +
        `Vui lòng chuyển đổi (ví dụ dùng HandBrake/FFmpeg sang mp4).`
      );
      return;
    }
    if (isImage && file.size > 10 * 1024 * 1024) {
      setError('Ảnh tối đa 10MB');
      return;
    }
    if (isVideo && file.size > 1024 * 1024 * 1024) {
      setError('Video tối đa 1GB');
      return;
    }

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

  return (
    <div className="story-modal-overlay" onClick={onClose}>
      <div className="story-modal" onClick={(e) => e.stopPropagation()}>
        <div className="story-modal-header">
          <h3>Tạo tin</h3>
          <button type="button" className="story-modal-close" onClick={onClose} aria-label="Đóng">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="story-modal-body">
          {!mediaPreview ? (
            <div className="story-modal-pick">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button type="button" className="story-modal-pick-btn story-modal-pick-photo" onClick={() => { fileRef.current.accept = 'image/jpeg,image/png,image/gif,image/webp'; fileRef.current.click(); }}>
                <div className="story-modal-pick-icon">
                  <i className="bi bi-image-fill" aria-hidden="true" />
                </div>
                <span>Tạo tin bằng ảnh</span>
              </button>
              <button type="button" className="story-modal-pick-btn story-modal-pick-video" onClick={() => { fileRef.current.accept = 'video/mp4,video/webm,video/quicktime'; fileRef.current.click(); }}>
                <div className="story-modal-pick-icon">
                  <i className="bi bi-camera-video-fill" aria-hidden="true" />
                </div>
                <span>Tạo tin bằng video</span>
              </button>
            </div>
          ) : (
            <div className="story-modal-preview">
              {mediaType === 'image' ? (
                <img src={mediaPreview} alt="Preview" />
              ) : (
                <video src={mediaPreview} controls />
              )}
            </div>
          )}

          {error && (
            <div className="story-modal-error">
              <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
              {error}
            </div>
          )}
        </div>

        {mediaPreview && (
          <div className="story-modal-footer">
            <button className="story-modal-btn-cancel" onClick={() => { setMediaFile(null); setMediaPreview(null); setMediaType(null); }}>
              Hủy
            </button>
            <button className="story-modal-btn-submit" onClick={handleSubmit} disabled={uploading}>
              {uploading ? 'Đang tải...' : 'Chia sẻ lên tin'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
