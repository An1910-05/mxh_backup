import { useState, useRef, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function RightSidebar() {
  const { conversations, openChat } = useChat();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (searching) {
      inputRef.current?.focus();
    }
  }, [searching]);

  const handleSearchToggle = () => {
    setSearching(s => !s);
    setQuery('');
  };

  const handleSearchClose = () => {
    setSearching(false);
    setQuery('');
  };

  // Sort: online first, then by last message time
  const sorted = [...conversations].sort((a, b) => {
    if (a.is_online && !b.is_online) return -1;
    if (!a.is_online && b.is_online) return 1;
    const ta = a.last_message_at || a.updated_at || '';
    const tb = b.last_message_at || b.updated_at || '';
    return tb.localeCompare(ta);
  });

  const contacts = query.trim()
    ? sorted.filter(c =>
        (c.display_name || '').toLowerCase().includes(query.toLowerCase())
      )
    : sorted;

  if (conversations.length === 0) return null;

  return (
    <aside className="right-sidebar">
      {searching ? (
        <div className="rsb-search-bar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="rsb-search-icon">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            ref={inputRef}
            className="rsb-search-input"
            placeholder="Tìm kiếm liên hệ..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && handleSearchClose()}
          />
          <button type="button" className="rsb-icon-btn" onClick={handleSearchClose} title="Đóng">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="rsb-header">
          <span className="rsb-title">Người liên hệ</span>
          <div className="rsb-header-actions">
            <button type="button" className="rsb-icon-btn" title="Tìm kiếm" onClick={handleSearchToggle}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
            </button>
            <button className="rsb-icon-btn" title="Tùy chọn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="rsb-list">
        {contacts.length === 0 && query.trim() && (
          <p className="rsb-no-result">Không tìm thấy "{query}"</p>
        )}
        {contacts.map(conv => {
          const avatarSrc = conv.display_avatar
            ? `${API_ORIGIN}${conv.display_avatar}`
            : DEFAULT_AVATAR;
          return (
            <button
              type="button"
              key={conv.id}
              className="rsb-contact"
              onClick={() => openChat(conv)}
              title={conv.display_name}
            >
              <div className="rsb-avatar-wrap">
                <img
                  src={avatarSrc}
                  alt=""
                  className="rsb-avatar"
                  onError={e => { e.target.src = DEFAULT_AVATAR; }}
                />
                {conv.is_online && <span className="rsb-online-dot" />}
              </div>
              <span className="rsb-name">{conv.display_name}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
