const GAMES = [
  {
    id: 'tiu-xai',
    name: 'Tỉu Xài',
    desc: 'Đặt cược 3 viên xúc xắc. Tổng 3-10 là TỈU, 11-18 là XÀI. Jackpot khi ra 1+1+1 hoặc 6+6+6.',
    icon: '🎲',
    badge: 'HOT',
    launch: 'Mở bằng popup',
    onClick: () => window.dispatchEvent(new CustomEvent('open-tiu-xai')),
  },
];

export default function GamesPage() {
  return (
    <div className="apple-main apple-main--wide fade-in">
      <div className="games-page">
        <div className="games-header">
          <span className="games-eyebrow">Game Hub</span>
          <h1 className="games-title">Trò chơi</h1>
          <p className="games-subtitle">
            Chọn trò chơi bạn muốn mở. Hiện tại danh mục đang có bàn chơi Tỉu Xài và bàn chơi sẽ xuất hiện dưới dạng popup.
          </p>
        </div>

        <div className="games-grid">
          {GAMES.map((game) => (
            <button key={game.id} type="button" className="game-card" onClick={game.onClick}>
              <div className="game-card-icon" aria-hidden="true">{game.icon}</div>
              <div className="game-card-info">
                <div className="game-card-topline">
                  <span className="game-card-mode">{game.launch}</span>
                  {game.badge && <span className="game-card-badge">{game.badge}</span>}
                </div>
                <div className="game-card-name">{game.name}</div>
                <div className="game-card-desc">{game.desc}</div>
              </div>
              <div className="game-card-arrow" aria-hidden="true">›</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
