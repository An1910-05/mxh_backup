import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getComments, createComment } from '../services/graphql';
import { useAuth } from '../hooks/useAuth';
import { timeAgoShort } from '../utils/time';
import VideoPlayer from './VideoPlayer';
import { uploadFile } from '../services/api';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function CommentPopup({ post, onClose, onCommentCountChange }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const newCommentIds = useRef(new Set());

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    loadComments();
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const loadComments = async () => {
    try {
      const data = await getComments(post.id);
      setComments(data || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');
    if (!isImg && !isVid) { setError('Chỉ ảnh hoặc video'); return; }
    setMediaFile(file); setMediaType(isVid?'video':'image');
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setMediaFile(null); setMediaPreview(null); setMediaType(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!input.trim() && !mediaFile) || sending) return;
    setSending(true); setError('');
    try {
      let uploadedUrl=null, uploadedType=null, uploadedWidth=null, uploadedHeight=null;
      if (mediaFile) {
        setUploading(true);
        const r = await uploadFile('/upload/media', 'media', mediaFile);
        uploadedUrl = r.data.media_url; uploadedType = r.data.media_type;
        uploadedWidth = r.data.media_width||null; uploadedHeight = r.data.media_height||null;
        setUploading(false);
      }
      const newComment = await createComment(post.id, input.trim()||'', { mediaUrl: uploadedUrl, mediaType: uploadedType, mediaWidth: uploadedWidth, mediaHeight: uploadedHeight });
      if (newComment.id) newCommentIds.current.add(String(newComment.id));
      setComments(prev => [...prev, newComment]);
      setInput(''); clearMedia();
      onCommentCountChange?.(comments.length + 1);
      setTimeout(() => { listRef.current?.scrollTo({top: listRef.current.scrollHeight, behavior:'smooth'}); }, 50);
    } catch (e) { setError(e.message); setUploading(false); }
    finally { setSending(false); }
  };

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };
  const canSend = (input.trim() || mediaFile) && !sending;

  return (
    <div className="popup-overlay" onClick={handleOverlayClick}>
      <div className="popup-container popup-comments">
        <div className="popup-header">
          <h3>Bình luận ({loading?'...':comments.length})</h3>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="popup-comment-list" ref={listRef}>
          {loading ? (
            <div className="popup-loading">Đang tải bình luận...</div>
          ) : comments.length === 0 ? (
            <div className="popup-empty">Chưa có bình luận nào!</div>
          ) : (
            comments.map(c => (
              <div key={c.id} className={`comment-item${newCommentIds.current.has(String(c.id))?' comment-item--new':''}`}>
                <Link to={`/profile_id=${c.user_id}`} className="comment-avatar">
                  <img src={c.user_avatar?`${API_ORIGIN}${c.user_avatar}`:DEFAULT_AVATAR} alt="" />
                </Link>
                <div className="comment-body">
                  <div className="comment-bubble">
                    <Link to={`/profile_id=${c.user_id}`} className="comment-username">{c.username}</Link>
                    {c.content ? <div className="comment-text">{c.content}</div> : null}
                    {c.media_url && c.media_type === 'image' && (
                      <img src={`${API_ORIGIN}${c.media_url}`} alt="" className="comment-media-thumb" />
                    )}
                    {c.media_url && c.media_type === 'video' && (
                      <div className="comment-media-video"><VideoPlayer src={`${API_ORIGIN}${c.media_url}`} /></div>
                    )}
                  </div>
                  <div className="comment-time">{timeAgoShort(c.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {mediaPreview && (
          <div className="popup-comment-media-preview">
            <button type="button" className="popup-comment-media-remove" onClick={clearMedia}>✕</button>
            {mediaType === 'image' ? <img src={mediaPreview} alt="Preview" /> : <video src={mediaPreview} controls />}
          </div>
        )}

        {error && <div className="apple-alert apple-alert-danger" style={{margin:'0 16px 8px',padding:'6px 12px',fontSize:'0.85rem'}}>{error}</div>}

        {user && (
          <form className="popup-comment-form" onSubmit={handleSend}>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,video/mp4" style={{display:'none'}} onChange={handleFile} />
            <button type="button" className="popup-comment-attach" onClick={()=>fileRef.current?.click()} aria-label="Đính kèm ảnh/video">📎</button>
            <input ref={inputRef} type="text" value={input} onChange={e=>setInput(e.target.value)} placeholder="Viết bình luận..." autoFocus />
            <button type="submit" disabled={!canSend} className="popup-comment-send">{uploading||sending?'...':'➤'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
