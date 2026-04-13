import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import { getOrCreateConversation } from '../services/chat';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import AIChatWindow from '../components/chat/AIChatWindow';

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeConversation, setActiveConversation, conversations, loadConversations } = useChat();
  const [loading, setLoading] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);

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

  return (
    <div className="apple-main apple-main--wide chat-page">
      <div className={`chat-layout ${mobileShowChat ? 'chat-layout--show-chat' : ''}`}>
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2>Tin nhắn</h2>
          </div>
          <ConversationList
            conversations={conversations}
            activeId={activeConversation?.id}
            onSelect={handleSelectConversation}
            onConversationCleared={handleConversationCleared}
            onMessagesHiddenForMe={handleMessagesHiddenForMe}
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
            />
          ) : (
            <div className="chat-empty">
              <div className="chat-empty-icon" aria-hidden="true" />
              <p>Chọn cuộc trò chuyện để bắt đầu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
