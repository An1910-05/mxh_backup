import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { timeAgoShort } from '../utils/time';
import { useAuth } from '../hooks/useAuth';
import useMentionInput from '../hooks/useMentionInput';
import { createComment } from '../services/graphql';
import { API_ORIGIN } from '../config';
import CommentMediaAttachment from './CommentMediaAttachment';
import CommentMediaViewer from './CommentMediaViewer';

const DEFAULT_AVATAR = '/default-avatar.png';

function MentionDropdown({ results, onSelect }) {
  if (!results || results.length === 0) return null;
  return (
    <div className="mention-dropdown">
      {results.map(u => (
        <button
          type="button"
          key={u.id}
          className="mention-item"
          onMouseDown={e => { e.preventDefault(); onSelect(u.username); }}
        >
          <img
            src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR}
            alt=""
            className="mention-avatar"
            onError={e => { e.target.src = DEFAULT_AVATAR; }}
          />
          <span className="mention-name">{u.username}</span>
        </button>
      ))}
    </div>
  );
}

function renderContentWithMentions(content) {
  if (!content) return null;
  const parts = content.split(/(@[a-zA-Z0-9._]+)/g);
  return parts.map((part, i) => {
    if (/^@[a-zA-Z0-9._]+$/.test(part)) {
      return <span key={i} className="comment-mention">{part}</span>;
    }
    return part;
  });
}

function InlineReplyForm({ postId, parentId, replyToUsername, onReplyCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState(`@${replyToUsername} `);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const { mentionResults, showMention, handleMentionChange, selectMention, closeMention } = useMentionInput();

  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);
    handleMentionChange(val, e.target.selectionStart || val.length);
  };

  const handleSelect = (username) => {
    const newText = selectMention(username, content);
    setContent(newText);
    closeMention();
    inputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || loading) return;
    setLoading(true);
    try {
      const newComment = await createComment(postId, content.trim(), {}, parentId);
      setContent('');
      if (onReplyCreated) onReplyCreated(newComment);
    } catch (err) {
      console.error('Reply failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="reply-inline-form" onSubmit={handleSubmit}>
      <img
        src={user?.avatar ? `${API_ORIGIN}${user.avatar}` : DEFAULT_AVATAR}
        alt=""
        className="reply-form-avatar"
      />
      <div className="reply-input-wrap">
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={handleChange}
          onBlur={() => setTimeout(closeMention, 150)}
          placeholder="Viết phản hồi..."
          className="reply-input"
          autoFocus
        />
        {showMention && <MentionDropdown results={mentionResults} onSelect={handleSelect} />}
      </div>
      <button
        type="submit"
        className="reply-send-btn"
        disabled={loading || !content.trim()}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
      </button>
    </form>
  );
}

function CommentItem({ comment, postId, onReplyCreated, replyToUsername }) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  const handleReplyCreated = (newComment) => {
    setShowReplyForm(false);
    if (onReplyCreated) onReplyCreated(newComment);
  };

  return (
    <div className="comment-item fade-in">
      <Link to={`/profile_id=${comment.user_id}`} className="comment-avatar">
        <img src={comment.user_avatar ? `${API_ORIGIN}${comment.user_avatar}` : DEFAULT_AVATAR} alt="" />
      </Link>
      <div className="comment-body">
        <div className="comment-bubble">
          <Link to={`/profile_id=${comment.user_id}`} className="comment-username">{comment.username}</Link>
          <div className="comment-text">
            {replyToUsername && <span className="comment-reply-to">@{replyToUsername}</span>}
            {comment.content ? renderContentWithMentions(comment.content) : null}
          </div>
          <CommentMediaAttachment comment={comment} onOpen={() => {}} />
        </div>
        <div className="comment-meta">
          <span className="comment-time">{timeAgoShort(comment.created_at)}</span>
          <button type="button" className="comment-reply-btn" onClick={() => setShowReplyForm(s => !s)}>
            Trả lời
          </button>
        </div>
        {showReplyForm && (
          <InlineReplyForm
            postId={postId}
            parentId={comment.parent_id || comment.id}
            replyToUsername={comment.username}
            onReplyCreated={handleReplyCreated}
          />
        )}
      </div>
    </div>
  );
}

export default function CommentList({ comments, postId, onReplyCreated }) {
  const [activeMediaComment, setActiveMediaComment] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState({});

  if (!comments || comments.length === 0) {
    return (
      <div className="apple-empty" style={{ padding: '24px 0' }}>
        <div className="apple-empty-sub">Chưa có bình luận nào. Hãy là người đầu tiên.</div>
      </div>
    );
  }

  // Separate parent comments and replies
  const parentComments = comments.filter(c => !c.parent_id);
  const repliesByParent = {};
  comments.forEach(c => {
    if (c.parent_id) {
      if (!repliesByParent[c.parent_id]) repliesByParent[c.parent_id] = [];
      repliesByParent[c.parent_id].push(c);
    }
  });

  const toggleReplies = (parentId) => {
    setExpandedReplies(prev => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  return (
    <>
      <div className="comment-section">
        {parentComments.map(c => {
          const replies = repliesByParent[c.id] || [];
          const isExpanded = expandedReplies[c.id];
          const showToggle = replies.length > 0;

          return (
            <div key={c.id} className="comment-thread">
              <CommentItem comment={c} postId={postId} onReplyCreated={onReplyCreated} />

              {showToggle && !isExpanded && (
                <button type="button" className="comment-show-replies" onClick={() => toggleReplies(c.id)}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M3 8h14v2H3z"/><path d="M7 4v12" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
                  Xem {replies.length} phản hồi
                </button>
              )}

              {showToggle && isExpanded && (
                <>
                  <button type="button" className="comment-show-replies" onClick={() => toggleReplies(c.id)}>
                    Ẩn phản hồi
                  </button>
                  <div className="comment-replies">
                    {replies.map(r => (
                      <CommentItem key={r.id} comment={r} postId={postId} onReplyCreated={onReplyCreated} replyToUsername={c.username} />
                    ))}
                  </div>
                </>
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
