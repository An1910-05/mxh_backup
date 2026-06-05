import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getMyPurchases,
  confirmDelivery,
  cancelShopOrder,
  getMyReviewForOrder,
  createShopReview,
  updateShopReview,
} from '../services/shop';
import { uploadFile } from '../services/api';
import { API_ORIGIN } from '../config';
import { useLiquidMetalRipple } from '../components/JolyText';
import OrderTrackingModal from '../components/OrderTrackingModal';

const STATUS_TABS = [
  { key: 'all',        label: 'Tất cả' },
  { key: 'pending',    label: 'Chờ xác nhận' },
  { key: 'shipping',   label: 'Đang giao' },
  { key: 'delivered',  label: 'Đã giao' },
  { key: 'completed',  label: 'Hoàn thành' },
  { key: 'cancelled',  label: 'Đã huỷ' },
];

const STATUS_LABEL = {
  pending:    { text: 'Chờ xác nhận', tone: 'warn'  },
  confirmed:  { text: 'Đang chuẩn bị', tone: 'info'  },
  shipping:   { text: 'Đang giao',     tone: 'info'  },
  delivered:  { text: 'Đã giao',       tone: 'ok'    },
  completed:  { text: 'Hoàn thành',    tone: 'ok'    },
  cancelled:  { text: 'Đã huỷ',        tone: 'danger'},
  refunded:   { text: 'Đã hoàn tiền',  tone: 'danger'},
};

function mediaUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`;
}
function formatPrice(p) { return new Intl.NumberFormat('vi-VN').format(Number(p) || 0) + 'đ'; }

function snapshotImage(snapshot) {
  if (!snapshot) return null;
  try {
    const s = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    return Array.isArray(s?.images) && s.images.length ? s.images[0] : null;
  } catch { return null; }
}
function snapshotTitle(snapshot, fallback) {
  if (!snapshot) return fallback;
  try {
    const s = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    return s?.title || fallback;
  } catch { return fallback; }
}

export default function ShopOrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  useLiquidMetalRipple(rootRef);

  const [status, setStatus] = useState('all');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(null); // { order, existing }
  const [trackingOrder, setTrackingOrder] = useState(null); // đơn đang xem lộ trình

  const reload = useCallback(() => {
    if (!user) return;
    setLoading(true);
    setError('');
    getMyPurchases({ status: status === 'all' ? undefined : status, limit: 50 })
      .then(setOrders)
      .catch(err => {
        console.error('[orders] load failed', err);
        setError(err?.message || 'Không tải được đơn hàng');
      })
      .finally(() => setLoading(false));
  }, [user, status]);

  useEffect(() => { reload(); }, [reload]);

  const handleConfirmDelivery = async (order) => {
    if (!window.confirm(`Xác nhận đã nhận hàng đơn #${order.orderNumber}?`)) return;
    try {
      await confirmDelivery(order.id);
      reload();
    } catch (err) {
      alert(err?.message || 'Không xác nhận được');
    }
  };

  const handleCancel = async (order) => {
    const reason = window.prompt('Lý do huỷ đơn (sẽ gửi cho người bán):', '');
    if (!reason || !reason.trim()) return;
    try {
      await cancelShopOrder(order.id, reason.trim());
      reload();
    } catch (err) {
      alert(err?.message || 'Không huỷ được đơn');
    }
  };

  const openReviewModal = async (order) => {
    let existing = null;
    try {
      existing = await getMyReviewForOrder(order.id);
    } catch (err) { console.error('[review] load existing failed', err); }
    setReviewing({ order, existing });
  };

  if (!user) {
    return <div className="apple-main" style={{ padding: 32 }}>Vui lòng đăng nhập.</div>;
  }

  return (
    <div className="shop-lg-scope shop-orders-scope" ref={rootRef}>
      <div className="shop-lg-stage" aria-hidden="true">
        <div className="shop-lg-blob b1" /><div className="shop-lg-blob b2" /><div className="shop-lg-blob b3" />
      </div>

      <header className="shop-lg-topbar">
        <div className="shop-lg-brand">
          <div className="shop-lg-brand-dot" />
          <span>Đơn hàng của tôi</span>
        </div>
        <div className="shop-lg-crumbs">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/shop'); }}>Shop</a>
          <span className="sep">›</span>
          <span style={{ color: 'var(--slg-txt)' }}>Đơn mua</span>
        </div>
        <div className="shop-lg-topright">
          <Link to="/shop" className="shop-lg-icon-btn shop-lg-lq" aria-label="Quay lại Shop">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7H18a2 2 0 0 0 2-1.6L21.5 8H6"/>
              <circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>
            </svg>
          </Link>
        </div>
      </header>

      <main className="shop-lg-page">
        <div className="shop-lg-glass shop-orders-tabs">
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              className={'shop-lg-lq ' + (status === t.key ? 'is-on' : '')}
              onClick={() => setStatus(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="shop-lg-glass" style={{ padding: 16, color: 'var(--slg-danger)', marginTop: 12 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="shop-lg-glass" style={{ padding: 40, textAlign: 'center', color: 'var(--slg-txt-2)', marginTop: 16 }}>
            Đang tải đơn hàng…
          </div>
        ) : orders.length === 0 ? (
          <div className="shop-lg-glass shop-lg-empty" style={{ marginTop: 16 }}>
            <div className="icn"><i className="bi bi-inbox" /></div>
            <h3>Chưa có đơn nào</h3>
            <p>Bạn chưa có đơn hàng nào trong trạng thái này. <Link to="/shop">Đi mua sắm →</Link></p>
          </div>
        ) : (
          <div className="shop-orders-list">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onConfirmDelivery={handleConfirmDelivery}
                onCancel={handleCancel}
                onReview={openReviewModal}
                onTrack={(o) => setTrackingOrder(o)}
              />
            ))}
          </div>
        )}
      </main>

      {reviewing && (
        <ReviewModal
          order={reviewing.order}
          existing={reviewing.existing}
          onClose={() => setReviewing(null)}
          onSaved={() => { setReviewing(null); reload(); }}
        />
      )}

      {trackingOrder && (
        <OrderTrackingModal order={trackingOrder} onClose={() => setTrackingOrder(null)} />
      )}
    </div>
  );
}

function OrderCard({ order, onConfirmDelivery, onCancel, onReview, onTrack }) {
  const img  = snapshotImage(order.productSnapshot);
  const title = snapshotTitle(order.productSnapshot, `Sản phẩm #${order.productId}`);
  const st = STATUS_LABEL[order.status] || { text: order.status, tone: 'info' };
  const canConfirmReceive = ['shipping', 'delivered'].includes(order.status);
  const canCancel = ['pending', 'confirmed'].includes(order.status);
  const canReview = order.status === 'completed';
  const canTrack = ['shipping', 'delivered', 'completed'].includes(order.status) && !!order.shippingCarrier;

  return (
    <div className="shop-lg-glass shop-order-card">
      <div className="shop-order-head">
        <div className="shop-order-shop">
          <strong>Shop:</strong>&nbsp;
          <Link to={`/shop/seller/${order.sellerId}`}>{order.seller?.username || `#${order.sellerId}`}</Link>
        </div>
        <div className={`shop-order-status tone-${st.tone}`}>{st.text}</div>
      </div>

      <div className="shop-order-body">
        <Link to={`/shop/product/${order.productId}`} className="shop-order-img">
          {img ? <img src={mediaUrl(img)} alt="" /> : <div className="ph" />}
        </Link>
        <div className="shop-order-info">
          <Link to={`/shop/product/${order.productId}`} className="shop-order-title">{title}</Link>
          <div className="shop-order-meta">
            <span>Số lượng: <b>{order.quantity}</b></span>
            <span>Đơn giá: <b>{formatPrice(order.unitPrice)}</b></span>
            {order.shippingCarrier && <span>Đơn vị VC: <b>{order.shippingCarrier}</b></span>}
            {order.trackingNumber && <span>Mã vận đơn: <b>{order.trackingNumber}</b></span>}
          </div>
          <div className="shop-order-num">#{order.orderNumber}</div>
        </div>
        <div className="shop-order-total">
          <span>Tổng tiền</span>
          <strong>{formatPrice(order.totalPrice)}</strong>
        </div>
      </div>

      <div className="shop-order-foot">
        <div className="shop-order-date">
          Ngày đặt: {new Date(order.createdAt).toLocaleString('vi-VN')}
        </div>
        <div className="shop-order-actions">
          {canConfirmReceive && (
            <button className="shop-btn-primary" onClick={() => onConfirmDelivery(order)}>
              <i className="bi bi-check-circle-fill" /> Đã nhận hàng
            </button>
          )}
          {canTrack && (
            <button className="shop-btn-secondary" onClick={() => onTrack(order)}>
              <i className="bi bi-geo-alt-fill" /> Xem lộ trình
            </button>
          )}
          {canReview && (
            <button className="shop-btn-primary" onClick={() => onReview(order)}>
              <i className="bi bi-star-fill" /> Đánh giá
            </button>
          )}
          {canCancel && (
            <button className="shop-btn-danger" onClick={() => onCancel(order)}>
              Huỷ đơn
            </button>
          )}
          <Link to={`/shop/product/${order.productId}`} className="shop-btn-secondary">
            Mua lại
          </Link>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ order, existing, onClose, onSaved }) {
  const [rating, setRating]   = useState(existing?.rating || 5);
  const [content, setContent] = useState(existing?.content || '');
  const [images, setImages]   = useState(existing?.images || []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');
  const fileRef = useRef(null);

  // Backend chỉ cho sửa đánh giá trong 7 ngày — khoá UI khi quá hạn (chỉ áp
  // dụng với review đã tồn tại). Fail-open nếu không đọc được ngày (backend
  // vẫn chặn ở tầng cuối).
  const EDIT_WINDOW_DAYS = 7;
  const editLocked = (() => {
    if (!existing?.createdAt) return false;
    const t = Date.parse(String(existing.createdAt).replace(' ', 'T'));
    return Number.isFinite(t) && (Date.now() - t) > EDIT_WINDOW_DAYS * 86400000;
  })();

  const handleAddImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (images.length >= 5) { setError('Tối đa 5 ảnh.'); return; }
    try {
      const up = await uploadFile('/upload/media', 'media', file);
      const url = up?.data?.media_url || up?.data?.url;
      if (!url) throw new Error('Upload thất bại — server không trả URL');
      setImages(prev => [...prev, url]);
    } catch (err) {
      setError(err?.message || 'Không upload được ảnh');
    }
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (editLocked) { setError(`Đã quá ${EDIT_WINDOW_DAYS} ngày — không thể chỉnh sửa đánh giá.`); return; }
    if (!content.trim()) { setError('Vui lòng viết nội dung đánh giá.'); return; }
    setSubmitting(true);
    try {
      if (existing) {
        await updateShopReview({ id: existing.id, rating, content: content.trim(), images });
      } else {
        await createShopReview({ orderId: order.id, rating, content: content.trim(), images });
      }
      onSaved();
    } catch (err) {
      setError(err?.message || 'Gửi đánh giá thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shop-modal-backdrop" onClick={onClose}>
      <div className="shop-modal shop-review-modal" onClick={e => e.stopPropagation()}>
        <div className="shop-modal-header">
          <h2>{existing ? 'Sửa đánh giá' : 'Đánh giá sản phẩm'}</h2>
          <button className="shop-modal-close" onClick={onClose} type="button">×</button>
        </div>

        <form onSubmit={handleSubmit} className="shop-modal-form">
          {editLocked && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff7ed', color: '#9a3412', fontSize: 14, lineHeight: 1.4 }}>
              Đã quá {EDIT_WINDOW_DAYS} ngày kể từ khi đánh giá — bạn không thể chỉnh sửa nữa.
            </div>
          )}
          <div className="shop-form-row">
            <label>Chất lượng sản phẩm</label>
            <div className="shop-review-stars">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  type="button"
                  key={n}
                  className={'star ' + (n <= rating ? 'on' : '')}
                  onClick={() => !editLocked && setRating(n)}
                  disabled={editLocked}
                  aria-label={`${n} sao`}
                >★</button>
              ))}
              <span className="rate-text">
                {['Tệ', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Tuyệt vời'][rating - 1]}
              </span>
            </div>
          </div>

          <div className="shop-form-row">
            <label>Nội dung đánh giá (tối đa 2000 ký tự)</label>
            <textarea
              rows={5}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm (chất lượng, đóng gói, giao hàng)…"
              maxLength={2000}
              disabled={submitting || editLocked}
            />
          </div>

          <div className="shop-form-row">
            <label>Ảnh đính kèm (tối đa 5)</label>
            <div className="shop-review-images">
              {images.map((src, i) => (
                <div key={i} className="thumb">
                  <img src={mediaUrl(src)} alt={`Ảnh ${i + 1}`} />
                  <button type="button" onClick={() => removeImage(i)} aria-label="Xoá" disabled={editLocked}>×</button>
                </div>
              ))}
              {images.length < 5 && !editLocked && (
                <button type="button" className="thumb add" onClick={() => fileRef.current?.click()}>
                  + Ảnh
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAddImage} hidden />
          </div>

          {error && <div className="shop-form-error">{error}</div>}

          <div className="shop-modal-footer">
            <button type="button" className="shop-btn-secondary" onClick={onClose} disabled={submitting}>Huỷ</button>
            <button type="submit" className="shop-btn-primary" disabled={submitting || editLocked}>
              {submitting ? 'Đang gửi…' : (existing ? 'Lưu thay đổi' : 'Gửi đánh giá')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
