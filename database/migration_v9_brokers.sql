-- Migration v9: Broker role and room assignment.

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('tenant', 'landlord', 'broker', 'admin'));

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS broker_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_broker_id ON public.rooms(broker_id);

DROP POLICY IF EXISTS "Approved rooms viewable" ON public.rooms;
CREATE POLICY "Approved rooms viewable" ON public.rooms FOR SELECT
  USING (
    status = 'approved'
    OR auth.uid() = host_id
    OR auth.uid() = broker_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Landlords and brokers update assigned rooms" ON public.rooms;
DROP POLICY IF EXISTS "Landlords update own rooms" ON public.rooms;
CREATE POLICY "Landlords and brokers update assigned rooms" ON public.rooms FOR UPDATE
  USING (auth.uid() = host_id OR auth.uid() = broker_id)
  WITH CHECK (auth.uid() = host_id OR auth.uid() = broker_id);

DROP POLICY IF EXISTS "Landlords and brokers view requests for their rooms" ON public.roommate_requests;
DROP POLICY IF EXISTS "Landlords can view requests for their rooms" ON public.roommate_requests;
CREATE POLICY "Landlords and brokers view requests for their rooms" ON public.roommate_requests FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = room_id
      AND (host_id = auth.uid() OR broker_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Landlords and brokers update status of requests for their rooms" ON public.roommate_requests;
DROP POLICY IF EXISTS "Landlords can update status of requests for their rooms" ON public.roommate_requests;
CREATE POLICY "Landlords and brokers update status of requests for their rooms" ON public.roommate_requests FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = room_id
      AND (host_id = auth.uid() OR broker_id = auth.uid())
  )
) WITH CHECK (
  status IN ('accepted', 'rejected')
);
