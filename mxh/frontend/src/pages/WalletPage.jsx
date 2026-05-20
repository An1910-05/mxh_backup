import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPayment, getBalance, getTransactions } from '../services/auth';
import { NumberCounter } from '@/components/ui/number-counter';

const TOPUP_PRESETS = [10000, 20000, 50000, 100000, 200000, 500000];

const PAYMENT_METHODS = [
  {
    key: 'vnpay',
    label: 'VNPay',
    description: 'Thẻ ATM nội địa, Visa/Master, QR ngân hàng',
    logo: '/vnpay-logo.png',
  },
  {
    key: 'momo',
    label: 'Ví MoMo',
    description: 'Quét QR hoặc mở app MoMo để thanh toán',
    logo: '/momo-logo.png',
  },
];

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VND';
}

function withVietnameseDiacritics(text) {
  if (!text) return 'Nạp tiền';
  return text
    .replace(/Nap tien iPock/gi, 'Nạp tiền iPock')
    .replace(/Nap tien/gi, 'Nạp tiền')
    .replace(/Tieu tien/gi, 'Tiêu tiền')
    .replace(/Hoan tien/gi, 'Hoàn tiền');
}

const STATUS_LABELS = {
  success: 'Thành công',
  failed:  'Không thành công',
};

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [topupAmount, setTopupAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('vnpay');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupErr, setTopupErr] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [showMomoGuide, setShowMomoGuide] = useState(false);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const data = await getBalance();
        setBalance(data.balance || 0);
      } catch (err) {
        console.error('Failed to load balance:', err);
      }
    };

    const loadTransactions = async () => {
      setTxnLoading(true);
      try {
        const data = await getTransactions();
        const all = data.transactions || [];
        setTransactions(all.filter((t) => t.status !== 'pending'));
      } catch (err) {
        console.error('Failed to load transactions:', err);
      } finally {
        setTxnLoading(false);
      }
    };

    loadBalance();
    loadTransactions();
    window.addEventListener('mxh-wallet-refresh', loadBalance);
    return () => {
      window.removeEventListener('mxh-wallet-refresh', loadBalance);
    };
  }, []);

  const handleTopup = async () => {
    const amount = parseInt(topupAmount);
    if (!amount || amount < 10000) {
      setTopupErr('Số tiền nạp tối thiểu là 10,000 VND');
      return;
    }
    setTopupLoading(true);
    setTopupErr('');
    try {
      const result = await createPayment(amount, paymentMethod);
      if (result.payment_url) {
        window.location.href = result.payment_url;
      }
    } catch (err) {
      setTopupErr(err.message);
    } finally {
      setTopupLoading(false);
    }
  };

  const activeMethod = PAYMENT_METHODS.find((m) => m.key === paymentMethod) || PAYMENT_METHODS[0];

  return (
    <div className="settings-page">
      <div className="wallet-page-container">
        <div className="wallet-page-header">
          <div>
            <h2 className="wallet-page-title">Ví tiền</h2>
            <p className="wallet-page-subtitle">Nạp tiền vào tài khoản để sử dụng các dịch vụ trên iPock.</p>
          </div>
          <Link to="/settings" className="settings-btn settings-btn--ghost">
            <i className="bi bi-arrow-left" aria-hidden="true" />
            <span>Về Cài đặt</span>
          </Link>
        </div>

        <div className="wallet-balance-card">
          <div className="wallet-balance-label">Số dư hiện tại</div>
          <NumberCounter
            className="wallet-balance-amount"
            value={Number(balance) || 0}
            duration={1.5}
            separator="."
            suffix=" VND"
            once={false}
          />
        </div>

        <div className="wallet-topup">
          <h4 className="wallet-topup-title">Chọn phương thức thanh toán</h4>

          <div className="wallet-method-grid">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.key}
                type="button"
                className={`wallet-method-card${paymentMethod === method.key ? ' wallet-method-card--active' : ''}`}
                onClick={() => setPaymentMethod(method.key)}
              >
                <span className={`wallet-method-logo wallet-method-logo--${method.key}`} aria-hidden="true">
                  <img src={method.logo} alt={`${method.label} logo`} />
                </span>
                <span className="wallet-method-info">
                  <span className="wallet-method-label">{method.label}</span>
                  <span className="wallet-method-desc">{method.description}</span>
                </span>
                <span className={`wallet-method-radio${paymentMethod === method.key ? ' wallet-method-radio--active' : ''}`} aria-hidden="true" />
              </button>
            ))}
          </div>

          {paymentMethod === 'momo' && (
            <div className="momo-guide">
              <button
                type="button"
                className="momo-guide-toggle"
                onClick={() => setShowMomoGuide((v) => !v)}
                aria-expanded={showMomoGuide}
              >
                <span className="momo-guide-toggle-icon"><i className="bi bi-info-circle-fill" aria-hidden="true" /></span>
                <span>Hướng dẫn thanh toán MoMo Test (sandbox)</span>
                <span className={`momo-guide-chevron${showMomoGuide ? ' momo-guide-chevron--open' : ''}`} aria-hidden="true">
                  <i className="bi bi-chevron-down" />
                </span>
              </button>
              {showMomoGuide && (
                <div className="momo-guide-body">
                  <ol className="momo-guide-steps">
                    <li>
                      Cài app <strong>MoMo Test</strong> (gỡ MoMo thường trước):{' '}
                      <a href="https://developers.momo.vn/v3/vi/download/" target="_blank" rel="noreferrer">developers.momo.vn/v3/vi/download</a>
                    </li>
                    <li>
                      Mở app → đăng ký ví test bằng <strong>số điện thoại bất kỳ 10 số</strong> (đầu hợp lệ: 03/05/07/08/09).
                      OTP mặc định: <code>0000</code> hoặc <code>000000</code>. Mật khẩu 6 số do bạn đặt.
                    </li>
                    <li>
                      Nạp tiền vào ví test bằng thẻ ATM giả lập (chọn 1):
                      <ul className="momo-guide-cards">
                        <li><code>9704 0000 0000 0018</code> · HSD 03/07 — thành công</li>
                        <li><code>9704 0000 0000 0026</code> — thẻ bị khóa</li>
                        <li><code>9704 0000 0000 0034</code> — không đủ số dư</li>
                        <li><code>9704 0000 0000 0042</code> — vượt hạn mức</li>
                      </ul>
                    </li>
                    <li>
                      Trên trang này, chọn <strong>Ví MoMo</strong> → nhập số tiền (≥ 10.000đ) → bấm <em>Nạp qua Ví MoMo</em>.
                      Trang sẽ chuyển sang cổng MoMo sandbox.
                    </li>
                    <li>
                      Trên cổng MoMo: quét QR bằng app MoMo Test (hoặc bấm "Thanh toán bằng MoMo Test").
                      Xác nhận trong app → MoMo chuyển về <code>/payment/result</code> và cộng tiền vào số dư.
                    </li>
                  </ol>
                  <p className="momo-guide-note">
                    <strong>Lưu ý:</strong> MoMo gửi IPN server-to-server tới <code>/payment/momo/ipn</code>.
                    Khi chạy localhost, IPN không tới được — backend sẽ finalize khi trình duyệt redirect về,
                    nên kết quả vẫn cộng tiền bình thường. Khi deploy lên domain công khai, đặt <code>BACKEND_URL</code> để MoMo gọi IPN trực tiếp.
                  </p>
                </div>
              )}
            </div>
          )}

          <h4 className="wallet-topup-title wallet-topup-title--spaced">Số tiền nạp</h4>

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
              Nạp qua {activeMethod.label}
            </button>
          </div>

          <p className="wallet-hint">
            Thanh toán an toàn qua cổng {activeMethod.label}. Số tiền tối thiểu 10,000 VND.
          </p>
        </div>

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
                    <span className={`wallet-txn-status wallet-txn-status--${txn.status}`} aria-hidden="true">
                      <i className={`bi ${txn.status === 'success' ? 'bi-check-lg' : 'bi-x-lg'}`} />
                    </span>
                    <div>
                      <div className="wallet-txn-desc">
                        <span className={`wallet-txn-result wallet-txn-result--${txn.status}`}>
                          <i className={`bi ${txn.status === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`} aria-hidden="true" />
                          <span>{STATUS_LABELS[txn.status] || txn.status}</span>
                        </span>
                        {txn.provider && (
                          <span className={`wallet-txn-provider wallet-txn-provider--${txn.provider}`}>
                            {txn.provider === 'momo' ? 'MoMo' : 'VNPay'}
                          </span>
                        )}
                      </div>
                      <div className="wallet-txn-date">{new Date(txn.created_at).toLocaleString('vi-VN')}</div>
                    </div>
                  </div>
                  <div className={`wallet-txn-amount wallet-txn-amount--${txn.status}${txn.amount < 0 ? ' wallet-txn-amount--neg' : ''}`}>
                    {txn.status === 'success' && txn.amount > 0 ? '+' : ''}{formatVND(txn.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
