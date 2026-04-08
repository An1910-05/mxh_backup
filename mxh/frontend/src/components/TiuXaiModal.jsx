import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { getTiuXaiSession, placeTiuXaiBet, getTiuXaiHistory } from '../services/auth';
import rollADie from 'roll-a-die';

const BET_PRESETS = [10000, 20000, 50000, 100000, 200000, 500000];
const VIEWPORT_GUTTER = 12;
const POPUP_WIDTH = 1500;
const POPUP_HEIGHT = 1000;
const DICE_LAYOUTS = {
  desktopWide: {
    zoom: 1.4,
    positions: [
      { top: 26, left: 124 },
      { top: 154, left: 48 },
      { top: 154, left: 200 },
    ],
  },
  desktop: {
    zoom: 1.26,
    positions: [
      { top: 22, left: 96 },
      { top: 118, left: 34 },
      { top: 118, left: 158 },
    ],
  },
  tablet: {
    zoom: 1.16,
    positions: [
      { top: 18, left: 76 },
      { top: 96, left: 28 },
      { top: 96, left: 124 },
    ],
  },
  mobile: {
    zoom: 1.08,
    positions: [
      { top: 14, left: 62 },
      { top: 86, left: 22 },
      { top: 86, left: 102 },
    ],
  },
};

function fmt(n) {
  if (!n && n !== 0) return '0';
  if (n >= 1000000) return new Intl.NumberFormat('vi-VN').format(n);
  if (n >= 1000) return new Intl.NumberFormat('vi-VN').format(n);
  return String(n);
}
function fmtFull(n) {
  return new Intl.NumberFormat('vi-VN').format(n || 0);
}
function fmtK(n) {
  if (!n && n !== 0) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return Math.round(n / 1000).toLocaleString('vi-VN') + 'K';
  return String(n);
}

const DICE_FACES = ['', '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampPopupPosition(position, width, height) {
  const maxX = Math.max(VIEWPORT_GUTTER, window.innerWidth - width - VIEWPORT_GUTTER);
  const maxY = Math.max(VIEWPORT_GUTTER, window.innerHeight - height - VIEWPORT_GUTTER);

  return {
    x: clamp(position.x, VIEWPORT_GUTTER, maxX),
    y: clamp(position.y, VIEWPORT_GUTTER, maxY),
  };
}

function getInitialPopupPosition() {
  const width = Math.min(POPUP_WIDTH, window.innerWidth - VIEWPORT_GUTTER * 2);
  const height = Math.min(POPUP_HEIGHT, window.innerHeight - VIEWPORT_GUTTER * 2);

  return clampPopupPosition({
    x: (window.innerWidth - width) / 2,
    y: (window.innerHeight - height) / 2,
  }, width, height);
}

function getDiceLayout() {
  if (typeof window !== 'undefined' && window.innerWidth <= 680) {
    return DICE_LAYOUTS.mobile;
  }

  if (typeof window !== 'undefined' && window.innerWidth <= 980) {
    return DICE_LAYOUTS.tablet;
  }

  if (typeof window !== 'undefined' && window.innerWidth <= 1280) {
    return DICE_LAYOUTS.desktop;
  }

  return DICE_LAYOUTS.desktopWide;
}

export default function TiuXaiModal({ open, onClose }) {
  const { user } = useAuth();
  const [session, setSession]         = useState(null);
  const [config, setConfig]           = useState(null);
  const [betAmount, setBetAmount]     = useState('50000');
  const [betLoading, setBetLoading]   = useState(false);
  const [betMsg, setBetMsg]           = useState('');
  const [betErr, setBetErr]           = useState('');
  const [balance, setBalance]         = useState(user?.balance ?? 0);
  const [dotHistory, setDotHistory]   = useState([]);
  const [histSessions, setHistSessions] = useState([]);
  const [showPanel, setShowPanel]     = useState(null);
  const [flashAnim, setFlashAnim]     = useState(false);
  const pollRef    = useRef(null);
  const prevResRef = useRef(null);
  const diceRef    = useRef(null);
  const rolledRef  = useRef(null);
  const modalRef   = useRef(null);

  // Drag state
  const [pos, setPos] = useState(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, ox: 0, oy: 0, width: POPUP_WIDTH, height: POPUP_HEIGHT });
  const initPos = useCallback(() => getInitialPopupPosition(), []);

  useEffect(() => {
    if (open && !pos) setPos(initPos());
  }, [open, pos, initPos]);

  useEffect(() => {
    if (!open) return undefined;

    const syncPosition = () => {
      const rect = modalRef.current?.getBoundingClientRect();
      const width = rect?.width ?? Math.min(POPUP_WIDTH, window.innerWidth - VIEWPORT_GUTTER * 2);
      const height = rect?.height ?? Math.min(POPUP_HEIGHT, window.innerHeight - VIEWPORT_GUTTER * 2);

      setPos((current) => {
        if (!current) return getInitialPopupPosition();
        return clampPopupPosition(current, width, height);
      });
    };

    syncPosition();
    window.addEventListener('resize', syncPosition);
    return () => window.removeEventListener('resize', syncPosition);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setShowPanel(null);
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const onDragStart = (e) => {
    if (e.button !== 0 || !modalRef.current) return;
    e.preventDefault();
    const rect = modalRef.current.getBoundingClientRect();
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      ox: rect.left,
      oy: rect.top,
      width: rect.width,
      height: rect.height,
    };
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.dragging) return;
      const next = clampPopupPosition({
        x: dragRef.current.ox + e.clientX - dragRef.current.startX,
        y: dragRef.current.oy + e.clientY - dragRef.current.startY,
      }, dragRef.current.width, dragRef.current.height);
      setPos(next);
    };
    const onUp = () => { dragRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Polling
  const fetchSession = useCallback(async () => {
    try {
      const data = await getTiuXaiSession();
      setSession(data.session);
      setConfig(data.config);
      if (data.session.my_bet?.status === 'won' && prevResRef.current !== data.session.id + '_won') {
        prevResRef.current = data.session.id + '_won';
        setBalance(b => b + data.session.my_bet.win_amount);
      }
      if (data.session.result && data.session.state !== 'betting' && data.session.state !== 'locked') {
        const key = `${data.session.id}:${data.session.result}`;
        if (key !== prevResRef.current) {
          prevResRef.current = key;
          setDotHistory(h => {
            const next = [{ id: data.session.id, result: data.session.result, total: data.session.total }, ...h];
            return next.slice(0, 20);
          });
          setFlashAnim(true);
          setTimeout(() => setFlashAnim(false), 600);
        }
      }
    } catch (err) { console.error('TiuXai poll:', err); }
  }, []);

  useEffect(() => {
    if (!open) { clearInterval(pollRef.current); return; }
    fetchSession();
    pollRef.current = setInterval(fetchSession, 1200);
    return () => clearInterval(pollRef.current);
  }, [open, fetchSession]);

  // Roll-a-die animation
  useEffect(() => {
    if (!session) return;
    const { state, dice, id } = session;
    const animKey = `${id}:rolling`;
    if (
      state === 'rolling' &&
      dice?.[0] && dice?.[1] && dice?.[2] &&
      diceRef.current &&
      rolledRef.current !== animKey
    ) {
      rolledRef.current = animKey;
      diceRef.current.innerHTML = '';

      rollADie({
        element: diceRef.current,
        numberOfDice: 3,
        values: [dice[0], dice[1], dice[2]],
        noSound: true,
        delay: 6500,
        callback: () => {},
      });

      // Container is 160×140, dice 32px at zoom 1.3 → ~42px visible
      const layout = getDiceLayout();

      let attempts = 0;
      const tryPosition = () => {
        if (!diceRef.current) return;
        const diceOuters = Array.from(diceRef.current.querySelectorAll('.dice-outer'));
        if (diceOuters.length < 3) {
          if (++attempts < 20) setTimeout(tryPosition, 100);
          return;
        }
        diceOuters.forEach((el, i) => {
          const point = layout.positions[i];
          Object.assign(el.style, {
            position: 'absolute',
            margin: '0',
            top: `${point.top}px`,
            left: `${point.left}px`,
            zoom: String(layout.zoom),
          });
        });
      };
      setTimeout(tryPosition, 80);
    }
  }, [session]);

  useEffect(() => {
    if (showPanel === 'history') {
      getTiuXaiHistory(1).then(d => setHistSessions(d.sessions || [])).catch(console.error);
    }
  }, [showPanel]);

  const handleBet = async (side) => {
    if (!user) { setBetErr('Đăng nhập để cược'); return; }
    const amount = parseInt(betAmount, 10);
    if (!amount || amount < (config?.min_bet ?? 10000)) { setBetErr('Số tiền không hợp lệ'); return; }
    if (session?.state !== 'betting') { setBetErr('Phiên đã khóa cược'); return; }
    setBetLoading(true); setBetErr(''); setBetMsg('');
    try {
      const res = await placeTiuXaiBet(side, amount);
      setBalance(res.balance);
      setBetMsg(`Đặt ${fmtK(amount)} → ${side === 'tiu' ? 'TỈU' : 'XÀI'} ✓`);
      setTimeout(() => setBetMsg(''), 2000);
      fetchSession();
    } catch (err) {
      setBetErr(err.message || 'Lỗi');
      setTimeout(() => setBetErr(''), 2500);
    } finally { setBetLoading(false); }
  };

  if (!open || !pos) return null;

  const isBetting = session?.state === 'betting';
  const showDice  = ['rolling', 'result', 'reward'].includes(session?.state);
  const myBet     = session?.my_bet;
  const stateLabels = { betting: 'Đang cược', locked: 'Khóa cược', rolling: 'Lắc xúc xắc...', result: 'Kết quả!', reward: 'Tính thưởng' };
  const timeStr = `${String(Math.floor((session?.time_remaining ?? 0) / 60)).padStart(2, '0')}:${String((session?.time_remaining ?? 0) % 60).padStart(2, '0')}`;

  const modal = (
    <div className="txm-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="txm"
        role="dialog"
        aria-modal="true"
        aria-label="Trò chơi Tỉu Xài"
        style={{ left: pos.x, top: pos.y }}
        onClick={e => e.stopPropagation()}
      >

      {/* ── Jackpot pill (floats above the table) ── */}
      <div className="txm-jp" onMouseDown={onDragStart}>
        <span className="txm-jp__label">JACKPOT</span>
        <div className="txm-jp__pill">
          <span className="txm-jp__val">{fmtFull(session?.jackpot_pool)}</span>
        </div>
      </div>

      {/* ── Table body ── */}
      <div className="txm-table">

        {/* Menu + Close corner buttons */}
        <button className="txm-corner txm-corner--menu" onClick={() => setShowPanel(showPanel === 'info' ? null : 'info')} title="Hướng dẫn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
        <button className="txm-corner txm-corner--close" onClick={onClose} title="Đóng">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        </button>

        <div className="txm-rail" onMouseDown={onDragStart} aria-hidden="true">
          <span className="txm-rail__grip" />
        </div>

        {/* Session ID */}
        <div className="txm-sid">#{session?.id ?? '—'}</div>

        {/* ── Main game layout ── */}
        <div className="txm-game">

          {/* TỈU side */}
          <div className={`txm-wing txm-wing--left txm-wing--tiu${myBet?.side === 'tiu' ? ' txm-wing--active' : ''}`}>
            <div className="txm-wing__name txm-wing__name--tiu">TỈU</div>
            <div className="txm-wing__players">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 100-6 3 3 0 000 6z"/></svg>
              <span>{session?.player_count_tiu ?? 0}</span>
            </div>
            <div className="txm-wing__total">{fmtK(session?.total_bet_tiu)}</div>
            <button
              className={`txm-cuc txm-cuc--tiu${myBet?.side === 'tiu' ? ' txm-cuc--active' : ''}`}
              disabled={!isBetting || betLoading || !!myBet || !user}
              onClick={() => handleBet('tiu')}
            >
              {myBet?.side === 'tiu' ? `${fmtK(myBet.amount)} ✓` : 'CƯỢC'}
            </button>
          </div>

          {/* Center — dice circle + timer */}
          <div className="txm-mid">
            <div className="txm-orb">
              <div
                ref={diceRef}
                className="txm-dice"
                style={{ display: showDice ? 'block' : 'none' }}
              />
              {!showDice && (
                <span className="txm-orb__timer" style={{ color: (session?.time_remaining ?? 0) <= 5 && isBetting ? '#ff5555' : '#fff' }}>
                  {timeStr}
                </span>
              )}
            </div>
            {/* Result overlay */}
            {(session?.state === 'result' || session?.state === 'reward') && session?.total && (
              <div className={`txm-res${flashAnim ? ' txm-res--flash' : ''}`}>
                <span className="txm-res__num">{session.total}</span>
                <span className={`txm-res__side${session.result === 'xai' ? ' txm-res__side--xai' : ''}`}>
                  {session.result === 'tiu' ? 'TỈU' : 'XÀI'}
                </span>
                {session.is_jackpot && <span className="txm-res__jp">JACKPOT!</span>}
              </div>
            )}
            <div className="txm-state">{stateLabels[session?.state] ?? '...'}</div>
          </div>

          {/* XÀI side */}
          <div className={`txm-wing txm-wing--right txm-wing--xai${myBet?.side === 'xai' ? ' txm-wing--active' : ''}`}>
            <div className="txm-wing__name txm-wing__name--xai">XÀI</div>
            <div className="txm-wing__players">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 100-6 3 3 0 000 6z"/></svg>
              <span>{session?.player_count_xai ?? 0}</span>
            </div>
            <div className="txm-wing__total">{fmtK(session?.total_bet_xai)}</div>
            <button
              className={`txm-cuc txm-cuc--xai${myBet?.side === 'xai' ? ' txm-cuc--active' : ''}`}
              disabled={!isBetting || betLoading || !!myBet || !user}
              onClick={() => handleBet('xai')}
            >
              {myBet?.side === 'xai' ? `${fmtK(myBet.amount)} ✓` : 'CƯỢC'}
            </button>
          </div>
        </div>

        {/* Win/Lose result */}
        {myBet && (myBet.status === 'won' || myBet.status === 'lost') && (
          <div className={`txm-winlose txm-winlose--${myBet.status}`}>
            {myBet.status === 'won' ? `+${fmtFull(myBet.win_amount)}` : `Thua ${fmtFull(myBet.amount)}`}
          </div>
        )}

        {/* Bet preset row */}
        {isBetting && !myBet && user && (
          <div className="txm-bets">
            <div className="txm-bets__row">
              {BET_PRESETS.map(p => (
                <button key={p} className={`txm-chip${parseInt(betAmount, 10) === p ? ' txm-chip--on' : ''}`} onClick={() => setBetAmount(String(p))}>
                  {fmtK(p)}
                </button>
              ))}
            </div>
            <input type="number" className="txm-inp" value={betAmount} min={config?.min_bet ?? 10000} onChange={e => setBetAmount(e.target.value)} placeholder="Nhập số tiền..." />
          </div>
        )}

        {betMsg && <div className="txm-toast txm-toast--ok">{betMsg}</div>}
        {betErr && <div className="txm-toast txm-toast--err">{betErr}</div>}

        {/* Dot history bar */}
        <div className="txm-dots">
          <button className="txm-dots__icon" onClick={() => setShowPanel(showPanel === 'history' ? null : 'history')} title="Lịch sử">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <div className="txm-dots__track">
            {dotHistory.length === 0
              ? <span className="txm-dots__empty">Chờ kết quả...</span>
              : dotHistory.map(d => (
                <span key={d.id} className={`txm-dot txm-dot--${d.result}`} title={`#${d.id}: ${d.total} (${d.result === 'tiu' ? 'TỈU' : 'XÀI'})`} />
              ))
            }
          </div>
        </div>

        {/* Bottom footer */}
        <div className="txm-foot">
          <span className="txm-foot__wal">Ví : {user ? fmtFull(balance) : 0}</span>
          {session?.md5 && (
            <div className="txm-foot__md5">
              <span className="txm-foot__md5lbl">MD5</span>
              <span className="txm-foot__md5val" title={session.md5}>{session.md5.substring(0, 22)}...</span>
              <button className="txm-foot__copy" onClick={() => navigator.clipboard?.writeText(session.md5)}>Copy</button>
            </div>
          )}
        </div>

      </div>

      {/* ── Slide-up panels ── */}
      {showPanel === 'info' && (
        <div className="txm-panel">
          <div className="txm-panel__hd">HƯỚNG DẪN <button onClick={() => setShowPanel(null)}>✕</button></div>
          <p><strong>TỈU:</strong> tổng 3–10 &nbsp;|&nbsp; <strong>XÀI:</strong> tổng 11–18</p>
          <p>Jackpot: tổng 3 (1+1+1) hoặc 18 (6+6+6)</p>
          <p>Thắng nhận {config ? (config.win_multiplier / 100).toFixed(2) : '1.95'}x. 1% vào quỹ Jackpot.</p>
          <p>Cược: {fmtFull(config?.min_bet)} – {fmtFull(config?.max_bet)} VND</p>
        </div>
      )}
      {showPanel === 'history' && (
        <div className="txm-panel">
          <div className="txm-panel__hd">LỊCH SỬ PHIÊN <button onClick={() => setShowPanel(null)}>✕</button></div>
          <div className="txm-panel__scroll">
            {histSessions.slice(0, 10).map(s => (
              <div key={s.id} className="txm-hrow">
                <span className="txm-hrow__id">#{s.id}</span>
                <span className="txm-hrow__dice">{DICE_FACES[s.dice1]}{DICE_FACES[s.dice2]}{DICE_FACES[s.dice3]}</span>
                <span className={`txm-hrow__res${s.result === 'xai' ? ' txm-hrow__res--xai' : ''}`}>
                  {s.result === 'tiu' ? 'TỈU' : 'XÀI'} – {s.total_points}
                  {s.is_jackpot ? ' JACKPOT' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
