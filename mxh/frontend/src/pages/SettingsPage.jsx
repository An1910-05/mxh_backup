import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSettings, changePassword, updateSettingsProfile, createPayment, getBalance, getTransactions } from '../services/auth';

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

const TOPUP_PRESETS = [10000, 20000, 50000, 100000, 200000, 500000];

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VND';
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('general');

  // Profile edit state
  const [username, setUsername] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Wallet state
  const [balance, setBalance] = useState(0);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupErr, setTopupErr] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);

  const maxDay = daysInMonth(parseInt(birthMonth), parseInt(birthYear));
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSettings();
        setSettings(data);
        setUsername(data.username || '');
        setGender(data.gender || '');
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

  // Load balance and transactions when wallet tab is selected
  useEffect(() => {
    if (activeSection !== 'wallet') return;
    (async () => {
      try {
        const balData = await getBalance();
        setBalance(balData.balance || 0);
      } catch (err) {
        console.error('Failed to load balance:', err);
      }
    })();
    (async () => {
      setTxnLoading(true);
      try {
        const txnData = await getTransactions();
        setTransactions(txnData.transactions || []);
      } catch (err) {
        console.error('Failed to load transactions:', err);
      } finally {
        setTxnLoading(false);
      }
    })();
  }, [activeSection]);

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

  const handleTopup = async () => {
    const amount = parseInt(topupAmount);
    if (!amount || amount < 10000) {
      setTopupErr('Số tiền nạp tối thiểu là 10,000 VND');
      return;
    }
    setTopupLoading(true);
    setTopupErr('');
    try {
      const result = await createPayment(amount);
      if (result.payment_url) {
        window.location.href = result.payment_url;
      }
    } catch (err) {
      setTopupErr(err.message);
    } finally {
      setTopupLoading(false);
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
    { key: 'general', label: 'Chung', icon: '⚙' },
    { key: 'password', label: 'Mật khẩu & Bảo mật', icon: '🔒' },
    { key: 'wallet', label: 'Ví tiền', icon: '💰' },
  ];

  return (
    <div className="settings-page">
      <div className="settings-container">
        {/* Sidebar */}
        <aside className="settings-sidebar">
          <h2 className="settings-sidebar-title">Cài đặt</h2>
          <nav className="settings-nav">
            {sections.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`settings-nav-item${activeSection === s.key ? ' settings-nav-item--active' : ''}`}
                onClick={() => setActiveSection(s.key)}
              >
                <span className="settings-nav-icon">{s.icon}</span>
                <span className="settings-nav-label">{s.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="settings-content">
          {activeSection === 'general' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h3 className="settings-section-title">Thông tin cá nhân</h3>
                <p className="settings-section-desc">Quản lý thông tin cơ bản của bạn trên iPock.</p>
              </div>

              {profileMsg && <div className="apple-alert apple-alert-success settings-alert">{profileMsg}</div>}
              {profileErr && <div className="apple-alert apple-alert-danger settings-alert">{profileErr}</div>}

              <form className="settings-form" onSubmit={handleProfileSave}>
                <div className="settings-row">
                  <label className="settings-label" htmlFor="settings-email">Email</label>
                  <div className="settings-value">
                    <input id="settings-email" type="email" className="settings-input" value={settings?.email || ''} disabled />
                    <span className="settings-hint">Email không thể thay đổi</span>
                  </div>
                </div>

                <div className="settings-row">
                  <label className="settings-label" htmlFor="settings-username">Tên người dùng</label>
                  <div className="settings-value">
                    <input id="settings-username" type="text" className="settings-input" value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                </div>

                <div className="settings-row">
                  <label className="settings-label">Ngày sinh</label>
                  <div className="settings-value">
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
                </div>

                <div className="settings-row">
                  <label className="settings-label">Giới tính</label>
                  <div className="settings-value">
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
                </div>

                {settings?.has_google && (
                  <div className="settings-row">
                    <span className="settings-label">Liên kết</span>
                    <div className="settings-value">
                      <span className="settings-badge settings-badge--google">
                        <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                        Google đã liên kết
                      </span>
                    </div>
                  </div>
                )}

                <div className="settings-actions">
                  <button type="submit" className="settings-btn settings-btn--primary" disabled={profileLoading}>
                    {profileLoading ? <span className="apple-spinner" aria-hidden="true" /> : null}
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeSection === 'password' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h3 className="settings-section-title">Mật khẩu & Bảo mật</h3>
                <p className="settings-section-desc">
                  {settings?.has_password
                    ? 'Thay đổi mật khẩu đăng nhập của bạn.'
                    : 'Bạn đang đăng nhập bằng Google. Đặt mật khẩu để có thể đăng nhập bằng email.'}
                </p>
              </div>

              {pwMsg && <div className="apple-alert apple-alert-success settings-alert">{pwMsg}</div>}
              {pwErr && <div className="apple-alert apple-alert-danger settings-alert">{pwErr}</div>}

              <form className="settings-form" onSubmit={handlePasswordSave}>
                {settings?.has_password && (
                  <div className="settings-row">
                    <label className="settings-label" htmlFor="settings-current-pw">Mật khẩu hiện tại</label>
                    <div className="settings-value">
                      <input id="settings-current-pw" type="password" className="settings-input" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
                    </div>
                  </div>
                )}

                <div className="settings-row">
                  <label className="settings-label" htmlFor="settings-new-pw">
                    {settings?.has_password ? 'Mật khẩu mới' : 'Đặt mật khẩu'}
                  </label>
                  <div className="settings-value">
                    <input id="settings-new-pw" type="password" className="settings-input" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" placeholder="Ít nhất 6 ký tự" />
                  </div>
                </div>

                <div className="settings-row">
                  <label className="settings-label" htmlFor="settings-confirm-pw">Xác nhận mật khẩu</label>
                  <div className="settings-value">
                    <input id="settings-confirm-pw" type="password" className="settings-input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
                  </div>
                </div>

                <div className="settings-actions">
                  <button type="submit" className="settings-btn settings-btn--primary" disabled={pwLoading}>
                    {pwLoading ? <span className="apple-spinner" aria-hidden="true" /> : null}
                    {settings?.has_password ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeSection === 'wallet' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h3 className="settings-section-title">Ví tiền</h3>
                <p className="settings-section-desc">Nạp tiền vào tài khoản để sử dụng các dịch vụ trên iPock.</p>
              </div>

              {/* Balance card */}
              <div className="wallet-balance-card">
                <div className="wallet-balance-label">Số dư hiện tại</div>
                <div className="wallet-balance-amount">{formatVND(balance)}</div>
              </div>

              {/* Top-up */}
              <div className="wallet-topup">
                <h4 className="wallet-topup-title">Nạp tiền qua VNPay</h4>

                {topupErr && <div className="apple-alert apple-alert-danger settings-alert">{topupErr}</div>}

                <div className="wallet-preset-grid">
                  {TOPUP_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className={`wallet-preset-btn${parseInt(topupAmount) === amt ? ' wallet-preset-btn--active' : ''}`}
                      onClick={() => setTopupAmount(String(amt))}
                    >
                      {formatVND(amt)}
                    </button>
                  ))}
                </div>

                <div className="wallet-custom-row">
                  <input
                    type="number"
                    className="settings-input"
                    placeholder="Hoặc nhập số tiền khác (VND)"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    min="10000"
                    step="1000"
                  />
                  <button
                    type="button"
                    className="settings-btn settings-btn--primary"
                    disabled={topupLoading || !topupAmount}
                    onClick={handleTopup}
                  >
                    {topupLoading ? <span className="apple-spinner" aria-hidden="true" /> : null}
                    Nạp tiền
                  </button>
                </div>

                <p className="wallet-hint">Thanh toán an toàn qua cổng VNPay. Số tiền tối thiểu 10,000 VND.</p>
              </div>

              {/* Transaction history */}
              <div className="wallet-history">
                <h4 className="wallet-history-title">Lịch sử giao dịch</h4>
                {txnLoading ? (
                  <div className="settings-loading"><span className="apple-spinner" /></div>
                ) : transactions.length === 0 ? (
                  <p className="wallet-empty">Chưa có giao dịch nào.</p>
                ) : (
                  <div className="wallet-txn-list">
                    {transactions.map((txn) => (
                      <div key={txn.id} className="wallet-txn-row">
                        <div className="wallet-txn-info">
                          <span className={`wallet-txn-status wallet-txn-status--${txn.status}`}>
                            {txn.status === 'success' ? '✓' : txn.status === 'failed' ? '✗' : '⏳'}
                          </span>
                          <div>
                            <div className="wallet-txn-desc">{txn.description || 'Nạp tiền'}</div>
                            <div className="wallet-txn-date">{new Date(txn.created_at).toLocaleString('vi-VN')}</div>
                          </div>
                        </div>
                        <div className={`wallet-txn-amount wallet-txn-amount--${txn.status}`}>
                          {txn.status === 'success' ? '+' : ''}{formatVND(txn.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
