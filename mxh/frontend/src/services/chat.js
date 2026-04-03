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
