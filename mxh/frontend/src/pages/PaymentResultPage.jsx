import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { verifyPayment } from '../services/auth';

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VND';
}

export default function PaymentResultPage() {
  const location = useLocation();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const queryString = location.search.replace('?', '');
    if (!queryString) {
      setResult({ valid: false, message: 'Không có dữ liệu thanh toán.' });
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await verifyPayment(queryString);
        setResult(data);
      } catch (err) {
        setResult({ valid: false, message: err.message || 'Lỗi xác thực thanh toán.' });
      } finally {
        setLoading(false);
      }
    })();
  }, [location.search]);

  useEffect(() => {
    if (result?.valid && result?.success) {
      window.dispatchEvent(new CustomEvent('mxh-wallet-refresh'));
    }
  }, [result]);

  if (loading) {
    return (
      <div className="apple-main fade-in">
        <div className="payment-result-page">
          <div className="settings-loading"><span className="apple-spinner" /></div>
        </div>
      </div>
    );
  }

  const success = result?.valid && result?.success;

  return (
    <div className="apple-main fade-in">
      <div className="payment-result-page">
        <div className="payment-result-card">
          <div className={`payment-result-icon payment-result-icon--${success ? 'success' : 'fail'}`}>
            {success ? (
              <svg viewBox="0 0 52 52" width="52" height="52">
                <circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" strokeWidth="2" />
                <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-16" />
              </svg>
            ) : (
              <svg viewBox="0 0 52 52" width="52" height="52">
                <circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" strokeWidth="2" />
                <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="M18 18l16 16M34 18l-16 16" />
              </svg>
            )}
          </div>

          <h2 className="payment-result-title">
            {success ? 'Thanh toán thành công!' : 'Thanh toán thất bại'}
          </h2>

          {result?.amount > 0 && (
            <div className="payment-result-amount">{formatVND(result.amount)}</div>
          )}

          <p className="payment-result-msg">{result?.message}</p>

          {result?.response_code && result.response_code !== '00' && (
            <p className="payment-result-code">Mã lỗi: {result.response_code}</p>
          )}

          <div className="payment-result-actions">
            <Link to="/settings" className="settings-btn settings-btn--primary">
              Về Cài đặt
            </Link>
            <Link to="/" className="settings-btn settings-btn--ghost">
              Trang chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
