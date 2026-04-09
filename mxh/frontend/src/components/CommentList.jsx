import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { timeAgoShort } from '../utils/time';
import { API_ORIGIN } from '../config';
import { useAuth } from '../hooks/useAuth';
import { createComment, deleteComment as deleteCommentApi, searchUsers } from '../services/graphql';
import { uploadFile } from '../services/api';
import CommentMediaAttachment from './CommentMediaAttachment';
import CommentMediaViewer from './CommentMediaViewer';

const DEFAULT_AVATAR = '/default-avatar.png';

function renderContentWithMentions(text) {
  if (!text) return null;
  const parts = text.split(/(@[a-zA-Z0-9._]+)/g);
  return parts.map((part, i) => {
    if (/^@[a-zA-Z0-9._]+$/.test(part)) {
      return <span key={i} className="comment-mention">{part}</span>;
    }
    return part;
  });
}

function InlineReplyForm({ postId, parentId, onReplied, placeholder, autoMention }) {
  const initValue = autoMention ? `@${autoMention} ` : '';
  const [content, setContent] = useState(initValue);
  const [sending, setSending] = useState(false);
  const [mentionResults, setMentionResults] = useState([]);
  const [showMention, setShowMention] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => {
    // Focus and place cursor at end of pre-filled mention
    if (inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, []);

  const handleChange = (e) => {
    const next = e.target.value;
    setContent(next);
    const caret = e.target.selectionStart ?? next.length;
    const upTo = next.slice(0, caret);
    const atIdx = upTo.lastIndexOf('@');
    if (atIdx < 0) { setShowMention(false); setMentionStart(-1); return; }
    const prev = atIdx === 0 ? ' ' : upTo[atIdx - 1];
    if (!/\s/.test(prev)) { setShowMention(false); setMentionStart(-1); return; }
    const query = upTo.slice(atIdx + 1);
    if (/\s/.test(query)) { setShowMention(false); setMentionStart(-1); return; }
    setMentionStart(atIdx);
    setShowMention(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await searchUsers(query || '', 8);
        setMentionResults(r || []);
      } catch (err) {
        console.error('mention search failed', err);
        setMentionResults([]);
      }
    }, 180);
  };

  const pickMention = (username) => {
    if (mentionStart < 0) return;
    const el = inputRef.current;
    if (!el) return;
    const current = el.value;
    const caret = el.selectionStart ?? current.length;
    const before = current.slice(0, mentionStart);
    const after = current.slice(caret);
    const insert = `@${username} `;
    const newValue = before + insert + after;
    setContent(newValue);
    setShowMention(false);
    setMentionStart(-1);
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + insert.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const newComment = await createComment(postId, content.trim(), {}, parentId);
      setContent('');
      if (onReplied) onReplied(newComment);
    } catch (err) {
      console.error('reply failed', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="comment-form comment-reply-form" onSubmit={handleSubmit}>
      <div className="comment-reply-input-wrap">
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={handleChange}
          onBlur={() => setTimeout(() => setShowMention(false), 150)}
          placeholder={placeholder || 'Viết trả lời...'}
        />
        {showMention && mentionResults.length > 0 && (
          <div className="mention-dropdown">
            {mentionResults.map((u) => (
              <button
                type="button"
                key={u.id}
                className="mention-item"
                onMouseDown={(e) => { e.preventDefault(); pickMention(u.username); }}
              >
                <img src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR} alt="" />
                <span className="mention-name">{u.username}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="submit"
        className="apple-btn apple-btn-primary apple-btn-sm"
        disabled={sending || !content.trim()}
      >
        {sending ? '...' : 'Trả lời'}
      </button>
    </form>
  );
}

function CommentItem({ comment, postId, postOwnerId, replyToUsername, onReplied, onDeleted, onOpenMedia, isReply }) {
  const { user } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);

  const canDelete = user && (user.id === comment.user_id || user.id === postOwnerId);
  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc muốn xoá bình luận này?')) return;
    try {
      await deleteCommentApi(comment.id);
      if (onDeleted) onDeleted(comment.id);
    } catch (err) {
      alert('Không thể xoá: ' + err.message);
    }
  };

  return (
    <div className={`comment-item${isReply ? ' comment-item--reply' : ''} fade-in`}>
      <Link to={`/profile_id=${comment.user_id}`} className="comment-avatar">
        <img src={comment.user_avatar ? `${API_ORIGIN}${comment.user_avatar}` : DEFAULT_AVATAR} alt="" />
      </Link>
      <div className="comment-body">
        <div className="comment-bubble">
          <Link to={`/profile_id=${comment.user_id}`} className="comment-username">{comment.username}</Link>
          {(comment.content || replyToUsername) && (
            <div className="comment-text">
              {replyToUsername && <span className="comment-reply-to">@{replyToUsername} </span>}
              {comment.content ? renderContentWithMentions(comment.content) : null}
            </div>
          )}
          <CommentMediaAttachment
            comment={comment}
            onOpen={() => onOpenMedia && onOpenMedia(comment)}
          />
        </div>
        <div className="comment-meta">
          <span className="comment-time">{timeAgoShort(comment.created_at)}</span>
          {user && (
            <button className="comment-reply-btn" onClick={() => setShowReplyForm((s) => !s)}>
              Trả lời
            </button>
          )}
          {canDelete && (
            <button className="comment-reply-btn comment-delete-btn" onClick={handleDelete}>
              Xoá
            </button>
          )}
        </div>
        {showReplyForm && (
          <InlineReplyForm
            postId={postId}
            parentId={comment.id}
            autoMention={comment.username}
            onReplied={(newComment) => {
              setShowReplyForm(false);
              if (onReplied) onReplied(newComment);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function CommentList({ comments: initialComments, postId, postOwnerId }) {
  const [comments, setComments] = useState(initialComments || []);
  const [activeMediaComment, setActiveMediaComment] = useState(null);

  useEffect(() => { setComments(initialComments || []); }, [initialComments]);

  const { parents, repliesByParent, commentsById } = useMemo(() => {
    const byId = {};
    const parents = [];
    const replies = {};
    (comments || []).forEach((c) => { byId[c.id] = c; });
    (comments || []).forEach((c) => {
      if (c.parent_id) {
        if (!replies[c.parent_id]) replies[c.parent_id] = [];
        replies[c.parent_id].push(c);
      } else {
        parents.push(c);
      }
    });
    return { parents, repliesByParent: replies, commentsById: byId };
  }, [comments]);

  if (!comments || comments.length === 0) {
    return (
      <div className="apple-empty" style={{ padding: '24px 0' }}>
        <div className="apple-empty-sub">Chưa có bình luận nào.</div>
      </div>
    );
  }

  const handleReplied = (newComment) => {
    setComments((prev) => [...prev, newComment]);
  };

  const handleDeleted = (commentId) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));
  };

  return (
    <>
      <div className="comment-section">
        {parents.map((c) => {
          const replies = repliesByParent[c.id] || [];
          return (
            <div key={c.id} className="comment-thread">
              <CommentItem
                comment={c}
                postId={postId}
                postOwnerId={postOwnerId}
                onReplied={handleReplied}
                onDeleted={handleDeleted}
                onOpenMedia={setActiveMediaComment}
              />
              {replies.length > 0 && (
                <div className="comment-replies">
                  {replies.map((r) => {
                    // Determine reply-to username: if r.parent_id points to a reply, find that reply's author
                    // But since we flatten, r.parent_id always points to top-level parent.
                    // We show @username only if content starts with a reply (user typed it) or we show parent's name.
                    const replyTo = null;
                    return (
                      <CommentItem
                        key={r.id}
                        comment={r}
                        postId={postId}
                        postOwnerId={postOwnerId}
                        replyToUsername={replyTo}
                        onReplied={handleReplied}
                        onDeleted={handleDeleted}
                        onOpenMedia={setActiveMediaComment}
                        isReply
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeMediaComment && (
        <CommentMediaViewer
          comment={activeMediaComment}
          onClose={() => setActiveMediaComment(null)}
        />
      )}
    </>
  );
}
