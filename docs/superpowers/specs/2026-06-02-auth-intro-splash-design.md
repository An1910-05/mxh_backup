# Auth Intro Splash — Design Spec

**Date:** 2026-06-02
**Scope:** Frontend only (React + Vite). No backend / DB / docker changes.

## Goal

Phát một video intro logo iPock dạng splash overlay toàn màn hình khi người dùng mở
trang đăng nhập (`/login`) lần đầu trong phiên, sau đó tự mờ dần để lộ form đăng nhập.

## Decisions (chốt với user)

| Vấn đề | Lựa chọn |
|--------|----------|
| Kiểu hiển thị | Splash overlay toàn màn hình, chạy 1 lần rồi fade-out |
| Tần suất | 1 lần mỗi phiên (`sessionStorage`) |
| Âm thanh | Tắt tiếng hoàn toàn (`muted`) — bắt buộc để autoplay chạy |
| Phạm vi | Chỉ trang `/login` |

## Best practices áp dụng (nguồn web)

- `autoPlay muted playsInline` — bắt buộc để autoplay chạy trên iOS Safari & Chrome.
- `preload="metadata"` — cân bằng cho nội dung above-the-fold.
- Có nút **Bỏ qua** + phím **ESC** — không ép người dùng xem.
- Tôn trọng `prefers-reduced-motion` — bỏ qua video, vào thẳng login.
- Nền overlay tối/gradient để tránh nháy trắng trước khi video load.

## Components & files

1. **Asset:** `frontend/public/ipock-intro.mp4` (copy từ video gốc ~2.3MB), phục vụ tại `/ipock-intro.mp4`.
2. **`frontend/src/components/AuthIntroSplash.jsx`** (mới)
   - Props: `onFinish()`.
   - Render `<video autoPlay muted playsInline preload="metadata">`.
   - Overlay `position: fixed; inset: 0` z-index cao, nền gradient brand.
   - Đóng (fade-out ~0.5s rồi gọi `onFinish`) khi: `onEnded`, click **Bỏ qua**, hoặc **ESC**.
   - Fallback: nếu video lỗi (`onError`) → gọi `onFinish` ngay.
3. **`frontend/src/pages/LoginPage.jsx`** (sửa)
   - State `showIntro` khởi tạo: chưa xem trong session **và** không bật reduced-motion.
   - Khi đóng: set `sessionStorage['ipock_intro_seen'] = '1'` + ẩn overlay.
   - Render `{showIntro && <AuthIntroSplash onFinish={...} />}` trước `<AuthShell>`.
4. **`frontend/src/styles.css`** (sửa) — thêm `.auth-intro-splash`, `.auth-intro-video`,
   `.auth-intro-skip`, trạng thái `.auth-intro-splash--closing`, và `@media (prefers-reduced-motion)`.
5. **`mxh/README.md`** — ghi vào mục "Cập nhật gần đây" theo quy ước CLAUDE.md.

## Out of scope (YAGNI)

- Không thêm WebM/poster (mp4 H.264 đủ tương thích; nền gradient chống nháy).
- Không thêm thư viện mới (dùng CSS transition thuần thay vì `motion`).
- Không backend / migration / start.cmd (thuần frontend, Vite HMR).

## Verification

- Chạy Vite (HMR), mở `/login`: video phát muted full-screen → fade-out lộ form.
- Bấm Bỏ qua / ESC: đóng ngay.
- Reload trong cùng phiên: không hiện lại.
- `npm run build` không lỗi.
