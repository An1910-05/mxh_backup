import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { likePost, unlikePost, deletePost, editPost } from '../services/graphql';
import { useAuth } from '../hooks/useAuth';
import { timeAgo } from '../utils/time';
import CommentPopup from './CommentPopup';
import PostImageLightbox from './PostImageLightbox';
import VideoPlayer from './VideoPlayer';
import ConfirmDialog from './ConfirmDialog';
import SharePopup from './SharePopup';
import FacebookEmoji from './FacebookEmoji';
import ReactionDetailsPopup from './ReactionDetailsPopup';
import { getPostLikers } from '../services/graphql';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';

export function renderTextWithMentions(text) {
  if (!text) return null;
  const parts = text.split(/(@[a-zA-Z0-9._]+)/g);
  return parts.map((part, i) => {
    if (/^@[a-zA-Z0-9._]+$/.test(part)) {
      return <span key={i} className="post-mention">{part}</span>;
    }
    return part;
  });
}

const REACTIONS = [
  { key: 'like',  emoji: '👍', label: 'Thích',     color: '#0866ff', bg: '#548dff' },
  { key: 'love',  emoji: '❤️', label: 'Yêu thích', color: '#f55064', bg: '#f55064' },
  { key: 'haha',  emoji: '😂', label: 'Haha',      color: '#f7b125', bg: '#f7b125' },
  { key: 'wow',   emoji: '😮', label: 'Wow',       color: '#f7b125', bg: '#f7b125' },
  { key: 'sad',   emoji: '😢', label: 'Buồn',      color: '#f7b125', bg: '#f7b125' },
  { key: 'angry', emoji: '😡', label: 'Phẫn nộ',  color: '#e9710f', bg: '#e9710f' },
];

function ReactionPicker({ onReact }) {
  return (
    <div className="reaction-picker">
      {REACTIONS.map((r) => (
        <button
          key={r.key}
          className="reaction-picker-btn"
          title={r.label}
          onClick={(e) => { e.stopPropagation(); onReact(r); }}
          type="button"
        >
          <span className="reaction-picker-emoji">
            <FacebookEmoji type={r.key} size="sm" />
          </span>
          <span className="reaction-picker-label">{r.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function PostCard({ post, onDelete }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [reaction, setReaction] = useState(post.is_liked ? REACTIONS[0] : null);
  const [topReactions, setTopReactions] = useState(post.top_reactions || []);
  const [showPicker, setShowPicker] = useState(false);
  const pickerTimerRef = useRef(null);
  const pickerRef = useRef(null);
  const likeWrapRef = useRef(null);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [content, setContent] = useState(post.content || '');
  const [saving, setSaving] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const menuRef = useRef(null);

  // Likers (who reacted) — lazy loaded
  const [likers, setLikers] = useState(null);
  const [loadingLikers, setLoadingLikers] = useState(false);
  const [showLikersPopup, setShowLikersPopup] = useState(false);
  const [showLikersTooltip, setShowLikersTooltip] = useState(false);
  const likersTooltipTimerRef = useRef(null);
  const likersSummaryRef = useRef(null);

  useEffect(() => {
    const cls = 'post-lightbox-open';
    if (lightboxOpen) {
      document.body.classList.add(cls);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove(cls);
      document.body.style.overflow = '';
    }
    return () => {
      document.body.classList.remove(cls);
      document.body.style.overflow = '';
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen]);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target) &&
          likeWrapRef.current && !likeWrapRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  const handleLikeMouseEnter = useCallback(() => {
    pickerTimerRef.current = setTimeout(() => setShowPicker(true), 500);
  }, []);

  const handleLikeMouseLeave = useCallback(() => {
    clearTimeout(pickerTimerRef.current);
  }, []);

  const loadLikers = useCallback(async () => {
    if (likers !== null || loadingLikers) return;
    setLoadingLikers(true);
    try {
      const data = await getPostLikers(post.id, 50);
      setLikers(data);
    } catch (err) {
      console.error('Load likers error:', err.message);
      setLikers([]);
    } finally {
      setLoadingLikers(false);
    }
  }, [likers, loadingLikers, post.id]);

  const handleLikersSummaryEnter = useCallback(() => {
    likersTooltipTimerRef.current = setTimeout(() => {
      setShowLikersTooltip(true);
      loadLikers();
    }, 350);
  }, [loadLikers]);

  const handleLikersSummaryLeave = useCallback(() => {
    clearTimeout(likersTooltipTimerRef.current);
    setShowLikersTooltip(false);
  }, []);

  const handleLikersSummaryClick = useCallback(() => {
    clearTimeout(likersTooltipTimerRef.current);
    setShowLikersTooltip(false);
    loadLikers();
    setShowLikersPopup(true);
  }, [loadLikers]);

  // Cập nhật topReactions optimistically khi user thêm/xóa reaction
  const updateTopReactions = useCallback((addType, removeType) => {
    setTopReactions((prev) => {
      let next = [...prev];
      if (removeType) next = next.filter((t) => t !== removeType);
      if (addType && !next.includes(addType)) next = [addType, ...next].slice(0, 2);
      return next;
    });
  }, []);

  const handleReact = useCallback(async (r) => {
    setShowPicker(false);
    try {
      if (liked && reaction?.key === r.key) {
        // same reaction → unlike
        await unlikePost(post.id);
        setLiked(false);
        setReaction(null);
        setLikeCount((c) => c - 1);
        updateTopReactions(null, r.key);
      } else {
        // new like or reaction change — always call likePost (upsert)
        await likePost(post.id, r.key);
        if (!liked) setLikeCount((c) => c + 1);
        setLiked(true);
        setReaction(r);
        updateTopReactions(r.key, reaction?.key);
      }
      setLikers(null); // invalidate cache
    } catch (err) {
      console.error('Like error:', err.message);
    }
  }, [liked, reaction, post.id, updateTopReactions]);

  const handleLike = useCallback(async () => {
    setShowPicker(false);
    try {
      if (liked) {
        await unlikePost(post.id);
        setLiked(false);
        setReaction(null);
        setLikeCount((c) => c - 1);
        updateTopReactions(null, reaction?.key || 'like');
      } else {
        await likePost(post.id, 'like');
        setLiked(true);
        setReaction(REACTIONS[0]);
        setLikeCount((c) => c + 1);
        updateTopReactions('like', null);
      }
      setLikers(null); // invalidate cache
    } catch (err) {
      console.error('Like error:', err.message);
    }
  }, [liked, post.id]);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const handleEdit = () => {
    setShowMenu(false);
    setEditContent(content);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || saving) return;
    setSaving(true);
    try {
      await editPost(post.id, editContent.trim());
      setContent(editContent.trim());
      setEditing(false);
    } catch (err) {
      console.error('Edit error:', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditContent(content);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await deletePost(post.id);
      if (onDelete) onDelete(post.id);
    } catch (err) {
      console.error('Delete error:', err.message);
    } finally {
      setDeleting(false);
    }
  };

  const mediaUrl = post.media_url ? `${API_ORIGIN}${post.media_url}` : null;
  const w = post.media_width;
  const h = post.media_height;
  const hasRatio = w && h && w > 0 && h > 0;

  return (
    <>
      <div className="post-card fade-in">
        <div className="post-header">
          <Link to={`/profile_id=${post.user_id}`} className="post-avatar">
            <img src={post.user_avatar ? `${API_ORIGIN}${post.user_avatar}` : DEFAULT_AVATAR} alt="" />
          </Link>
          <div className="post-meta">
            <div className="post-username-line">
              <Link to={`/profile_id=${post.user_id}`} className="post-username">{post.username}</Link>
              {post.location_label && (
                <span className="post-location-inline">
                  {' '}đang ở <span className="post-location-inline-name">{post.location_label}</span>
                </span>
              )}
            </div>
            <span className="post-time">{timeAgo(post.created_at)}</span>
          </div>
          <div className="post-menu-wrap" ref={menuRef}>
            <button className="post-menu-btn" onClick={() => setShowMenu(!showMenu)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
            </button>
            {showMenu && (
              <div className="post-menu-dropdown">
                {user && user.id === post.user_id && (
                  <>
                    <button className="post-menu-item" onClick={handleEdit}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                      <span>Chỉnh sửa bài viết</span>
                    </button>
                    <button className="post-menu-item post-menu-item--danger" onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                      <span>Xóa bài viết</span>
                    </button>
                  </>
                )}
                <button className="post-menu-item" onClick={() => { setShowMenu(false); setShowShare(true); }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" /></svg>
                  <span>Chia sẻ</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <div className="post-edit-area">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="post-edit-input"
              autoFocus
            />
            <div className="post-edit-actions">
              <button className="post-edit-cancel" onClick={handleCancelEdit}>Hủy</button>
              <button className="post-edit-save" onClick={handleSaveEdit} disabled={!editContent.trim() || saving}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {(post.latitude != null && post.longitude != null) && (
              <div className="post-location-card">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${post.latitude},${post.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="post-location-map-link"
                  title="Mở chỉ đường trên Google Maps"
                >
                  <div className="post-location-map-wrap">
                    <iframe
                      title="Bản đồ vị trí"
                      className="post-location-map-iframe"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${post.longitude - 0.02},${post.latitude - 0.012},${post.longitude + 0.02},${post.latitude + 0.012}&layer=mapnik&marker=${post.latitude},${post.longitude}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="post-location-map-overlay">
                      <span className="post-location-map-overlay-hint">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
                        Xem chỉ đường
                      </span>
                    </div>
                  </div>
                </a>
                <div className="post-location-card-footer">
                  <div className="post-location-card-pin">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="#e41e3f">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                  </div>
                  <div className="post-location-card-info">
                    {post.location_label && (
                      <span className="post-location-card-name">{post.location_label}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {content && content !== '📷' && content !== '🎬' && (
              <p className="post-content">{renderTextWithMentions(content)}</p>
            )}
          </>
        )}

        {mediaUrl && post.media_type === 'video' && (
          <div className="post-media post-media--video">
            <VideoPlayer
              src={mediaUrl}
              style={hasRatio ? { aspectRatio: `${w} / ${h}` } : {}}
            />
          </div>
        )}

        {mediaUrl && post.media_type === 'image' && !imgError && (
          <div className="post-media post-media--image">
            <div
              className="post-media-ratio post-media-ratio--zoomable"
              style={hasRatio ? { paddingBottom: `${(h / w) * 100}%` } : {}}
              role="button"
              tabIndex={0}
              aria-label="Phóng to ảnh"
              onClick={() => setLightboxOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setLightboxOpen(true);
                }
              }}
            >
              <img
                src={mediaUrl}
                alt="Post media"
                loading="lazy"
                onError={() => setImgError(true)}
                style={hasRatio ? {} : { position: 'relative' }}
                draggable={false}
              />
            </div>
          </div>
        )}

        {/* Summary row */}
        {(likeCount > 0 || commentCount > 0) && (
          <div className="post-fb-summary">
            {likeCount > 0 && (
              <div
                className="post-fb-likes post-fb-likes--hoverable"
                ref={likersSummaryRef}
                onMouseEnter={handleLikersSummaryEnter}
                onMouseLeave={handleLikersSummaryLeave}
                onClick={handleLikersSummaryClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLikersSummaryClick(); }}
                aria-label="Xem ai đã bày tỏ cảm xúc"
              >
                <span className="post-fb-like-icons">
                  {topReactions.map((type, i) =>
                    type === 'like' ? (
                      <svg key={type} viewBox="0 0 16 16" width="18" height="18" fill="none" className={`post-fb-like-icon-item${i > 0 ? ' post-fb-like-icon-item--overlap' : ''}`}>
                        <defs>
                          <linearGradient id={`likeGrad${i}`} x1="2.4" y1="2.4" x2="13.6" y2="13.6" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#02ADFC" /><stop offset=".5" stopColor="#0866FF" /><stop offset="1" stopColor="#2B7EFF" />
                          </linearGradient>
                        </defs>
                        <circle cx="8" cy="8" r="8" fill={`url(#likeGrad${i})`} />
                        <path d="M7.3 3.87a.7.7 0 01.7-.7c.67 0 1.22.55 1.22 1.22v1.75a.1.1 0 00.1.1h1.8c.99 0 1.72.93 1.49 1.89l-.46 1.9a2.3 2.3 0 01-2.24 1.77H6.92a.58.58 0 01-.58-.58V7.74c0-.42.1-.83.28-1.2l.29-.57a3.69 3.69 0 00.39-1.65v-.45zM4.37 7a.77.77 0 00-.77.77v3.26c0 .42.34.77.77.77h.77a.38.38 0 00.38-.38V7.38A.38.38 0 005.13 7h-.77z" fill="#fff" />
                      </svg>
                    ) : (
                      <span key={type} className={`post-fb-like-icon-item post-fb-summary-emoji${i > 0 ? ' post-fb-like-icon-item--overlap' : ''}`}>
                        <FacebookEmoji type={type} size="xxs" />
                      </span>
                    )
                  )}
                  {topReactions.length === 0 && (
                    <svg viewBox="0 0 16 16" width="18" height="18" fill="none">
                      <defs>
                        <linearGradient id="likeGrad0" x1="2.4" y1="2.4" x2="13.6" y2="13.6" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#02ADFC" /><stop offset=".5" stopColor="#0866FF" /><stop offset="1" stopColor="#2B7EFF" />
                        </linearGradient>
                      </defs>
                      <circle cx="8" cy="8" r="8" fill="url(#likeGrad0)" />
                      <path d="M7.3 3.87a.7.7 0 01.7-.7c.67 0 1.22.55 1.22 1.22v1.75a.1.1 0 00.1.1h1.8c.99 0 1.72.93 1.49 1.89l-.46 1.9a2.3 2.3 0 01-2.24 1.77H6.92a.58.58 0 01-.58-.58V7.74c0-.42.1-.83.28-1.2l.29-.57a3.69 3.69 0 00.39-1.65v-.45zM4.37 7a.77.77 0 00-.77.77v3.26c0 .42.34.77.77.77h.77a.38.38 0 00.38-.38V7.38A.38.38 0 005.13 7h-.77z" fill="#fff" />
                    </svg>
                  )}
                </span>
                <span className="post-fb-like-count">{likeCount}</span>

                {showLikersTooltip && likers && likers.length > 0 && (
                  <div className="likers-tooltip">
                    <div className="likers-tooltip-avatars">
                      {likers.slice(0, 5).map((l) => (
                        <img
                          key={l.id}
                          className="likers-tooltip-avatar"
                          src={l.user_avatar ? `${API_ORIGIN}${l.user_avatar}` : '/default-avatar.png'}
                          alt={l.username}
                        />
                      ))}
                    </div>
                    <p className="likers-tooltip-names">
                      {likers.slice(0, 2).map((l) => l.username).join(', ')}
                      {likers.length > 2 && ` và ${likers.length - 2} người khác`}
                    </p>
                  </div>
                )}
              </div>
            )}
            {commentCount > 0 && (
              <button className="post-fb-comment-count" onClick={() => setShowComments(true)}>
                {commentCount} bình luận
              </button>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="post-fb-actions">
          <div
            className="post-fb-action-wrap"
            ref={likeWrapRef}
            onMouseEnter={handleLikeMouseEnter}
            onMouseLeave={handleLikeMouseLeave}
          >
            {showPicker && (
              <div ref={pickerRef}>
                <ReactionPicker onReact={handleReact} />
              </div>
            )}
            <button
              className={`post-fb-action${liked ? ' post-fb-action--liked' : ''}`}
              style={liked && reaction ? { color: reaction.color } : {}}
              onClick={handleLike}
              type="button"
            >
              {liked && reaction ? (
                <span className="post-fb-action-reaction-emoji">
                  <FacebookEmoji type={reaction.key} size="xs" />
                </span>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z"/>
                </svg>
              )}
              <span>{liked && reaction ? reaction.label : 'Thích'}</span>
            </button>
          </div>
          <button className="post-fb-action" onClick={() => setShowComments(true)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
            <span>Bình luận</span>
          </button>
          <button className="post-fb-action" onClick={() => setShowShare(true)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>Chia sẻ</span>
          </button>
        </div>
      </div>

      {showLikersPopup && (
        <ReactionDetailsPopup
          likers={likers ?? []}
          onClose={() => setShowLikersPopup(false)}
        />
      )}

      {showComments && (
        <CommentPopup
          post={post}
          onClose={() => setShowComments(false)}
          onCommentCountChange={(count) => setCommentCount(count)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Xóa bài viết"
          message="Bạn có chắc chắn muốn xóa bài viết này? Hành động này không thể hoàn tác."
          confirmText="Xóa"
          cancelText="Hủy"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showShare && (
        <SharePopup post={post} onClose={() => setShowShare(false)} />
      )}

      {lightboxOpen && mediaUrl && post.media_type === 'image' && (
        <PostImageLightbox
          post={post}
          mediaUrl={mediaUrl}
          onClose={() => setLightboxOpen(false)}
          liked={liked}
          likeCount={likeCount}
          onLike={handleLike}
          onCommentAdded={() => setCommentCount((c) => c + 1)}
          onShare={() => {
            setLightboxOpen(false);
            setShowShare(true);
          }}
        />
      )}
    </>
  );
}
