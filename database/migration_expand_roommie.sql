-- ============================================================
-- Migration: Roommate Requests, Appointments, Notifications, and Slots
-- ============================================================

-- 1. Add available_slots column to rooms
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS available_slots INT NOT NULL DEFAULT 0;

-- 2. Table: roommate_requests
CREATE TABLE IF NOT EXISTS public.roommate_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS trigger_roommate_requests_updated_at ON public.roommate_requests;
CREATE TRIGGER trigger_roommate_requests_updated_at
  BEFORE UPDATE ON public.roommate_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Table: appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  landlord_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_appointments_updated_at ON public.appointments;
CREATE TRIGGER trigger_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Table: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('request', 'appointment', 'message')),
  payload    JSONB NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_roommate_requests_room ON public.roommate_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_roommate_requests_tenant ON public.roommate_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_room ON public.appointments(room_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON public.appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_landlord ON public.appointments(landlord_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- 6. RLS Policies
-- Enable RLS on new tables
ALTER TABLE public.roommate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- roommate_requests policies
DROP POLICY IF EXISTS "Tenants can view own requests" ON public.roommate_requests;
CREATE POLICY "Tenants can view own requests" ON public.roommate_requests FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants can create requests" ON public.roommate_requests;
CREATE POLICY "Tenants can create requests" ON public.roommate_requests FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Landlords can view requests for their rooms" ON public.roommate_requests;
CREATE POLICY "Landlords can view requests for their rooms" ON public.roommate_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND host_id = auth.uid())
);

DROP POLICY IF EXISTS "Landlords can update status of requests for their rooms" ON public.roommate_requests;
CREATE POLICY "Landlords can update status of requests for their rooms" ON public.roommate_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND host_id = auth.uid())
) WITH CHECK (
  status IN ('accepted', 'rejected')
);

-- appointments policies
DROP POLICY IF EXISTS "Tenants can view own appointments" ON public.appointments;
CREATE POLICY "Tenants can view own appointments" ON public.appointments FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Landlords can view appointments for their rooms" ON public.appointments;
CREATE POLICY "Landlords can view appointments for their rooms" ON public.appointments FOR SELECT USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Tenants can create appointments" ON public.appointments;
CREATE POLICY "Tenants can create appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Landlords can update appointment status" ON public.appointments;
CREATE POLICY "Landlords can update appointment status" ON public.appointments FOR UPDATE USING (auth.uid() = landlord_id) WITH CHECK (status IN ('completed', 'cancelled'));

-- notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications" ON public.notifications FOR INSERT WITH CHECK (TRUE);

-- 7. Trigger to adjust available_slots when a request is accepted/rejected
CREATE OR REPLACE FUNCTION adjust_room_available_slots() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'accepted' THEN
      UPDATE public.rooms SET available_slots = GREATEST(available_slots - 1, 0) WHERE id = NEW.room_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'accepted' AND NEW.status = 'accepted' THEN
      UPDATE public.rooms SET available_slots = GREATEST(available_slots - 1, 0) WHERE id = NEW.room_id;
    ELSIF OLD.status = 'accepted' AND NEW.status <> 'accepted' THEN
      UPDATE public.rooms SET available_slots = available_slots + 1 WHERE id = NEW.room_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_adjust_slots ON public.roommate_requests;
CREATE TRIGGER trigger_adjust_slots
  AFTER INSERT OR UPDATE ON public.roommate_requests
  FOR EACH ROW EXECUTE FUNCTION adjust_room_available_slots();

-- ============================================================
-- End of Migration
-- ============================================================
