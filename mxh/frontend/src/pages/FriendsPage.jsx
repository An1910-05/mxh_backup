import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getMyFriends,
  getPendingFriendRequests,
  getSentFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
} from '../services/graphql';
import { timeAgo } from '../utils/time';
import { formatHandleDisplay } from '../utils/userDisplay';
import { API_ORIGIN } from '../config';
import { MagicCard } from '../components/ui/magic-card';
import { BorderBeam } from '../components/ui/border-beam';
import { Meteors } from '../components/ui/meteors';
import { ShimmerButton } from '../components/ui/shimmer-button';

const DEFAULT_AVATAR = '/default-avatar.png';

function bumpFriendRequestsBadge() {
  window.dispatchEvent(new Event('mxh-friend-requests-refresh'));
}

const TABS = [
  { key: 'pending', icon: 'bi-person-plus-fill', label: 'Lời mời' },
  { key: 'sent',    icon: 'bi-send-fill',         label: 'Đã gửi' },
  { key: 'friends', icon: 'bi-people-fill',       label: 'Tất cả bạn bè' },
];

function UserCard({ user, link, subtitle, subtitleIcon, actions }) {
  return (
    <div className="friends-v2-card">
      <Link to={link} className="friends-v2-card-img" aria-label={`Trang cá nhân của ${user.username}`}>
        <img src={user.avatar ? `${API_ORIGIN}${user.avatar}` : DEFAULT_AVATAR} alt="" />
      </Link>
      <div className="friends-v2-card-body">
        <Link to={link} className="friends-v2-card-name">{user.username}</Link>
        {subtitle ? (
          <span className="friends-v2-card-sub">
            {subtitleIcon ? <i className={`bi ${subtitleIcon}`} aria-hidden="true" /> : null}
            {subtitle}
          </span>
        ) : null}
        <div className="friends-v2-card-actions">{actions}</div>
      </div>
    </div>
  );
}

function IconActionButton({ icon, label, onClick, tone = 'neutral' }) {
  return (
    <button
      type="button"
      className={`friends-v2-icon-btn friends-v2-icon-btn--${tone}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <i className={`bi ${icon}`} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function EmptyState({ icon, title, hint, ctaHref, ctaLabel }) {
  return (
    <MagicCard className="friends-v2-empty" gradientFrom="#0f172a" gradientTo="#64748b" gradientColor="#cbd5e1">
      <Meteors number={8} />
      <i className={`bi ${icon} friends-v2-empty-icon`} aria-hidden="true" />
      <h3 className="friends-v2-empty-title">{title}</h3>
      {hint ? <p className="friends-v2-empty-hint">{hint}</p> : null}
      {ctaHref ? (
        <Link to={ctaHref} className="friends-v2-empty-cta">
          <ShimmerButton background="linear-gradient(135deg, #0f172a, #374151)">
            <i className="bi bi-search" aria-hidden="true" />
            <span>{ctaLabel}</span>
          </ShimmerButton>
        </Link>
      ) : null}
    </MagicCard>
  );
}

export default function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [sent, setSent] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [f, p, s] = await Promise.all([
        getMyFriends(),
        getPendingFriendRequests(),
        getSentFriendRequests(),
      ]);
      setFriends(f);
      setPending(p);
      setSent(s);
      bumpFriendRequestsBadge();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAccept = async (friendshipId) => {
    try {
      await acceptFriendRequest(friendshipId);
      await fetchAll();
    } catch (err) { console.error(err); }
  };

  const handleReject = async (friendshipId) => {
    try {
      await rejectFriendRequest(friendshipId);
      await fetchAll();
    } catch (err) { console.error(err); }
  };

  const handleCancel = async (friendshipId) => {
    try {
      await cancelFriendRequest(friendshipId);
      await fetchAll();
    } catch (err) { console.error(err); }
  };

  const counts = { pending: pending.length, sent: sent.length, friends: friends.length };
  const currentTab = TABS.find((t) => t.key === tab) || TABS[0];

  if (loading) {
    return (
      <div className="apple-main">
        <div className="friends-v2-loading">
          <span className="apple-spinner" />
          <span>Đang tải bạn bè…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="apple-main friends-page--v2 fade-in">
      {/* HERO */}
      <header className="friends-v2-hero">
        <BorderBeam size={180} duration={11} colorFrom="#0f172a" colorTo="#64748b" />
        <div className="friends-v2-hero-icon">
          <i className="bi bi-people-fill" aria-hidden="true" />
        </div>
        <div className="friends-v2-hero-copy">
          <h1 className="friends-v2-hero-title">Bạn bè</h1>
          <p className="friends-v2-hero-sub">Quản lý kết nối, lời mời và cộng đồng của bạn trên iPock.</p>
        </div>
        <div className="friends-v2-hero-stats">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`friends-v2-stat${tab === t.key ? ' friends-v2-stat--active' : ''}`}
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
            >
              <span className="friends-v2-stat-icon"><i className={`bi ${t.icon}`} aria-hidden="true" /></span>
              <span className="friends-v2-stat-meta">
                <span className="friends-v2-stat-value">{counts[t.key]}</span>
                <span className="friends-v2-stat-label">{t.label}</span>
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* SECTION HEADER */}
      <div className="friends-v2-section-head">
        <h2 className="friends-v2-section-title">
          <i className={`bi ${currentTab.icon}`} aria-hidden="true" />
          {tab === 'pending' && (pending.length > 0 ? `${pending.length} lời mời kết bạn` : 'Không có lời mời nào')}
          {tab === 'sent'    && (sent.length    > 0 ? `${sent.length} lời mời đã gửi`    : 'Chưa gửi lời mời nào')}
          {tab === 'friends' && (friends.length > 0 ? `${friends.length} bạn bè`          : 'Chưa có bạn bè')}
        </h2>
      </div>

      {/* CONTENT */}
      {tab === 'pending' && (
        pending.length === 0 ? (
          <EmptyState
            icon="bi-inbox"
            title="Không có lời mời nào"
            hint="Khi ai đó gửi lời mời, lời mời sẽ xuất hiện ở đây."
            ctaHref="/search"
            ctaLabel="Tìm bạn bè"
          />
        ) : (
          <div className="friends-v2-grid">
            {pending.map((r) => (
              <UserCard
                key={r.friendship_id}
                user={r}
                link={`/profile_id=${r.id}`}
                subtitle={timeAgo(r.request_date)}
                subtitleIcon="bi-clock-history"
                actions={
                  <>
                    <ShimmerButton
                      onClick={() => handleAccept(r.friendship_id)}
                      background="linear-gradient(135deg, #22c55e, #16a34a)"
                      className="friends-v2-shimmer"
                    >
                      <i className="bi bi-check-circle-fill" aria-hidden="true" />
                      <span>Xác nhận</span>
                    </ShimmerButton>
                    <IconActionButton
                      icon="bi-x-lg"
                      label="Xóa lời mời"
                      tone="danger"
                      onClick={() => handleReject(r.friendship_id)}
                    />
                  </>
                }
              />
            ))}
          </div>
        )
      )}

      {tab === 'sent' && (
        sent.length === 0 ? (
          <EmptyState
            icon="bi-send"
            title="Chưa gửi lời mời nào"
            hint="Tìm và gửi lời mời để mở rộng mạng lưới của bạn."
            ctaHref="/search"
            ctaLabel="Tìm bạn bè"
          />
        ) : (
          <div className="friends-v2-grid">
            {sent.map((r) => (
              <UserCard
                key={r.friendship_id}
                user={r}
                link={`/profile_id=${r.id}`}
                subtitle={`Đã gửi ${timeAgo(r.request_date)}`}
                subtitleIcon="bi-send-check"
                actions={
                  <IconActionButton
                    icon="bi-x-circle-fill"
                    label="Hủy lời mời"
                    tone="ghost-danger"
                    onClick={() => handleCancel(r.friendship_id)}
                  />
                }
              />
            ))}
          </div>
        )
      )}

      {tab === 'friends' && (
        friends.length === 0 ? (
          <EmptyState
            icon="bi-emoji-smile"
            title="Chưa có bạn bè"
            hint="Khám phá iPock và kết bạn với mọi người."
            ctaHref="/search"
            ctaLabel="Tìm bạn bè"
          />
        ) : (
          <div className="friends-v2-grid">
            {friends.map((f) => {
              const link = f.custom_url ? `/${f.custom_url}` : `/profile_id=${f.id}`;
              return (
                <UserCard
                  key={f.id}
                  user={f}
                  link={link}
                  subtitle={f.custom_url ? formatHandleDisplay(f.custom_url) : undefined}
                  subtitleIcon={f.custom_url ? 'bi-at' : null}
                  actions={
                    <Link to={link} className="friends-v2-view-btn">
                      <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                      <span>Xem trang cá nhân</span>
                    </Link>
                  }
                />
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
