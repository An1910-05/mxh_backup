import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useShopCart } from '../hooks/useShopCart';
import { getMyShopApplication, getShopCategories, getShopProducts } from '../services/shop';
import { API_ORIGIN } from '../config';
import { GlitchText, TypewriterText, useLiquidMetalRipple } from '../components/JolyText';

function mediaUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`;
}

const SORT_OPTIONS = [
  { key: 'popular',    label: 'Phổ Biến',     icon: '⚡' },
  { key: 'trusted',    label: 'Shop Mall',    icon: '★' },
  { key: 'price_asc',  label: 'Giá tăng dần', icon: '↑' },
  { key: 'price_desc', label: 'Giá giảm dần', icon: '↓' },
];

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
    ['#a55eea','#3742fa'], ['#1db954','#063b1f'], ['#10b981','#065f46'],
    ['#0a7cff','#1330a8'], ['#ef4444','#b91c1c'], ['#f3c693','#e89a5a'],
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

function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.1 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.7-4.7 1.4 1.4-6.1 6.1Z"/></svg>;
}

export default function ShopPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { count: cartCount } = useShopCart();
  const rootRef = useRef(null);
  useLiquidMetalRipple(rootRef);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [sortKey, setSortKey] = useState('popular');
  const [loading, setLoading] = useState(true);
  const [myApp, setMyApp] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { setMyApp(null); return; }
    if (user.is_seller) { setMyApp({ status: 'approved' }); return; }
    getMyShopApplication().then(setMyApp).catch(err => console.error('[shop] load my-app failed', err));
  }, [user]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getShopCategories(),
      getShopProducts({
        categoryId: selectedCategory,
        search: activeSearch || undefined,
        status: 'approved',
        limit: 50,
      }),
    ])
      .then(([cats, prods]) => { setCategories(cats || []); setProducts(prods || []); setError(''); })
      .catch(err => {
        console.error('[shop] load failed:', err);
        setError(err?.message || 'Không tải được dữ liệu shop');
      })
      .finally(() => setLoading(false));
  }, [selectedCategory, activeSearch]);

  useEffect(() => {
    const el = document.getElementById('shop-lg-root');
    return attachPointerTracking(el);
  }, []);

  const sortedProducts = useMemo(() => {
    const arr = [...products];
    switch (sortKey) {
      case 'price_asc': arr.sort((a, b) => a.price - b.price); break;
      case 'price_desc': arr.sort((a, b) => b.price - a.price); break;
      case 'trusted': arr.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0)); break;
      case 'popular':
      default: arr.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    }
    return arr;
  }, [products, sortKey]);

  const activeCategoryName = selectedCategory
    ? categories.find(c => c.id === selectedCategory)?.name || 'Tất cả'
    : 'Tất cả';

  const sellerCta = (() => {
    if (!user) return null;
    if (user.is_seller) {
      return (
        <>
          <Link to="/shop/dashboard" className="shop-lg-seller-cta shop-lg-lq tinted">Quản lý cửa hàng</Link>
          <Link to="/shop/sales" className="shop-lg-seller-cta shop-lg-lq" style={{ marginTop: 6 }}>Đơn bán của tôi</Link>
        </>
      );
    }
    if (myApp?.status === 'pending') return <span className="shop-lg-seller-cta ghost">Đơn đăng ký đang chờ duyệt</span>;
    if (myApp?.status === 'rejected') return <Link to="/shop/register" className="shop-lg-seller-cta ghost">Đơn bị từ chối — Xem lại</Link>;
    return <Link to="/shop/register" className="shop-lg-seller-cta shop-lg-lq tinted">+ Đăng ký bán hàng</Link>;
  })();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearch(search.trim());
  };

  const isFiltered = selectedCategory !== null || sortKey !== 'popular' || activeSearch;
  const clearAll = () => { setSelectedCategory(null); setSortKey('popular'); setSearch(''); setActiveSearch(''); };

  return (
    <div id="shop-lg-root" className="shop-lg-scope" ref={rootRef}>
      <div className="shop-lg-stage" aria-hidden="true">
        <div className="shop-lg-blob b1" /><div className="shop-lg-blob b2" />
        <div className="shop-lg-blob b3" /><div className="shop-lg-blob b4" />
      </div>

      <header className="shop-lg-topbar">
        <div className="shop-lg-brand">
          <div className="shop-lg-brand-dot" />
          <span className="jly-hero-title">iPock Shop</span>
          <span style={{ color: 'var(--slg-txt-3)', fontWeight: 500, marginLeft: 6, fontSize: 13 }}>
            · <GlitchText
                words={['Marketplace số', 'Giao ngay tức thì', 'Uy tín 24/7', 'Hoàn tiền 100%']}
                interval={3500}
                glitchDuration={350}
              />
          </span>
        </div>
        <div className="shop-lg-crumbs">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Trang chủ</a>
          <span className="sep">›</span>
          <span style={{ color: 'var(--slg-txt)' }}>Shop</span>
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
        <div className="shop-lg-layout">
          <aside className="shop-lg-glass shop-lg-side">
            <h3>Danh mục sản phẩm</h3>
            <button
              className={`shop-lg-cat shop-lg-lq${selectedCategory === null ? ' is-active' : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              <span className="ico">⊙</span>
              <span>Tất cả</span>
              <span className="chev">›</span>
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                className={`shop-lg-cat shop-lg-lq${selectedCategory === c.id ? ' is-active' : ''}`}
                onClick={() => setSelectedCategory(c.id)}
              >
                <span className="ico">{c.icon || '◇'}</span>
                <span>{c.name}</span>
                <span className="chev">›</span>
              </button>
            ))}

            <div className="shop-lg-side-sep" />
            {user && (
              <Link to="/shop/orders" className="shop-lg-seller-cta shop-lg-lq" style={{ marginBottom: 6 }}>
                📦 Đơn mua của tôi
              </Link>
            )}
            {sellerCta}

            <div className="shop-lg-helpcard">
              <h4>Bài viết hữu ích</h4>
              <p>iPock Shop — chợ giao dịch số &amp; dịch vụ MMO uy tín cho cộng đồng MXH.</p>
              <a href="#">Xem thêm →</a>
            </div>
          </aside>

          <section className="shop-lg-main">
            <form className="shop-lg-glass shop-lg-search" onSubmit={handleSearchSubmit}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
              <input
                placeholder="Tìm kiếm sản phẩm, dịch vụ, shop…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button type="submit" className="shop-lg-search-btn shop-lg-lq tinted">
                Tìm
              </button>
            </form>

            <div className="shop-lg-glass shop-lg-toolbar">
              <div className="shop-lg-toolbar-title">
                {activeCategoryName}
                <span className="shop-lg-toolbar-count">{sortedProducts.length} sản phẩm</span>
              </div>
              <div className="shop-lg-seg" role="tablist">
                {SORT_OPTIONS.map(s => (
                  <button
                    key={s.key}
                    className={'shop-lg-lq ' + (sortKey === s.key ? 'is-active' : '')}
                    onClick={() => setSortKey(s.key)}
                  >
                    <span aria-hidden="true">{s.icon}</span> {s.label}
                  </button>
                ))}
              </div>
            </div>

            {isFiltered && (
              <div className="shop-lg-filter-chips">
                <span style={{ fontSize: 12.5, color: 'var(--slg-txt-3)' }}>Đang lọc:</span>
                {selectedCategory !== null && (
                  <span className="shop-lg-fchip">
                    {activeCategoryName}
                    <button onClick={() => setSelectedCategory(null)} aria-label="Bỏ danh mục">×</button>
                  </span>
                )}
                {sortKey !== 'popular' && (
                  <span className="shop-lg-fchip">
                    {SORT_OPTIONS.find(s => s.key === sortKey).label}
                    <button onClick={() => setSortKey('popular')} aria-label="Bỏ sắp xếp">×</button>
                  </span>
                )}
                {activeSearch && (
                  <span className="shop-lg-fchip">
                    “{activeSearch}”
                    <button onClick={() => { setSearch(''); setActiveSearch(''); }} aria-label="Bỏ tìm kiếm">×</button>
                  </span>
                )}
                <button type="button" className="shop-lg-fchip" onClick={clearAll}>Xoá tất cả</button>
              </div>
            )}

            {error && <div className="shop-lg-glass" style={{ padding: 16, color: 'var(--slg-danger)' }}>{error}</div>}

            {loading ? (
              <div className="shop-lg-glass" style={{ padding: 40, textAlign: 'center', color: 'var(--slg-txt-2)' }}>
                <TypewriterText text="Đang tải sản phẩm…" speed={40} />
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="shop-lg-glass shop-lg-empty">
                <div className="icn">🛍</div>
                <h3>Không có sản phẩm nào</h3>
                <p>Hãy thử danh mục khác hoặc tìm với từ khoá khác.</p>
              </div>
            ) : (
              <div className="shop-lg-grid">
                {sortedProducts.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ProductCard({ product }) {
  const img = Array.isArray(product.images) && product.images.length ? product.images[0] : null;
  const isService = product.productType === 'digital';
  const stockLabel = product.stockQuantity == null
    ? 'Thủ công'
    : Number(product.stockQuantity).toLocaleString('vi-VN');
  const [c1, c2] = pickGradient(product.title || product.id);
  const sellerInitials = initialsOf(product.seller?.username);
  const [sc1, sc2] = pickGradient(product.seller?.username || product.sellerId);

  return (
    <Link to={`/shop/product/${product.id}`} className="shop-lg-card shop-lg-lq">
      <div className="shop-lg-card-img">
        <span className="shop-lg-badge-corner">KHÔNG TRÙNG</span>
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
          <span className="shop-lg-stars">★★★★★</span>
          <span className="shop-lg-dot" />
          <span>Đã bán <b style={{ color: 'var(--slg-txt)' }}>{Number(product.soldCount || 0).toLocaleString('vi-VN')}</b></span>
          <span className="shop-lg-dot" />
          <span>Khiếu nại 0.0%</span>
        </div>
        <div className="shop-lg-seller">
          <span className="shop-lg-seller-avatar" style={{ background: `linear-gradient(135deg, ${sc1}, ${sc2})` }}>
            {product.seller?.avatar
              ? <img src={mediaUrl(product.seller.avatar)} alt="" />
              : sellerInitials}
          </span>
          <span>Người bán:</span>
          <span className="name">{product.seller?.username || 'Ẩn danh'}</span>
          <span className="shop-lg-verified"><CheckIcon /> Đã xác thực</span>
        </div>
        {product.description && (
          <div className="shop-lg-desc">• {product.description}</div>
        )}
        <div className="shop-lg-price-row">
          <span className="shop-lg-price">{formatPrice(product.price)}</span>
        </div>
      </div>
    </Link>
  );
}
