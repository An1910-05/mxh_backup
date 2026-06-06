import { useNavigate } from 'react-router-dom';

export default function GamesPage() {
  const navigate = useNavigate();
  const openTaiXiu = () => window.dispatchEvent(new CustomEvent('mxh-open-taixiu'));
  const openCaro = () => navigate('/games/caro');

  return (
    <div className="apple-main fade-in">
      <div className="games-page">
        <div className="games-header">
          <h1 className="games-title">Trò chơi</h1>
          <p className="games-sub">Chơi cùng bạn bè, kết quả server quyết định</p>
        </div>

        <div className="games-grid">
          {/* Tạm ẩn game Tài Xỉu — bỏ comment khối dưới để hiện lại
          <button className="game-card" onClick={openTaiXiu}>
            <div className="game-card-icon">🎲</div>
            <div className="game-card-info">
              <strong>Tỉu Xài</strong>
              <span>Server-round · 30 giây / phiên</span>
            </div>
            <div className="game-card-play">Chơi</div>
          </button>
          */}

          <button className="game-card" onClick={openCaro}>
            <div className="game-card-icon">⚪</div>
            <div className="game-card-info">
              <strong>Cờ Caro</strong>
              <span>Tạo phòng / Ghép ngẫu nhiên / Chơi với máy</span>
            </div>
            <div className="game-card-play">Chơi</div>
          </button>
        </div>
      </div>
    </div>
  );
}
