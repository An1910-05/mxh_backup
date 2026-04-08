import { useEffect, useRef, useState } from 'react';

const INITIAL_BALANCE = 5000;
const DEFAULT_STAKE = 500;
const BALANCE_STORAGE_KEY = 'mxh-tai-xiu-balance';
const STAKE_OPTIONS = [100, 250, 500, 1000, 2000];

function formatCoins(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' xu';
}

function rollDice() {
  return Array.from({ length: 3 }, () => Math.floor(Math.random() * 6) + 1);
}

function getOutcome(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  const isTriple = values.every((value) => value === values[0]);

  if (isTriple) {
    return {
      total,
      key: 'triple',
      label: 'Bộ ba',
    };
  }

  return {
    total,
    key: total >= 11 ? 'tai' : 'xiu',
    label: total >= 11 ? 'Tài' : 'Xỉu',
  };
}

export default function GamesPage() {
  const [isTaiXiuOpen, setIsTaiXiuOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState('tai');
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [dice, setDice] = useState([6, 5, 4]);
  const [rolling, setRolling] = useState(false);
  const [roundResult, setRoundResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [balance, setBalance] = useState(() => {
    if (typeof window === 'undefined') return INITIAL_BALANCE;

    const savedBalance = Number(window.localStorage.getItem(BALANCE_STORAGE_KEY));
    return Number.isFinite(savedBalance) && savedBalance > 0 ? savedBalance : INITIAL_BALANCE;
  });

  const rollIntervalRef = useRef(null);
  const rollTimeoutRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem(BALANCE_STORAGE_KEY, String(balance));
  }, [balance]);

  useEffect(() => {
    if (!isTaiXiuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClosePopup();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTaiXiuOpen]);

  useEffect(() => () => {
    clearRollingTimers();
  }, []);

  const clearRollingTimers = () => {
    if (rollIntervalRef.current) {
      window.clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }

    if (rollTimeoutRef.current) {
      window.clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = null;
    }
  };

  const handleOpenPopup = () => {
    setIsTaiXiuOpen(true);
  };

  const handleClosePopup = () => {
    clearRollingTimers();
    setRolling(false);
    setIsTaiXiuOpen(false);
  };

  const handleResetBalance = () => {
    setBalance(INITIAL_BALANCE);
    setStake(DEFAULT_STAKE);
    setRoundResult(null);
    setHistory([]);
  };

  const handleRoll = () => {
    if (rolling || stake > balance) return;

    clearRollingTimers();
    setRolling(true);
    setRoundResult(null);

    rollIntervalRef.current = window.setInterval(() => {
      setDice(rollDice());
    }, 90);

    rollTimeoutRef.current = window.setTimeout(() => {
      clearRollingTimers();

      const finalDice = rollDice();
      const outcome = getOutcome(finalDice);
      const didWin = outcome.key !== 'triple' && outcome.key === selectedSide;
      const delta = didWin ? stake : -stake;

      setDice(finalDice);
      setBalance((currentBalance) => Math.max(0, currentBalance + delta));

      const result = {
        id: Date.now(),
        dice: finalDice,
        total: outcome.total,
        outcome: outcome.label,
        picked: selectedSide === 'tai' ? 'Tài' : 'Xỉu',
        didWin,
        delta,
      };

      setRoundResult(result);
      setHistory((currentHistory) => [result, ...currentHistory].slice(0, 5));
      setRolling(false);
    }, 1000);
  };

  const selectedLabel = selectedSide === 'tai' ? 'Tài' : 'Xỉu';
  const canRoll = !rolling && stake <= balance;

  return (
    <div className="apple-main fade-in">
      <div className="games-page">
        <div className="games-header">
          <h1 className="games-title">Trò chơi</h1>
          <p className="games-subtitle">Khám phá vài mini game giải trí nhanh ngay trên iPock.</p>
        </div>

        <div className="games-grid">
          <button type="button" className="game-card game-card--tai-xiu" onClick={handleOpenPopup}>
            <div className="game-card-top">
              <span className="game-card-badge">Hot</span>
              <span className="game-card-status">Popup game</span>
            </div>

            <div className="game-card-icon" aria-hidden="true">
              <span>🎲</span>
            </div>

            <div className="game-card-content">
              <h2 className="game-card-title">Tài xỉu</h2>
              <p className="game-card-description">
                Chọn Tài hoặc Xỉu, đặt cược nhanh và lắc 3 viên xúc xắc ngay trong popup.
              </p>
            </div>

            <div className="game-card-meta">
              <span className="game-card-chip">3 xúc xắc</span>
              <span className="game-card-chip">Chơi nhanh</span>
              <span className="game-card-chip">Không cần tải trang</span>
            </div>

            <div className="game-card-footer">
              <span className="game-card-balance">{formatCoins(balance)}</span>
              <span className="game-card-cta">Chơi ngay</span>
            </div>
          </button>
        </div>

        <p className="games-footnote">Hiện mình đã thêm game Tài xỉu dạng popup để bạn bấm vào là chơi được ngay.</p>

        {isTaiXiuOpen && (
          <div className="game-popup-overlay" onClick={handleClosePopup}>
            <div
              className="game-popup tai-xiu-popup"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tai-xiu-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="game-popup-header">
                <div>
                  <p className="game-popup-eyebrow">Mini game</p>
                  <h2 className="game-popup-title" id="tai-xiu-title">Tài xỉu</h2>
                </div>

                <button type="button" className="game-popup-close" onClick={handleClosePopup} aria-label="Đóng popup">
                  ×
                </button>
              </div>

              <div className="tai-xiu-hero">
                <div className="tai-xiu-balance-card">
                  <span className="tai-xiu-balance-label">Số xu hiện có</span>
                  <strong className="tai-xiu-balance-value">{formatCoins(balance)}</strong>
                </div>

                <button type="button" className="tai-xiu-secondary-btn" onClick={handleResetBalance}>
                  Làm mới 5.000 xu
                </button>
              </div>

              <div className="tai-xiu-board">
                <div className="tai-xiu-dice-row">
                  {dice.map((value, index) => (
                    <div
                      key={`${value}-${index}`}
                      className={`tai-xiu-die${rolling ? ' tai-xiu-die--rolling' : ''}`}
                    >
                      {value}
                    </div>
                  ))}
                </div>

                <div className="tai-xiu-total">
                  <span className="tai-xiu-total-label">Tổng điểm</span>
                  <strong className="tai-xiu-total-value">{dice.reduce((sum, value) => sum + value, 0)}</strong>
                </div>
              </div>

              <div className="tai-xiu-section">
                <p className="tai-xiu-section-label">Chọn cửa</p>
                <div className="tai-xiu-choice-grid">
                  <button
                    type="button"
                    className={`tai-xiu-choice${selectedSide === 'tai' ? ' tai-xiu-choice--active' : ''}`}
                    onClick={() => setSelectedSide('tai')}
                  >
                    <span className="tai-xiu-choice-title">Tài</span>
                    <span className="tai-xiu-choice-desc">11 - 17 điểm</span>
                  </button>

                  <button
                    type="button"
                    className={`tai-xiu-choice${selectedSide === 'xiu' ? ' tai-xiu-choice--active' : ''}`}
                    onClick={() => setSelectedSide('xiu')}
                  >
                    <span className="tai-xiu-choice-title">Xỉu</span>
                    <span className="tai-xiu-choice-desc">4 - 10 điểm</span>
                  </button>
                </div>
              </div>

              <div className="tai-xiu-section">
                <div className="tai-xiu-stake-header">
                  <p className="tai-xiu-section-label">Mức cược</p>
                  <span className="tai-xiu-stake-current">{formatCoins(stake)}</span>
                </div>

                <div className="tai-xiu-stake-grid">
                  {STAKE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`tai-xiu-stake${stake === option ? ' tai-xiu-stake--active' : ''}`}
                      onClick={() => setStake(option)}
                    >
                      {formatCoins(option)}
                    </button>
                  ))}
                </div>
              </div>

              <button type="button" className="tai-xiu-roll-btn" onClick={handleRoll} disabled={!canRoll}>
                {rolling ? 'Đang lắc xúc xắc...' : `Đặt ${formatCoins(stake)} vào ${selectedLabel}`}
              </button>

              {!canRoll && (
                <p className="tai-xiu-warning">Số xu hiện tại không đủ cho mức cược này. Hãy giảm cược hoặc làm mới xu.</p>
              )}

              <p className="tai-xiu-note">
                Luật nhanh: 11 - 17 là Tài, 4 - 10 là Xỉu. Nếu ra bộ ba thì cả hai cửa đều thua.
              </p>

              {roundResult && (
                <div className={`tai-xiu-result${roundResult.didWin ? ' tai-xiu-result--win' : ' tai-xiu-result--lose'}`}>
                  <div>
                    <p className="tai-xiu-result-title">{roundResult.didWin ? 'Bạn thắng rồi!' : 'Chưa may mắn lần này'}</p>
                    <p className="tai-xiu-result-text">
                      Kết quả ra <strong>{roundResult.outcome}</strong> với tổng <strong>{roundResult.total}</strong>. Bạn chọn{' '}
                      <strong>{roundResult.picked}</strong>.
                    </p>
                  </div>
                  <strong className="tai-xiu-result-delta">
                    {roundResult.didWin ? '+' : ''}
                    {formatCoins(roundResult.delta)}
                  </strong>
                </div>
              )}

              <div className="tai-xiu-history">
                <div className="tai-xiu-history-header">
                  <h3 className="tai-xiu-history-title">Lịch sử gần đây</h3>
                  <span className="tai-xiu-history-caption">5 ván mới nhất</span>
                </div>

                {history.length === 0 ? (
                  <p className="tai-xiu-history-empty">Chưa có ván nào, bấm chơi để thử vận may.</p>
                ) : (
                  <div className="tai-xiu-history-list">
                    {history.map((item) => (
                      <div key={item.id} className="tai-xiu-history-item">
                        <div>
                          <p className="tai-xiu-history-line">
                            {item.picked} gặp {item.outcome} ({item.dice.join(' - ')})
                          </p>
                          <p className="tai-xiu-history-subline">Tổng {item.total}</p>
                        </div>

                        <span className={`tai-xiu-history-badge${item.didWin ? ' tai-xiu-history-badge--win' : ' tai-xiu-history-badge--lose'}`}>
                          {item.didWin ? `+${formatCoins(item.delta)}` : formatCoins(item.delta)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
