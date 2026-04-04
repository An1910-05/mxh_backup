import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { forgotPassword } from '../services/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resetLink, setResetLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const data = await forgotPassword(email);
      setSuccess(true);
      if (data?.reset_link) {
        setResetLink(data.reset_link);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mode="login"
      headline="Đặt lại mật khẩu của bạn."
      subcopy="Nhập email đăng ký để nhận link đặt lại mật khẩu."
    >
      <div className="auth-card auth-card--login">
        <div className="auth-card-head">
          <h2 className="auth-card-title">Quên mật khẩu?</h2>
          <p className="auth-card-subtitle">Nhập email để lấy lại quyền truy cập tài khoản.</p>
        </div>

        {error && <div className="apple-alert apple-alert-danger auth-alert" role="alert">{error}</div>}

        {success ? (
          <div className="auth-success-block">
            <div className="apple-alert apple-alert-success auth-alert">
              Nếu email tồn tại, link đặt lại mật khẩu đã được tạo.
            </div>
            {resetLink && (
              <div className="auth-reset-link-box">
                <p className="auth-reset-link-label">Link đặt lại mật khẩu (chế độ dev):</p>
                <a href={resetLink} className="auth-reset-link">{resetLink}</a>
              </div>
            )}
            <Link to="/login" className="auth-submit auth-submit--primary" style={{ marginTop: 16, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Quay về đăng nhập
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email của bạn"
              autoComplete="email"
              spellCheck={false}
              required
            />

            <button type="submit" className="auth-submit auth-submit--primary" disabled={loading}>
              {loading ? <span className="apple-spinner" aria-hidden="true" /> : null}
              {loading ? 'Đang gửi…' : 'Gửi link đặt lại'}
            </button>
          </form>
        )}

        <div className="auth-divider" />

        <div className="auth-actions auth-actions--center">
          <Link to="/login" className="auth-submit auth-submit--ghost auth-submit--compact">Quay về đăng nhập</Link>
        </div>
      </div>
    </AuthShell>
  );
}
