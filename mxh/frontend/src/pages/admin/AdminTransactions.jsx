import { useEffect, useState, useCallback } from 'react';
import { API_ORIGIN } from '../../config';

const DEFAULT_AVATAR = '/default-avatar.png';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

function formatVND(n) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

const STATUS_LABEL = {
  success: { label: 'Thành công', cls: 'adm-status-badge--active' },
  pending: { label: 'Chờ xử lý', cls: 'adm-status-badge--pending' },
  failed: { label: 'Thất bại', cls: 'adm-status-badge--blocked' },
};

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

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
              <th>Ngân hàng</th>
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
              return (
                <tr key={t.id}>
                  <td className="adm-td-id">#{t.id}</td>
                  <td>
                    <div className="adm-user-cell">
                      <img className="adm-user-avatar" src={t.avatar ? `${API_ORIGIN}${t.avatar}` : DEFAULT_AVATAR} alt="" />
                      <span className="adm-user-name">{t.username}</span>
                    </div>
                  </td>
                  <td className="adm-td-amount">{formatVND(t.amount)}</td>
                  <td><span className={`adm-status-badge ${statusInfo.cls}`}>{statusInfo.label}</span></td>
                  <td className="adm-td-content" style={{maxWidth: 180, fontSize: '0.8125rem', color: '#65676b'}}>{t.description || '—'}</td>
                  <td style={{fontSize: '0.8125rem', color: '#65676b'}}>{t.bank_code || '—'}</td>
                  <td className="adm-td-ref">{t.txn_ref || '—'}</td>
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
    </div>
  );
}
