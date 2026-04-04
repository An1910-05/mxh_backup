import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { resetPassword } from '../services/auth';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (!token) {
      setError('Token không hợp lệ. Hãy dùng link từ email.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mode="login"
      headline="Tạo mật khẩu mới cho tài khoản."
      subcopy="Nhập mật khẩu mới bạn muốn sử dụng."
    >
      <div className="auth-card auth-card--login">
        <div className="auth-card-head">
          <h2 className="auth-card-title">Đặt lại mật khẩu</h2>
          <p className="auth-card-subtitle">Nhập mật khẩu mới để tiếp tục.</p>
        </div>

        {error && <div className="apple-alert apple-alert-danger auth-alert" role="alert">{error}</div>}

        {success ? (
          <div className="auth-success-block">
            <div className="apple-alert apple-alert-success auth-alert">
              Mật khẩu đã được đặt lại thành công! Đang chuyển đến trang đăng nhập...
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="reset-password">Mật khẩu mới</label>
            <input
              id="reset-password"
              name="password"
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu mới"
              autoComplete="new-password"
              required
            />

            <label className="sr-only" htmlFor="reset-confirm">Xác nhận mật khẩu</label>
            <input
              id="reset-confirm"
              name="confirm"
              type="password"
              className="auth-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              autoComplete="new-password"
              required
            />

            <button type="submit" className="auth-submit auth-submit--primary" disabled={loading}>
              {loading ? <span className="apple-spinner" aria-hidden="true" /> : null}
              {loading ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}
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
