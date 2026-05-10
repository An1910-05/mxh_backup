import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getMyShopApplication, registerShopSeller } from '../services/shop';

const STATUS_LABEL = {
  pending: 'Đang chờ duyệt',
  approved: 'Đã được duyệt',
  rejected: 'Bị từ chối',
};

export default function ShopRegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ storeName: '', intro: '', phone: '', address: '' });

  useEffect(() => {
    if (!user) return;
    getMyShopApplication()
      .then(app => {
        setApplication(app);
        if (app) setForm({
          storeName: app.storeName || '',
          intro: app.intro || '',
          phone: app.phone || '',
          address: app.address || '',
        });
      })
      .catch(err => console.error('[shop-register] load failed:', err))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (user?.is_seller) navigate('/shop/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.storeName.trim() || !form.intro.trim() || !form.phone.trim() || !form.address.trim()) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    setSubmitting(true);
    try {
      const app = await registerShopSeller(form);
      setApplication(app);
    } catch (err) {
      setError(err?.message || 'Gửi đơn thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="apple-main"><p style={{ padding: 32 }}>Đang tải…</p></div>;

  const isPending = application?.status === 'pending';
  const isRejected = application?.status === 'rejected';

  return (
    <div className="apple-main shop-register-page">
      <div className="shop-register-card">
        <Link to="/shop" className="shop-register-back">← Về cửa hàng</Link>
        <h1 className="shop-register-title">Đăng ký bán hàng</h1>
        <p className="shop-register-sub">
          Điền thông tin cửa hàng để admin xét duyệt. Sau khi được duyệt, bạn sẽ thấy mục
          <strong> Quản lý cửa hàng </strong> để đăng sản phẩm.
        </p>

        {application && (
          <div className={`shop-app-status shop-app-status--${application.status}`}>
            <div className="shop-app-status-label">
              Trạng thái: <strong>{STATUS_LABEL[application.status] || application.status}</strong>
            </div>
            {isRejected && application.rejectionReason && (
              <div className="shop-app-status-reason">
                Lý do từ chối: {application.rejectionReason}
              </div>
            )}
            {isPending && (
              <div className="shop-app-status-hint">
                Đơn đã được gửi. Admin sẽ duyệt trong thời gian sớm nhất.
              </div>
            )}
            {isRejected && (
              <div className="shop-app-status-hint">
                Bạn có thể chỉnh sửa thông tin và gửi lại đơn.
              </div>
            )}
          </div>
        )}

        {(!application || isRejected) && (
          <form className="shop-register-form" onSubmit={handleSubmit}>
            <div className="shop-form-row">
              <label>Tên cửa hàng *</label>
              <input
                type="text"
                value={form.storeName}
                onChange={e => setForm({ ...form, storeName: e.target.value })}
                placeholder="VD: TH Agency"
                maxLength={100}
                disabled={submitting}
              />
            </div>
            <div className="shop-form-row">
              <label>Giới thiệu cửa hàng *</label>
              <textarea
                rows={4}
                value={form.intro}
                onChange={e => setForm({ ...form, intro: e.target.value })}
                placeholder="Giới thiệu ngắn về cửa hàng, mặt hàng kinh doanh, kinh nghiệm…"
                maxLength={1000}
                disabled={submitting}
              />
            </div>
            <div className="shop-form-row">
              <label>Số điện thoại liên hệ *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="VD: 0901234567"
                maxLength={30}
                disabled={submitting}
              />
            </div>
            <div className="shop-form-row">
              <label>Địa chỉ liên hệ *</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP"
                maxLength={255}
                disabled={submitting}
              />
            </div>

            {error && <div className="shop-form-error">{error}</div>}

            <button type="submit" className="shop-register-submit" disabled={submitting}>
              {submitting ? 'Đang gửi…' : (isRejected ? 'Gửi lại đơn' : 'Gửi đơn đăng ký')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
