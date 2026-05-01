import { restFetch } from './api';

export async function getConversations(limit = 50, offset = 0) {
  const data = await restFetch(`/chat/conversations?limit=${limit}&offset=${offset}`);
  return data.data;
}

export async function getOrCreateConversation(userId) {
  const data = await restFetch('/chat/conversation', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
  return data.data;
}

export async function getMessages(conversationId, limit = 50, beforeId = null) {
  let url = `/chat/messages?conversation_id=${conversationId}&limit=${limit}`;
  if (beforeId) url += `&before_id=${beforeId}`;
  const data = await restFetch(url);
  return data.data;
}

export async function sendMessageRest(conversationId, content, options = {}) {
  const data = await restFetch('/chat/messages/send', {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: conversationId,
      content,
      content_type: options.contentType || 'text',
      media_url: options.mediaUrl || null,
      media_width: options.mediaWidth || null,
      media_height: options.mediaHeight || null,
      reply_to_msg_id: options.replyToMsgId || null,
    }),
  });
  return data.data;
}

export async function markAsRead(conversationId, messageId) {
  await restFetch('/chat/messages/read', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, message_id: messageId }),
  });
}

export async function searchMessages(conversationId, query) {
  const data = await restFetch(`/chat/messages/search?conversation_id=${conversationId}&q=${encodeURIComponent(query)}`);
  return data.data;
}

export async function getReadReceipt(conversationId) {
  const data = await restFetch(`/chat/read-receipt?conversation_id=${conversationId}`);
  return data.data;
}

export async function unsendMessageRest(messageId) {
  const data = await restFetch('/chat/messages/unsend', {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId }),
  });
  return data.data;
}

export async function hideMessageRest(messageId) {
  await restFetch('/chat/messages/hide', {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId }),
  });
}

/** Xóa toàn bộ tin nhắn trong hội thoại cho cả hai người. */
export async function clearConversation(conversationId) {
  await restFetch('/chat/conversation/clear', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

/** Ẩn hội thoại chỉ ở phía user hiện tại (đối phương vẫn thấy). */
export async function hideConversation(conversationId) {
  await restFetch('/chat/conversation/hide', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

/** Ẩn toàn bộ tin nhắn phía user hiện tại (giống ẩn từng tin, một lần; đối phương vẫn thấy). */
export async function hideAllMessagesForMe(conversationId) {
  await restFetch('/chat/conversation/hide-all-for-me', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

// ===== Group chat (Phase 1 + 2) =====

export async function createGroup(title, avatarUrl, memberIds) {
  const data = await restFetch('/chat/group/create', {
    method: 'POST',
    body: JSON.stringify({
      title,
      avatar_url: avatarUrl || null,
      member_ids: memberIds,
    }),
  });
  return data.data;
}

export async function addGroupMembers(conversationId, memberIds) {
  const data = await restFetch('/chat/group/members/add', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, member_ids: memberIds }),
  });
  return data.data;
}

export async function removeGroupMember(conversationId, userId) {
  const data = await restFetch('/chat/group/members/remove', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, user_id: userId }),
  });
  return data.data;
}

export async function updateGroupInfo(conversationId, { title, avatarUrl } = {}) {
  const body = { conversation_id: conversationId };
  if (title !== undefined) body.title = title;
  if (avatarUrl !== undefined) body.avatar_url = avatarUrl;
  const data = await restFetch('/chat/group/info', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.data;
}

export async function leaveGroup(conversationId) {
  const data = await restFetch('/chat/group/leave', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
  return data.data;
}

export async function changeGroupRole(conversationId, userId, role) {
  const data = await restFetch('/chat/group/role', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, user_id: userId, role }),
  });
  return data.data;
}

export async function dissolveGroup(conversationId) {
  const data = await restFetch('/chat/group/dissolve', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
  return data.data;
}

export async function getGroupMembers(conversationId) {
  const data = await restFetch(`/chat/group/members?conversation_id=${conversationId}`);
  return data.data;
}

export async function getGroupReadStatus(conversationId) {
  const data = await restFetch(`/chat/group/read-status?conversation_id=${conversationId}`);
  return data.data;
}
