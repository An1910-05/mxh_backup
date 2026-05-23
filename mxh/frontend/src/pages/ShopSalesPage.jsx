import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getMySales,
  confirmShopOrder,
  shipShopOrder,
  cancelShopOrder,
} from '../services/shop';
import { API_ORIGIN } from '../config';
import { useLiquidMetalRipple } from '../components/JolyText';

const STATUS_TABS = [
  { key: 'all',        label: 'Tất cả' },
  { key: 'pending',    label: 'Chờ xác nhận', highlight: true },
  { key: 'confirmed',  label: 'Cần giao hàng', highlight: true },
  { key: 'shipping',   label: 'Đang giao' },
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

function parseSnapshot(s) {
  if (!s) return {};
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return {}; }
}

export default function ShopSalesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  useLiquidMetalRipple(rootRef);

  const [status, setStatus] = useState('all');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && !user.is_seller) navigate('/shop/register', { replace: true });
  }, [user, navigate]);

  const reload = useCallback(() => {
    if (!user || !user.is_seller) return;
    setLoading(true);
    setError('');
    getMySales({ status: status === 'all' ? undefined : status, limit: 50 })
      .then(setOrders)
      .catch(err => {
        console.error('[sales] load failed', err);
        setError(err?.message || 'Không tải được đơn bán');
      })
      .finally(() => setLoading(false));
  }, [user, status]);

  useEffect(() => { reload(); }, [reload]);

  const handleConfirm = async (order) => {
    if (!window.confirm(`Xác nhận đơn #${order.orderNumber}?`)) return;
    try {
      await confirmShopOrder(order.id);
      reload();
    } catch (err) {
      alert(err?.message || 'Không xác nhận được');
    }
  };

  const handleShip = async (order) => {
    const tracking = window.prompt('Nhập mã vận đơn (có thể bỏ trống):', '');
    if (tracking === null) return;
    try {
      await shipShopOrder(order.id, tracking.trim() || null);
      reload();
    } catch (err) {
      alert(err?.message || 'Không cập nhật được trạng thái giao hàng');
    }
  };

  const handleCancel = async (order) => {
    const reason = window.prompt('Lý do huỷ đơn (sẽ gửi cho người mua):', '');
    if (!reason || !reason.trim()) return;
    try {
      await cancelShopOrder(order.id, reason.trim());
      reload();
    } catch (err) {
      alert(err?.message || 'Không huỷ được đơn');
    }
  };

  if (!user || !user.is_seller) {
    return <div className="apple-main" style={{ padding: 32 }}>Đang chuyển hướng…</div>;
  }

  return (
    <div className="shop-lg-scope shop-orders-scope" ref={rootRef}>
      <div className="shop-lg-stage" aria-hidden="true">
        <div className="shop-lg-blob b1" /><div className="shop-lg-blob b2" /><div className="shop-lg-blob b3" />
      </div>

      <header className="shop-lg-topbar">
        <div className="shop-lg-brand">
          <div className="shop-lg-brand-dot" />
          <span>Đơn bán của tôi</span>
        </div>
        <div className="shop-lg-crumbs">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/shop/dashboard'); }}>Quản lý cửa hàng</a>
          <span className="sep">›</span>
          <span style={{ color: 'var(--slg-txt)' }}>Đơn bán</span>
        </div>
        <div className="shop-lg-topright">
          <Link to="/shop/dashboard" className="shop-lg-icon-btn shop-lg-lq" style={{ width: 'auto', padding: '0 14px' }}>
            Quản lý sản phẩm
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
            Đang tải đơn bán…
          </div>
        ) : orders.length === 0 ? (
          <div className="shop-lg-glass shop-lg-empty" style={{ marginTop: 16 }}>
            <div className="icn">📭</div>
            <h3>Chưa có đơn bán nào</h3>
            <p>Khi có khách đặt mua sản phẩm của bạn, đơn hàng sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div className="shop-orders-list">
            {orders.map(order => (
              <SaleOrderCard
                key={order.id}
                order={order}
                onConfirm={handleConfirm}
                onShip={handleShip}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SaleOrderCard({ order, onConfirm, onShip, onCancel }) {
  const snap = parseSnapshot(order.productSnapshot);
  const img  = Array.isArray(snap.images) && snap.images.length ? snap.images[0] : null;
  const title = snap.title || `Sản phẩm #${order.productId}`;
  const st = STATUS_LABEL[order.status] || { text: order.status, tone: 'info' };
  const isDigital = snap.productType === 'digital';

  const canConfirm = order.status === 'pending';
  const canShip    = order.status === 'confirmed' && !isDigital;
  const canCancel  = order.status === 'pending';

  return (
    <div className="shop-lg-glass shop-order-card">
      <div className="shop-order-head">
        <div className="shop-order-shop">
          <strong>Người mua:</strong>&nbsp;{order.buyer?.username || `#${order.buyerId}`}
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
            <span>SL: <b>{order.quantity}</b></span>
            <span>Đơn giá: <b>{formatPrice(order.unitPrice)}</b></span>
            {!isDigital && order.shippingAddress && (
              <span title={order.shippingAddress} style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Giao đến: <b>{order.shippingAddress}</b>
              </span>
            )}
            {order.trackingNumber && <span>Mã vận đơn: <b>{order.trackingNumber}</b></span>}
          </div>
          {order.buyerNotes && <div className="shop-order-notes">Ghi chú khách: <i>{order.buyerNotes}</i></div>}
          <div className="shop-order-num">#{order.orderNumber}</div>
        </div>
        <div className="shop-order-total">
          <span>Bạn nhận</span>
          <strong>{formatPrice(order.sellerAmount)}</strong>
          <small>Tổng đơn: {formatPrice(order.totalPrice)}</small>
        </div>
      </div>

      <div className="shop-order-foot">
        <div className="shop-order-date">Ngày đặt: {new Date(order.createdAt).toLocaleString('vi-VN')}</div>
        <div className="shop-order-actions">
          {canConfirm && (
            <button className="shop-btn-primary" onClick={() => onConfirm(order)}>
              ✓ Xác nhận đơn
            </button>
          )}
          {canShip && (
            <button className="shop-btn-primary" onClick={() => onShip(order)}>
              🚚 Đánh dấu đã giao
            </button>
          )}
          {canCancel && (
            <button className="shop-btn-danger" onClick={() => onCancel(order)}>
              Huỷ đơn
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
