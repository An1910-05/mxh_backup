import { useEffect, useRef } from 'react';
import { useCall } from '../contexts/CallContext';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function IncomingCallToast() {
  const { callState, peer, acceptCall, rejectCall } = useCall();
  const audioRef = useRef(null);

  useEffect(() => {
    if (callState === 'ringing_in') {
      if (!audioRef.current) {
        audioRef.current = new Audio('/ringtone.mp3');
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(() => {});
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [callState]);

  if (callState !== 'ringing_in' || !peer) return null;

  const avatarSrc = peer.avatar ? `${API_ORIGIN}${peer.avatar}` : DEFAULT_AVATAR;

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        {/* Avatar with pulse ring */}
        <div className="icm-avatar-wrap">
          <img className="icm-avatar" src={avatarSrc} alt={peer.username} />
          <span className="icm-pulse icm-pulse--1" />
          <span className="icm-pulse icm-pulse--2" />
        </div>

        {/* Info */}
        <div className="icm-info">
          <span className="icm-name">{peer.username}</span>
          <span className="icm-label">đang gọi cho bạn</span>
        </div>

        {/* Actions */}
        <div className="icm-actions">
          <div className="icm-action-group">
            <button
              type="button"
              className="icm-btn icm-btn--reject"
              onClick={rejectCall}
              aria-label="Từ chối"
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
            <span className="icm-action-label">Từ chối</span>
          </div>

          <div className="icm-action-group">
            <button
              type="button"
              className="icm-btn icm-btn--accept"
              onClick={acceptCall}
              aria-label="Chấp nhận"
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
            <span className="icm-action-label">Chấp nhận</span>
          </div>
        </div>
      </div>
    </div>
  );
}
