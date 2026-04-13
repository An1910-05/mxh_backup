import { useState, useEffect } from 'react';
import { API_ORIGIN } from '../config';

const STORAGE_KEY = 'mxh_ai_chat_history';
const MAX_HISTORY = 30;

export function useAIMessages() {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_ORIGIN}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: newMessages.slice(-20) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi kết nối AI');
      setMessages(prev => [...prev, { role: 'assistant', content: data.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { messages, loading, sendMessage, clearMessages };
}
