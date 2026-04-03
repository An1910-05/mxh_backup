import { useState, useEffect, useCallback } from 'react';
import { getNotificationUnreadCount } from '../services/graphql';

export default function useNotificationUnread() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const n = await getNotificationUnreadCount();
      setCount(typeof n === 'number' ? n : 0);
    } catch (err) { console.error('[notif] fetch unread count failed:', err); }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 45000);
    const onBump = () => refresh();
    window.addEventListener('mxh-notif-refresh', onBump);
    return () => {
      clearInterval(t);
      window.removeEventListener('mxh-notif-refresh', onBump);
    };
  }, [refresh]);

  return { count, refresh };
}
