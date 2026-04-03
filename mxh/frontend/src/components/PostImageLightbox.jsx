import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getComments, createComment } from '../services/graphql';
import { useAuth } from '../hooks/useAuth';
import { timeAgo, timeAgoShort } from '../utils/time';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

export default function PostImageLightbox({
  post,
  mediaUrl,
  onClose,
  liked,
  likeCount,
  onLike,
  onCommentAdded,
  onShare,
}) {
  const { user } = useAuth();
  const [zoom, setZoom] = useState(1);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const stageRef = useRef(null);
  const listRef = useRef(null);
  const composeInputRef = useRef(null);
  const newIds = useRef(new Set());

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const data = await getComments(post.id);
      setComments(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingComments(false);
    }
  }, [post.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));

  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const newComment = await createComment(post.id, input.trim());
      if (newComment.id) newIds.current.add(String(newComment.id));
      setComments((prev) => [...prev, newComment]);
      onCommentAdded?.();
      setInput('');
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const displayContent =
    post.content && post.content !== '📷' && post.content !== '🎬' ? post.content : null;

  return (
    <div className="post-lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh">
      <div className="post-lightbox-inner">
        <div className="post-lightbox-stage" ref={stageRef}>
          <div className="post-lightbox-toolbar">
            <div className="post-lightbox-toolbar-left">
              <button type="button" className="post-lightbox-iconbtn" onClick={onClose} aria-label="Đóng">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
              <span className="post-lightbox-brand">iPock</span>
            </div>
            <div className="post-lightbox-counter">1 / 1</div>
            <div className="post-lightbox-toolbar-right">
              <button type="button" className="post-lightbox-iconbtn" onClick={zoomIn} aria-label="Phóng to" title="Phóng to">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35M11 8v6M8 11h6" /></svg>
              </button>
              <button type="button" className="post-lightbox-iconbtn" onClick={zoomOut} aria-label="Thu nhỏ" title="Thu nhỏ">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35M8 11h6" /></svg>
              </button>
              <button type="button" className="post-lightbox-iconbtn" onClick={toggleFullscreen} aria-label="Toàn màn hình" title="Toàn màn hình">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 9v6h-6M3 15v-6h6" /></svg>
              </button>
            </div>
          </div>
          <div className="post-lightbox-image-scroll">
            <img
              src={mediaUrl}
              alt=""
              className="post-lightbox-img"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          </div>
        </div>

        <aside className="post-lightbox-sidebar">
          <div className="post-lightbox-sidebar-inner">
            <p className="post-lightbox-post-hint">
              Ảnh này nằm trong một bài viết.{' '}
              <Link to={`/post/${post.id}`} className="post-lightbox-post-link" onClick={onClose}>
                Xem bài viết
              </Link>
            </p>

            <div className="post-lightbox-author">
              <Link to={`/profile_id=${post.user_id}`} className="post-lightbox-author-avatar">
                <img src={post.user_avatar ? `${API_ORIGIN}${post.user_avatar}` : DEFAULT_AVATAR} alt="" />
              </Link>
              <div className="post-lightbox-author-meta">
                <Link to={`/profile_id=${post.user_id}`} className="post-lightbox-author-name">
                  {post.username}
                </Link>
                <div className="post-lightbox-author-time">
                  <span>{timeAgo(post.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="post-lightbox-actions">
              <button type="button" className={`post-lightbox-action${liked ? ' post-lightbox-action--on' : ''}`} onClick={onLike}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 22V11m-5 2v7a2 2 0 002 2h12.4a2 2 0 001.94-1.52l1.72-7A2 2 0 0018.12 10H14V5a3 3 0 00-3-3l-4 9" /></svg>
                <span>Thích{likeCount > 0 ? ` (${likeCount})` : ''}</span>
              </button>
              <button type="button" className="post-lightbox-action" onClick={() => composeInputRef.current?.focus()}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
                <span>Bình luận</span>
              </button>
              <button type="button" className="post-lightbox-action" onClick={onShare}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                <span>Chia sẻ</span>
              </button>
            </div>

            {displayContent && <p className="post-lightbox-caption">{displayContent}</p>}

            <div className="post-lightbox-comments" ref={listRef}>
              {loadingComments ? (
                <div className="post-lightbox-comments-loading">Đang tải bình luận...</div>
              ) : comments.length === 0 ? (
                <div className="post-lightbox-comments-empty">
                  Chưa có bình luận nào. Hãy là người đầu tiên bình luận.
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className={`post-lightbox-comment${newIds.current.has(String(c.id)) ? ' comment-item--new' : ''}`}>
                    <Link to={`/profile_id=${c.user_id}`} className="post-lightbox-comment-avatar">
                      <img src={c.user_avatar ? `${API_ORIGIN}${c.user_avatar}` : DEFAULT_AVATAR} alt="" />
                    </Link>
                    <div className="post-lightbox-comment-body">
                      <div className="post-lightbox-comment-bubble">
                        <Link to={`/profile_id=${c.user_id}`} className="post-lightbox-comment-user">{c.username}</Link>
                        <div className="post-lightbox-comment-text">{c.content}</div>
                      </div>
                      <div className="post-lightbox-comment-time">{timeAgoShort(c.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {error && <div className="apple-alert apple-alert-danger post-lightbox-err">{error}</div>}

            {user && (
              <form className="post-lightbox-compose" onSubmit={handleSend}>
                <img
                  src={user.avatar ? `${API_ORIGIN}${user.avatar}` : DEFAULT_AVATAR}
                  alt=""
                  className="post-lightbox-compose-avatar"
                />
                <input
                  ref={composeInputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Viết bình luận công khai..."
                  className="post-lightbox-compose-input"
                />
                <button type="submit" className="post-lightbox-compose-send" disabled={!input.trim() || sending} aria-label="Gửi">
                  {sending ? '…' : '➤'}
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
