import { useState, useEffect, useCallback } from 'react';
import {
  getShopSellerApplications,
  approveShopSeller,
  rejectShopSeller,
} from '../../services/shop';

const STATUS_TABS = [
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'rejected', label: 'Đã từ chối' },
];

export default function AdminShopApplications() {
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getShopSellerApplications(tab, 50, 1);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[admin-shop-app] load failed:', err);
      setError(err?.message || 'Không tải được danh sách đơn');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { reload(); }, [reload]);

  const handleApprove = async (id) => {
    if (!window.confirm('Duyệt đơn đăng ký bán hàng này?')) return;
    setActingId(id);
    try {
      await approveShopSeller(id);
      setItems(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert(err?.message || 'Duyệt thất bại');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Nhập lý do từ chối:');
    if (!reason || !reason.trim()) return;
    setActingId(id);
    try {
      await rejectShopSeller(id, reason.trim());
      setItems(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert(err?.message || 'Từ chối thất bại');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-page-header">
        <h1 className="adm-page-title">Đơn đăng ký bán hàng</h1>
        <p className="adm-page-sub">Duyệt yêu cầu trở thành người bán trên cửa hàng.</p>
      </div>

      <div className="adm-tabs">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            className={`adm-tab${tab === t.key ? ' adm-tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>

      {loading ? (
        <p>Đang tải…</p>
      ) : error ? (
        <p className="shop-form-error">{error}</p>
      ) : items.length === 0 ? (
        <p>Không có đơn nào.</p>
      ) : (
        <div className="adm-app-list">
          {items.map(app => (
            <div key={app.id} className="adm-app-card">
              <div className="adm-app-head">
                <div>
                  <div className="adm-app-store">{app.storeName}</div>
                  <div className="adm-app-user">
                    @{app.applicantUsername} · {app.applicantEmail}
                  </div>
                </div>
                <div className={`adm-app-status adm-app-status--${app.status}`}>
                  {app.status === 'pending' ? 'Chờ duyệt' : app.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}
                </div>
              </div>
              <div className="adm-app-grid">
                <div><label>SĐT:</label> {app.phone}</div>
                <div><label>Địa chỉ:</label> {app.address}</div>
                <div className="adm-app-grid-full"><label>Giới thiệu:</label> {app.intro}</div>
                {app.rejectionReason && (
                  <div className="adm-app-grid-full">
                    <label>Lý do từ chối:</label> {app.rejectionReason}
                  </div>
                )}
                {app.reviewedAt && (
                  <div className="adm-app-grid-full">
                    <label>Đã xử lý:</label> {new Date(app.reviewedAt).toLocaleString('vi-VN')} bởi @{app.reviewerUsername}
                  </div>
                )}
              </div>
              {app.status === 'pending' && (
                <div className="adm-app-actions">
                  <button
                    className="adm-btn-approve"
                    disabled={actingId === app.id}
                    onClick={() => handleApprove(app.id)}
                  >Duyệt</button>
                  <button
                    className="adm-btn-reject"
                    disabled={actingId === app.id}
                    onClick={() => handleReject(app.id)}
                  >Từ chối</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
