import { useEffect, useState, useCallback } from 'react';
import { API_ORIGIN } from '../../config';

const DEFAULT_AVATAR = '/default-avatar.png';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null); // { type, user }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, search, filter });
      const r = await fetch(`${API_ORIGIN}/admin/users?${params}`, { headers: authHeaders() });
      const d = await r.json();
      setUsers(d.data?.users ?? []);
      setTotal(d.data?.total ?? 0);
      setPages(d.data?.pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [page, search, filter]);

  useEffect(() => { load(); }, [load]);

  const handleBlock = async (user, block) => {
    await fetch(`${API_ORIGIN}/admin/users/block`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ user_id: user.id, block }),
    });
    setConfirm(null);
    load();
  };

  const handleDelete = async (user) => {
    await fetch(`${API_ORIGIN}/admin/users/delete`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ user_id: user.id }),
    });
    setConfirm(null);
    load();
  };

  const handleSetRole = async (user, role) => {
    await fetch(`${API_ORIGIN}/admin/users/role`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ user_id: user.id, role }),
    });
    load();
  };

  return (
    <div className="adm-page">
      <div className="adm-page-header">
        <h1 className="adm-page-title">Người dùng <span className="adm-badge">{total}</span></h1>
        <div className="adm-toolbar">
          <input
            className="adm-search"
            placeholder="Tìm username, email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <select className="adm-select" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>
            <option value="all">Tất cả</option>
            <option value="blocked">Bị khóa</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Người dùng</th>
              <th>Email</th>
              <th>Role</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="adm-table-empty">Đang tải...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="7" className="adm-table-empty">Không có kết quả</td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td className="adm-td-id">#{u.id}</td>
                <td>
                  <div className="adm-user-cell">
                    <img
                      className="adm-user-avatar"
                      src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR}
                      alt=""
                    />
                    <span className="adm-user-name">{u.username}</span>
                  </div>
                </td>
                <td className="adm-td-email">{u.email}</td>
                <td>
                  <select
                    className={`adm-role-select${u.role === 'admin' ? ' adm-role-select--admin' : ''}`}
                    value={u.role}
                    onChange={e => handleSetRole(u, e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  <span className={`adm-status-badge${u.is_blocked == 1 ? ' adm-status-badge--blocked' : ' adm-status-badge--active'}`}>
                    {u.is_blocked == 1 ? 'Bị khóa' : 'Hoạt động'}
                  </span>
                </td>
                <td className="adm-td-date">{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                <td>
                  <div className="adm-actions-cell">
                    {u.role !== 'admin' && (
                      <>
                        <button
                          className={`adm-action-btn${u.is_blocked == 1 ? ' adm-action-btn--success' : ' adm-action-btn--warn'}`}
                          onClick={() => setConfirm({ type: u.is_blocked == 1 ? 'unblock' : 'block', user: u })}
                        >
                          {u.is_blocked == 1 ? 'Mở khóa' : 'Khóa'}
                        </button>
                        <button
                          className="adm-action-btn adm-action-btn--danger"
                          onClick={() => setConfirm({ type: 'delete', user: u })}
                        >
                          Xóa
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
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

      {/* Confirm dialog */}
      {confirm && (
        <div className="adm-confirm-overlay" onClick={() => setConfirm(null)}>
          <div className="adm-confirm-box" onClick={e => e.stopPropagation()}>
            <p className="adm-confirm-text">
              {confirm.type === 'block'   && `Khóa tài khoản @${confirm.user.username}?`}
              {confirm.type === 'unblock' && `Mở khóa tài khoản @${confirm.user.username}?`}
              {confirm.type === 'delete'  && `Xóa tài khoản @${confirm.user.username}?`}
            </p>
            <div className="adm-confirm-actions">
              <button className="adm-action-btn" onClick={() => setConfirm(null)}>Hủy</button>
              <button
                className={`adm-action-btn ${confirm.type === 'delete' ? 'adm-action-btn--danger' : confirm.type === 'block' ? 'adm-action-btn--warn' : 'adm-action-btn--success'}`}
                onClick={() => {
                  if (confirm.type === 'block') handleBlock(confirm.user, true);
                  else if (confirm.type === 'unblock') handleBlock(confirm.user, false);
                  else handleDelete(confirm.user);
                }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
