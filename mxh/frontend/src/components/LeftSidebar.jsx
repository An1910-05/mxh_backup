import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';

function profileLink(user) {
  if (user.custom_url) return `/${user.custom_url}`;
  return `/profile_id=${user.id}`;
}

const MENU_ITEMS = [
  {
    key: 'home',
    path: '/',
    label: 'Trang chủ',
    match: (p) => p === '/',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    key: 'friends',
    path: '/friends',
    label: 'Bạn bè',
    match: (p) => p.startsWith('/friends'),
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
        <path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    key: 'chat',
    path: '/chat',
    label: 'Tin nhắn',
    match: (p) => p.startsWith('/chat'),
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
      </svg>
    ),
  },
];

const EXPLORE_ITEMS = [
  {
    key: 'games',
    path: '/games',
    label: 'Trò chơi',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <line x1="6" y1="12" x2="10" y2="12"/>
        <line x1="8" y1="10" x2="8" y2="14"/>
        <circle cx="16" cy="10" r="1" fill="currentColor"/>
        <circle cx="18" cy="12" r="1" fill="currentColor"/>
      </svg>
    ),
    match: (p) => p.startsWith('/games'),
  },
];

export default function LeftSidebar() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  return (
    <aside className="left-sidebar">
      {/* Profile shortcut */}
      <Link to={profileLink(user)} className={`lsb-item lsb-profile${location.pathname === profileLink(user) ? ' lsb-item--active' : ''}`}>
        <span className="lsb-avatar">
          <img src={user.avatar ? `${API_ORIGIN}${user.avatar}` : DEFAULT_AVATAR} alt="" />
        </span>
        <span className="lsb-label">{user.username}</span>
      </Link>

      {/* Menu items */}
      {MENU_ITEMS.map((item) => (
        <Link
          key={item.key}
          to={item.path}
          className={`lsb-item${item.match(location.pathname) ? ' lsb-item--active' : ''}`}
        >
          <span className="lsb-icon">{item.icon}</span>
          <span className="lsb-label">{item.label}</span>
        </Link>
      ))}

      <div className="lsb-divider" />

      {/* Explore section */}
      <div className="lsb-section-title">Khám phá</div>

      {EXPLORE_ITEMS.map((item) => (
        <Link
          key={item.key}
          to={item.path}
          className={`lsb-item${item.match(location.pathname) ? ' lsb-item--active' : ''}`}
        >
          <span className="lsb-icon">{item.icon}</span>
          <span className="lsb-label">{item.label}</span>
        </Link>
      ))}
    </aside>
  );
}
