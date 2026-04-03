import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mode="login"
      headline="Kết nối với bạn bè và cộng đồng trên iPock."
      subcopy="iPock giúp bạn chia sẻ khoảnh khắc, trò chuyện thời gian thực và theo dõi mọi điều đang diễn ra quanh mình."
      footnote={<><strong>Tạo Trang</strong> cho cộng đồng, thương hiệu hoặc doanh nghiệp của bạn trên iPock.</>}
    >
      <div className="auth-card auth-card--login">
        {error ? <div className="apple-alert apple-alert-danger auth-alert" role="alert">{error}</div> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="login-email">Email</label>
          <input
            id="login-email"
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

          <label className="sr-only" htmlFor="login-password">Mật khẩu</label>
          <input
            id="login-password"
            name="password"
            type="password"
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            autoComplete="current-password"
            required
          />

          <button type="submit" className="auth-submit auth-submit--primary" disabled={loading}>
            {loading ? <span className="apple-spinner" aria-hidden="true" /> : null}
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>

        <p className="auth-link-row">Quên mật khẩu? Tính năng này sẽ sớm có mặt.</p>

        <div className="auth-divider" />

        <div className="auth-actions auth-actions--center">
          <Link to="/register" className="auth-submit auth-submit--success auth-submit--compact">Tạo tài khoản mới</Link>
        </div>
      </div>

      <div className="auth-demo">
        Dùng thử:
        {' '}
        <code>alice@example.com</code>
        {' / '}
        <code>bob@example.com</code>
        {' '}
        với mật khẩu
        {' '}
        <code>password123</code>
      </div>
    </AuthShell>
  );
}
