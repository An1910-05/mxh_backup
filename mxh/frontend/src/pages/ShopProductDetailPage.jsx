import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useShopCart } from '../hooks/useShopCart';
import { getShopProduct } from '../services/shop';
import { API_ORIGIN } from '../config';
import { TypewriterText, useLiquidMetalRipple } from '../components/JolyText';

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
    ['#ef4444','#b91c1c'], ['#f3c693','#e89a5a'], ['#af52de','#5a1d8a'],
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

export default function ShopProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, count: cartCount } = useShopCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState('desc');
  const [addedToast, setAddedToast] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getShopProduct(productId)
      .then((p) => { setProduct(p); setActiveImage(0); setQty(1); })
      .catch((err) => {
        console.error('[shop product] load failed', err);
        setError(err?.message || 'Không tải được sản phẩm');
      })
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    const el = document.getElementById('shop-lg-root-detail');
    return attachPointerTracking(el);
  }, [product]);

  useEffect(() => {
    if (!addedToast) return;
    const t = setTimeout(() => setAddedToast(''), 2400);
    return () => clearTimeout(t);
  }, [addedToast]);

  const handleAddToCart = () => {
    if (!user) { navigate('/login'); return; }
    if (!product) return;
    addItem(product, qty);
    setAddedToast(`Đã thêm ${qty} × ${product.title} vào giỏ`);
  };

  const handleBuyNow = () => {
    if (!user) { navigate('/login'); return; }
    if (!product) return;
    addItem(product, qty);
    navigate('/shop/cart');
  };

  const totalPrice = useMemo(() => (Number(product?.price) || 0) * Math.max(1, qty), [product, qty]);
  const stockLabel = product?.stockQuantity == null
    ? 'Thủ công'
    : Number(product.stockQuantity).toLocaleString('vi-VN');

  if (loading) {
    return (
      <DetailShell cartCount={cartCount}>
        <div className="shop-lg-glass" style={{ padding: 60, textAlign: 'center', color: 'var(--slg-txt-2)' }}>
          <TypewriterText text="Đang tải sản phẩm…" speed={40} />
        </div>
      </DetailShell>
    );
  }

  if (error || !product) {
    return (
      <DetailShell cartCount={cartCount}>
        <div className="shop-lg-glass shop-lg-empty">
          <div className="icn">⚠️</div>
          <h3>{error || 'Không tìm thấy sản phẩm'}</h3>
          <p><Link to="/shop">← Quay lại Shop</Link></p>
        </div>
      </DetailShell>
    );
  }

  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const hasImages = images.length > 0;
  const [pc1, pc2] = pickGradient(product.title || product.id);
  const isService = product.productType === 'digital';
  const sellerInitials = initialsOf(product.seller?.username);
  const [sc1, sc2] = pickGradient(product.seller?.username || product.sellerId);

  return (
    <DetailShell cartCount={cartCount} crumbTitle={product.title}>
      <Link to="/shop" className="shop-lg-back-link">← Quay lại Shop</Link>

      <section className="shop-lg-hero">
        <div className="shop-lg-glass shop-lg-gallery">
          <div className="main">
            {hasImages
              ? <img src={mediaUrl(images[activeImage] || images[0])} alt={product.title} />
              : <div className="placeholder" style={{ background: `linear-gradient(135deg, ${pc1}, ${pc2})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: 'none', filter: 'none', borderRadius: 12 }}>
                  <span style={{ padding: 16, textAlign: 'center', fontWeight: 700, fontSize: 18 }}>{product.title}</span>
                </div>}
          </div>
          {images.length > 1 && (
            <div className="shop-lg-thumbs">
              {images.map((src, i) => (
                <button
                  key={i}
                  className={'shop-lg-lq ' + (activeImage === i ? 'is-on' : '')}
                  onClick={() => setActiveImage(i)}
                >
                  <img src={mediaUrl(src)} alt={`thumb ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="shop-lg-glass shop-lg-buybox">
          <div className="shop-lg-tag-line">
            {product.category?.name && <span className="shop-lg-cat-tag">{product.category.name}</span>}
            <span className={'shop-lg-tag ' + (isService ? 'service' : '')}>
              {isService ? 'Dịch vụ' : 'Sản phẩm số'}
            </span>
          </div>

          <h1 className="shop-lg-title-h1">{product.title}</h1>

          <div className="shop-lg-meta-row">
            <span style={{ color: '#ffb800', letterSpacing: 1 }}>★★★★★</span>
            <span>4.9 <span style={{ color: 'var(--slg-txt-3)' }}>({Number(product.viewCount || 0).toLocaleString('vi-VN')} lượt xem)</span></span>
            <span className="sep" />
            <span>Đã bán: <b>{Number(product.soldCount || 0).toLocaleString('vi-VN')}</b></span>
            <span className="sep" />
            <span>Tồn kho: <b>{stockLabel}</b></span>
          </div>

          <div className="shop-lg-seller-row">
            <div className="shop-lg-seller-ava" style={{ background: `linear-gradient(135deg, ${sc1}, ${sc2})` }}>
              {product.seller?.avatar
                ? <img src={mediaUrl(product.seller.avatar)} alt="" />
                : sellerInitials}
            </div>
            <div className="info">
              <div className="nm">
                {product.seller?.username || 'Ẩn danh'}
                <span style={{ color: 'var(--slg-ok)', fontSize: 11.5, fontWeight: 500 }}>● Online</span>
              </div>
              <div className="sub">
                <span style={{ color: '#ffb800' }}>★ 5.0</span>
                <span>• Đã bán {Number(product.soldCount || 0)}</span>
              </div>
            </div>
            <div className="shop-lg-seller-actions">
              <Link to={`/${product.seller?.custom_url || product.seller?.username || ''}`} className="shop-lg-lq">
                Xem Shop
              </Link>
            </div>
          </div>

          <div className="shop-lg-price-block">
            <span className="price">{formatPrice(product.price)}</span>
          </div>

          <div className="shop-lg-qty-row">
            <span className="l">Số lượng</span>
            <div className="shop-lg-qty">
              <button type="button" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <input
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
              />
              <button type="button" onClick={() => setQty(qty + 1)}>+</button>
            </div>
            <span className="shop-lg-stock-line">Còn <b style={{ color: 'var(--slg-txt)' }}>{stockLabel}</b></span>
          </div>

          <div className="shop-lg-cta-row">
            <button type="button" className="shop-lg-btn-cart shop-lg-lq" onClick={handleAddToCart}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7H18a2 2 0 0 0 2-1.6L21.5 8H6"/>
                <circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>
              </svg>
              Thêm vào giỏ
            </button>
            <button type="button" className="shop-lg-btn-buy shop-lg-lq tinted" onClick={handleBuyNow}>
              Mua ngay · {formatPrice(totalPrice)}
            </button>
          </div>

          {addedToast && (
            <div className="shop-lg-glass" style={{ padding: 10, fontSize: 13, color: 'var(--slg-ok)', background: 'rgba(48,194,102,0.10)' }}>
              ✓ {addedToast}
            </div>
          )}

          <div className="shop-lg-promises">
            <div className="shop-lg-promise">
              <svg className="pi" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v7c0 5 4 8 8 10 4-2 8-5 8-10V5l-8-3Z"/></svg>
              <div className="pt">Bảo hành đầy đủ</div>
              <div className="ps">Hoàn tiền nếu sai sản phẩm</div>
            </div>
            <div className="shop-lg-promise">
              <svg className="pi" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 3 14h7v8l10-12h-7V2Z"/></svg>
              <div className="pt">Giao ngay tức thì</div>
              <div className="ps">Nhận tài khoản trong vài phút</div>
            </div>
            <div className="shop-lg-promise">
              <svg className="pi" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8 8 0 1 1-3.2-6.4L21 5l-1.3 3.7"/></svg>
              <div className="pt">Hỗ trợ 24/7</div>
              <div className="ps">Chat trực tiếp với shop</div>
            </div>
          </div>
        </div>
      </section>

      <div className="shop-lg-tabs">
        <div className="shop-lg-tabs-bar">
          <button className={'shop-lg-lq ' + (tab === 'desc' ? 'is-on' : '')} onClick={() => setTab('desc')}>
            Mô tả sản phẩm
          </button>
          <button className={'shop-lg-lq ' + (tab === 'policy' ? 'is-on' : '')} onClick={() => setTab('policy')}>
            Bảo hành & Đổi trả
          </button>
        </div>

        <div className="shop-lg-tab-content">
          {tab === 'desc' && (
            <div className="shop-lg-glass shop-lg-desc-main">
              <h2>Mô tả</h2>
              {product.description
                ? product.description.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)
                : <p style={{ color: 'var(--slg-txt-2)' }}>Người bán chưa cập nhật mô tả chi tiết.</p>}
            </div>
          )}
          {tab === 'policy' && (
            <div className="shop-lg-glass shop-lg-desc-main">
              <h2>Chính sách bảo hành</h2>
              <ul>
                <li>Hoàn tiền 100% nếu tài khoản không sử dụng được trong vòng 24h sau khi mua.</li>
                <li>Liên hệ shop qua tin nhắn để được hỗ trợ thay pass/khắc phục lỗi.</li>
                <li>Không bảo hành các trường hợp do người dùng đổi pass sai hoặc vi phạm chính sách dịch vụ.</li>
              </ul>
              <h2>Quy trình hỗ trợ</h2>
              <p>1. Nhắn shop kèm mã đơn hàng. 2. Shop kiểm tra trong vòng 15 phút. 3. Cấp lại tài khoản hoặc hoàn tiền tuỳ trường hợp.</p>
            </div>
          )}
        </div>
      </div>
    </DetailShell>
  );
}

function DetailShell({ children, cartCount = 0, crumbTitle }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  useLiquidMetalRipple(rootRef);
  return (
    <div id="shop-lg-root-detail" className="shop-lg-scope" ref={rootRef}>
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
          <span style={{ color: 'var(--slg-txt)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {crumbTitle || 'Sản phẩm'}
          </span>
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
            {cartCount > 0 && <span className="shop-lg-badge">{cartCount}</span>}
          </button>
        </div>
      </header>
      <main className="shop-lg-page">{children}</main>
    </div>
  );
}
