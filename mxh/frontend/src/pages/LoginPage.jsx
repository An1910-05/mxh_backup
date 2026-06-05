import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import AuthIntroSplash from '../components/AuthIntroSplash';
import AnimatedLoginFace from '../components/AnimatedLoginFace';
import { useAuth } from '../hooks/useAuth';
import { BorderBeam } from '../components/ui/border-beam';
import { ShimmerButton } from '../components/ui/shimmer-button';
import { MagicCard } from '../components/ui/magic-card';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const INTRO_SEEN_KEY = 'ipock_intro_seen';

// Chỉ phát intro nếu: chưa xem trong phiên này VÀ người dùng không bật "giảm chuyển động".
function shouldShowIntro() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) !== '1';
  } catch (err) {
    console.error(err);
    return false;
  }
}

function mapAuthError(message) {
  if (!message) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  if (message === 'account_banned') return 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.';
  if (message === 'Invalid credentials') return 'Email hoặc mật khẩu không chính xác.';
  if (message === 'User not found') return 'Không tìm thấy tài khoản với email này.';
  if (message === 'Email already exists') return 'Email này đã được đăng ký.';
  if (/network|fetch|failed to fetch/i.test(message)) return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  return message;
}

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

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBanned = searchParams.get('reason') === 'banned';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(shouldShowIntro);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const googleBtnRef = useRef(null);

  // Gấu che mắt khi đang focus ô mật khẩu.
  const faceCovering = passwordFocused;

  const handleIntroFinish = () => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch (err) {
      console.error(err);
    }
    setShowIntro(false);
  };

  // Google profile completion state
  const [googleCredential, setGoogleCredential] = useState(null);
  const [googleEmail, setGoogleEmail] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');

  const maxDay = daysInMonth(parseInt(birthMonth), parseInt(birthYear));
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleBtnRef.current?.offsetWidth || 320,
        text: 'signin_with',
        locale: 'vi',
      });
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogle();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  const handleGoogleResponse = async (response) => {
    setLoading(true);
    setError('');
    try {
      const data = await loginWithGoogle(response.credential);
      if (data.needs_profile) {
        setGoogleCredential(response.credential);
        setGoogleEmail(data.email || '');
        setLoading(false);
        return;
      }
      navigate('/');
    } catch (err) {
      setError(mapAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!birthDay || !birthMonth || !birthYear) {
      setError('Vui lòng chọn đầy đủ ngày sinh.');
      return;
    }
    if (!gender) {
      setError('Vui lòng chọn giới tính.');
      return;
    }

    setLoading(true);
    setError('');
    const birthday = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

    try {
      await loginWithGoogle(googleCredential, birthday, gender);
      navigate('/');
    } catch (err) {
      setError(mapAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(mapAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  // Show Google profile completion form
  if (googleCredential) {
    return (
      <AuthShell
        mode="register"
        headline="Hoàn tất đăng ký tài khoản Google"
        subcopy="Chỉ cần thêm vài thông tin nữa để bắt đầu sử dụng iPock."
      >
        <MagicCard
          className="auth-card auth-card--register auth-card--joly"
          gradientFrom="#42b72a"
          gradientTo="#1877f2"
          gradientColor="#82c4ff"
        >
          <BorderBeam size={220} duration={11} colorFrom="#42b72a" colorTo="#1877f2" />
          <div className="auth-card-head">
            <h2 className="auth-card-title auth-card-title--gradient">Thông tin cá nhân</h2>
            <p className="auth-card-subtitle">Đăng ký với {googleEmail}</p>
          </div>

          {error ? (
          <div className="apple-alert apple-alert-danger auth-alert" role="alert">
            <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

          <form className="auth-form" onSubmit={handleGoogleProfileSubmit}>
            <div className="auth-field-group">
              <span className="auth-field-label">Ngày sinh</span>
              <div className="auth-birthday-row">
                <select className="auth-select" value={birthDay} onChange={(e) => setBirthDay(e.target.value)} aria-label="Ngày">
                  <option value="">Ngày</option>
                  {days.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className="auth-select" value={birthMonth} onChange={(e) => {
                  setBirthMonth(e.target.value);
                  const max = daysInMonth(parseInt(e.target.value), parseInt(birthYear));
                  if (parseInt(birthDay) > max) setBirthDay('');
                }} aria-label="Tháng">
                  <option value="">Tháng</option>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select className="auth-select" value={birthYear} onChange={(e) => {
                  setBirthYear(e.target.value);
                  const max = daysInMonth(parseInt(birthMonth), parseInt(e.target.value));
                  if (parseInt(birthDay) > max) setBirthDay('');
                }} aria-label="Năm">
                  <option value="">Năm</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="auth-field-group">
              <span className="auth-field-label">Giới tính</span>
              <div className="auth-gender-row">
                {[
                  { value: 'female', label: 'Nữ' },
                  { value: 'male', label: 'Nam' },
                  { value: 'other', label: 'Khác' },
                ].map((g) => (
                  <label key={g.value} className={`auth-gender-option${gender === g.value ? ' auth-gender-option--active' : ''}`}>
                    <input type="radio" name="gender" value={g.value} checked={gender === g.value} onChange={(e) => setGender(e.target.value)} />
                    <span>{g.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <ShimmerButton
              type="submit"
              disabled={loading}
              background="linear-gradient(135deg, #42b72a, #1877f2)"
              className="auth-shimmer-submit"
            >
              {loading ? <span className="apple-spinner" aria-hidden="true" /> : null}
              {loading ? 'Đang tạo tài khoản…' : 'Hoàn tất đăng ký'}
            </ShimmerButton>
          </form>

          <div className="auth-divider" />
          <div className="auth-actions auth-actions--center">
            <button type="button" className="auth-submit auth-submit--ghost auth-submit--compact" onClick={() => { setGoogleCredential(null); setError(''); }}>
              Quay lại đăng nhập
            </button>
          </div>
        </MagicCard>
      </AuthShell>
    );
  }

  return (
    <>
      {showIntro && <AuthIntroSplash onFinish={handleIntroFinish} />}
      <AuthShell
      mode="login"
      headline="Kết nối với bạn bè và cộng đồng trên iPock."
      subcopy="iPock giúp bạn chia sẻ khoảnh khắc, trò chuyện thời gian thực và theo dõi mọi điều đang diễn ra quanh mình."
    >
      <AnimatedLoginFace covering={faceCovering} />

      <MagicCard
        className="auth-card auth-card--login auth-card--joly"
        gradientFrom="#1877f2"
        gradientTo="#9c40ff"
        gradientColor="#82c4ff"
      >
        <BorderBeam size={250} duration={10} colorFrom="#1877f2" colorTo="#9c40ff" />

        {isBanned && (
          <div className="apple-alert apple-alert-danger auth-alert auth-alert--banned" role="alert">
            <i className="bi bi-shield-lock-fill" aria-hidden="true" />
            <span>Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.</span>
          </div>
        )}

        {error && !isBanned ? (
          <div className="apple-alert apple-alert-danger auth-alert" role="alert">
            <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <form className="auth-form auth-form--stagger" onSubmit={handleSubmit}>
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
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            placeholder="Mật khẩu"
            autoComplete="current-password"
            required
          />

          <ShimmerButton
            type="submit"
            disabled={loading}
            background="linear-gradient(135deg, #1877f2, #4f46e5)"
            className="auth-shimmer-submit"
          >
            {loading ? <span className="apple-spinner" aria-hidden="true" /> : null}
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </ShimmerButton>
        </form>

        <p className="auth-link-row">
          <Link to="/forgot-password" className="auth-forgot-link">Quên mật khẩu?</Link>
        </p>

        <div className="auth-divider" />

        <div className="auth-actions auth-actions--center">
          <Link to="/register" className="auth-submit auth-submit--success auth-submit--compact">Tạo tài khoản mới</Link>
        </div>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="auth-divider-text">
              <span>hoặc</span>
            </div>
            <div className="auth-google-wrap" ref={googleBtnRef} />
          </>
        )}
      </MagicCard>

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
    </>
  );
}
