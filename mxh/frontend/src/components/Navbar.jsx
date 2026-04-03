import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../contexts/ChatContext';
import useNotificationUnread from '../hooks/useNotificationUnread';

function profileLink(user) {
  if (user.custom_url) return `/${user.custom_url}`;
  return `/profile_id=${user.id}`;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { totalUnread } = useChat();
  const { count: notifUnread } = useNotificationUnread();
  const location = useLocation();
  const containerRef = useRef(null);
  const linkRefs = useRef([]);

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
    if (p.startsWith('/chat')) return 4;
    if (user.custom_url && p === `/${user.custom_url}`) return 5;
    if (p.startsWith('/profile_id=')) return 5;
    return -1;
  }, [user, location.pathname]);

  const [pill, setPill] = useState({left:0,width:0,visible:false});
  const measurePill = useCallback(() => {
    const container = containerRef.current;
    if (!container || activeIndex < 0) { setPill({left:0,width:0,visible:false}); return; }
    const el = linkRefs.current[activeIndex];
    if (!el) { setPill({left:0,width:0,visible:false}); return; }
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPill({left:r.left-c.left, width:r.width, visible:true});
  }, [activeIndex]);

  useLayoutEffect(() => { measurePill(); }, [measurePill, location.pathname, totalUnread, notifUnread]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const ro = new ResizeObserver(() => measurePill());
    ro.observe(container);
    window.addEventListener('resize', measurePill);
    return () => { ro.disconnect(); window.removeEventListener('resize', measurePill); };
  }, [measurePill]);

  const setLinkRef = (index) => (el) => { linkRefs.current[index] = el; };
  const linkClass = (index) => `nav-item apple-nav-link ${activeIndex===index?'active':''}`.trim();
  const handleLogout = async () => { try { await logout(); } catch (err) { console.error(err); } };

  return (
    <nav className="apple-nav">
      <div className="apple-nav-inner">
        <Link to="/" className="apple-nav-brand">iPock</Link>
        <div className="apple-nav-links">
          {user ? (
            <>
              <div className="nav-container" ref={containerRef}>
                <div className="moving-bg" style={{left:pill.left, width:pill.width, opacity:pill.visible?1:0}} />
                <Link ref={setLinkRef(0)} to="/" className={linkClass(0)}>Trang chủ</Link>
                <Link ref={setLinkRef(1)} to="/notifications" className={`${linkClass(1)} chat-nav-link`}>
                  Thông báo
                  {notifUnread > 0 && <span className="nav-badge">{notifUnread>99?'99+':notifUnread}</span>}
                </Link>
                <Link ref={setLinkRef(2)} to="/search" className={linkClass(2)}>Tìm bạn</Link>
                <Link ref={setLinkRef(3)} to="/friends" className={linkClass(3)}>Bạn bè</Link>
                <Link ref={setLinkRef(4)} to="/chat" className={`${linkClass(4)} chat-nav-link`}>
                  Tin nhắn
                  {totalUnread > 0 && <span className="nav-badge">{totalUnread>99?'99+':totalUnread}</span>}
                </Link>
                <Link ref={setLinkRef(5)} to={profileLink(user)} className={linkClass(5)}>{user.username}</Link>
              </div>
              <button type="button" onClick={handleLogout} className="apple-nav-brand nav-logout">Đăng xuất</button>
            </>
          ) : (
            <>
              <Link to="/login" className={linkClass(0)}>Đăng nhập</Link>
              <Link to="/register" className={linkClass(1)}>Đăng ký</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
