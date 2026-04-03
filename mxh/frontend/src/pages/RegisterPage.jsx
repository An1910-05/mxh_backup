import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await register(username, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mode="register"
      headline="Mở tài khoản mới và bắt đầu chia sẻ trên iPock."
      subcopy="Tham gia để theo dõi bạn bè, đăng trạng thái, nhắn tin theo thời gian thực và xây dựng cộng đồng của riêng bạn."
      footnote={<><strong>Kết nối ngay</strong> để không bỏ lỡ những cuộc trò chuyện, cập nhật và khoảnh khắc mới nhất.</>}
    >
      <div className="auth-card auth-card--register">
        <div className="auth-card-head">
          <h2 className="auth-card-title">Tạo tài khoản mới</h2>
          <p className="auth-card-subtitle">Nhanh chóng và dễ dàng.</p>
        </div>

        {error ? <div className="apple-alert apple-alert-danger auth-alert" role="alert">{error}</div> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="register-username">Tên người dùng</label>
          <input
            id="register-username"
            name="username"
            type="text"
            className="auth-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tên người dùng"
            autoComplete="username"
            spellCheck={false}
            required
          />

          <label className="sr-only" htmlFor="register-email">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            spellCheck={false}
            required
          />

          <label className="sr-only" htmlFor="register-password">Mật khẩu</label>
          <input
            id="register-password"
            name="password"
            type="password"
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu mới"
            autoComplete="new-password"
            required
          />

          <button type="submit" className="auth-submit auth-submit--success" disabled={loading}>
            {loading ? <span className="apple-spinner" aria-hidden="true" /> : null}
            {loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
          </button>
        </form>

        <p className="auth-legal">
          Bằng cách nhấn “Tạo tài khoản”, bạn đồng ý với quy ước cộng đồng và cách iPock xử lý thông tin để vận hành tài khoản của bạn.
        </p>

        <div className="auth-divider" />

        <div className="auth-actions auth-actions--center">
          <Link to="/login" className="auth-submit auth-submit--ghost auth-submit--compact">Đã có tài khoản?</Link>
        </div>
      </div>
    </AuthShell>
  );
}
