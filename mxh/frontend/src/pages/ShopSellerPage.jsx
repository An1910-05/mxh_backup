import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useShopCart } from '../hooks/useShopCart';
import {
  getShopProducts,
  getSellerInfo,
  getSellerReviewStats,
} from '../services/shop';
import { API_ORIGIN } from '../config';
import { useLiquidMetalRipple } from '../components/JolyText';

function mediaUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`;
}
function formatPrice(p) { return new Intl.NumberFormat('vi-VN').format(Number(p) || 0) + 'đ'; }
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

export default function ShopSellerPage() {
  const { sellerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { count: cartCount } = useShopCart();
  const rootRef = useRef(null);
  useLiquidMetalRipple(rootRef);

  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({ total: 0, avgRating: 0 });
  const [sortKey, setSortKey] = useState('popular');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = parseInt(sellerId);
    if (!id) { setError('ID người bán không hợp lệ'); setLoading(false); return; }

    setLoading(true);
    setError('');
    Promise.all([
      getSellerInfo(id).catch(() => null),
      getShopProducts({ sellerId: id, status: 'approved', limit: 60 }),
      getSellerReviewStats(id).catch(() => ({ total: 0, avgRating: 0 })),
    ])
      .then(([s, p, st]) => {
        setSeller(s);
        setProducts(p || []);
        setStats(st || { total: 0, avgRating: 0 });
      })
      .catch(err => {
        console.error('[seller-page] load failed', err);
        setError(err?.message || 'Không tải được trang shop');
      })
      .finally(() => setLoading(false));
  }, [sellerId]);

  const sorted = [...products].sort((a, b) => {
    switch (sortKey) {
      case 'price_asc':  return a.price - b.price;
      case 'price_desc': return b.price - a.price;
      case 'trusted':    return (b.soldCount || 0) - (a.soldCount || 0);
      case 'rating':     return (b.ratingAvg || 0) - (a.ratingAvg || 0);
      default:           return (b.viewCount || 0) - (a.viewCount || 0);
    }
  });

  const totalSold = products.reduce((s, p) => s + (Number(p.soldCount) || 0), 0);
  const [c1, c2] = pickGradient(seller?.username || sellerId);

  return (
    <div className="shop-lg-scope" ref={rootRef}>
      <div className="shop-lg-stage" aria-hidden="true">
        <div className="shop-lg-blob b1" /><div className="shop-lg-blob b2" /><div className="shop-lg-blob b3" />
      </div>

      <header className="shop-lg-topbar">
        <div className="shop-lg-brand">
          <div className="shop-lg-brand-dot" />
          <span>{seller?.username || 'Shop'}</span>
        </div>
        <div className="shop-lg-crumbs">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/shop'); }}>Shop</a>
          <span className="sep">›</span>
          <span style={{ color: 'var(--slg-txt)' }}>Cửa hàng</span>
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

      <main className="shop-lg-page">
        {error && (
          <div className="shop-lg-glass" style={{ padding: 16, color: 'var(--slg-danger)' }}>{error}</div>
        )}

        <section className="shop-lg-glass shop-seller-hero">
          <div className="shop-seller-cover" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
          <div className="shop-seller-info">
            <div className="shop-seller-ava" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
              {seller?.avatar ? <img src={mediaUrl(seller.avatar)} alt="" /> : initialsOf(seller?.username)}
            </div>
            <div className="shop-seller-meta">
              <div className="shop-seller-name">
                {seller?.username || `Người bán #${sellerId}`}
                {seller?.is_seller && <span className="shop-seller-badge"><i className="bi bi-patch-check-fill" /> Đã xác minh</span>}
              </div>
              <div className="shop-seller-stats">
                <div className="cell">
                  <span className="lbl">Sản phẩm</span>
                  <span className="val">{products.length}</span>
                </div>
                <div className="cell">
                  <span className="lbl">Đã bán</span>
                  <span className="val">{totalSold.toLocaleString('vi-VN')}</span>
                </div>
                <div className="cell">
                  <span className="lbl">Đánh giá</span>
                  <span className="val">
                    {stats.avgRating > 0 ? `★ ${Number(stats.avgRating).toFixed(1)}` : '—'}
                    <small>({stats.total})</small>
                  </span>
                </div>
              </div>
            </div>
            <div className="shop-seller-actions">
              {seller && user && seller.id !== user.id && (
                <Link to={`/chat?userId=${seller.id}`} className="shop-btn-primary"><i className="bi bi-chat-dots-fill" /> Nhắn shop</Link>
              )}
              <Link to={`/${seller?.custom_url || `profile_id=${sellerId}`}`} className="shop-btn-secondary">
                Trang cá nhân
              </Link>
            </div>
          </div>
        </section>

        <div className="shop-lg-glass shop-lg-toolbar" style={{ marginTop: 16 }}>
          <div className="shop-lg-toolbar-title">
            Sản phẩm của shop
            <span className="shop-lg-toolbar-count">{products.length} sản phẩm</span>
          </div>
          <div className="shop-lg-seg" role="tablist">
            {[
              { key: 'popular',    label: 'Phổ biến' },
              { key: 'rating',     label: 'Đánh giá cao' },
              { key: 'trusted',    label: 'Bán chạy' },
              { key: 'price_asc',  label: 'Giá ↑' },
              { key: 'price_desc', label: 'Giá ↓' },
            ].map(s => (
              <button
                key={s.key}
                className={'shop-lg-lq ' + (sortKey === s.key ? 'is-active' : '')}
                onClick={() => setSortKey(s.key)}
              >{s.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="shop-lg-glass" style={{ padding: 40, textAlign: 'center', color: 'var(--slg-txt-2)', marginTop: 16 }}>
            Đang tải shop…
          </div>
        ) : sorted.length === 0 ? (
          <div className="shop-lg-glass shop-lg-empty" style={{ marginTop: 16 }}>
            <div className="icn"><i className="bi bi-bag" /></div>
            <h3>Shop chưa có sản phẩm nào đang bán</h3>
          </div>
        ) : (
          <div className="shop-lg-grid">
            {sorted.map(p => <SellerProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function SellerProductCard({ product }) {
  const img = Array.isArray(product.images) && product.images.length ? product.images[0] : null;
  const [c1, c2] = pickGradient(product.title || product.id);
  const isService = product.productType === 'digital';
  const stockLabel = product.stockQuantity == null
    ? 'Thủ công'
    : Number(product.stockQuantity).toLocaleString('vi-VN');

  return (
    <Link to={`/shop/product/${product.id}`} className="shop-lg-card shop-lg-lq">
      <div className="shop-lg-card-img">
        {img
          ? <img src={mediaUrl(img)} alt={product.title} />
          : <div className="shop-lg-ph ph" style={{ '--c1': c1, '--c2': c2 }}><span>{(product.title || '?').slice(0, 20)}</span></div>}
        <div className="shop-lg-stock-chip">
          <span>Tồn kho</span>
          <strong>{stockLabel}</strong>
        </div>
      </div>
      <div className="shop-lg-card-body">
        <span className={'shop-lg-tag ' + (isService ? 'service' : '')}>
          {isService ? 'Dịch vụ' : 'Sản phẩm'}
        </span>
        <h3 className="shop-lg-card-title">{product.title}</h3>
        <div className="shop-lg-meta">
          <span className="shop-lg-stars">
            {product.ratingAvg > 0 ? `★ ${Number(product.ratingAvg).toFixed(1)}` : '★ Chưa có'}
          </span>
          <span className="shop-lg-dot" />
          <span>Đã bán <b style={{ color: 'var(--slg-txt)' }}>{Number(product.soldCount || 0).toLocaleString('vi-VN')}</b></span>
          <span className="shop-lg-dot" />
          <span>{product.reviewCount || 0} đánh giá</span>
        </div>
        <div className="shop-lg-price-row">
          <span className="shop-lg-price">{formatPrice(product.price)}</span>
        </div>
      </div>
    </Link>
  );
}
