import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getFeed, getFeedStories } from '../services/graphql';
import CreatePostForm from '../components/CreatePostForm';
import PostList from '../components/PostList';
import CreateStoryModal from '../components/stories/CreateStoryModal';
import StoryViewer from '../components/stories/StoryViewer';
import { API_ORIGIN } from '../config';
const DEFAULT_AVATAR = '/default-avatar.png';

export default function HomePage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [sortTab, setSortTab] = useState('newest');

  const [storyGroups, setStoryGroups] = useState([]);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [viewingStoryGroup, setViewingStoryGroup] = useState(null);
  const [viewedUsers, setViewedUsers] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('viewedStoryUsers') || '[]'));
    } catch { return new Set(); }
  });

  const fetchFeed = async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await getFeed(20, p);
      setPosts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStories = useCallback(async () => {
    if (!user) return;
    try {
      const groups = await getFeedStories();
      setStoryGroups(groups || []);
    } catch (err) {
      console.error('Failed to load stories:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchFeed(page);
  }, [page]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleDelete = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleStoryCreated = () => {
    fetchStories();
  };

  const handleStoryDeleted = (storyId) => {
    setStoryGroups((prev) => {
      const updated = prev.map(g => ({
        ...g,
        stories: g.stories.filter(s => s.id !== storyId)
      })).filter(g => g.stories.length > 0);
      return updated;
    });
  };

  const openStoryViewer = (groupIndex) => {
    const group = storyGroups[groupIndex];
    if (group) {
      setViewedUsers(prev => {
        const next = new Set(prev);
        next.add(group.user_id);
        localStorage.setItem('viewedStoryUsers', JSON.stringify([...next]));
        return next;
      });
    }
    setViewingStoryGroup(groupIndex);
  };

  const hasOwnStories = storyGroups.some(g => g.user_id === user?.id);

  const sortedPosts = sortTab === 'popular'
    ? [...posts].sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    : posts;

  return (
    <div className="apple-main fade-in">
      {/* Stories row */}
      <div className="fb-stories">
        {/* Create story card */}
        <div className="fb-story fb-story--create" onClick={() => setShowCreateStory(true)}>
          <div className="fb-story-img">
            {user?.avatar ? (
              <img src={`${API_ORIGIN}${user.avatar}`} alt="" />
            ) : (
              <img src={DEFAULT_AVATAR} alt="" />
            )}
          </div>
          <div className="fb-story-add">
            <svg viewBox="0 0 20 20" width="20" height="20" fill="#fff">
              <path d="M10 4.5a.75.75 0 01.75.75v4h4a.75.75 0 010 1.5h-4v4a.75.75 0 01-1.5 0v-4h-4a.75.75 0 010-1.5h4v-4A.75.75 0 0110 4.5z" />
            </svg>
          </div>
          <span className="fb-story-label">Tạo tin</span>
        </div>

        {/* Story groups from other users */}
        {storyGroups.map((group, idx) => {
          const thumb = group.stories[0];
          const avatarSrc = group.user_avatar ? `${API_ORIGIN}${group.user_avatar}` : DEFAULT_AVATAR;
          const mediaSrc = `${API_ORIGIN}${thumb.media_url}`;
          const isSelf = group.user_id === user?.id;
          const isViewed = viewedUsers.has(group.user_id);

          return (
            <div
              key={group.user_id}
              className="fb-story fb-story--user"
              onClick={() => openStoryViewer(idx)}
            >
              <div className="fb-story-bg">
                {thumb.media_type === 'video' ? (
                  <video src={mediaSrc} muted preload="metadata" />
                ) : (
                  <img src={mediaSrc} alt="" />
                )}
              </div>
              <div className={`fb-story-avatar-ring${isViewed ? ' fb-story-avatar-ring--viewed' : ''}`}>
                <img src={avatarSrc} alt="" />
              </div>
              <span className="fb-story-name">{isSelf ? 'Tin của bạn' : group.username}</span>
            </div>
          );
        })}
      </div>

      {/* Create post */}
      {user && <CreatePostForm onPostCreated={handlePostCreated} />}

      {/* Feed section with sort tabs */}
      <div className="fb-feed-section">
        <div className="fb-feed-header">
          <h3>Bài viết</h3>
          <div className="fb-feed-sort">
            <button
              className={`fb-feed-sort-btn${sortTab === 'newest' ? ' fb-feed-sort-btn--active' : ''}`}
              onClick={() => setSortTab('newest')}
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 4.25v3.44l2.03 2.03a.75.75 0 11-1.06 1.06l-2.22-2.22V6.25a.75.75 0 011.5 0z" /></svg>
              Mới nhất
            </button>
            <button
              className={`fb-feed-sort-btn${sortTab === 'popular' ? ' fb-feed-sort-btn--active' : ''}`}
              onClick={() => setSortTab('popular')}
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M10 2l2.45 4.96L18 7.64l-4 3.9.94 5.46L10 14.27 5.06 17l.94-5.46-4-3.9 5.55-.68L10 2z" /></svg>
              Nổi bật
            </button>
          </div>
        </div>
        <div className="fb-feed-divider" />
      </div>

      {loading && (
        <div className="apple-loading">
          <span className="apple-spinner" /> Đang tải bảng tin...
        </div>
      )}

      {error && <div className="apple-alert apple-alert-danger">{error}</div>}

      {!loading && <PostList posts={sortedPosts} onDelete={handleDelete} />}

      {!loading && posts.length > 0 && (
        <div className="apple-pagination">
          {page > 1 && (
            <button onClick={() => setPage((p) => p - 1)} className="apple-btn apple-btn-ghost apple-btn-sm">
              ← Trước
            </button>
          )}
          <span className="apple-pagination-info">Trang {page}</span>
          {posts.length === 20 && (
            <button onClick={() => setPage((p) => p + 1)} className="apple-btn apple-btn-ghost apple-btn-sm">
              Tiếp →
            </button>
          )}
        </div>
      )}

      {/* Create Story Modal */}
      {showCreateStory && (
        <CreateStoryModal
          onClose={() => setShowCreateStory(false)}
          onCreated={handleStoryCreated}
        />
      )}

      {/* Story Viewer */}
      {viewingStoryGroup !== null && storyGroups.length > 0 && (
        <StoryViewer
          storyGroups={storyGroups}
          initialGroupIndex={viewingStoryGroup}
          onClose={() => setViewingStoryGroup(null)}
          onStoryDeleted={handleStoryDeleted}
        />
      )}
    </div>
  );
}
