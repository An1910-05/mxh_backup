# MD5 trong game Tỉu Xài — Tác dụng & cách hoạt động

## 1. MD5 là gì?

**MD5** (Message-Digest Algorithm 5) là một hàm băm mật mã (cryptographic hash function) do Ronald Rivest thiết kế năm 1991.

Đặc điểm:

- **Đầu vào**: chuỗi byte **bất kỳ** (1 byte, 1MB hay 1GB đều được).
- **Đầu ra**: chuỗi **128 bit** (16 byte), thường biểu diễn dưới dạng **32 ký tự hex** như:

  ```
  a1b2c3d4e5f6789012345678abcdef01
  ```

- **Tính một chiều (one-way)**: từ output KHÔNG thể tính ngược lại input.
- **Tính va chạm (collision-resistant, yếu)**: khó tìm 2 input khác nhau có cùng MD5. _Lưu ý_: MD5 hiện đã bị bẻ collision cho attack chủ động, không còn an toàn cho chữ ký số, nhưng vẫn **tốt cho mục đích fingerprint / định danh** như trong game này.
- **Tính quyết định (deterministic)**: cùng input → luôn cho cùng output.

---

## 2. MD5 trong Tỉu Xài dùng để làm gì?

Trong widget game Tỉu Xài của MXH, mỗi **phiên** (round) được gắn một chuỗi MD5 32 ký tự, hiển thị ở footer:

```
┌─────────────────────────────────────────┐
│ 💰 Ví 100.000             📋 COPY MD5   │
├─────────────────────────────────────────┤
│ [MD5]  a1b2c3d4e5f6789012345678abcdef01 │
└─────────────────────────────────────────┘
```

### Tác dụng chính:

#### 2.1. Định danh duy nhất cho phiên (unique session ID)

Dãy 32 ký tự hex có **2^128 ≈ 3.4 × 10^38** giá trị có thể. Kể cả server chạy 1 phiên/giây liên tục trong **10 tỷ năm** cũng không thể trùng MD5.

- **Dễ copy chia sẻ**: user có thể chụp/copy để bàn luận với người khác về 1 phiên cụ thể.
- **Log/debug**: khi có tranh chấp, admin tra `md5_hash` trong DB để xác định đúng phiên đang nói tới.
- **Tránh nhầm `round_code`**: `round_code` chỉ có 7 chữ số (ví dụ `2001460`) — dễ gõ nhầm/nhớ nhầm; MD5 dài, khó giả mạo.

#### 2.2. Chống giả mạo kết quả (anti-forgery lightweight)

Khi kết hợp với timestamp + random 16 byte cryptographically-secure (dùng `random_bytes()` của PHP/OpenSSL):

```php
$md5 = md5($round_code . ':' . microtime(true) . ':' . bin2hex(random_bytes(16)));
```

- MD5 của phiên được **server sinh và lưu vào DB ngay khi mở phiên** — user thấy nó từ **giây đầu tiên** của phase betting.
- Server KHÔNG thể nói dối rằng phiên đó có MD5 khác sau khi phiên kết thúc (vì client đã nhận và thấy MD5 từ đầu).
- Input có 128 bit random → attacker KHÔNG thể brute-force đoán input (keyspace quá lớn).

#### 2.3. Placeholder cho provably-fair (tương lai)

MD5 **hiện tại** chỉ là định danh random → **không phải** hash của kết quả xúc xắc → user KHÔNG verify được dice qua MD5.

**Tương lai** có thể nâng cấp lên **provably-fair commit-reveal**:

1. **Commit phase** (khi mở phiên): server tung sẵn 3 viên dice + sinh `server_seed` bí mật. Công bố `md5_hash = md5(round_code:server_seed:d1d2d3)`.
2. **Reveal phase** (khi kết thúc phiên): server công bố `server_seed` + `dice`. User tự tính `md5(round_code:server_seed:d1d2d3)` và so với MD5 ban đầu → nếu khớp → server KHÔNG thể đã thay dice sau khi user đặt cược.

Ở bản hiện tại chưa triển khai cơ chế này — MD5 chỉ mang ý nghĩa **định danh phiên**, không có ý nghĩa verify.

---

## 3. Cách MD5 được sinh trong code

### 3.1. Backend — lúc mở phiên mới

File `mxh/backend/src/Repositories/TaiXiuRepository.php`, hàm `getOrCreateCurrentRound()`:

```php
$md5 = md5($roundCode . ':' . microtime(true) . ':' . bin2hex(random_bytes(16)));
$stmt->execute([$deadline, $roundCode, $md5]);
```

- `$roundCode`: mã phiên 7 chữ số (ví dụ `2001460`).
- `microtime(true)`: timestamp có 4 chữ số sau dấu phẩy (`1735296789.1234`).
- `random_bytes(16)`: **16 byte cryptographically-secure random** từ `/dev/urandom` (Linux) / `CryptGenRandom` (Windows) → 128 bit entropy.
- `bin2hex(...)`: chuyển sang hex 32 ký tự.

Chuỗi đầu vào của `md5()` có dạng:

```
2001460:1735296789.1234:a3f2e1b4c5d67890fedcba1234567890
```

→ MD5 đầu ra:

```
e8a71c3f9b2d5e4f6a8c9b1d2e3f4a5b
```

### 3.2. Backend — KHÔNG overwrite khi resolve phiên

Hàm `resolveRound()` trong repository **không update `md5_hash`** → giá trị sinh lúc mở phiên được **giữ nguyên xuyên suốt**.

### 3.3. Frontend — query và hiển thị

File `mxh/frontend/src/services/graphql.js`:

```js
const CURRENT_ROUND_FIELDS = `id round_code md5_hash status phase ...`;
```

File `mxh/frontend/src/components/TaiXiuFloatingWidget.jsx`:

```jsx
<code className="tx-md5-value">{round.md5_hash}</code>
```

Font monospace hệ thống (`ui-monospace, SF Mono, Segoe UI Mono, Menlo, Consolas`) → 32 ký tự hex căn chỉnh đều tăm tắp, không bị co giãn.

### 3.4. Nút COPY MD5

Nhấn `📋 COPY MD5` → gọi `navigator.clipboard.writeText(round.md5_hash)` → copy đúng 32 ký tự vào clipboard.

---

## 4. Khi nào MD5 hiển thị `—`?

Chỉ xảy ra với **phiên legacy** đã tồn tại trong DB trước khi nâng cấp code sinh md5-lúc-mở-phiên — các row này có `md5_hash = ''`.

Sau 1-2 vòng phiên (30s/phiên), DB đã toàn phiên mới → dấu `—` tự biến mất.

---

## 5. Câu hỏi thường gặp

**Q: MD5 có thể dùng để verify kết quả xúc xắc không?**  
A: Không ở bản hiện tại. Xem mục 2.3 — cần nâng cấp commit-reveal để có verify thật sự.

**Q: Tại sao không dùng SHA-256?**  
A: MD5 đủ cho mục đích định danh (không cần chống collision mạnh) và ngắn hơn (32 hex vs 64 hex), dễ hiển thị trong UI. Khi nâng cấp provably-fair sẽ cân nhắc chuyển sang SHA-256.

**Q: Nếu copy MD5 và báo admin tranh chấp?**  
A: Admin dùng:

```sql
SELECT * FROM tai_xiu_rounds WHERE md5_hash = 'e8a71c3f9b2d5e4f6a8c9b1d2e3f4a5b';
```

→ ra đúng phiên + dice + bet history + thời gian → đối chiếu giao dịch.

**Q: MD5 có lộ thông tin gì không?**  
A: Không. Là hàm 1 chiều + input có 128 bit random → KHÔNG suy ra được `round_code`, `timestamp` hay dice từ MD5.

**Q: Tại sao tên game là "Tỉu Xài" mà DB/code vẫn dùng `tai_xiu`?**  
A: Text UI được đảo vần (`Tài`→`Tỉu`, `Xỉu`→`Xài`) để phù hợp với ngữ cảnh dự án (yêu cầu nội quy bài tập). Code/DB schema (`tai_xiu_rounds`, `TaiXiuService`, `taiXiuPlaceBet`, enum key `'tai'`/`'xiu'`...) **giữ nguyên** để tránh phá migration, GraphQL schema đã deploy, và state client đã lưu. Đây là rebrand thuần text, không phải refactor toàn diện. Các phe cược hiển thị là **TỈU** (tổng 11-18) và **XÀI** (tổng 3-10), nhưng mapping về backend vẫn là `tai`/`xiu`.

---

## 6. Tham chiếu code

| Việc | File | Hàm / Vị trí |
| --- | --- | --- |
| Sinh MD5 lúc mở phiên | `backend/src/Repositories/TaiXiuRepository.php` | `getOrCreateCurrentRound()` |
| Giữ MD5 khi resolve | `backend/src/Repositories/TaiXiuRepository.php` | `resolveRound()` (không UPDATE md5_hash) |
| Expose qua GraphQL | `backend/src/GraphQL/Types/TaiXiuCurrentRoundType.php` | field `md5_hash: String!` |
| Trả về payload | `backend/src/Services/TaiXiuService.php` | `buildCurrentRoundPayload()` |
| Query frontend | `frontend/src/services/graphql.js` | `CURRENT_ROUND_FIELDS` |
| Hiển thị UI | `frontend/src/components/TaiXiuFloatingWidget.jsx` | footer `.tx-md5-line` |
| Style | `frontend/src/styles.css` | `.tx-md5-prefix`, `.tx-md5-value` |

---

_Tài liệu này thuộc dự án MXH — game Tỉu Xài._
