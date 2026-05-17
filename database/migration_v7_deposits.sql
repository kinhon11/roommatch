-- Migration v7: Manual room deposit / hold workflow

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('request', 'appointment', 'message', 'deposit'));

CREATE TABLE IF NOT EXISTS public.room_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  roommate_request_id UUID REFERENCES public.roommate_requests(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'cancelled', 'refunded')),
  payment_method TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  landlord_note TEXT,
  cancel_reason TEXT,
  refund_reason TEXT,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deposit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES public.room_deposits(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (to_status IN ('pending_payment', 'paid', 'cancelled', 'refunded')),
  amount NUMERIC(12,2),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_room_deposits_updated_at ON public.room_deposits;
CREATE TRIGGER trigger_room_deposits_updated_at
  BEFORE UPDATE ON public.room_deposits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_room_deposits_room ON public.room_deposits(room_id);
CREATE INDEX IF NOT EXISTS idx_room_deposits_tenant ON public.room_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_room_deposits_landlord ON public.room_deposits(landlord_id);
CREATE INDEX IF NOT EXISTS idx_room_deposits_status ON public.room_deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_deposit ON public.deposit_transactions(deposit_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_deposits_one_active_hold_per_room
  ON public.room_deposits(room_id)
  WHERE status IN ('pending_payment', 'paid');

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_deposits_one_active_tenant_per_room
  ON public.room_deposits(room_id, tenant_id)
  WHERE status IN ('pending_payment', 'paid');

ALTER TABLE public.room_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view room deposits" ON public.room_deposits;
CREATE POLICY "Participants can view room deposits" ON public.room_deposits FOR SELECT
  USING (
    auth.uid() = tenant_id
    OR auth.uid() = landlord_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Tenants can create own deposits" ON public.room_deposits;
CREATE POLICY "Tenants can create own deposits" ON public.room_deposits FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Participants can update room deposits" ON public.room_deposits;
CREATE POLICY "Participants can update room deposits" ON public.room_deposits FOR UPDATE
  USING (
    auth.uid() = tenant_id
    OR auth.uid() = landlord_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = tenant_id
    OR auth.uid() = landlord_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Participants can view deposit transactions" ON public.deposit_transactions;
CREATE POLICY "Participants can view deposit transactions" ON public.deposit_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.room_deposits d
      WHERE d.id = deposit_id
        AND (
          d.tenant_id = auth.uid()
          OR d.landlord_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert deposit transactions" ON public.deposit_transactions;
CREATE POLICY "Authenticated users can insert deposit transactions" ON public.deposit_transactions FOR INSERT
  WITH CHECK (auth.uid() = actor_id);
