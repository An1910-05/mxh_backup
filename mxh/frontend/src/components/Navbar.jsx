import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../contexts/ChatContext';
import useNotificationUnread from '../hooks/useNotificationUnread';
import usePendingFriendRequestsCount from '../hooks/usePendingFriendRequestsCount';
import useWeather from '../hooks/useWeather';
import NavInfoWidget from './NavInfoWidget';
import { API_ORIGIN } from '../config';
import searchIcon from '../assets/sf-symbols/magnifyingglass.png';
import shopIcon from '../assets/sf-symbols/bag.fill.png';

const DEFAULT_AVATAR = '/default-avatar.png';

function profileLink(user) {
  if (user.custom_url) return `/${user.custom_url}`;
  return `/profile_id=${user.id}`;
}

function isOwnProfilePath(user, pathname) {
  if (!user) return false;
  return pathname === profileLink(user);
}

export default function Navbar({ themeMode = 'light', onThemeChange }) {
  const { user, logout } = useAuth();
  const { totalUnread } = useChat();
  const { count: notifUnread } = useNotificationUnread();
  const { count: pendingFriendRequests } = usePendingFriendRequestsCount();
  const weather = useWeather();
  const location = useLocation();
  const containerRef = useRef(null);
  const linkRefs = useRef([]);
  const settingsRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeIndex = useMemo(() => {
    if (!user) {
      if (location.pathname === '/login') return 0;
      if (location.pathname === '/register') return 1;
      return -1;
    }
    const p = location.pathname;
    if (p === '/') return 0;
    if (p.startsWith('/notifications')) return 1;
    if (p.startsWith('/search')) return 2;
    if (p.startsWith('/friends')) return 3;
    if (p.startsWith('/shop')) return 4;
    if (p.startsWith('/chat')) return 5;
    return -1;
  }, [user, location.pathname]);

  const profileActive = useMemo(() => {
    return isOwnProfilePath(user, location.pathname);
  }, [user, location.pathname]);

  const [pill, setPill] = useState({ left: 0, width: 0, visible: false });
  const measurePill = useCallback(() => {
    const container = containerRef.current;
    if (!container || activeIndex < 0) {
      setPill({ left: 0, width: 0, visible: false });
      return;
    }
    const el = linkRefs.current[activeIndex];
    if (!el) {
      setPill({ left: 0, width: 0, visible: false });
      return;
    }
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPill({ left: r.left - c.left, width: r.width, visible: true });
  }, [activeIndex]);

  useLayoutEffect(() => {
    measurePill();
  }, [measurePill, location.pathname, totalUnread, notifUnread]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const ro = new ResizeObserver(() => measurePill());
    ro.observe(container);
    window.addEventListener('resize', measurePill);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measurePill);
    };
  }, [measurePill]);

  useEffect(() => {
    setSettingsOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!settingsOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!settingsRef.current?.contains(event.target)) {
        setSettingsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [settingsOpen]);

  const setLinkRef = (index) => (el) => {
    linkRefs.current[index] = el;
  };

  const linkClass = (index) => `nav-item apple-nav-link ${activeIndex === index ? 'active' : ''}`.trim();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error(err);
    }
  };

  const handleThemeSelect = (mode) => {
    onThemeChange?.(mode);
    setSettingsOpen(false);
  };

  return (
    <nav className="apple-nav">
      <div className="nav-weather" title={weather?.city || 'Thời tiết'}>
        {weather ? (
          <>
            <span className="nav-weather-icon">{weather.icon}</span>
            <span className="nav-weather-temp">{weather.temp}°C</span>
            {weather.city && <span className="nav-weather-city">{weather.city}</span>}
          </>
        ) : (
          <>
            <span className="nav-weather-icon">🌡️</span>
            <span className="nav-weather-city">Đang tải…</span>
          </>
        )}
      </div>
      {user && <NavInfoWidget />}
      <div className="apple-nav-inner">
        <Link to="/" className="apple-nav-brand">iPock</Link>
        {user ? (
          <>
            <div className="apple-nav-links">
              <div className="nav-container" ref={containerRef}>
                <div className="moving-bg" style={{ left: pill.left, width: pill.width, opacity: pill.visible ? 1 : 0 }} />
                <Link ref={setLinkRef(0)} to="/" className={linkClass(0)}>Trang chủ</Link>
                <Link ref={setLinkRef(1)} to="/notifications" className={`${linkClass(1)} nav-link-with-badge`}>
                  Thông báo
                  {notifUnread > 0 && <span className="nav-badge">{notifUnread > 99 ? '99+' : notifUnread}</span>}
                </Link>
                <Link
                  ref={setLinkRef(2)}
                  to="/search"
                  className={`${linkClass(2)} nav-item--icon`}
                  aria-label="Tìm bạn"
                  title="Tìm bạn"
                >
                  <span
                    className="nav-symbol-icon"
                    style={{ '--nav-symbol-icon': `url(${searchIcon})` }}
                    aria-hidden="true"
                  />
                </Link>
                <Link ref={setLinkRef(3)} to="/friends" className={`${linkClass(3)} nav-link-with-badge`}>
                  Bạn bè
                  {pendingFriendRequests > 0 && <span className="nav-badge">{pendingFriendRequests > 99 ? '99+' : pendingFriendRequests}</span>}
                </Link>
                <Link
                  ref={setLinkRef(4)}
                  to="/shop"
                  className={`${linkClass(4)} nav-item--icon`}
                  aria-label="Cửa hàng"
                  title="Cửa hàng"
                >
                  <span
                    className="nav-symbol-icon"
                    style={{ '--nav-symbol-icon': `url(${shopIcon})` }}
                    aria-hidden="true"
                  />
                </Link>
                <Link ref={setLinkRef(5)} to="/chat" className={`${linkClass(5)} nav-link-with-badge`}>
                  Tin nhắn
                  {totalUnread > 0 && <span className="nav-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>}
                </Link>
              </div>
            </div>

            <div className="nav-right-cluster">
              <div className="nav-profile-cluster">
                <Link
                  to={profileLink(user)}
                  className={`nav-profile-link${profileActive ? ' nav-profile-link--active' : ''}`}
                  aria-label={`Trang cá nhân của ${user.username}`}
                  title={user.username}
                >
                  <span className="nav-profile-avatar">
                    <img
                      src={user.avatar ? `${API_ORIGIN}${user.avatar}` : DEFAULT_AVATAR}
                      alt={user.username}
                    />
                  </span>
                </Link>

                <div className="nav-settings-wrap" ref={settingsRef}>
                  <button
                    type="button"
                    className={`nav-settings-link${settingsOpen ? ' nav-settings-link--active' : ''}`}
                    aria-label={`Cài đặt giao diện của ${user.username}`}
                    aria-expanded={settingsOpen}
                    aria-haspopup="dialog"
                    title="Cài đặt giao diện"
                    onClick={() => setSettingsOpen((prev) => !prev)}
                  >
                    <svg
                      className="nav-settings-icon"
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>

                  {settingsOpen && (
                    <div className="nav-settings-panel" role="dialog" aria-label="Cài đặt">

                      <div className="nav-settings-menu">
                        <Link
                          to="/settings"
                          className="nav-settings-menu-item"
                          style={{ '--i': 0 }}
                          onClick={() => setSettingsOpen(false)}
                        >
                          <span className="nav-settings-menu-icon" aria-hidden="true">
                            <i className="bi bi-gear-fill" />
                          </span>
                          <span>Cài đặt tài khoản</span>
                        </Link>
                      </div>

                      <div className="nav-settings-divider" />

                      <div className="nav-settings-panel-header">
                        <div className="nav-settings-panel-title">Giao diện</div>
                        <div className="nav-settings-panel-subtitle">Chọn kiểu hiển thị cho iPock</div>
                      </div>

                      <div className="nav-theme-options">
                        <button
                          type="button"
                          className={`nav-theme-option${themeMode === 'light' ? ' nav-theme-option--active' : ''}`}
                          aria-pressed={themeMode === 'light'}
                          onClick={() => handleThemeSelect('light')}
                        >
                          <span className="nav-theme-option-copy">
                            <span className="nav-theme-option-title">Light mode</span>
                            <span className="nav-theme-option-subtitle">Chế độ sáng</span>
                          </span>
                          <span className="nav-theme-swatch nav-theme-swatch--light" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          className={`nav-theme-option${themeMode === 'dark' ? ' nav-theme-option--active' : ''}`}
                          aria-pressed={themeMode === 'dark'}
                          onClick={() => handleThemeSelect('dark')}
                        >
                          <span className="nav-theme-option-copy">
                            <span className="nav-theme-option-title">Dark mode</span>
                            <span className="nav-theme-option-subtitle">Giao diện tối dịu mắt</span>
                          </span>
                          <span className="nav-theme-swatch nav-theme-swatch--dark" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="nav-settings-divider" />

                      <div className="nav-settings-menu">
                        <button
                          type="button"
                          className="nav-settings-menu-item nav-settings-logout"
                          style={{ '--i': 1 }}
                          onClick={handleLogout}
                        >
                          <span className="nav-settings-menu-icon" aria-hidden="true">
                            <i className="bi bi-box-arrow-right" />
                          </span>
                          <span>Đăng xuất</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <span />
            <div className="apple-nav-links">
              <Link to="/login" className={linkClass(0)}>Đăng nhập</Link>
              <Link to="/register" className={linkClass(1)}>Đăng ký</Link>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
