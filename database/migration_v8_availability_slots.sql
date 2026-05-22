-- Migration v8: Enforce practical room availability rules.
-- Public room listings should only show available approved rooms in the API.
-- This migration keeps database slot changes consistent when roommate requests are accepted.

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS available_slots INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_available_slots INT;

ALTER TABLE public.roommate_requests
  ADD COLUMN IF NOT EXISTS occupants INT NOT NULL DEFAULT 1;

UPDATE public.rooms
SET
  available_slots = GREATEST(COALESCE(available_slots, 0), 0),
  is_available = CASE WHEN COALESCE(available_slots, 0) > 0 THEN is_available ELSE FALSE END
WHERE available_slots IS NULL OR available_slots <= 0;

CREATE OR REPLACE FUNCTION adjust_room_available_slots() RETURNS TRIGGER AS $$
DECLARE
  occupant_delta INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    occupant_delta := GREATEST(COALESCE(NEW.occupants, 1), 1);

    IF OLD.status <> 'accepted' AND NEW.status = 'accepted' THEN
      UPDATE public.rooms
      SET
        available_slots = GREATEST(COALESCE(available_slots, 0) - occupant_delta, 0),
        is_available = GREATEST(COALESCE(available_slots, 0) - occupant_delta, 0) > 0,
        last_available_slots = CASE
          WHEN GREATEST(COALESCE(available_slots, 0) - occupant_delta, 0) > 0
            THEN GREATEST(COALESCE(available_slots, 0) - occupant_delta, 0)
          ELSE COALESCE(NULLIF(available_slots, 0), last_available_slots)
        END
      WHERE id = NEW.room_id;
    ELSIF OLD.status = 'accepted' AND NEW.status <> 'accepted' THEN
      UPDATE public.rooms
      SET
        available_slots = COALESCE(available_slots, 0) + GREATEST(COALESCE(OLD.occupants, 1), 1),
        is_available = TRUE
      WHERE id = NEW.room_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_adjust_slots ON public.roommate_requests;
CREATE TRIGGER trigger_adjust_slots
  AFTER UPDATE ON public.roommate_requests
  FOR EACH ROW EXECUTE FUNCTION adjust_room_available_slots();

CREATE OR REPLACE FUNCTION restore_slot_on_request_delete() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'accepted' THEN
    UPDATE public.rooms
    SET
      available_slots = COALESCE(available_slots, 0) + GREATEST(COALESCE(OLD.occupants, 1), 1),
      is_available = TRUE
    WHERE id = OLD.room_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_restore_slot_on_delete ON public.roommate_requests;
CREATE TRIGGER trigger_restore_slot_on_delete
  AFTER DELETE ON public.roommate_requests
  FOR EACH ROW EXECUTE FUNCTION restore_slot_on_request_delete();
