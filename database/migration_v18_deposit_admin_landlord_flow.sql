-- Migration v18: Deposit flow with admin escrow and landlord decision

ALTER TABLE public.room_deposits
  DROP CONSTRAINT IF EXISTS room_deposits_status_check,
  ADD CONSTRAINT room_deposits_status_check
  CHECK (status IN (
    'pending_payment',
    'admin_confirmed',
    'landlord_accepted',
    'refund_pending',
    'paid',
    'cancelled',
    'refunded'
  ));

ALTER TABLE public.deposit_transactions
  DROP CONSTRAINT IF EXISTS deposit_transactions_to_status_check,
  ADD CONSTRAINT deposit_transactions_to_status_check
  CHECK (to_status IN (
    'pending_payment',
    'admin_confirmed',
    'landlord_accepted',
    'refund_pending',
    'paid',
    'cancelled',
    'refunded'
  ));

DROP INDEX IF EXISTS idx_room_deposits_one_active_full_room_hold;
CREATE UNIQUE INDEX idx_room_deposits_one_active_full_room_hold
  ON public.room_deposits(room_id)
  WHERE status IN ('pending_payment', 'admin_confirmed', 'landlord_accepted', 'paid')
    AND COALESCE(deposit_scope, 'full_room') = 'full_room';

DROP INDEX IF EXISTS idx_room_deposits_one_active_tenant_per_room;
CREATE UNIQUE INDEX idx_room_deposits_one_active_tenant_per_room
  ON public.room_deposits(room_id, tenant_id)
  WHERE status IN ('pending_payment', 'admin_confirmed', 'landlord_accepted', 'paid');

DROP INDEX IF EXISTS idx_room_deposits_scope_status;
CREATE INDEX idx_room_deposits_scope_status
  ON public.room_deposits(room_id, deposit_scope, status);
