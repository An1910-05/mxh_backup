import { useState, useEffect, useRef } from 'react';
import { timeAgo } from '../../utils/time';
import { API_ORIGIN } from '../../config';
import { clearConversation, hideAllMessagesForMe } from '../../services/chat';
import ConfirmDialog from '../ConfirmDialog';
const DEFAULT_AVATAR = '/default-avatar.png';

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onConversationCleared,
  onMessagesHiddenForMe,
}) {
  const [menuId, setMenuId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(null);
  const [confirmHide, setConfirmHide] = useState(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);

  // Đóng popup khi đổi hội thoại đang mở / vào màn nhắn tin (activeId đổi)
  useEffect(() => {
    setMenuId(null);
  }, [activeId]);

  // Đảm bảo menu luôn tắt khi mở hộp xác nhận (tránh kẹt trạng thái)
  useEffect(() => {
    if (confirmClear || confirmHide) setMenuId(null);
  }, [confirmClear, confirmHide]);

  useEffect(() => {
    if (!menuId || confirmClear || confirmHide) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuId(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuId(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuId, confirmClear, confirmHide]);

  const runClear = async () => {
    if (!confirmClear || busy) return;
    setBusy(true);
    try {
      await clearConversation(confirmClear.id);
      setConfirmClear(null);
      setMenuId(null);
      onConversationCleared?.(confirmClear.id);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Không xóa được');
    } finally {
      setBusy(false);
    }
  };

  const runHide = async () => {
    if (!confirmHide || busy) return;
    setBusy(true);
    try {
      await hideAllMessagesForMe(confirmHide.id);
      setConfirmHide(null);
      setMenuId(null);
      onMessagesHiddenForMe?.(confirmHide.id);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Không ẩn được');
    } finally {
      setBusy(false);
    }
  };

  if (!conversations || conversations.length === 0) {
    return (
      <div className="conv-list-empty">
        <p>Chưa có cuộc trò chuyện nào</p>
      </div>
    );
  }

  return (
    <div className="conv-list">
      {conversations.map((conv) => {
        const isActive = conv.id == activeId;
        const unread = parseInt(conv.unread_count) || 0;

        let preview = conv.last_message || '';
        if (conv.last_message_type === 'image') preview = 'Hình ảnh';
        if (conv.last_message_type === 'video') preview = 'Video';
        if (preview.length > 40) preview = preview.substring(0, 40) + '...';

        return (
          <div
            key={conv.id}
            className={`conv-item-row ${isActive ? 'conv-item-row--active' : ''} ${unread > 0 ? 'conv-item-row--unread' : ''}`}
          >
            <button
              type="button"
              className={`conv-item ${isActive ? 'conv-item--active' : ''} ${unread > 0 ? 'conv-item--unread' : ''}`}
              onClick={() => {
                setMenuId(null);
                onSelect(conv);
              }}
            >
              <div className="conv-avatar">
                {conv.display_avatar ? (
                  <img src={`${API_ORIGIN}${conv.display_avatar}`} alt="" />
                ) : (
                  <img src={DEFAULT_AVATAR} alt="" />
                )}
                {conv.is_online && <span className="conv-online-dot" />}
              </div>
              <div className="conv-info">
                <div className="conv-name-row">
                  <span className="conv-name">{conv.display_name || 'User'}</span>
                  {conv.last_message_at && (
                    <span className="conv-time">{timeAgo(conv.last_message_at)}</span>
                  )}
                </div>
                <div className="conv-preview-row">
                  <span className="conv-preview">{preview}</span>
                  {unread > 0 && <span className="conv-badge">{unread > 99 ? '99+' : unread}</span>}
                </div>
              </div>
            </button>

            <div className="conv-item-actions" ref={menuId === conv.id ? menuRef : null}>
              <button
                type="button"
                className={`conv-item-menu-btn ${menuId === conv.id ? 'conv-item-menu-btn--open' : ''}`}
                aria-label="Tùy chọn cuộc trò chuyện"
                aria-expanded={menuId === conv.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuId((id) => (id === conv.id ? null : conv.id));
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
              {menuId === conv.id && (
                <div className="conv-item-dropdown" role="menu">
                  <button
                    type="button"
                    className="conv-item-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuId(null);
                      setConfirmHide(conv);
                    }}
                  >
                    Xóa tất cả tin nhắn phía tôi
                  </button>
                  <button
                    type="button"
                    className="conv-item-dropdown-item conv-item-dropdown-item--danger"
                    role="menuitem"
                    onClick={() => {
                      setMenuId(null);
                      setConfirmClear(conv);
                    }}
                  >
                    Thu hồi toàn bộ tin nhắn (cả hai bên)
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {confirmClear && (
        <ConfirmDialog
          title="Thu hồi toàn bộ tin nhắn?"
          message="Giống thu hồi tin nhắn nhưng cho cả cuộc trò chuyện: nội dung sẽ biến mất ở cả bạn và người kia, không thể hoàn tác."
          confirmText={busy ? 'Đang xử lý...' : 'Thu hồi'}
          cancelText="Hủy"
          onConfirm={runClear}
          onCancel={() => !busy && setConfirmClear(null)}
        />
      )}

      {confirmHide && (
        <ConfirmDialog
          title="Xóa tất cả tin nhắn phía bạn?"
          message="Giống khi bạn ẩn từng tin nhắn, nhưng một lần cho cả cuộc trò chuyện: bạn sẽ không còn thấy tin ở thiết bị này; người kia vẫn giữ nguyên lịch sử phía họ."
          confirmText={busy ? 'Đang xử lý...' : 'Xóa phía tôi'}
          cancelText="Hủy"
          onConfirm={runHide}
          onCancel={() => !busy && setConfirmHide(null)}
        />
      )}
    </div>
  );
}
