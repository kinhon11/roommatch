-- Migration v12: Broker lead management and room recommendations.

CREATE TABLE IF NOT EXISTS public.broker_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  budget_min INTEGER,
  budget_max INTEGER,
  preferred_city TEXT,
  preferred_area TEXT,
  move_in_date DATE,
  occupants INTEGER DEFAULT 1 CHECK (occupants >= 1),
  has_pets BOOLEAN DEFAULT false,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'consulted', 'scheduled', 'visited', 'deposit_ready', 'closed', 'lost')),
  lost_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.broker_lead_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.broker_leads(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_reason TEXT,
  tenant_feedback TEXT,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'interested', 'visited', 'rejected', 'deposit_ready')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lead_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_leads_broker_id ON public.broker_leads(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_leads_status ON public.broker_leads(status);
CREATE INDEX IF NOT EXISTS idx_broker_leads_tenant_id ON public.broker_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_broker_lead_rooms_lead_id ON public.broker_lead_rooms(lead_id);
CREATE INDEX IF NOT EXISTS idx_broker_lead_rooms_room_id ON public.broker_lead_rooms(room_id);
CREATE INDEX IF NOT EXISTS idx_broker_lead_rooms_broker_id ON public.broker_lead_rooms(broker_id);

ALTER TABLE public.broker_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_lead_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brokers manage own leads" ON public.broker_leads;
CREATE POLICY "Brokers manage own leads" ON public.broker_leads FOR ALL
  USING ((select auth.uid()) = broker_id)
  WITH CHECK ((select auth.uid()) = broker_id);

DROP POLICY IF EXISTS "Admins view all broker leads" ON public.broker_leads;
CREATE POLICY "Admins view all broker leads" ON public.broker_leads FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "Brokers manage own lead rooms" ON public.broker_lead_rooms;
CREATE POLICY "Brokers manage own lead rooms" ON public.broker_lead_rooms FOR ALL
  USING ((select auth.uid()) = broker_id)
  WITH CHECK ((select auth.uid()) = broker_id);

DROP POLICY IF EXISTS "Admins view all broker lead rooms" ON public.broker_lead_rooms;
CREATE POLICY "Admins view all broker lead rooms" ON public.broker_lead_rooms FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role = 'admin')
);
