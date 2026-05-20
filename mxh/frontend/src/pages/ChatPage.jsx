import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import { getOrCreateConversation } from '../services/chat';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import AIChatWindow from '../components/chat/AIChatWindow';
import CreateGroupModal from '../components/chat/CreateGroupModal';

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeConversation, setActiveConversation, conversations, loadConversations } = useChat();
  const [loading, setLoading] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  useEffect(() => {
    const userId = searchParams.get('user');
    if (userId) {
      openConversationWithUser(parseInt(userId));
    }
  }, [searchParams]);

  const openConversationWithUser = async (userId) => {
    setLoading(true);
    try {
      const conv = await getOrCreateConversation(userId);
      setActiveConversation(conv);
      setMobileShowChat(true);
      await loadConversations();
      navigate('/chat', { replace: true });
    } catch (e) {
      console.error('Failed to open conversation:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (conv) => {
    setActiveConversation(conv);
    setMobileShowChat(true);
  };

  const handleBack = () => {
    setMobileShowChat(false);
  };

  const handleConversationCleared = (convId) => {
    loadConversations();
    if (activeConversation && String(activeConversation.id) === String(convId)) {
      setChatRefreshKey((k) => k + 1);
    }
  };

  const handleMessagesHiddenForMe = (convId) => {
    loadConversations();
    if (activeConversation && String(activeConversation.id) === String(convId)) {
      setChatRefreshKey((k) => k + 1);
    }
  };

  const handleGroupCreated = async (conv) => {
    setShowCreateGroup(false);
    await loadConversations();
    if (conv) {
      setActiveConversation(conv);
      setMobileShowChat(true);
    }
  };

  const handleConversationChanged = async () => {
    await loadConversations();
    setChatRefreshKey((k) => k + 1);
  };

  const handleGroupLeft = async () => {
    setActiveConversation(null);
    setMobileShowChat(false);
    await loadConversations();
  };

  return (
    <div className="apple-main apple-main--wide chat-page chat-page--v2">
      <div className={`chat-layout ${mobileShowChat ? 'chat-layout--show-chat' : ''}`}>
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2>Đoạn chat</h2>
            <button
              type="button"
              className="chat-create-group-btn"
              onClick={() => setShowCreateGroup(true)}
              aria-label="Tạo nhóm chat mới"
              title="Tạo nhóm chat mới"
            >
              <i className="bi bi-pencil-square" aria-hidden="true" />
            </button>
          </div>
          <ConversationList
            conversations={conversations}
            activeId={activeConversation?.id}
            onSelect={handleSelectConversation}
            onConversationCleared={handleConversationCleared}
            onMessagesHiddenForMe={handleMessagesHiddenForMe}
            onCreateGroup={() => setShowCreateGroup(true)}
          />
        </div>

        <div className="chat-main">
          {loading ? (
            <div className="chat-empty">
              <span className="apple-spinner" />
              <p>Đang tải đoạn chat…</p>
            </div>
          ) : activeConversation?.isAI ? (
            <AIChatWindow onBack={handleBack} />
          ) : activeConversation ? (
            <ChatWindow
              conversation={activeConversation}
              onBack={handleBack}
              refreshKey={chatRefreshKey}
              onConversationChanged={handleConversationChanged}
              onGroupLeft={handleGroupLeft}
            />
          ) : (
            <div className="chat-empty">
              <div className="chat-empty-glyph" aria-hidden="true">
                <i className="bi bi-chat-dots-fill" />
              </div>
              <h3 className="chat-empty-title">Đoạn chat của bạn</h3>
              <p className="chat-empty-sub">
                Chọn một đoạn chat từ danh sách bên trái hoặc bắt đầu cuộc trò chuyện mới.
              </p>
              <button
                type="button"
                className="chat-empty-cta"
                onClick={() => setShowCreateGroup(true)}
              >
                <i className="bi bi-pencil-square" aria-hidden="true" />
                <span>Bắt đầu đoạn chat mới</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FAB mobile để tạo nhóm chat */}
      {!mobileShowChat && (
        <button
          type="button"
          className="chat-fab-create-group"
          onClick={() => setShowCreateGroup(true)}
          aria-label="Tạo nhóm chat mới"
          title="Tạo nhóm chat"
        >
          <i className="bi bi-pencil-square" aria-hidden="true" />
        </button>
      )}

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}
