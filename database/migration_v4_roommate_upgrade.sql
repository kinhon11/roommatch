-- ============================================================
-- Migration v4: Roommate Request Upgrade
-- Chạy SAU migration_v3_marketplace.sql
-- ============================================================

-- 1. Thêm các field mới cho roommate_requests
ALTER TABLE public.roommate_requests
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS move_in_date DATE,
  ADD COLUMN IF NOT EXISTS occupants INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS has_pet BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Index cho tra cứu nhanh
CREATE INDEX IF NOT EXISTS idx_roommate_requests_room_status
  ON public.roommate_requests(room_id, status);

CREATE INDEX IF NOT EXISTS idx_roommate_requests_tenant
  ON public.roommate_requests(tenant_id, status);

-- ============================================================
-- End of Migration v4
-- ============================================================
