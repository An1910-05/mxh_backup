import { useState, useEffect } from 'react';
import { getOrderTracking } from '../services/shop';

/**
 * Modal hiển thị lộ trình vận chuyển của một đơn hàng (lấy realtime từ carrier
 * qua query orderTracking). Bước mới nhất hiển thị trên cùng.
 *
 * Props: order { id, orderNumber, shippingCarrier, trackingNumber }, onClose.
 */
function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  if (isNaN(d.getTime())) return t;
  return d.toLocaleString('vi-VN');
}

export default function OrderTrackingModal({ order, onClose }) {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getOrderTracking(order.id)
      .then(rows => { if (alive) setSteps(rows); })
      .catch(err => { if (alive) setError(err?.message || 'Không tra cứu được lộ trình'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [order.id]);

  return (
    <div className="shop-modal-backdrop" onClick={onClose}>
      <div className="shop-modal" onClick={e => e.stopPropagation()}>
        <div className="shop-modal-header">
          <h2>Lộ trình đơn #{order.orderNumber}</h2>
          <button className="shop-modal-close" onClick={onClose} type="button">×</button>
        </div>

        <div className="shop-modal-form">
          <div style={{ fontSize: 14, color: 'var(--slg-txt-2, #6b7280)', marginBottom: 4 }}>
            {order.shippingCarrier && <span>Đơn vị: <b>{order.shippingCarrier}</b></span>}
            {order.trackingNumber && <span>{order.shippingCarrier ? ' · ' : ''}Mã VĐ: <b>{order.trackingNumber}</b></span>}
          </div>

          {loading && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--slg-txt-2, #6b7280)' }}>
              Đang tra cứu lộ trình…
            </div>
          )}

          {!loading && error && (
            <div className="shop-form-error">{error}</div>
          )}

          {!loading && !error && steps.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--slg-txt-2, #6b7280)' }}>
              Chưa có thông tin lộ trình cho đơn này.
            </div>
          )}

          {!loading && !error && steps.length > 0 && (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {steps.map((s, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderLeft: '2px solid #e5e7eb', marginLeft: 6, paddingLeft: 16, position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: -7, top: 14, width: 12, height: 12, borderRadius: '50%',
                    background: i === 0 ? '#2563eb' : '#9ca3af', border: '2px solid #fff',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: i === 0 ? 700 : 500, color: i === 0 ? '#111827' : '#374151' }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{formatTime(s.time)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="shop-modal-footer">
            <button type="button" className="shop-btn-secondary" onClick={onClose}>Đóng</button>
          </div>
        </div>
      </div>
    </div>
  );
}
