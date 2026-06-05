import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useShopCart } from '../hooks/useShopCart';
import {
  getShopProduct,
  getProductReviews,
  getProductReviewStats,
} from '../services/shop';
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
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [tab, setTab] = useState('desc');
  const [addedToast, setAddedToast] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getShopProduct(productId)
      .then((p) => { setProduct(p); setActiveImage(0); setQty(1); setSelectedVariant(null); })
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
    const vs = Array.isArray(product.variants) ? product.variants : [];
    if (vs.length > 0 && !selectedVariant) { setAddedToast('Vui lòng chọn phân loại trước'); return; }
    addItem(product, qty, selectedVariant);
    setAddedToast(`Đã thêm ${qty} × ${product.title}${selectedVariant ? ' - ' + selectedVariant.name : ''} vào giỏ`);
  };

  const handleBuyNow = () => {
    if (!user) { navigate('/login'); return; }
    if (!product) return;
    const vs = Array.isArray(product.variants) ? product.variants : [];
    if (vs.length > 0 && !selectedVariant) { setAddedToast('Vui lòng chọn phân loại trước'); return; }
    addItem(product, qty, selectedVariant);
    navigate('/shop/cart');
  };

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

  // Variants ("Phân loại")
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = variants.length > 0;
  const variantPrices = variants.map(v => Number(v.price) || 0);
  const minVariantPrice = hasVariants ? Math.min(...variantPrices) : 0;
  const maxVariantPrice = hasVariants ? Math.max(...variantPrices) : 0;
  const effectivePrice = selectedVariant
    ? Number(selectedVariant.price)
    : (hasVariants ? minVariantPrice : Number(product.price));
  const effectiveTotal = effectivePrice * Math.max(1, qty);
  const effectiveStock = selectedVariant ? selectedVariant.stockQuantity : product.stockQuantity;
  const effectiveStockLabel = effectiveStock == null
    ? 'Thủ công'
    : Number(effectiveStock).toLocaleString('vi-VN');
  const mainImageSrc = (selectedVariant && selectedVariant.image)
    ? mediaUrl(selectedVariant.image)
    : (hasImages ? mediaUrl(images[activeImage] || images[0]) : null);

  return (
    <DetailShell cartCount={cartCount} crumbTitle={product.title}>
      <Link to="/shop" className="shop-lg-back-link">← Quay lại Shop</Link>

      <section className="shop-lg-hero">
        <div className="shop-lg-glass shop-lg-gallery">
          <div className="main">
            {mainImageSrc
              ? <img src={mainImageSrc} alt={product.title} />
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
            <StarBar rating={product.ratingAvg || 0} />
            <span>
              {Number(product.ratingAvg || 0).toFixed(1)}
              <span style={{ color: 'var(--slg-txt-3)' }}> ({Number(product.reviewCount || 0).toLocaleString('vi-VN')} đánh giá)</span>
            </span>
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
              {user && product.seller?.id && product.seller.id !== user.id && (
                <Link to={`/chat?userId=${product.seller.id}`} className="shop-lg-lq shop-lg-seller-cta">
                  <i className="bi bi-chat-dots-fill" />Nhắn shop
                </Link>
              )}
              <Link to={`/shop/seller/${product.sellerId}`} className="shop-lg-lq">
                Xem Shop
              </Link>
            </div>
          </div>

          <div className="shop-lg-price-block">
            {hasVariants && !selectedVariant ? (
              <span className="price">
                {minVariantPrice === maxVariantPrice
                  ? formatPrice(minVariantPrice)
                  : `${formatPrice(minVariantPrice)} – ${formatPrice(maxVariantPrice)}`}
              </span>
            ) : (
              <span className="price">{formatPrice(effectivePrice)}</span>
            )}
          </div>

          {hasVariants && (
            <div className="shop-lg-variant-block">
              <span className="shop-lg-variant-label">Phân loại</span>
              <div className="shop-lg-variant-grid">
                {variants.map((v) => {
                  const out = v.stockQuantity != null && Number(v.stockQuantity) <= 0;
                  const on = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={'shop-lg-variant-chip shop-lg-lq' + (on ? ' is-on' : '') + (out ? ' is-out' : '')}
                      disabled={out}
                      onClick={() => { setSelectedVariant(on ? null : v); setQty(1); }}
                      title={v.name}
                    >
                      {v.image && <img src={mediaUrl(v.image)} alt="" />}
                      <span className="nm">{v.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="shop-lg-qty-row">
            <span className="l">Số lượng</span>
            <div className="shop-lg-qty">
              <button type="button" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <input
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
              />
              <button
                type="button"
                onClick={() => setQty(q => (effectiveStock != null ? Math.min(Number(effectiveStock) || 1, q + 1) : q + 1))}
              >+</button>
            </div>
            <span className="shop-lg-stock-line">Còn <b style={{ color: 'var(--slg-txt)' }}>{effectiveStockLabel}</b></span>
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
              Mua ngay · {formatPrice(effectiveTotal)}
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
          <button className={'shop-lg-lq ' + (tab === 'reviews' ? 'is-on' : '')} onClick={() => setTab('reviews')}>
            Đánh giá ({Number(product.reviewCount || 0).toLocaleString('vi-VN')})
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
          {tab === 'reviews' && (
            <ProductReviewsTab productId={product.id} />
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

function StarBar({ rating = 0, size = 14 }) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  const stars = [];
  for (let i = 0; i < 5; i++) {
    if (i < full) stars.push('full');
    else if (i === full && half) stars.push('half');
    else stars.push('empty');
  }
  return (
    <span className="shop-stars-row" style={{ fontSize: size }} aria-label={`${r.toFixed(1)} sao`}>
      {stars.map((t, i) => (
        <span key={i} className={'shop-star-' + t}>★</span>
      ))}
    </span>
  );
}

function ProductReviewsTab({ productId }) {
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState(0); // 0 = all, 1..5 = star filter

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getProductReviewStats(productId),
      getProductReviews(productId, { rating: filter || null, limit: 30 }),
    ])
      .then(([s, r]) => { setStats(s); setReviews(r || []); })
      .catch(err => console.error('[reviews] load failed', err))
      .finally(() => setLoading(false));
  }, [productId, filter]);

  useEffect(() => { load(); }, [load]);

  if (loading && !stats) {
    return <div className="shop-lg-glass" style={{ padding: 30, textAlign: 'center', color: 'var(--slg-txt-2)' }}>Đang tải đánh giá…</div>;
  }

  const total = stats?.total || 0;
  const avg   = stats?.avgRating || 0;
  const buckets = [5, 4, 3, 2, 1].map(n => ({
    star: n,
    count: stats ? stats[`star${n}`] || 0 : 0,
  }));

  return (
    <div className="shop-lg-glass shop-reviews-tab">
      <div className="shop-reviews-summary">
        <div className="left">
          <div className="big-avg">{Number(avg).toFixed(1)}</div>
          <StarBar rating={avg} size={22} />
          <div className="big-sub">{total.toLocaleString('vi-VN')} đánh giá</div>
        </div>
        <div className="right">
          {buckets.map(b => {
            const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
            return (
              <button
                key={b.star}
                type="button"
                className={'shop-review-bar ' + (filter === b.star ? 'is-on' : '')}
                onClick={() => setFilter(filter === b.star ? 0 : b.star)}
              >
                <span className="lbl">{b.star} ★</span>
                <span className="bar"><span className="fill" style={{ width: pct + '%' }} /></span>
                <span className="cnt">{b.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shop-review-filter-chips">
        <button
          type="button"
          className={'chip ' + (filter === 0 ? 'is-on' : '')}
          onClick={() => setFilter(0)}
        >Tất cả</button>
        {[5,4,3,2,1].map(s => (
          <button
            key={s}
            type="button"
            className={'chip ' + (filter === s ? 'is-on' : '')}
            onClick={() => setFilter(s)}
          >{s} sao</button>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--slg-txt-2)' }}>
          {filter ? `Chưa có đánh giá ${filter} sao.` : 'Sản phẩm chưa có đánh giá nào. Hãy là người đầu tiên!'}
        </div>
      ) : (
        <div className="shop-review-list">
          {reviews.map(r => <ReviewItem key={r.id} review={r} />)}
        </div>
      )}
    </div>
  );
}

function ReviewItem({ review }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const reviewImages = Array.isArray(review.images) ? review.images.filter(Boolean) : [];
  return (
    <div className="shop-review-item">
      <div className="shop-review-head">
        <div className="shop-review-ava">
          {review.buyer?.avatar
            ? <img src={mediaUrl(review.buyer.avatar)} alt="" />
            : (review.buyer?.username || '?').slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="shop-review-name">{review.buyer?.username || 'Ẩn danh'}</div>
          <div className="shop-review-stars-row">
            <StarBar rating={review.rating} size={13} />
            <span className="shop-review-date">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      </div>
      <div className="shop-review-content">{review.content}</div>
      {reviewImages.length > 0 && (
        <div className="shop-review-imgs">
          {reviewImages.map((src, i) => (
            <button
              key={i}
              type="button"
              className="shop-review-img-btn"
              onClick={() => setLightboxIndex(i)}
              aria-label={`Xem ảnh ${i + 1}`}
            >
              <img src={mediaUrl(src)} alt={`Ảnh ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
      {review.sellerReply && (
        <div className="shop-review-reply">
          <div className="lbl">Phản hồi của Shop</div>
          <div className="txt">{review.sellerReply}</div>
        </div>
      )}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={reviewImages}
          index={lightboxIndex}
          onChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

function ImageLightbox({ images, index, onChange, onClose }) {
  const many = images.length > 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && images.length > 1) onChange((index + 1) % images.length);
      else if (e.key === 'ArrowLeft' && images.length > 1) onChange((index - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, images.length, onChange, onClose]);

  return createPortal(
    <div className="shop-lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button className="shop-lightbox-close" type="button" onClick={onClose} aria-label="Đóng">×</button>
      {many && (
        <button
          className="shop-lightbox-nav prev"
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange((index - 1 + images.length) % images.length); }}
          aria-label="Ảnh trước"
        >‹</button>
      )}
      <img
        className="shop-lightbox-img"
        src={mediaUrl(images[index])}
        alt={`Ảnh ${index + 1}`}
        onClick={(e) => e.stopPropagation()}
      />
      {many && (
        <button
          className="shop-lightbox-nav next"
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange((index + 1) % images.length); }}
          aria-label="Ảnh sau"
        >›</button>
      )}
      {many && <div className="shop-lightbox-count">{index + 1} / {images.length}</div>}
    </div>,
    document.body
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
