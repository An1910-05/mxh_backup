const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';

let ws = null;
let isConnected = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;
const listeners = new Map();
const pendingAcks = new Map();
const offlineQueue = [];

function generateMsgId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

export function connectWebSocket(token, onStatusChange) {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[WS] Connected');
    reconnectAttempts = 0;

    send('auth.login', { token }, null, null);

    while (offlineQueue.length > 0) {
      const queued = offlineQueue.shift();
      ws.send(queued);
    }

    isConnected = true;
    onStatusChange?.(true);
  };

  ws.onmessage = (event) => {
    const frame = JSON.parse(event.data);
    handleFrame(frame);
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected');
    isConnected = false;
    onStatusChange?.(false);
    scheduleReconnect(token, onStatusChange);
  };

  ws.onerror = (err) => {
    console.error('[WS] Error:', err);
  };
}

export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  isConnected = false;
  reconnectAttempts = 0;
}

function scheduleReconnect(token, onStatusChange) {
  if (reconnectTimer) return;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket(token, onStatusChange);
  }, delay);
}

export function send(type, data = {}, resolve = null, reject = null) {
  const msgId = generateMsgId();
  const frame = JSON.stringify({
    type,
    msg_id: msgId,
    data,
  });

  if (resolve) {
    const timeoutId = setTimeout(() => {
      if (pendingAcks.has(msgId)) {
        pendingAcks.delete(msgId);
        reject?.(new Error('Request timeout'));
      }
    }, 30000);
    pendingAcks.set(msgId, {
      resolve,
      reject: reject || (() => {}),
      timeoutId,
    });
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(frame);
  } else {
    offlineQueue.push(frame);
  }

  return msgId;
}

export function sendMessage(conversationId, content, options = {}) {
  const clientMsgId = options.clientMsgId || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve, reject) => {
    send('messages.send', {
      conversation_id: conversationId,
      content,
      content_type: options.contentType || 'text',
      media_url: options.mediaUrl || null,
      media_width: options.mediaWidth || null,
      media_height: options.mediaHeight || null,
      reply_to_msg_id: options.replyToMsgId || null,
      client_msg_id: clientMsgId,
    }, resolve, reject);
  });
}

export function sendTyping(conversationId) {
  send('messages.setTyping', { conversation_id: conversationId });
}

export function sendReadHistory(conversationId, maxId) {
  send('messages.readHistory', { conversation_id: conversationId, max_id: maxId });
}

export function unsendMessage(messageId) {
  return new Promise((resolve, reject) => {
    send('messages.unsend', { message_id: messageId }, resolve, reject);
  });
}

export function hideMessage(messageId) {
  return new Promise((resolve, reject) => {
    send('messages.hide', { message_id: messageId }, resolve, reject);
  });
}

export function sendPing() {
  send('ping');
}

export function on(eventType, callback) {
  if (!listeners.has(eventType)) {
    listeners.set(eventType, new Set());
  }
  listeners.get(eventType).add(callback);
  return () => listeners.get(eventType)?.delete(callback);
}

export function off(eventType, callback) {
  listeners.get(eventType)?.delete(callback);
}

function handleFrame(frame) {
  const { type, reply_to, data } = frame;

  if (reply_to && pendingAcks.has(reply_to)) {
    const { resolve, reject, timeoutId } = pendingAcks.get(reply_to);
    clearTimeout(timeoutId);
    pendingAcks.delete(reply_to);
    if (type === 'error') {
      reject(new Error(data?.message || 'Server error'));
    } else {
      resolve(data);
    }
  }

  emit(type, data);
}

function emit(type, data) {
  const cbs = listeners.get(type);
  if (cbs) {
    cbs.forEach(cb => {
      try { cb(data); } catch (e) { console.error('[WS] Listener error:', e); }
    });
  }

  const wildcardCbs = listeners.get('*');
  if (wildcardCbs) {
    wildcardCbs.forEach(cb => {
      try { cb(type, data); } catch (e) { console.error('[WS] Wildcard listener error:', e); }
    });
  }
}

export function isWsConnected() {
  return isConnected;
}
