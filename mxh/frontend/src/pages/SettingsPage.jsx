import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { getSettings, changePassword, updateSettingsProfile, getBalance } from '../services/auth';
import { setPrivacy as setPrivacyApi } from '../services/graphql';
import { BorderBeam } from '@/components/ui/border-beam';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { MagicCard } from '@/components/ui/magic-card';
import { Meteors } from '@/components/ui/meteors';
import { NumberCounter } from '@/components/ui/number-counter';

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

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('general');

  const [username, setUsername] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [balance, setBalance] = useState(null);

  const [isPrivate, setIsPrivate] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState('');
  const [privacyErr, setPrivacyErr] = useState('');

  const maxDay = daysInMonth(parseInt(birthMonth), parseInt(birthYear));
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSettings();
        setSettings(data);
        setUsername(data.username || '');
        setGender(data.gender || '');
        setIsPrivate(!!data.is_private);
        if (data.birthday) {
          const parts = data.birthday.split('-');
          setBirthYear(parts[0] || '');
          setBirthMonth(String(parseInt(parts[1])) || '');
          setBirthDay(String(parseInt(parts[2])) || '');
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadBalance = async () => {
      try {
        const data = await getBalance();
        setBalance(data.balance || 0);
      } catch (err) {
        console.error('Failed to load balance:', err);
      }
    };
    loadBalance();
    window.addEventListener('mxh-wallet-refresh', loadBalance);
    return () => window.removeEventListener('mxh-wallet-refresh', loadBalance);
  }, [user]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg('');
    setProfileErr('');

    let birthday = null;
    if (birthDay && birthMonth && birthYear) {
      birthday = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
    }

    try {
      const result = await updateSettingsProfile({
        username,
        birthday,
        gender: gender || null,
      });
      setProfileMsg('Đã cập nhật thông tin cá nhân.');
      if (result.user) setSettings((prev) => ({ ...prev, ...result.user }));
    } catch (err) {
      setProfileErr(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPwLoading(true);
    setPwMsg('');
    setPwErr('');

    if (newPw.length < 6) {
      setPwErr('Mật khẩu mới phải có ít nhất 6 ký tự.');
      setPwLoading(false);
      return;
    }
    if (newPw !== confirmPw) {
      setPwErr('Mật khẩu xác nhận không khớp.');
      setPwLoading(false);
      return;
    }

    try {
      await changePassword(currentPw || null, newPw);
      setPwMsg('Mật khẩu đã được cập nhật thành công.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setSettings((prev) => ({ ...prev, has_password: true }));
    } catch (err) {
      setPwErr(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  const handlePrivacyToggle = async (nextPrivate) => {
    if (privacyLoading || nextPrivate === isPrivate) return;
    setPrivacyLoading(true);
    setPrivacyMsg('');
    setPrivacyErr('');
    const prev = isPrivate;
    setIsPrivate(nextPrivate); // optimistic
    try {
      const result = await setPrivacyApi(nextPrivate);
      setIsPrivate(!!result.is_private);
      setSettings((s) => ({ ...s, is_private: result.is_private ? 1 : 0 }));
      setPrivacyMsg(nextPrivate
        ? 'Đã chuyển sang chế độ riêng tư. Chỉ bạn bè mới xem được trang cá nhân của bạn.'
        : 'Đã chuyển sang chế độ công khai. Mọi người đều xem được trang cá nhân của bạn.');
    } catch (err) {
      setIsPrivate(prev); // rollback
      setPrivacyErr(err.message || 'Không thể cập nhật chế độ riêng tư.');
    } finally {
      setPrivacyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading"><span className="apple-spinner" /></div>
      </div>
    );
  }

  const sections = [
    { key: 'general',  label: 'Thông tin chung',   icon: 'bi-person-gear',      hint: 'Hồ sơ cá nhân' },
    { key: 'privacy',  label: 'Quyền riêng tư',    icon: 'bi-shield-lock',      hint: 'Công khai / Riêng tư' },
    { key: 'password', label: 'Mật khẩu & Bảo mật', icon: 'bi-shield-lock-fill', hint: 'Xác thực tài khoản' },
    { key: 'wallet',   label: 'Ví tiền',           icon: 'bi-wallet2',          hint: 'Số dư & nạp tiền' },
  ];

  const activeMeta = sections.find((s) => s.key === activeSection);

  return (
    <div className="settings-page settings-page--v2">
      {/* Ambient background blobs */}
      <div className="settings-bg" aria-hidden="true">
        <span className="settings-bg-blob settings-bg-blob--1" />
        <span className="settings-bg-blob settings-bg-blob--2" />
        <span className="settings-bg-blob settings-bg-blob--3" />
      </div>

      <div className="settings-shell">
        {/* Header strip */}
        <header className="settings-hero">
          <div className="settings-hero-text">
            <span className="settings-hero-eyebrow">
              <i className="bi bi-sliders2" /> Cài đặt tài khoản
            </span>
            <h1 className="settings-hero-title">Tùy chỉnh trải nghiệm iPock của bạn</h1>
            <p className="settings-hero-sub">
              Cập nhật hồ sơ, bảo mật và quản lý ví tiền chỉ trong một nơi.
            </p>
          </div>
          <div className="settings-hero-meta">
            <i className="bi bi-stars settings-hero-icon" />
          </div>
        </header>

        <div className="settings-container settings-container--v2">
          {/* Sidebar */}
          <aside className="settings-sidebar settings-sidebar--v2">
            <div className="settings-sidebar-head">
              <span className="settings-sidebar-kicker">
                <i className="bi bi-grid-1x2-fill" /> Danh mục
              </span>
              <h2 className="settings-sidebar-title">Cài đặt</h2>
            </div>

            <nav className="settings-nav settings-nav--v2">
              {sections.map((s, idx) => {
                const isActive = activeSection === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`settings-nav-item settings-nav-item--v2${isActive ? ' is-active' : ''}`}
                    onClick={() => setActiveSection(s.key)}
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <span className="settings-nav-iconbox" aria-hidden="true">
                      <i className={`bi ${s.icon}`} />
                    </span>
                    <span className="settings-nav-textwrap">
                      <span className="settings-nav-label">{s.label}</span>
                      <span className="settings-nav-hint">{s.hint}</span>
                    </span>
                    <i className="bi bi-chevron-right settings-nav-chev" />
                    {isActive && (
                      <BorderBeam
                        size={140}
                        duration={9}
                        colorFrom="#1877f2"
                        colorTo="#a855f7"
                        borderWidth={1.5}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

          </aside>

          {/* Content */}
          <main className="settings-content settings-content--v2">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeSection === 'general' && (
                  <SectionGeneral
                    settings={settings}
                    username={username}
                    setUsername={setUsername}
                    birthDay={birthDay}
                    setBirthDay={setBirthDay}
                    birthMonth={birthMonth}
                    setBirthMonth={setBirthMonth}
                    birthYear={birthYear}
                    setBirthYear={setBirthYear}
                    gender={gender}
                    setGender={setGender}
                    days={days}
                    profileMsg={profileMsg}
                    profileErr={profileErr}
                    profileLoading={profileLoading}
                    handleProfileSave={handleProfileSave}
                  />
                )}

                {activeSection === 'privacy' && (
                  <SectionPrivacy
                    isPrivate={isPrivate}
                    privacyLoading={privacyLoading}
                    privacyMsg={privacyMsg}
                    privacyErr={privacyErr}
                    onToggle={handlePrivacyToggle}
                  />
                )}

                {activeSection === 'password' && (
                  <SectionPassword
                    settings={settings}
                    currentPw={currentPw}
                    setCurrentPw={setCurrentPw}
                    newPw={newPw}
                    setNewPw={setNewPw}
                    confirmPw={confirmPw}
                    setConfirmPw={setConfirmPw}
                    pwMsg={pwMsg}
                    pwErr={pwErr}
                    pwLoading={pwLoading}
                    handlePasswordSave={handlePasswordSave}
                  />
                )}

                {activeSection === 'wallet' && <SectionWallet balance={balance} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}

/* ────────────── Section: General ────────────── */
function SectionGeneral({
  settings, username, setUsername,
  birthDay, setBirthDay, birthMonth, setBirthMonth, birthYear, setBirthYear,
  gender, setGender, days,
  profileMsg, profileErr, profileLoading, handleProfileSave,
}) {
  return (
    <div className="settings-section settings-section--v2">
      <SectionHeader
        icon="bi-person-gear"
        title="Thông tin cá nhân"
        desc="Quản lý thông tin cơ bản hiển thị trên hồ sơ iPock của bạn."
      />

      {profileMsg && (
        <div className="settings-toast settings-toast--success">
          <i className="bi bi-check-circle-fill" /> {profileMsg}
        </div>
      )}
      {profileErr && (
        <div className="settings-toast settings-toast--danger">
          <i className="bi bi-exclamation-triangle-fill" /> {profileErr}
        </div>
      )}

      <form className="settings-form settings-form--v2" onSubmit={handleProfileSave}>
        <FieldRow
          icon="bi-envelope-at-fill"
          label="Email"
          hint="Email không thể thay đổi"
        >
          <input
            id="settings-email"
            type="email"
            className="settings-input settings-input--v2"
            value={settings?.email || ''}
            disabled
          />
        </FieldRow>

        <FieldRow icon="bi-at" label="Tên người dùng">
          <input
            id="settings-username"
            type="text"
            className="settings-input settings-input--v2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nhập tên hiển thị"
          />
        </FieldRow>

        <FieldRow icon="bi-cake2-fill" label="Ngày sinh">
          <div className="auth-birthday-row">
            <select className="auth-select" value={birthDay} onChange={(e) => setBirthDay(e.target.value)}>
              <option value="">Ngày</option>
              {days.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="auth-select" value={birthMonth} onChange={(e) => {
              setBirthMonth(e.target.value);
              const max = daysInMonth(parseInt(e.target.value), parseInt(birthYear));
              if (parseInt(birthDay) > max) setBirthDay('');
            }}>
              <option value="">Tháng</option>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="auth-select" value={birthYear} onChange={(e) => {
              setBirthYear(e.target.value);
              const max = daysInMonth(parseInt(birthMonth), parseInt(e.target.value));
              if (parseInt(birthDay) > max) setBirthDay('');
            }}>
              <option value="">Năm</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </FieldRow>

        <FieldRow icon="bi-gender-ambiguous" label="Giới tính">
          <div className="settings-gender-row">
            {[
              { value: 'female', label: 'Nữ',  icon: 'bi-gender-female' },
              { value: 'male',   label: 'Nam',  icon: 'bi-gender-male' },
              { value: 'other',  label: 'Khác', icon: 'bi-gender-ambiguous' },
            ].map((g) => (
              <label
                key={g.value}
                className={`settings-gender-chip${gender === g.value ? ' is-active' : ''}`}
              >
                <input
                  type="radio"
                  name="gender"
                  value={g.value}
                  checked={gender === g.value}
                  onChange={(e) => setGender(e.target.value)}
                />
                <i className={`bi ${g.icon}`} />
                <span>{g.label}</span>
              </label>
            ))}
          </div>
        </FieldRow>

        {settings?.has_google && (
          <FieldRow icon="bi-link-45deg" label="Liên kết">
            <span className="settings-link-badge">
              <i className="bi bi-google" /> Google đã liên kết
              <i className="bi bi-patch-check-fill settings-link-check" />
            </span>
          </FieldRow>
        )}

        <div className="settings-actions settings-actions--v2">
          <ShimmerButton
            type="submit"
            disabled={profileLoading}
            background="linear-gradient(135deg, #1877f2 0%, #6366f1 50%, #a855f7 100%)"
          >
            {profileLoading ? (
              <i className="bi bi-arrow-repeat settings-spin" />
            ) : (
              <i className="bi bi-check2-circle" />
            )}
            Lưu thay đổi
          </ShimmerButton>
        </div>
      </form>
    </div>
  );
}

/* ────────────── Section: Privacy ────────────── */
function SectionPrivacy({ isPrivate, privacyLoading, privacyMsg, privacyErr, onToggle }) {
  const options = [
    {
      value: false,
      icon: 'bi-globe2',
      title: 'Công khai',
      desc: 'Bất kỳ ai cũng xem được bài viết, story và thông tin trang cá nhân của bạn.',
    },
    {
      value: true,
      icon: 'bi-lock-fill',
      title: 'Riêng tư',
      desc: 'Chỉ bạn bè mới xem được trang cá nhân. Người theo dõi không phải bạn bè sẽ không xem được.',
    },
  ];

  return (
    <div className="settings-section settings-section--v2">
      <SectionHeader
        icon="bi-shield-lock"
        title="Quyền riêng tư"
        desc="Chọn ai có thể xem bài viết, story và thông tin trên trang cá nhân của bạn."
      />

      {privacyMsg && (
        <div className="settings-toast settings-toast--success">
          <i className="bi bi-check-circle-fill" /> {privacyMsg}
        </div>
      )}
      {privacyErr && (
        <div className="settings-toast settings-toast--danger">
          <i className="bi bi-exclamation-triangle-fill" /> {privacyErr}
        </div>
      )}

      <div className="settings-privacy-options">
        {options.map((opt) => {
          const active = isPrivate === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              className={`settings-privacy-card${active ? ' is-active' : ''}`}
              onClick={() => onToggle(opt.value)}
              disabled={privacyLoading}
            >
              <span className="settings-privacy-card-icon" aria-hidden="true">
                <i className={`bi ${opt.icon}`} />
              </span>
              <span className="settings-privacy-card-text">
                <span className="settings-privacy-card-title">
                  {opt.title}
                  {active && <i className="bi bi-check-circle-fill settings-privacy-card-check" />}
                </span>
                <span className="settings-privacy-card-desc">{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────── Section: Password ────────────── */
function SectionPassword({
  settings, currentPw, setCurrentPw, newPw, setNewPw, confirmPw, setConfirmPw,
  pwMsg, pwErr, pwLoading, handlePasswordSave,
}) {
  const desc = settings?.has_password
    ? 'Thay đổi mật khẩu đăng nhập của bạn.'
    : 'Bạn đang đăng nhập bằng Google. Đặt mật khẩu để có thể đăng nhập bằng email.';

  return (
    <div className="settings-section settings-section--v2">
      <SectionHeader icon="bi-shield-lock-fill" title="Mật khẩu & Bảo mật" desc={desc} />

      {pwMsg && (
        <div className="settings-toast settings-toast--success">
          <i className="bi bi-check-circle-fill" /> {pwMsg}
        </div>
      )}
      {pwErr && (
        <div className="settings-toast settings-toast--danger">
          <i className="bi bi-exclamation-triangle-fill" /> {pwErr}
        </div>
      )}

      <form className="settings-form settings-form--v2" onSubmit={handlePasswordSave}>
        {settings?.has_password && (
          <FieldRow icon="bi-key-fill" label="Mật khẩu hiện tại">
            <input
              type="password"
              className="settings-input settings-input--v2"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </FieldRow>
        )}

        <FieldRow
          icon="bi-shield-shaded"
          label={settings?.has_password ? 'Mật khẩu mới' : 'Đặt mật khẩu'}
        >
          <input
            type="password"
            className="settings-input settings-input--v2"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            placeholder="Ít nhất 6 ký tự"
          />
        </FieldRow>

        <FieldRow icon="bi-check2-square" label="Xác nhận mật khẩu">
          <input
            type="password"
            className="settings-input settings-input--v2"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu mới"
          />
        </FieldRow>

        <div className="settings-actions settings-actions--v2">
          <ShimmerButton
            type="submit"
            disabled={pwLoading}
            background="linear-gradient(135deg, #1877f2 0%, #6366f1 50%, #a855f7 100%)"
          >
            {pwLoading ? (
              <i className="bi bi-arrow-repeat settings-spin" />
            ) : (
              <i className="bi bi-shield-fill-check" />
            )}
            {settings?.has_password ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
          </ShimmerButton>
        </div>
      </form>
    </div>
  );
}

/* ────────────── Section: Wallet ────────────── */
function SectionWallet({ balance }) {
  return (
    <div className="settings-section settings-section--v2">
      <SectionHeader
        icon="bi-wallet2"
        title="Ví tiền"
        desc="Phần nạp tiền và lịch sử giao dịch đã được chuyển sang trang riêng để gọn gàng hơn."
      />

      <div className="settings-wallet-card">
        <Meteors number={14} />
        <div className="settings-wallet-card-inner">
          <div className="settings-wallet-row">
            <div>
              <div className="settings-wallet-label">
                <i className="bi bi-coin" /> Số dư hiện tại
              </div>
              <div className="settings-wallet-amount">
                {balance === null ? '—' : (
                  <NumberCounter
                    value={balance}
                    separator="."
                    suffix=" VND"
                    duration={1.5}
                    easing="easeOut"
                    once={false}
                  />
                )}
              </div>
            </div>
            <div className="settings-wallet-icon-wrap">
              <i className="bi bi-piggy-bank-fill" />
            </div>
          </div>

          <BorderBeam size={220} duration={10} colorFrom="#ffffff" colorTo="#a855f7" />
        </div>
      </div>

      <div className="settings-wallet-grid">
        <FeatureChip icon="bi-arrow-down-circle-fill" title="Nạp tiền" desc="VNPay & MoMo sandbox" />
        <FeatureChip icon="bi-receipt-cutoff" title="Lịch sử" desc="Mọi giao dịch của bạn" />
        <FeatureChip icon="bi-shield-check" title="Bảo mật" desc="HMAC SHA256" />
      </div>

      <div className="settings-actions settings-actions--v2">
        <Link to="/wallet" className="settings-wallet-cta">
          <i className="bi bi-box-arrow-up-right" />
          <span>Mở trang Ví tiền</span>
          <i className="bi bi-arrow-right settings-wallet-cta-arrow" />
        </Link>
      </div>
    </div>
  );
}

/* ────────────── Shared bits ────────────── */
function SectionHeader({ icon, title, desc }) {
  return (
    <div className="settings-section-header settings-section-header--v2">
      <span className="settings-section-icon" aria-hidden="true">
        <i className={`bi ${icon}`} />
      </span>
      <div>
        <h3 className="settings-section-title">{title}</h3>
        <p className="settings-section-desc">{desc}</p>
      </div>
    </div>
  );
}

function FieldRow({ icon, label, hint, children }) {
  return (
    <div className="settings-field">
      <div className="settings-field-label">
        <i className={`bi ${icon} settings-field-icon`} />
        <span>{label}</span>
      </div>
      <div className="settings-field-value">
        {children}
        {hint && <span className="settings-hint">{hint}</span>}
      </div>
    </div>
  );
}

function FeatureChip({ icon, title, desc }) {
  return (
    <MagicCard className="settings-feature-chip" gradientSize={160} spotlight={false}>
      <i className={`bi ${icon} settings-feature-chip-icon`} />
      <div className="settings-feature-chip-text">
        <div className="settings-feature-chip-title">{title}</div>
        <div className="settings-feature-chip-desc">{desc}</div>
      </div>
    </MagicCard>
  );
}
