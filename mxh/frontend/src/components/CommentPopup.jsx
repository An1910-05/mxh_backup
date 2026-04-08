import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getComments, createComment } from '../services/graphql';
import { useAuth } from '../hooks/useAuth';
import { timeAgoShort } from '../utils/time';
import { uploadFile } from '../services/api';
import { API_ORIGIN } from '../config';
import useMentionInput from '../hooks/useMentionInput';
import CommentMediaAttachment from './CommentMediaAttachment';
import CommentMediaViewer from './CommentMediaViewer';

const DEFAULT_AVATAR = '/default-avatar.png';

function renderContentWithMentions(content) {
  if (!content) return null;
  const parts = content.split(/(@[a-zA-Z0-9._]+)/g);
  return parts.map((part, i) => {
    if (/^@[a-zA-Z0-9._]+$/.test(part)) {
      return <span key={i} className="comment-mention">{part}</span>;
    }
    return part;
  });
}

function MentionDropdown({ results, onSelect }) {
  if (!results || results.length === 0) return null;
  return (
    <div className="mention-dropdown">
      {results.map(u => (
        <button
          type="button"
          key={u.id}
          className="mention-item"
          onMouseDown={e => { e.preventDefault(); onSelect(u.username); }}
        >
          <img
            src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR}
            alt=""
            className="mention-avatar"
            onError={e => { e.target.src = DEFAULT_AVATAR; }}
          />
          <span className="mention-name">{u.username}</span>
        </button>
      ))}
    </div>
  );
}

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
  const [activeMediaComment, setActiveMediaComment] = useState(null);
  const [replyTo, setReplyTo] = useState(null); // { id, username }
  const [expandedReplies, setExpandedReplies] = useState({});
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const newCommentIds = useRef(new Set());
  const { mentionResults, showMention, handleMentionChange, selectMention, closeMention } = useMentionInput();

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

  useEffect(() => {
    return () => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

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
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file); setMediaType(isVid?'video':'image');
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null); setMediaPreview(null); setMediaType(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleReply = (comment) => {
    setReplyTo({ id: comment.id, username: comment.username });
    setInput(`@${comment.username} `);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyTo(null);
    setInput('');
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    handleMentionChange(val, e.target.selectionStart || val.length);
  };

  const handleMentionSelect = (username) => {
    const newText = selectMention(username, input);
    setInput(newText);
    closeMention();
    inputRef.current?.focus();
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
      const parentId = replyTo ? replyTo.id : null;
      const newComment = await createComment(post.id, input.trim()||'', { mediaUrl: uploadedUrl, mediaType: uploadedType, mediaWidth: uploadedWidth, mediaHeight: uploadedHeight }, parentId);
      if (newComment.id) newCommentIds.current.add(String(newComment.id));
      setComments(prev => [...prev, newComment]);
      setInput(''); clearMedia(); setReplyTo(null);
      onCommentCountChange?.(comments.length + 1);
      // Auto-expand replies for the parent
      if (parentId) {
        setExpandedReplies(prev => ({ ...prev, [parentId]: true }));
      }
      setTimeout(() => { listRef.current?.scrollTo({top: listRef.current.scrollHeight, behavior:'smooth'}); }, 50);
    } catch (e) { setError(e.message); setUploading(false); }
    finally { setSending(false); }
  };

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };
  const canSend = (input.trim() || mediaFile) && !sending;

  // Organize comments: parents + replies
  const parentComments = comments.filter(c => !c.parent_id);
  const repliesByParent = {};
  comments.forEach(c => {
    if (c.parent_id) {
      if (!repliesByParent[c.parent_id]) repliesByParent[c.parent_id] = [];
      repliesByParent[c.parent_id].push(c);
    }
  });

  const toggleReplies = (parentId) => {
    setExpandedReplies(prev => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const renderComment = (c, isReply = false, parentUsername = null) => (
    <div key={c.id} className={`comment-item${newCommentIds.current.has(String(c.id))?' comment-item--new':''}${isReply?' comment-item--reply':''}`}>
      <Link to={`/profile_id=${c.user_id}`} className="comment-avatar">
        <img src={c.user_avatar?`${API_ORIGIN}${c.user_avatar}`:DEFAULT_AVATAR} alt="" />
      </Link>
      <div className="comment-body">
        <div className="comment-bubble">
          <Link to={`/profile_id=${c.user_id}`} className="comment-username">{c.username}</Link>
          <div className="comment-text">
            {parentUsername && <span className="comment-reply-to">@{parentUsername}</span>}
            {c.content ? renderContentWithMentions(c.content) : null}
          </div>
          <CommentMediaAttachment
            comment={c}
            onOpen={() => setActiveMediaComment(c)}
          />
        </div>
        <div className="comment-meta">
          <span className="comment-time">{timeAgoShort(c.created_at)}</span>
          <button type="button" className="comment-reply-btn" onClick={() => handleReply(c)}>
            Trả lời
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
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
            parentComments.map(c => {
              const replies = repliesByParent[c.id] || [];
              const isExpanded = expandedReplies[c.id];

              return (
                <div key={c.id} className="comment-thread">
                  {renderComment(c)}

                  {replies.length > 0 && !isExpanded && (
                    <button type="button" className="comment-show-replies" onClick={() => toggleReplies(c.id)}>
                      ↳ Xem {replies.length} phản hồi
                    </button>
                  )}

                  {replies.length > 0 && isExpanded && (
                    <>
                      <button type="button" className="comment-show-replies" onClick={() => toggleReplies(c.id)}>
                        Ẩn phản hồi
                      </button>
                      <div className="comment-replies">
                        {replies.map(r => renderComment(r, true, c.username))}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {mediaPreview && (
          <div className="popup-comment-media-preview">
            <button type="button" className="popup-comment-media-remove" onClick={clearMedia}>✕</button>
            {mediaType === 'image' ? <img src={mediaPreview} alt="Preview" /> : <video src={mediaPreview} controls />}
          </div>
        )}

        {error && <div className="apple-alert apple-alert-danger" style={{margin:'0 16px 8px',padding:'6px 12px',fontSize:'0.85rem'}}>{error}</div>}

        {replyTo && (
          <div className="popup-reply-indicator">
            <span>Đang trả lời <strong>{replyTo.username}</strong></span>
            <button type="button" onClick={cancelReply}>✕</button>
          </div>
        )}

        {user && (
          <form className="popup-comment-form" onSubmit={handleSend}>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,video/mp4" style={{display:'none'}} onChange={handleFile} />
            <button type="button" className="popup-comment-attach" onClick={()=>fileRef.current?.click()} aria-label="Đính kèm ảnh/video">📎</button>
            <div className="popup-comment-input-wrap">
              <input ref={inputRef} type="text" value={input} onChange={handleInputChange} onBlur={() => setTimeout(closeMention, 150)} placeholder="Viết bình luận..." autoFocus />
              {showMention && <MentionDropdown results={mentionResults} onSelect={handleMentionSelect} />}
            </div>
            <button type="submit" disabled={!canSend} className="popup-comment-send">{uploading||sending?'...':'➤'}</button>
          </form>
        )}
        </div>
      </div>

      {activeMediaComment && (
        <CommentMediaViewer
          comment={activeMediaComment}
          onClose={() => setActiveMediaComment(null)}
        />
      )}
    </>
  );
}
