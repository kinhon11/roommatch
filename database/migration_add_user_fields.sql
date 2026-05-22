-- ============================================================
-- Migration: Thêm cột address và bio vào bảng users
-- Chạy trong Supabase SQL Editor
-- ============================================================

-- Thêm cột address (địa chỉ người dùng)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Xác nhận
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;
