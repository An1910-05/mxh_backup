import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;

/**
 * Lightbox xem ảnh tin nhắn kiểu Facebook: phủ tối toàn màn hình, ảnh ở giữa,
 * có phóng to/thu nhỏ (nút +/−, lăn chuột, double-click) và kéo để di chuyển khi
 * đã phóng to. Bấm nền/✕/Esc để đóng. Render qua portal để nổi trên chat nổi.
 */
export default function ChatImageLightbox({ src, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  const reset = useCallback(() => { setZoom(1); setOffset({ x: 0, y: 0 }); }, []);

  const zoomBy = useCallback((delta) => {
    setZoom((z) => {
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100));
      if (next === ZOOM_MIN) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP);
      else if (e.key === '-' || e.key === '_') zoomBy(-ZOOM_STEP);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, zoomBy]);

  if (!src) return null;

  const onWheel = (e) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };

  const onDoubleClick = (e) => {
    e.stopPropagation();
    if (zoom > ZOOM_MIN) reset();
    else setZoom(2.5);
  };

  const onPointerDown = (e) => {
    if (zoom <= ZOOM_MIN) return;
    e.preventDefault();
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
    });
  };
  const endDrag = () => { dragRef.current = null; setDragging(false); };

  return createPortal(
    <div
      className="chat-img-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      onWheel={onWheel}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div className="chat-img-lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="chat-img-lightbox-iconbtn" onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label="Thu nhỏ" title="Thu nhỏ">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35M8 11h6" /></svg>
        </button>
        <span className="chat-img-lightbox-zoom">{Math.round(zoom * 100)}%</span>
        <button type="button" className="chat-img-lightbox-iconbtn" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label="Phóng to" title="Phóng to">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35M11 8v6M8 11h6" /></svg>
        </button>
        <button type="button" className="chat-img-lightbox-iconbtn chat-img-lightbox-iconbtn--close" onClick={onClose} aria-label="Đóng" title="Đóng">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <img
        src={src}
        alt=""
        className="chat-img-lightbox-img"
        draggable={false}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          cursor: zoom > ZOOM_MIN ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
          transition: dragging ? 'none' : 'transform 0.12s ease',
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
      />
    </div>,
    document.body
  );
}
