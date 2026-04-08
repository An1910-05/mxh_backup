export default function GamesPage() {
  return (
    <div className="apple-main fade-in">
      <div className="games-page">
        <div className="games-header">
          <h1 className="games-title">Trò chơi</h1>
          <p className="games-subtitle">Khám phá các trò chơi vui nhộn trên iPock</p>
        </div>
        <div className="games-empty">
          <div className="games-empty-icon">
            <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="16" width="56" height="32" rx="6"/>
              <line x1="16" y1="32" x2="28" y2="32"/>
              <line x1="22" y1="26" x2="22" y2="38"/>
              <circle cx="42" cy="28" r="2.5" fill="currentColor"/>
              <circle cx="48" cy="34" r="2.5" fill="currentColor"/>
            </svg>
          </div>
          <p className="games-empty-text">Sắp ra mắt! Các trò chơi đang được phát triển.</p>
        </div>
      </div>
    </div>
  );
}
