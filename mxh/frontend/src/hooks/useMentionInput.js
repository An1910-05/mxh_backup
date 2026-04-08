import { useState, useRef, useCallback } from 'react';
import { searchUsers } from '../services/graphql';

// Reusable hook for @mention dropdown inside <input> or <textarea>
// Returns state + handlers:
//   handleMentionChange(e, setValue) — call inside onChange; it updates value + manages dropdown
//   selectMention(username) — inserts @username at current caret position
//   closeMention() — hides dropdown (e.g. on blur)
export function useMentionInput() {
  const [mentionResults, setMentionResults] = useState([]);
  const [showMention, setShowMention] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const runSearch = useCallback((query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(query || '', 8);
        setMentionResults(results || []);
      } catch (err) {
        console.error('mention search failed', err);
        setMentionResults([]);
      }
    }, 180);
  }, []);

  const handleMentionChange = useCallback((e) => {
    const next = e.target.value;
    setValue(next);
    const caret = e.target.selectionStart ?? next.length;
    // Find the last '@' before caret
    const upTo = next.slice(0, caret);
    const atIdx = upTo.lastIndexOf('@');
    if (atIdx < 0) {
      setShowMention(false);
      setMentionStart(-1);
      return;
    }
    // @ must be at start or preceded by whitespace
    const prevChar = atIdx === 0 ? ' ' : upTo[atIdx - 1];
    if (!/\s/.test(prevChar)) {
      setShowMention(false);
      setMentionStart(-1);
      return;
    }
    const query = upTo.slice(atIdx + 1);
    // Stop at whitespace (no multiline query)
    if (/\s/.test(query)) {
      setShowMention(false);
      setMentionStart(-1);
      return;
    }
    setMentionStart(atIdx);
    setShowMention(true);
    runSearch(query);
  }, [runSearch]);

  const selectMention = useCallback((username) => {
    if (mentionStart < 0) return;
    const el = inputRef.current;
    const currentValue = el?.value ?? value;
    const caret = el?.selectionStart ?? currentValue.length;
    const before = currentValue.slice(0, mentionStart);
    const after = currentValue.slice(caret);
    const insert = `@${username} `;
    const newValue = before + insert + after;
    setValue(newValue);
    setShowMention(false);
    setMentionStart(-1);
    setMentionResults([]);
    // Restore caret after inserted mention
    setTimeout(() => {
      if (el) {
        const pos = before.length + insert.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    }, 0);
    return newValue;
  }, [mentionStart, value]);

  const closeMention = useCallback(() => {
    setShowMention(false);
    setMentionStart(-1);
  }, []);

  const reset = useCallback(() => {
    setValue('');
    setShowMention(false);
    setMentionStart(-1);
    setMentionResults([]);
  }, []);

  return {
    value,
    setValue,
    inputRef,
    mentionResults,
    showMention,
    handleMentionChange,
    selectMention,
    closeMention,
    reset,
  };
}
