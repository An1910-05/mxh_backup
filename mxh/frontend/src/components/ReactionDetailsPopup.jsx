import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import FacebookEmoji from './FacebookEmoji';
import { API_ORIGIN } from '../config';

const DEFAULT_AVATAR = '/default-avatar.png';

const REACTION_TABS = [
  { key: 'all',   label: 'Tất cả' },
  { key: 'like',  label: 'Thích' },
  { key: 'love',  label: 'Yêu thích' },
  { key: 'haha',  label: 'Haha' },
  { key: 'wow',   label: 'Wow' },
  { key: 'sad',   label: 'Buồn' },
  { key: 'angry', label: 'Phẫn nộ' },
];

export default function ReactionDetailsPopup({ likers, onClose }) {
  const [activeTab, setActiveTab] = useState('all');
  const overlayRef = useRef(null);

  // Group counts by reaction type
  const counts = likers.reduce((acc, l) => {
    acc[l.reaction_type] = (acc[l.reaction_type] || 0) + 1;
    return acc;
  }, {});

  const visibleTabs = REACTION_TABS.filter(
    (t) => t.key === 'all' || counts[t.key] > 0
  );

  const filtered =
    activeTab === 'all' ? likers : likers.filter((l) => l.reaction_type === activeTab);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div className="rdp-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="rdp-modal" role="dialog" aria-modal="true" aria-label="Chi tiết cảm xúc">
        {/* Header */}
        <div className="rdp-header">
          <span className="rdp-title">Cảm xúc</span>
          <button className="rdp-close" onClick={onClose} aria-label="Đóng">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="rdp-tabs" role="tablist">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              className={`rdp-tab${activeTab === t.key ? ' rdp-tab--active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.key === 'all' ? (
                <span className="rdp-tab-label">
                  Tất cả <span className="rdp-tab-count">{likers.length}</span>
                </span>
              ) : (
                <span className="rdp-tab-emoji-wrap">
                  <FacebookEmoji type={t.key} size="xs" />
                  <span className="rdp-tab-count">{counts[t.key]}</span>
                </span>
              )}
            </button>
          ))}
        </div>

        {/* User list */}
        <div className="rdp-list" role="tabpanel">
          {filtered.length === 0 ? (
            <p className="rdp-empty">Không có ai</p>
          ) : (
            filtered.map((liker) => (
              <Link
                key={liker.id}
                to={`/profile_id=${liker.id}`}
                className="rdp-row"
                onClick={onClose}
              >
                <img
                  className="rdp-avatar"
                  src={liker.user_avatar ? `${API_ORIGIN}${liker.user_avatar}` : DEFAULT_AVATAR}
                  alt={liker.username}
                  loading="lazy"
                />
                <span className="rdp-username">{liker.username}</span>
                <span className="rdp-reaction-icon">
                  <FacebookEmoji type={liker.reaction_type || 'like'} size="xs" />
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
