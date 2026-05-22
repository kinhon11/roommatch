-- ============================================================
-- Migration v5: Review System Upgrade
-- Chạy SAU migration_v4_roommate_upgrade.sql
-- ============================================================
-- Mục tiêu:
--   1. Thêm updated_at cho reviews
--   2. Cập nhật RLS cho phép owner UPDATE/DELETE review của mình
-- ============================================================

-- 1. Thêm cột updated_at cho reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Trigger tự cập nhật updated_at cho reviews
DROP TRIGGER IF EXISTS trigger_reviews_updated_at ON public.reviews;
CREATE TRIGGER trigger_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. RLS: User có thể UPDATE review của mình
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. RLS: User có thể DELETE review của mình
DROP POLICY IF EXISTS "Users can delete own reviews" ON public.reviews;
CREATE POLICY "Users can delete own reviews" ON public.reviews FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Index cho tra cứu review theo user (tối ưu query eligibility)
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);

-- ============================================================
-- End of Migration v5
-- ============================================================
