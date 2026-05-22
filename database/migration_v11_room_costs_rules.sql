-- Migration v11: Practical room costs and house rules.

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS electricity_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS water_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS internet_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS parking_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS service_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_cycle TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS is_owner_occupied BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_private_hours BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_cooking BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_pets BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allow_visitors BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS has_parking BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_occupants INT,
  ADD COLUMN IF NOT EXISTS house_rules TEXT;

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_payment_cycle_check,
  ADD CONSTRAINT rooms_payment_cycle_check
  CHECK (payment_cycle IN ('monthly', 'quarterly', 'negotiable'));

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_costs_non_negative_check,
  ADD CONSTRAINT rooms_costs_non_negative_check
  CHECK (
    COALESCE(deposit_amount, 0) >= 0
    AND COALESCE(electricity_price, 0) >= 0
    AND COALESCE(water_price, 0) >= 0
    AND COALESCE(internet_fee, 0) >= 0
    AND COALESCE(parking_fee, 0) >= 0
    AND COALESCE(service_fee, 0) >= 0
  );

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_max_occupants_positive_check,
  ADD CONSTRAINT rooms_max_occupants_positive_check
  CHECK (max_occupants IS NULL OR max_occupants > 0);

CREATE INDEX IF NOT EXISTS idx_rooms_practical_rules
  ON public.rooms(is_owner_occupied, has_private_hours, allow_pets, has_parking);
