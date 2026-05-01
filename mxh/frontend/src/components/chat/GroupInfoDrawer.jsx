import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getGroupMembers,
  removeGroupMember,
  leaveGroup,
  changeGroupRole,
  dissolveGroup,
} from '../../services/chat';
import { API_ORIGIN } from '../../config';
import ConfirmDialog from '../ConfirmDialog';
import AddMembersModal from './AddMembersModal';
import EditGroupInfoModal from './EditGroupInfoModal';

const DEFAULT_AVATAR = '/default-avatar.png';

const ROLE_LABEL = {
  owner: 'Chủ nhóm',
  admin: 'Quản trị',
  member: 'Thành viên',
};

const ROLE_COLOR = {
  owner: 'role-badge--owner',
  admin: 'role-badge--admin',
  member: 'role-badge--member',
};

export default function GroupInfoDrawer({ conversation, onClose, onChanged, onLeft, onDissolved }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDissolve, setConfirmDissolve] = useState(false);
  const [confirmRole, setConfirmRole] = useState(null);

  const myRole = conversation?.my_role || members.find(m => Number(m.user_id) === Number(user?.id))?.role;
  const canEditInfo = myRole === 'owner' || myRole === 'admin';
  const canManageMembers = myRole === 'owner' || myRole === 'admin';
  const canChangeRole = myRole === 'owner';
  const canDissolve = myRole === 'owner';

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getGroupMembers(conversation.id);
      setMembers(list || []);
    } catch (e) {
      setError(e.message || 'Không tải được danh sách thành viên');
    } finally {
      setLoading(false);
    }
  }, [conversation?.id]);

  useEffect(() => {
    if (conversation?.id) loadMembers();
  }, [conversation?.id, loadMembers]);

  const handleRemoveMember = async () => {
    if (!confirmRemove || busy) return;
    setBusy(true);
    try {
      await removeGroupMember(conversation.id, confirmRemove.user_id);
      setConfirmRemove(null);
      await loadMembers();
      onChanged?.();
    } catch (e) {
      alert(e.message || 'Xoá thất bại');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await leaveGroup(conversation.id);
      setConfirmLeave(false);
      onLeft?.();
    } catch (e) {
      alert(e.message || 'Rời nhóm thất bại');
    } finally {
      setBusy(false);
    }
  };

  const handleDissolve = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await dissolveGroup(conversation.id);
      setConfirmDissolve(false);
      onDissolved?.();
    } catch (e) {
      alert(e.message || 'Giải tán thất bại');
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async () => {
    if (!confirmRole || busy) return;
    setBusy(true);
    try {
      await changeGroupRole(conversation.id, confirmRole.user_id, confirmRole.newRole);
      setConfirmRole(null);
      await loadMembers();
      onChanged?.();
    } catch (e) {
      alert(e.message || 'Đổi vai trò thất bại');
    } finally {
      setBusy(false);
    }
  };

  const groupAvatarSrc = conversation?.avatar
    ? `${API_ORIGIN}${conversation.avatar}`
    : conversation?.display_avatar
      ? `${API_ORIGIN}${conversation.display_avatar}`
      : DEFAULT_AVATAR;

  return (
    <>
      <div className="group-drawer-backdrop" onClick={onClose} />
      <aside className="group-info-drawer" role="dialog" aria-label="Thông tin nhóm">
        <header className="group-drawer-header">
          <button type="button" className="group-drawer-close" onClick={onClose} aria-label="Đóng">×</button>
          <h3>Thông tin nhóm</h3>
        </header>

        <div className="group-drawer-body">
          <div className="group-drawer-hero">
            <img className="group-drawer-avatar" src={groupAvatarSrc} alt="" />
            <h2 className="group-drawer-title">{conversation?.title || conversation?.display_name || 'Nhóm'}</h2>
            <p className="group-drawer-meta">
              {members.length || conversation?.member_count || 0} thành viên
              {conversation?.online_member_count > 0 && (
                <> · {conversation.online_member_count} đang hoạt động</>
              )}
            </p>
            {canEditInfo && (
              <button type="button" className="cg-btn cg-btn--ghost group-edit-btn" onClick={() => setShowEdit(true)}>
                Sửa thông tin nhóm
              </button>
            )}
          </div>

          <section className="group-drawer-section">
            <div className="group-drawer-section-head">
              <h4>Thành viên ({members.length})</h4>
              {canManageMembers && (
                <button type="button" className="group-drawer-addbtn" onClick={() => setShowAdd(true)}>
                  + Thêm
                </button>
              )}
            </div>

            {loading && <div className="group-drawer-empty">Đang tải...</div>}
            {error && <div className="cg-error">{error}</div>}

            <ul className="group-member-list">
              {members.map(m => {
                const isMe = Number(m.user_id) === Number(user?.id);
                const targetRole = m.role;
                const showRoleMenu = canChangeRole && !isMe && targetRole !== 'owner';
                const showRemove = canManageMembers && !isMe && targetRole !== 'owner' && !(myRole === 'admin' && targetRole === 'admin');
                return (
                  <li key={m.user_id} className="group-member-row">
                    <img
                      className="group-member-avatar"
                      src={m.avatar ? `${API_ORIGIN}${m.avatar}` : DEFAULT_AVATAR}
                      alt=""
                    />
                    <div className="group-member-info">
                      <span className="group-member-name">
                        {m.username}{isMe && <span className="group-member-you"> (Bạn)</span>}
                      </span>
                      <span className={`role-badge ${ROLE_COLOR[targetRole] || ''}`}>
                        {ROLE_LABEL[targetRole] || targetRole}
                      </span>
                    </div>
                    <div className="group-member-actions">
                      {showRoleMenu && targetRole === 'member' && (
                        <button type="button" onClick={() => setConfirmRole({ user_id: m.user_id, username: m.username, newRole: 'admin' })}>
                          Phong admin
                        </button>
                      )}
                      {showRoleMenu && targetRole === 'admin' && (
                        <button type="button" onClick={() => setConfirmRole({ user_id: m.user_id, username: m.username, newRole: 'member' })}>
                          Hạ admin
                        </button>
                      )}
                      {showRemove && (
                        <button type="button" className="group-member-remove" onClick={() => setConfirmRemove(m)}>
                          Xoá
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="group-drawer-section group-drawer-actions">
            <button type="button" className="group-drawer-action group-drawer-action--leave" onClick={() => setConfirmLeave(true)}>
              Rời nhóm
            </button>
            {canDissolve && (
              <button type="button" className="group-drawer-action group-drawer-action--danger" onClick={() => setConfirmDissolve(true)}>
                Giải tán nhóm
              </button>
            )}
          </section>
        </div>
      </aside>

      {showAdd && (
        <AddMembersModal
          conversationId={conversation.id}
          existingMemberIds={members.map(m => m.user_id)}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); loadMembers(); onChanged?.(); }}
        />
      )}

      {showEdit && (
        <EditGroupInfoModal
          conversation={conversation}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); onChanged?.(); }}
        />
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Xoá khỏi nhóm?"
          message={`Bạn có chắc muốn xoá ${confirmRemove.username} khỏi nhóm?`}
          confirmText={busy ? 'Đang xử lý...' : 'Xoá'}
          cancelText="Hủy"
          onConfirm={handleRemoveMember}
          onCancel={() => !busy && setConfirmRemove(null)}
        />
      )}

      {confirmLeave && (
        <ConfirmDialog
          title="Rời nhóm?"
          message="Bạn sẽ không còn thấy tin nhắn của nhóm sau khi rời."
          confirmText={busy ? 'Đang xử lý...' : 'Rời nhóm'}
          cancelText="Hủy"
          onConfirm={handleLeave}
          onCancel={() => !busy && setConfirmLeave(false)}
        />
      )}

      {confirmDissolve && (
        <ConfirmDialog
          title="Giải tán nhóm?"
          message="Toàn bộ thành viên sẽ không thể truy cập nhóm này nữa. Hành động không thể hoàn tác."
          confirmText={busy ? 'Đang xử lý...' : 'Giải tán'}
          cancelText="Hủy"
          onConfirm={handleDissolve}
          onCancel={() => !busy && setConfirmDissolve(false)}
        />
      )}

      {confirmRole && (
        <ConfirmDialog
          title={confirmRole.newRole === 'admin' ? 'Phong làm admin?' : 'Hạ vai trò admin?'}
          message={
            confirmRole.newRole === 'admin'
              ? `Cấp quyền quản trị cho ${confirmRole.username}? Họ có thể thêm/xoá thành viên và đổi tên nhóm.`
              : `Hạ ${confirmRole.username} xuống thành viên thường?`
          }
          confirmText={busy ? 'Đang xử lý...' : 'Xác nhận'}
          cancelText="Hủy"
          onConfirm={handleRoleChange}
          onCancel={() => !busy && setConfirmRole(null)}
        />
      )}
    </>
  );
}
