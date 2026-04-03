import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getPost, getComments } from '../services/graphql';
import PostCard from '../components/PostCard';
import CommentList from '../components/CommentList';
import CommentForm from '../components/CommentForm';

export default function PostDetailPage() {
  const { postId } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [postData, commentsData] = await Promise.all([
          getPost(postId),
          getComments(postId),
        ]);
        setPost(postData);
        setComments(commentsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [postId]);

  const handleCommentCreated = (newComment) => {
    setComments((prev) => [...prev, newComment]);
  };

  if (loading) {
    return (
      <div className="apple-main">
        <div className="apple-loading">
          <span className="apple-spinner" /> Loading post...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="apple-main">
        <div className="apple-alert apple-alert-danger">{error}</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="apple-main">
        <div className="apple-empty">
          <div className="apple-empty-text">Post not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="apple-main fade-in">
      <Link to="/" className="apple-back">← Back to Feed</Link>

      <PostCard post={post} />

      <div className="apple-card" style={{ marginTop: 16 }}>
        <div className="apple-card-body">
          <h3 className="section-title" style={{ margin: '0 0 16px' }}>
            Comments ({comments.length})
          </h3>

          {user && <CommentForm postId={post.id} onCommentCreated={handleCommentCreated} />}

          <CommentList comments={comments} />
        </div>
      </div>
    </div>
  );
}
