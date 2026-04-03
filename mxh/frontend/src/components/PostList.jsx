import PostCard from './PostCard';

export default function PostList({ posts, onDelete }) {
  if (!posts || posts.length === 0) {
    return (
      <div className="apple-empty">
        <div className="apple-empty-icon">📝</div>
        <div className="apple-empty-text">No posts yet</div>
        <div className="apple-empty-sub">Be the first to share something!</div>
      </div>
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onDelete={onDelete} />
      ))}
    </div>
  );
}
