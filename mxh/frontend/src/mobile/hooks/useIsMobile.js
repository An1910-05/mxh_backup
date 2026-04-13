import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;
const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    // Giống Facebook: ưu tiên user agent — nếu là thiết bị di động thật thì luôn mobile
    if (isMobileDevice()) return true;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    // Nếu là thiết bị di động thật (user agent) → không cần theo dõi resize
    if (isMobileDevice()) return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
