import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { getProfile, getProfileByCustomUrl, getUserPosts } from '../services/graphql';
import ProfileInfo from '../components/ProfileInfo';
import PostList from '../components/PostList';

export default function ProfilePage() {
  const { customUrl } = useParams();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        let profileData;
        const path = location.pathname.substring(1);

        if (path.startsWith('profile_id=')) {
          const id = path.replace('profile_id=', '');
          profileData = await getProfile(parseInt(id));
        } else {
          profileData = await getProfileByCustomUrl(path);
        }

        setProfile(profileData);
        const postsData = await getUserPosts(profileData.user_id);
        setPosts(postsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customUrl, location.pathname]);

  const handleDelete = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (loading) {
    return (
      <div className="apple-main">
        <div className="apple-loading"><span className="apple-spinner" /> Loading profile...</div>
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

  if (!profile) {
    return (
      <div className="apple-main">
        <div className="apple-empty"><div className="apple-empty-text">Profile not found</div></div>
      </div>
    );
  }

  return (
    <div className="apple-main fade-in">
      <ProfileInfo
        profile={profile}
        onProfileUpdate={(updated) => setProfile({ ...profile, ...updated })}
      />
      <h3 id="profile-posts-section" className="section-title profile-posts-heading profile-posts-anchor">
        Bài viết
      </h3>
      <PostList posts={posts} onDelete={handleDelete} />
    </div>
  );
}
