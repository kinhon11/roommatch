-- ============================================================
-- Migration v3: Marketplace Upgrade
-- Chạy file này SAU migration_v2_fixes.sql
-- ============================================================

-- 1. Thêm cột is_hidden cho rooms (landlord tạm ẩn phòng)
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Thêm cột is_locked cho users (admin khóa tài khoản)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Thêm cột is_verified cho users (badge chủ nhà đã xác minh)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Index cho is_hidden để query nhanh hơn
CREATE INDEX IF NOT EXISTS idx_rooms_is_hidden ON public.rooms(is_hidden);

-- 5. Index cho is_locked
CREATE INDEX IF NOT EXISTS idx_users_is_locked ON public.users(is_locked);

-- 6. Cập nhật RLS: Admin có thể xem TẤT CẢ phòng (kể cả pending/rejected)
DROP POLICY IF EXISTS "Admin can view all rooms" ON public.rooms;
CREATE POLICY "Admin can view all rooms" ON public.rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 7. Admin có thể update tất cả phòng
DROP POLICY IF EXISTS "Admin can update all rooms" ON public.rooms;
CREATE POLICY "Admin can update all rooms" ON public.rooms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 8. Admin có thể update tất cả users
DROP POLICY IF EXISTS "Admin can update all users" ON public.users;
CREATE POLICY "Admin can update all users" ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 9. Admin có thể xem tất cả reports
DROP POLICY IF EXISTS "Admin can view all reports" ON public.reports;
CREATE POLICY "Admin can view all reports" ON public.reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- End of Migration v3
-- ============================================================
