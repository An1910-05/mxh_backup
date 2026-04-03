import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { timeAgo } from '../utils/time';
import { API_ORIGIN } from '../config';
import VideoPlayer from './VideoPlayer';

const DEFAULT_AVATAR = '/default-avatar.png';

function getMediaUrl(mediaUrl) {
  if (!mediaUrl) return null;
  if (/^https?:\/\//i.test(mediaUrl)) return mediaUrl;
  return `${API_ORIGIN}${mediaUrl}`;
}

function getRatioStyle(comment) {
  const width = Number(comment?.media_width);
  const height = Number(comment?.media_height);
  if (!width || !height || width <= 0 || height <= 0) return null;
  return { aspectRatio: `${width} / ${height}` };
}

export default function CommentMediaViewer({ comment, onClose }) {
  const previousOverflow = useRef('');

  useEffect(() => {
    previousOverflow.current = document.body.style.overflow;
    document.body.classList.add('comment-media-viewer-open');
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.classList.remove('comment-media-viewer-open');
      document.body.style.overflow = previousOverflow.current;
    };
  }, []);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!comment?.media_url || !comment?.media_type) return null;

  const mediaUrl = getMediaUrl(comment.media_url);
  const isVideo = comment.media_type === 'video';
  const ratioStyle = getRatioStyle(comment);
  const commentText = comment.content && comment.content.trim() ? comment.content.trim() : null;

  if (!mediaUrl) return null;

  const handleOverlayClick = (event) => {
    event.stopPropagation();
    if (event.target === event.currentTarget) onClose?.();
  };

  return (
    <div
      className="comment-media-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? 'View comment video' : 'View comment image'}
      onClick={handleOverlayClick}
    >
      <div className="comment-media-viewer-shell">
        <section className="comment-media-viewer-stage">
          <div className="comment-media-viewer-toolbar">
            <div className="comment-media-viewer-toolbar-left">
              <span className="comment-media-viewer-badge">
                {isVideo ? 'Video' : 'Image'}
              </span>
              <span className="comment-media-viewer-hint">Comment attachment</span>
            </div>

            <button
              type="button"
              className="comment-media-viewer-close"
              onClick={(event) => {
                event.stopPropagation();
                onClose?.();
              }}
              aria-label="Close media viewer"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="comment-media-viewer-frame">
            {isVideo ? (
              <div className="comment-media-viewer-video" style={ratioStyle || undefined}>
                <VideoPlayer
                  src={mediaUrl}
                  style={ratioStyle || { aspectRatio: '16 / 9' }}
                  className="comment-media-viewer-player"
                />
              </div>
            ) : (
              <img
                src={mediaUrl}
                alt=""
                className="comment-media-viewer-image"
                draggable={false}
              />
            )}
          </div>
        </section>

        <aside className="comment-media-viewer-sidebar">
          <div className="comment-media-viewer-sidebar-inner">
            <div className="comment-media-viewer-author">
              <Link to={`/profile_id=${comment.user_id}`} className="comment-media-viewer-author-avatar" onClick={onClose}>
                <img
                  src={comment.user_avatar ? `${API_ORIGIN}${comment.user_avatar}` : DEFAULT_AVATAR}
                  alt=""
                />
              </Link>

              <div className="comment-media-viewer-author-meta">
                <Link to={`/profile_id=${comment.user_id}`} className="comment-media-viewer-author-name" onClick={onClose}>
                  {comment.username}
                </Link>
                <div className="comment-media-viewer-author-time">{timeAgo(comment.created_at)}</div>
              </div>
            </div>

            <div className="comment-media-viewer-panel">
              <div className="comment-media-viewer-panel-label">
                {isVideo ? 'Video in comment' : 'Image in comment'}
              </div>
              {commentText ? (
                <p className="comment-media-viewer-caption">{commentText}</p>
              ) : (
                <p className="comment-media-viewer-caption comment-media-viewer-caption--muted">
                  No comment text was added with this attachment.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
