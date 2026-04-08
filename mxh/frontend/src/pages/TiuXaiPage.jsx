import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getTiuXaiSession, placeTiuXaiBet, getTiuXaiHistory, getMyTiuXaiBets } from '../services/auth';

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const BET_PRESETS = [10000, 20000, 50000, 100000, 200000, 500000, 1000000];

function fmt(n) {
  if (!n && n !== 0) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 0) + 'K';
  return String(n);
}

function fmtFull(n) {
  return new Intl.NumberFormat('vi-VN').format(n || 0);
}

function DiceFace({ value, rolling }) {
  return (
    <div className={`tx-dice${rolling ? ' tx-dice--rolling' : ''}${value ? ' tx-dice--shown' : ''}`}>
      {value ? DICE_FACES[value] : '?'}
    </div>
  );
}

function CountdownRing({ remaining, total }) {
  const pct = total > 0 ? Math.max(0, remaining / total) : 0;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg className="tx-ring" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#2a1200" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={r} fill="none"
        stroke={remaining <= 5 ? '#ff4444' : '#f5c518'}
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dasharray 0.9s linear' }}
      />
      <text x="50" y="54" textAnchor="middle" fill="#fff8e1" fontSize="22" fontWeight="bold" fontFamily="monospace">
        {remaining}
      </text>
    </svg>
  );
}

const STATE_LABEL = {
  betting: 'ĐANG CƯỢC',
  locked: 'KHÓA CƯỢC',
  rolling: 'LẮC XÚC XẮC',
  result: 'KẾT QUẢ',
  reward: 'TÍNH THƯỞNG',
};

export default function TiuXaiPage() {
  const { user } = useAuth();

  const [session, setSession]       = useState(null);
  const [config, setConfig]         = useState(null);
  const [betAmount, setBetAmount]   = useState('');
  const [betLoading, setBetLoading] = useState(false);
  const [betMsg, setBetMsg]         = useState('');
  const [betErr, setBetErr]         = useState('');
  const [balance, setBalance]       = useState(user?.balance ?? 0);
  const [panel, setPanel]           = useState(null); // null | 'info' | 'mybets' | 'history' | 'jackpot'
  const [history, setHistory]       = useState([]);
  const [myBets, setMyBets]         = useState([]);
  const [histPage, setHistPage]     = useState(1);
  const [histTotal, setHistTotal]   = useState(1);
  const [myBetsPage, setMyBetsPage] = useState(1);
  const [prevState, setPrevState]   = useState(null);
  const [flashResult, setFlashResult] = useState(null); // 'tiu' | 'xai' | null
  const pollRef = useRef(null);

  const fetchSession = useCallback(async () => {
    try {
      const data = await getTiuXaiSession();
      setSession(data.session);
      setConfig(data.config);
      if (data.session.my_bet?.status === 'won' || data.session.my_bet?.status === 'lost') {
        // update balance after reward
        if (user?.id) {
          setBalance(data.session.my_bet.win_amount > 0
            ? b => b + data.session.my_bet.win_amount
            : b => b);
        }
      }
      // Flash result animation
      if (data.session.state === 'result' && data.session.result && prevState !== 'result') {
        setFlashResult(data.session.result);
        setTimeout(() => setFlashResult(null), 3000);
      }
      setPrevState(data.session.state);
    } catch (err) {
      console.error('poll session error:', err);
    }
  }, [prevState, user]);

  useEffect(() => {
    fetchSession();
    pollRef.current = setInterval(fetchSession, 1200);
    return () => clearInterval(pollRef.current);
  }, []);  // eslint-disable-line

  const fetchHistory = useCallback(async (page = 1) => {
    try {
      const data = await getTiuXaiHistory(page);
      setHistory(data.sessions || []);
      setHistTotal(data.total_pages || 1);
      setHistPage(page);
    } catch (err) { console.error(err); }
  }, []);

  const fetchMyBets = useCallback(async (page = 1) => {
    try {
      const data = await getMyTiuXaiBets(page);
      setMyBets(data.bets || []);
      setMyBetsPage(page);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    if (panel === 'history') fetchHistory(1);
    if (panel === 'mybets') fetchMyBets(1);
  }, [panel]);

  const handleBet = async (side) => {
    if (!user) { setBetErr('Bạn cần đăng nhập để đặt cược'); return; }
    const amount = parseInt(betAmount);
    if (!amount || amount < (config?.min_bet ?? 10000)) {
      setBetErr('Số tiền cược không hợp lệ'); return;
    }
    if (session?.state !== 'betting') { setBetErr('Phiên đã khóa cược'); return; }
    setBetLoading(true); setBetErr(''); setBetMsg('');
    try {
      const res = await placeTiuXaiBet(side, amount);
      setBalance(res.balance);
      setBetMsg(`Đặt cược ${fmt(amount)} VND vào ${side === 'tiu' ? 'TỈU' : 'XÀI'} thành công!`);
      setBetAmount('');
      fetchSession();
    } catch (err) {
      setBetErr(err.message || 'Lỗi đặt cược');
    } finally {
      setBetLoading(false);
    }
  };

  const isBetting = session?.state === 'betting';
  const isRolling = session?.state === 'rolling';
  const showDice  = ['rolling', 'result', 'reward'].includes(session?.state);
  const myBet     = session?.my_bet;

  const totalCycle = (config?.bet_duration ?? 30) + 2 + 4 + 5 + 3;
  const timerTotal = session?.state === 'betting' ? (config?.bet_duration ?? 30)
    : session?.state === 'locked' ? 2
    : session?.state === 'rolling' ? 4
    : session?.state === 'result' ? 5 : 3;

  return (
    <div className="tx-page">
      {/* Left icon sidebar */}
      <div className="tx-icon-bar">
        {[
          { key: 'info', icon: 'ℹ', label: 'Hướng dẫn' },
          { key: 'mybets', icon: '↩', label: 'Lịch sử cược' },
          { key: 'history', icon: '〜', label: 'Lịch sử phiên' },
          { key: 'jackpot', icon: '★', label: 'Jackpot' },
        ].map(({ key, icon, label }) => (
          <button
            key={key}
            className={`tx-icon-btn${panel === key ? ' tx-icon-btn--active' : ''}`}
            onClick={() => setPanel(panel === key ? null : key)}
            title={label}
          >
            <span className="tx-icon-glyph">{icon}</span>
            {key === 'jackpot' && <span className="tx-icon-jackpot-label">JACKPOT</span>}
          </button>
        ))}
      </div>

      {/* Slide panel */}
      {panel && (
        <div className="tx-panel">
          <div className="tx-panel-header">
            <span className="tx-panel-title">
              {panel === 'info' ? 'HƯỚNG DẪN'
                : panel === 'mybets' ? 'LỊCH SỬ CƯỢC'
                : panel === 'history' ? 'LỊCH SỬ PHIÊN'
                : 'LỊCH SỬ NỔ HŨ'}
            </span>
            <button className="tx-panel-close" onClick={() => setPanel(null)}>✕</button>
          </div>

          {panel === 'info' && (
            <div className="tx-panel-body tx-info">
              <p>Các kết quả được tạo bởi hệ thống RNG cam kết ngẫu nhiên và công bằng.</p>
              <p>Người chơi đặt cược kết quả 3 viên xúc xắc ngẫu nhiên có thể ra.</p>
              <div className="tx-info-rule">
                <strong>TỈU:</strong> tổng điểm 3 viên là <strong>3 – 10</strong>
              </div>
              <div className="tx-info-rule">
                <strong>XÀI:</strong> tổng điểm 3 viên là <strong>11 – 18</strong>
              </div>
              <div className="tx-info-jackpot">
                <strong>Jackpot</strong> nổ khi ra <strong className="tx-red">18 điểm Xài</strong> (6+6+6) hoặc <strong className="tx-gold">3 điểm Tỉu</strong> (1+1+1).
              </div>
              <p>Khi Jackpot nổ, người thắng nhận thêm phần chia từ quỹ Jackpot tỷ lệ theo cược đặt.</p>
              <div className="tx-info-rule">
                <strong>Thắng:</strong> nhận lại <strong>{config ? (config.win_multiplier / 100).toFixed(2) : '1.95'}x</strong> số tiền cược
              </div>
              <p className="tx-info-note">1% mỗi lần cược đóng góp vào quỹ Jackpot.</p>
              <p className="tx-info-note">Mức cược tối thiểu: <strong>{fmtFull(config?.min_bet)} VND</strong> – tối đa: <strong>{fmtFull(config?.max_bet)} VND</strong></p>
            </div>
          )}

          {panel === 'mybets' && (
            <div className="tx-panel-body">
              {!user ? (
                <p className="tx-empty">Đăng nhập để xem lịch sử cược</p>
              ) : myBets.length === 0 ? (
                <p className="tx-empty">Chưa có lịch sử cược</p>
              ) : (
                <>
                  <div className="tx-bet-list">
                    {myBets.map((b) => (
                      <div key={b.id} className={`tx-bet-row tx-bet-row--${b.status}`}>
                        <div className="tx-bet-row-top">
                          <span className={`tx-side-tag tx-side-tag--${b.side}`}>{b.side === 'tiu' ? 'TỈU' : 'XÀI'}</span>
                          <span className="tx-bet-amount">{fmt(b.amount)}</span>
                          <span className={`tx-bet-status tx-bet-status--${b.status}`}>
                            {b.status === 'won' ? `+${fmt(b.win_amount)}` : b.status === 'lost' ? 'Thua' : '...'}
                          </span>
                        </div>
                        {b.result && (
                          <div className="tx-bet-row-bottom">
                            {DICE_FACES[b.dice1]}{DICE_FACES[b.dice2]}{DICE_FACES[b.dice3]} = {b.total_points} ({b.result === 'tiu' ? 'TỈU' : 'XÀI'})
                            {b.is_jackpot ? ' 🎊 JACKPOT!' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="tx-panel-pagination">
                    <button disabled={myBetsPage <= 1} onClick={() => fetchMyBets(myBetsPage - 1)}>◀</button>
                    <span>{myBetsPage}</span>
                    <button onClick={() => fetchMyBets(myBetsPage + 1)}>▶</button>
                  </div>
                </>
              )}
            </div>
          )}

          {panel === 'history' && (
            <div className="tx-panel-body">
              {history.length === 0 ? (
                <p className="tx-empty">Chưa có phiên nào</p>
              ) : (
                <>
                  <div className="tx-hist-stats">
                    <span className="tx-red">XÀI {Math.round(history.filter(s => s.result === 'xai').length / history.length * 100)}%</span>
                    <span style={{ color: '#fff8e1' }}>TỈU {Math.round(history.filter(s => s.result === 'tiu').length / history.length * 100)}%</span>
                  </div>
                  <table className="tx-hist-table">
                    <thead>
                      <tr><th>Phiên</th><th>Tổng điểm</th><th>Kết quả</th></tr>
                    </thead>
                    <tbody>
                      {history.map((s) => (
                        <tr key={s.id}>
                          <td>#{s.id}</td>
                          <td>{DICE_FACES[s.dice1]}{DICE_FACES[s.dice2]}{DICE_FACES[s.dice3]}</td>
                          <td className={s.result === 'xai' ? 'tx-red' : ''}>
                            {s.result === 'xai' ? 'XÀI' : 'TỈU'} – {s.total_points}
                            {s.is_jackpot ? ' 🎊' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="tx-panel-pagination">
                    <button disabled={histPage <= 1} onClick={() => fetchHistory(histPage - 1)}>◀</button>
                    <span>{histPage} / {histTotal}</span>
                    <button disabled={histPage >= histTotal} onClick={() => fetchHistory(histPage + 1)}>▶</button>
                  </div>
                </>
              )}
            </div>
          )}

          {panel === 'jackpot' && (
            <div className="tx-panel-body tx-info">
              <div className="tx-jackpot-pool-display">
                <div className="tx-jackpot-label">Quỹ Jackpot hiện tại</div>
                <div className="tx-jackpot-big">{fmtFull(session?.jackpot_pool)} VND</div>
              </div>
              <div className="tx-info-jackpot" style={{ marginTop: 16 }}>
                Jackpot nổ khi 3 viên ra cùng số: <strong>1+1+1 = 3</strong> hoặc <strong>6+6+6 = 18</strong>
              </div>
              <p>1% mỗi lần cược được đóng góp vào quỹ. Người thắng phiên Jackpot nhận thêm phần chia theo tỷ lệ cược.</p>
              {history.filter(s => s.is_jackpot).length > 0 && (
                <>
                  <div className="tx-panel-section-title">Lịch sử nổ hũ</div>
                  {history.filter(s => s.is_jackpot).map(s => (
                    <div key={s.id} className="tx-jackpot-hit-row">
                      <span>#{s.id}</span>
                      <span>{DICE_FACES[s.dice1]}{DICE_FACES[s.dice2]}{DICE_FACES[s.dice3]}</span>
                      <span className="tx-gold">{fmtFull(s.jackpot_snapshot)} VND</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main game area */}
      <div className="tx-main">
        {/* Jackpot bar */}
        <div className="tx-jackpot-bar">
          <span className="tx-jackpot-bar-label">JACKPOT</span>
          <span className="tx-jackpot-bar-value">{fmtFull(session?.jackpot_pool)}</span>
        </div>

        {/* Session ID + state */}
        <div className="tx-session-row">
          <span className="tx-session-id">#{session?.id ?? '---'}</span>
          <span className="tx-session-state">{STATE_LABEL[session?.state] ?? '...'}</span>
        </div>

        {/* Flash result overlay */}
        {flashResult && (
          <div className={`tx-flash-overlay tx-flash-overlay--${flashResult}`}>
            <span>{flashResult === 'tiu' ? 'TỈU' : 'XÀI'}</span>
            <span className="tx-flash-total">{session?.total}</span>
          </div>
        )}

        {/* Dice display */}
        <div className="tx-dice-row">
          <DiceFace value={showDice ? session?.dice?.[0] : null} rolling={isRolling} />
          <DiceFace value={showDice ? session?.dice?.[1] : null} rolling={isRolling} />
          <DiceFace value={showDice ? session?.dice?.[2] : null} rolling={isRolling} />
        </div>

        {/* Timer ring + total */}
        <div className="tx-center-ring">
          {(session?.state === 'result' || session?.state === 'reward') && session?.total ? (
            <div className="tx-total-display">
              <div className="tx-total-number">{session.total}</div>
              <div className={`tx-total-label ${session.result === 'xai' ? 'tx-red' : ''}`}>
                {session.result === 'tiu' ? 'TỈU' : 'XÀI'}
                {session.is_jackpot && <span className="tx-jackpot-hit"> 🎊 JACKPOT!</span>}
              </div>
            </div>
          ) : (
            <CountdownRing remaining={session?.time_remaining ?? 0} total={timerTotal} />
          )}
        </div>

        {/* Two sides */}
        <div className="tx-sides">
          {/* TỈU side */}
          <div className={`tx-side tx-side--tiu${myBet?.side === 'tiu' ? ' tx-side--my' : ''}`}>
            <div className="tx-side-name">TỈU</div>
            <div className="tx-side-sub">3 – 10</div>
            <div className="tx-side-players">{session?.player_count_tiu ?? 0} người</div>
            <div className="tx-side-total">{fmt(session?.total_bet_tiu)}</div>
            {myBet?.side === 'tiu' && (
              <div className="tx-my-bet-badge">Cược: {fmt(myBet.amount)}</div>
            )}
            <button
              className={`tx-bet-btn tx-bet-btn--tiu${!isBetting || betLoading || !!myBet ? ' tx-bet-btn--disabled' : ''}`}
              onClick={() => handleBet('tiu')}
              disabled={!isBetting || betLoading || !!myBet || !user}
            >
              {betLoading ? '...' : 'CƯỢC'}
            </button>
          </div>

          {/* XÀI side */}
          <div className={`tx-side tx-side--xai${myBet?.side === 'xai' ? ' tx-side--my' : ''}`}>
            <div className="tx-side-name">XÀI</div>
            <div className="tx-side-sub">11 – 18</div>
            <div className="tx-side-players">{session?.player_count_xai ?? 0} người</div>
            <div className="tx-side-total">{fmt(session?.total_bet_xai)}</div>
            {myBet?.side === 'xai' && (
              <div className="tx-my-bet-badge">Cược: {fmt(myBet.amount)}</div>
            )}
            <button
              className={`tx-bet-btn tx-bet-btn--xai${!isBetting || betLoading || !!myBet ? ' tx-bet-btn--disabled' : ''}`}
              onClick={() => handleBet('xai')}
              disabled={!isBetting || betLoading || !!myBet || !user}
            >
              {betLoading ? '...' : 'CƯỢC'}
            </button>
          </div>
        </div>

        {/* Bet amount selector */}
        {isBetting && !myBet && (
          <div className="tx-bet-area">
            <div className="tx-preset-row">
              {BET_PRESETS.map((p) => (
                <button
                  key={p}
                  className={`tx-preset${parseInt(betAmount) === p ? ' tx-preset--active' : ''}`}
                  onClick={() => setBetAmount(String(p))}
                >
                  {fmt(p)}
                </button>
              ))}
            </div>
            <div className="tx-bet-input-row">
              <input
                type="number"
                className="tx-bet-input"
                placeholder="Nhập số tiền (VND)"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                min={config?.min_bet ?? 10000}
                max={config?.max_bet ?? 10000000}
              />
            </div>
          </div>
        )}

        {/* Messages */}
        {betMsg && <div className="tx-msg tx-msg--success">{betMsg}</div>}
        {betErr && <div className="tx-msg tx-msg--error">{betErr}</div>}

        {/* My bet result */}
        {myBet && (myBet.status === 'won' || myBet.status === 'lost') && (
          <div className={`tx-result-banner tx-result-banner--${myBet.status}`}>
            {myBet.status === 'won'
              ? `🎉 Thắng! +${fmtFull(myBet.win_amount)} VND`
              : `😔 Thua ${fmtFull(myBet.amount)} VND`}
          </div>
        )}

        {/* Bottom bar */}
        <div className="tx-bottom-bar">
          <div className="tx-balance-display">
            <span className="tx-balance-label">Ví:</span>
            <span className="tx-balance-value">{fmtFull(balance)} VND</span>
          </div>
          {session?.md5 && (
            <div className="tx-md5">
              <span className="tx-md5-label">MD5</span>
              <span className="tx-md5-val">{session.md5.substring(0, 16)}…</span>
            </div>
          )}
        </div>

        {!user && (
          <div className="tx-login-notice">
            <a href="/login">Đăng nhập</a> để tham gia đặt cược
          </div>
        )}
      </div>
    </div>
  );
}
