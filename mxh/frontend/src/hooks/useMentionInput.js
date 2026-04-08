import { useState, useCallback, useRef } from 'react';
import { searchUsers } from '../services/graphql';

export default function useMentionInput() {
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState([]);
  const [showMention, setShowMention] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const searchTimer = useRef(null);

  const handleInputChange = useCallback((text, cursorPos) => {
    // Find @ before cursor
    const before = text.slice(0, cursorPos);
    const atIdx = before.lastIndexOf('@');

    if (atIdx === -1) {
      setShowMention(false);
      return;
    }

    // @ must be at start or after a space
    if (atIdx > 0 && before[atIdx - 1] !== ' ' && before[atIdx - 1] !== '\n') {
      setShowMention(false);
      return;
    }

    const query = before.slice(atIdx + 1);
    // No spaces in username query
    if (/\s/.test(query)) {
      setShowMention(false);
      return;
    }

    if (query.length === 0) {
      setMentionStart(atIdx);
      setMentionQuery('');
      setShowMention(true);
      setMentionResults([]);
      return;
    }

    setMentionStart(atIdx);
    setMentionQuery(query);
    setShowMention(true);

    // Debounce API call
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchUsers(query, 6);
        setMentionResults(results || []);
      } catch (e) {
        console.error('Mention search failed:', e);
        setMentionResults([]);
      }
    }, 200);
  }, []);

  const selectMention = useCallback((username, currentText) => {
    // Replace @query with @username
    const before = currentText.slice(0, mentionStart);
    const afterCursor = currentText.slice(mentionStart + 1 + mentionQuery.length);
    const newText = before + '@' + username + ' ' + afterCursor;
    setShowMention(false);
    setMentionResults([]);
    setMentionQuery('');
    return newText;
  }, [mentionStart, mentionQuery]);

  const closeMention = useCallback(() => {
    setShowMention(false);
    setMentionResults([]);
  }, []);

  return {
    mentionResults,
    showMention,
    handleMentionChange: handleInputChange,
    selectMention,
    closeMention,
  };
}
