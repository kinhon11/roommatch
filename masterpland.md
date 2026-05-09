# Master Plan — RoommieMatch

## Trạng thái tổng quan (cập nhật: 04/2026)

| Module | Backend | Frontend | DB/RLS | Realtime | Ghi chú |
|--------|---------|----------|--------|----------|---------|
| Auth (register/login/logout) | ✅ | ✅ | ✅ | — | |
| Profile | ✅ | ✅ | ✅ | — | |
| Rooms (CRUD + duyệt) | ✅ | ✅ | ✅ | — | |
| Room Images (upload) | ✅ | ✅ | ✅ | — | |
| Amenities | ✅ | ✅ | ✅ | — | |
| Reviews | ✅ | ✅ | ✅ | — | |
| Favorites | ✅ | ✅ | ✅ | — | |
| Reports | ✅ | ✅ | ✅ | — | |
| Chat (realtime) | ✅ | ✅ | ✅ | ✅ | |
| Admin Dashboard | ✅ | ✅ | ✅ | — | |
| AI mô tả phòng | ✅ | ✅ | — | — | Gemini API |
| **Roommate Requests** | ✅ | ✅ | ✅ | — | Tenant cancel ✅, slots validation ✅ |
| **Appointments** | ✅ | ✅ | ✅ | — | Tenant/Landlord cancel ✅ |
| **Notifications** | ✅ | ✅ | ✅ | ✅ | markAllRead endpoint ✅ |
| **My Requests Page (Tenant)** | — | ✅ | — | — | Route `/my-requests` |

---

## 5. Mở rộng RoommieMatch: Ở ghép + Appointments + Notifications

### Mục tiêu ✅ ĐÃ HOÀN THÀNH
- Quản lý yêu cầu ở ghép (gửi, duyệt, từ chối, hủy)
- Đặt lịch xem phòng (tạo, xác nhận, hoàn thành, hủy)
- Hệ thống thông báo realtime (bell icon, trang riêng, mark all read)

### Dữ liệu (bảng/cột) ✅
- **rooms**: cột `available_slots INT` — theo dõi số chỗ ở ghép còn trống
- **roommate_requests**: `id`, `room_id`, `tenant_id`, `status (pending/accepted/rejected)`, `created_at`, `updated_at`
- **appointments**: `id`, `room_id`, `tenant_id`, `landlord_id`, `scheduled_at`, `status (scheduled/completed/cancelled)`, `created_at`
- **notifications**: `id`, `user_id`, `type (request/appointment/message)`, `payload JSONB`, `read BOOLEAN`, `created_at`

### API Endpoints ✅
- `POST /api/roommate-requests` – tạo yêu cầu (Tenant); validate slots > 0
- `PATCH /api/roommate-requests/:id` – landlord duyệt/từ chối
- `DELETE /api/roommate-requests/:id` – tenant hủy request pending
- `GET /api/roommate-requests` – liệt kê (tenant: của mình; landlord: tất cả phòng)
- `POST /api/appointments` – tạo lịch hẹn (Tenant)
- `PATCH /api/appointments/:id` – cập nhật trạng thái (Landlord: completed/cancelled; Tenant: cancelled)
- `GET /api/appointments` – danh sách lịch hẹn
- `GET /api/notifications` – lấy tất cả thông báo
- `PATCH /api/notifications/:id/read` – đánh dấu đã đọc
- `PATCH /api/notifications/mark-all-read` – đánh dấu tất cả đã đọc

### RLS / Policies ✅ (trong migration_v2_fixes.sql)
- **roommate_requests**: tenant xem/tạo/xóa của mình; landlord duyệt phòng của họ
- **appointments**: tenant xem/tạo/cancel của mình; landlord xem/update của họ
- **notifications**: user chỉ xem/update của chính mình

### UI (Frontend) ✅
- `RoommateRequestForm` trong `RoomDetail.jsx` — gửi yêu cầu + hiển thị available_slots
- `AppointmentsPage.jsx` — tenant xem + hủy; landlord xác nhận/hủy/hoàn thành
- **`MyRequestsPage.jsx` (/my-requests)** — tenant theo dõi và hủy request
- `LandlordDashboard.jsx` tab "Yêu cầu ở ghép" — hiển thị `full_name` tenant, accept/reject
- `NotificationsPage.jsx` (/notifications) — filter tabs, mark all read
- `NotificationBell.jsx` — badge realtime, dropdown preview

### Database Migrations ✅ (theo thứ tự)
1. `schema.sql` — schema gốc
2. `migration_add_user_fields.sql` — bổ sung trường user
3. `migration_expand_roommie.sql` — 3 bảng mới + RLS + trigger slots
4. `migration_v2_fixes.sql` — RLS fixes (tenant cancel, mark-all-read, trigger improve)

---

## Backlog còn lại (ưu tiên thấp)

### P1 — Cần làm nếu ship production
- [ ] **Xác thực email** khi đăng ký (hiện tắt để dev dễ hơn)
- [ ] **Rate limiting** cho API auth endpoints (tránh brute force)
- [ ] **File size validation** khi upload ảnh phòng
- [ ] **Thông báo message** khi có tin nhắn mới qua chat
- [ ] **Admin xem + xử lý** appointment/request nếu vi phạm

### P2 — Nice to have
- [ ] **Tìm kiếm nâng cao**: filter theo amenities, area, số slot còn trống
- [ ] **Bản đồ** tích hợp Google Maps cho tọa độ phòng
- [ ] **Trang hồ sơ public** của landlord (xem phòng của họ)
- [ ] **Push notification** qua trình duyệt (Web Push API)
- [ ] **Export PDF** lịch hẹn
- [ ] **Unit tests** backend (Jest + supertest) — mục tiêu 80% coverage

### P3 — Tương lai
- [ ] **Mobile app** (React Native)
- [ ] **Thanh toán online** đặt cọc
- [ ] **Hợp đồng điện tử** giữa tenant và landlord
