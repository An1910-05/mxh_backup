import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { connectWebSocket, disconnectWebSocket, on, sendReadHistory } from '../services/websocket';
import { getConversations } from '../services/chat';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimers = useRef({});
  // Always up-to-date reference used inside WS callbacks to avoid stale closures
  const conversationsRef = useRef([]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

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
        // If conversation isn't in current list (e.g. was hidden then removed), reload to surface it
        if (!conversationsRef.current.some(c => c.id == msg.conversation_id)) {
          loadConversations();
          return;
        }
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c.id == msg.conversation_id) {
              return {
                ...c,
                last_message: msg.content,
                last_message_type: msg.content_type,
                last_message_sender_id: msg.sender_id,
                last_message_sender_username: msg.username || c.last_message_sender_username,
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
          if (c.type === 'private' && c.other_user_id === data.user_id) {
            return { ...c, is_online: data.is_online };
          }
          // Group: online_member_count được cập nhật chính xác khi loadConversations() chạy lại.
          // Tránh optimistic bump vì WS presence broadcast cho mọi user, client không biết
          // user đó có trong group này không.
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

      // Sender's own message — server only sends 'ack' (not updateNewMessage) to the sender
      on('ack', (msg) => {
        if (!msg || !msg.conversation_id) return;
        if (!conversationsRef.current.some(c => c.id == msg.conversation_id)) {
          loadConversations();
          return;
        }
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c.id == msg.conversation_id) {
              return {
                ...c,
                last_message: msg.content,
                last_message_type: msg.content_type,
                last_message_sender_id: msg.sender_id,
                last_message_sender_username: msg.username || c.last_message_sender_username,
                last_message_at: msg.created_at,
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

  // Floating chat windows (Facebook-style popups)
  const [openChats, setOpenChats] = useState([]);

  const openChat = useCallback((conv) => {
    setOpenChats(prev => {
      if (prev.some(c => c.id === conv.id)) {
        // Already open — un-minimize it
        return prev.map(c => c.id === conv.id ? { ...c, minimized: false } : c);
      }
      return [...prev, { ...conv, minimized: false }];
    });
  }, []);

  const closeChat = useCallback((convId) => {
    setOpenChats(prev => prev.filter(c => c.id !== convId));
  }, []);

  const minimizeChat = useCallback((convId) => {
    setOpenChats(prev => prev.map(c => c.id === convId ? { ...c, minimized: !c.minimized } : c));
  }, []);

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
      openChats,
      openChat,
      closeChat,
      minimizeChat,
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
