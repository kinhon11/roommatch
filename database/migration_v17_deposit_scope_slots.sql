-- Migration v17: Deposit scope for full-room holds vs shared-room slot deposits.

ALTER TABLE public.room_deposits
  ADD COLUMN IF NOT EXISTS deposit_scope TEXT NOT NULL DEFAULT 'full_room',
  ADD COLUMN IF NOT EXISTS deposit_slots INT NOT NULL DEFAULT 1;

ALTER TABLE public.room_deposits
  DROP CONSTRAINT IF EXISTS room_deposits_deposit_scope_check,
  ADD CONSTRAINT room_deposits_deposit_scope_check
    CHECK (deposit_scope IN ('full_room', 'slot'));

ALTER TABLE public.room_deposits
  DROP CONSTRAINT IF EXISTS room_deposits_deposit_slots_check,
  ADD CONSTRAINT room_deposits_deposit_slots_check
    CHECK (deposit_slots > 0);

UPDATE public.room_deposits d
SET
  deposit_scope = CASE WHEN d.roommate_request_id IS NOT NULL THEN 'slot' ELSE 'full_room' END,
  deposit_slots = CASE
    WHEN d.roommate_request_id IS NOT NULL THEN GREATEST(COALESCE(rr.occupants, d.deposit_slots, 1), 1)
    ELSE GREATEST(COALESCE(d.deposit_slots, 1), 1)
  END
FROM public.roommate_requests rr
WHERE d.roommate_request_id = rr.id;

UPDATE public.room_deposits
SET
  deposit_scope = COALESCE(deposit_scope, 'full_room'),
  deposit_slots = GREATEST(COALESCE(deposit_slots, 1), 1)
WHERE roommate_request_id IS NULL
   OR deposit_scope IS NULL
   OR deposit_slots IS NULL
   OR deposit_slots <= 0;

DROP INDEX IF EXISTS idx_room_deposits_one_active_hold_per_room;
DROP INDEX IF EXISTS idx_room_deposits_one_active_full_room_hold;
CREATE UNIQUE INDEX idx_room_deposits_one_active_full_room_hold
  ON public.room_deposits(room_id)
  WHERE status IN ('pending_payment', 'paid')
    AND deposit_scope = 'full_room';

DROP INDEX IF EXISTS idx_room_deposits_one_active_tenant_per_room;
CREATE UNIQUE INDEX idx_room_deposits_one_active_tenant_per_room
  ON public.room_deposits(room_id, tenant_id)
  WHERE status IN ('pending_payment', 'paid');

CREATE INDEX IF NOT EXISTS idx_room_deposits_scope_status
  ON public.room_deposits(room_id, deposit_scope, status);
