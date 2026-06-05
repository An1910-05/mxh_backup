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

const STATUS_LABELS = {
  success: 'Thành công',
  failed:  'Không thành công',
};

const PROVIDER_LABEL = {
  vnpay: 'VNPay',
  momo:  'MoMo',
  admin: 'Admin',
};

function getTxnNote(txn) {
  if (!txn.description) return null;
  const isTopup = txn.amount > 0 && (txn.provider === 'vnpay' || txn.provider === 'momo');
  if (isTopup && /^nap tien/i.test(txn.description)) return 'Nạp tiền tài khoản iPock';
  return txn.description;
}

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
    <div className="settings-page" style={{ minHeight: 0 }}>
      <div className="wallet-page-container">
        <div className="wallet-page-header">
          <Link to="/settings" className="settings-btn settings-btn--ghost">
            <i className="bi bi-arrow-left" aria-hidden="true" />
            <span>Về Cài đặt</span>
          </Link>
          <div>
            <h2 className="wallet-page-title">Ví tiền</h2>
            <p className="wallet-page-subtitle">Nạp tiền vào tài khoản để sử dụng các dịch vụ trên iPock.</p>
          </div>
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

          {/* HIDDEN: momo-guide — "Hướng dẫn thanh toán MoMo Test (sandbox)" — xem HIDDEN_ITEMS.md */}

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
              {transactions.map((txn) => {
                const isAdmin = txn.provider === 'admin';
                const note = getTxnNote(txn);
                return (
                  <div key={txn.id} className="wallet-txn-row">
                    <div className="wallet-txn-info">
                      <div>
                        <div className="wallet-txn-desc">
                          <span className={`wallet-txn-result wallet-txn-result--${txn.status}`}>
                            {STATUS_LABELS[txn.status] || txn.status}
                          </span>
                          {txn.provider && PROVIDER_LABEL[txn.provider] && (
                            <span className={`wallet-txn-provider wallet-txn-provider--${txn.provider}`}>
                              {PROVIDER_LABEL[txn.provider]}
                            </span>
                          )}
                        </div>
                        {note && (
                          <div className={`wallet-txn-note${isAdmin ? ' wallet-txn-note--admin' : ''}`}>
                            {isAdmin && <i className="bi bi-megaphone-fill" style={{ fontSize: '0.7rem', marginRight: 4 }} />}
                            {note}
                          </div>
                        )}
                        <div className="wallet-txn-date">{new Date(txn.created_at).toLocaleString('vi-VN')}</div>
                      </div>
                    </div>
                    <div className={`wallet-txn-amount wallet-txn-amount--${txn.status}${txn.amount < 0 ? ' wallet-txn-amount--neg' : ''}`}>
                      {txn.status === 'success' && txn.amount > 0 ? '+' : ''}{formatVND(txn.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
