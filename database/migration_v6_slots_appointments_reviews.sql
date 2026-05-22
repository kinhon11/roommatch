-- Migration v6: Slots, appointments, and review workflow

-- Rooms: keep is_available as a manual landlord switch, available_slots as capacity.
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS last_available_slots INT;

UPDATE public.rooms
SET is_available = FALSE
WHERE COALESCE(available_slots, 0) <= 0;

CREATE OR REPLACE FUNCTION sync_room_availability_from_slots() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.available_slots <= 0 THEN
    NEW.available_slots := 0;
    NEW.is_available := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_room_availability_from_slots ON public.rooms;
CREATE TRIGGER trigger_sync_room_availability_from_slots
  BEFORE INSERT OR UPDATE OF available_slots ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION sync_room_availability_from_slots();

-- Appointments: richer lifecycle and cancellation reason.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

UPDATE public.appointments
SET status = 'confirmed'
WHERE status = 'scheduled';

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));

CREATE INDEX IF NOT EXISTS idx_appointments_room_landlord_time
  ON public.appointments(room_id, landlord_id, scheduled_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_duplicate_active_room_time
  ON public.appointments(room_id, scheduled_at)
  WHERE status IN ('pending', 'confirmed');

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_duplicate_active_landlord_time
  ON public.appointments(landlord_id, scheduled_at)
  WHERE status IN ('pending', 'confirmed');

-- Reviews: admin moderation and landlord response.
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS landlord_response TEXT,
  ADD COLUMN IF NOT EXISTS landlord_responded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reviews_visible_room
  ON public.reviews(room_id, is_hidden);

-- RLS updates for appointments.
DROP POLICY IF EXISTS "Landlords can update appointment status" ON public.appointments;
CREATE POLICY "Landlords can update appointment status" ON public.appointments FOR UPDATE
  USING (auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Tenants can cancel own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Tenants can update own active appointments" ON public.appointments;
CREATE POLICY "Tenants can update own active appointments" ON public.appointments FOR UPDATE
  USING (auth.uid() = tenant_id AND status IN ('pending', 'confirmed'))
  WITH CHECK (auth.uid() = tenant_id);

-- RLS updates for reviews.
DROP POLICY IF EXISTS "Reviews viewable" ON public.reviews;
DROP POLICY IF EXISTS "Reviews are public" ON public.reviews;
DROP POLICY IF EXISTS "Visible reviews are public" ON public.reviews;
CREATE POLICY "Visible reviews are public" ON public.reviews FOR SELECT
  USING (is_hidden = FALSE);

DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;
CREATE POLICY "Admins can manage reviews" ON public.reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
