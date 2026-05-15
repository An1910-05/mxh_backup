import { useEffect, useRef, useState } from 'react';

const GLITCH_CHARS = '!<>-_\\/[]{}—=+*^?#________';

/**
 * GlitchText — cycle qua mảng `words`, mỗi lần đổi chạy hiệu ứng scramble
 * theo cơ chế JolyUI: random ký tự đến khi từng ký tự đích lộ ra dần dần.
 */
export function GlitchText({ words = [], interval = 3000, glitchDuration = 300, className = '' }) {
  const [index, setIndex] = useState(0);
  const [display, setDisplay] = useState(words[0] || '');
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    if (!words.length) return undefined;
    const timer = setInterval(() => {
      setIsGlitching(true);
      const nextIndex = (index + 1) % words.length;
      const target = words[nextIndex] || '';
      const iterations = 10;
      let iter = 0;
      const stepMs = Math.max(20, Math.floor(glitchDuration / iterations));
      const stepTimer = setInterval(() => {
        setDisplay(target
          .split('')
          .map((ch, i) => i < iter ? ch : GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)])
          .join(''));
        iter += 1;
        if (iter > target.length) {
          clearInterval(stepTimer);
          setDisplay(target);
          setIndex(nextIndex);
          setIsGlitching(false);
        }
      }, stepMs);
    }, interval);
    return () => clearInterval(timer);
  }, [index, words, interval, glitchDuration]);

  return (
    <span className={`jly-glitch-text ${isGlitching ? 'is-glitching' : ''} ${className}`}>
      {display || ' '}
    </span>
  );
}

/**
 * TypewriterText — gõ từng ký tự từ chuỗi `text`, có cursor blink.
 * `speed` = ms per ký tự.
 */
export function TypewriterText({ text = '', speed = 40, startDelay = 0, className = '' }) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    setShown('');
    if (!text) return undefined;
    let i = 0;
    const start = setTimeout(() => {
      const t = setInterval(() => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length) clearInterval(t);
      }, speed);
      return () => clearInterval(t);
    }, startDelay);
    return () => clearTimeout(start);
  }, [text, speed, startDelay]);

  return <span className={`jly-typewriter ${className}`}>{shown}</span>;
}

/**
 * useLiquidMetalRipple — gọi 1 lần trong trang shop để các button class
 * `.shop-lg-btn-buy / -checkout / -search-btn / -seller-cta:not(.ghost)`
 * tự có ripple khi click (đọc tọa độ click → set CSS var → add `.is-rippling` 600ms).
 */
export function useLiquidMetalRipple(scopeRef) {
  const handlerRef = useRef(null);

  useEffect(() => {
    const root = scopeRef?.current || document;
    const onClick = (e) => {
      const btn = e.target.closest && e.target.closest(
        '.shop-lg-btn-buy, .shop-lg-checkout, .shop-lg-search-btn, .shop-lg-seller-cta'
      );
      if (!btn || btn.classList.contains('ghost')) return;
      if (btn.disabled) return;
      const rect = btn.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      btn.style.setProperty('--jly-rx', `${x}%`);
      btn.style.setProperty('--jly-ry', `${y}%`);
      btn.classList.remove('is-rippling');
      // Force reflow để animation chạy lại
      // eslint-disable-next-line no-unused-expressions
      void btn.offsetWidth;
      btn.classList.add('is-rippling');
      setTimeout(() => btn.classList.remove('is-rippling'), 650);
    };
    handlerRef.current = onClick;
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [scopeRef]);
}
