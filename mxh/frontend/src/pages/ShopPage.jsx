import { useState, useEffect } from 'react';
import { getShopCategories, getShopProducts } from '../services/shop';

export default function ShopPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  async function loadData() {
    try {
      setLoading(true);
      const [cats, prods] = await Promise.all([
        getShopCategories(),
        getShopProducts({ categoryId: selectedCategory, status: 'approved' })
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      console.error('Error loading shop data:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  return (
    <div className="shop-page">
      <div className="shop-container">
        <h1>Cửa hàng</h1>

        {/* Categories */}
        <div className="shop-categories">
          <button
            className={!selectedCategory ? 'active' : ''}
            onClick={() => setSelectedCategory(null)}
          >
            Tất cả
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={selectedCategory === cat.id ? 'active' : ''}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {loading ? (
          <p>Đang tải...</p>
        ) : products.length === 0 ? (
          <p>Chưa có sản phẩm nào.</p>
        ) : (
          <div className="shop-products-grid">
            {products.map(product => (
              <div key={product.id} className="shop-product-card">
                <div className="product-image">
                  {product.images && product.images[0] ? (
                    <img src={product.images[0]} alt={product.title} />
                  ) : (
                    <div className="no-image">Không có ảnh</div>
                  )}
                </div>
                <div className="product-info">
                  <h3>{product.title}</h3>
                  <p className="product-price">{formatPrice(product.price)}</p>
                  <p className="product-seller">Người bán: {product.seller.username}</p>
                  <button className="btn-primary">Xem chi tiết</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
