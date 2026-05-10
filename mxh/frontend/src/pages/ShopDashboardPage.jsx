import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getShopCategories,
  getShopProducts,
  createShopProduct,
  deleteShopProduct,
} from '../services/shop';
import { uploadFile } from '../services/api';

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

const STATUS_LABEL = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  approved: 'Đang bán',
  rejected: 'Bị từ chối',
  sold_out: 'Hết hàng',
  archived: 'Đã lưu trữ',
};

export default function ShopDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (user && !user.is_seller) navigate('/shop/register', { replace: true });
  }, [user, navigate]);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        getShopCategories(),
        getShopProducts({ sellerId: user.id, limit: 50 }),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      console.error('[shop-dashboard] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa sản phẩm này?')) return;
    try {
      await deleteShopProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert(err?.message || 'Xóa thất bại');
    }
  };

  if (!user || !user.is_seller) {
    return <div className="apple-main"><p style={{ padding: 32 }}>Đang chuyển hướng…</p></div>;
  }

  return (
    <div className="apple-main shop-dashboard-page">
      <div className="shop-dashboard-header">
        <div>
          <h1>Quản lý cửa hàng</h1>
          <p className="shop-dashboard-sub">Đăng và quản lý sản phẩm của bạn.</p>
        </div>
        <div className="shop-dashboard-actions">
          <Link to="/shop" className="shop-btn-secondary">Xem cửa hàng</Link>
          <button className="shop-btn-primary" onClick={() => setShowCreate(true)}>
            + Đăng sản phẩm mới
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ padding: 24 }}>Đang tải…</p>
      ) : products.length === 0 ? (
        <div className="shop-dashboard-empty">
          <h3>Chưa có sản phẩm nào</h3>
          <p>Hãy đăng sản phẩm đầu tiên để bắt đầu kinh doanh.</p>
          <button className="shop-btn-primary" onClick={() => setShowCreate(true)}>
            + Đăng sản phẩm mới
          </button>
        </div>
      ) : (
        <div className="shop-dashboard-list">
          {products.map(p => (
            <div key={p.id} className="shop-dashboard-row">
              <div className="shop-row-img">
                {p.images?.[0] ? <img src={p.images[0]} alt="" /> : <div className="shop-row-noimg" />}
              </div>
              <div className="shop-row-main">
                <div className="shop-row-title">{p.title}</div>
                <div className="shop-row-meta">
                  <span className={`shop-row-status shop-row-status--${p.status}`}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                  <span>{formatPrice(p.price)}</span>
                  {p.stockQuantity != null && <span>Tồn: {p.stockQuantity}</span>}
                  <span>Đã bán: {p.soldCount || 0}</span>
                  <span>Lượt xem: {p.viewCount || 0}</span>
                </div>
              </div>
              <div className="shop-row-actions">
                <button className="shop-btn-danger" onClick={() => handleDelete(p.id)}>Xóa</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProductModal
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={(product) => { setProducts(prev => [product, ...prev]); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

function CreateProductModal({ categories, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', description: '', categoryId: categories[0]?.id || 0,
    productType: 'physical', price: 0, stockQuantity: 1,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.description.trim()) {
      setError('Vui lòng điền tên và mô tả sản phẩm'); return;
    }
    if (form.price <= 0) {
      setError('Giá phải lớn hơn 0'); return;
    }
    if (!imageFile) {
      setError('Vui lòng chọn ảnh sản phẩm'); return;
    }

    setSubmitting(true);
    try {
      const upload = await uploadFile('/upload/media', 'media', imageFile);
      const imageUrl = upload?.data?.url || upload?.url || upload?.data?.path;
      if (!imageUrl) throw new Error('Upload ảnh thất bại');

      const product = await createShopProduct({
        categoryId: parseInt(form.categoryId),
        title: form.title.trim(),
        description: form.description.trim(),
        productType: form.productType,
        price: parseInt(form.price),
        stockQuantity: form.productType === 'physical' ? parseInt(form.stockQuantity) : null,
        images: [imageUrl],
      });
      onCreated(product);
    } catch (err) {
      setError(err?.message || 'Đăng sản phẩm thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shop-modal-backdrop" onClick={onClose}>
      <div className="shop-modal" onClick={e => e.stopPropagation()}>
        <div className="shop-modal-header">
          <h2>Đăng sản phẩm mới</h2>
          <button className="shop-modal-close" onClick={onClose} type="button">×</button>
        </div>
        <form onSubmit={handleSubmit} className="shop-modal-form">
          <div className="shop-form-row">
            <label>Ảnh sản phẩm *</label>
            <input type="file" accept="image/*" onChange={handleImageChange} disabled={submitting} />
            {imagePreview && <img src={imagePreview} alt="" className="shop-form-preview" />}
          </div>
          <div className="shop-form-row">
            <label>Tên sản phẩm *</label>
            <input type="text" maxLength={255} value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} disabled={submitting} />
          </div>
          <div className="shop-form-row">
            <label>Mô tả *</label>
            <textarea rows={4} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} disabled={submitting} />
          </div>
          <div className="shop-form-row-double">
            <div className="shop-form-row">
              <label>Danh mục *</label>
              <select value={form.categoryId}
                onChange={e => setForm({ ...form, categoryId: e.target.value })} disabled={submitting}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="shop-form-row">
              <label>Loại sản phẩm *</label>
              <select value={form.productType}
                onChange={e => setForm({ ...form, productType: e.target.value })} disabled={submitting}>
                <option value="physical">Vật lý (có giao hàng)</option>
                <option value="digital">Kỹ thuật số</option>
              </select>
            </div>
          </div>
          <div className="shop-form-row-double">
            <div className="shop-form-row">
              <label>Giá (VND) *</label>
              <input type="number" min={1} value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })} disabled={submitting} />
            </div>
            {form.productType === 'physical' && (
              <div className="shop-form-row">
                <label>Số lượng tồn *</label>
                <input type="number" min={0} value={form.stockQuantity}
                  onChange={e => setForm({ ...form, stockQuantity: e.target.value })} disabled={submitting} />
              </div>
            )}
          </div>

          {error && <div className="shop-form-error">{error}</div>}

          <div className="shop-modal-footer">
            <button type="button" className="shop-btn-secondary" onClick={onClose} disabled={submitting}>Huỷ</button>
            <button type="submit" className="shop-btn-primary" disabled={submitting}>
              {submitting ? 'Đang đăng…' : 'Đăng sản phẩm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
