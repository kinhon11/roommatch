# RoommieMatch 🏠
> Nền tảng tìm bạn ở ghép & review nhà trọ — ReactJS + Express + Supabase

---

## 📋 Cấu trúc dự án

```
DOAN/
├── frontend/               # React (Vite) — Port 5173
│   └── src/
│       ├── api/            # apiClient.js (Axios + interceptors)
│       ├── components/
│       │   ├── layout/     # Navbar, ProtectedRoute, ScrollToTop
│       │   ├── notifications/ # NotificationBell (realtime)
│       │   └── ui/         # Button, Input, Card, ...
│       ├── context/        # AuthContext.jsx
│       ├── hooks/          # useAuth.js
│       ├── pages/
│       │   ├── Admin/      # Dashboard (stats, users, reports, rooms)
│       │   ├── Chat/       # ChatPage (realtime messaging)
│       │   ├── Landlord/   # Dashboard, PostRoom, MyRooms, EditRoom
│       │   ├── Profile/    # ProfilePage
│       │   └── Tenant/     # Home, RoomsPage, RoomDetail, FavoritesPage,
│       │                   # AppointmentsPage, MyRequestsPage
│       ├── services/       # roomService, notificationService, ...
│       └── utils/          # format.js (tiền, ngày, ...)
│
├── backend/                # Express API — Port 5000
│   ├── config/             # supabaseClient.js, geminiClient.js
│   ├── controllers/        # authController, roomController, adminController,
│   │                       # roommateRequestController, appointmentController,
│   │                       # notificationController, chatController, ...
│   ├── middleware/         # authMiddleware.js (protect + restrictTo)
│   ├── routes/             # Tất cả routes
│   └── server.js           # Entry point
│
└── database/
    ├── schema.sql                  # Schema gốc (9 bảng + RLS + Seed)
    ├── migration_add_user_fields.sql
    ├── migration_expand_roommie.sql # Bảng roommate_requests, appointments, notifications
    ├── migration_v2_fixes.sql       # RLS fixes, trigger improvements (chạy sau expand)
    ├── migration_v3_marketplace.sql # is_hidden, is_locked, is_verified + admin RLS
    ├── migration_v4_roommate_upgrade.sql # request message, move_in_date, occupants, rejection_reason
    ├── migration_v5_review_upgrade.sql # review updated_at + owner update/delete
    ├── migration_v5_room_approval_workflow.sql # approval history + auto-hide report metadata
    ├── migration_v6_slots_appointments_reviews.sql # slots, appointment workflow, review moderation
    ├── migration_v7_deposits.sql # manual deposit/hold workflow
    ├── storage_setup.sql
    └── seed_data.sql
```

---

## 🚀 Hướng dẫn cài đặt

### Bước 1: Chạy SQL trên Supabase (theo thứ tự)

1. **Supabase Dashboard** → **SQL Editor**
2. Chạy theo thứ tự:
   ```
   1. database/schema.sql
   2. database/migration_add_user_fields.sql
   3. database/migration_expand_roommie.sql
   4. database/migration_v2_fixes.sql    ← Bắt buộc chạy để có đầy đủ RLS
   5. database/migration_v3_marketplace.sql
   6. database/migration_v4_roommate_upgrade.sql
   7. database/migration_v5_review_upgrade.sql
   8. database/migration_v5_room_approval_workflow.sql
   9. database/migration_v6_slots_appointments_reviews.sql
   10. database/migration_v7_deposits.sql
   ```
3. (Tùy chọn) Chạy `database/seed_data.sql` để có dữ liệu mẫu

### Bước 2: Bật Supabase Realtime cho bảng `notifications`

1. Vào **Database** → **Replication** → Bật `notifications` table

### Bước 3: Tắt xác thực email

1. Vào **Authentication** → **Providers** → **Email**
2. Tắt **"Confirm email"** → Save

### Bước 4: Cấu hình Frontend

```bash
cd frontend
cp .env.example .env    # hoặc tạo thủ công .env
# Điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào .env
npm install
npm run dev
```

### Bước 5: Cấu hình Backend

```bash
cd backend
cp .env.example .env    # hoặc tạo thủ công .env
# Điền các biến môi trường (xem bảng bên dưới)
npm install
npm run dev
```

---

## 🔑 Biến môi trường

| File | Biến | Lấy từ đâu |
|------|------|-----------|
| `frontend/.env` | `VITE_SUPABASE_URL` | Supabase → Settings → API |
| `frontend/.env` | `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `backend/.env` | `SUPABASE_URL` | Supabase → Settings → API |
| `backend/.env` | `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role |
| `backend/.env` | `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/publishable |
| `backend/.env` | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `backend/.env` | `MINIMAX_API_KEY` | [MiniMax Platform](https://platform.minimaxi.com/) |
| `backend/.env` | `AI_PROVIDER` | `minimax` hoặc `gemini` |
| `backend/.env` | `PORT` | Mặc định: `5000` |
| `backend/.env` | `CLIENT_URL` | Mặc định: `http://localhost:5173` |

---

## 👥 Phân quyền 3 Roles

| Role | Quyền hạn chính | Dashboard |
|------|-----------------|-----------|
| **Tenant** | Xem phòng, Chat, Review, Yêu thích, Yêu cầu ở ghép, Đặt lịch hẹn, Thông báo | `/` |
| **Landlord** | Đăng tin, Quản lý phòng, Duyệt yêu cầu ở ghép, Quản lý lịch hẹn, AI mô tả và kiểm tra tin đăng | `/landlord/dashboard` |
| **Admin** | Duyệt phòng, Quản lý user & report | `/admin/dashboard` |

> 💡 **Tạo Admin**: Đăng ký tài khoản → Vào Supabase table `users` → Sửa `role` thành `admin`

---

## 📡 API Endpoints

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

### Rooms
```
GET    /api/rooms                     — Danh sách phòng đã duyệt (public, filter: city, minPrice, maxPrice)
GET    /api/rooms/:id                 — Chi tiết phòng (public)
POST   /api/rooms                     — Đăng tin (Landlord)
PUT    /api/rooms/:id                 — Sửa phòng (Landlord)
DELETE /api/rooms/:id                 — Xóa phòng (Landlord/Admin)
GET    /api/rooms/my/listings         — Phòng của tôi (Landlord)
PATCH  /api/rooms/:id/status          — Duyệt/Từ chối (Admin)
POST   /api/rooms/:id/reviews         — Đánh giá (Tenant)
PUT    /api/rooms/:id/reviews/:reviewId — Sửa đánh giá của chính mình
DELETE /api/rooms/:id/reviews/:reviewId — Xóa đánh giá của chính mình/Admin
PATCH  /api/rooms/:id/reviews/:reviewId/moderation — Admin ẩn/hiện review
PATCH  /api/rooms/:id/reviews/:reviewId/response — Landlord phản hồi review
```

### Roommate Requests
```
POST   /api/roommate-requests         — Gửi yêu cầu ở ghép (Tenant)
GET    /api/roommate-requests         — Danh sách: tenant xem của mình, landlord xem tất cả
GET    /api/roommate-requests?roomId= — Danh sách theo phòng (Landlord)
PATCH  /api/roommate-requests/:id     — Duyệt/Từ chối (Landlord) — body: {status: "accepted"|"rejected"}
DELETE /api/roommate-requests/:id     — Hủy request pending (Tenant)
```

### Appointments
```
POST   /api/appointments              — Đặt lịch (Tenant) — body: {room_id, scheduled_at}
GET    /api/appointments              — Danh sách theo role
PATCH  /api/appointments/:id          — Cập nhật trạng thái — body: {status: "confirmed"|"completed"|"cancelled"|"no_show", cancellation_reason?}
PATCH  /api/appointments/:id/reschedule — Đổi lịch — body: {scheduled_at}
```

### Deposits
```
POST   /api/deposits                  — Tenant gửi yêu cầu cọc thủ công
GET    /api/deposits                  — Danh sách cọc theo role
PATCH  /api/deposits/:id/status       — Cập nhật: paid, cancelled, refunded
```

### Notifications
```
GET    /api/notifications             — Tất cả thông báo của user
PATCH  /api/notifications/:id/read    — Đánh dấu 1 thông báo đã đọc
PATCH  /api/notifications/mark-all-read — Đánh dấu TẤT CẢ đã đọc
```

### Chat
```
POST   /api/chat/conversations             — Tạo/lấy conversation với landlord
GET    /api/chat/conversations             — Danh sách cuộc trò chuyện
GET    /api/chat/conversations/:id/messages — Lịch sử tin nhắn
POST   /api/chat/conversations/:id/messages — Gửi tin nhắn
GET    /api/chat/unread-count              — Số tin nhắn chưa đọc
```

### Admin
```
GET    /api/admin/stats               — Thống kê tổng quan
GET    /api/admin/users               — Danh sách user
PATCH  /api/admin/users/:id/role      — Cập nhật role
GET    /api/admin/rooms/pending       — Phòng chờ duyệt
PATCH  /api/rooms/:id/status          — Duyệt/Từ chối phòng
GET    /api/admin/reports             — Danh sách báo cáo
PATCH  /api/admin/reports/:id         — Xử lý báo cáo
```

### Other
```
GET    /api/health                    — Health check
POST   /api/ai/generate-description  — AI viết mô tả phòng (Gemini)
POST   /api/ai/analyze-listing       — AI kiểm tra chất lượng tin đăng
POST   /api/ai/review-summary        — AI tóm tắt review và rủi ro phòng
POST   /api/reports                   — Báo cáo vi phạm
GET    /api/favorites                 — Phòng yêu thích
POST   /api/favorites/:roomId         — Thêm/xóa yêu thích
GET    /api/profile                   — Xem hồ sơ
PUT    /api/profile                   — Cập nhật hồ sơ
```

---

## 🏗️ Luồng nghiệp vụ chính

### Luồng ở ghép
1. Landlord đăng phòng → Admin duyệt → `available_slots` được set
2. Tenant vào chi tiết phòng → bấm "Gửi yêu cầu ở ghép"
3. Landlord nhận notification → vào Dashboard → Tab "Yêu cầu ở ghép" → Chấp nhận/Từ chối
4. `available_slots` tự động giảm khi accepted (Supabase trigger)
5. Tenant nhận notification về kết quả → xem tại `/my-requests`
6. Tenant có thể hủy request nếu còn ở trạng thái `pending`

### Luồng đặt lịch
1. Tenant vào chi tiết phòng → "Đặt lịch hẹn" → chọn ngày giờ
2. Landlord nhận notification → vào `/appointments` → Xác nhận hoặc từ chối
3. Lịch đã xác nhận có thể đánh dấu hoàn thành, không đến, hoặc hủy kèm lý do
4. Tenant và landlord có thể đổi lịch; tenant đổi lịch sẽ chuyển lại về chờ xác nhận

### Realtime Notifications
- Supabase Realtime subscription theo `user_id`
- Bell icon ở Navbar cập nhật badge tức thì
- `/notifications` có filter tabs: Tất cả / Chưa đọc / Ở ghép / Lịch hẹn / Tin nhắn
