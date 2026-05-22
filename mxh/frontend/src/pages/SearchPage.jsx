import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  searchUsers,
  getPendingFriendRequests,
  getSentFriendRequests,
  getMyFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
} from '../services/graphql';
import { formatHandleDisplay } from '../utils/userDisplay';
import { useAuth } from '../hooks/useAuth';
import { API_ORIGIN } from '../config';
import VerifiedBadge from '../components/VerifiedBadge';

const DEFAULT_AVATAR = '/default-avatar.png';

function bumpFriendRequestsBadge() {
  window.dispatchEvent(new Event('mxh-friend-requests-refresh'));
}

function SkeletonCard() {
  return (
    <div className="post-card srcard-skeleton">
      <div className="srcard-skel-avatar" />
      <div className="srcard-skel-body">
        <div className="srcard-skel-name" />
        <div className="srcard-skel-meta" />
      </div>
      <div className="srcard-skel-btn" />
    </div>
  );
}

export default function SearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  // Suggestion state
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestWrapRef = useRef(null);
  const debounceRef = useRef(null);
  const lastSubmittedRef = useRef('');

  const [pending, setPending] = useState([]);
  const [sent, setSent] = useState([]);
  const [friends, setFriends] = useState([]);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(null);
  const resultsRef = useRef(results);
  resultsRef.current = results;

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (suggestWrapRef.current && !suggestWrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced live suggestions
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // Don't re-show suggestions for a query we already fully searched
    if (trimmed === lastSubmittedRef.current) return;

    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const data = await searchUsers(trimmed, 6);
        setSuggestions(data || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Suggest error:', err);
      } finally {
        setSuggestLoading(false);
      }
    }, 280);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const refreshFriendships = useCallback(async () => {
    if (!user) {
      setPending([]);
      setSent([]);
      setFriends([]);
      return;
    }
    setRelationsLoading(true);
    try {
      const [p, s, f] = await Promise.all([
        getPendingFriendRequests(),
        getSentFriendRequests(),
        getMyFriends(),
      ]);
      setPending(p || []);
      setSent(s || []);
      setFriends(f || []);
      bumpFriendRequestsBadge();
    } catch (err) {
      console.error(err);
    } finally {
      setRelationsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPending([]);
      setSent([]);
      setFriends([]);
      return;
    }
    if (resultsRef.current.length > 0) {
      refreshFriendships();
    }
  }, [user, refreshFriendships]);

  const runSearch = async (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setShowSuggestions(false);
    lastSubmittedRef.current = trimmed;
    setLoading(true);
    try {
      const data = await searchUsers(trimmed);
      setResults(data);
      setSearched(true);
      if (user && data.length > 0) {
        await refreshFriendships();
      }
    } catch (err) {
      console.error('Search error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    runSearch(query);
  };

  const runAction = async (key, fn) => {
    setActionBusy(key);
    try {
      await fn();
      await refreshFriendships();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Thao tác thất bại');
    } finally {
      setActionBusy(null);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setSuggestions([]);
    setShowSuggestions(false);
    lastSubmittedRef.current = '';
    inputRef.current?.focus();
  };

  const closeSuggestAndGo = () => setShowSuggestions(false);

  return (
    <div className="apple-main fade-in">
      {/* Page header */}
      <motion.div
        className="sr-page-header"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <h1 className="sr-page-title">Tìm bạn bè</h1>
        <p className="sr-page-sub">Tìm theo tên, ID số, @tên hoặc link trang cá nhân</p>
      </motion.div>

      {/* Search bar + suggestions wrapper */}
      <motion.div
        ref={suggestWrapRef}
        className="sr-search-outer"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.07 }}
      >
        <form onSubmit={handleSearch}>
          <div className="sr-search-wrap">
            <i className="bi bi-search sr-search-icon" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setShowSuggestions(false)}
              onFocus={() => {
                if (suggestions.length > 0 && query.trim() !== lastSubmittedRef.current) {
                  setShowSuggestions(true);
                }
              }}
              placeholder="Nhập tên, @tên hoặc mã ID..."
              className="sr-search-input"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <AnimatePresence>
              {query && (
                <motion.button
                  type="button"
                  onClick={clearSearch}
                  className="sr-search-clear"
                  aria-label="Xóa tìm kiếm"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.14 }}
                >
                  <i className="bi bi-x-circle-fill" />
                </motion.button>
              )}
            </AnimatePresence>
            <button
              type="submit"
              className="apple-btn apple-btn-primary sr-search-btn"
              disabled={loading || !query.trim()}
            >
              {loading
                ? <span className="apple-spinner" style={{ width: 15, height: 15 }} />
                : <><i className="bi bi-search" /> Tìm kiếm</>
              }
            </button>
          </div>
        </form>

        {/* Suggestion dropdown */}
        <AnimatePresence>
          {showSuggestions && (suggestLoading || suggestions.length > 0) && (
            <motion.div
              className="sr-suggest-dropdown"
              initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -4, scaleY: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              style={{ originY: 0 }}
            >
              {suggestLoading && suggestions.length === 0 && (
                <div className="sr-suggest-loading">
                  <span className="apple-spinner" style={{ width: 14, height: 14 }} />
                  <span>Đang tìm...</span>
                </div>
              )}

              {suggestions.map((u, idx) => {
                const link = u.custom_url ? `/${u.custom_url}` : `/profile_id=${u.id}`;
                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04, type: 'spring', stiffness: 350, damping: 28 }}
                  >
                    <Link
                      to={link}
                      className="sr-suggest-item"
                      onClick={closeSuggestAndGo}
                    >
                      <div className="sr-suggest-avatar">
                        <img
                          src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR}
                          alt=""
                        />
                      </div>
                      <div className="sr-suggest-info">
                        <span className="sr-suggest-name">
                          {u.username}
                          {u.is_verified && <VerifiedBadge isVerified ownerId={u.id} size={13} />}
                        </span>
                        <div className="sr-suggest-badges">
                          <span className="srcard-id-badge">
                            <i className="bi bi-hash" />{u.id}
                          </span>
                          {u.custom_url && (
                            <span className="srcard-handle-badge">
                              <i className="bi bi-at" />
                              {formatHandleDisplay(u.custom_url).replace('@', '')}
                            </span>
                          )}
                        </div>
                      </div>
                      <i className="bi bi-arrow-right sr-suggest-arrow" />
                    </Link>
                  </motion.div>
                );
              })}

              {!suggestLoading && suggestions.length > 0 && (
                <button
                  type="button"
                  className="sr-suggest-viewall"
                  onClick={() => runSearch(query)}
                >
                  <i className="bi bi-search" />
                  Xem tất cả kết quả cho&nbsp;<strong>"{query.trim()}"</strong>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Loading skeletons */}
      {loading && (
        <div className="sr-results-list">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && searched && results.length === 0 && (
        <motion.div
          className="sr-empty"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        >
          <i className="bi bi-person-slash sr-empty-icon" />
          <p className="apple-empty-text">Không tìm thấy kết quả</p>
          <p className="apple-empty-sub" style={{ marginTop: 6 }}>Thử tìm bằng tên khác hoặc mã ID</p>
        </motion.div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="sr-results-list">
          <AnimatePresence initial={false}>
            {results.map((u, idx) => {
              const link = u.custom_url ? `/${u.custom_url}` : `/profile_id=${u.id}`;
              const uid = Number(u.id);
              const selfId = user ? Number(user.id) : null;
              const isSelf = selfId !== null && uid === selfId;

              const incoming = user && pending.find((p) => Number(p.id) === uid);
              const outgoing = user && sent.find((s) => Number(s.id) === uid);
              const isFriend = user && friends.some((f) => Number(f.id) === uid);

              const showFriendActions = user && !isSelf;

              return (
                <motion.div
                  key={u.id}
                  className="post-card srcard"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
                  transition={{
                    delay: idx * 0.05,
                    type: 'spring',
                    stiffness: 320,
                    damping: 28,
                  }}
                >
                  <Link
                    to={link}
                    className="search-result-card-hit"
                    aria-label={`Xem trang ${u.username}`}
                  />

                  <div className="srcard-left">
                    <div className="srcard-avatar-wrap">
                      <img
                        src={u.avatar ? `${API_ORIGIN}${u.avatar}` : DEFAULT_AVATAR}
                        alt=""
                        className="srcard-avatar-img"
                      />
                    </div>
                    <div className="srcard-info">
                      <div className="srcard-name-row">
                        <span className="srcard-display-name">{u.username}</span>
                        {u.is_verified && <VerifiedBadge isVerified ownerId={u.id} size={15} />}
                        <span className="srcard-id-badge">
                          <i className="bi bi-hash" />
                          {u.id}
                        </span>
                        {u.custom_url && (
                          <span className="srcard-handle-badge">
                            <i className="bi bi-at" />
                            {formatHandleDisplay(u.custom_url).replace('@', '')}
                          </span>
                        )}
                      </div>
                      {isFriend && (
                        <span className="srcard-friend-chip">
                          <i className="bi bi-people-fill" />
                          Bạn bè
                        </span>
                      )}
                    </div>
                  </div>

                  {showFriendActions && (
                    <div className="srcard-actions">
                      {incoming && (
                        <>
                          <button
                            type="button"
                            className="apple-btn apple-btn-primary apple-btn-sm srcard-btn"
                            disabled={actionBusy === `acc-${incoming.friendship_id}` || relationsLoading}
                            onClick={() => runAction(`acc-${incoming.friendship_id}`, () => acceptFriendRequest(incoming.friendship_id))}
                          >
                            {actionBusy === `acc-${incoming.friendship_id}`
                              ? <span className="apple-spinner" style={{ width: 14, height: 14 }} />
                              : <><i className="bi bi-person-check-fill" /> Đồng ý</>
                            }
                          </button>
                          <button
                            type="button"
                            className="apple-btn apple-btn-ghost apple-btn-sm srcard-btn"
                            disabled={actionBusy === `rej-${incoming.friendship_id}` || relationsLoading}
                            onClick={() => runAction(`rej-${incoming.friendship_id}`, () => rejectFriendRequest(incoming.friendship_id))}
                          >
                            {actionBusy === `rej-${incoming.friendship_id}`
                              ? <span className="apple-spinner" style={{ width: 14, height: 14 }} />
                              : <><i className="bi bi-x-lg" /> Từ chối</>
                            }
                          </button>
                        </>
                      )}
                      {!incoming && outgoing && (
                        <button
                          type="button"
                          className="apple-btn apple-btn-outline apple-btn-sm srcard-btn"
                          disabled={actionBusy === `can-${outgoing.friendship_id}` || relationsLoading}
                          onClick={() => runAction(`can-${outgoing.friendship_id}`, () => cancelFriendRequest(outgoing.friendship_id))}
                        >
                          {actionBusy === `can-${outgoing.friendship_id}`
                            ? <span className="apple-spinner" style={{ width: 14, height: 14 }} />
                            : <><i className="bi bi-clock-history" /> Hủy lời mời</>
                          }
                        </button>
                      )}
                      {!incoming && !outgoing && !isFriend && (
                        <button
                          type="button"
                          className="apple-btn apple-btn-dark apple-btn-sm srcard-btn"
                          disabled={actionBusy === `req-${uid}` || relationsLoading}
                          onClick={() => runAction(`req-${uid}`, () => sendFriendRequest(uid))}
                        >
                          {actionBusy === `req-${uid}`
                            ? <span className="apple-spinner" style={{ width: 14, height: 14 }} />
                            : <><i className="bi bi-person-plus-fill" /> Kết bạn</>
                          }
                        </button>
                      )}
                      <button
                        type="button"
                        className="apple-btn apple-btn-outline apple-btn-sm srcard-btn"
                        onClick={() => navigate(`/chat?user=${uid}`)}
                      >
                        <i className="bi bi-chat-dots-fill" /> Nhắn tin
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
