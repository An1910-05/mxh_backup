import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_ORIGIN } from '../config';

function mediaUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`;
}
import {
  caroCreateRoom,
  caroJoinByCode,
  caroLeaveRoom,
  caroMakeMove,
  caroRandomMatch,
  getCaroMyActiveRooms,
  getCaroMyHistory,
  getCaroPublicRooms,
  getCaroRoom,
} from '../services/graphql';

const DEFAULT_BOARD_SIZE = 15;
const DEFAULT_WIN_LENGTH = 5;
const POLL_INTERVAL_MS = 1500;

/* ──────────────────────────────────────────────
   Helpers — board / win check (dùng chung cho local + AI)
   ────────────────────────────────────────────── */

function emptyOccupiedMap() { return new Map(); }
function keyOf(r, c) { return `${r}:${c}`; }

function checkWin(occupied, row, col, symbol, winLength, boardSize) {
  const directions = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of directions) {
    let count = 1;
    let r = row + dr, c = col + dc;
    while (r >= 0 && c >= 0 && r < boardSize && c < boardSize && occupied.get(keyOf(r,c)) === symbol) {
      count++; r += dr; c += dc;
    }
    r = row - dr; c = col - dc;
    while (r >= 0 && c >= 0 && r < boardSize && c < boardSize && occupied.get(keyOf(r,c)) === symbol) {
      count++; r -= dr; c -= dc;
    }
    if (count >= winLength) return true;
  }
  return false;
}

/* AI heuristic đơn giản: chấm điểm các ô trống lân cận quân hiện có */
function aiPickMove(occupied, boardSize, winLength, aiSymbol) {
  if (occupied.size === 0) {
    const mid = Math.floor(boardSize / 2);
    return { row: mid, col: mid };
  }
  const opp = aiSymbol === 'X' ? 'O' : 'X';
  const candidates = new Set();
  for (const k of occupied.keys()) {
    const [r, c] = k.split(':').map(Number);
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= boardSize || nc >= boardSize) continue;
        if (occupied.has(keyOf(nr, nc))) continue;
        candidates.add(keyOf(nr, nc));
      }
    }
  }
  if (candidates.size === 0) {
    const mid = Math.floor(boardSize / 2);
    return { row: mid, col: mid };
  }

  let bestScore = -Infinity;
  let bestMove = null;
  for (const k of candidates) {
    const [r, c] = k.split(':').map(Number);
    const score = scoreCell(occupied, r, c, aiSymbol, opp, boardSize, winLength);
    if (score > bestScore) {
      bestScore = score;
      bestMove = { row: r, col: c };
    }
  }
  return bestMove;
}

function scoreCell(occupied, row, col, me, opp, boardSize, winLength) {
  const directions = [[0,1],[1,0],[1,1],[1,-1]];
  let total = 0;
  for (const [dr, dc] of directions) {
    total += linePotential(occupied, row, col, dr, dc, me, opp, boardSize, winLength, true);
    total += linePotential(occupied, row, col, dr, dc, opp, me, boardSize, winLength, false) * 0.95;
  }
  // Ưu tiên trung tâm nhẹ để tránh đánh sát mép
  const mid = (boardSize - 1) / 2;
  total -= (Math.abs(row - mid) + Math.abs(col - mid)) * 0.5;
  return total;
}

function linePotential(occupied, row, col, dr, dc, sym, other, boardSize, winLength, attacking) {
  // Đếm số quân sym liên tiếp 2 phía + có bị chặn không
  let count = 1; // ô đang xét (giả định đặt sym)
  let openLeft = false, openRight = false;

  let r = row + dr, c = col + dc;
  while (r >= 0 && c >= 0 && r < boardSize && c < boardSize) {
    const v = occupied.get(keyOf(r,c));
    if (v === sym) { count++; r += dr; c += dc; continue; }
    openRight = (v === undefined);
    break;
  }
  r = row - dr; c = col - dc;
  while (r >= 0 && c >= 0 && r < boardSize && c < boardSize) {
    const v = occupied.get(keyOf(r,c));
    if (v === sym) { count++; r -= dr; c -= dc; continue; }
    openLeft = (v === undefined);
    break;
  }
  if (count >= winLength) return attacking ? 1_000_000 : 950_000;
  if (count === winLength - 1) {
    if (openLeft && openRight) return attacking ? 80_000 : 70_000;
    if (openLeft || openRight) return attacking ? 8_000 : 7_000;
    return 0;
  }
  if (count === winLength - 2) {
    if (openLeft && openRight) return attacking ? 1_000 : 800;
    if (openLeft || openRight) return attacking ? 200 : 150;
    return 0;
  }
  if (count === winLength - 3) {
    if (openLeft && openRight) return attacking ? 50 : 40;
    return 5;
  }
  return 0;
}

/* ──────────────────────────────────────────────
   Bàn cờ — component dùng chung
   ────────────────────────────────────────────── */

function CaroBoard({ boardSize, moves, onCellClick, disabled, lastMove, winnerLine, mySymbol }) {
  const occupied = useMemo(() => {
    const m = new Map();
    (moves || []).forEach(mv => m.set(keyOf(mv.r, mv.c), mv.s));
    return m;
  }, [moves]);

  const rows = [];
  for (let r = 0; r < boardSize; r++) {
    const cells = [];
    for (let c = 0; c < boardSize; c++) {
      const sym = occupied.get(keyOf(r, c));
      const isLast = lastMove && lastMove.r === r && lastMove.c === c;
      const cellClass = [
        'caro-cell',
        sym ? `caro-cell--${sym.toLowerCase()}` : '',
        isLast ? 'caro-cell--last' : '',
        disabled || sym ? 'caro-cell--disabled' : '',
      ].filter(Boolean).join(' ');
      cells.push(
        <button
          key={c}
          className={cellClass}
          disabled={disabled || !!sym}
          onClick={() => !sym && !disabled && onCellClick(r, c)}
        >
          {sym === 'X' ? <span className="caro-x">✕</span> : sym === 'O' ? <span className="caro-o">○</span> : null}
        </button>
      );
    }
    rows.push(<div key={r} className="caro-row">{cells}</div>);
  }

  return (
    <div className="caro-board-wrap">
      <div className="caro-board">
        {rows}
      </div>
      {mySymbol && (
        <div className="caro-board-foot">
          Bạn đang chơi quân <strong>{mySymbol === 'X' ? '✕ (X)' : '○ (O)'}</strong>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Local mode (2 người 1 máy)
   ────────────────────────────────────────────── */

function LocalGame({ onExit }) {
  const [moves, setMoves] = useState([]);
  const [turn, setTurn] = useState('X');
  const [winner, setWinner] = useState(null);
  const boardSize = DEFAULT_BOARD_SIZE;

  const handleClick = (r, c) => {
    if (winner) return;
    const occupied = new Map(moves.map(m => [keyOf(m.r, m.c), m.s]));
    if (occupied.has(keyOf(r, c))) return;
    const newMove = { r, c, s: turn };
    const nextMoves = [...moves, newMove];
    occupied.set(keyOf(r, c), turn);
    if (checkWin(occupied, r, c, turn, DEFAULT_WIN_LENGTH, boardSize)) {
      setWinner(turn);
    } else if (nextMoves.length === boardSize * boardSize) {
      setWinner('draw');
    } else {
      setTurn(turn === 'X' ? 'O' : 'X');
    }
    setMoves(nextMoves);
  };

  const reset = () => { setMoves([]); setTurn('X'); setWinner(null); };
  const lastMove = moves[moves.length - 1];

  return (
    <div className="caro-game-wrap">
      <div className="caro-game-header">
        <button className="caro-back-btn" onClick={onExit}>← Thoát</button>
        <div className="caro-game-title">
          <strong>Chơi 2 người trên 1 máy</strong>
          <span>Lần lượt click ô để đánh quân</span>
        </div>
        <button className="caro-secondary-btn" onClick={reset}>Bàn mới</button>
      </div>
      <div className="caro-status">
        {winner === 'draw' && <div className="caro-banner caro-banner--draw">Hòa</div>}
        {winner === 'X' && <div className="caro-banner caro-banner--x">Quân ✕ (X) thắng</div>}
        {winner === 'O' && <div className="caro-banner caro-banner--o">Quân ○ (O) thắng</div>}
        {!winner && <div className="caro-banner">Lượt: <strong>{turn === 'X' ? '✕ (X)' : '○ (O)'}</strong></div>}
      </div>
      <CaroBoard
        boardSize={boardSize}
        moves={moves}
        onCellClick={handleClick}
        disabled={!!winner}
        lastMove={lastMove}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────
   AI mode (vs máy)
   ────────────────────────────────────────────── */

function AIGame({ onExit }) {
  const boardSize = DEFAULT_BOARD_SIZE;
  const [moves, setMoves] = useState([]);
  const [turn, setTurn] = useState('X'); // X = player, O = AI
  const [winner, setWinner] = useState(null);
  const [aiThinking, setAiThinking] = useState(false);

  // Khi tới lượt AI, suy nghĩ 400ms rồi đánh
  useEffect(() => {
    if (winner) return;
    if (turn !== 'O') return;
    setAiThinking(true);
    const timer = setTimeout(() => {
      const occupied = new Map(moves.map(m => [keyOf(m.r, m.c), m.s]));
      const pick = aiPickMove(occupied, boardSize, DEFAULT_WIN_LENGTH, 'O');
      if (!pick) { setAiThinking(false); return; }
      const newMove = { r: pick.row, c: pick.col, s: 'O' };
      const nextMoves = [...moves, newMove];
      occupied.set(keyOf(pick.row, pick.col), 'O');
      if (checkWin(occupied, pick.row, pick.col, 'O', DEFAULT_WIN_LENGTH, boardSize)) {
        setWinner('O');
      } else if (nextMoves.length === boardSize * boardSize) {
        setWinner('draw');
      } else {
        setTurn('X');
      }
      setMoves(nextMoves);
      setAiThinking(false);
    }, 380);
    return () => clearTimeout(timer);
  }, [turn, winner, moves]);

  const handleClick = (r, c) => {
    if (winner || turn !== 'X') return;
    const occupied = new Map(moves.map(m => [keyOf(m.r, m.c), m.s]));
    if (occupied.has(keyOf(r, c))) return;
    const newMove = { r, c, s: 'X' };
    const nextMoves = [...moves, newMove];
    occupied.set(keyOf(r, c), 'X');
    if (checkWin(occupied, r, c, 'X', DEFAULT_WIN_LENGTH, boardSize)) {
      setWinner('X');
    } else if (nextMoves.length === boardSize * boardSize) {
      setWinner('draw');
    } else {
      setTurn('O');
    }
    setMoves(nextMoves);
  };

  const reset = () => { setMoves([]); setTurn('X'); setWinner(null); };
  const lastMove = moves[moves.length - 1];

  return (
    <div className="caro-game-wrap">
      <div className="caro-game-header">
        <button className="caro-back-btn" onClick={onExit}>← Thoát</button>
        <div className="caro-game-title">
          <strong>Chơi với máy</strong>
          <span>Bạn cầm quân ✕, máy cầm quân ○</span>
        </div>
        <button className="caro-secondary-btn" onClick={reset}>Bàn mới</button>
      </div>
      <div className="caro-status">
        {winner === 'draw' && <div className="caro-banner caro-banner--draw">Hòa</div>}
        {winner === 'X' && <div className="caro-banner caro-banner--win">Bạn thắng 🎉</div>}
        {winner === 'O' && <div className="caro-banner caro-banner--lose">Máy thắng</div>}
        {!winner && (
          <div className="caro-banner">
            {turn === 'X' ? 'Lượt của bạn' : <em>{aiThinking ? 'Máy đang suy nghĩ…' : 'Máy chuẩn bị đi'}</em>}
          </div>
        )}
      </div>
      <CaroBoard
        boardSize={boardSize}
        moves={moves}
        onCellClick={handleClick}
        disabled={!!winner || turn !== 'X'}
        lastMove={lastMove}
        mySymbol="X"
      />
    </div>
  );
}

/* ──────────────────────────────────────────────
   Online game — poll backend
   ────────────────────────────────────────────── */

function OnlineGame({ roomId, onExit }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const r = await getCaroRoom(roomId);
      setRoom(r);
      setError('');
    } catch (err) {
      console.error('refresh caro room failed', err);
      setError(err?.message || 'Không tải được phòng');
    }
  }, [roomId]);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  // Tạm dừng poll khi tab bị ẩn
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        clearInterval(timerRef.current);
      } else {
        refresh();
        timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  // Cảnh báo khi đóng/reload tab nếu đang chơi
  useEffect(() => {
    if (room?.status !== 'playing') return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = 'Bạn đang trong trận. Thoát sẽ bị xử thua.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [room?.status]);

  const handleCell = async (r, c) => {
    if (!room || submitting) return;
    if (room.status !== 'playing' || !room.is_my_turn) return;
    setSubmitting(true);
    try {
      const updated = await caroMakeMove(room.id, r, c);
      setRoom(updated);
    } catch (err) {
      console.error('makeMove failed', err);
      setError(err?.message || 'Đánh quân thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (!room || leaving) return;
    const confirmed = window.confirm(
      room.status === 'playing'
        ? 'Rời phòng đồng nghĩa bạn xin thua trận này. Tiếp tục?'
        : 'Rời phòng?'
    );
    if (!confirmed) return;
    setLeaving(true);
    try {
      await caroLeaveRoom(room.id);
    } catch (err) {
      console.error('leave failed', err);
    } finally {
      setLeaving(false);
      onExit();
    }
  };

  const copyCode = async () => {
    if (!room) return;
    try { await navigator.clipboard.writeText(room.code); } catch (_) { /* ignore */ }
  };

  if (!room) {
    return (
      <div className="caro-game-wrap">
        <div className="caro-game-header">
          <button className="caro-back-btn" onClick={onExit}>← Thoát</button>
          <div className="caro-game-title"><strong>Đang tải phòng…</strong></div>
        </div>
        {error && <div className="caro-error">{error}</div>}
      </div>
    );
  }

  const lastMove = (room.moves || [])[(room.moves || []).length - 1];
  const isMe = (id) => id && user && Number(user.id) === Number(id);
  const opponent = room.opponent;
  const creator = room.creator;
  const waitingForOpponent = room.status === 'waiting' && !opponent;
  const myId = Number(user?.id || 0);

  let statusBanner = null;
  if (room.status === 'waiting') {
    statusBanner = <div className="caro-banner">Đang chờ đối thủ vào phòng… Chia sẻ mã <strong>{room.code}</strong> cho bạn bè.</div>;
  } else if (room.status === 'playing') {
    statusBanner = (
      <div className="caro-banner">
        {room.is_my_turn ? 'Lượt của bạn' : `Đang đợi ${room.current_turn === 'X' ? creator?.username : opponent?.username || 'đối thủ'}…`}
      </div>
    );
  } else if (room.status === 'finished' || room.status === 'abandoned') {
    if (room.winner_symbol === 'draw') {
      statusBanner = <div className="caro-banner caro-banner--draw">Hòa</div>;
    } else if (room.winner_user_id === myId) {
      statusBanner = <div className="caro-banner caro-banner--win">Bạn thắng 🎉</div>;
    } else if (room.winner_user_id) {
      statusBanner = <div className="caro-banner caro-banner--lose">Bạn thua</div>;
    } else {
      statusBanner = <div className="caro-banner">Trận đã kết thúc</div>;
    }
  }

  return (
    <div className="caro-game-wrap">
      <div className="caro-game-header">
        <button className="caro-back-btn" onClick={onExit}>← Sảnh</button>
        <div className="caro-game-title">
          <strong>{room.name || 'Phòng Caro'}</strong>
          <span>
            Mã phòng: <code className="caro-code" onClick={copyCode}>{room.code}</code>{' '}
            <button type="button" className="caro-mini-link" onClick={copyCode}>Sao chép</button>
            {room.has_password && ' · 🔒'}
          </span>
        </div>
        <button className="caro-danger-btn" onClick={handleLeave} disabled={leaving}>
          {leaving ? 'Đang rời…' : (room.status === 'playing' ? 'Xin thua' : 'Rời')}
        </button>
      </div>

      <div className="caro-players">
        <div className={`caro-player ${room.current_turn === 'X' && room.status === 'playing' ? 'caro-player--active' : ''}`}>
          <div className="caro-player-avatar">
            {creator?.avatar ? <img src={mediaUrl(creator.avatar)} alt="" /> : <span>?</span>}
          </div>
          <div className="caro-player-info">
            <strong>{creator?.username || 'Người chơi 1'}</strong>
            <span>Quân ✕ (X){isMe(creator?.id) ? ' · Bạn' : ''}</span>
          </div>
        </div>
        <div className="caro-vs">VS</div>
        <div className={`caro-player ${room.current_turn === 'O' && room.status === 'playing' ? 'caro-player--active' : ''}`}>
          <div className="caro-player-avatar">
            {opponent?.avatar ? <img src={mediaUrl(opponent.avatar)} alt="" /> : <span>?</span>}
          </div>
          <div className="caro-player-info">
            <strong>{opponent?.username || (waitingForOpponent ? 'Đang chờ…' : 'Người chơi 2')}</strong>
            <span>Quân ○ (O){isMe(opponent?.id) ? ' · Bạn' : ''}</span>
          </div>
        </div>
      </div>

      <div className="caro-status">{statusBanner}</div>
      {error && <div className="caro-error">{error}</div>}

      <CaroBoard
        boardSize={room.board_size}
        moves={room.moves || []}
        onCellClick={handleCell}
        disabled={
          submitting ||
          room.status !== 'playing' ||
          !room.is_my_turn ||
          !room.viewer_symbol
        }
        lastMove={lastMove}
        mySymbol={room.viewer_symbol}
      />

      {(room.status === 'finished' || room.status === 'abandoned') && (
        <div className="caro-postgame">
          <button className="caro-primary-btn" onClick={() => navigate('/games/caro')}>
            Về sảnh
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Modals (Tạo phòng / Vào bằng mã)
   ────────────────────────────────────────────── */

function CreateRoomModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setName(''); setVisibility('private'); setPassword(''); setError(''); }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const room = await caroCreateRoom({
        name: name.trim() || null,
        visibility,
        password: password.trim() || null,
      });
      onCreated(room);
    } catch (err) {
      console.error('create room failed', err);
      setError(err?.message || 'Tạo phòng thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="caro-modal-backdrop" onClick={onClose}>
      <form className="caro-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Tạo phòng mới</h3>
        <label className="caro-field">
          <span>Tên phòng (tuỳ chọn)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Ví dụ: Caro tối nay" />
        </label>
        <div className="caro-field">
          <span>Loại phòng</span>
          <div className="caro-radio-row">
            <label>
              <input type="radio" name="vis" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} />
              Riêng tư (chỉ chia sẻ mã)
            </label>
            <label>
              <input type="radio" name="vis" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} />
              Công khai (hiện trong sảnh)
            </label>
          </div>
        </div>
        <label className="caro-field">
          <span>Mật khẩu (tuỳ chọn)</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={32}
            placeholder="Để trống nếu không cần"
          />
          <small>Người khác phải nhập mật khẩu này để vào phòng.</small>
        </label>
        {error && <div className="caro-error">{error}</div>}
        <div className="caro-modal-actions">
          <button type="button" className="caro-secondary-btn" onClick={onClose}>Huỷ</button>
          <button type="submit" className="caro-primary-btn" disabled={submitting}>
            {submitting ? 'Đang tạo…' : 'Tạo phòng'}
          </button>
        </div>
      </form>
    </div>
  );
}

function JoinCodeModal({ open, onClose, onJoined, initialCode = '' }) {
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setCode(initialCode); setPassword(''); setError(''); setNeedsPassword(false); }
  }, [open, initialCode]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const room = await caroJoinByCode(code.trim().toUpperCase(), password || null);
      onJoined(room);
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('Mật khẩu')) setNeedsPassword(true);
      setError(msg || 'Vào phòng thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="caro-modal-backdrop" onClick={onClose}>
      <form className="caro-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Vào phòng bằng mã</h3>
        <label className="caro-field">
          <span>Mã phòng</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VD: A2B5C9"
            maxLength={10}
            required
            autoFocus
          />
        </label>
        <label className="caro-field">
          <span>Mật khẩu {needsPassword && <em>(bắt buộc với phòng này)</em>}</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Chỉ nhập nếu phòng có khoá"
            maxLength={32}
          />
        </label>
        {error && <div className="caro-error">{error}</div>}
        <div className="caro-modal-actions">
          <button type="button" className="caro-secondary-btn" onClick={onClose}>Huỷ</button>
          <button type="submit" className="caro-primary-btn" disabled={submitting || !code.trim()}>
            {submitting ? 'Đang vào…' : 'Vào phòng'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Lobby — sảnh chính
   ────────────────────────────────────────────── */

function Lobby({ onPickMode, onEnterRoom }) {
  const navigate = useNavigate();
  const [activeRooms, setActiveRooms] = useState([]);
  const [publicRooms, setPublicRooms] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinPrefill, setJoinPrefill] = useState('');
  const [matching, setMatching] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [active, pub, hist] = await Promise.all([
        getCaroMyActiveRooms(10),
        getCaroPublicRooms(30),
        getCaroMyHistory(8),
      ]);
      setActiveRooms(active || []);
      setPublicRooms(pub || []);
      setHistory(hist || []);
      setError('');
    } catch (err) {
      console.error('lobby load failed', err);
      setError(err?.message || 'Không tải được sảnh');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleRandom = async () => {
    setMatching(true);
    try {
      const room = await caroRandomMatch();
      onEnterRoom(room);
    } catch (err) {
      console.error('random match failed', err);
      setError(err?.message || 'Ghép trận thất bại');
    } finally {
      setMatching(false);
    }
  };

  const enterPublic = async (room) => {
    if (room.has_password) {
      setJoinPrefill(room.code);
      setShowJoin(true);
      return;
    }
    try {
      const joined = await caroJoinByCode(room.code, null);
      onEnterRoom(joined);
    } catch (err) {
      setError(err?.message || 'Vào phòng thất bại');
    }
  };

  return (
    <div className="caro-lobby">
      <div className="caro-lobby-header">
        <button className="caro-back-btn" onClick={() => navigate('/games')}>← Trò chơi</button>
        <div>
          <h1>Cờ Caro</h1>
          <p>5 quân liên tiếp để thắng. Chơi cùng bạn bè hoặc ghép ngẫu nhiên.</p>
        </div>
      </div>

      {error && <div className="caro-error">{error}</div>}

      <div className="caro-actions-grid">
        <button className="caro-action-card caro-action-card--primary" onClick={() => setShowCreate(true)}>
          <span className="caro-action-icon">＋</span>
          <strong>Tạo phòng</strong>
          <small>Nhận mã 6 ký tự, chia sẻ cho bạn bè. Có thể đặt mật khẩu.</small>
        </button>
        <button className="caro-action-card" onClick={() => { setJoinPrefill(''); setShowJoin(true); }}>
          <span className="caro-action-icon">🔑</span>
          <strong>Vào bằng mã</strong>
          <small>Nhập mã phòng (và mật khẩu nếu có) để tham gia.</small>
        </button>
        <button className="caro-action-card" onClick={handleRandom} disabled={matching}>
          <span className="caro-action-icon">🎯</span>
          <strong>{matching ? 'Đang ghép…' : 'Ghép ngẫu nhiên'}</strong>
          <small>Ghép với người chơi khác đang chờ.</small>
        </button>
        <button className="caro-action-card" onClick={() => onPickMode('local')}>
          <span className="caro-action-icon">👥</span>
          <strong>2 người 1 máy</strong>
          <small>Lần lượt cùng nhau trên cùng thiết bị.</small>
        </button>
        <button className="caro-action-card" onClick={() => onPickMode('ai')}>
          <span className="caro-action-icon">🤖</span>
          <strong>Chơi với máy</strong>
          <small>Đối thủ AI ngay trên trình duyệt.</small>
        </button>
      </div>

      {activeRooms.length > 0 && (
        <div className="caro-section">
          <h2>Phòng của bạn</h2>
          <ul className="caro-room-list">
            {activeRooms.map(r => (
              <li key={r.id} className="caro-room-item" onClick={() => onEnterRoom(r)}>
                <div className="caro-room-meta">
                  <strong>{r.name || 'Phòng caro'}</strong>
                  <span>
                    Mã <code>{r.code}</code>
                    {r.has_password && ' · 🔒'}
                    {' · '}
                    {r.status === 'waiting' ? 'Đang chờ đối thủ' : 'Đang chơi'}
                  </span>
                </div>
                <span className="caro-room-cta">Tiếp tục →</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="caro-section">
        <h2>Phòng công khai</h2>
        {loading && !publicRooms.length ? (
          <p className="caro-muted">Đang tải…</p>
        ) : publicRooms.length === 0 ? (
          <p className="caro-muted">Chưa có phòng công khai nào đang chờ.</p>
        ) : (
          <ul className="caro-room-list">
            {publicRooms.map(r => (
              <li key={r.id} className="caro-room-item" onClick={() => enterPublic(r)}>
                <div className="caro-room-meta">
                  <strong>{r.name || (r.is_matchmaking ? 'Ghép trận ngẫu nhiên' : 'Phòng caro')}</strong>
                  <span>
                    Chủ phòng: {r.creator?.username || 'Ẩn danh'}
                    {' · '}Mã <code>{r.code}</code>
                    {r.has_password && ' · 🔒'}
                  </span>
                </div>
                <span className="caro-room-cta">Vào →</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {history.length > 0 && (
        <div className="caro-section">
          <h2>Trận đã chơi</h2>
          <ul className="caro-room-list caro-room-list--history">
            {history.map(r => {
              const won = r.winner_user_id && r.creator && r.opponent &&
                (r.viewer_symbol && r.winner_symbol === r.viewer_symbol);
              const draw = r.winner_symbol === 'draw';
              return (
                <li key={r.id} className="caro-room-item caro-room-item--history">
                  <div className="caro-room-meta">
                    <strong>{r.creator?.username || '?'} vs {r.opponent?.username || '?'}</strong>
                    <span>Mã {r.code} · {r.move_count} nước · {draw ? 'Hòa' : (won ? 'Bạn thắng' : 'Bạn thua')}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <CreateRoomModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={(r) => { setShowCreate(false); onEnterRoom(r); }} />
      <JoinCodeModal open={showJoin} onClose={() => setShowJoin(false)} onJoined={(r) => { setShowJoin(false); onEnterRoom(r); }} initialCode={joinPrefill} />
    </div>
  );
}

/* ──────────────────────────────────────────────
   Page entry
   ────────────────────────────────────────────── */

export default function CaroPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // null | 'local' | 'ai'

  useEffect(() => { setMode(null); }, [roomId]);

  // Khi đang ở trong UI game (online/local/AI), ẩn navbar + sidebar.
  // Bằng cách thêm class `caro-game-active` vào body để CSS scope-hide.
  const inGameUI = Boolean(roomId) || mode === 'local' || mode === 'ai';
  useEffect(() => {
    if (!inGameUI) return;
    document.body.classList.add('caro-game-active');
    return () => document.body.classList.remove('caro-game-active');
  }, [inGameUI]);

  const goLobby = () => { setMode(null); navigate('/games/caro'); };
  const enterRoom = (room) => navigate(`/games/caro/${room.id}`);

  if (roomId) {
    return (
      <div className="apple-main fade-in">
        <OnlineGame roomId={Number(roomId)} onExit={goLobby} />
      </div>
    );
  }
  if (mode === 'local') {
    return (
      <div className="apple-main fade-in">
        <LocalGame onExit={goLobby} />
      </div>
    );
  }
  if (mode === 'ai') {
    return (
      <div className="apple-main fade-in">
        <AIGame onExit={goLobby} />
      </div>
    );
  }
  return (
    <div className="apple-main fade-in">
      <Lobby onPickMode={setMode} onEnterRoom={enterRoom} />
    </div>
  );
}
