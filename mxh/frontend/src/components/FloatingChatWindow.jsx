import { useChat } from '../contexts/ChatContext';
import ChatWindow from './chat/ChatWindow';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';

function FloatingChatItem({ conv, index, total }) {
  const { closeChat, minimizeChat, conversations } = useChat();

  // Get latest conversation data (unread count, online status, etc.)
  const live = conversations.find(c => c.id === conv.id) || conv;

  // Position: stack from right, leave room for right sidebar (248px)
  const rightOffset = 248 + index * 328;

  const avatarSrc = live.display_avatar
    ? `${API_ORIGIN}${live.display_avatar}`
    : DEFAULT_AVATAR;

  return (
    <div
      className={`fcw${conv.minimized ? ' fcw--minimized' : ''}`}
      style={{ right: rightOffset }}
    >
      {/* Header */}
      <div className="fcw-header" onClick={() => minimizeChat(conv.id)}>
        <div className="fcw-header-left">
          <div className="fcw-avatar-wrap">
            <img
              src={avatarSrc}
              alt=""
              className="fcw-avatar"
              onError={e => { e.target.src = DEFAULT_AVATAR; }}
            />
            {live.is_online && <span className="fcw-online-dot" />}
          </div>
          <div className="fcw-header-info">
            <span className="fcw-name">{live.display_name}</span>
            {live.is_online && <span className="fcw-status">Đang hoạt động</span>}
          </div>
        </div>
        <div className="fcw-header-actions" onClick={e => e.stopPropagation()}>
          <button
            className="fcw-btn"
            title={conv.minimized ? 'Mở rộng' : 'Thu nhỏ'}
            onClick={() => minimizeChat(conv.id)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              {conv.minimized
                ? <path d="M7 14l5-5 5 5H7z" />
                : <path d="M7 10l5 5 5-5H7z" />}
            </svg>
          </button>
          <button
            className="fcw-btn"
            title="Đóng"
            onClick={() => closeChat(conv.id)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" />
            </svg>
          </button>
        </div>
        {!conv.minimized && live.unread_count > 0 && (
          <span className="fcw-unread">{live.unread_count}</span>
        )}
      </div>

      {/* Chat body */}
      {!conv.minimized && (
        <div className="fcw-body">
          <ChatWindow conversation={live} />
        </div>
      )}
    </div>
  );
}

export default function FloatingChatManager() {
  const { openChats } = useChat();

  if (!openChats.length) return null;

  return (
    <>
      {openChats.map((conv, i) => (
        <FloatingChatItem
          key={conv.id}
          conv={conv}
          index={i}
          total={openChats.length}
        />
      ))}
    </>
  );
}
