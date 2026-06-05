import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getShopCategories,
  getShopProducts,
  createShopProduct,
  updateShopProduct,
  deleteShopProduct,
} from '../services/shop';
import { uploadFile } from '../services/api';
import { API_ORIGIN } from '../config';

// Ảnh có thể là path server (/uploads/...), URL ngoài (http), hoặc blob/data
// (xem trước khi upload). Chỉ prefix API_ORIGIN cho path server tương đối —
// nếu không, trình duyệt xin ảnh ở origin frontend (5173) và nhận về index.html.
function mediaUrl(u) {
  if (!u) return null;
  if (/^(https?:|blob:|data:)/i.test(u)) return u;
  return `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`;
}

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
  const [editingProduct, setEditingProduct] = useState(null);

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
          <Link to="/shop/sales" className="shop-btn-secondary"><i className="bi bi-receipt" /> Đơn bán</Link>
          <button className="shop-btn-primary" onClick={() => setShowCreate(true)}>
            <i className="bi bi-plus-lg" /> Đăng sản phẩm mới
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
                {p.images?.[0] ? <img src={mediaUrl(p.images[0])} alt="" /> : <div className="shop-row-noimg" />}
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
                <button className="shop-btn-secondary" onClick={() => setEditingProduct(p)}><i className="bi bi-pencil" /> Sửa</button>
                <button className="shop-btn-danger" onClick={() => handleDelete(p.id)}><i className="bi bi-trash" /> Xóa</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreate || editingProduct) && (
        <ProductModal
          categories={categories}
          product={editingProduct}
          onClose={() => { setShowCreate(false); setEditingProduct(null); }}
          onSaved={(product) => {
            setProducts(prev => editingProduct
              ? prev.map(p => (p.id === product.id ? product : p))
              : [product, ...prev]);
            setShowCreate(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}

function ProductModal({ categories, product, onClose, onSaved }) {
  const isEdit = !!product;
  const [form, setForm] = useState(() => ({
    title: product?.title || '',
    description: product?.description || '',
    categoryId: product?.categoryId || categories[0]?.id || 0,
    productType: product?.productType || 'physical',
    price: product?.price || 0,
    stockQuantity: product?.stockQuantity ?? 1,
  }));
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(product?.images?.[0] || null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [useVariants, setUseVariants] = useState(() => (product?.variants?.length || 0) > 0);
  const [variants, setVariants] = useState(() =>
    (product?.variants || []).map(v => ({
      name: v.name || '',
      price: v.price ?? '',
      stockQuantity: v.stockQuantity ?? '',
      image: v.image || null,
      imageFile: null,
      imagePreview: v.image || null,
    }))
  );

  const emptyVariant = () => ({ name: '', price: '', stockQuantity: '', image: null, imageFile: null, imagePreview: null });
  const addVariant = () => setVariants(vs => [...vs, emptyVariant()]);
  const removeVariant = (i) => setVariants(vs => vs.filter((_, idx) => idx !== i));
  const updateVariant = (i, patch) => setVariants(vs => vs.map((v, idx) => idx === i ? { ...v, ...patch } : v));
  const handleVariantImage = (i, file) => {
    if (!file) return;
    updateVariant(i, { imageFile: file, imagePreview: URL.createObjectURL(file) });
  };
  const toggleUseVariants = (on) => {
    setUseVariants(on);
    if (on && variants.length === 0) setVariants([emptyVariant()]);
  };

  const applyImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageChange = (e) => applyImageFile(e.target.files?.[0]);

  useEffect(() => {
    const onPaste = (e) => {
      if (submitting) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          applyImageFile(item.getAsFile());
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [submitting]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.description.trim()) {
      setError('Vui lòng điền tên và mô tả sản phẩm'); return;
    }
    if (!isEdit && !imageFile) {
      setError('Vui lòng chọn ảnh sản phẩm'); return;
    }
    if (useVariants) {
      const rows = variants.filter(v => v.name.trim() || v.price || v.imageFile || v.image);
      if (rows.length === 0) { setError('Thêm ít nhất một phân loại, hoặc tắt phân loại'); return; }
      for (const v of rows) {
        if (!v.name.trim()) { setError('Mỗi phân loại cần có tên'); return; }
        if (!(parseInt(v.price) > 0)) { setError(`Giá phân loại "${v.name || '(chưa đặt tên)'}" phải lớn hơn 0`); return; }
      }
    } else if (form.price <= 0) {
      setError('Giá phải lớn hơn 0'); return;
    }

    setSubmitting(true);
    try {
      // Main product image
      let images = product?.images || [];
      if (imageFile) {
        const upload = await uploadFile('/upload/media', 'media', imageFile);
        const imageUrl = upload?.data?.media_url || upload?.data?.url;
        if (!imageUrl) throw new Error('Upload ảnh thất bại — server không trả URL');
        images = [imageUrl];
      }

      // Variant images + payload
      let variantPayload = null;
      if (useVariants) {
        variantPayload = [];
        for (const v of variants) {
          if (!v.name.trim()) continue;
          let img = v.image || null;
          if (v.imageFile) {
            const up = await uploadFile('/upload/media', 'media', v.imageFile);
            img = up?.data?.media_url || up?.data?.url || img;
          }
          variantPayload.push({
            name: v.name.trim(),
            price: parseInt(v.price),
            stockQuantity: form.productType === 'physical' ? (parseInt(v.stockQuantity) || 0) : null,
            image: img,
          });
        }
      }

      const base = {
        categoryId: parseInt(form.categoryId),
        title: form.title.trim(),
        description: form.description.trim(),
        images,
      };

      let saved;
      if (isEdit) {
        const payload = { ...base };
        if (useVariants) {
          payload.variants = variantPayload;
        } else {
          payload.price = parseInt(form.price);
          payload.stockQuantity = form.productType === 'physical' ? parseInt(form.stockQuantity) : null;
          payload.variants = []; // clear any existing variants → simple product
        }
        saved = await updateShopProduct(product.id, payload);
      } else {
        const payload = {
          ...base,
          productType: form.productType,
          price: useVariants ? Math.min(...variantPayload.map(v => v.price)) : parseInt(form.price),
          stockQuantity: useVariants ? null : (form.productType === 'physical' ? parseInt(form.stockQuantity) : null),
        };
        if (useVariants) payload.variants = variantPayload;
        saved = await createShopProduct(payload);
      }
      onSaved(saved);
    } catch (err) {
      setError(err?.message || (isEdit ? 'Lưu thay đổi thất bại' : 'Đăng sản phẩm thất bại'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shop-modal-backdrop" onClick={onClose}>
      <div className="shop-modal" onClick={e => e.stopPropagation()}>
        <div className="shop-modal-header">
          <h2>{isEdit ? 'Sửa sản phẩm' : 'Đăng sản phẩm mới'}</h2>
          <button className="shop-modal-close" onClick={onClose} type="button">×</button>
        </div>
        <form onSubmit={handleSubmit} className="shop-modal-form">
          <div className="shop-form-row">
            <label>Ảnh sản phẩm {isEdit ? '' : '*'}</label>
            <label className={`shop-img-dropzone${imagePreview ? ' has-preview' : ''}`}>
              {imagePreview
                ? <img src={mediaUrl(imagePreview)} alt="" className="shop-img-dropzone-preview" />
                : <span className="shop-img-dropzone-hint">
                    <i className="bi bi-image" style={{ fontSize: 22, opacity: 0.4 }} />
                    <span>Nhấp để chọn ảnh</span>
                    <span style={{ opacity: 0.55, fontSize: 12 }}>hoặc <kbd>Ctrl+V</kbd> để dán từ clipboard</span>
                  </span>
              }
              <input type="file" accept="image/*,image/svg+xml" onChange={handleImageChange} disabled={submitting} hidden />
            </label>
            {imagePreview && (
              <button type="button" className="shop-img-dropzone-remove" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                <i className="bi bi-x" /> Xoá ảnh
              </button>
            )}
            {isEdit && !imagePreview && <small className="shop-form-hint">Để trống nếu muốn giữ ảnh hiện tại.</small>}
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
                onChange={e => setForm({ ...form, productType: e.target.value })} disabled={submitting || isEdit}>
                <option value="physical">Vật lý (có giao hàng)</option>
                <option value="digital">Kỹ thuật số</option>
              </select>
              {isEdit && <small className="shop-form-hint">Không thể đổi loại sau khi đăng.</small>}
            </div>
          </div>
          <div className="shop-form-row">
            <label className="shop-variant-toggle">
              <input type="checkbox" checked={useVariants}
                onChange={e => toggleUseVariants(e.target.checked)} disabled={submitting} />
              Sản phẩm có nhiều phân loại (vd: màu sắc, dung lượng…)
            </label>
          </div>

          {!useVariants ? (
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
          ) : (
            <div className="shop-form-row">
              <label>Danh sách phân loại *</label>
              <div className="shop-variant-editor">
                {variants.map((v, i) => (
                  <div className="shop-variant-row" key={i}>
                    <label className="shop-variant-img" title="Ảnh phân loại">
                      {v.imagePreview
                        ? <img src={mediaUrl(v.imagePreview)} alt="" />
                        : <span>+ Ảnh</span>}
                      <input type="file" accept="image/*,image/svg+xml" hidden disabled={submitting}
                        onChange={e => handleVariantImage(i, e.target.files?.[0])} />
                    </label>
                    <input type="text" placeholder="Tên phân loại" value={v.name}
                      onChange={e => updateVariant(i, { name: e.target.value })} disabled={submitting} />
                    <input type="number" min={1} placeholder="Giá" value={v.price}
                      onChange={e => updateVariant(i, { price: e.target.value })} disabled={submitting} />
                    {form.productType === 'physical' && (
                      <input type="number" min={0} placeholder="Tồn" value={v.stockQuantity}
                        onChange={e => updateVariant(i, { stockQuantity: e.target.value })} disabled={submitting} />
                    )}
                    <button type="button" className="shop-variant-del" onClick={() => removeVariant(i)}
                      disabled={submitting} aria-label="Xoá phân loại">×</button>
                  </div>
                ))}
                <button type="button" className="shop-btn-secondary shop-variant-add"
                  onClick={addVariant} disabled={submitting}>+ Thêm phân loại</button>
                <small className="shop-form-hint">Giá và tồn kho của sản phẩm sẽ tự tính từ các phân loại (giá thấp nhất, tổng tồn).</small>
              </div>
            </div>
          )}

          {error && <div className="shop-form-error">{error}</div>}

          <div className="shop-modal-footer">
            <button type="button" className="shop-btn-secondary" onClick={onClose} disabled={submitting}>Huỷ</button>
            <button type="submit" className="shop-btn-primary" disabled={submitting}>
              {submitting
                ? (isEdit ? 'Đang lưu…' : 'Đang đăng…')
                : (isEdit ? 'Lưu thay đổi' : 'Đăng sản phẩm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
