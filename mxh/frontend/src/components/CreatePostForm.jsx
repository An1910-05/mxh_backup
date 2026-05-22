import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createPost } from '../services/graphql';
import { uploadFile } from '../services/api';
import { API_ORIGIN } from '../config';
import { useMentionInput } from '../hooks/useMentionInput';
import LocationPicker from './LocationPicker';

const DEFAULT_AVATAR = '/default-avatar.png';

// Regex matches @[username|id] (new) or @username (legacy)
const MENTION_RE = /(@\[[a-zA-Z0-9._]+\|\d+\]|@[a-zA-Z0-9._]+)/g;

function renderHighlight(text) {
  if (!text) return null;
  const parts = text.split(MENTION_RE);
  return parts.map((part, i) => {
    const rich = part.match(/^@\[([a-zA-Z0-9._]+)\|(\d+)\]$/);
    if (rich) {
      const [, username, id] = rich;
      // Invisible suffix keeps overlay width = textarea char count for correct cursor alignment
      return (
        <Link key={i} to={`/profile_id=${id}`} className="cpf-mention-mark">
          @{username}<span aria-hidden="true" className="cpf-mention-pad">{`|${id}]`}</span>
        </Link>
      );
    }
    if (/^@[a-zA-Z0-9._]+$/.test(part)) {
      return <span key={i} className="cpf-mention-mark">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function CreatePostForm({ onPostCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const {
    mentionResults,
    showMention,
    handleMentionChange: mentionChange,
    selectMention,
    closeMention,
  } = useMentionInput();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [geoLat, setGeoLat] = useState(null);
  const [geoLng, setGeoLng] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const fileRef = useRef(null);
  const textRef = useRef(null);
  const overlayRef = useRef(null);

  const handleCancel = () => {
    setContent('');
    setMediaFile(null); setMediaPreview(null); setMediaType(null);
    if (fileRef.current) fileRef.current.value = '';
    setLocationLabel(''); setGeoLat(null); setGeoLng(null);
    setError('');
    closeMention();
    setExpanded(false);
  };

  // Nhấn Esc khi form đang mở → huỷ
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showLocationPicker) return;
      if (showMention) { closeMention(); return; }
      handleCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded, showMention, showLocationPicker]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) { setError('Chỉ hỗ trợ ảnh hoặc video'); return; }
    if (isImage && file.size > 10*1024*1024) { setError('Ảnh tối đa 10MB'); return; }
    if (isVideo && file.size > 1024*1024*1024) { setError('Video tối đa 1GB'); return; }
    setError('');
    setMediaFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
    setExpanded(true);
  };

  const removeMedia = () => {
    setMediaFile(null); setMediaPreview(null); setMediaType(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const pickLocation = () => {
    setShowLocationPicker(true);
  };

  const handleLocationConfirm = ({ lat, lng, label }) => {
    setGeoLat(lat);
    setGeoLng(lng);
    setLocationLabel(label);
    setShowLocationPicker(false);
    setExpanded(true);
  };

  const clearLocation = () => {
    setGeoLat(null);
    setGeoLng(null);
    setLocationLabel('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasLocation = !!(locationLabel.trim() || geoLat != null);
    if (!content.trim() && !mediaFile && !hasLocation) return;
    setLoading(true); setError('');
    try {
      let uploadedUrl=null, uploadedType=null, uploadedWidth=null, uploadedHeight=null;
      if (mediaFile) {
        setUploading(true);
        const r = await uploadFile('/upload/media', 'media', mediaFile);
        uploadedUrl = r.data.media_url; uploadedType = r.data.media_type;
        uploadedWidth = r.data.media_width||null; uploadedHeight = r.data.media_height||null;
        setUploading(false);
      }
      const newPost = await createPost({
        content: content.trim()||'',
        mediaUrl: uploadedUrl, mediaType: uploadedType, mediaWidth: uploadedWidth, mediaHeight: uploadedHeight,
        locationLabel: locationLabel.trim()||null, latitude: geoLat, longitude: geoLng,
      });
      setContent(''); removeMedia(); setLocationLabel(''); setGeoLat(null); setGeoLng(null); setExpanded(false);
      closeMention();
      if (onPostCreated) onPostCreated(newPost);
    } catch (err) { setError(err.message); setUploading(false); }
    finally { setLoading(false); }
  };

  const handleExpand = () => { setExpanded(true); setTimeout(() => textRef.current?.focus(), 50); };
  const displayName = user?.username || 'Bạn';

  const handleContentChange = (e) => {
    setContent(e.target.value);
    mentionChange(e);
  };

  const handleMentionSelect = (username, userId) => {
    const el = textRef.current;
    if (!el) return;
    const current = el.value;
    const caret = el.selectionStart ?? current.length;
    const upTo = current.slice(0, caret);
    const atIdx = upTo.lastIndexOf('@');
    if (atIdx < 0) return;
    const before = current.slice(0, atIdx);
    const after = current.slice(caret);
    // Embed user ID so the mention links to a specific account even after username changes
    const insert = userId ? `@[${username}|${userId}] ` : `@${username} `;
    const newValue = before + insert + after;
    setContent(newValue);
    closeMention();
    setTimeout(() => {
      if (textRef.current) {
        const pos = before.length + insert.length;
        textRef.current.focus();
        textRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  return (
    <div className="create-post-fb">
      {showLocationPicker && (
        <LocationPicker
          onConfirm={handleLocationConfirm}
          onCancel={() => setShowLocationPicker(false)}
        />
      )}
      <form onSubmit={handleSubmit}>
        <div className="create-post-fb-top">
          <div className="create-post-fb-avatar">
            {user?.avatar ? <img src={`${API_ORIGIN}${user.avatar}`} alt="" /> : <img src={DEFAULT_AVATAR} alt="" />}
          </div>
          {!expanded ? (
            <button type="button" className="create-post-fb-placeholder" onClick={handleExpand}>{displayName} ơi, bạn đang nghĩ gì thế?</button>
          ) : (
            <div className="create-post-mention-wrap">
              <div
                ref={overlayRef}
                className="cpf-highlight-overlay"
                aria-hidden="true"
              >
                {renderHighlight(content)}{'​'}
              </div>
              <textarea
                ref={textRef}
                value={content}
                onChange={handleContentChange}
                onBlur={() => setTimeout(closeMention, 150)}
                onScroll={() => { if (overlayRef.current) overlayRef.current.scrollTop = textRef.current.scrollTop; }}
                placeholder={`${displayName} ơi, bạn đang nghĩ gì thế? (gõ @ để tag bạn bè)`}
                rows={3}
                className="create-post-fb-textarea cpf-textarea-overlay"
              />
              {showMention && mentionResults.length > 0 && (
                <div className="mention-dropdown mention-dropdown--post">
                  {mentionResults.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      className="mention-item"
                      onMouseDown={(e) => { e.preventDefault(); handleMentionSelect(u.username, u.id); }}
                    >
                      <img src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR} alt="" />
                      <span className="mention-name">{u.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {mediaPreview && (
          <div className="create-post-fb-media-preview">
            <button type="button" onClick={removeMedia} className="create-post-fb-media-remove" aria-label="Xóa media">
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
            {mediaType === 'image' ? <img src={mediaPreview} alt="Preview" /> : <video src={mediaPreview} controls />}
          </div>
        )}

        {error && <div className="apple-alert apple-alert-danger" style={{margin:'8px 16px'}}>{error}</div>}

        <div className="create-post-fb-divider" />
        <div className="create-post-fb-actions">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime" onChange={handleFileSelect} style={{display:'none'}} />
          <button type="button" className="create-post-fb-action" onClick={()=>fileRef.current?.click()}>
            <i className="bi bi-image-fill" aria-hidden="true" />
            <span>Ảnh/video</span>
          </button>
          <button type="button" className="create-post-fb-action" onClick={pickLocation}>
            <i className="bi bi-geo-alt-fill" aria-hidden="true" />
            <span>Vị trí</span>
          </button>
        </div>

        {expanded && (
          <>
            <div className="create-post-fb-extra">
              {locationLabel && geoLat != null && geoLng != null && (
                <div className="cpf-location-preview">
                  <div className="cpf-location-map-wrap">
                    <iframe
                      title="Xem trước vị trí"
                      className="cpf-location-map-iframe"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${geoLng - 0.015},${geoLat - 0.009},${geoLng + 0.015},${geoLat + 0.009}&layer=mapnik&marker=${geoLat},${geoLng}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="cpf-location-map-overlay" />
                  </div>
                  <div className="cpf-location-footer">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="#e41e3f" style={{flexShrink:0}}>
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <span className="cpf-location-label">{locationLabel}</span>
                    <button type="button" className="cpf-location-clear" onClick={clearLocation} title="Xóa vị trí" aria-label="Xóa vị trí">
                      <i className="bi bi-x-lg" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="create-post-fb-actions" style={{paddingTop:'8px'}}>
              <button type="button" className="create-post-fb-cancel" onClick={handleCancel} disabled={loading}>
                Hủy
              </button>
              <button type="submit" className="create-post-fb-submit" disabled={loading || (!content.trim()&&!mediaFile&&!(locationLabel.trim()||geoLat!=null))}>
                {uploading?'Đang tải...':loading?'Đang đăng...':'Đăng'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
