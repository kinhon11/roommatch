-- ============================================================
-- RoommieMatch - Supabase Storage Setup
-- An toàn để chạy nhiều lần (idempotent)
-- ============================================================

-- Tạo bucket 'room-images' để lưu ảnh phòng
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'room-images',
  'room-images',
  TRUE,           -- Public bucket: ai cũng xem được URL ảnh
  5242880,        -- Max 5MB mỗi ảnh
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880;

-- ── Xóa policies cũ nếu đã tồn tại (để tránh lỗi duplicate) ──
DROP POLICY IF EXISTS "Public read room images"         ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload room images"   ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete own room images" ON storage.objects;

-- Policy: Ai cũng đọc được ảnh (public)
CREATE POLICY "Public read room images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'room-images');

-- Policy: Chỉ user đã đăng nhập mới upload được
CREATE POLICY "Auth users upload room images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'room-images' AND auth.role() = 'authenticated');

-- Policy: Chỉ người upload mới xóa được file của mình
CREATE POLICY "Auth users delete own room images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'room-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Xác nhận
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'room-images';

