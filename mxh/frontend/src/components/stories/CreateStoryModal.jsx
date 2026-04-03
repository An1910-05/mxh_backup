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

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setError('Chỉ hỗ trợ ảnh hoặc video');
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
          <button className="story-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" /></svg>
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
              <button className="story-modal-pick-btn story-modal-pick-photo" onClick={() => { fileRef.current.accept = 'image/jpeg,image/png,image/gif,image/webp'; fileRef.current.click(); }}>
                <div className="story-modal-pick-icon">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#fff" strokeWidth="2" fill="none" /><circle cx="8.5" cy="8.5" r="1.5" fill="#fff" /><path d="M21 15l-5-5L5 21" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
                </div>
                <span>Tạo tin bằng ảnh</span>
              </button>
              <button className="story-modal-pick-btn story-modal-pick-video" onClick={() => { fileRef.current.accept = 'video/mp4,video/webm,video/quicktime'; fileRef.current.click(); }}>
                <div className="story-modal-pick-icon">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M8 5v14l11-7L8 5z" /></svg>
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

          {error && <div className="story-modal-error">{error}</div>}
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
