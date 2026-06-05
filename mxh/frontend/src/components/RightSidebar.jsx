import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../hooks/useAuth';
import { getMyFriends } from '../services/graphql';
import { getOrCreateConversation } from '../services/chat';
import geminiLogo from '../assets/gemini.svg';
import VerifiedBadge from './VerifiedBadge';
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

  // Glow loang theo chuột: ghi toạ độ con trỏ (px, so với panel) vào CSS var để radial-gradient bám theo
  const handleGlow = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--rsb-gx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--rsb-gy', `${e.clientY - r.top}px`);
  };

  // Merge: conversations first (they have online status), then friends not yet in convs
  const convUserIds = new Set(conversations.map(c => c.other_user_id));
  const friendContacts = friends
    .filter(f => !convUserIds.has(f.id))
    .map(f => ({
      _isFriendOnly: true,
      other_user_id: f.id,
      display_name: f.username,
      display_avatar: f.avatar,
      other_is_verified: !!f.is_verified,
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
    <aside className="right-sidebar" onMouseMove={handleGlow}>
      <div className="rsb-glow" aria-hidden="true" />
      <div className="rsb-scroll">
      {searching ? (
        <div className="rsb-search-bar">
          <i className="bi bi-search rsb-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="rsb-search-input"
            placeholder="Tìm kiếm liên hệ..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && handleSearchClose()}
          />
          <button type="button" className="rsb-icon-btn" onClick={handleSearchClose} title="Đóng">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="rsb-header">
          <span className="rsb-title">Người liên hệ</span>
          <div className="rsb-header-actions">
            <button type="button" className="rsb-icon-btn" title="Tìm kiếm" onClick={handleSearchToggle}>
              <i className="bi bi-search" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* AI entry — luôn hiển thị đầu danh sách */}
      {!query.trim() && (
        <button type="button" className="rsb-contact rsb-contact--ai" onClick={openAIChat}>
          <div className="rsb-avatar-wrap">
            <div className="rsb-ai-avatar">
              <img src={geminiLogo} width="36" height="36" alt="Gemini" />
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
              <span className="rsb-name">
                {contact.display_name}
                {contact.other_is_verified && (
                  <VerifiedBadge isVerified ownerId={contact.other_user_id} size={12} />
                )}
              </span>
            </button>
          );
        })}
      </div>
      </div>
    </aside>
  );
}
