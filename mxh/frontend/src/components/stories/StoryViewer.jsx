import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { deleteStory } from '../../services/graphql';
import { timeAgo } from '../../utils/time';
import ConfirmDialog from '../ConfirmDialog';
import { API_ORIGIN } from '../../config';
const DEFAULT_AVATAR = '/default-avatar.png';
const IMAGE_DURATION = 10000;

export default function StoryViewer({ storyGroups, initialGroupIndex = 0, initialStoryIndex = 0, onClose, onStoryDeleted, onStoryViewed }) {
  const { user } = useAuth();
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoDuration, setVideoDuration] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const elapsedRef = useRef(0);
  const videoRef = useRef(null);

  const group = storyGroups[groupIdx];
  const story = group?.stories?.[storyIdx];
  const isOwn = user && story && user.id === story.user_id;
  const isVideo = story?.media_type === 'video';
  const totalStories = group?.stories?.length || 0;

  const goNext = useCallback(() => {
    if (!group) return;
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx(s => s + 1);
    } else if (groupIdx < storyGroups.length - 1) {
      setGroupIdx(g => g + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [group, storyIdx, groupIdx, storyGroups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx(s => s - 1);
    } else if (groupIdx > 0) {
      const prevGroup = storyGroups[groupIdx - 1];
      setGroupIdx(g => g - 1);
      setStoryIdx(prevGroup.stories.length - 1);
    }
  }, [storyIdx, groupIdx, storyGroups]);

  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    setVideoDuration(null);
  }, [storyIdx, groupIdx]);

  useEffect(() => {
    if (story && onStoryViewed) {
      onStoryViewed(story.id);
    }
  }, [story?.id]);

  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    const vid = videoRef.current;
    const onMeta = () => {
      setVideoDuration(vid.duration * 1000);
      vid.play().catch(() => {});
    };
    vid.addEventListener('loadedmetadata', onMeta);
    return () => vid.removeEventListener('loadedmetadata', onMeta);
  }, [isVideo, storyIdx, groupIdx]);

  const effectivePaused = paused || manualPause;

  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    if (effectivePaused) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [effectivePaused, isVideo]);

  useEffect(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted, isVideo]);

  useEffect(() => {
    if (!story || effectivePaused) return;
    if (isVideo && !videoDuration) return;

    const duration = isVideo ? videoDuration : IMAGE_DURATION;
    startRef.current = performance.now() - elapsedRef.current;

    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const pct = Math.min(elapsed / duration, 1);
      setProgress(pct);
      elapsedRef.current = elapsed;

      if (pct >= 1) {
        goNext();
        return;
      }
      timerRef.current = requestAnimationFrame(tick);
    };

    timerRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timerRef.current);
  }, [story, effectivePaused, goNext, isVideo, videoDuration, storyIdx, groupIdx]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, onClose]);

  const handleDeleteClick = () => {
    setManualPause(true);
    setShowDeleteConfirm(true);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setManualPause(false);
  };

  const handleDeleteConfirm = async () => {
    if (!story) return;
    setShowDeleteConfirm(false);
    try {
      await deleteStory(story.id);
      if (onStoryDeleted) onStoryDeleted(story.id);
      const remaining = group.stories.filter(s => s.id !== story.id);
      if (remaining.length === 0) {
        if (groupIdx < storyGroups.length - 1) {
          setStoryIdx(0);
        } else {
          onClose();
        }
      } else {
        setStoryIdx(Math.min(storyIdx, remaining.length - 1));
      }
    } catch (err) {
      console.error(err);
    }
    setManualPause(false);
  };

  if (!story) return null;

  const avatarSrc = story.user_avatar ? `${API_ORIGIN}${story.user_avatar}` : DEFAULT_AVATAR;
  const hasPrev = storyIdx > 0 || groupIdx > 0;
  const hasNext = storyIdx < totalStories - 1 || groupIdx < storyGroups.length - 1;

  return (
    <div className="sv-overlay" onClick={onClose}>
      <div className="sv-popup" onClick={(e) => e.stopPropagation()}>
        {/* Progress bars */}
        <div className="sv-progress-row">
          {group.stories.map((s, i) => (
            <div key={s.id} className="sv-progress-track">
              <div
                className="sv-progress-fill"
                style={{ width: i < storyIdx ? '100%' : i === storyIdx ? `${progress * 100}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="sv-popup-header">
          <div className="sv-user">
            <img src={avatarSrc} alt="" className="sv-avatar" />
            <div className="sv-user-info">
              <span className="sv-username">{story.username}</span>
              <span className="sv-time">{timeAgo(story.created_at)}</span>
            </div>
          </div>
          <div className="sv-actions">
            {/* Pause / Play */}
            <button className="sv-popup-btn" onClick={() => setManualPause(p => !p)} title={manualPause ? 'Tiếp tục' : 'Tạm dừng'}>
              {manualPause ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              )}
            </button>
            {/* Mute / Unmute */}
            <button className="sv-popup-btn" onClick={() => setMuted(m => !m)} title={muted ? 'Bật âm' : 'Tắt âm'}>
              {muted ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
              )}
            </button>
            {isOwn && (
              <button className="sv-popup-btn" onClick={handleDeleteClick} title="Xóa tin">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
              </button>
            )}
            <button className="sv-popup-btn" onClick={onClose} title="Đóng">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" /></svg>
            </button>
          </div>
        </div>

        {/* Media - hold to pause */}
        <div
          className="sv-popup-media"
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          {isVideo ? (
            <video
              ref={videoRef}
              key={`${groupIdx}-${storyIdx}`}
              src={`${API_ORIGIN}${story.media_url}`}
              className="sv-popup-img"
              playsInline
            />
          ) : (
            <img src={`${API_ORIGIN}${story.media_url}`} alt="" className="sv-popup-img" />
          )}
        </div>

        {/* Tap nav areas */}
        <div className="sv-tap sv-tap--left" onClick={goPrev}
          onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)} onMouseLeave={() => setPaused(false)}
        />
        <div className="sv-tap sv-tap--right" onClick={goNext}
          onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)} onMouseLeave={() => setPaused(false)}
        />

        {/* Side arrows */}
        {hasPrev && (
          <button className="sv-popup-arrow sv-popup-arrow--left" onClick={goPrev}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
          </button>
        )}
        {hasNext && (
          <button className="sv-popup-arrow sv-popup-arrow--right" onClick={goNext}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
          </button>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Xóa tin"
          message="Bạn có chắc chắn muốn xóa tin này? Hành động này không thể hoàn tác."
          confirmText="Xóa"
          cancelText="Hủy"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </div>
  );
}
