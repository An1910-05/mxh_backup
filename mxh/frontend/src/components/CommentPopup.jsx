import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getComments, createComment, deleteComment as deleteCommentApi, searchUsers } from '../services/graphql';
import { useAuth } from '../hooks/useAuth';
import { timeAgoShort } from '../utils/time';
import { uploadFile } from '../services/api';
import { API_ORIGIN } from '../config';
import CommentMediaAttachment from './CommentMediaAttachment';
import CommentMediaViewer from './CommentMediaViewer';

const DEFAULT_AVATAR = '/default-avatar.png';

function renderContentWithMentions(text) {
  if (!text) return null;
  const parts = text.split(/(@[a-zA-Z0-9._]+)/g);
  return parts.map((part, i) => {
    if (/^@[a-zA-Z0-9._]+$/.test(part)) {
      return <span key={i} className="comment-mention">{part}</span>;
    }
    return part;
  });
}

function InlineReplyForm({ postId, parentId, placeholder, onReplied, onCancel }) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [mentionResults, setMentionResults] = useState([]);
  const [showMention, setShowMention] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 20);
  }, []);

  const handleChange = (e) => {
    const next = e.target.value;
    setContent(next);
    const caret = e.target.selectionStart ?? next.length;
    const upTo = next.slice(0, caret);
    const atIdx = upTo.lastIndexOf('@');
    if (atIdx < 0) { setShowMention(false); setMentionStart(-1); return; }
    const prev = atIdx === 0 ? ' ' : upTo[atIdx - 1];
    if (!/\s/.test(prev)) { setShowMention(false); setMentionStart(-1); return; }
    const query = upTo.slice(atIdx + 1);
    if (/\s/.test(query)) { setShowMention(false); setMentionStart(-1); return; }
    setMentionStart(atIdx);
    setShowMention(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await searchUsers(query || '', 8);
        setMentionResults(r || []);
      } catch (err) {
        console.error('mention search failed', err);
        setMentionResults([]);
      }
    }, 180);
  };

  const pickMention = (username) => {
    if (mentionStart < 0) return;
    const el = inputRef.current;
    if (!el) return;
    const current = el.value;
    const caret = el.selectionStart ?? current.length;
    const before = current.slice(0, mentionStart);
    const after = current.slice(caret);
    const insert = `@${username} `;
    const newValue = before + insert + after;
    setContent(newValue);
    setShowMention(false);
    setMentionStart(-1);
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + insert.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const newComment = await createComment(postId, content.trim(), {}, parentId);
      setContent('');
      if (onReplied) onReplied(newComment);
    } catch (err) {
      console.error('reply failed', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="popup-inline-reply" onSubmit={handleSubmit}>
      <div className="comment-reply-input-wrap">
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={handleChange}
          onBlur={() => setTimeout(() => setShowMention(false), 150)}
          placeholder={placeholder || 'Viết trả lời...'}
        />
        {showMention && mentionResults.length > 0 && (
          <div className="mention-dropdown">
            {mentionResults.map((u) => (
              <button
                type="button"
                key={u.id}
                className="mention-item"
                onMouseDown={(ev) => { ev.preventDefault(); pickMention(u.username); }}
              >
                <img src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR} alt="" />
                <span className="mention-name">{u.username}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="submit" disabled={!content.trim() || sending} className="popup-inline-reply-send">
        {sending ? '...' : 'Gửi'}
      </button>
      {onCancel && (
        <button type="button" className="popup-inline-reply-cancel" onClick={onCancel}>Hủy</button>
      )}
    </form>
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
  const [openReplyFor, setOpenReplyFor] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [showMention, setShowMention] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const searchTimer = useRef(null);
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
    setMediaFile(file); setMediaType(isVid ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null); setMediaPreview(null); setMediaType(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleInputChange = (e) => {
    const next = e.target.value;
    setInput(next);
    const caret = e.target.selectionStart ?? next.length;
    const upTo = next.slice(0, caret);
    const atIdx = upTo.lastIndexOf('@');
    if (atIdx < 0) { setShowMention(false); setMentionStart(-1); return; }
    const prev = atIdx === 0 ? ' ' : upTo[atIdx - 1];
    if (!/\s/.test(prev)) { setShowMention(false); setMentionStart(-1); return; }
    const query = upTo.slice(atIdx + 1);
    if (/\s/.test(query)) { setShowMention(false); setMentionStart(-1); return; }
    setMentionStart(atIdx);
    setShowMention(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await searchUsers(query || '', 8);
        setMentionResults(r || []);
      } catch (err) {
        console.error('mention search failed', err);
        setMentionResults([]);
      }
    }, 180);
  };

  const pickMention = (username) => {
    if (mentionStart < 0) return;
    const el = inputRef.current;
    if (!el) return;
    const current = el.value;
    const caret = el.selectionStart ?? current.length;
    const before = current.slice(0, mentionStart);
    const after = current.slice(caret);
    const insert = `@${username} `;
    const newValue = before + insert + after;
    setInput(newValue);
    setShowMention(false);
    setMentionStart(-1);
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + insert.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!input.trim() && !mediaFile) || sending) return;
    setSending(true); setError('');
    try {
      let uploadedUrl = null, uploadedType = null, uploadedWidth = null, uploadedHeight = null;
      if (mediaFile) {
        setUploading(true);
        const r = await uploadFile('/upload/media', 'media', mediaFile);
        uploadedUrl = r.data.media_url; uploadedType = r.data.media_type;
        uploadedWidth = r.data.media_width || null; uploadedHeight = r.data.media_height || null;
        setUploading(false);
      }
      const newComment = await createComment(post.id, input.trim() || '', { mediaUrl: uploadedUrl, mediaType: uploadedType, mediaWidth: uploadedWidth, mediaHeight: uploadedHeight });
      if (newComment.id) newCommentIds.current.add(String(newComment.id));
      setComments((prev) => [...prev, newComment]);
      setInput(''); clearMedia();
      setShowMention(false);
      onCommentCountChange?.(comments.length + 1);
      setTimeout(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, 50);
    } catch (e) { setError(e.message); setUploading(false); }
    finally { setSending(false); }
  };

  const handleReplied = (newComment) => {
    if (newComment?.id) newCommentIds.current.add(String(newComment.id));
    setComments((prev) => [...prev, newComment]);
    setOpenReplyFor(null);
    onCommentCountChange?.(comments.length + 1);
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Bạn có chắc muốn xoá bình luận này?')) return;
    try {
      await deleteCommentApi(commentId);
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== commentId && c.parent_id !== commentId);
        onCommentCountChange?.(next.length);
        return next;
      });
    } catch (err) {
      alert('Không thể xoá: ' + err.message);
    }
  };

  const { parents, repliesByParent } = useMemo(() => {
    const parents = [];
    const replies = {};
    (comments || []).forEach((c) => {
      if (c.parent_id) {
        if (!replies[c.parent_id]) replies[c.parent_id] = [];
        replies[c.parent_id].push(c);
      } else {
        parents.push(c);
      }
    });
    return { parents, repliesByParent: replies };
  }, [comments]);

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };
  const canSend = (input.trim() || mediaFile) && !sending;

  const renderComment = (c, isReply = false) => {
    const canDelete = user && (user.id === c.user_id || user.id === post.user_id);
    return (
      <div key={c.id} className={`comment-item${isReply ? ' comment-item--reply' : ''}${newCommentIds.current.has(String(c.id)) ? ' comment-item--new' : ''}`}>
        <Link to={`/profile_id=${c.user_id}`} className="comment-avatar">
          <img src={c.user_avatar ? `${API_ORIGIN}${c.user_avatar}` : DEFAULT_AVATAR} alt="" />
        </Link>
        <div className="comment-body">
          <div className="comment-bubble">
            <Link to={`/profile_id=${c.user_id}`} className="comment-username">{c.username}</Link>
            {c.content ? (
              <div className="comment-text">{renderContentWithMentions(c.content)}</div>
            ) : null}
            <CommentMediaAttachment
              comment={c}
              onOpen={() => setActiveMediaComment(c)}
            />
          </div>
          <div className="comment-meta">
            <span className="comment-time">{timeAgoShort(c.created_at)}</span>
            {user && (
              <button
                type="button"
                className="comment-reply-btn"
                onClick={() => setOpenReplyFor(openReplyFor === c.id ? null : c.id)}
              >
                Trả lời
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="comment-reply-btn comment-delete-btn"
                onClick={() => handleDelete(c.id)}
              >
                Xoá
              </button>
            )}
          </div>
          {openReplyFor === c.id && (
            <InlineReplyForm
              postId={post.id}
              parentId={c.id}
              placeholder={`Trả lời ${c.username}...`}
              onReplied={handleReplied}
              onCancel={() => setOpenReplyFor(null)}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="popup-overlay" onClick={handleOverlayClick}>
        <div className="popup-container popup-comments">
          <div className="popup-header">
            <h3>Bình luận ({loading ? '...' : comments.length})</h3>
            <button className="popup-close" onClick={onClose}>✕</button>
          </div>
          <div className="popup-comment-list" ref={listRef}>
            {loading ? (
              <div className="popup-loading">Đang tải bình luận...</div>
            ) : comments.length === 0 ? (
              <div className="popup-empty">Chưa có bình luận nào!</div>
            ) : (
              parents.map((p) => {
                const replies = repliesByParent[p.id] || [];
                return (
                  <div key={p.id} className="comment-thread">
                    {renderComment(p, false)}
                    {replies.length > 0 && (
                      <div className="comment-replies">
                        {replies.map((r) => renderComment(r, true))}
                      </div>
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

          {error && <div className="apple-alert apple-alert-danger" style={{ margin: '0 16px 8px', padding: '6px 12px', fontSize: '0.85rem' }}>{error}</div>}

          {user && (
            <form className="popup-comment-form" onSubmit={handleSend}>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,video/mp4" style={{ display: 'none' }} onChange={handleFile} />
              <button type="button" className="popup-comment-attach" onClick={() => fileRef.current?.click()} aria-label="Đính kèm ảnh/video">
                <span className="popup-comment-attach-icon" aria-hidden="true" />
              </button>
              <div className="popup-comment-input-wrap">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onBlur={() => setTimeout(() => setShowMention(false), 150)}
                  placeholder="Viết bình luận... (gõ @ để tag)"
                  autoFocus
                />
                {showMention && mentionResults.length > 0 && (
                  <div className="mention-dropdown mention-dropdown--comment">
                    {mentionResults.map((u) => (
                      <button
                        type="button"
                        key={u.id}
                        className="mention-item"
                        onMouseDown={(e) => { e.preventDefault(); pickMention(u.username); }}
                      >
                        <img src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR} alt="" />
                        <span className="mention-name">{u.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={!canSend} className="popup-comment-send">{uploading || sending ? '...' : '➤'}</button>
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
