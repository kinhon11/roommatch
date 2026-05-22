-- ============================================================
-- Migration v5: Room approval workflow hardening
-- Run AFTER migration_v4_roommate_upgrade.sql
-- ============================================================

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS auto_hidden_reason TEXT,
  ADD COLUMN IF NOT EXISTS hidden_by_report_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.room_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (to_status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_approval_history_room
  ON public.room_approval_history(room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_approval_history_admin
  ON public.room_approval_history(admin_id);

ALTER TABLE public.room_approval_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Room owners and admins can view approval history" ON public.room_approval_history;
CREATE POLICY "Room owners and admins can view approval history"
  ON public.room_approval_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = room_approval_history.room_id
        AND rooms.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert approval history" ON public.room_approval_history;
CREATE POLICY "Admins can insert approval history"
  ON public.room_approval_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Backend uses service role, but these policies keep direct client access coherent.

-- ============================================================
-- End of Migration v5
-- ============================================================
