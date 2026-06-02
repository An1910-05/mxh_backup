import { useEffect, useRef, useState } from 'react';

/**
 * Khuôn mặt gấu hoạt hình cho trang đăng nhập.
 * - Con ngươi (pupil) dõi theo con trỏ chuột.
 * - Khi `covering` = true (đang nhập mật khẩu): hai bàn tay đưa lên che mắt.
 * Thuần SVG + CSS, không thư viện ngoài.
 */
export default function AnimatedLoginFace({ covering = false }) {
  const wrapRef = useRef(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (covering) {
      setPupil({ x: 0, y: 0 });
      return; // đang che mắt thì khỏi theo dõi chuột
    }
    const handleMove = (e) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(Math.hypot(dx, dy) / 40, 1); // 0..1
      const max = 6; // độ lệch tối đa (đơn vị viewBox)
      setPupil({ x: Math.cos(angle) * max * dist, y: Math.sin(angle) * max * dist });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [covering]);

  return (
    <div className="auth-face" ref={wrapRef} aria-hidden="true">
      <svg viewBox="0 0 200 200" className="auth-face-svg" role="img">
        {/* Tai */}
        <circle cx="56" cy="54" r="27" className="auth-face-ear" />
        <circle cx="144" cy="54" r="27" className="auth-face-ear" />
        <circle cx="56" cy="54" r="14" className="auth-face-ear-inner" />
        <circle cx="144" cy="54" r="14" className="auth-face-ear-inner" />

        {/* Đầu */}
        <circle cx="100" cy="112" r="72" className="auth-face-head" />

        {/* Mắt */}
        <g className="auth-face-eyes">
          <circle cx="74" cy="102" r="15" className="auth-face-eye-white" />
          <circle cx="126" cy="102" r="15" className="auth-face-eye-white" />
          <circle cx={74 + pupil.x} cy={102 + pupil.y} r="7.5" className="auth-face-pupil" />
          <circle cx={126 + pupil.x} cy={102 + pupil.y} r="7.5" className="auth-face-pupil" />
          <circle cx={71 + pupil.x} cy={99 + pupil.y} r="2.4" className="auth-face-glint" />
          <circle cx={123 + pupil.x} cy={99 + pupil.y} r="2.4" className="auth-face-glint" />
        </g>

        {/* Mõm + mũi + miệng */}
        <ellipse cx="100" cy="140" rx="28" ry="22" className="auth-face-snout" />
        <ellipse cx="100" cy="130" rx="9" ry="6.5" className="auth-face-nose" />
        <path d="M100 137 V146 M100 146 Q90 154 82 147 M100 146 Q110 154 118 147"
          className="auth-face-mouth" fill="none" />

        {/* Bàn tay che mắt (mặc định giấu dưới, trượt lên khi covering) */}
        <g className={`auth-face-paws${covering ? ' is-covering' : ''}`}>
          <circle cx="72" cy="98" r="27" className="auth-face-paw" />
          <circle cx="128" cy="98" r="27" className="auth-face-paw" />
          <ellipse cx="72" cy="100" rx="11" ry="14" className="auth-face-paw-pad" />
          <ellipse cx="128" cy="100" rx="11" ry="14" className="auth-face-paw-pad" />
        </g>
      </svg>
    </div>
  );
}
