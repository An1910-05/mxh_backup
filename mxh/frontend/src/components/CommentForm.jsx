import { useState, useRef } from 'react';
import { createComment } from '../services/graphql';
import { searchUsers } from '../services/graphql';
import { API_ORIGIN } from '../config';
import useMentionInput from '../hooks/useMentionInput';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function CommentForm({ postId, onCommentCreated }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    if (!content.trim()) return;

    setLoading(true);
    setError('');

    try {
      const newComment = await createComment(postId, content.trim());
      setContent('');
      if (onCommentCreated) onCommentCreated(newComment);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="comment-form">
        <div className="comment-input-wrap">
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={handleChange}
            onBlur={() => setTimeout(closeMention, 150)}
            placeholder="Viết bình luận..."
          />
          {showMention && (
            <div className="mention-dropdown">
              {mentionResults.map(u => (
                <button
                  type="button"
                  key={u.id}
                  className="mention-item"
                  onMouseDown={e => { e.preventDefault(); handleSelect(u.username); }}
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
          )}
        </div>
        <button
          type="submit"
          className="apple-btn apple-btn-primary apple-btn-sm"
          disabled={loading || !content.trim()}
        >
          {loading ? '...' : 'Gửi'}
        </button>
      </form>
      {error && <div className="apple-alert apple-alert-danger">{error}</div>}
    </div>
  );
}
