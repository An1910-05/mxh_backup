export default function ConfirmDialog({ title, message, confirmText = 'Xóa', cancelText = 'Hủy', onConfirm, onCancel }) {
  return (
    <div className="cd-overlay" onClick={onCancel}>
      <div className="cd-box" onClick={(e) => e.stopPropagation()}>
        <div className="cd-header">
          <h3 className="cd-title">{title}</h3>
          <button className="cd-close" onClick={onCancel}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.71a1 1 0 00-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" /></svg>
          </button>
        </div>
        {message && <p className="cd-message">{message}</p>}
        <div className="cd-actions">
          <button className="cd-btn cd-btn--cancel" onClick={onCancel}>{cancelText}</button>
          <button className="cd-btn cd-btn--confirm" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
