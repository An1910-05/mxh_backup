import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mxh-shop-cart-v1';

function readCart() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[cart] read failed', err);
    return [];
  }
}

function writeCart(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('mxh-shop-cart-changed'));
  } catch (err) {
    console.error('[cart] write failed', err);
  }
}

/**
 * Mỗi item trong cart:
 *   { id, productId, title, price, image, qty, sellerId, sellerName }
 * `id` = `${productId}` (chỉ 1 dòng / 1 sản phẩm) — cộng dồn qty nếu thêm trùng.
 */
export function useShopCart() {
  const [items, setItems] = useState(readCart);

  useEffect(() => {
    const onChange = () => setItems(readCart());
    window.addEventListener('mxh-shop-cart-changed', onChange);
    window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) onChange(); });
    return () => window.removeEventListener('mxh-shop-cart-changed', onChange);
  }, []);

  const addItem = useCallback((product, qty = 1) => {
    const productId = Number(product.id);
    const cur = readCart();
    const idx = cur.findIndex(i => Number(i.productId) === productId);
    const seller = product.seller || {};
    const image = Array.isArray(product.images) && product.images.length ? product.images[0] : null;
    const next = [...cur];
    if (idx >= 0) {
      next[idx] = { ...next[idx], qty: Math.max(1, (next[idx].qty || 1) + qty) };
    } else {
      next.push({
        id: String(productId),
        productId,
        title: product.title,
        price: Number(product.price) || 0,
        image,
        qty: Math.max(1, qty),
        selected: true,
        sellerId: seller.id || null,
        sellerName: seller.username || 'Shop',
        sellerAvatar: seller.avatar || null,
        stockQuantity: product.stockQuantity ?? null,
      });
    }
    writeCart(next);
    setItems(next);
  }, []);

  const setQty = useCallback((productId, qty) => {
    const cur = readCart();
    const next = cur.map(i => Number(i.productId) === Number(productId) ? { ...i, qty: Math.max(1, qty) } : i);
    writeCart(next);
    setItems(next);
  }, []);

  const toggleSelect = useCallback((productId) => {
    const cur = readCart();
    const next = cur.map(i => Number(i.productId) === Number(productId) ? { ...i, selected: !i.selected } : i);
    writeCart(next);
    setItems(next);
  }, []);

  const toggleSelectShop = useCallback((sellerId) => {
    const cur = readCart();
    const shopItems = cur.filter(i => Number(i.sellerId) === Number(sellerId));
    const allOn = shopItems.length > 0 && shopItems.every(i => i.selected);
    const next = cur.map(i => Number(i.sellerId) === Number(sellerId) ? { ...i, selected: !allOn } : i);
    writeCart(next);
    setItems(next);
  }, []);

  const toggleSelectAll = useCallback(() => {
    const cur = readCart();
    const allOn = cur.length > 0 && cur.every(i => i.selected);
    const next = cur.map(i => ({ ...i, selected: !allOn }));
    writeCart(next);
    setItems(next);
  }, []);

  const removeItem = useCallback((productId) => {
    const cur = readCart();
    const next = cur.filter(i => Number(i.productId) !== Number(productId));
    writeCart(next);
    setItems(next);
  }, []);

  const removeSelected = useCallback(() => {
    const cur = readCart();
    const next = cur.filter(i => !i.selected);
    writeCart(next);
    setItems(next);
  }, []);

  const clear = useCallback(() => {
    writeCart([]);
    setItems([]);
  }, []);

  const totals = computeTotals(items);

  return {
    items,
    addItem,
    setQty,
    toggleSelect,
    toggleSelectShop,
    toggleSelectAll,
    removeItem,
    removeSelected,
    clear,
    ...totals,
  };
}

function computeTotals(items) {
  const selected = items.filter(i => i.selected);
  const subtotal = selected.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
  return {
    count: items.reduce((s, i) => s + (Number(i.qty) || 0), 0),
    selectedCount: selected.reduce((s, i) => s + (Number(i.qty) || 0), 0),
    selectedItems: selected,
    subtotal,
  };
}

export function getCartBadgeCount() {
  return readCart().reduce((s, i) => s + (Number(i.qty) || 0), 0);
}
