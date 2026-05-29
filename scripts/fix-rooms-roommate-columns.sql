alter table public.rooms
  add column if not exists is_owner_occupied boolean default false,
  add column if not exists has_private_hours boolean default true,
  add column if not exists allow_cooking boolean default true,
  add column if not exists allow_pets boolean default false,
  add column if not exists allow_visitors boolean default true,
  add column if not exists has_parking boolean default false,
  add column if not exists max_occupants integer,
  add column if not exists house_rules text,
  add column if not exists roommate_gender_preference text default 'any',
  add column if not exists roommate_occupation_preference text default 'any',
  add column if not exists roommate_schedule_preference text default 'flexible',
  add column if not exists roommate_cleanliness_preference text default 'normal',
  add column if not exists roommate_allow_smoker boolean default false,
  add column if not exists roommate_allow_pets boolean default true,
  add column if not exists current_roommate_summary text;

notify pgrst, 'reload schema';
