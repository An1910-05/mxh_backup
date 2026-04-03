import { useState, useEffect, useRef } from 'react';
import { getMyFriends } from '../services/graphql';
import { getOrCreateConversation, sendMessageRest } from '../services/chat';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function SharePopup({ post, onClose }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState({});
  const [sent, setSent] = useState({});
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef(null);

  const postUrl = `${window.location.origin}/post/${post.id}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getMyFriends();
        if (!cancelled) setFriends(list || []);
      } catch (err) {
        console.error('Failed to load friends:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = postUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendToFriend = async (friendId) => {
    if (sending[friendId] || sent[friendId]) return;
    setSending((p) => ({ ...p, [friendId]: true }));
    try {
      const conv = await getOrCreateConversation(friendId);
      const shareText = post.content && post.content !== '📷' && post.content !== '🎬'
        ? `[Chia sẻ bài viết] ${post.content}\n${postUrl}`
        : `[Chia sẻ bài viết] ${postUrl}`;
      await sendMessageRest(conv.id, shareText);
      setSent((p) => ({ ...p, [friendId]: true }));
    } catch (err) {
      console.error('Share error:', err);
    } finally {
      setSending((p) => ({ ...p, [friendId]: false }));
    }
  };

  return (
    <div className="share-overlay" ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="share-popup">
        <div className="share-header">
          <h3 className="share-title">Gửi bằng Message</h3>
          <button className="share-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" /></svg>
          </button>
        </div>

        <div className="share-body">
          {/* Copy link */}
          <button className="share-copy-link" onClick={handleCopyLink}>
            <div className="share-copy-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
              </svg>
            </div>
            <span className="share-copy-text">{copied ? 'Đã sao chép!' : 'Sao chép liên kết'}</span>
          </button>

          {/* Friends list */}
          {loading ? (
            <div className="share-loading">
              <span className="apple-spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : friends.length === 0 ? (
            <div className="share-empty">Chưa có bạn bè nào</div>
          ) : (
            <div className="share-friends">
              {friends.map((friend) => (
                <div key={friend.id} className="share-friend">
                  <img
                    className="share-friend-avatar"
                    src={friend.avatar ? `${API_ORIGIN}${friend.avatar}` : DEFAULT_AVATAR}
                    alt=""
                  />
                  <span className="share-friend-name">{friend.username}</span>
                  <button
                    className={`share-send-btn${sent[friend.id] ? ' share-send-btn--sent' : ''}`}
                    onClick={() => handleSendToFriend(friend.id)}
                    disabled={sending[friend.id] || sent[friend.id]}
                  >
                    {sending[friend.id] ? (
                      <span className="apple-spinner" style={{ width: 14, height: 14 }} />
                    ) : sent[friend.id] ? 'Đã gửi' : 'Gửi'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
