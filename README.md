# RoommieMatch

RoommieMatch là ứng dụng web hỗ trợ tìm kiếm phòng trọ, quản lý bài đăng phòng, đặt lịch xem phòng, yêu thích phòng, đặt cọc, trò chuyện và gợi ý bằng AI. Dự án gồm frontend React, backend Node.js/Express và cơ sở dữ liệu Supabase.

## Công nghệ sử dụng

- Frontend: React, Vite, React Router, Axios, Supabase JS
- Backend: Node.js, Express, Supabase JS, JWT, Multer
- Database: Supabase PostgreSQL
- AI: Google Gemini, MiniMax AI
- Test/Lint: Node Test Runner, ESLint

## Cấu trúc thư mục

```text
DOAN/
├── backend/              # API server Express
├── frontend/             # Ứng dụng React/Vite
├── database/             # Schema, migration và seed dữ liệu Supabase
├── scripts/              # Script tiện ích, ví dụ kiểm tra encoding
├── Chapter2_Diagrams.md  # Tài liệu sơ đồ chương 2
├── package.json          # Lệnh kiểm tra tổng ở thư mục gốc
└── README.md
```

## Yêu cầu cài đặt

- Node.js 18 trở lên
- npm
- Tài khoản Supabase
- API key Gemini hoặc MiniMax nếu dùng tính năng AI

## Cài đặt

Chạy lần lượt các lệnh sau từ thư mục gốc dự án:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

## Cấu hình môi trường

Tạo file `.env` cho backend:

```bash
copy backend\.env.example backend\.env
```

Các biến chính trong `backend/.env`:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
GEMINI_API_KEY=your-gemini-key
MINIMAX_API_KEY=your-minimax-key
AI_PROVIDER=auto
```

Tạo file `.env` cho frontend:

```bash
copy frontend\.env.example frontend\.env
```

Các biến chính trong `frontend/.env`:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:5000/api
VITE_GEMINI_API_KEY=your-gemini-key
```

## Cấu hình database

Trong Supabase SQL Editor, chạy các file trong thư mục `database/` theo thứ tự phù hợp:

1. `schema.sql`
2. Các file `migration_*.sql`
3. `storage_setup.sql`
4. `seed_data.sql` hoặc `seed_rooms.sql` nếu cần dữ liệu mẫu

## Chạy dự án

Mở terminal thứ nhất để chạy backend:

```bash
npm --prefix backend run dev
```

Backend mặc định chạy tại:

```text
http://localhost:5000
```

Kiểm tra API:

```text
http://localhost:5000/api/health
```

Mở terminal thứ hai để chạy frontend:

```bash
npm --prefix frontend run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:5173
```

## Lệnh kiểm tra

Chạy toàn bộ kiểm tra từ thư mục gốc:

```bash
npm test
```

Chạy riêng từng phần:

```bash
npm run check:encoding
npm run test:backend
npm run lint:frontend
npm run build:frontend
```

## Chức năng chính

- Đăng ký, đăng nhập và quản lý phiên người dùng
- Tìm kiếm, xem chi tiết và yêu thích phòng trọ
- Chủ trọ đăng, sửa và quản lý phòng
- Quản trị viên duyệt phòng, quản lý người dùng và báo cáo
- Đặt lịch xem phòng, quản lý yêu cầu ghép phòng
- Đặt cọc và theo dõi trạng thái đặt cọc
- Thông báo và trò chuyện giữa người dùng
- Trợ lý AI gợi ý phòng, trả lời câu hỏi và hỗ trợ người thuê

## Ghi chú

- Không commit file `.env` vì chứa khóa bí mật.
- Nếu đã xóa `node_modules`, chỉ cần chạy lại các lệnh `npm install`.
- File `Chapter2_Diagrams.md` là tài liệu sơ đồ phục vụ phần báo cáo chương 2.
