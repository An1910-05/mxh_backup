import { useEffect, useRef, useState } from 'react';

const FADE_MS = 500;      // khớp với transition trong styles.css (.auth-intro-splash)
const SAFETY_MS = 10000;  // video ~6s; chốt chặn để splash không bao giờ bị kẹt

/**
 * Splash overlay phát video intro logo iPock toàn màn hình.
 * Tự đóng (fade-out) khi video kết thúc, người dùng bấm "Bỏ qua", hoặc nhấn ESC.
 * Gọi onFinish() sau khi fade-out xong để parent gỡ overlay.
 */
export default function AuthIntroSplash({ onFinish }) {
  const [closing, setClosing] = useState(false);
  const videoRef = useRef(null);
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setClosing(true);
    window.setTimeout(() => onFinish?.(), FADE_MS);
  };

  useEffect(() => {
    // ESC để bỏ qua
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);

    // Cố gắng autoplay; nếu trình duyệt chặn (hiếm khi đã muted) → vào thẳng login
    const video = videoRef.current;
    const playPromise = video?.play?.();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => finish());
    }

    // Chốt chặn an toàn: không để overlay kẹt nếu onEnded không bắn
    const safety = window.setTimeout(finish, SAFETY_MS);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`auth-intro-splash${closing ? ' auth-intro-splash--closing' : ''}`}
      role="dialog"
      aria-label="Giới thiệu iPock"
    >
      <video
        ref={videoRef}
        className="auth-intro-video"
        src="/ipock-intro.mp4"
        autoPlay
        muted
        playsInline
        preload="metadata"
        onEnded={finish}
        onError={finish}
      />
      <button
        type="button"
        className="auth-intro-skip"
        onClick={finish}
        aria-label="Bỏ qua đoạn giới thiệu"
      >
        Bỏ qua
        <i className="bi bi-chevron-right" aria-hidden="true" />
      </button>
    </div>
  );
}
