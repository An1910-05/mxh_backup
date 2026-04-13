import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useChat } from '../../contexts/ChatContext';
import useNotificationUnread from '../../hooks/useNotificationUnread';
import usePendingFriendRequestsCount from '../../hooks/usePendingFriendRequestsCount';

function profileLink(user) {
  if (user.custom_url) return `/${user.custom_url}`;
  return `/profile_id=${user.id}`;
}

export default function MobileTabBar() {
  const { user } = useAuth();
  const { totalUnread } = useChat();
  const { count: notifUnread } = useNotificationUnread();
  const { count: pendingFriendRequests } = usePendingFriendRequestsCount();
  const location = useLocation();

  if (!user) return null;

  const tabs = [
    {
      path: '/',
      label: 'Trang chủ',
      match: (p) => p === '/',
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          {!active && <polyline points="9 22 9 12 15 12 15 22"/>}
        </svg>
      ),
    },
    {
      path: '/notifications',
      label: 'Thông báo',
      match: (p) => p.startsWith('/notifications'),
      badge: notifUnread,
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
      ),
    },
    {
      path: '/friends',
      label: 'Bạn bè',
      match: (p) => p.startsWith('/friends'),
      badge: pendingFriendRequests,
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/>
          <path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      ),
    },
    {
      path: '/chat',
      label: 'Tin nhắn',
      match: (p) => p.startsWith('/chat'),
      badge: totalUnread,
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
        </svg>
      ),
    },
    {
      path: profileLink(user),
      label: 'Cá nhân',
      match: (p) => (user.custom_url && p === `/${user.custom_url}`) || p.startsWith('/profile_id='),
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ];

  return (
    <nav className="m-tab-bar">
      {tabs.map((tab) => {
        const active = tab.match(location.pathname);
        const badge = typeof tab.badge === 'number' ? tab.badge : 0;
        return (
          <Link key={tab.path} to={tab.path} className={`m-tab-item${active?' m-tab-item--active':''}`}>
            <span className="m-tab-icon">
              {tab.icon(active)}
              {badge > 0 && <span className="m-tab-badge">{badge>99?'99+':badge}</span>}
            </span>
            <span className="m-tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
