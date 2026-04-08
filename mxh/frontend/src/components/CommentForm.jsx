import { useState } from 'react';
import { createComment } from '../services/graphql';

export default function CommentForm({ postId, onCommentCreated }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
        />
        <button
          type="submit"
          className="apple-btn apple-btn-primary apple-btn-sm"
          disabled={loading || !content.trim()}
        >
          {loading ? '...' : 'Reply'}
        </button>
      </form>
      {error && <div className="apple-alert apple-alert-danger">{error}</div>}
    </div>
  );
}
