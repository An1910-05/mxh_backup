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
    <div className="apple-main apple-main--wide chat-page">
      <div className={`chat-layout ${mobileShowChat ? 'chat-layout--show-chat' : ''}`}>
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2>Tin nhắn</h2>
            <button
              type="button"
              className="chat-create-group-btn"
              onClick={() => setShowCreateGroup(true)}
              aria-label="Tạo nhóm chat mới"
              title="Tạo nhóm chat mới"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
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
            <div className="chat-empty">Đang tải...</div>
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
              <div className="chat-empty-icon" aria-hidden="true" />
              <p>Chọn cuộc trò chuyện để bắt đầu</p>
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
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
            <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
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
