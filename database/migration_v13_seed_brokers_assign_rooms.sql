-- Migration v13: Seed broker data from existing users and assign to existing rooms.
-- Safe to rerun (idempotent).
--
-- Why this approach:
-- - public.users(id) references auth.users(id), so creating brand-new users from SQL alone
--   is not always safe unless auth accounts already exist.
-- - We therefore promote existing users to role='broker' and then assign brokers to rooms.

BEGIN;

-- 1) Promote explicit accounts to broker role (if they already exist).
-- You can change these emails to match your demo accounts.
UPDATE public.users
SET role = 'broker', updated_at = NOW()
WHERE email IN ('broker1@test.com', 'broker2@test.com', 'broker3@test.com');

-- 2) Fallback: if still no broker exists, promote up to 3 tenant users.
WITH existing_brokers AS (
  SELECT COUNT(*)::INT AS total FROM public.users WHERE role = 'broker'
),
candidate_tenants AS (
  SELECT id
  FROM public.users
  WHERE role = 'tenant'
  ORDER BY created_at ASC
  LIMIT 3
)
UPDATE public.users u
SET role = 'broker', updated_at = NOW()
WHERE u.id IN (SELECT id FROM candidate_tenants)
  AND (SELECT total FROM existing_brokers) = 0;

-- 3) Assign brokers to rooms that have no broker yet.
-- Priority: approved + visible rooms first, then by created_at.
WITH brokers AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.users
  WHERE role = 'broker'
),
rooms_to_assign AS (
  SELECT
    r.id,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN r.status = 'approved' THEN 0 ELSE 1 END,
        r.created_at,
        r.id
    ) AS rn
  FROM public.rooms r
  WHERE r.broker_id IS NULL
),
broker_count AS (
  SELECT COUNT(*)::INT AS total FROM brokers
),
mapping AS (
  SELECT
    rta.id AS room_id,
    b.id AS broker_id
  FROM rooms_to_assign rta
  JOIN broker_count bc ON bc.total > 0
  JOIN brokers b ON b.rn = ((rta.rn - 1) % bc.total) + 1
)
UPDATE public.rooms r
SET broker_id = m.broker_id, updated_at = NOW()
FROM mapping m
WHERE r.id = m.room_id;

COMMIT;

-- Optional checks:
-- SELECT id, email, role FROM public.users WHERE role = 'broker' ORDER BY created_at;
-- SELECT id, title, status, broker_id FROM public.rooms ORDER BY created_at DESC LIMIT 30;
