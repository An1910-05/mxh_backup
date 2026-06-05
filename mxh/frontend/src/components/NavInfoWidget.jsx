import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Widget thông tin có thể thay đổi ở góc phải navbar.
 * 3 chế độ (bấm vào widget để đổi, lựa chọn lưu trong localStorage):
 *   - clock    : đồng hồ thế giới theo thành phố/múi giờ (client-side, Intl)
 *   - currency : tỷ giá tiền tệ về VND (open.er-api.com — miễn phí, không cần key)
 *   - gold     : giá vàng XAU/oz (api.gold-api.com — miễn phí)
 * Có chỉ báo ▲/▼ so với lần lấy dữ liệu trước (so sánh giá trị lưu trong localStorage).
 */

const PERSIST_KEY = 'ipock_info_widget';

const CLOCK_CITIES = [
  { id: 'Asia/Ho_Chi_Minh', label: 'Hà Nội' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
  { id: 'Asia/Seoul', label: 'Seoul' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Asia/Dubai', label: 'Dubai' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Europe/Paris', label: 'Paris' },
  { id: 'America/New_York', label: 'New York' },
  { id: 'America/Los_Angeles', label: 'Los Angeles' },
  { id: 'Australia/Sydney', label: 'Sydney' },
];

const CURRENCY_PAIRS = [
  { from: 'USD', label: 'USD/VND' },
  { from: 'EUR', label: 'EUR/VND' },
  { from: 'JPY', label: 'JPY/VND' },
  { from: 'GBP', label: 'GBP/VND' },
  { from: 'CNY', label: 'CNY/VND' },
  { from: 'KRW', label: 'KRW/VND' },
];

const MODES = [
  { id: 'clock', icon: '🕐', label: 'Đồng hồ' },
  { id: 'currency', icon: '💱', label: 'Tỷ giá' },
  { id: 'gold', icon: '🥇', label: 'Giá vàng' },
];

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(PERSIST_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

// So sánh giá trị mới với lần trước (lưu localStorage) → 'up' | 'down' | 'flat'.
function trackChange(key, value) {
  const k = `ipock_iw_last_${key}`;
  const prev = parseFloat(localStorage.getItem(k) || '');
  localStorage.setItem(k, String(value));
  if (!Number.isFinite(prev)) return 'flat';
  if (value > prev) return 'up';
  if (value < prev) return 'down';
  return 'flat';
}

function formatVnd(v) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: v < 100 ? 2 : 0 }).format(v);
}

export default function NavInfoWidget() {
  const saved = useMemo(loadSaved, []);
  const [mode, setMode] = useState(saved.mode || 'clock');
  const [clockTz, setClockTz] = useState(saved.clockTz || 'Asia/Ho_Chi_Minh');
  const [currencyFrom, setCurrencyFrom] = useState(saved.currencyFrom || 'USD');
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [market, setMarket] = useState(null); // { value, change }
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  // Lưu lựa chọn
  useEffect(() => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({ mode, clockTz, currencyFrom }));
  }, [mode, clockTz, currencyFrom]);

  // Đồng hồ — cập nhật mỗi giây
  useEffect(() => {
    if (mode !== 'clock') return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mode]);

  // Tỷ giá / Giá vàng — fetch + tự làm mới
  useEffect(() => {
    if (mode === 'clock') {
      setMarket(null);
      return undefined;
    }
    let cancelled = false;

    const loadCurrency = async () => {
      setLoading(true);
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const json = await res.json();
        const vnd = json?.rates?.VND;
        const fromRate = json?.rates?.[currencyFrom];
        if (vnd && fromRate) {
          const value = vnd / fromRate; // số VND cho 1 đơn vị `from`
          const change = trackChange(`cur_${currencyFrom}`, value);
          if (!cancelled) setMarket({ value, change });
        }
      } catch (err) {
        console.error('[info-widget currency]', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadGold = async () => {
      setLoading(true);
      try {
        const res = await fetch('https://api.gold-api.com/price/XAU');
        const json = await res.json();
        const price = json?.price ?? json?.rate;
        if (price) {
          const change = trackChange('gold_xau', price);
          if (!cancelled) setMarket({ value: price, change });
        }
      } catch (err) {
        console.error('[info-widget gold]', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const load = mode === 'currency' ? loadCurrency : loadGold;
    const intervalMs = mode === 'currency' ? 10 * 60 * 1000 : 5 * 60 * 1000;
    load();
    const t = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [mode, currencyFrom]);

  // Đóng popover khi bấm ra ngoài / Esc
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const display = useMemo(() => {
    if (mode === 'clock') {
      const city = CLOCK_CITIES.find((c) => c.id === clockTz) || CLOCK_CITIES[0];
      const time = new Intl.DateTimeFormat('vi-VN', {
        timeZone: city.id,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
      return { icon: '🕐', main: time, sub: city.label, change: null };
    }
    if (mode === 'currency') {
      const pair = CURRENCY_PAIRS.find((p) => p.from === currencyFrom) || CURRENCY_PAIRS[0];
      return {
        icon: '💱',
        main: market ? `${formatVnd(market.value)} ₫` : '…',
        sub: pair.label,
        change: market?.change ?? null,
      };
    }
    return {
      icon: '🥇',
      main: market ? `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(market.value)}` : '…',
      sub: 'XAU/oz',
      change: market?.change ?? null,
    };
  }, [mode, clockTz, currencyFrom, now, market]);

  const title = mode === 'clock'
    ? 'Đồng hồ thế giới — bấm để đổi'
    : mode === 'currency'
      ? 'Tỷ giá tiền tệ — bấm để đổi'
      : 'Giá vàng (XAU) — bấm để đổi';

  return (
    <div className="nav-info-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`nav-info-widget${open ? ' nav-info-widget--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={title}
      >
        <span className="nav-info-widget-icon" aria-hidden="true">{display.icon}</span>
        <span className="nav-info-widget-body">
          <span className="nav-info-widget-main">
            {display.main}
            {display.change === 'up' && <span className="nav-info-widget-change nav-info-widget-change--up" aria-hidden="true">▲</span>}
            {display.change === 'down' && <span className="nav-info-widget-change nav-info-widget-change--down" aria-hidden="true">▼</span>}
          </span>
          <span className="nav-info-widget-sub">{display.sub}{loading ? ' · …' : ''}</span>
        </span>
      </button>

      {open && (
        <div className="nav-info-popover" role="dialog" aria-label="Chọn nội dung widget">
          <div className="nav-info-popover-title">Hiển thị</div>
          <div className="nav-info-mode-row">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`nav-info-mode-btn${mode === m.id ? ' nav-info-mode-btn--active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                <span aria-hidden="true">{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {mode === 'clock' && (
            <>
              <div className="nav-info-popover-title">Thành phố</div>
              <div className="nav-info-opt-grid">
                {CLOCK_CITIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`nav-info-opt-btn${clockTz === c.id ? ' nav-info-opt-btn--active' : ''}`}
                    onClick={() => { setClockTz(c.id); setOpen(false); }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === 'currency' && (
            <>
              <div className="nav-info-popover-title">Cặp tiền tệ</div>
              <div className="nav-info-opt-grid">
                {CURRENCY_PAIRS.map((p) => (
                  <button
                    key={p.from}
                    type="button"
                    className={`nav-info-opt-btn${currencyFrom === p.from ? ' nav-info-opt-btn--active' : ''}`}
                    onClick={() => { setCurrencyFrom(p.from); setOpen(false); }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === 'gold' && (
            <p className="nav-info-popover-note">Giá vàng quốc tế XAU theo USD/ounce, tự cập nhật mỗi 5 phút.</p>
          )}
        </div>
      )}
    </div>
  );
}
