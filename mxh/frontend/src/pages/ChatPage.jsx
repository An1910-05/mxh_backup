import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import { getOrCreateConversation } from '../services/chat';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import AIChatWindow from '../components/chat/AIChatWindow';
import CreateGroupModal from '../components/chat/CreateGroupModal';
import NewDirectMessageModal from '../components/chat/NewDirectMessageModal';

// Server timestamps không có 'Z' → append để parse UTC đúng, nhất quán với Date.now()
const parseServerMs = (str) => {
  if (!str) return 0;
  return new Date(str.endsWith('Z') ? str : str + 'Z').getTime();
};

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeConversation, setActiveConversation, conversations, loadConversations } = useChat();
  const [loading, setLoading] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // { convId: hiddenAtTimestamp } — persisted across reloads, cleared when new message arrives
  const [hiddenConvs, setHiddenConvs] = useState(() => {
    try {
      const raw = localStorage.getItem('chat_hidden_convs');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Sync hiddenConvs → localStorage on every change
  useEffect(() => {
    try {
      if (Object.keys(hiddenConvs).length === 0) {
        localStorage.removeItem('chat_hidden_convs');
      } else {
        localStorage.setItem('chat_hidden_convs', JSON.stringify(hiddenConvs));
      }
    } catch { /* storage unavailable */ }
  }, [hiddenConvs]);

  // Auto-reveal conversations that received a new message after being hidden
  useEffect(() => {
    if (!conversations?.length || !Object.keys(hiddenConvs).length) return;
    const toReveal = conversations
      .filter(c => {
        const hiddenAt = hiddenConvs[String(c.id)];
        if (!hiddenAt) return false;
        return parseServerMs(c.last_message_at) > hiddenAt;
      })
      .map(c => String(c.id));
    if (!toReveal.length) return;
    setHiddenConvs(prev => {
      const next = { ...prev };
      toReveal.forEach(id => delete next[id]);
      return next;
    });
  }, [conversations, hiddenConvs]);

  useEffect(() => {
    if (!showMenu) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

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

  const hideConvLocally = (convId) => {
    setHiddenConvs(prev => ({ ...prev, [String(convId)]: Date.now() }));
    if (activeConversation && String(activeConversation.id) === String(convId)) {
      setActiveConversation(null);
      setMobileShowChat(false);
    }
  };

  const handleConversationCleared = (convId) => {
    hideConvLocally(convId);
    loadConversations();
  };

  const handleMessagesHiddenForMe = (convId) => {
    hideConvLocally(convId);
  };

  // Conversations to show: exclude locally hidden ones unless a newer message arrived after hiding
  const visibleConversations = useMemo(() => {
    if (Object.keys(hiddenConvs).length === 0) return conversations || [];
    return (conversations || []).filter(c => {
      const hiddenAt = hiddenConvs[String(c.id)];
      if (!hiddenAt) return true;
      return parseServerMs(c.last_message_at) > hiddenAt;
    });
  }, [conversations, hiddenConvs]);

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

  const handleOpenDM = async (userId) => {
    const conv = await getOrCreateConversation(userId);
    setShowNewDM(false);
    setActiveConversation(conv);
    setMobileShowChat(true);
    await loadConversations();
  };

  return (
    <div className="apple-main apple-main--wide chat-page chat-page--v2">
      <div className={`chat-layout ${mobileShowChat ? 'chat-layout--show-chat' : ''}`}>
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2>Đoạn chat</h2>
            <div className="chat-actions-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className={`chat-create-group-btn${showMenu ? ' chat-create-group-btn--active' : ''}`}
                onClick={() => setShowMenu(v => !v)}
                aria-label="Tùy chọn"
                title="Tùy chọn"
              >
                <i className="bi bi-three-dots" aria-hidden="true" />
              </button>
              {showMenu && (
                <div className="chat-actions-menu">
                  <button
                    type="button"
                    className="chat-actions-menu-item"
                    onClick={() => { setShowMenu(false); setShowNewDM(true); }}
                  >
                    <span className="chat-actions-menu-icon chat-actions-menu-icon--blue">
                      <i className="bi bi-pencil-square"></i>
                    </span>
                    <span>Nhắn tin mới</span>
                  </button>
                  <button
                    type="button"
                    className="chat-actions-menu-item"
                    onClick={() => { setShowMenu(false); setShowCreateGroup(true); }}
                  >
                    <span className="chat-actions-menu-icon chat-actions-menu-icon--green">
                      <i className="bi bi-people-fill"></i>
                    </span>
                    <span>Tạo nhóm chat</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <ConversationList
            conversations={visibleConversations}
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

      {showNewDM && (
        <NewDirectMessageModal
          onClose={() => setShowNewDM(false)}
          onOpen={handleOpenDM}
        />
      )}
    </div>
  );
}
