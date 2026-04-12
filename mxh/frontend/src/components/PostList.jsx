import PostCard from './PostCard';

export default function PostList({ posts, onDelete }) {
  if (!posts || posts.length === 0) {
    return (
      <div className="apple-empty">
        <div className="apple-empty-icon apple-empty-icon--posts" aria-hidden="true" />
        <div className="apple-empty-text">Chưa có bài viết nào</div>
        <div className="apple-empty-sub">Hãy là người đầu tiên chia sẻ điều gì đó!</div>
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
