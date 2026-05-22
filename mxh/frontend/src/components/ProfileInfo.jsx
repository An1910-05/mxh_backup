import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  followUser, unfollowUser, updateProfile, updateCustomUrl, clearAvatar,
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest, cancelFriendRequest, cancelFriendRequestByUser, unfriend,
  getUserFriends, getUserFollowers, getUserFollowing,
} from '../services/graphql';
import { uploadFile } from '../services/api';
import { formatJoinMonthYear } from '../utils/time';
import { formatHandleDisplay } from '../utils/userDisplay';
import { API_ORIGIN } from '../config';
import VerifiedBadge from './VerifiedBadge';
const DEFAULT_AVATAR = '/default-avatar.png';

function bumpFriendRequestsBadge() {
  window.dispatchEvent(new Event('mxh-friend-requests-refresh'));
}

function userLink(u) {
  return u.custom_url ? `/${u.custom_url}` : `/profile_id=${u.id}`;
}

export default function ProfileInfo({ profile, onProfileUpdate }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [following, setFollowing] = useState(profile.is_following);
  const [followerCount, setFollowerCount] = useState(profile.follower_count);
  const [friendStatus, setFriendStatus] = useState(profile.friendship_status || 'none');
  const [friendshipId, setFriendshipId] = useState(profile.friendship_id);
  const [isSender, setIsSender] = useState(profile.friendship_is_sender);
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState(profile.bio || '');
  const [editingUrl, setEditingUrl] = useState(false);
  const [customUrl, setCustomUrl] = useState(profile.custom_url || '');
  const [urlError, setUrlError] = useState('');
  const [loading, setLoading] = useState(false);
  const [handleCopied, setHandleCopied] = useState(false);

  const [avatar, setAvatar] = useState(profile.avatar);
  const [coverPhoto, setCoverPhoto] = useState(profile.cover_photo);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarRef = useRef(null);
  const coverRef = useRef(null);

  const [listPanel, setListPanel] = useState(null);
  const [listData, setListData] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listActionId, setListActionId] = useState(null);
  const [avatarMenu, setAvatarMenu] = useState(false);
  const [viewingAvatar, setViewingAvatar] = useState(false);
  const [viewingCover, setViewingCover] = useState(false);
  const [showFriendMenu, setShowFriendMenu] = useState(false);
  const friendMenuRef = useRef(null);
  const [showAbout, setShowAbout] = useState(false);

  const isOwn = user && user.id === profile.user_id;

  useEffect(() => {
    const hideNav = viewingAvatar || viewingCover;
    const cls = 'avatar-viewer-open';
    if (hideNav) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => document.body.classList.remove(cls);
  }, [viewingAvatar, viewingCover]);

  useEffect(() => {
    if (!showFriendMenu) return undefined;
    const handler = (e) => {
      if (friendMenuRef.current && !friendMenuRef.current.contains(e.target)) setShowFriendMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFriendMenu]);

  useEffect(() => {
    if (!listPanel) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setListPanel(null);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [listPanel]);

  const handleFollow = async () => {
    setLoading(true);
    try {
      if (following) {
        await unfollowUser(profile.user_id);
        setFollowing(false);
        setFollowerCount((c) => c - 1);
      } else {
        await followUser(profile.user_id);
        setFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  const handleAddFriend = async () => {
    setLoading(true);
    try {
      const result = await sendFriendRequest(profile.user_id);
      setFriendStatus(result.status);
      setFriendshipId(result.friendship_id);
      setIsSender(result.status === 'pending');
      bumpFriendRequestsBadge();
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  const handleCancelRequest = async () => {
    setShowFriendMenu(false);
    setLoading(true);
    try {
      if (friendshipId) await cancelFriendRequest(friendshipId);
      else await cancelFriendRequestByUser(profile.user_id);
      setFriendStatus('none');
      setFriendshipId(null);
      bumpFriendRequestsBadge();
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      await acceptFriendRequest(friendshipId);
      setFriendStatus('accepted');
      bumpFriendRequestsBadge();
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      await rejectFriendRequest(friendshipId);
      setFriendStatus('none');
      setFriendshipId(null);
      bumpFriendRequestsBadge();
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  const handleUnfriend = async () => {
    setShowFriendMenu(false);
    setLoading(true);
    try {
      await unfriend(profile.user_id);
      setFriendStatus('none');
      setFriendshipId(null);
      bumpFriendRequestsBadge();
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  const handleUpdateBio = async () => {
    setLoading(true);
    try {
      const updated = await updateProfile(bio);
      setEditingBio(false);
      if (onProfileUpdate) onProfileUpdate(updated);
    } catch (err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  const handleUpdateUrl = async () => {
    setUrlError('');
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(customUrl)) {
      setUrlError('3-30 ký tự, chỉ chữ, số, dấu chấm và gạch dưới');
      return;
    }
    setLoading(true);
    try {
      const newUrl = await updateCustomUrl(customUrl);
      setEditingUrl(false);
      setCustomUrl(newUrl);
      if (onProfileUpdate) onProfileUpdate({ ...profile, custom_url: newUrl });
    } catch (err) {
      setUrlError(err.message);
    } finally { setLoading(false); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const result = await uploadFile('/upload', 'avatar', file);
      setAvatar(result.data.avatar);
      if (onProfileUpdate) onProfileUpdate({ ...profile, avatar: result.data.avatar });
    } catch (err) { console.error(err.message); }
    finally { setUploadingAvatar(false); }
  };

  const handleRemoveAvatar = async () => {
    if (!avatar) return;
    if (!window.confirm('Gỡ ảnh đại diện? Ảnh hiện tại sẽ bị xóa và dùng ảnh mặc định.')) return;
    setRemovingAvatar(true);
    try {
      const updated = await clearAvatar();
      setAvatar(null);
      if (onProfileUpdate) onProfileUpdate(updated);
      setViewingAvatar(false);
      setAvatarMenu(false);
    } catch (err) {
      console.error(err.message);
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const result = await uploadFile('/upload/cover', 'cover', file);
      setCoverPhoto(result.data.cover_photo);
      if (onProfileUpdate) onProfileUpdate({ ...profile, cover_photo: result.data.cover_photo });
    } catch (err) { console.error(err.message); }
    finally { setUploadingCover(false); }
  };

  const openList = async (type) => {
    if (listPanel === type) {
      setListPanel(null);
      return;
    }
    setListPanel(type);
    setListLoading(true);
    setListData([]);
    try {
      let data;
      if (type === 'friends') data = await getUserFriends(profile.user_id);
      else if (type === 'followers') data = await getUserFollowers(profile.user_id);
      else if (type === 'following') data = await getUserFollowing(profile.user_id);
      setListData(data || []);
    } catch (err) { console.error(err.message); }
    finally { setListLoading(false); }
  };

  const handleUnfriendInList = async (targetUserId) => {
    if (!window.confirm('Hủy kết bạn với người này?')) return;
    setListActionId(targetUserId);
    try {
      await unfriend(targetUserId);
      setListData((prev) => prev.filter((x) => Number(x.id) !== Number(targetUserId)));
      if (onProfileUpdate && isOwn) {
        onProfileUpdate({
          ...profile,
          friend_count: Math.max(0, (parseInt(profile.friend_count, 10) || 0) - 1),
        });
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Không hủy kết bạn được');
    } finally {
      setListActionId(null);
    }
  };

  const handleMessageInList = (targetUserId) => {
    setListPanel(null);
    navigate(`/chat?user=${targetUserId}`);
  };


  const customLink = profile.custom_url ? `${window.location.origin}/${profile.custom_url}` : null;
  const listTitle = { friends: 'Bạn bè', followers: 'Người theo dõi', following: 'Đang theo dõi' };
  const handleDisplay = profile.custom_url || profile.username?.replace(/\s+/g, '') || 'user';

  return (
    <div className="profile-header profile-header--x fade-in">
      {/* Ảnh bìa — kiểu X: thanh tối, full width */}
      <div
        className={`profile-cover profile-cover--x ${coverPhoto ? 'profile-cover--has-photo' : ''}`}
        style={coverPhoto ? { backgroundImage: `url(${API_ORIGIN}${coverPhoto})` } : {}}
        onClick={(e) => { if (coverPhoto && e.target === e.currentTarget) setViewingCover(true); }}
      >
        {!coverPhoto && <span className="profile-cover-placeholder">Chưa có ảnh bìa</span>}
        {isOwn && (
          <>
            <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: 'none' }} />
            <div className="profile-cover-actions">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); coverRef.current?.click(); }}
                className="profile-cover-btn profile-cover-btn--x"
                disabled={uploadingCover}
              >
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden><path d="M5.5 8a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0z" /><path d="M5.03 1.659A2.25 2.25 0 0 1 6.621 1H9.38a2.25 2.25 0 0 1 1.59.659l.842.841h.939a2.75 2.75 0 0 1 2.75 2.75v6A2.75 2.75 0 0 1 12.75 14h-9.5A2.75 2.75 0 0 1 .5 11.25v-6A2.75 2.75 0 0 1 3.25 2.5h.94l.84-.841zM8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" /></svg>
                <span>{uploadingCover ? 'Đang tải...' : coverPhoto ? 'Thay đổi ảnh bìa' : 'Thêm ảnh bìa'}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {viewingCover && coverPhoto && (
        <div className="avatar-viewer-overlay" onClick={() => setViewingCover(false)}>
          <div className="avatar-viewer avatar-viewer--cover" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="avatar-viewer-close" onClick={() => setViewingCover(false)}>✕</button>
            <img src={`${API_ORIGIN}${coverPhoto}`} alt="Ảnh bìa" />
          </div>
        </div>
      )}

      {/* Hàng avatar + nút (giống X: avatar chồng lên bìa, nút phải) */}
      <div className="profile-x-toolbar">
        <div className="profile-avatar-wrapper profile-avatar-wrapper--x">
          <div
            className="profile-avatar-large profile-avatar--x profile-avatar-clickable"
            onClick={() => {
              if (isOwn) setAvatarMenu(!avatarMenu);
              else if (avatar) setViewingAvatar(true);
            }}
          >
            {avatar ? (
              <img src={`${API_ORIGIN}${avatar}`} alt={profile.username} />
            ) : (
              <img src={DEFAULT_AVATAR} alt="" />
            )}
          </div>
          <input ref={avatarRef} type="file" accept="image/*" onChange={(e) => { handleAvatarUpload(e); setAvatarMenu(false); }} style={{ display: 'none' }} />

          {avatarMenu && isOwn && (
            <>
              <div className="avatar-menu-backdrop" onClick={() => setAvatarMenu(false)} />
              <div className="avatar-menu">
                {avatar && (
                  <button type="button" className="avatar-menu-item" onClick={() => { setViewingAvatar(true); setAvatarMenu(false); }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
                    Xem ảnh đại diện
                  </button>
                )}
                {avatar && (
                  <button type="button" className="avatar-menu-item avatar-menu-item--danger" onClick={handleRemoveAvatar} disabled={removingAvatar}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /><path d="M10 11v6M14 11v6" /></svg>
                    {removingAvatar ? 'Đang gỡ...' : 'Gỡ ảnh đại diện'}
                  </button>
                )}
                <button type="button" className="avatar-menu-item" onClick={() => { avatarRef.current?.click(); }} disabled={uploadingAvatar}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                  {uploadingAvatar ? 'Đang tải...' : 'Chọn ảnh đại diện'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="profile-x-toolbar-actions">
          {isOwn && (
            <div className="profile-x-own-actions">
              <button type="button" className="profile-x-edit-btn" onClick={() => document.getElementById('profile-x-details')?.scrollIntoView({ behavior: 'smooth' })}>
                Chỉnh sửa hồ sơ
              </button>
            </div>
          )}
          {user && !isOwn && (
            <div className="profile-x-other-actions">
              {/* Friend button — Facebook style */}
              {(friendStatus === 'none' || friendStatus === 'rejected') && (
                <button type="button" className="pfb pfb--primary" onClick={handleAddFriend} disabled={loading}>
                  <i className="bi bi-person-plus-fill" aria-hidden="true" />
                  Thêm bạn bè
                </button>
              )}
              {friendStatus === 'pending' && !isSender && (
                <>
                  <button type="button" className="pfb pfb--primary" onClick={handleAccept} disabled={loading}>
                    <i className="bi bi-check-lg" aria-hidden="true" />
                    Chấp nhận
                  </button>
                  <button type="button" className="pfb pfb--light" onClick={handleDecline} disabled={loading}>
                    Từ chối
                  </button>
                </>
              )}
              {(friendStatus === 'pending' && isSender) && (
                <div className="pfb-dropdown-wrap" ref={friendMenuRef}>
                  <button type="button" className="pfb pfb--light" onClick={() => setShowFriendMenu(v => !v)} disabled={loading}>
                    <i className="bi bi-person-check-fill" aria-hidden="true" />
                    Đã gửi lời mời
                    <i className="bi bi-chevron-down pfb-chevron" aria-hidden="true" />
                  </button>
                  {showFriendMenu && (
                    <div className="pfb-menu">
                      <button type="button" className="pfb-menu-item pfb-menu-item--danger" onClick={handleCancelRequest}>
                        <i className="bi bi-person-x-fill" aria-hidden="true" />
                        Hủy lời mời
                      </button>
                    </div>
                  )}
                </div>
              )}
              {friendStatus === 'accepted' && (
                <div className="pfb-dropdown-wrap" ref={friendMenuRef}>
                  <button type="button" className="pfb pfb--friends" onClick={() => setShowFriendMenu(v => !v)} disabled={loading}>
                    <i className="bi bi-person-check-fill" aria-hidden="true" />
                    Bạn bè
                    <i className="bi bi-chevron-down pfb-chevron" aria-hidden="true" />
                  </button>
                  {showFriendMenu && (
                    <div className="pfb-menu">
                      <button type="button" className="pfb-menu-item pfb-menu-item--danger" onClick={handleUnfriend}>
                        <i className="bi bi-person-dash-fill" aria-hidden="true" />
                        Hủy kết bạn
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Follow */}
              <button type="button" onClick={handleFollow} className={`pfb ${following ? 'pfb--light' : 'pfb--light'}`} disabled={loading}>
                {following
                  ? <><i className="bi bi-bell-slash-fill" aria-hidden="true" />Bỏ theo dõi</>
                  : <><i className="bi bi-bell-fill" aria-hidden="true" />Theo dõi</>
                }
              </button>

              {/* Message */}
              <button type="button" onClick={() => navigate(`/chat?user=${profile.user_id}`)} className="pfb pfb--light">
                <i className="bi bi-chat-fill" aria-hidden="true" />
                Nhắn tin
              </button>
            </div>
          )}
        </div>
      </div>

      {viewingAvatar && avatar && (
        <div className="avatar-viewer-overlay" onClick={() => setViewingAvatar(false)}>
          <div className="avatar-viewer" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="avatar-viewer-close" onClick={() => setViewingAvatar(false)}>✕</button>
            <img src={`${API_ORIGIN}${avatar}`} alt={profile.username} />
          </div>
        </div>
      )}

      {showAbout && createPortal(
        <div className="about-panel-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <div className="about-panel-header">
              <button type="button" className="about-panel-back" onClick={() => setShowAbout(false)} aria-label="Đóng">
                <i className="bi bi-arrow-left" aria-hidden="true" />
              </button>
              <span className="about-panel-title">Giới thiệu về tài khoản này</span>
            </div>

            <div className="about-panel-body">
              <div className="about-panel-profile">
                {avatar
                  ? <img src={`${API_ORIGIN}${avatar}`} alt="" className="about-panel-avatar" />
                  : <img src="/default-avatar.png" alt="" className="about-panel-avatar" />
                }
                <div className="about-panel-username-row">
                  <span className="about-panel-username">{profile.username}</span>
                  {profile.is_verified && (
                    <svg viewBox="92 0 24 24" width="16" height="16" fill="#1d9bf0" aria-label="Đã xác thực">
                      <path d="m109.207 9.707-6.5 6.5a.996.996 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414L102 14.086l5.793-5.793a1 1 0 1 1 1.414 1.414m6.68 4.768L114.618 12l1.267-2.474a1.02 1.02 0 0 0-.355-1.326l-2.334-1.51-.14-2.775a1.018 1.018 0 0 0-.97-.971l-2.778-.14-1.51-2.336a1.02 1.02 0 0 0-1.324-.354L104 1.38 101.526.114a1.02 1.02 0 0 0-1.326.354l-1.509 2.336-2.777.14a1.017 1.017 0 0 0-.97.97l-.14 2.777L92.468 8.2a1.02 1.02 0 0 0-.354 1.325L93.382 12l-1.268 2.474a1.02 1.02 0 0 0 .355 1.326l2.335 1.509.14 2.776c.025.528.443.945.97.971l2.777.14 1.51 2.336a1.02 1.02 0 0 0 1.324.354L104 22.62l2.474 1.267c.469.242 1.039.09 1.326-.355l1.51-2.335 2.776-.14c.527-.026.945-.443.97-.97l.14-2.777 2.336-1.51c.443-.286.595-.856.354-1.324" />
                    </svg>
                  )}
                </div>
                <span className="about-panel-handle">@{profile.custom_url || profile.username}</span>
              </div>

              <div className="about-panel-divider" />

              <ul className="about-panel-list">
                <li className="about-panel-item">
                  <i className="bi bi-calendar3 about-panel-item-icon" aria-hidden="true" />
                  <div>
                    <div className="about-panel-item-label">Ngày tham gia</div>
                    <div className="about-panel-item-value">{formatJoinMonthYear(profile.created_at)}</div>
                  </div>
                </li>

                {profile.is_verified && profile.verified_until && (
                  <li className="about-panel-item">
                    <i className="bi bi-patch-check about-panel-item-icon" aria-hidden="true" />
                    <div>
                      <div className="about-panel-item-label">Đã xác nhận</div>
                      <div className="about-panel-item-value">
                        Kể từ {formatJoinMonthYear(profile.verified_until)}
                      </div>
                    </div>
                  </li>
                )}

                <li className="about-panel-item">
                  <i className="bi bi-globe2 about-panel-item-icon" aria-hidden="true" />
                  <div>
                    <div className="about-panel-item-label">Đã kết nối qua</div>
                    <div className="about-panel-item-value">
                      {profile.last_login_device === 'mobile' ? 'Ứng dụng di động' : 'Trình duyệt web'}
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="profile-x-details" id="profile-x-details">
        <div className="profile-name-row">
          <h1 className="profile-name profile-name--x">{profile.username}</h1>
          <VerifiedBadge
            isVerified={!!profile.is_verified}
            verifiedUntil={profile.verified_until}
            ownerId={profile.user_id}
            size={22}
            onPurchased={(updated) => { if (onProfileUpdate) onProfileUpdate(updated); }}
          />
        </div>
        <button
          type="button"
          className={`profile-handle profile-handle--copyable${handleCopied ? ' profile-handle--copied' : ''}`}
          onClick={() => {
            navigator.clipboard.writeText(`@${handleDisplay}`).then(() => {
              setHandleCopied(true);
              setTimeout(() => setHandleCopied(false), 2000);
            }).catch(() => {});
          }}
          title="Nhấn để sao chép"
        >
          @{handleDisplay}
          <span className="profile-handle-copy-hint">
            {handleCopied ? (
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            )}
          </span>
        </button>

        {editingBio ? (
          <div className="profile-edit-bio profile-edit-bio--x">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Giới thiệu về bạn..." />
            <div className="profile-edit-actions profile-edit-actions--x">
              <button type="button" onClick={handleUpdateBio} className="apple-btn apple-btn-primary apple-btn-sm" disabled={loading}>Lưu</button>
              <button type="button" onClick={() => setEditingBio(false)} className="apple-btn apple-btn-ghost apple-btn-sm">Hủy</button>
            </div>
          </div>
        ) : (
          <p className="profile-bio profile-bio--x">
            {profile.bio || <span className="profile-bio-empty">Chưa có tiểu sử</span>}
            {isOwn && (
              <button type="button" onClick={() => setEditingBio(true)} className="profile-bio-edit-link">
                Sửa
              </button>
            )}
          </p>
        )}

        <button type="button" className="profile-join-row" onClick={() => setShowAbout(true)}>
          <svg className="profile-join-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" />
          </svg>
          <span>{formatJoinMonthYear(profile.created_at)}</span>
          <span className="profile-join-chevron" aria-hidden>›</span>
        </button>

        <div className="profile-stats profile-stats--x">
          <button type="button" className="profile-stat-item profile-stat-clickable profile-stat--x" onClick={() => openList('following')}>
            <span className="profile-stat-number">{profile.following_count ?? 0}</span>
            <span className="profile-stat-label">Đang theo dõi</span>
          </button>
          <button type="button" className="profile-stat-item profile-stat-clickable profile-stat--x" onClick={() => openList('followers')}>
            <span className="profile-stat-number">{followerCount}</span>
            <span className="profile-stat-label">Người theo dõi</span>
          </button>
          <button
            type="button"
            className="profile-stat-item profile-stat-clickable profile-stat--x"
            onClick={() => {
              document.getElementById('profile-posts-section')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }}
            aria-label="Xem bài viết"
          >
            <span className="profile-stat-number">{profile.post_count}</span>
            <span className="profile-stat-label">Bài viết</span>
          </button>
          <button type="button" className="profile-stat-item profile-stat-clickable profile-stat--x" onClick={() => openList('friends')}>
            <span className="profile-stat-number">{profile.friend_count || 0}</span>
            <span className="profile-stat-label">Bạn bè</span>
          </button>
        </div>

        <div className="profile-x-meta">
          {isOwn && (
            <div className="profile-url-section profile-url-section--x">
              {editingUrl ? (
                <div className="profile-edit-bio profile-edit-bio--x">
                  <div className="profile-url-edit-row">
                    <span className="profile-url-prefix">{window.location.origin}/</span>
                    <input
                      type="text"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="ten.trang"
                    />
                  </div>
                  {urlError && <div className="apple-alert apple-alert-danger profile-url-alert">{urlError}</div>}
                  <div className="profile-edit-actions profile-edit-actions--x">
                    <button type="button" onClick={handleUpdateUrl} className="apple-btn apple-btn-primary apple-btn-sm" disabled={loading}>Lưu</button>
                    <button type="button" onClick={() => { setEditingUrl(false); setUrlError(''); }} className="apple-btn apple-btn-ghost apple-btn-sm">Hủy</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setEditingUrl(true)} className="profile-x-meta-link">
                  {customUrl ? 'Đổi link trang cá nhân' : 'Tạo link trang cá nhân'}
                </button>
              )}
            </div>
          )}
          {isOwn && <div className="profile-email profile-email--x">{profile.email}</div>}
          {isOwn && (
            <span className="profile-x-meta-id">ID: {profile.user_id}</span>
          )}
        </div>
      </div>

      {listPanel &&
        createPortal(
          <div
            className="profile-list-modal-overlay"
            role="presentation"
            onClick={() => setListPanel(null)}
          >
            <div
              className="profile-list-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-list-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="profile-list-panel profile-list-panel--modal fade-in">
                <div className="profile-list-header">
                  <span className="profile-list-title" id="profile-list-modal-title">
                    {listTitle[listPanel]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setListPanel(null)}
                    className="apple-btn apple-btn-ghost apple-btn-sm"
                    aria-label="Đóng"
                  >
                    ✕
                  </button>
                </div>
                {listLoading ? (
                  <div className="apple-loading" style={{ padding: 16 }}>
                    <span className="apple-spinner" />
                  </div>
                ) : listData.length === 0 ? (
                  <div className="apple-empty" style={{ padding: '16px 0' }}>
                    <div className="apple-empty-sub">Chưa có ai</div>
                  </div>
                ) : (
                  <div className="profile-list-items">
                    {listData.map((u) => {
                      const uid = Number(u.id);
                      const canMsg = user && uid !== Number(user.id);
                      const showUnfriend = isOwn && listPanel === 'friends' && canMsg;
                      return (
                        <div key={u.id} className="profile-list-item">
                          <Link
                            to={userLink(u)}
                            className="post-avatar"
                            style={{ width: 32, height: 32 }}
                            onClick={() => setListPanel(null)}
                          >
                            <img src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR} alt="" />
                          </Link>
                          <div className="profile-list-name-wrap">
                            <Link to={userLink(u)} className="profile-list-name" onClick={() => setListPanel(null)}>
                              {u.username}
                            </Link>
                          </div>
                          <div className="profile-list-actions">
                            <Link
                              to={userLink(u)}
                              className="apple-btn apple-btn-outline apple-btn-sm"
                              onClick={() => setListPanel(null)}
                            >
                              Xem
                            </Link>
                            {canMsg && (
                              <button
                                type="button"
                                className="profile-list-btn"
                                onClick={() => handleMessageInList(uid)}
                              >
                                Nhắn tin
                              </button>
                            )}
                            {showUnfriend && (
                              <button
                                type="button"
                                className="profile-list-btn profile-list-btn--danger"
                                disabled={listActionId === uid}
                                onClick={() => handleUnfriendInList(uid)}
                              >
                                {listActionId === uid ? '…' : 'Hủy kết bạn'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
