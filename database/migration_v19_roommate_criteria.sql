-- Migration v19: Practical roommate matching criteria for roommate requests.

ALTER TABLE public.roommate_requests
  ADD COLUMN IF NOT EXISTS requester_gender TEXT NOT NULL DEFAULT 'prefer_not_to_say',
  ADD COLUMN IF NOT EXISTS preferred_roommate_gender TEXT NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS schedule_type TEXT NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS cleanliness_level TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS is_smoker BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS okay_with_smoker BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS okay_with_pets BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS roommate_note TEXT;

ALTER TABLE public.roommate_requests
  DROP CONSTRAINT IF EXISTS roommate_requests_requester_gender_check,
  ADD CONSTRAINT roommate_requests_requester_gender_check
  CHECK (requester_gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

ALTER TABLE public.roommate_requests
  DROP CONSTRAINT IF EXISTS roommate_requests_preferred_roommate_gender_check,
  ADD CONSTRAINT roommate_requests_preferred_roommate_gender_check
  CHECK (preferred_roommate_gender IN ('any', 'male', 'female'));

ALTER TABLE public.roommate_requests
  DROP CONSTRAINT IF EXISTS roommate_requests_schedule_type_check,
  ADD CONSTRAINT roommate_requests_schedule_type_check
  CHECK (schedule_type IN ('student', 'office', 'shift', 'night', 'flexible', 'other'));

ALTER TABLE public.roommate_requests
  DROP CONSTRAINT IF EXISTS roommate_requests_cleanliness_level_check,
  ADD CONSTRAINT roommate_requests_cleanliness_level_check
  CHECK (cleanliness_level IN ('normal', 'tidy', 'very_tidy'));
