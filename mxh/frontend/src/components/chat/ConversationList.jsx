import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { timeAgo } from '../../utils/time';
import { API_ORIGIN } from '../../config';
import { clearConversation, hideAllMessagesForMe } from '../../services/chat';
import geminiLogo from '../../assets/gemini.svg';
import ConfirmDialog from '../ConfirmDialog';
const DEFAULT_AVATAR = '/default-avatar.png';

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onConversationCleared,
  onMessagesHiddenForMe,
  onCreateGroup,
}) {
  const { user } = useAuth();
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

  const isAIActive = activeId === '__ai__';

  return (
    <div className="conv-list">
      {/* Tạo nhóm chat mới — luôn đứng đầu */}
      {onCreateGroup && (
        <button type="button" className="conv-create-row" onClick={onCreateGroup}>
          <div className="conv-avatar conv-avatar--create">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
              <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div className="conv-info">
            <div className="conv-name-row">
              <span className="conv-name">Tạo nhóm chat mới</span>
            </div>
            <div className="conv-preview-row">
              <span className="conv-preview">Trò chuyện với nhiều bạn bè cùng lúc</span>
            </div>
          </div>
        </button>
      )}

      {/* Gemini AI entry — luôn đứng đầu */}
      <button
        type="button"
        className={`conv-item conv-item--ai${isAIActive ? ' conv-item--active' : ''}`}
        onClick={() => onSelect({ id: '__ai__', isAI: true, display_name: 'Gemini AI' })}
      >
        <div className="conv-avatar conv-avatar--ai">
          <img src={geminiLogo} width="36" height="36" alt="Gemini" />
          <span className="conv-online-dot conv-online-dot--ai" />
        </div>
        <div className="conv-info">
          <div className="conv-name-row">
            <span className="conv-name">Gemini AI</span>
            <span className="conv-ai-badge">AI</span>
          </div>
          <div className="conv-preview-row">
            <span className="conv-preview conv-preview--ai">Trợ lý AI · Hỏi bất cứ điều gì</span>
          </div>
        </div>
      </button>

      {(!conversations || conversations.length === 0) && (
        <div className="conv-list-empty">
          <p>Chưa có cuộc trò chuyện nào</p>
        </div>
      )}

      {(conversations || []).map((conv) => {
        const isActive = conv.id == activeId;
        const unread = parseInt(conv.unread_count) || 0;
        const isGroup = conv.type === 'group';

        let preview = conv.last_message || '';
        if (conv.last_message_type === 'image') preview = 'Hình ảnh';
        else if (conv.last_message_type === 'video') preview = 'Video';
        else if (conv.last_message_type === 'system') preview = preview;

        // Trong group: prefix tên người gửi (Facebook style: "Tên: nội dung")
        if (isGroup && preview && conv.last_message_type !== 'system') {
          const senderId = Number(conv.last_message_sender_id || 0);
          const senderName = senderId === Number(user?.id)
            ? 'Bạn'
            : (conv.last_message_sender_username || '');
          if (senderName) {
            preview = `${senderName}: ${preview}`;
          }
        }
        if (preview.length > 48) preview = preview.substring(0, 48) + '...';

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
              <div className={`conv-avatar ${isGroup ? 'conv-avatar--group' : ''}`}>
                {conv.display_avatar ? (
                  <img src={`${API_ORIGIN}${conv.display_avatar}`} alt="" />
                ) : isGroup ? (
                  <span className="conv-group-placeholder" aria-label="Nhóm">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                  </span>
                ) : (
                  <img src={DEFAULT_AVATAR} alt="" />
                )}
                {!isGroup && conv.is_online && <span className="conv-online-dot" />}
                {isGroup && conv.online_member_count > 0 && (
                  <span className="conv-group-badge" title={`${conv.online_member_count} đang hoạt động`}>
                    {conv.online_member_count}
                  </span>
                )}
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
                    className="conv-item-dropdown-item conv-item-dropdown-item--danger"
                    role="menuitem"
                    onClick={() => {
                      setMenuId(null);
                      setConfirmHide(conv);
                    }}
                  >
                    <i className="bi bi-trash3"></i>
                    Xóa đoạn chat
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
                    <i className="bi bi-arrow-counterclockwise"></i>
                    Thu hồi toàn bộ tin nhắn
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
          title="Xóa đoạn chat?"
          message="Đoạn chat sẽ bị xóa khỏi danh sách của bạn. Người kia vẫn giữ nguyên lịch sử phía họ. Khi ai đó nhắn lại, đoạn chat sẽ hiện lại."
          confirmText={busy ? 'Đang xóa...' : 'Xóa'}
          cancelText="Hủy"
          onConfirm={runHide}
          onCancel={() => !busy && setConfirmHide(null)}
        />
      )}
    </div>
  );
}
