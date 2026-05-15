import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useShopCart } from '../hooks/useShopCart';
import { createShopOrder } from '../services/shop';
import { API_ORIGIN } from '../config';
import { useLiquidMetalRipple } from '../components/JolyText';

function mediaUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`;
}

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN').format(Number(price) || 0) + 'đ';
}

function initialsOf(name) {
  if (!name) return '?';
  return name.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
}

function pickGradient(seed) {
  const palettes = [
    ['#ff8a3c','#ff4757'], ['#0a84ff','#5856d6'], ['#30c266','#0a7cff'],
    ['#a55eea','#3742fa'], ['#10b981','#065f46'], ['#0a7cff','#1330a8'],
  ];
  const s = String(seed || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return palettes[Math.abs(hash) % palettes.length];
}

function attachPointerTracking(scope) {
  if (!scope) return () => {};
  const onMove = (e) => {
    const t = e.target.closest && e.target.closest('.shop-lg-lq');
    if (!t || !scope.contains(t)) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--slg-mx', ((e.clientX - r.left) / r.width * 100) + '%');
    t.style.setProperty('--slg-my', ((e.clientY - r.top) / r.height * 100) + '%');
  };
  scope.addEventListener('pointermove', onMove, { passive: true });
  return () => scope.removeEventListener('pointermove', onMove);
}

export default function ShopCartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useShopCart();
  const rootRef = useRef(null);
  useLiquidMetalRipple(rootRef);
  const [coupon, setCoupon] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [buyerNotes, setBuyerNotes] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const el = document.getElementById('shop-lg-root-cart');
    return attachPointerTracking(el);
  }, []);

  // Group items by seller
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of cart.items) {
      const key = item.sellerId ?? 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          sellerId: item.sellerId,
          sellerName: item.sellerName || 'Shop',
          sellerAvatar: item.sellerAvatar || null,
          items: [],
        });
      }
      map.get(key).items.push(item);
    }
    return Array.from(map.values());
  }, [cart.items]);

  const discountCoupon = coupon.trim().toUpperCase() === 'IPOCK10'
    ? Math.min(50000, Math.round(cart.subtotal * 0.1))
    : 0;
  const total = Math.max(0, cart.subtotal - discountCoupon);

  const handleCheckout = async () => {
    if (!user) { navigate('/login'); return; }
    if (cart.selectedItems.length === 0) {
      setError('Vui lòng chọn ít nhất một sản phẩm để đặt hàng.');
      return;
    }
    setCheckingOut(true);
    setError('');
    setSuccessMsg('');

    const ok = [];
    const fail = [];
    for (const item of cart.selectedItems) {
      try {
        const order = await createShopOrder({
          productId: Number(item.productId),
          quantity: Number(item.qty) || 1,
          shippingAddress: shippingAddress.trim() || null,
          buyerNotes: buyerNotes.trim() || null,
        });
        ok.push({ item, order });
      } catch (err) {
        console.error('[cart] createOrder failed for', item.productId, err);
        fail.push({ item, message: err?.message || 'Lỗi không xác định' });
      }
    }

    if (ok.length > 0) {
      // Remove successfully ordered items from cart
      for (const { item } of ok) cart.removeItem(item.productId);
      setSuccessMsg(`Đã tạo ${ok.length} đơn hàng. Vào trang Lịch sử mua hàng để xem chi tiết.`);
    }
    if (fail.length > 0) {
      setError(`Có ${fail.length} sản phẩm không đặt được:\n` + fail.map(f => `• ${f.item.title}: ${f.message}`).join('\n'));
    }
    setCheckingOut(false);
  };

  return (
    <div id="shop-lg-root-cart" className="shop-lg-scope" ref={rootRef}>
      <div className="shop-lg-stage" aria-hidden="true">
        <div className="shop-lg-blob b1" /><div className="shop-lg-blob b2" /><div className="shop-lg-blob b3" />
      </div>

      <header className="shop-lg-topbar">
        <div className="shop-lg-brand">
          <div className="shop-lg-brand-dot" />
          <span>iPock Shop</span>
        </div>
        <div className="shop-lg-crumbs">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/shop'); }}>Shop</a>
          <span className="sep">›</span>
          <span style={{ color: 'var(--slg-txt)' }}>Giỏ hàng</span>
        </div>
        <div className="shop-lg-topright">
          <button
            className="shop-lg-icon-btn shop-lg-lq"
            onClick={() => navigate('/shop/cart')}
            aria-label="Giỏ hàng"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7H18a2 2 0 0 0 2-1.6L21.5 8H6"/>
              <circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>
            </svg>
            {cart.count > 0 && <span className="shop-lg-badge">{cart.count}</span>}
          </button>
        </div>
      </header>

      <main className="shop-lg-page">
        <Link to="/shop" className="shop-lg-back-link">← Tiếp tục mua sắm</Link>

        <div style={{ margin: '8px 4px 22px' }}>
          <h1 style={{ margin: 0, font: '700 26px var(--sf)', letterSpacing: '-0.02em', color: 'var(--slg-txt)' }}>
            Giỏ hàng
          </h1>
          <div style={{ fontSize: 13, color: 'var(--slg-txt-2)', marginTop: 6 }}>
            {cart.items.length} sản phẩm trong giỏ · {cart.selectedItems.length} đã chọn
          </div>
        </div>

        {cart.items.length === 0 ? (
          <div className="shop-lg-glass shop-lg-empty">
            <div className="icn">🛒</div>
            <h3>Giỏ hàng trống</h3>
            <p><Link to="/shop">← Quay lại Shop để mua sắm</Link></p>
          </div>
        ) : (
          <div className="shop-lg-layout-cart">
            <section className="shop-lg-glass shop-lg-cart-list">
              <div className="shop-lg-row shop-lg-row-head" style={{ borderBottom: '1px solid var(--slg-glass-hairline)' }}>
                <div />
                <div style={{ gridColumn: 'span 2' }}>Sản phẩm</div>
                <div className="col-unit">Đơn giá</div>
                <div>Số lượng</div>
                <div className="col-sub" style={{ textAlign: 'right' }}>Thành tiền</div>
                <div />
              </div>

              {groups.map(group => {
                const allOn = group.items.length > 0 && group.items.every(i => i.selected);
                const [c1, c2] = pickGradient(group.sellerName);
                return (
                  <div key={String(group.sellerId)} className="shop-lg-shop-group">
                    <div className="shop-lg-shop-head">
                      <input
                        type="checkbox"
                        className="shop-lg-ck"
                        checked={allOn}
                        onChange={() => cart.toggleSelectShop(group.sellerId)}
                      />
                      <span className="shop-lg-shop-ava" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                        {group.sellerAvatar
                          ? <img src={mediaUrl(group.sellerAvatar)} alt="" />
                          : initialsOf(group.sellerName)}
                      </span>
                      <span className="shop-lg-shop-name">{group.sellerName}</span>
                    </div>

                    {group.items.map(item => {
                      const [pc1, pc2] = pickGradient(item.title);
                      return (
                        <div className="shop-lg-row" key={item.productId}>
                          <input
                            type="checkbox"
                            className="shop-lg-ck"
                            checked={!!item.selected}
                            onChange={() => cart.toggleSelect(item.productId)}
                          />
                          <div className="shop-lg-thumb">
                            {item.image
                              ? <img src={mediaUrl(item.image)} alt={item.title} />
                              : <div className="ph" style={{ '--c1': pc1, '--c2': pc2 }}>{(item.title || '?').slice(0, 14)}</div>}
                          </div>
                          <div className="shop-lg-info">
                            <Link
                              to={`/shop/product/${item.productId}`}
                              className="name"
                              style={{ color: 'inherit', textDecoration: 'none' }}
                            >
                              {item.title}
                            </Link>
                          </div>
                          <div className="shop-lg-unit">{formatPrice(item.price)}</div>
                          <div className="shop-lg-qty">
                            <button type="button" onClick={() => cart.setQty(item.productId, item.qty - 1)}>−</button>
                            <input
                              value={item.qty}
                              onChange={(e) => cart.setQty(item.productId, parseInt(e.target.value || '1', 10))}
                            />
                            <button type="button" onClick={() => cart.setQty(item.productId, item.qty + 1)}>+</button>
                          </div>
                          <div className="shop-lg-subtotal">{formatPrice(item.price * item.qty)}</div>
                          <button
                            type="button"
                            className="shop-lg-del"
                            onClick={() => cart.removeItem(item.productId)}
                            aria-label="Xoá"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1.2 13.2A2 2 0 0 1 15.8 21H8.2A2 2 0 0 1 6.2 19.2L5 6"/>
                              <path d="M10 11v6M14 11v6"/>
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <div className="shop-lg-footbar shop-lg-glass">
                <label className="lbl">
                  <input
                    type="checkbox"
                    className="shop-lg-ck"
                    checked={cart.items.length > 0 && cart.items.every(i => i.selected)}
                    onChange={cart.toggleSelectAll}
                  />
                  Chọn tất cả ({cart.items.length})
                </label>
                <button type="button" className="delete-all" onClick={cart.removeSelected}>
                  Xoá đã chọn
                </button>
                <div className="sum">
                  <div className="sum-lbl">Tổng ({cart.selectedItems.length} sản phẩm)</div>
                  <div className="sum-val">{formatPrice(total)}</div>
                </div>
                <button
                  type="button"
                  className="shop-lg-checkout shop-lg-lq tinted"
                  onClick={handleCheckout}
                  disabled={checkingOut || cart.selectedItems.length === 0}
                >
                  {checkingOut ? 'Đang đặt…' : 'Thanh toán'}
                </button>
              </div>
            </section>

            <aside className="shop-lg-glass shop-lg-summary">
              <h3>Tóm tắt đơn hàng</h3>
              <div className="shop-lg-sline"><span>Tạm tính</span><strong>{formatPrice(cart.subtotal)}</strong></div>
              <div className="shop-lg-sline"><span>Mã giảm giá</span><strong>− {formatPrice(discountCoupon)}</strong></div>
              <div className="shop-lg-sline"><span>Phí giao dịch</span><strong>0đ</strong></div>

              <div style={{ display: 'flex', gap: 8, padding: '4px 4px 4px 12px', borderRadius: 14, background: 'rgba(127,127,127,0.08)', border: '1px solid var(--slg-glass-hairline)', margin: '12px 0 6px' }}>
                <input
                  placeholder="Nhập mã giảm giá (thử IPOCK10)"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: '500 13px var(--sf)', color: 'var(--slg-txt)', padding: '8px 0' }}
                />
              </div>

              <h3 style={{ marginTop: 16 }}>Thông tin đặt hàng</h3>
              <textarea
                rows={2}
                placeholder="Địa chỉ / liên hệ nhận hàng (tuỳ chọn)"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                style={{
                  width: '100%', padding: 10, borderRadius: 12,
                  border: '1px solid var(--slg-glass-hairline)',
                  background: 'var(--slg-glass-strong)', color: 'var(--slg-txt)',
                  font: '500 13px var(--sf)', outline: 'none', resize: 'vertical',
                }}
              />
              <textarea
                rows={2}
                placeholder="Ghi chú cho người bán (tuỳ chọn)"
                value={buyerNotes}
                onChange={(e) => setBuyerNotes(e.target.value)}
                style={{
                  width: '100%', padding: 10, borderRadius: 12,
                  border: '1px solid var(--slg-glass-hairline)',
                  background: 'var(--slg-glass-strong)', color: 'var(--slg-txt)',
                  font: '500 13px var(--sf)', outline: 'none', resize: 'vertical',
                  marginTop: 8,
                }}
              />

              <div className="sep" />
              <div className="total">
                <span className="l">Tổng cộng</span>
                <span className="r">{formatPrice(total)}</span>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'rgba(255,69,58,0.08)', color: 'var(--slg-danger)', fontSize: 13, whiteSpace: 'pre-line' }}>
                  {error}
                </div>
              )}
              {successMsg && (
                <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'rgba(48,194,102,0.10)', color: 'var(--slg-ok)', fontSize: 13 }}>
                  ✓ {successMsg}
                </div>
              )}

              <button
                type="button"
                className="shop-lg-checkout shop-lg-lq tinted"
                style={{ width: '100%', marginTop: 16 }}
                onClick={handleCheckout}
                disabled={checkingOut || cart.selectedItems.length === 0}
              >
                {checkingOut ? 'Đang đặt…' : `Đặt hàng · ${formatPrice(total)}`}
              </button>

              <div style={{ marginTop: 14, padding: 14, borderRadius: 16, background: 'rgba(127,127,127,0.06)', border: '1px solid var(--slg-glass-hairline)', fontSize: 12.5, color: 'var(--slg-txt-2)', lineHeight: 1.5 }}>
                Mỗi đơn hàng được tạo riêng cho từng sản phẩm đã chọn. Bạn có thể theo dõi đơn hàng trong mục lịch sử mua hàng.
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
