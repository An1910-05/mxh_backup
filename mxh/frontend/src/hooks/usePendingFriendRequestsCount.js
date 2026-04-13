import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getPendingFriendRequests } from '../services/graphql';

export default function usePendingFriendRequestsCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }

    try {
      const requests = await getPendingFriendRequests();
      setCount(Array.isArray(requests) ? requests.length : 0);
    } catch (err) {
      console.error('[friends] fetch pending request count failed:', err);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 45000);
    const onBump = () => refresh();
    window.addEventListener('mxh-friend-requests-refresh', onBump);
    return () => {
      clearInterval(t);
      window.removeEventListener('mxh-friend-requests-refresh', onBump);
    };
  }, [refresh]);

  return { count, refresh };
}
