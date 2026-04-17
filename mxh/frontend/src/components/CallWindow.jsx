import { useCall } from '../contexts/CallContext';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallWindow() {
  const { callState, peer, isMuted, callDuration, endCall, toggleMute } = useCall();

  // Show when calling out or connected
  if ((callState !== 'calling_out' && callState !== 'connected') || !peer) return null;

  const avatarSrc = peer.avatar ? `${API_ORIGIN}${peer.avatar}` : DEFAULT_AVATAR;
  const isConnected = callState === 'connected';

  return (
    <div className="call-window">
      <div className="cw-avatar">
        <img src={avatarSrc} alt={peer.username} />
        {!isConnected && <span className="cw-pulse" />}
      </div>

      <div className="cw-info">
        <span className="cw-name">{peer.username}</span>
        <span className="cw-status">
          {isConnected ? formatDuration(callDuration) : 'Đang kết nối...'}
        </span>
      </div>

      <div className="cw-actions">
        <button
          type="button"
          className={`cw-btn cw-btn--mute${isMuted ? ' cw-btn--active' : ''}`}
          onClick={toggleMute}
          aria-label={isMuted ? 'Bật mic' : 'Tắt mic'}
          title={isMuted ? 'Bật mic' : 'Tắt mic'}
        >
          {isMuted ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          )}
        </button>

        <button
          type="button"
          className="cw-btn cw-btn--end"
          onClick={endCall}
          aria-label="Cúp máy"
          title="Cúp máy"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
