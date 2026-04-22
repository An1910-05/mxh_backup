export default function GamesPage() {
  const openTaiXiu = () => window.dispatchEvent(new CustomEvent('mxh-open-taixiu'));

  return (
    <div className="apple-main fade-in">
      <div className="games-page">
        <div className="games-header">
          <h1 className="games-title">Trò chơi</h1>
          <p className="games-sub">Chơi cùng bạn bè, kết quả server quyết định</p>
        </div>

        <div className="games-grid">
          <button className="game-card" onClick={openTaiXiu}>
            <div className="game-card-icon">🎲</div>
            <div className="game-card-info">
              <strong>Tỉu Xài</strong>
              <span>Server-round · 30 giây / phiên</span>
            </div>
            <div className="game-card-play">Chơi</div>
          </button>

          <div className="game-card game-card--soon">
            <div className="game-card-icon">🃏</div>
            <div className="game-card-info">
              <strong>Xóc đĩa</strong>
              <span>Sắp ra mắt</span>
            </div>
            <div className="game-card-play game-card-play--soon">Sớm thôi</div>
          </div>

          <div className="game-card game-card--soon">
            <div className="game-card-icon">🎰</div>
            <div className="game-card-info">
              <strong>Slot</strong>
              <span>Sắp ra mắt</span>
            </div>
            <div className="game-card-play game-card-play--soon">Sớm thôi</div>
          </div>
        </div>
      </div>
    </div>
  );
}
