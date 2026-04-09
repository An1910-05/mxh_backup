import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getTaiXiuOverview, getTaiXiuCurrentRound, taiXiuPlaceBet } from '../services/graphql';

const BET_OPTIONS = [10000, 100000, 500000, 1000000, 5000000, 10000000];
const DEFAULT_POS = { right: 20, bottom: 80 }; // px từ cạnh phải + dưới
const WIDGET_W    = 360;
const WIDGET_H    = 560;

/* ── Formatters ──────────────────────────────────────────────────────── */
function fmt(n) {
  if (n >= 1_000_000_000) return (n/1e9).toFixed(1).replace('.0','') + 'B';
  if (n >= 1_000_000)     return (n/1e6).toFixed(1).replace('.0','') + 'M';
  if (n >= 1_000)         return (n/1e3).toFixed(1).replace('.0','') + 'K';
  return String(n);
}
function fmtFull(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.abs(n ?? 0)) + 'đ';
}

/* ── Dice SVG face ───────────────────────────────────────────────────── */
const DOTS = {
  1:[[50,50]],2:[[25,25],[75,75]],3:[[25,25],[50,50],[75,75]],
  4:[[25,25],[75,25],[25,75],[75,75]],5:[[25,25],[75,25],[50,50],[25,75],[75,75]],
  6:[[25,22],[75,22],[25,50],[75,50],[25,78],[75,78]],
};
function DiceFace({ value, rolling }) {
  const dots = DOTS[Math.max(1, Math.min(6, value||1))] || DOTS[1];
  return (
    <svg viewBox="0 0 100 100" className={`tx-die-svg${rolling?' tx-die-svg--roll':''}`}>
      <rect x="4" y="4" width="92" height="92" rx="16" ry="16" className="tx-die-face"/>
      {dots.map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="8" className="tx-die-dot"/>)}
    </svg>
  );
}

/* ── Countdown ring ──────────────────────────────────────────────────── */
function CountdownRing({ seconds, maxSeconds=30 }) {
  const r=26, circ=2*Math.PI*r;
  const progress = Math.max(0, Math.min(1, seconds/maxSeconds));
  const urgent   = seconds <= 5;
  return (
    <svg width="68" height="68" viewBox="0 0 72 72" className="tx-countdown-ring">
      <circle cx="36" cy="36" r={r} strokeWidth="5" className="tx-countdown-track" fill="none"/>
      <circle cx="36" cy="36" r={r} strokeWidth="5" fill="none"
        className={`tx-countdown-arc${urgent?' tx-countdown-arc--urgent':''}`}
        strokeDasharray={`${circ*progress} ${circ}`}
        transform="rotate(-90 36 36)" strokeLinecap="round"/>
      <text x="36" y="41" textAnchor="middle"
        className={`tx-countdown-text${urgent?' tx-countdown-text--urgent':''}`}>{seconds}</text>
    </svg>
  );
}

function HistoryDots({ rounds }) {
  if (!rounds?.length) return null;
  return (
    <div className="tx-history-dots">
      {rounds.slice(0,15).map(r=>(
        <span key={r.id} className={`tx-history-dot tx-history-dot--${r.result_key}`}
          title={`${r.result_label} ${r.dice?.join('-')}`}/>
      ))}
    </div>
  );
}

/* ── Main widget ─────────────────────────────────────────────────────── */
export default function TaiXiuFloatingWidget() {
  const { user } = useAuth();

  /* Visibility */
  const [open,      setOpen]      = useState(false);  // widget đang hiện hay ẩn
  const [minimized, setMinimized] = useState(false);  // thu gọn thành thanh nhỏ

  /* Position — dùng fixed top/left */
  const [pos, setPos] = useState(null); // null = chưa tính, tính lần đầu lazily
  const widgetRef  = useRef(null);
  const dragState  = useRef({ active:false, startX:0, startY:0, startLeft:0, startTop:0 });

  /* Game state */
  const [tab,       setTab]       = useState('play');
  const [round,     setRound]     = useState(null);
  const [overview,  setOverview]  = useState(null);
  const [balance,   setBalance]   = useState(0);
  const [stake,     setStake]     = useState(BET_OPTIONS[0]);
  const [side,      setSide]      = useState('tai');
  const [placing,   setPlacing]   = useState(false);
  const [error,     setError]     = useState('');
  const [secsLeft,  setSecsLeft]  = useState(0);
  const [displayDice, setDisplayDice] = useState([1,4,6]);
  const [rolling,   setRolling]   = useState(false);
  const [showResult,setShowResult]= useState(false);

  const pollRef    = useRef(null);
  const rollRef    = useRef(null);
  const prevId     = useRef(null);
  const prevStatus = useRef(null);

  /* ── Listen for open event from GamesPage ── */
  useEffect(()=>{
    const handler = () => { setOpen(true); setMinimized(false); };
    window.addEventListener('mxh-open-taixiu', handler);
    return ()=> window.removeEventListener('mxh-open-taixiu', handler);
  },[]);

  /* ── Lazy-init position (bottom-right corner) ── */
  const initPos = useCallback(()=>{
    if (pos) return;
    const w = window.innerWidth, h = window.innerHeight;
    setPos({ top: h - WIDGET_H - DEFAULT_POS.bottom, left: w - WIDGET_W - DEFAULT_POS.right });
  },[pos]);

  /* ── Drag logic (mouse) ── */
  const onMouseMove = useCallback((e)=>{
    const d = dragState.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    const maxL = window.innerWidth  - (widgetRef.current?.offsetWidth  || WIDGET_W) - 4;
    const maxT = window.innerHeight - (widgetRef.current?.offsetHeight || WIDGET_H) - 4;
    setPos({ left: Math.max(4, Math.min(maxL, d.startLeft+dx)), top: Math.max(4, Math.min(maxT, d.startTop+dy)) });
  },[]);

  const onMouseUp = useCallback(()=>{
    dragState.current.active = false;
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  },[onMouseMove]);

  const onDragStart = useCallback((e)=>{
    if (e.button !== 0) return;
    initPos();
    const rect = widgetRef.current?.getBoundingClientRect() || {left:0,top:0};
    dragState.current = { active:true, startX:e.clientX, startY:e.clientY, startLeft:rect.left, startTop:rect.top };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  },[initPos, onMouseMove, onMouseUp]);

  /* ── Drag logic (touch) ── */
  const onTouchStart = useCallback((e)=>{
    if (e.touches.length !== 1) return;
    initPos();
    const t = e.touches[0];
    const rect = widgetRef.current?.getBoundingClientRect() || {left:0,top:0};
    dragState.current = { active:true, startX:t.clientX, startY:t.clientY, startLeft:rect.left, startTop:rect.top };
  },[initPos]);

  const onTouchMove = useCallback((e)=>{
    const d = dragState.current;
    if (!d.active || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - d.startX, dy = t.clientY - d.startY;
    const maxL = window.innerWidth  - (widgetRef.current?.offsetWidth  || WIDGET_W) - 4;
    const maxT = window.innerHeight - (widgetRef.current?.offsetHeight || WIDGET_H) - 4;
    setPos({ left: Math.max(4,Math.min(maxL, d.startLeft+dx)), top: Math.max(4,Math.min(maxT, d.startTop+dy)) });
  },[]);

  const onTouchEnd = useCallback(()=>{ dragState.current.active = false; },[]);

  /* ── Game polling ── */
  const stopRoll = ()=>{ if(rollRef.current){ clearInterval(rollRef.current); rollRef.current=null; } };

  const applyRound = useCallback((r, bal)=>{
    if (!r) return;
    setSecsLeft(r.seconds_left ?? 0);
    if (r.status==='finished' && r.dice?.length===3) {
      const alreadyShown = prevStatus.current==='finished' && prevId.current===r.id;
      if (!alreadyShown) {
        setRolling(true); stopRoll();
        rollRef.current = setInterval(()=> setDisplayDice([
          Math.ceil(Math.random()*6), Math.ceil(Math.random()*6), Math.ceil(Math.random()*6)
        ]), 80);
        setTimeout(()=>{ stopRoll(); setRolling(false); setDisplayDice(r.dice); setShowResult(true);
          setTimeout(()=>setShowResult(false), 4000);
        }, 1200);
      } else { setDisplayDice(r.dice); }
    } else if (r.status==='betting') {
      stopRoll(); setRolling(false); setShowResult(false);
    }
    prevId.current = r.id; prevStatus.current = r.status;
    setRound(r);
    if (bal !== undefined) setBalance(bal);
  },[]);

  useEffect(()=>{
    if (!open || !user) return;
    const init = async()=>{
      try {
        const ov = await getTaiXiuOverview();
        setOverview(ov); setBalance(ov.balance);
        applyRound(ov.current_round, ov.balance);
      } catch(e){ setError(e.message); }
    };
    init();
    pollRef.current = setInterval(async()=>{
      try { applyRound(await getTaiXiuCurrentRound()); } catch{}
    }, 3000);
    return ()=>{ clearInterval(pollRef.current); stopRoll(); };
  },[open, user]);

  /* Local countdown tick */
  useEffect(()=>{
    const t = setInterval(()=> setSecsLeft(s=> Math.max(0,s-1)), 1000);
    return ()=> clearInterval(t);
  },[]);

  /* ── Actions ── */
  const handlePlaceBet = async()=>{
    if (placing || !round || round.status!=='betting' || round.my_bet_amount>0) return;
    if (stake<10000){ setError('Chọn tối thiểu 10.000đ.'); return; }
    if (stake>balance){ setError('Số dư không đủ.'); return; }
    setError(''); setPlacing(true);
    try {
      const res = await taiXiuPlaceBet(side, stake);
      setBalance(res.balance); applyRound(res.current_round, res.balance);
      window.dispatchEvent(new CustomEvent('mxh-wallet-refresh'));
    } catch(e){ setError(e.message||'Đặt cược thất bại.'); }
    finally { setPlacing(false); }
  };

  const handleOpen = ()=>{
    initPos();
    setOpen(true); setMinimized(false);
  };
  const handleMinimize = (e)=>{ e.stopPropagation(); setMinimized(m=>!m); };
  const handleClose    = (e)=>{ e.stopPropagation(); setOpen(false); };

  /* ── Not logged in — don't render ── */
  if (!user) return null;

  /* ── Computed state ── */
  const alreadyBet   = (round?.my_bet_amount||0) > 0;
  const canBet       = round?.status==='betting' && !alreadyBet && stake>=10000 && stake<=balance && !placing;
  const jackpotTotal = (overview?.jackpot_tai_pool||0)+(overview?.jackpot_xiu_pool||0);
  const style        = pos ? { position:'fixed', top:pos.top, left:pos.left, zIndex:9999 }
                           : { position:'fixed', bottom:DEFAULT_POS.bottom, right:DEFAULT_POS.right, zIndex:9999 };

  /* ── Floating launch bubble (when not open) ── */
  if (!open) {
    return (
      <button className="tx-bubble" style={{ position:'fixed', bottom:DEFAULT_POS.bottom, right:DEFAULT_POS.right, zIndex:9999 }}
        onClick={handleOpen} title="Mở Tài Xỉu">
        🎲
      </button>
    );
  }

  /* ── Minimized bar ── */
  if (minimized) {
    return (
      <div
        ref={widgetRef}
        className="tx-mini-bar"
        style={style}
        onMouseDown={onDragStart}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span className="tx-mini-icon">🎲</span>
        <span className="tx-mini-label">TÀI XỈU</span>
        {round?.status==='betting' && (
          <span className={`tx-mini-count${secsLeft<=5?' tx-mini-count--urgent':''}`}>{secsLeft}s</span>
        )}
        {round?.status==='finished' && round?.result_key && (
          <span className={`tx-mini-result tx-mini-result--${round.result_key}`}>{round.result_label}</span>
        )}
        <button className="tx-mini-btn" onClick={handleMinimize} title="Mở rộng">▲</button>
        <button className="tx-mini-btn tx-mini-btn--close" onClick={handleClose} title="Đóng">✕</button>
      </div>
    );
  }

  /* ── Full widget ── */
  return (
    <div
      ref={widgetRef}
      className="tx-widget tx-widget--floating"
      style={style}
    >
      {/* Header — drag handle */}
      <div
        className="tx-header tx-header--drag"
        onMouseDown={onDragStart}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span className="tx-title">🎲 TÀI XỈU</span>
        <div className="tx-header-actions">
          <button className="tx-header-btn" onClick={handleMinimize} title="Thu gọn">─</button>
          <button className="tx-header-btn tx-header-btn--close" onClick={handleClose} title="Đóng">✕</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tx-tabs">
        {['play','history','guide'].map(t=>(
          <button key={t} className={`tx-tab${tab===t?' tx-tab--active':''}`} onClick={()=>setTab(t)}>
            {t==='play'?'Chơi':t==='history'?'Lịch sử':'Hướng dẫn'}
          </button>
        ))}
      </div>

      {/* ── PLAY TAB ── */}
      {tab==='play' && (
        <div className="tx-body">
          {/* Result flash */}
          {showResult && round?.result_key && (
            <div className={`tx-result-flash tx-result-flash--${round.result_key}`}>
              <strong>{round.result_label?.toUpperCase()}</strong>
              <span>Tổng {round.total} · {round.dice?.join(' – ')}</span>
              {round.my_bet_amount>0 && (
                <span className={round.my_did_win?'tx-win':'tx-lose'}>
                  {round.my_did_win?'🎉 Thắng!':'😞 Thua'}
                </span>
              )}
            </div>
          )}

          {/* Countdown + info */}
          <div className="tx-phase-row">
            <CountdownRing seconds={secsLeft} maxSeconds={30}/>
            <div className="tx-phase-info">
              <div className="tx-phase-label">
                {round?.status==='betting'?'⏳ Đang nhận cược':'🎲 Đang quay'}
              </div>
              <div className="tx-round-code">#{round?.round_code||'...'}</div>
              <div className="tx-balance-line">Ví: <strong>{fmtFull(balance)}</strong></div>
            </div>
          </div>

          {/* Dice */}
          <div className="tx-dice-row">
            {(displayDice.length===3?displayDice:[1,4,6]).map((v,i)=>(
              <DiceFace key={i} value={v} rolling={rolling}/>
            ))}
          </div>

          {/* Tài / Xỉu sides */}
          <div className="tx-sides">
            <button
              className={`tx-side tx-side--tai${side==='tai'?' tx-side--active':''}`}
              onClick={()=>setSide('tai')}
              disabled={alreadyBet||round?.status!=='betting'}
            >
              <span className="tx-side-name">TÀI</span>
              <span className="tx-side-range">11 – 18</span>
              <span className="tx-side-total">{fmt(round?.tai_total||0)}</span>
              <span className="tx-side-count">{round?.tai_count||0} người</span>
            </button>
            <div className="tx-vs">VS</div>
            <button
              className={`tx-side tx-side--xiu${side==='xiu'?' tx-side--active':''}`}
              onClick={()=>setSide('xiu')}
              disabled={alreadyBet||round?.status!=='betting'}
            >
              <span className="tx-side-name">XỈU</span>
              <span className="tx-side-range">3 – 10</span>
              <span className="tx-side-total">{fmt(round?.xiu_total||0)}</span>
              <span className="tx-side-count">{round?.xiu_count||0} người</span>
            </button>
          </div>

          {/* Already bet */}
          {alreadyBet && (
            <div className="tx-my-bet">
              Đã đặt: <strong>{round.my_bet_side==='tai'?'Tài':'Xỉu'}</strong> — {fmtFull(round.my_bet_amount)}
              {round.status==='betting' && <span className="tx-waiting"> · Chờ kết quả...</span>}
            </div>
          )}

          {/* Stake grid */}
          {!alreadyBet && (
            <div className="tx-stakes">
              {BET_OPTIONS.map(opt=>(
                <button key={opt}
                  className={`tx-stake${stake===opt?' tx-stake--active':''}`}
                  onClick={()=>setStake(opt)}>
                  {fmt(opt)}
                </button>
              ))}
            </div>
          )}

          {/* History dots */}
          <HistoryDots rounds={overview?.recent_rounds}/>

          {/* Jackpot + actions */}
          <div className="tx-jackpot-bar">🏆 Hũ: <strong>{fmtFull(jackpotTotal)}</strong></div>

          {!alreadyBet && (
            <div className="tx-actions">
              <button className="tx-btn tx-btn--bet" onClick={handlePlaceBet} disabled={!canBet}>
                {placing?'Đang đặt...':round?.status!=='betting'?'Chờ phiên mới':'Đặt cược'}
              </button>
              <button className="tx-btn tx-btn--cancel" onClick={()=>setStake(0)}>Huỷ</button>
            </div>
          )}

          {error && (
            <div className="tx-error">
              {error}
              {error.includes('Ví')||error.includes('dư') ? <Link to="/settings"> Nạp tiền</Link> : null}
            </div>
          )}
          {stake>balance && !alreadyBet && (
            <div className="tx-error">Số dư không đủ. <Link to="/settings">Nạp tiền</Link></div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab==='history' && (
        <div className="tx-body tx-body--history">
          <div className="tx-section">
            <div className="tx-section-head"><h4>Cược của bạn</h4></div>
            {!overview?.my_recent_bets?.length
              ? <p className="tx-empty">Chưa có lịch sử cược.</p>
              : overview.my_recent_bets.slice(0,8).map(b=>(
                <div key={b.id} className="tx-hist-row">
                  <div>
                    <strong>#{b.round_code}</strong> · {b.bet_label}
                    <span className="tx-hist-sub"> → {b.result_label} ({b.dice?.join('-')})</span>
                  </div>
                  <span className={`tx-badge${b.did_win?' tx-badge--win':' tx-badge--lose'}`}>
                    {b.did_win?'+':'-'}{fmtFull(Math.abs(b.net_amount))}
                  </span>
                </div>
              ))
            }
          </div>
          <div className="tx-section">
            <div className="tx-section-head"><h4>Lịch sử phiên</h4></div>
            <HistoryDots rounds={overview?.recent_rounds}/>
            {overview?.recent_rounds?.slice(0,6).map(r=>(
              <div key={r.id} className="tx-hist-row">
                <div>
                  <strong className={r.result_key==='tai'?'tx-tai':'tx-xiu'}>{r.result_label}</strong>
                  <span className="tx-hist-sub"> #{r.round_code} · {r.dice?.join('-')}</span>
                </div>
                <span className={`tx-badge tx-badge--neutral tx-badge--${r.result_key}`}>Tổng {r.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── GUIDE TAB ── */}
      {tab==='guide' && (
        <div className="tx-body tx-body--guide">
          <div className="tx-section">
            <div className="tx-section-head"><h4>Cách chơi</h4></div>
            <ul className="tx-guide-list">
              <li>Mỗi phiên <strong>30 giây</strong> để đặt cược.</li>
              <li>Server lăn <strong>3 xúc xắc</strong> cho tất cả cùng lúc.</li>
              <li><span className="tx-tai">Tài</span>: tổng <strong>11–18</strong> · <span className="tx-xiu">Xỉu</span>: tổng <strong>3–10</strong></li>
              <li>Đoán đúng nhận lại <strong>2x</strong> tiền cược.</li>
              <li>Tổng <strong>18 Tài</strong> hoặc <strong>3 Xỉu</strong> → nổ hũ!</li>
              <li>Mỗi phiên đặt <strong>1 lần</strong> duy nhất.</li>
              <li>Widget <strong>nổi</strong> — có thể kéo, thu gọn, chơi khi làm việc khác.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
