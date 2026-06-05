import { useEffect, useState, useCallback, useRef } from 'react';
import { API_ORIGIN } from '../../config';

const DEFAULT_AVATAR = '/default-avatar.png';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

function formatVND(n) {
  const num = Number(n);
  const formatted = new Intl.NumberFormat('vi-VN').format(Math.abs(num));
  return (num < 0 ? '-' : '') + formatted + 'đ';
}

const STATUS_LABEL = {
  success: { label: 'Thành công', cls: 'adm-status-badge--active' },
  pending: { label: 'Chờ xử lý', cls: 'adm-status-badge--pending' },
  failed:  { label: 'Thất bại',  cls: 'adm-status-badge--blocked' },
};

const PROVIDER_LABEL = {
  vnpay: 'VNPay',
  momo:  'MoMo',
  admin: 'Admin',
};

// ── Balance Adjust Modal ──────────────────────────────────────────────────────
function AdjustModal({ onClose, onDone }) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [selected, setSelected]   = useState(null);
  const [type, setType]           = useState('add');  // 'add' | 'sub'
  const [amount, setAmount]       = useState('');
  const [desc, setDesc]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const searchTimer = useRef(null);

  const searchUsers = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    try {
      const r = await fetch(`${API_ORIGIN}/admin/users?search=${encodeURIComponent(q)}&page=1`, { headers: authHeaders() });
      const d = await r.json();
      setResults(d.data?.users?.slice(0, 6) ?? []);
    } catch { setResults([]); }
  }, []);

  const handleQueryChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setSelected(null);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchUsers(v), 250);
  };

  const pick = (u) => {
    setSelected(u);
    setQuery(u.username);
    setResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) { setError('Chưa chọn người dùng'); return; }
    const rawAmount = parseInt(amount, 10);
    if (!rawAmount || rawAmount <= 0) { setError('Số tiền phải lớn hơn 0'); return; }
    const finalAmount = type === 'sub' ? -rawAmount : rawAmount;

    setSubmitting(true); setError(''); setSuccess('');
    try {
      const r = await fetch(`${API_ORIGIN}/admin/wallet/adjust`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selected.id, amount: finalAmount, description: desc.trim() || undefined }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || 'Thất bại');
      const sign = finalAmount > 0 ? '+' : '';
      setSuccess(`${sign}${formatVND(finalAmount)} cho @${d.data.username}. Số dư mới: ${formatVND(d.data.new_balance)}`);
      setAmount(''); setDesc('');
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="adm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="adm-modal">
        <div className="adm-modal-header">
          <h3 className="adm-modal-title">Điều chỉnh số dư</h3>
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="adm-modal-body" onSubmit={handleSubmit}>
          {/* User search */}
          <div className="adm-form-group">
            <label className="adm-form-label">Người dùng</label>
            <div style={{ position: 'relative' }}>
              <input
                className="adm-form-input"
                placeholder="Tìm theo username..."
                value={query}
                onChange={handleQueryChange}
                autoComplete="off"
              />
              {results.length > 0 && (
                <div className="adm-user-dropdown">
                  {results.map(u => (
                    <button
                      type="button"
                      key={u.id}
                      className="adm-user-dropdown-item"
                      onClick={() => pick(u)}
                    >
                      <img className="adm-user-avatar" src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR} alt="" />
                      <span>{u.username}</span>
                      <span className="adm-user-dropdown-id">#{u.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selected && (
              <div className="adm-selected-user">
                <img className="adm-user-avatar" src={selected.avatar ? `${API_ORIGIN}${selected.avatar}` : DEFAULT_AVATAR} alt="" />
                <span>{selected.username} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>#{selected.id}</span></span>
              </div>
            )}
          </div>

          {/* Type toggle */}
          <div className="adm-form-group">
            <label className="adm-form-label">Loại</label>
            <div className="adm-type-toggle">
              <button
                type="button"
                className={`adm-type-btn adm-type-btn--add${type === 'add' ? ' active' : ''}`}
                onClick={() => setType('add')}
              >
                + Cộng tiền
              </button>
              <button
                type="button"
                className={`adm-type-btn adm-type-btn--sub${type === 'sub' ? ' active' : ''}`}
                onClick={() => setType('sub')}
              >
                − Trừ tiền
              </button>
            </div>
          </div>

          {/* Amount */}
          <div className="adm-form-group">
            <label className="adm-form-label">Số tiền (VND)</label>
            <input
              className="adm-form-input"
              type="number"
              min="1"
              step="1"
              placeholder="Ví dụ: 50000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="adm-form-group">
            <label className="adm-form-label">Mô tả (tuỳ chọn)</label>
            <input
              className="adm-form-input"
              placeholder={type === 'add' ? 'Admin cộng tiền...' : 'Admin trừ tiền...'}
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          {error && <div className="adm-form-error">{error}</div>}
          {success && <div className="adm-form-success">{success}</div>}

          <div className="adm-modal-footer">
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Huỷ</button>
            <button
              type="submit"
              className={`adm-btn ${type === 'add' ? 'adm-btn--success' : 'adm-btn--danger'}`}
              disabled={submitting}
            >
              {submitting ? 'Đang xử lý...' : type === 'add' ? 'Cộng tiền' : 'Trừ tiền'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pages, setPages]   = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, search });
      const r = await fetch(`${API_ORIGIN}/admin/transactions?${params}`, { headers: authHeaders() });
      const d = await r.json();
      setTransactions(d.data?.transactions ?? []);
      setTotal(d.data?.total ?? 0);
      setPages(d.data?.pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="adm-page">
      <div className="adm-page-header">
        <h1 className="adm-page-title">Giao dịch <span className="adm-badge">{total}</span></h1>
        <div className="adm-toolbar">
          <input
            className="adm-search"
            placeholder="Tìm username, mã giao dịch..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <button className="adm-btn adm-btn--primary" onClick={() => setShowModal(true)}>
            + Điều chỉnh số dư
          </button>
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Người dùng</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
              <th>Mô tả</th>
              <th>Nguồn</th>
              <th>Mã GD</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="adm-table-empty">Đang tải...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan="8" className="adm-table-empty">Không có giao dịch</td></tr>
            ) : transactions.map(t => {
              const statusInfo = STATUS_LABEL[t.status] || { label: t.status, cls: '' };
              const isAdmin    = t.provider === 'admin';
              const isNeg      = Number(t.amount) < 0;
              return (
                <tr key={t.id}>
                  <td className="adm-td-id">#{t.id}</td>
                  <td>
                    <div className="adm-user-cell">
                      <img className="adm-user-avatar" src={t.avatar ? `${API_ORIGIN}${t.avatar}` : DEFAULT_AVATAR} alt="" />
                      <span className="adm-user-name">{t.username}</span>
                    </div>
                  </td>
                  <td className="adm-td-amount" style={isNeg ? { color: '#ef4444' } : isAdmin ? { color: '#22c55e' } : undefined}>
                    {isAdmin && !isNeg ? '+' : ''}{formatVND(t.amount)}
                  </td>
                  <td><span className={`adm-status-badge ${statusInfo.cls}`}>{statusInfo.label}</span></td>
                  <td className="adm-td-content" style={{ maxWidth: 200, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {t.description || '—'}
                  </td>
                  <td>
                    <span className={`adm-status-badge${isAdmin ? (isNeg ? ' adm-status-badge--blocked' : ' adm-status-badge--active') : ''}`}
                          style={!isAdmin ? { background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.75rem' } : undefined}>
                      {PROVIDER_LABEL[t.provider] || t.provider}
                    </span>
                  </td>
                  <td className="adm-td-ref" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.txn_ref || '—'}</td>
                  <td className="adm-td-date">{new Date(t.created_at).toLocaleString('vi-VN')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="adm-pagination">
          <button className="adm-page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          <span className="adm-page-info">{page} / {pages}</span>
          <button className="adm-page-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      )}

      {showModal && (
        <AdjustModal
          onClose={() => setShowModal(false)}
          onDone={() => { load(); }}
        />
      )}
    </div>
  );
}
