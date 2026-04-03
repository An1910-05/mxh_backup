import { Link } from 'react-router-dom';

export default function BlobButton({ children, href, onClick, variant = 'primary', type = 'button', disabled, style }) {
  const inner = (
    <>
      {children}
      <span className="blob-btn__inner">
        <span className="blob-btn__blobs">
          <span className="blob-btn__blob" />
          <span className="blob-btn__blob" />
          <span className="blob-btn__blob" />
          <span className="blob-btn__blob" />
        </span>
      </span>
    </>
  );

  const cls = `blob-btn blob-btn--${variant}`;

  if (href) {
    return (
      <Link to={href} className={cls} style={style}>
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} style={style}>
      {inner}
    </button>
  );
}

export function BlobSvgFilter() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </defs>
    </svg>
  );
}
