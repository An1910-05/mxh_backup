import { useState, useRef, useEffect, useCallback } from 'react';

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ src, style, className }) {
  const videoRef = useRef(null);
  const progressRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimer = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const getVid = useCallback(() => videoRef.current, []);

  const togglePlay = useCallback(() => {
    const vid = getVid();
    if (!vid) return;
    if (vid.paused) {
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          vid.muted = true;
          setMuted(true);
          vid.play().catch(() => {});
        });
      }
      setPlaying(true);
    } else {
      vid.pause();
      setPlaying(false);
    }
  }, [getVid]);

  const toggleMute = useCallback(() => {
    const vid = getVid();
    if (!vid) return;
    vid.muted = !vid.muted;
    setMuted(vid.muted);
  }, [getVid]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    const vid = getVid();
    if (!el) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (vid?.webkitEnterFullscreen) vid.webkitEnterFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }, [getVid]);

  const seekFromEvent = useCallback((clientX) => {
    const vid = getVid();
    if (!vid || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    vid.currentTime = pct * vid.duration;
    setCurrentTime(vid.currentTime);
  }, [getVid]);

  const handleSeek = useCallback((e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    seekFromEvent(clientX);
  }, [seekFromEvent]);

  const handleVolumeChange = useCallback((e) => {
    const vid = getVid();
    if (!vid) return;
    const val = parseFloat(e.target.value);
    vid.volume = val;
    vid.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  }, [getVid]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      if (v.buffered.length > 0) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    };
    const onLoaded = () => setDuration(v.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setShowControls(true); };
    const onEnded = () => { setPlaying(false); setShowControls(true); };
    const onFsChange = () =>
      setFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));

    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  useEffect(() => {
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    } else {
      setShowControls(true);
      clearTimeout(hideTimer.current);
    }
    return () => clearTimeout(hideTimer.current);
  }, [playing]);

  // Mouse + touch drag for seeking
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      seekFromEvent(clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
  }, [dragging, seekFromEvent]);

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const bufferPct = duration ? (buffered / duration) * 100 : 0;

  /* Reserve space before metadata loads (esp. iOS Safari); PostCard can override via style */
  const containerStyle =
    style && Object.keys(style).length > 0
      ? style
      : { aspectRatio: '16 / 9' };

  const handleProgressStart = (e) => {
    e.preventDefault();
    handleSeek(e);
    setDragging(true);
  };

  return (
    <div
      ref={containerRef}
      className={`vp-container ${fullscreen ? 'vp-container--fs' : ''} ${className || ''}`}
      style={containerStyle}
      onMouseMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
    >
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        onClick={togglePlay}
        className="vp-video"
        muted
      />

      {!playing && (
        <button className="vp-big-play" onClick={togglePlay}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
        </button>
      )}

      <div className={`vp-controls ${showControls ? 'vp-controls--show' : ''}`}>
        <div
          ref={progressRef}
          className="vp-progress"
          onMouseDown={handleProgressStart}
          onTouchStart={handleProgressStart}
        >
          <div className="vp-progress-buffer" style={{ width: `${bufferPct}%` }} />
          <div className="vp-progress-fill" style={{ width: `${progress}%` }}>
            <div className="vp-progress-thumb" />
          </div>
        </div>

        <div className="vp-bar">
          <button className="vp-btn" onClick={togglePlay}>
            {playing ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M6 4h4v16H6zm8 0h4v16h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>

          <div className="vp-volume-group">
            <button className="vp-btn" onClick={toggleMute}>
              {muted || volume === 0 ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
              ) : volume < 0.5 ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="vp-volume-slider"
              style={{
                background: `linear-gradient(to right, rgba(255,255,255,0.85) ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.25) ${(muted ? 0 : volume) * 100}%)`
              }}
            />
          </div>

          <span className="vp-time">{formatTime(currentTime)} / {formatTime(duration)}</span>

          <div className="vp-spacer" />

          <button className="vp-btn" onClick={toggleFullscreen}>
            {fullscreen ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
