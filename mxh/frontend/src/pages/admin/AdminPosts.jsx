import { useEffect, useState, useCallback } from 'react';
import { API_ORIGIN } from '../../config';

const DEFAULT_AVATAR = '/default-avatar.png';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
}

export default function AdminPosts() {
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, search });
      const r = await fetch(`${API_ORIGIN}/admin/posts?${params}`, { headers: authHeaders() });
      const d = await r.json();
      setPosts(d.data?.posts ?? []);
      setTotal(d.data?.total ?? 0);
      setPages(d.data?.pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (post) => {
    await fetch(`${API_ORIGIN}/admin/posts/delete`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ post_id: post.id }),
    });
    setConfirm(null);
    load();
  };

  return (
    <div className="adm-page">
      <div className="adm-page-header">
        <h1 className="adm-page-title">Bài viết <span className="adm-badge">{total}</span></h1>
        <div className="adm-toolbar">
          <input
            className="adm-search"
            placeholder="Tìm nội dung, username..."
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
              <th>Tác giả</th>
              <th>Nội dung</th>
              <th>Media</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Ngày đăng</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="adm-table-empty">Đang tải...</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan="8" className="adm-table-empty">Không có kết quả</td></tr>
            ) : posts.map(p => (
              <tr key={p.id}>
                <td className="adm-td-id">#{p.id}</td>
                <td>
                  <div className="adm-user-cell">
                    <img className="adm-user-avatar" src={p.avatar ? `${API_ORIGIN}${p.avatar}` : DEFAULT_AVATAR} alt="" />
                    <span className="adm-user-name">{p.username}</span>
                  </div>
                </td>
                <td className="adm-td-content">
                  <span className="adm-post-excerpt">{p.content ? p.content.slice(0, 80) + (p.content.length > 80 ? '…' : '') : '(Không có text)'}</span>
                </td>
                <td>
                  {p.media_url ? (
                    <img className="adm-post-thumb" src={`${API_ORIGIN}${p.media_url}`} alt="" />
                  ) : '—'}
                </td>
                <td className="adm-td-num">{p.like_count}</td>
                <td className="adm-td-num">{p.comment_count}</td>
                <td className="adm-td-date">{new Date(p.created_at).toLocaleDateString('vi-VN')}</td>
                <td>
                  <button
                    className="adm-action-btn adm-action-btn--danger"
                    onClick={() => setConfirm(p)}
                  >
                    Xóa
                  </button>
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

      {confirm && (
        <div className="adm-confirm-overlay" onClick={() => setConfirm(null)}>
          <div className="adm-confirm-box" onClick={e => e.stopPropagation()}>
            <p className="adm-confirm-text">Xóa bài viết #{confirm.id} của "{confirm.username}"?</p>
            <div className="adm-confirm-actions">
              <button className="adm-action-btn" onClick={() => setConfirm(null)}>Hủy</button>
              <button className="adm-action-btn adm-action-btn--danger" onClick={() => handleDelete(confirm)}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
