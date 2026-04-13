import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../hooks/useAuth';
import { getMyFriends } from '../services/graphql';
import { getOrCreateConversation } from '../services/chat';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function RightSidebar() {
  const { user } = useAuth();
  const { conversations, openChat, loadConversations, openChats } = useChat();
  const [friends, setFriends] = useState([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    getMyFriends().then(data => setFriends(data || [])).catch(e => console.error(e));
  }, [user]);

  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  const handleSearchToggle = () => { setSearching(s => !s); setQuery(''); };
  const handleSearchClose = () => { setSearching(false); setQuery(''); };

  // Merge: conversations first (they have online status), then friends not yet in convs
  const convUserIds = new Set(conversations.map(c => c.other_user_id));
  const friendContacts = friends
    .filter(f => !convUserIds.has(f.id))
    .map(f => ({
      _isFriendOnly: true,
      other_user_id: f.id,
      display_name: f.username,
      display_avatar: f.avatar,
      is_online: false,
    }));

  const sorted = [...conversations].sort((a, b) => {
    if (a.is_online && !b.is_online) return -1;
    if (!a.is_online && b.is_online) return 1;
    const ta = a.last_message_at || a.updated_at || '';
    const tb = b.last_message_at || b.updated_at || '';
    return tb.localeCompare(ta);
  });

  const allContacts = [...sorted, ...friendContacts];

  const contacts = query.trim()
    ? allContacts.filter(c =>
        (c.display_name || '').toLowerCase().includes(query.toLowerCase())
      )
    : allContacts;

  const handleClick = useCallback(async (contact) => {
    if (!contact._isFriendOnly) {
      openChat(contact);
      return;
    }
    try {
      const conv = await getOrCreateConversation(contact.other_user_id);
      await loadConversations();
      openChat(conv);
    } catch (e) {
      console.error('Không thể mở chat:', e);
    }
  }, [openChat, loadConversations]);

  const openAIChat = () => openChat({ id: '__ai__', isAI: true, display_name: 'Gemini AI' });

  if (!user || (conversations.length === 0 && friends.length === 0)) return null;

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
          </div>
        </div>
      )}

      {/* AI entry — luôn hiển thị đầu danh sách */}
      {!query.trim() && (
        <button type="button" className="rsb-contact rsb-contact--ai" onClick={openAIChat}>
          <div className="rsb-avatar-wrap">
            <div className="rsb-ai-avatar">
              <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
                <defs>
                  <linearGradient id="sidebarAiGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a855f7"/><stop offset="1" stopColor="#3b82f6"/>
                  </linearGradient>
                </defs>
                <circle cx="18" cy="18" r="18" fill="url(#sidebarAiGrad)"/>
                <path d="M18 9l1.8 5.5H25l-4.3 3.1 1.6 5.1L18 19.6l-4.3 3.1 1.6-5.1L11 14.5h5.2L18 9z" fill="white"/>
              </svg>
            </div>
            <span className="rsb-online-dot rsb-online-dot--ai" />
          </div>
          <div className="rsb-ai-info">
            <span className="rsb-name">Gemini AI</span>
            <span className="rsb-ai-sub">Trợ lý AI</span>
          </div>
        </button>
      )}

      <div className="rsb-list">
        {contacts.length === 0 && query.trim() && (
          <p className="rsb-no-result">Không tìm thấy "{query}"</p>
        )}
        {contacts.map((contact, i) => {
          const avatarSrc = contact.display_avatar
            ? `${API_ORIGIN}${contact.display_avatar}`
            : DEFAULT_AVATAR;
          const key = contact.id ?? `friend-${contact.other_user_id}`;
          return (
            <button
              type="button"
              key={key}
              className="rsb-contact"
              onClick={() => handleClick(contact)}
              title={contact.display_name}
            >
              <div className="rsb-avatar-wrap">
                <img
                  src={avatarSrc}
                  alt=""
                  className="rsb-avatar"
                  onError={e => { e.target.src = DEFAULT_AVATAR; }}
                />
                {contact.is_online && <span className="rsb-online-dot" />}
              </div>
              <span className="rsb-name">{contact.display_name}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
