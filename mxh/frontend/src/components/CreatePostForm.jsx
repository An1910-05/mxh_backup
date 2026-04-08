import { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { createPost } from '../services/graphql';
import { uploadFile } from '../services/api';
import { API_ORIGIN } from '../config';
import { useMentionInput } from '../hooks/useMentionInput';

const DEFAULT_AVATAR = '/default-avatar.png';
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
  const fileRef = useRef(null);
  const textRef = useRef(null);

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
    if (!navigator.geolocation) { setError('Trình duyệt không hỗ trợ GPS'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLat(pos.coords.latitude);
        setGeoLng(pos.coords.longitude);
        setLocationLabel(pos.coords.latitude.toFixed(4)+', '+pos.coords.longitude.toFixed(4));
        setGeoLoading(false);
        setExpanded(true);
      },
      () => { setError('Không lấy được vị trí'); setGeoLoading(false); }
    );
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

  const handleMentionSelect = (username) => {
    const el = textRef.current;
    if (!el) return;
    const current = el.value;
    const caret = el.selectionStart ?? current.length;
    const upTo = current.slice(0, caret);
    const atIdx = upTo.lastIndexOf('@');
    if (atIdx < 0) return;
    const before = current.slice(0, atIdx);
    const after = current.slice(caret);
    const insert = `@${username} `;
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
      <form onSubmit={handleSubmit}>
        <div className="create-post-fb-top">
          <div className="create-post-fb-avatar">
            {user?.avatar ? <img src={`${API_ORIGIN}${user.avatar}`} alt="" /> : <img src={DEFAULT_AVATAR} alt="" />}
          </div>
          {!expanded ? (
            <button type="button" className="create-post-fb-placeholder" onClick={handleExpand}>{displayName} ơi, bạn đang nghĩ gì thế?</button>
          ) : (
            <div className="create-post-mention-wrap">
              <textarea
                ref={textRef}
                value={content}
                onChange={handleContentChange}
                onBlur={() => setTimeout(closeMention, 150)}
                placeholder={`${displayName} ơi, bạn đang nghĩ gì thế? (gõ @ để tag bạn bè)`}
                rows={3}
                className="create-post-fb-textarea"
              />
              {showMention && mentionResults.length > 0 && (
                <div className="mention-dropdown mention-dropdown--post">
                  {mentionResults.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      className="mention-item"
                      onMouseDown={(e) => { e.preventDefault(); handleMentionSelect(u.username); }}
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
            <button type="button" onClick={removeMedia} className="create-post-fb-media-remove">✕</button>
            {mediaType === 'image' ? <img src={mediaPreview} alt="Preview" /> : <video src={mediaPreview} controls />}
          </div>
        )}

        {error && <div className="apple-alert apple-alert-danger" style={{margin:'8px 16px'}}>{error}</div>}

        <div className="create-post-fb-divider" />
        <div className="create-post-fb-actions">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime" onChange={handleFileSelect} style={{display:'none'}} />
          <button type="button" className="create-post-fb-action" onClick={()=>fileRef.current?.click()}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#45bd62" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="#45bd62"/><path d="M21 15l-5-5L5 21" stroke="#45bd62" strokeWidth="2" strokeLinecap="round"/></svg>
            <span>Ảnh/video</span>
          </button>
          <button type="button" className="create-post-fb-action" onClick={pickLocation} disabled={geoLoading}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#45bd62" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>{geoLoading?'...':'📍 Vị trí'}</span>
          </button>
        </div>

        {expanded && (
          <>
            <div className="create-post-fb-extra">
              {locationLabel && (
                <div className="create-post-fb-location">
                  <span style={{fontSize:'0.85rem',color:'#65676b'}}>📍 {locationLabel}</span>
                </div>
              )}
            </div>
            <div className="create-post-fb-actions" style={{paddingTop:'8px'}}>
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
