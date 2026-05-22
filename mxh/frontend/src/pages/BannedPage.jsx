import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function BannedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user && !user.is_blocked) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleGoLogin = () => {
    localStorage.removeItem('token');
    window.location.replace('/login');
  };

  return (
    <div className="banned-page">
      <div className="banned-card">
        <div className="banned-icon-wrap">
          <i className="bi bi-shield-lock-fill" aria-hidden="true" />
        </div>
        <h1 className="banned-title">Tài khoản đã bị khóa</h1>
        <p className="banned-desc">
          Tài khoản của bạn đã bị quản trị viên tạm khóa.<br />
          Vui lòng liên hệ admin để được hỗ trợ mở khóa.
        </p>
        <button type="button" className="banned-btn" onClick={handleGoLogin}>
          <i className="bi bi-box-arrow-left" aria-hidden="true" />
          Về trang đăng nhập
        </button>
      </div>
    </div>
  );
}
