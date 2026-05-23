-- Broker commission workflow

CREATE TABLE IF NOT EXISTS public.broker_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.broker_leads(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  commission_rate NUMERIC CHECK (commission_rate IS NULL OR commission_rate >= 0),
  basis_amount NUMERIC CHECK (basis_amount IS NULL OR basis_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending_collection' CHECK (status IN ('pending_collection', 'collected', 'paid_to_broker', 'cancelled')),
  note TEXT,
  collected_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broker_commissions_lead_id ON public.broker_commissions(lead_id);
CREATE INDEX IF NOT EXISTS idx_broker_commissions_broker_status ON public.broker_commissions(broker_id, status);
CREATE INDEX IF NOT EXISTS idx_broker_commissions_room_id ON public.broker_commissions(room_id);
CREATE INDEX IF NOT EXISTS idx_broker_commissions_tenant_id ON public.broker_commissions(tenant_id);

ALTER TABLE public.broker_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brokers view own commissions" ON public.broker_commissions;
CREATE POLICY "Brokers view own commissions" ON public.broker_commissions FOR SELECT
  USING ((select auth.uid()) = broker_id);

DROP POLICY IF EXISTS "Admins manage broker commissions" ON public.broker_commissions;
CREATE POLICY "Admins manage broker commissions" ON public.broker_commissions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role = 'admin'));
