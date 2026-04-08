import { useState, useEffect } from 'react';
import {
  getTiuXaiAdminConfig, updateTiuXaiAdminConfig,
  getTiuXaiAdminSessions, getTiuXaiAdminBets
} from '../services/auth';

function fmt(n) {
  return new Intl.NumberFormat('vi-VN').format(n || 0);
}

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default function TiuXaiAdminPage() {
  const [tab, setTab] = useState('config');
  const [config, setConfig] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [bets, setBets] = useState([]);
  const [sessPage, setSessPage] = useState(1);
  const [sessTotal, setSessTotal] = useState(1);
  const [betsPage, setBetsPage] = useState(1);
  const [betsTotal, setBetsTotal] = useState(1);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadConfig(); }, []);
  useEffect(() => { if (tab === 'sessions') loadSessions(sessPage); }, [tab, sessPage]);
  useEffect(() => { if (tab === 'bets') loadBets(betsPage); }, [tab, betsPage]);

  async function loadConfig() {
    try {
      const data = await getTiuXaiAdminConfig();
      setConfig(data);
    } catch (err) { console.error(err); }
  }

  async function loadSessions(page) {
    try {
      const data = await getTiuXaiAdminSessions(page);
      setSessions(data.sessions || []);
      setSessTotal(data.total_pages || 1);
    } catch (err) { console.error(err); }
  }

  async function loadBets(page) {
    try {
      const data = await getTiuXaiAdminBets(page);
      setBets(data.bets || []);
      setBetsTotal(data.total_pages || 1);
    } catch (err) { console.error(err); }
  }

  async function handleSaveConfig(e) {
    e.preventDefault();
    setLoading(true); setSaveMsg(''); setSaveErr('');
    try {
      await updateTiuXaiAdminConfig(config);
      setSaveMsg('Đã lưu cấu hình');
    } catch (err) {
      setSaveErr(err.message || 'Lỗi lưu cấu hình');
    } finally { setLoading(false); }
  }

  const tabs = [
    { key: 'config', label: 'Cấu hình' },
    { key: 'sessions', label: 'Lịch sử phiên' },
    { key: 'bets', label: 'Lịch sử cược' },
  ];

  return (
    <div className="apple-main fade-in">
      <div className="settings-page">
        <div className="settings-container">
          <aside className="settings-sidebar">
            <h2 className="settings-sidebar-title">Quản trị Tỉu Xài</h2>
            <nav className="settings-nav">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`settings-nav-item${tab === t.key ? ' settings-nav-item--active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  <span className="settings-nav-label">{t.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <main className="settings-content">
            {tab === 'config' && config && (
              <div className="settings-section">
                <div className="settings-section-header">
                  <h3 className="settings-section-title">Cấu hình game</h3>
                </div>
                {saveMsg && <div className="apple-alert apple-alert-success settings-alert">{saveMsg}</div>}
                {saveErr && <div className="apple-alert apple-alert-danger settings-alert">{saveErr}</div>}

                <div className="tx-admin-jackpot-pool">
                  Quỹ Jackpot hiện tại: <strong>{fmt(config.jackpot_pool)} VND</strong>
                </div>

                <form className="settings-form" onSubmit={handleSaveConfig}>
                  {[
                    { key: 'bet_duration',        label: 'Thời gian cược (giây)',     min: 10, max: 120 },
                    { key: 'min_bet',             label: 'Cược tối thiểu (VND)',      min: 1000 },
                    { key: 'max_bet',             label: 'Cược tối đa (VND)',         min: 10000 },
                    { key: 'win_multiplier',      label: 'Hệ số thắng (×100, vd 195=1.95x)', min: 100, max: 300 },
                    { key: 'jackpot_contrib_pct', label: 'Đóng góp Jackpot (%)',      min: 0, max: 10 },
                    { key: 'jackpot_min_pool',    label: 'Mức reset Jackpot (VND)',   min: 0 },
                  ].map(({ key, label, min, max }) => (
                    <div key={key} className="settings-row">
                      <label className="settings-label">{label}</label>
                      <div className="settings-value">
                        <input
                          type="number"
                          className="settings-input"
                          value={config[key] ?? ''}
                          min={min}
                          max={max}
                          onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="settings-actions">
                    <button type="submit" className="settings-btn settings-btn--primary" disabled={loading}>
                      {loading ? <span className="apple-spinner" /> : null} Lưu cấu hình
                    </button>
                  </div>
                </form>
              </div>
            )}

            {tab === 'sessions' && (
              <div className="settings-section">
                <div className="settings-section-header">
                  <h3 className="settings-section-title">Lịch sử phiên</h3>
                </div>
                <div className="tx-admin-table-wrap">
                  <table className="tx-admin-table">
                    <thead>
                      <tr>
                        <th>Phiên</th><th>Xúc xắc</th><th>Tổng</th><th>Kết quả</th>
                        <th>Cược Tỉu</th><th>Cược Xài</th><th>JP</th><th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id}>
                          <td>#{s.id}</td>
                          <td>{s.dice1 ? `${DICE_FACES[s.dice1]}${DICE_FACES[s.dice2]}${DICE_FACES[s.dice3]}` : '—'}</td>
                          <td>{s.total_points ?? '—'}</td>
                          <td className={s.result === 'xai' ? 'tx-red' : ''}>
                            {s.result ? (s.result === 'xai' ? 'XÀI' : 'TỈUU') : '—'}
                          </td>
                          <td>{fmt(s.total_bet_tiu)}</td>
                          <td>{fmt(s.total_bet_xai)}</td>
                          <td>{s.is_jackpot ? '🎊' : ''}</td>
                          <td>{s.reward_processed ? '✓ Xong' : '⏳'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="tx-admin-pagination">
                  <button disabled={sessPage <= 1} onClick={() => setSessPage(p => p - 1)}>◀ Trước</button>
                  <span>Trang {sessPage} / {sessTotal}</span>
                  <button disabled={sessPage >= sessTotal} onClick={() => setSessPage(p => p + 1)}>Sau ▶</button>
                </div>
              </div>
            )}

            {tab === 'bets' && (
              <div className="settings-section">
                <div className="settings-section-header">
                  <h3 className="settings-section-title">Lịch sử cược</h3>
                </div>
                <div className="tx-admin-table-wrap">
                  <table className="tx-admin-table">
                    <thead>
                      <tr>
                        <th>Phiên</th><th>Người chơi</th><th>Cửa</th><th>Cược</th>
                        <th>Thắng</th><th>Trạng thái</th><th>Kết quả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bets.map((b) => (
                        <tr key={b.id}>
                          <td>#{b.session_id}</td>
                          <td>{b.username}</td>
                          <td className={b.side === 'xai' ? 'tx-red' : ''}>{b.side === 'tiu' ? 'TỈUU' : 'XÀI'}</td>
                          <td>{fmt(b.amount)}</td>
                          <td className={b.status === 'won' ? 'tx-green' : 'tx-red'}>
                            {b.status === 'won' ? `+${fmt(b.win_amount)}` : b.status === 'lost' ? '0' : '—'}
                          </td>
                          <td>{b.status === 'won' ? '✓ Thắng' : b.status === 'lost' ? '✗ Thua' : '⏳'}</td>
                          <td>{b.result ? (b.result === 'xai' ? 'XÀI' : 'TỈUU') + ' ' + b.total_points : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="tx-admin-pagination">
                  <button disabled={betsPage <= 1} onClick={() => setBetsPage(p => p - 1)}>◀ Trước</button>
                  <span>Trang {betsPage} / {betsTotal}</span>
                  <button disabled={betsPage >= betsTotal} onClick={() => setBetsPage(p => p + 1)}>Sau ▶</button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
