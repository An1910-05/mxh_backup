import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../hooks/useAuth';

const MONTHS = [
  'Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12',
];

function daysInMonth(month, year) {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const maxDay = daysInMonth(parseInt(birthMonth), parseInt(birthYear));
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let birthday = null;
    if (birthDay && birthMonth && birthYear) {
      birthday = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
    }

    try {
      await register(username, email, password, birthday, gender || null);
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

          {/* Birthday */}
          <div className="auth-field-group">
            <span className="auth-field-label">Ngày sinh</span>
            <div className="auth-birthday-row">
              <select
                className="auth-select"
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                aria-label="Ngày"
              >
                <option value="">Ngày</option>
                {days.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                className="auth-select"
                value={birthMonth}
                onChange={(e) => {
                  setBirthMonth(e.target.value);
                  const max = daysInMonth(parseInt(e.target.value), parseInt(birthYear));
                  if (parseInt(birthDay) > max) setBirthDay('');
                }}
                aria-label="Tháng"
              >
                <option value="">Tháng</option>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                className="auth-select"
                value={birthYear}
                onChange={(e) => {
                  setBirthYear(e.target.value);
                  const max = daysInMonth(parseInt(birthMonth), parseInt(e.target.value));
                  if (parseInt(birthDay) > max) setBirthDay('');
                }}
                aria-label="Năm"
              >
                <option value="">Năm</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Gender */}
          <div className="auth-field-group">
            <span className="auth-field-label">Giới tính</span>
            <div className="auth-gender-row">
              {[
                { value: 'female', label: 'Nữ' },
                { value: 'male', label: 'Nam' },
                { value: 'other', label: 'Khác' },
              ].map((g) => (
                <label key={g.value} className={`auth-gender-option${gender === g.value ? ' auth-gender-option--active' : ''}`}>
                  <input
                    type="radio"
                    name="gender"
                    value={g.value}
                    checked={gender === g.value}
                    onChange={(e) => setGender(e.target.value)}
                  />
                  <span>{g.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="auth-submit auth-submit--success" disabled={loading}>
            {loading ? <span className="apple-spinner" aria-hidden="true" /> : null}
            {loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
          </button>
        </form>

        <p className="auth-legal">
          Bằng cách nhấn "Tạo tài khoản", bạn đồng ý với quy ước cộng đồng và cách iPock xử lý thông tin để vận hành tài khoản của bạn.
        </p>

        <div className="auth-divider" />

        <div className="auth-actions auth-actions--center">
          <Link to="/login" className="auth-submit auth-submit--ghost auth-submit--compact">Đã có tài khoản?</Link>
        </div>
      </div>
    </AuthShell>
  );
}
