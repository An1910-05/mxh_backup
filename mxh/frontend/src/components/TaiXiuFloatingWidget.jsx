import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getTaiXiuOverview, getTaiXiuCurrentRound, taiXiuPlaceBet } from '../services/graphql';

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

/* Vị trí chấm trên mỗi mặt (viewBox 100x100) */
const DIE_DOTS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[24, 24], [50, 50], [76, 76]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

/* Rotation để "đưa mặt N ra phía user" (+Z).
   Cube được setup: face1=front (+Z), face2=right (+X), face3=top (+Y),
   face4=bottom (-Y), face5=left (-X), face6=back (-Z). Đối diện cộng=7. */
const FACE_SHOW_ROT = {
  1: { rx: 0,   ry: 0 },
  2: { rx: 0,   ry: -90 },
  3: { rx: -90, ry: 0 },
  4: { rx: 90,  ry: 0 },
  5: { rx: 0,   ry: 90 },
  6: { rx: 0,   ry: 180 },
};

function DieFaceSVG({ value }) {
  const v = Math.max(1, Math.min(6, value || 1));
  const dots = DIE_DOTS[v];
  const id = `mxhdf${v}`;
  return (
    <svg viewBox="0 0 100 100" className="mxh-die-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff5030" />
          <stop offset="55%" stopColor="#cc1100" />
          <stop offset="100%" stopColor="#7a0000" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="96" height="96" rx="16" fill={`url(#${id}a)`} stroke="#3a0000" strokeWidth="2" />
      <rect x="6" y="5" width="55" height="14" rx="7" fill="rgba(255,200,180,0.28)" />
      {dots.map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx + 1.5} cy={cy + 1.5} r="9" fill="rgba(0,0,0,0.35)" />
          <circle cx={cx} cy={cy} r="9" fill="#fff" />
        </g>
      ))}
    </svg>
  );
}

/* 3D cube die tự viết (không dùng roll-a-die). Khi rolling=true dùng keyframe
   mxhDieSpin quay nhiều vòng rồi dừng đúng mặt cần hiện. Khi rolling=false cube
   transition mượt về rotation đích. Mỗi viên có delaySec khác nhau để tam giác
   lăn so le. */
function AnimatedDie({ value, rolling, delaySec = 0 }) {
  const v = Math.max(1, Math.min(6, value || 1));
  const rot = FACE_SHOW_ROT[v];
  const cubeStyle = {
    '--mxh-final-rx': `${rot.rx}deg`,
    '--mxh-final-ry': `${rot.ry}deg`,
    '--mxh-die-delay': `${delaySec}s`,
  };
  const cubeKey = rolling ? `r-${v}-${delaySec}` : `s-${v}`;
  return (
    <div className="mxh-die">
      <div
        className={`mxh-die-cube${rolling ? ' mxh-die-cube--rolling' : ''}`}
        style={cubeStyle}
        key={cubeKey}
      >
        <div className="mxh-die-face mxh-die-face--front"><DieFaceSVG value={1} /></div>
        <div className="mxh-die-face mxh-die-face--right"><DieFaceSVG value={2} /></div>
        <div className="mxh-die-face mxh-die-face--top"><DieFaceSVG value={3} /></div>
        <div className="mxh-die-face mxh-die-face--bottom"><DieFaceSVG value={4} /></div>
        <div className="mxh-die-face mxh-die-face--left"><DieFaceSVG value={5} /></div>
        <div className="mxh-die-face mxh-die-face--back"><DieFaceSVG value={6} /></div>
      </div>
    </div>
  );
}

function TriangleDice({ values, rolling, idle }) {
  const v = values && values.length === 3 ? values : [1, 4, 6];
  return (
    <div className={`tx-triangle-dice${idle ? ' tx-triangle-dice--idle' : ''}`}>
      <div className="tx-die-row-top">
        <div className="tx-die-slot">
          <AnimatedDie value={v[0]} rolling={rolling} delaySec={0} />
        </div>
      </div>
      <div className="tx-die-row-bot">
        <div className="tx-die-slot">
          <AnimatedDie value={v[1]} rolling={rolling} delaySec={0.18} />
        </div>
        <div className="tx-die-slot">
          <AnimatedDie value={v[2]} rolling={rolling} delaySec={0.36} />
        </div>
      </div>
    </div>
  );
}

function HistoryDots({ rounds }) {
  if (!rounds?.length) return null;
  // Backend trả recent_rounds theo thứ tự mới → cũ. Reverse để render
  // cũ → mới (trái → phải) → chấm mới nhất luôn nằm ngoài cùng bên phải.
  const ordered = rounds.slice(0, 15).slice().reverse();
  return (
    <div className="tx-history">
      {ordered.map((r, i) => (
        <span
          key={r.id || i}
          className={`tx-hdot tx-hdot--${r.result_key}${r.__justPrepended ? ' tx-hdot--fresh' : ''}`}
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
  const overviewPollRef = useRef(null);
  const prevId = useRef(null);
  const prevPhase = useRef(null);
  const resultFlashTimerRef = useRef(null);
  const refreshingOverviewRef = useRef(false);
  const historyRefreshTimerRef = useRef(null);
  // Snapshot round vừa xử lý ở lần applyRound trước. Khi roundChanged,
  // ref này chính là round vừa kết thúc (đã có result_key + dice + total).
  const prevRoundSnapshotRef = useRef(null);
  // Round vừa kết thúc đang chờ prepend vào HistoryDots. Set ngay khi
  // `applyRound` detect phase=rolling/result (r.result_key đã populated).
  // Tiêu thụ bởi 2 trigger (dedupe theo id):
  //  (a) useEffect watch `showResult` true→false (flash 5s vừa tắt) — chạy
  //      SỚM NHẤT, đúng khoảnh khắc UX mong muốn.
  //  (b) applyRound khi `roundChanged` — fallback nếu client miss phase=result.
  // `prependFinishedDot()` clear ref về null sau khi commit.
  const finishedRoundRef = useRef(null);
  // Đánh dấu "đang chờ refresh overview 1.8s sau round change" để đồng bộ
  // jackpot pool / tỉ lệ / jackpot history từ server. Prepend chấm đã xử lý
  // riêng qua `prependFinishedDot`, ref này chỉ dùng cho server refresh.
  const pendingHistoryRefreshRef = useRef(false);

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

  // Những element không được phép khởi tạo drag (buttons, links, input, text
  // có thể select như MD5 hash, hoặc bất kỳ node nào gắn data-no-drag).
  const isInteractiveTarget = (target) => {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest('button, a, input, select, textarea, label, code, [data-no-drag]');
  };

  const onDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    if (isInteractiveTarget(e.target)) return;
    initPos();
    const rect = widgetRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    dragState.current = { active: true, startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [initPos, onMouseMove, onMouseUp]);

  const onTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    if (isInteractiveTarget(e.target)) return;
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

  const refreshOverview = useCallback(async () => {
    if (refreshingOverviewRef.current) return;
    refreshingOverviewRef.current = true;
    try {
      const ov = await getTaiXiuOverview();
      setOverview(ov);
      if (typeof ov?.balance === 'number') setBalance(ov.balance);
    } catch (e) {
      console.error('[TaiXiu] Lỗi refresh overview:', e);
    } finally {
      refreshingOverviewRef.current = false;
    }
  }, []);

  // Prepend chấm Tỉu/Xài của phiên vừa kết thúc (đọc từ finishedRoundRef)
  // vào overview.recent_rounds. Dedupe theo `id` để không bị double khi gọi
  // từ nhiều trigger (flash tắt / round changed / overviewPoll). Gắn cờ
  // `__justPrepended` để HistoryDots render class `tx-hdot--fresh` → animation
  // pulse vàng ~1.6s giúp user nhận biết "chấm mới vừa xuất hiện".
  const prependFinishedDot = useCallback(() => {
    const finished = finishedRoundRef.current;
    if (!finished?.id || !finished?.result_key) return;
    finishedRoundRef.current = null;
    console.log('[TaiXiu] ✅ HistoryDots prepend', {
      id: finished.id,
      round_code: finished.round_code,
      result_key: finished.result_key,
      dice: finished.dice,
    });
    setOverview((ov) => {
      if (!ov) return ov;
      const list = ov.recent_rounds || [];
      if (list.some((x) => String(x.id) === String(finished.id))) {
        console.log('[TaiXiu] 🚫 HistoryDots skip: id đã tồn tại', finished.id);
        return ov;
      }
      const dot = {
        id: finished.id,
        round_code: finished.round_code,
        result_key: finished.result_key,
        result_label: finished.result_label,
        dice: Array.isArray(finished.dice) ? finished.dice.slice() : [],
        total: finished.total,
        created_at: finished.ended_at || finished.created_at || new Date().toISOString(),
        jackpot_side: finished.jackpot_side || null,
        __justPrepended: true,
      };
      return { ...ov, recent_rounds: [dot, ...list].slice(0, 30) };
    });
  }, []);

  const applyRound = useCallback((r, bal) => {
    if (!r) return;
    const phase = r.phase || (r.status === 'betting' ? 'betting' : (r.dice?.length === 3 ? 'result' : 'betting'));
    setSecsLeft(r.phase_seconds_left ?? r.seconds_left ?? 0);

    const sameRound = prevId.current === r.id;
    const phaseChanged = !sameRound || prevPhase.current !== phase;
    const roundChanged = prevId.current !== null && !sameRound;

    if (phaseChanged) {
      if (phase === 'betting') {
        setRolling(false);
        setShowResult(false);
        setDisplayDice([]);
        setSelectedSide(null);
      } else if (phase === 'rolling') {
        if (r.dice?.length === 3) {
          setRolling(true);
          setDisplayDice(r.dice);
          setShowResult(false);
        }
      } else if (phase === 'result') {
        setRolling(false);
        if (r.dice?.length === 3) setDisplayDice(r.dice);
        setShowResult(true);
        if (resultFlashTimerRef.current) clearTimeout(resultFlashTimerRef.current);
        const flashMs = Math.max(1000, (r.phase_seconds_left ?? 5) * 1000);
        resultFlashTimerRef.current = setTimeout(() => setShowResult(false), flashMs);
      }
    } else if (phase === 'rolling' && r.dice?.length === 3 && displayDice.length !== 3) {
      setDisplayDice(r.dice);
    } else if (phase === 'result' && r.dice?.length === 3 && displayDice.length !== 3) {
      setDisplayDice(r.dice);
    }

    // LƯU snapshot round "đã có kết quả" vào finishedRoundRef ngay khi detect
    // phase=rolling hoặc phase=result (server đã resolve, r.result_key được set).
    // Ref này sẽ được tiêu thụ sớm nhất bởi useEffect watching `showResult`
    // true→false (flash 5s tắt), hoặc fallback khi roundChanged nếu client
    // miss phase=result. prependFinishedDot tự clear ref sau khi commit.
    if ((phase === 'rolling' || phase === 'result') && r.result_key) {
      finishedRoundRef.current = r;
    }

    // Khi round id ĐỔI (phiên cũ đã kết thúc, phiên mới bắt đầu):
    //  (1) Gọi prependFinishedDot để prepend NGAY (có dedupe, không double nếu
    //      trigger flash tắt đã chạy trước).
    //  (2) Set cờ pending → useEffect dưới schedule refreshOverview 1.8s sau
    //      (đồng bộ jackpot pool / tỉ lệ / data chuẩn từ server).
    if (roundChanged) {
      prependFinishedDot();
      pendingHistoryRefreshRef.current = true;
    }

    prevId.current = r.id;
    prevPhase.current = phase;
    prevRoundSnapshotRef.current = r;
    setRound(r);
    if (bal !== undefined) setBalance(bal);
  }, [displayDice.length, prependFinishedDot]);

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
    // Fallback: đồng bộ overview (jackpot pool, tỉ lệ, lịch sử) mỗi 15s
    // phòng trường hợp phát hiện chuyển phiên bị trượt. Skip khi đang
    // rolling / result để tránh hiếm gặp backend đã commit phiên trong
    // recent_rounds trước khi client kết thúc animation, làm lộ kết quả
    // xuống HistoryDots sớm.
    overviewPollRef.current = setInterval(() => {
      const ph = prevPhase.current;
      if (ph === 'rolling' || ph === 'result') return;
      refreshOverview();
    }, 15000);
    return () => {
      clearInterval(pollRef.current);
      clearInterval(overviewPollRef.current);
    };
  }, [open, user, applyRound, refreshOverview]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Trigger SỚM NHẤT prepend chấm mới: watch `showResult` true → false,
  // tức là `resultFlashTimer` 5s vừa tắt (flash "TỈU! Tổng X" ở top biến mất).
  // Tại thời điểm này client đã có đầy đủ dữ liệu phiên vừa kết thúc trong
  // `finishedRoundRef` (được set trong applyRound phase=rolling/result từ
  // trước đó). Prepend ngay → user thấy chấm mới ở HistoryDots đúng khoảnh
  // khắc flash tắt, không phải chờ poll tiếp theo bắt được round B (~3s sau).
  const showResultPrevRef = useRef(false);
  useEffect(() => {
    if (showResultPrevRef.current && !showResult) {
      console.log('[TaiXiu] 🎯 Flash 5s tắt → thử prepend HistoryDots');
      prependFinishedDot();
    }
    showResultPrevRef.current = showResult;
  }, [showResult, prependFinishedDot]);

  // Server sync 1.8s sau khi state settle: gọi refreshOverview để đồng bộ
  // jackpot pool / tai_result_rate / xiu_result_rate / jackpot_history. Server
  // refresh set lại toàn bộ overview (bao gồm recent_rounds chuẩn từ DB) —
  // nếu optimistic prepend ở trên đã thêm dot thì server cũng đã có dot đó,
  // không bị double (server replace thay vì merge). KHÔNG return cleanup để
  // clear timer — timer phải chạy xuyên qua các re-render khác (secsLeft
  // countdown mỗi giây). Timer clear khi unmount (useEffect `[]` dưới) hoặc
  // guard bằng `historyRefreshTimerRef.current` để tránh double schedule.
  useEffect(() => {
    if (!pendingHistoryRefreshRef.current) return;
    if (rolling || showResult) return;
    if (historyRefreshTimerRef.current) return;
    pendingHistoryRefreshRef.current = false;
    historyRefreshTimerRef.current = setTimeout(() => {
      refreshOverview();
      historyRefreshTimerRef.current = null;
    }, 1800);
  }, [rolling, showResult, round?.id, refreshOverview]);

  useEffect(() => () => {
    if (resultFlashTimerRef.current) clearTimeout(resultFlashTimerRef.current);
    if (historyRefreshTimerRef.current) clearTimeout(historyRefreshTimerRef.current);
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
    if (placing || !round || (round.phase ?? round.status) !== 'betting' || round.my_bet_amount > 0) return;
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
  const phase = round?.phase || (round?.status === 'betting' ? 'betting' : 'result');
  const isBetting = phase === 'betting';
  const isRolling = phase === 'rolling';
  const isResult = phase === 'result';
  const canPlace = isBetting && !alreadyBet && !!selectedSide && stake >= 10000 && stake <= balance && !placing;
  const jackpotTotal = (overview?.jackpot_tai_pool || 0) + (overview?.jackpot_xiu_pool || 0);
  // Stakes chips (các mức tiền) hiện trong suốt phase betting để người dùng có thể
  // chọn mức trước. Riêng thanh X2 / ĐẶT CƯỢC / HỦY chỉ hiện sau khi bấm nút CƯỢC
  // (selectedSide đã set). Bấm HỦY sẽ reset selectedSide → thanh hành động ẩn đi.
  const showStakes  = isBetting && !alreadyBet;
  const showActions = showStakes && !!selectedSide;
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
    return null;
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
        <span className="tx-mini-label">TỈU XÀI</span>
        {isBetting && (
          <span className={`tx-mini-count${secsLeft <= 5 ? ' tx-mini-count--urgent' : ''}`}>{secsLeft}s</span>
        )}
        {isRolling && (
          <span className="tx-mini-count tx-mini-count--urgent">🎲 {secsLeft}s</span>
        )}
        {isResult && round?.result_key && (
          <span className={`tx-mini-result tx-mini-result--${round.result_key}`}>{round.result_label}</span>
        )}
        <button className="tx-mini-btn" onClick={handleExpand} title="Mở rộng">▲</button>
        <button className="tx-mini-btn tx-mini-btn--close" onClick={handleClose} title="Đóng">✕</button>
      </div>
    );
  }

  if (menuOpen) {
    return (
      <div
        ref={widgetRef}
        className="tx-casino-widget tx-casino-widget--menu"
        style={style}
        onMouseDown={onDragStart}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
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
            <div className="tx-menu-header">
              <span className="tx-menu-round">#{round?.round_code || '...'}</span>
              <h3 className={`tx-menu-title${menuTab === 'rounds' ? ' tx-menu-title--stack' : ''}`}>{MENU_TABS[activeMenuIndex]?.label?.toUpperCase()}</h3>
              <div className="tx-menu-header-actions">
                <button className="tx-menu-head-btn" onClick={handleMenuClose} title="Quay lại">←</button>
                <button className="tx-menu-head-btn tx-menu-head-btn--close" onClick={handleClose} title="Đóng">✕</button>
              </div>
            </div>

            <div className="tx-menu-content">
              {menuTab === 'guide' && (
                <div className="tx-menu-section tx-menu-section--guide">
                  <p>Các kết quả được tạo bởi hệ thống RNG cam kết ngẫu nhiên và công bằng, người chơi sẽ đặt cược kết quả 3 viên xí ngầu có thể ra.</p>
                  <p><strong className="tx-menu-strong tx-menu-strong--tai">TỈU</strong>: tổng số điểm của 3 viên xí ngầu là 11 - 18.</p>
                  <p><strong className="tx-menu-strong">XÀI</strong>: tổng số điểm của 3 viên xí ngầu là 3 - 10.</p>
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
                      <span>TỈU</span>
                      <strong>{overview?.tai_result_rate ?? 50}%</strong>
                    </div>
                    <div className="tx-menu-stat-card tx-menu-stat-card--rounds">
                      <span>XÀI</span>
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
                          <span>{item.jackpot_side ? `Nổ ${item.jackpot_side === 'tai' ? 'Tỉu' : 'Xài'}` : 'Phiên thường'}</span>
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
                      <span className="tx-menu-strong tx-menu-strong--tai">NỔ TỈU</span>
                      <strong>{Math.round((jackpotTaiHits / jackpotHitTotal) * 100)}%</strong>
                    </div>
                    <div className="tx-menu-stat-card tx-menu-stat-card--jackpot">
                      <span className="tx-menu-strong">NỔ XÀI</span>
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
                            {item.jackpot_side === 'tai' ? 'NỔ TỈU' : 'NỔ XÀI'}
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

  const hasResultDice = displayDice.length === 3;
  const lastRoundDice = overview?.recent_rounds?.find?.((r) => Array.isArray(r.dice) && r.dice.length === 3)?.dice;
  const idleDiceValues = hasResultDice
    ? displayDice
    : (lastRoundDice && lastRoundDice.length === 3 ? lastRoundDice : [1, 4, 6]);
  const diceInIdleMode = !rolling && !hasResultDice;
  const secs2 = `${String(Math.floor(secsLeft / 60)).padStart(2, '0')}:${String(secsLeft % 60).padStart(2, '0')}`;

  return (
    <div
      ref={widgetRef}
      className="tx-casino-widget"
      style={style}
      onMouseDown={onDragStart}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="tx-jackpot-wrap">
        <div className="tx-jackpot-label">JACKPOT</div>
        <div className="tx-jackpot-pill">
          <span className="tx-jq-arrow">❮</span>
          <span className="tx-jq-num">{new Intl.NumberFormat('vi-VN').format(jackpotTotal)}</span>
          <span className="tx-jq-arrow">❯</span>
        </div>
      </div>

      <div className="tx-casino-body">
        <div className="tx-top-bar">
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
            <div className="tx-side-title tx-title-tai">TỈU</div>
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
              <TriangleDice
                values={rolling ? displayDice : idleDiceValues}
                rolling={rolling}
                idle={diceInIdleMode}
              />
              {hasResultDice && !rolling && (
                <div className="tx-total-badge">{round?.total ?? '?'}</div>
              )}
            </div>
            {!rolling && isBetting && (
              <div className="tx-countdown-text">{secs2}</div>
            )}
            {isRolling && (
              <div className="tx-rolling-text">Đang lắc... {secsLeft}s</div>
            )}
            {isResult && (
              <div className="tx-result-label">Kết quả! {secsLeft}s</div>
            )}
          </div>

          <div className="tx-side-col tx-side-col--xiu">
            <div className="tx-side-title tx-title-xiu">XÀI</div>
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
            Đã đặt <strong>{round.my_bet_side === 'tai' ? 'Tỉu' : 'Xài'}</strong> —&nbsp;{fmtFull(round.my_bet_amount)}
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
          <div className="tx-footer-row">
            <span className="tx-wallet-label">Ví&nbsp;<strong>{fmt(balance)}</strong></span>
            <button
              type="button"
              className="tx-copy-btn"
              disabled={!round?.md5_hash}
              onClick={() => {
                const md5 = round?.md5_hash || '';
                if (md5) navigator.clipboard?.writeText(md5);
              }}
              title="Copy MD5 phiên hiện tại"
            >
              <span aria-hidden="true">📋</span>
              <span>COPY MD5</span>
            </button>
          </div>
          <div
            className="tx-md5-line"
            title={`MD5 phiên #${round?.round_code || '...'}\nHash 32 ký tự định danh duy nhất cho phiên, công bố ngay khi phiên mở.`}
          >
            <span className="tx-md5-prefix">MD5</span>
            {round?.md5_hash
              ? <code className="tx-md5-value">{round.md5_hash}</code>
              : <span className="tx-md5-placeholder">—</span>}
          </div>
        </div>
      </div>

      {showStakes && (
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

          {showActions && (
            <div className="tx-actions-row">
              <button className="tx-x2-btn" onClick={handleDouble} disabled={!selectedSide}>X2</button>
              <button className="tx-place-btn" onClick={handlePlaceBet} disabled={!canPlace}>
                {placing ? 'Đang đặt...' : 'ĐẶT CƯỢC'}
              </button>
              <button className="tx-cancel-btn" onClick={handleCancel}>HỦY</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
