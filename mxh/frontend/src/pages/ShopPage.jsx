import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getShopCategories, getShopProducts, getMyShopApplication } from '../services/shop';

const SORT_OPTIONS = [
  { key: 'popular', label: 'Phổ Biến', icon: '🔥' },
  { key: 'trusted', label: 'Shop uy tín', icon: '🛡' },
  { key: 'price_asc', label: 'Giá tăng dần', icon: '↗' },
  { key: 'price_desc', label: 'Giá giảm dần', icon: '↘' },
];

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

export default function ShopPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [sortKey, setSortKey] = useState('popular');
  const [loading, setLoading] = useState(true);
  const [myApp, setMyApp] = useState(null);

  useEffect(() => {
    if (!user) { setMyApp(null); return; }
    if (user.is_seller) { setMyApp({ status: 'approved' }); return; }
    getMyShopApplication()
      .then(setMyApp)
      .catch(err => console.error('[shop] load my-app failed:', err));
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
      .then(([cats, prods]) => { setCategories(cats); setProducts(prods); })
      .catch(err => console.error('[shop] load failed:', err))
      .finally(() => setLoading(false));
  }, [selectedCategory, activeSearch]);

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

  const sellerCta = (() => {
    if (!user) return null;
    if (user.is_seller) {
      return <Link to="/shop/dashboard" className="shop-seller-cta shop-seller-cta--manage">Quản lý cửa hàng</Link>;
    }
    if (myApp?.status === 'pending') {
      return <span className="shop-seller-cta shop-seller-cta--pending">Đơn đăng ký đang chờ duyệt</span>;
    }
    if (myApp?.status === 'rejected') {
      return <Link to="/shop/register" className="shop-seller-cta shop-seller-cta--rejected">Đơn bị từ chối — Xem lại</Link>;
    }
    return <Link to="/shop/register" className="shop-seller-cta">Đăng ký bán hàng</Link>;
  })();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearch(search.trim());
  };

  const activeCategoryName = selectedCategory
    ? categories.find(c => c.id === selectedCategory)?.name || 'Tất cả'
    : 'Tất cả';

  return (
    <div className="apple-main shop-page">
      <div className="shop-layout">
        {/* Sidebar */}
        <aside className="shop-sidebar">
          <h3 className="shop-sidebar-title">Danh mục sản phẩm</h3>
          <button
            type="button"
            className={`shop-cat-link${!selectedCategory ? ' shop-cat-link--active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            Tất cả
          </button>
          {!selectedCategory && (
            <div className="shop-cat-back">← Xem tất cả danh mục</div>
          )}
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`shop-cat-link${selectedCategory === cat.id ? ' shop-cat-link--active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span className="shop-cat-icon">{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}

          {sellerCta && <div className="shop-sidebar-cta-wrap">{sellerCta}</div>}
        </aside>

        {/* Main */}
        <div className="shop-main">
          <form className="shop-search-bar" onSubmit={handleSearchSubmit}>
            <span className="shop-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="shop-search-btn">Tìm</button>
          </form>

          <div className="shop-toolbar">
            <div className="shop-toolbar-title">
              {activeCategoryName} <span className="shop-toolbar-count">{sortedProducts.length} sản phẩm</span>
            </div>
            <div className="shop-toolbar-sort">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  className={`shop-sort-chip${sortKey === opt.key ? ' shop-sort-chip--active' : ''}`}
                  onClick={() => setSortKey(opt.key)}
                >
                  <span className="shop-sort-icon">{opt.icon}</span> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="shop-loading">Đang tải…</div>
          ) : sortedProducts.length === 0 ? (
            <div className="shop-empty">
              <h3>Không có sản phẩm nào</h3>
              <p>Hãy thử danh mục khác hoặc tìm kiếm với từ khóa khác.</p>
            </div>
          ) : (
            <div className="shop-grid">
              {sortedProducts.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product }) {
  const img = product.images?.[0];
  const isService = product.productType === 'digital';
  const stockLabel = product.stockQuantity == null
    ? 'Thủ công'
    : product.stockQuantity;

  return (
    <Link to={`/shop/product/${product.id}`} className="shop-card">
      <div className="shop-card-image">
        <span className="shop-card-badge-corner">KHÔNG TRÙNG</span>
        {img ? <img src={img} alt={product.title} /> : <div className="shop-card-noimg" />}
        <div className="shop-card-stock">
          Tồn kho: <strong>{stockLabel}</strong>
        </div>
      </div>
      <div className="shop-card-body">
        <span className={`shop-card-tag shop-card-tag--${isService ? 'service' : 'product'}`}>
          {isService ? 'Dịch vụ' : 'Sản phẩm'}
        </span>
        <h3 className="shop-card-title">{product.title}</h3>
        <div className="shop-card-meta">
          <span>⭐⭐⭐⭐⭐</span>
          <span>Đã bán: <strong>{product.soldCount || 0}</strong></span>
          <span>|</span>
          <span>Khiếu nại: 0.0%</span>
        </div>
        <div className="shop-card-seller">
          Người bán: <span>{product.seller?.username || 'N/A'}</span>
        </div>
        {product.category?.name && (
          <div className="shop-card-cat">Danh mục: <span>{product.category.name}</span></div>
        )}
        <div className="shop-card-price">{formatPrice(product.price)}</div>
      </div>
    </Link>
  );
}
