-- Migration v20: Room-level roommate criteria and current occupant summary.

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS roommate_gender_preference TEXT NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS roommate_occupation_preference TEXT NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS roommate_schedule_preference TEXT NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS roommate_cleanliness_preference TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS roommate_allow_smoker BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS roommate_allow_pets BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS current_roommate_summary TEXT;

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_roommate_gender_preference_check,
  ADD CONSTRAINT rooms_roommate_gender_preference_check
  CHECK (roommate_gender_preference IN ('any', 'male', 'female'));

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_roommate_occupation_preference_check,
  ADD CONSTRAINT rooms_roommate_occupation_preference_check
  CHECK (roommate_occupation_preference IN ('any', 'student', 'office_worker', 'worker', 'other'));

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_roommate_schedule_preference_check,
  ADD CONSTRAINT rooms_roommate_schedule_preference_check
  CHECK (roommate_schedule_preference IN ('student', 'office', 'shift', 'night', 'flexible', 'other'));

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_roommate_cleanliness_preference_check,
  ADD CONSTRAINT rooms_roommate_cleanliness_preference_check
  CHECK (roommate_cleanliness_preference IN ('normal', 'tidy', 'very_tidy'));
