import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getTaiXiuOverview, getTaiXiuCurrentRound, taiXiuPlaceBet } from '../services/graphql';
import rollADie from 'roll-a-die';

const BET_OPTIONS = [10000, 100000, 500000, 1000000, 5000000, 10000000];
const DEFAULT_POS = { right: 20, bottom: 80 };
const WIDGET_W = 440;
const WIDGET_H = 560;
const MENU_TABS = [
  { key: 'guide', label: 'Hướng dẫn', icon: 'i' },
  { key: 'bets', label: 'Lịch sử cược', icon: '↺' },
  { key: 'rounds', label: 'Lịch sử phiên', icon: '◉' },
  { key: 'jackpot', label: 'Lịch sử nổ hũ', icon: 'JP' },
];
const MENU_PAGE_SIZE = 4;
const JACKPOT_PAGE_SIZE = 5;

function fmt(n) {
  if (n >= 1_000_000_000) return (n / 1e9).toFixed(1).replace('.0', '') + 'B';
  if (n >= 1_000_000)     return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000)         return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}

function fmtFull(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.abs(n ?? 0)) + 'đ';
}

function fmtDateTime(value) {
  if (!value) return '--';
  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed).replace(',', '');
}

function fmtTimeDateCompact(value) {
  if (!value) return '--';
  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return String(value);
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mo = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}-${mo}`;
}

function slicePage(items, page, pageSize = MENU_PAGE_SIZE) {
  return (items || []).slice(page * pageSize, (page + 1) * pageSize);
}

function clampPage(page, totalPages) {
  if (!totalPages) return 0;
  return Math.max(0, Math.min(page, totalPages - 1));
}

/* Static 3D-style die SVG (red casino dice) */
const DIE_DOTS = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

function StaticDie({ value, size = 62 }) {
  const v = Math.max(1, Math.min(6, value || 1));
  const dots = DIE_DOTS[v] || DIE_DOTS[1];
  const id = `dg${v}s${size}`;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="tx-static-die">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff4422" />
          <stop offset="55%" stopColor="#cc1100" />
          <stop offset="100%" stopColor="#7a0000" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#550000" />
          <stop offset="100%" stopColor="#330000" />
        </linearGradient>
      </defs>
      <rect x="10" y="12" width="83" height="83" rx="14" fill="rgba(0,0,0,0.45)" />
      <rect x="6" y="6" width="83" height="83" rx="14" fill={`url(#${id}s)`} />
      <rect x="2" y="2" width="83" height="83" rx="14" fill={`url(#${id}f)`} />
      <rect x="6" y="4" width="38" height="18" rx="8" fill="rgba(255,180,160,0.22)" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="7.5" fill="white" opacity="0.95" />
      ))}
    </svg>
  );
}

/* Triangle Dice: roll-a-die animation -> static SVG result */
function TriangleDice({ values, rolling, onRollEnd }) {
  const topRef = useRef(null);
  const blRef = useRef(null);
  const brRef = useRef(null);
  const doneRef = useRef(0);
  const initRef = useRef(false);

  useEffect(() => {
    if (!rolling || !values || values.length < 3) return;
    if (initRef.current) return;
    initRef.current = true;
    doneRef.current = 0;

    [topRef, blRef, brRef].forEach((ref, i) => {
      if (!ref.current) return;
      ref.current.innerHTML = '';
      rollADie({
        element: ref.current,
        numberOfDice: 1,
        values: [values[i]],
        soundVolume: 0,
        delay: 1800,
        callback: () => {
          doneRef.current += 1;
          if (doneRef.current >= 3 && onRollEnd) onRollEnd();
        },
      });
    });

    return () => {
      initRef.current = false;
    };
  }, [rolling, values, onRollEnd]);

  const v = values && values.length === 3 ? values : [1, 4, 6];

  return (
    <div className="tx-triangle-dice">
      <div className="tx-die-row-top">
        <div className="tx-die-canvas" ref={topRef} style={{ display: rolling ? 'block' : 'none' }} />
        {!rolling && <StaticDie value={v[0]} />}
      </div>
      <div className="tx-die-row-bot">
        <div className="tx-die-canvas" ref={blRef} style={{ display: rolling ? 'block' : 'none' }} />
        {!rolling && <StaticDie value={v[1]} />}
        <div className="tx-die-canvas" ref={brRef} style={{ display: rolling ? 'block' : 'none' }} />
        {!rolling && <StaticDie value={v[2]} />}
      </div>
    </div>
  );
}

function HistoryDots({ rounds }) {
  if (!rounds?.length) return null;
  return (
    <div className="tx-history">
      {rounds.slice(0, 15).map((r, i) => (
        <span
          key={r.id || i}
          className={`tx-hdot tx-hdot--${r.result_key}`}
          title={`${r.result_label} ${r.dice?.join('-')}`}
        />
      ))}
    </div>
  );
}

function MenuPager({ currentPage, totalPages, onPrev, onNext }) {
  const display = totalPages ? `${currentPage + 1}/${totalPages}` : '0';
  return (
    <div className="tx-menu-pager">
      <button className="tx-menu-page-btn" onClick={onPrev} disabled={!totalPages || currentPage <= 0}>◀</button>
      <div className="tx-menu-page-text">{display}</div>
      <button className="tx-menu-page-btn" onClick={onNext} disabled={!totalPages || currentPage >= totalPages - 1}>▶</button>
    </div>
  );
}

export default function TaiXiuFloatingWidget() {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState('guide');
  const [pos, setPos] = useState(null);

  const widgetRef = useRef(null);
  const dragState = useRef({ active: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  const [round, setRound] = useState(null);
  const [overview, setOverview] = useState(null);
  const [balance, setBalance] = useState(0);
  const [stake, setStake] = useState(BET_OPTIONS[0]);
  const [selectedSide, setSelectedSide] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [secsLeft, setSecsLeft] = useState(0);
  const [displayDice, setDisplayDice] = useState([]);
  const [rolling, setRolling] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [betPage, setBetPage] = useState(0);
  const [roundPage, setRoundPage] = useState(0);
  const [jackpotPage, setJackpotPage] = useState(0);

  const pollRef = useRef(null);
  const prevId = useRef(null);
  const prevStatus = useRef(null);

  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setMinimized(false);
      setMenuOpen(false);
    };
    window.addEventListener('mxh-open-taixiu', handler);
    return () => window.removeEventListener('mxh-open-taixiu', handler);
  }, []);

  const initPos = useCallback(() => {
    if (pos) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    setPos({ top: h - WIDGET_H - DEFAULT_POS.bottom, left: w - WIDGET_W - DEFAULT_POS.right });
  }, [pos]);

  const onMouseMove = useCallback((e) => {
    const d = dragState.current;
    if (!d.active) return;
    const maxL = window.innerWidth - (widgetRef.current?.offsetWidth || WIDGET_W) - 4;
    const maxT = window.innerHeight - (widgetRef.current?.offsetHeight || WIDGET_H) - 4;
    setPos({ left: Math.max(4, Math.min(maxL, d.startLeft + e.clientX - d.startX)), top: Math.max(4, Math.min(maxT, d.startTop + e.clientY - d.startY)) });
  }, []);

  const onMouseUp = useCallback(() => {
    dragState.current.active = false;
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const onDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    initPos();
    const rect = widgetRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    dragState.current = { active: true, startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [initPos, onMouseMove, onMouseUp]);

  const onTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    initPos();
    const t = e.touches[0];
    const rect = widgetRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    dragState.current = { active: true, startX: t.clientX, startY: t.clientY, startLeft: rect.left, startTop: rect.top };
  }, [initPos]);

  const onTouchMove = useCallback((e) => {
    const d = dragState.current;
    if (!d.active || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const maxL = window.innerWidth - (widgetRef.current?.offsetWidth || WIDGET_W) - 4;
    const maxT = window.innerHeight - (widgetRef.current?.offsetHeight || WIDGET_H) - 4;
    setPos({ left: Math.max(4, Math.min(maxL, d.startLeft + t.clientX - d.startX)), top: Math.max(4, Math.min(maxT, d.startTop + t.clientY - d.startY)) });
  }, []);

  const onTouchEnd = useCallback(() => {
    dragState.current.active = false;
  }, []);

  const applyRound = useCallback((r, bal) => {
    if (!r) return;
    setSecsLeft(r.seconds_left ?? 0);
    if (r.status === 'finished' && r.dice?.length === 3) {
      const alreadyShown = prevStatus.current === 'finished' && prevId.current === r.id;
      if (!alreadyShown) {
        setRolling(true);
        setDisplayDice(r.dice);
        setSelectedSide(null);
      } else {
        setDisplayDice(r.dice);
      }
    } else if (r.status === 'betting') {
      setRolling(false);
      setShowResult(false);
      setDisplayDice([]);
    }
    prevId.current = r.id;
    prevStatus.current = r.status;
    setRound(r);
    if (bal !== undefined) setBalance(bal);
  }, []);

  useEffect(() => {
    if (!open || !user) return;
    const init = async () => {
      try {
        const ov = await getTaiXiuOverview();
        setOverview(ov);
        setBalance(ov.balance);
        applyRound(ov.current_round, ov.balance);
      } catch (e) {
        setError(e.message);
      }
    };
    init();
    pollRef.current = setInterval(async () => {
      try {
        applyRound(await getTaiXiuCurrentRound());
      } catch (e) {
        console.error('[TaiXiu] Lỗi polling:', e);
      }
    }, 3000);
    return () => {
      clearInterval(pollRef.current);
    };
  }, [open, user, applyRound]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [open]);

  const handleRollEnd = useCallback(() => {
    setRolling(false);
    setShowResult(true);
    setTimeout(() => setShowResult(false), 3500);
  }, []);

  const handleSelectSide = (side) => {
    if (alreadyBet || !isBetting) return;
    setSelectedSide((prev) => (prev === side ? null : side));
    setError('');
  };

  const handleDouble = () => {
    const next = stake * 2;
    const maxOpt = BET_OPTIONS[BET_OPTIONS.length - 1];
    setStake(Math.min(next, maxOpt));
  };

  const handlePlaceBet = async () => {
    if (!selectedSide) {
      setError('Chọn Tài hoặc Xỉu trước.');
      return;
    }
    if (placing || !round || round.status !== 'betting' || round.my_bet_amount > 0) return;
    if (stake < 10000) {
      setError('Tối thiểu 10.000đ.');
      return;
    }
    if (stake > balance) {
      setError('Số dư không đủ.');
      return;
    }
    setError('');
    setPlacing(true);
    try {
      const res = await taiXiuPlaceBet(selectedSide, stake);
      setBalance(res.balance);
      applyRound(res.current_round, res.balance);
      window.dispatchEvent(new CustomEvent('mxh-wallet-refresh'));
      setSelectedSide(null);
    } catch (e) {
      setError(e.message || 'Đặt cược thất bại.');
    } finally {
      setPlacing(false);
    }
  };

  const handleCancel = () => {
    setSelectedSide(null);
    setStake(BET_OPTIONS[0]);
    setError('');
  };

  const openMenu = (tab = 'guide') => {
    setMenuTab(tab);
    setMenuOpen(true);
  };

  const handleOpen = () => {
    initPos();
    setOpen(true);
    setMinimized(false);
    setMenuOpen(false);
  };

  const handleExpand = (e) => {
    e.stopPropagation();
    setMinimized(false);
  };

  const handleCollapse = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    setMinimized(true);
  };

  const handleMenuClose = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    setOpen(false);
  };

  if (!user) return null;

  const alreadyBet = (round?.my_bet_amount || 0) > 0;
  const isBetting = round?.status === 'betting';
  const canPlace = isBetting && !alreadyBet && !!selectedSide && stake >= 10000 && stake <= balance && !placing;
  const jackpotTotal = (overview?.jackpot_tai_pool || 0) + (overview?.jackpot_xiu_pool || 0);
  const showActions = isBetting && !alreadyBet;
  const menuBetRows = overview?.my_recent_bets || [];
  const menuRoundRows = overview?.recent_rounds || [];
  const menuJackpotRows = overview?.jackpot_history || [];
  const activeMenuIndex = Math.max(0, MENU_TABS.findIndex((tab) => tab.key === menuTab));
  const betPages = Math.ceil(menuBetRows.length / MENU_PAGE_SIZE);
  const roundPages = Math.ceil(menuRoundRows.length / MENU_PAGE_SIZE);
  const jackpotPages = Math.ceil(menuJackpotRows.length / JACKPOT_PAGE_SIZE);
  const visibleBetRows = slicePage(menuBetRows, clampPage(betPage, betPages));
  const visibleRoundRows = slicePage(menuRoundRows, clampPage(roundPage, roundPages));
  const visibleJackpotRows = slicePage(menuJackpotRows, clampPage(jackpotPage, jackpotPages), JACKPOT_PAGE_SIZE);
  const jackpotTaiHits = menuJackpotRows.filter((row) => row.jackpot_side === 'tai').length;
  const jackpotXiuHits = menuJackpotRows.filter((row) => row.jackpot_side === 'xiu').length;
  const jackpotHitTotal = Math.max(1, jackpotTaiHits + jackpotXiuHits);
  const style = pos
    ? { position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }
    : { position: 'fixed', bottom: DEFAULT_POS.bottom, right: DEFAULT_POS.right, zIndex: 9999 };

  if (!open) {
    return (
      <button
        className="tx-bubble"
        style={{ position: 'fixed', bottom: DEFAULT_POS.bottom, right: DEFAULT_POS.right, zIndex: 9999 }}
        onClick={handleOpen}
        title="Mở Tài Xỉu"
      >🎲</button>
    );
  }

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
        {isBetting && (
          <span className={`tx-mini-count${secsLeft <= 5 ? ' tx-mini-count--urgent' : ''}`}>{secsLeft}s</span>
        )}
        {!isBetting && round?.result_key && (
          <span className={`tx-mini-result tx-mini-result--${round.result_key}`}>{round.result_label}</span>
        )}
        <button className="tx-mini-btn" onClick={handleExpand} title="Mở rộng">▲</button>
        <button className="tx-mini-btn tx-mini-btn--close" onClick={handleClose} title="Đóng">✕</button>
      </div>
    );
  }

  if (menuOpen) {
    return (
      <div ref={widgetRef} className="tx-casino-widget tx-casino-widget--menu" style={style}>
        <div className="tx-menu-shell">
          <aside className="tx-menu-rail">
            {MENU_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`tx-menu-rail-btn${menuTab === tab.key ? ' tx-menu-rail-btn--active' : ''}`}
                onClick={() => setMenuTab(tab.key)}
                title={tab.label}
              >
                <span className="tx-menu-rail-icon">{tab.icon}</span>
              </button>
            ))}
          </aside>

          <section className="tx-menu-panel">
            <div
              className="tx-menu-header"
              onMouseDown={onDragStart}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <span className="tx-menu-round">#{round?.round_code || '...'}</span>
              <h3 className={`tx-menu-title${menuTab === 'rounds' ? ' tx-menu-title--stack' : ''}`}>{MENU_TABS[activeMenuIndex]?.label?.toUpperCase()}</h3>
              <div className="tx-menu-header-actions">
                <button className="tx-menu-head-btn" onClick={handleCollapse} title="Thu gọn">▁</button>
                <button className="tx-menu-head-btn tx-menu-head-btn--close" onClick={handleMenuClose} title="Đóng menu">✕</button>
              </div>
            </div>

            <div className="tx-menu-content">
              {menuTab === 'guide' && (
                <div className="tx-menu-section tx-menu-section--guide">
                  <p>Các kết quả được tạo bởi hệ thống RNG cam kết ngẫu nhiên và công bằng, người chơi sẽ đặt cược kết quả 3 viên xí ngầu có thể ra.</p>
                  <p><strong className="tx-menu-strong tx-menu-strong--tai">TÀI</strong>: tổng số điểm của 3 viên xí ngầu là 11 - 18.</p>
                  <p><strong className="tx-menu-strong">XỈU</strong>: tổng số điểm của 3 viên xí ngầu là 3 - 10.</p>
                  <p>Jackpot được tính khi ra <span className="tx-menu-hot">18 điểm Tài</span> hoặc <span className="tx-menu-hot">3 điểm Xỉu</span>.</p>
                  <div className="tx-menu-formula">
                    <span>Tiền chia thưởng Jackpot</span>
                    <span className="tx-menu-formula-op">=</span>
                    <span className="tx-menu-fraction">
                      <strong>Cược của người chơi</strong>
                      <em>Tổng cược bên thắng</em>
                    </span>
                    <span className="tx-menu-formula-op">×</span>
                    <span>Tiền Jackpot</span>
                  </div>
                  <MenuPager
                    currentPage={activeMenuIndex}
                    totalPages={MENU_TABS.length}
                    onPrev={() => setMenuTab(MENU_TABS[Math.max(0, activeMenuIndex - 1)].key)}
                    onNext={() => setMenuTab(MENU_TABS[Math.min(MENU_TABS.length - 1, activeMenuIndex + 1)].key)}
                  />
                </div>
              )}

              {menuTab === 'bets' && (
                <div className="tx-menu-section">
                  <div className="tx-menu-table-head">
                    <span>Thời gian</span>
                    <span>Tiền Cược</span>
                    <span>Tiền Thắng</span>
                    <span>Kết quả</span>
                  </div>
                  <div className="tx-menu-table-head tx-menu-table-head--hidden">
                    <span>Thá»i gian</span>
                    <span>Tiá»n ná»• hÅ©</span>
                    <span>Káº¿t quáº£</span>
                  </div>
                  <div className="tx-menu-list">
                    {visibleBetRows.length ? visibleBetRows.map((bet) => (
                      <div key={bet.id} className="tx-menu-row">
                        <div className="tx-menu-col">
                          <strong>{fmtDateTime(bet.created_at)}</strong>
                          <span>#{bet.round_code}</span>
                        </div>
                        <div className="tx-menu-col">
                          <strong>{fmt(bet.bet_amount)}</strong>
                          <span>{bet.bet_label}</span>
                        </div>
                        <div className="tx-menu-col">
                          <strong className={bet.did_win ? 'tx-menu-money tx-menu-money--win' : 'tx-menu-money tx-menu-money--lose'}>
                            {bet.did_win ? '+' : '-'}{fmt(Math.abs(bet.net_amount))}
                          </strong>
                          <span>{bet.jackpot_hit ? `Hũ +${fmt(bet.jackpot_payout)}` : 'Thường'}</span>
                        </div>
                        <div className="tx-menu-col tx-menu-col--result">
                          <strong className={`tx-menu-badge tx-menu-badge--${bet.result_key}`}>{bet.result_label}</strong>
                          <span>{bet.dice?.join('-') || '--'}</span>
                        </div>
                      </div>
                    )) : <div className="tx-menu-empty">Chưa có lịch sử cược.</div>}
                  </div>
                  <MenuPager
                    currentPage={clampPage(betPage, betPages)}
                    totalPages={betPages}
                    onPrev={() => setBetPage((p) => clampPage(p - 1, betPages))}
                    onNext={() => setBetPage((p) => clampPage(p + 1, betPages))}
                  />
                </div>
              )}

              {menuTab === 'rounds' && (
                <div className="tx-menu-section tx-menu-section--rounds">
                  <div className="tx-menu-stats tx-menu-stats--rounds">
                    <div className="tx-menu-stat-card tx-menu-stat-card--rounds">
                      <span>TÀI</span>
                      <strong>{overview?.tai_result_rate ?? 50}%</strong>
                    </div>
                    <div className="tx-menu-stat-card tx-menu-stat-card--rounds">
                      <span>XỈU</span>
                      <strong>{overview?.xiu_result_rate ?? 50}%</strong>
                    </div>
                  </div>
                  <div className="tx-menu-list tx-menu-list--rounds">
                    {visibleRoundRows.length ? visibleRoundRows.map((item) => (
                      <div key={item.id} className="tx-menu-row tx-menu-row--round">
                        <div className="tx-menu-col tx-menu-round-col tx-menu-round-col--left">
                          <strong className="tx-menu-round-id">#{item.round_code}</strong>
                          <span>{fmtTimeDateCompact(item.created_at)}</span>
                        </div>
                        <div className="tx-menu-col tx-menu-round-col tx-menu-round-col--center">
                          <strong className={`tx-menu-round-result tx-menu-round-result--${item.result_key}`}>{item.result_label}</strong>
                          <span>{item.dice?.join('-') || '--'}</span>
                        </div>
                        <div className="tx-menu-col tx-menu-round-col tx-menu-round-col--right">
                          <strong className="tx-menu-round-total">Tổng {item.total}</strong>
                          <span>{item.jackpot_side ? `Nổ ${item.jackpot_side === 'tai' ? 'Tài' : 'Xỉu'}` : 'Phiên thường'}</span>
                        </div>
                      </div>
                    )) : <div className="tx-menu-empty">Chưa có lịch sử phiên.</div>}
                  </div>
                  <MenuPager
                    currentPage={clampPage(roundPage, roundPages)}
                    totalPages={roundPages}
                    onPrev={() => setRoundPage((p) => clampPage(p - 1, roundPages))}
                    onNext={() => setRoundPage((p) => clampPage(p + 1, roundPages))}
                  />
                </div>
              )}

              {menuTab === 'jackpot' && (
                <div className="tx-menu-section tx-menu-section--jackpot">
                  <div className="tx-menu-stats tx-menu-stats--jackpot">
                    <div className="tx-menu-stat-card tx-menu-stat-card--jackpot">
                      <span className="tx-menu-strong tx-menu-strong--tai">NỔ TÀI</span>
                      <strong>{Math.round((jackpotTaiHits / jackpotHitTotal) * 100)}%</strong>
                    </div>
                    <div className="tx-menu-stat-card tx-menu-stat-card--jackpot">
                      <span className="tx-menu-strong">NỔ XỈU</span>
                      <strong>{Math.round((jackpotXiuHits / jackpotHitTotal) * 100)}%</strong>
                    </div>
                  </div>
                  <div className="tx-menu-table-head tx-menu-table-head--jackpot">
                    <span>Thá»i gian</span>
                    <span>Tiá»n ná»• hÅ©</span>
                    <span>Káº¿t quáº£</span>
                  </div>
                  <div className="tx-menu-list tx-menu-list--jackpot">
                    {visibleJackpotRows.length ? visibleJackpotRows.map((item) => (
                      <div key={item.id} className="tx-menu-row tx-menu-row--jackpot tx-menu-row--jackpot-card">
                        <div className="tx-menu-col tx-menu-jackpot-col tx-menu-jackpot-col--left">
                          <strong className="tx-menu-jackpot-time">{fmtDateTime(item.created_at)}</strong>
                          <span className="tx-menu-jackpot-round">#{item.round_code}</span>
                        </div>
                        <div className="tx-menu-col tx-menu-jackpot-col tx-menu-jackpot-col--center">
                          <strong className="tx-menu-jackpot-payout">{fmt(item.jackpot_payout)}</strong>
                          <span>Tiền nổ hũ</span>
                        </div>
                        <div className="tx-menu-col tx-menu-col--result tx-menu-jackpot-col tx-menu-jackpot-col--right">
                          <strong className={item.jackpot_side === 'tai' ? 'tx-menu-jackpot-label tx-menu-jackpot-label--tai tx-menu-jackpot-result' : 'tx-menu-jackpot-label tx-menu-jackpot-result'}>
                            {item.jackpot_side === 'tai' ? 'NỔ TÀI' : 'NỔ XỈU'}
                          </strong>
                          <span>{item.total} điểm</span>
                        </div>
                      </div>
                    )) : <div className="tx-menu-empty">Chưa có lịch sử nổ hũ.</div>}
                  </div>
                  <MenuPager
                    currentPage={clampPage(jackpotPage, jackpotPages)}
                    totalPages={jackpotPages}
                    onPrev={() => setJackpotPage((p) => clampPage(p - 1, jackpotPages))}
                    onNext={() => setJackpotPage((p) => clampPage(p + 1, jackpotPages))}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  const showDice = rolling || displayDice.length === 3;
  const secs2 = `${String(Math.floor(secsLeft / 60)).padStart(2, '0')}:${String(secsLeft % 60).padStart(2, '0')}`;

  return (
    <div ref={widgetRef} className="tx-casino-widget" style={style}>
      <div className="tx-jackpot-wrap">
        <div className="tx-jackpot-label">JACKPOT</div>
        <div className="tx-jackpot-pill">
          <span className="tx-jq-arrow">❮</span>
          <span className="tx-jq-num">{new Intl.NumberFormat('vi-VN').format(jackpotTotal)}</span>
          <span className="tx-jq-arrow">❯</span>
        </div>
      </div>

      <div className="tx-casino-body">
        <div
          className="tx-top-bar"
          onMouseDown={onDragStart}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <button className="tx-ctrl-btn" onClick={() => openMenu('guide')} title="Mở sảnh thông tin">≡</button>
          <span className="tx-round-code">#{round?.round_code || '...'}</span>
          <div className="tx-top-actions">
            <button className="tx-ctrl-btn" onClick={handleCollapse} title="Thu gọn">▁</button>
            <button className="tx-ctrl-btn tx-ctrl-btn--close" onClick={handleClose} title="Đóng">✕</button>
          </div>
        </div>

        {showResult && round?.result_key && (
          <div className={`tx-result-flash tx-result-flash--${round.result_key}`}>
            <strong>{round.result_label?.toUpperCase()}</strong> · Tổng {round.total}
            {round.my_bet_amount > 0 && (
              <span className={round.my_did_win ? 'tx-win-badge' : 'tx-lose-badge'}>
                {round.my_did_win ? ' 🎉 Thắng!' : ' 😞 Thua'}
              </span>
            )}
          </div>
        )}

        <div className="tx-play-area">
          <div className="tx-side-col tx-side-col--tai">
            <div className="tx-side-title tx-title-tai">TÀI</div>
            <div className="tx-players"><span>👤</span>{round?.tai_count || 0}</div>
            <div className="tx-side-amount">{fmt(round?.tai_total || 0)}</div>
            {!alreadyBet && isBetting ? (
              selectedSide === 'tai'
                ? <div className="tx-bet-pill">{fmt(stake)}</div>
                : <button className="tx-cuoc-btn" onClick={() => handleSelectSide('tai')}>CƯỢC</button>
            ) : alreadyBet && round?.my_bet_side === 'tai' ? (
              <div className="tx-bet-pill tx-bet-pill--placed">{fmt(round.my_bet_amount)}</div>
            ) : null}
          </div>

          <div className="tx-center-wrap">
            <div className={`tx-center-circle${rolling ? ' tx-center-circle--rolling' : ''}`}>
              {showDice
                ? <TriangleDice values={displayDice} rolling={rolling} onRollEnd={handleRollEnd} />
                : <div className="tx-total-num">{round?.total ?? '?'}</div>}
            </div>
            {!rolling && isBetting && (
              <div className="tx-countdown-text">{secs2}</div>
            )}
            {!rolling && !isBetting && round?.status === 'finished' && (
              <div className="tx-result-label">Kết quả!</div>
            )}
          </div>

          <div className="tx-side-col tx-side-col--xiu">
            <div className="tx-side-title tx-title-xiu">XỈU</div>
            <div className="tx-players"><span>👤</span>{round?.xiu_count || 0}</div>
            <div className="tx-side-amount">{fmt(round?.xiu_total || 0)}</div>
            {!alreadyBet && isBetting ? (
              selectedSide === 'xiu'
                ? <div className="tx-bet-pill">{fmt(stake)}</div>
                : <button className="tx-cuoc-btn" onClick={() => handleSelectSide('xiu')}>CƯỢC</button>
            ) : alreadyBet && round?.my_bet_side === 'xiu' ? (
              <div className="tx-bet-pill tx-bet-pill--placed">{fmt(round.my_bet_amount)}</div>
            ) : null}
          </div>
        </div>

        {alreadyBet && (
          <div className="tx-bet-placed">
            Đã đặt <strong>{round.my_bet_side === 'tai' ? 'Tài' : 'Xỉu'}</strong> —&nbsp;{fmtFull(round.my_bet_amount)}
            {isBetting && <span className="tx-waiting"> · Chờ kết quả...</span>}
          </div>
        )}

        {error && (
          <div className="tx-error-msg">
            {error}
            {(error.includes('dư') || error.includes('Số')) && (
              <Link to="/settings"> Nạp tiền</Link>
            )}
          </div>
        )}

        <div className="tx-bottom-bar">
          <button className="tx-round-btn" onClick={() => openMenu('rounds')} title="Lịch sử phiên">⟳</button>
          <HistoryDots rounds={overview?.recent_rounds} />
          <button className="tx-round-btn" onClick={() => openMenu('jackpot')} title="Lịch sử nổ hũ">★</button>
        </div>

        <div className="tx-footer">
          <span className="tx-wallet-label">Ví : {fmt(balance)}</span>
          <span className="tx-md5-label">MD5 {(round?.round_code || '').slice(0, 20)}...</span>
          <button
            className="tx-copy-btn"
            onClick={() => navigator.clipboard?.writeText(round?.round_code || '')}
          >Copy</button>
        </div>
      </div>

      {showActions && (
        <div className="tx-below-oval">
          <div className="tx-stakes-row">
            {BET_OPTIONS.map((opt) => (
              <button
                key={opt}
                className={`tx-stake-chip${stake === opt ? ' tx-stake-chip--active' : ''}`}
                onClick={() => setStake(opt)}
              >{fmt(opt)}</button>
            ))}
          </div>

          <div className="tx-actions-row">
            <button className="tx-x2-btn" onClick={handleDouble} disabled={!selectedSide}>X2</button>
            <button className="tx-place-btn" onClick={handlePlaceBet} disabled={!canPlace}>
              {placing ? 'Đang đặt...' : 'ĐẶT CƯỢC'}
            </button>
            <button className="tx-cancel-btn" onClick={handleCancel}>HỦY</button>
          </div>
        </div>
      )}
    </div>
  );
}
