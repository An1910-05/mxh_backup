/**
 * Hiển thị slug trang cá nhân dạng @handle (URL vẫn là /handle).
 */
export function formatHandleDisplay(slug) {
  if (slug == null || slug === '') return '';
  const s = String(slug).trim().replace(/^@+/u, '');
  return s ? `@${s}` : '';
}
