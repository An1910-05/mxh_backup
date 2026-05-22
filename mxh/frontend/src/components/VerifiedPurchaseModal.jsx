import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { purchaseVerified, cancelVerified } from '../services/graphql';
import { getBalance } from '../services/auth';

const PLANS = [
  { key: 'monthly', label: '1 tháng', price: 500000, saving: null },
  { key: 'yearly',  label: '1 năm',   price: 5000000, saving: 1000000 },
];

function formatVND(n) {
  return n.toLocaleString('vi-VN') + 'đ';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ICON = (
  <svg viewBox="92 0 24 24" width="36" height="36" fill="currentColor" aria-hidden>
    <path d="m109.207 9.707-6.5 6.5a.996.996 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414L102 14.086l5.793-5.793a1 1 0 1 1 1.414 1.414m6.68 4.768L114.618 12l1.267-2.474a1.02 1.02 0 0 0-.355-1.326l-2.334-1.51-.14-2.775a1.018 1.018 0 0 0-.97-.971l-2.778-.14-1.51-2.336a1.02 1.02 0 0 0-1.324-.354L104 1.38 101.526.114a1.02 1.02 0 0 0-1.326.354l-1.509 2.336-2.777.14a1.017 1.017 0 0 0-.97.97l-.14 2.777L92.468 8.2a1.02 1.02 0 0 0-.354 1.325L93.382 12l-1.268 2.474a1.02 1.02 0 0 0 .355 1.326l2.335 1.509.14 2.776c.025.528.443.945.97.971l2.777.14 1.51 2.336a1.02 1.02 0 0 0 1.324.354L104 22.62l2.474 1.267c.469.242 1.039.09 1.326-.355l1.51-2.335 2.776-.14c.527-.026.945-.443.97-.97l.14-2.777 2.336-1.51c.443-.286.595-.856.354-1.324" />
  </svg>
);

export default function VerifiedPurchaseModal({ isVerified, verifiedUntil, isOwn, onClose, onPurchased }) {
  const [balance, setBalance]     = useState(null);
  const [plan, setPlan]           = useState('monthly');
  const [loading, setLoading]     = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(null); // 'purchase' | 'cancel'

  const selectedPlan = PLANS.find((p) => p.key === plan);

  useEffect(() => {
    if (!isOwn) return;
    getBalance().then((d) => setBalance(d?.balance ?? 0)).catch(() => setBalance(0));
  }, [isOwn]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePurchase = async () => {
    setError('');
    setLoading(true);
    try {
      const profile = await purchaseVerified(plan);
      setSuccess('purchase');
      setTimeout(() => onPurchased(profile), 1400);
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setError('');
    setCancelling(true);
    try {
      const profile = await cancelVerified();
      setSuccess('cancel');
      setTimeout(() => onPurchased(profile), 1400);
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
      setConfirmCancel(false);
    } finally {
      setCancelling(false);
    }
  };

  const canAfford = balance === null || balance >= selectedPlan.price;

  return createPortal(
    <div className="verified-modal-overlay" onClick={onClose}>
      <div className="verified-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="verified-modal-close" onClick={onClose} aria-label="Đóng">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
        </button>

        <div className="verified-modal-icon-wrap">
          <div className={`verified-modal-icon${isVerified ? ' verified-modal-icon--active' : ''}`}>
            {ICON}
          </div>
        </div>

        {/* ── Success ── */}
        {success === 'purchase' && (
          <div className="verified-modal-success">
            <div className="verified-modal-success-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="#22c55e"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
            </div>
            <p className="verified-modal-success-text">Tích xanh đã được kích hoạt!</p>
          </div>
        )}

        {success === 'cancel' && (
          <div className="verified-modal-success">
            <div className="verified-modal-success-icon" style={{ background: '#fee2e2' }}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="#ef4444"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            </div>
            <p className="verified-modal-success-text" style={{ color: '#ef4444' }}>Đã hủy tích xanh.</p>
          </div>
        )}

        {/* ── Confirm cancel dialog ── */}
        {!success && confirmCancel && (
          <>
            <h2 className="verified-modal-title">Hủy tích xanh?</h2>
            <p className="verified-modal-sub">
              Huy hiệu xanh sẽ bị xóa ngay lập tức.
              Thời gian còn lại <strong>{formatDate(verifiedUntil)}</strong> sẽ không được hoàn tiền.
            </p>
            {error && <p className="verified-modal-error">{error}</p>}
            <button
              type="button"
              className="verified-modal-btn verified-modal-btn--danger"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
            </button>
            <button
              type="button"
              className="verified-modal-btn verified-modal-btn--ghost"
              onClick={() => setConfirmCancel(false)}
              style={{ marginTop: 8 }}
            >
              Quay lại
            </button>
          </>
        )}

        {/* ── Already verified ── */}
        {!success && !confirmCancel && isVerified && (
          <>
            <h2 className="verified-modal-title">Tài khoản đã xác thực</h2>
            {isOwn && (
              <p className="verified-modal-sub">
                Hiệu lực đến <strong>{formatDate(verifiedUntil)}</strong>.
              </p>
            )}
            {isOwn && (
              <>
                <div className="verified-modal-divider" />
                <p className="verified-modal-renew-label">Gia hạn thêm</p>
                <div className="verified-modal-plan-picker">
                  {PLANS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={`verified-plan-card${plan === p.key ? ' verified-plan-card--active' : ''}`}
                      onClick={() => setPlan(p.key)}
                    >
                      <span className="verified-plan-label">{p.label}</span>
                      <span className="verified-plan-price">{formatVND(p.price)}</span>
                      {p.saving && (
                        <span className="verified-plan-saving">Tiết kiệm {formatVND(p.saving)}</span>
                      )}
                    </button>
                  ))}
                </div>
                {balance !== null && (
                  <p className="verified-modal-balance">
                    Số dư ví: <strong className={canAfford ? 'verified-balance--ok' : 'verified-balance--low'}>{formatVND(balance)}</strong>
                  </p>
                )}
                {error && <p className="verified-modal-error">{error}</p>}
                <button
                  type="button"
                  className="verified-modal-btn"
                  onClick={handlePurchase}
                  disabled={loading || !canAfford}
                >
                  {loading ? 'Đang xử lý...' : `Gia hạn ${selectedPlan.label}`}
                </button>
                {!canAfford && (
                  <p className="verified-modal-topup-hint">Số dư không đủ — hãy nạp thêm tiền vào ví.</p>
                )}
                <button
                  type="button"
                  className="verified-modal-cancel-link"
                  onClick={() => setConfirmCancel(true)}
                >
                  Hủy tích xanh
                </button>
              </>
            )}
          </>
        )}

        {/* ── Not verified, own profile ── */}
        {!success && !confirmCancel && !isVerified && isOwn && (
          <>
            <h2 className="verified-modal-title">Mua tích xanh</h2>
            <p className="verified-modal-sub">Hiển thị huy hiệu xác thực ngay tên, tăng độ tin cậy với bạn bè.</p>
            <div className="verified-modal-perks">
              {[
                'Huy hiệu xanh hiện trên tất cả bài viết',
                'Hiển thị nổi bật trên trang cá nhân',
                'Xuất hiện trong kết quả tìm kiếm',
              ].map((text) => (
                <div key={text} className="verified-modal-perk">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#3b82f6"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <div className="verified-modal-plan-picker">
              {PLANS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`verified-plan-card${plan === p.key ? ' verified-plan-card--active' : ''}`}
                  onClick={() => setPlan(p.key)}
                >
                  <span className="verified-plan-label">{p.label}</span>
                  <span className="verified-plan-price">{formatVND(p.price)}</span>
                  {p.saving && (
                    <span className="verified-plan-saving">Tiết kiệm {formatVND(p.saving)}</span>
                  )}
                </button>
              ))}
            </div>
            {balance !== null && (
              <p className="verified-modal-balance">
                Số dư ví: <strong className={canAfford ? 'verified-balance--ok' : 'verified-balance--low'}>{formatVND(balance)}</strong>
              </p>
            )}
            {error && <p className="verified-modal-error">{error}</p>}
            <button
              type="button"
              className="verified-modal-btn"
              onClick={handlePurchase}
              disabled={loading || !canAfford}
            >
              {loading ? 'Đang xử lý...' : 'Mua ngay'}
            </button>
            {!canAfford && (
              <p className="verified-modal-topup-hint">Số dư không đủ — hãy nạp thêm tiền vào ví.</p>
            )}
          </>
        )}

        {/* ── Other user, not verified ── */}
        {!success && !isVerified && !isOwn && (
          <>
            <h2 className="verified-modal-title">Chưa xác thực</h2>
            <p className="verified-modal-sub">Người dùng này chưa mua tích xanh.</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
