import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { connectWebSocket, disconnectWebSocket, on, sendReadHistory } from '../services/websocket';
import { getConversations } from '../services/chat';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimers = useRef({});

  useEffect(() => {
    if (!token) return;

    connectWebSocket(token, (connected) => {
      setWsConnected(connected);
    });

    return () => disconnectWebSocket();
  }, [token]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

  useEffect(() => {
    const unsubs = [
      on('updateNewMessage', (msg) => {
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c.id == msg.conversation_id) {
              return {
                ...c,
                last_message: msg.content,
                last_message_type: msg.content_type,
                last_message_sender_id: msg.sender_id,
                last_message_at: msg.created_at,
                unread_count: activeConversation?.id == msg.conversation_id
                  ? c.unread_count
                  : (parseInt(c.unread_count) || 0) + 1,
              };
            }
            return c;
          });
          updated.sort((a, b) => {
            const ta = a.last_message_at || a.updated_at || '';
            const tb = b.last_message_at || b.updated_at || '';
            return tb.localeCompare(ta);
          });
          return updated;
        });
      }),

      on('updateUserStatus', (data) => {
        setOnlineUsers(prev => ({ ...prev, [data.user_id]: data.is_online }));
        setConversations(prev => prev.map(c => {
          if (c.other_user_id === data.user_id) {
            return { ...c, is_online: data.is_online };
          }
          return c;
        }));
      }),

      on('updateUserTyping', (data) => {
        const key = `${data.conversation_id}_${data.user_id}`;
        setTypingUsers(prev => ({ ...prev, [key]: true }));

        if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
        typingTimers.current[key] = setTimeout(() => {
          setTypingUsers(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }, 3000);
      }),

      on('updateReadHistory', (data) => {
        // Could update UI to show read receipts
      }),
    ];

    return () => unsubs.forEach(u => u());
  }, [activeConversation]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data || []);
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  }, []);

  const markConversationRead = useCallback((conversationId, messageId) => {
    sendReadHistory(conversationId, messageId);
    setConversations(prev => prev.map(c => {
      if (c.id == conversationId) return { ...c, unread_count: 0 };
      return c;
    }));
  }, []);

  const totalUnread = conversations.reduce((sum, c) => sum + (parseInt(c.unread_count) || 0), 0);

  return (
    <ChatContext.Provider value={{
      conversations,
      setConversations,
      activeConversation,
      setActiveConversation,
      wsConnected,
      onlineUsers,
      typingUsers,
      loadConversations,
      markConversationRead,
      totalUnread,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
