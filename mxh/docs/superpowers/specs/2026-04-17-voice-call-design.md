# Voice Call Feature — Design Spec
> Created: 2026-04-17

## Tóm tắt

Thêm tính năng gọi thoại (voice call) 1-1 theo kiểu Facebook Messenger:
- Cửa sổ nổi nhỏ, vừa gọi vừa dùng app
- Popup báo cuộc gọi đến ở mọi trang
- Timeout 30 giây nếu không bắt máy
- WebRTC peer-to-peer (âm thanh không đi qua server)
- STUN miễn phí của Google
- Signaling qua WebSocket Ratchet hiện có

---

## Kiến trúc

```
Browser A                  WebSocket (Ratchet)           Browser B
   |-- call-offer (sdp) --> |                              |
   |                        |-- call-offer (sdp) -------> |
   |                        | <-- call-answer (sdp) ------|
   | <-- call-answer -------|                              |
   |-- call-ice ----------> | -- call-ice ------------->  |
   | <========= audio P2P WebRTC (không qua server) =====>|
```

Server chỉ relay signal — không xử lý media. Phù hợp VPS 1GB RAM / 1 CPU.

---

## Call State Machine

```
idle
 └─ gọi đi ──────────────────────────────> calling_out
 └─ nhận được call-offer ─────────────────> ringing_in

calling_out
 └─ nhận call-answer ─────────────────────> connected
 └─ nhận call-reject ─────────────────────> idle
 └─ 30s timeout (frontend tự đếm) ────────> idle
 └─ người gọi cúp ────────────────────────> idle

ringing_in
 └─ bấm Bắt máy ──────────────────────────> connected
 └─ bấm Từ chối ──────────────────────────> idle (gửi call-reject)
 └─ 30s timeout ───────────────────────────> idle

connected
 └─ một bên gửi call-end ─────────────────> idle
```

---

## WebSocket Message Types (mới)

| Type | Gửi bởi | Data |
|---|---|---|
| `call-offer` | Caller | `{ to_user_id, sdp, conversation_id }` |
| `call-answer` | Callee | `{ to_user_id, sdp }` |
| `call-reject` | Callee | `{ to_user_id, reason }` |
| `call-end` | Cả hai | `{ to_user_id }` |
| `call-ice` | Cả hai | `{ to_user_id, candidate }` |

Server relay theo `to_user_id` — không lưu DB.

---

## STUN Config

```js
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
```

Không cần TURN server ở MVP.

---

## Files thay đổi

### Backend
- `backend/src/WebSocket/ChatProtocol.php` — thêm constants call types
- `backend/src/WebSocket/ChatServer.php` — thêm relay cho call messages trong `onMessage()`

### Frontend
| File | Loại | Mô tả |
|---|---|---|
| `src/contexts/CallContext.jsx` | Mới | Quản lý WebRTC peer connection, call state, ICE |
| `src/components/IncomingCallToast.jsx` | Mới | Popup báo cuộc gọi đến (toàn app) |
| `src/components/CallWindow.jsx` | Mới | Cửa sổ nổi khi đang gọi |
| `src/App.jsx` | Sửa | Bọc CallContext, mount IncomingCallToast + CallWindow |
| `src/components/FloatingChatWindow.jsx` | Sửa | Thêm nút gọi điện vào header |
| `src/styles.css` | Sửa | Styles cho call UI |

---

## UI Layout

### IncomingCallToast (góc dưới trái)
```
┌─────────────────────────┐
│ 📞  Nguyễn Văn A        │
│     Đang gọi cho bạn... │
│  [Từ chối]  [Bắt máy]   │
└─────────────────────────┘
```

### CallWindow (góc dưới phải, nổi)
```
┌──────────────────┐
│ Nguyễn Văn A     │
│ [avatar]         │
│ 00:42            │
│ [🎤 tắt]  [📵 cúp]│
└──────────────────┘
```

---

## Constraints

- Không có TURN → một số mạng corporate/NAT nghiêm ngặt có thể không kết nối được (chấp nhận ở MVP)
- Chỉ hỗ trợ call 1-1 (không group call)
- Không ghi âm, không lưu lịch sử cuộc gọi vào DB
