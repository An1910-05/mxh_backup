import { useEffect, useState } from 'react';
import { API_ORIGIN } from '../../config';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="adm-stat-card">
      <div className="adm-stat-value" style={{ color }}>{value ?? '—'}</div>
      <div className="adm-stat-label">{label}</div>
      {sub && <div className="adm-stat-sub">{sub}</div>}
    </div>
  );
}

function formatVND(n) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_ORIGIN}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setStats(d.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="adm-page">
      <div className="adm-page-header">
        <h1 className="adm-page-title">Tổng quan</h1>
      </div>

      {loading ? (
        <div className="adm-loading">Đang tải...</div>
      ) : (
        <>
          <div className="adm-stat-grid">
            <StatCard label="Tổng người dùng" value={stats?.total_users} sub={`+${stats?.new_users_week} tuần này`} color="#0a84ff" />
            <StatCard label="Đang bị khóa" value={stats?.blocked_users} color="#ff3b30" />
            <StatCard label="Tổng bài viết" value={stats?.total_posts} sub={`+${stats?.new_posts_week} tuần này`} color="#34c759" />
            <StatCard label="Doanh thu nạp" value={formatVND(stats?.total_revenue ?? 0)} sub={`${stats?.total_transactions} giao dịch`} color="#ff9f0a" />
          </div>

          {stats?.users_chart?.length > 0 && (
            <div className="adm-chart-card">
              <div className="adm-chart-title">Người dùng mới 7 ngày qua</div>
              <div className="adm-bar-chart">
                {(() => {
                  const max = Math.max(...stats.users_chart.map(d => d.count), 1);
                  return stats.users_chart.map(d => (
                    <div key={d.date} className="adm-bar-col">
                      <div className="adm-bar-val">{d.count}</div>
                      <div className="adm-bar" style={{ height: `${(d.count / max) * 100}%` }} />
                      <div className="adm-bar-label">{d.date.slice(5)}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
