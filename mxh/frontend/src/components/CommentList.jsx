import { useState } from 'react';
import { Link } from 'react-router-dom';
import { timeAgoShort } from '../utils/time';
import { API_ORIGIN } from '../config';
import CommentMediaAttachment from './CommentMediaAttachment';
import CommentMediaViewer from './CommentMediaViewer';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function CommentList({ comments }) {
  const [activeMediaComment, setActiveMediaComment] = useState(null);

  if (!comments || comments.length === 0) {
    return (
      <div className="apple-empty" style={{ padding: '24px 0' }}>
        <div className="apple-empty-sub">No comments yet. Be the first to reply.</div>
      </div>
    );
  }

  return (
    <>
      <div className="comment-section">
        {comments.map((c) => (
          <div key={c.id} className="comment-item fade-in">
            <Link to={`/profile_id=${c.user_id}`} className="comment-avatar">
              <img src={c.user_avatar ? `${API_ORIGIN}${c.user_avatar}` : DEFAULT_AVATAR} alt="" />
            </Link>
            <div className="comment-body">
              <div className="comment-bubble">
                <Link to={`/profile_id=${c.user_id}`} className="comment-username">{c.username}</Link>
                {c.content ? <div className="comment-text">{c.content}</div> : null}
                <CommentMediaAttachment
                  comment={c}
                  onOpen={() => setActiveMediaComment(c)}
                />
              </div>
              <div className="comment-time">{timeAgoShort(c.created_at)}</div>
            </div>
          </div>
        ))}
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
