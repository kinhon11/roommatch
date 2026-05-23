-- Migration v16: Backfill practical payment costs for all existing rooms.
-- Safe to rerun. Future rooms are also protected by backend defaults.

BEGIN;

WITH ranked_rooms AS (
  SELECT
    id,
    price,
    city,
    ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.rooms
),
cost_templates AS (
  SELECT *
  FROM (VALUES
    (1, 4000::NUMERIC, 100000::NUMERIC, 100000::NUMERIC, 100000::NUMERIC,  50000::NUMERIC),
    (2, 4500::NUMERIC, 120000::NUMERIC, 120000::NUMERIC, 150000::NUMERIC,  80000::NUMERIC),
    (3, 3800::NUMERIC,  80000::NUMERIC,      0::NUMERIC,      0::NUMERIC,  50000::NUMERIC),
    (4, 4200::NUMERIC, 100000::NUMERIC, 100000::NUMERIC,      0::NUMERIC, 100000::NUMERIC),
    (5, 3500::NUMERIC,  70000::NUMERIC,  80000::NUMERIC, 100000::NUMERIC,  50000::NUMERIC),
    (6, 4000::NUMERIC, 100000::NUMERIC,      0::NUMERIC, 120000::NUMERIC, 100000::NUMERIC)
  ) AS v(template_no, electricity_price, water_price, internet_fee, parking_fee, service_fee)
)
UPDATE public.rooms r
SET
  deposit_amount = COALESCE(NULLIF(r.deposit_amount, 0), r.price),
  electricity_price = COALESCE(NULLIF(r.electricity_price, 0), t.electricity_price),
  water_price = COALESCE(NULLIF(r.water_price, 0), t.water_price),
  internet_fee = COALESCE(r.internet_fee, t.internet_fee),
  parking_fee = COALESCE(r.parking_fee, t.parking_fee),
  service_fee = COALESCE(r.service_fee, t.service_fee),
  payment_cycle = COALESCE(NULLIF(r.payment_cycle, ''), 'monthly'),
  updated_at = NOW()
FROM ranked_rooms rr
JOIN cost_templates t ON t.template_no = ((rr.rn - 1) % 6) + 1
WHERE r.id = rr.id;

COMMIT;

-- Optional check:
-- SELECT title, price, deposit_amount, electricity_price, water_price, internet_fee, parking_fee, service_fee, payment_cycle
-- FROM public.rooms
-- ORDER BY created_at DESC;
