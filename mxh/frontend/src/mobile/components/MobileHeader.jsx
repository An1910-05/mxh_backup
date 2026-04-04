import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function MobileHeader() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try { await logout(); } catch (err) { console.error(err); }
  };

  return (
    <header className="m-header">
      <Link to="/" className="m-header-brand">iPock</Link>
      <div className="m-header-actions">
        {user && (
          <Link to="/search" className="m-header-btn" aria-label="Tìm kiếm">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </Link>
        )}
        {user ? (
          <button type="button" onClick={handleLogout} className="m-header-btn" aria-label="Đăng xuất">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        ) : (
          <>
            <Link to="/login" className="m-header-link">Đăng nhập</Link>
            <Link to="/register" className="m-header-link m-header-link--primary">Đăng ký</Link>
          </>
        )}
      </div>
    </header>
  );
}
