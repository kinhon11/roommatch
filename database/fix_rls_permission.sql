-- ============================================================
-- RoommieMatch - Fix RLS Permission (42501 error)
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

-- Fix: Cho phép INSERT vào bảng users khi auth.uid() = id
-- (User dùng chính session của mình để tạo profile)

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Cũng cho phép service role insert (nếu có)
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
CREATE POLICY "Service role can insert users"
  ON public.users FOR INSERT
  WITH CHECK (TRUE);

-- Kiểm tra: xem tất cả policies hiện tại trên bảng users
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users';
