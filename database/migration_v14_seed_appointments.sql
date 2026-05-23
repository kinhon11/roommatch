-- Migration v14: Seed demo appointments for the appointment page.
-- Safe to rerun (idempotent).
--
-- It uses existing tenants and available rooms. For rooms assigned to a broker,
-- landlord_id is set to broker_id because the current appointment flow treats
-- landlord_id as the responsible user shown on /appointments.

BEGIN;

WITH tenants AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.users
  WHERE role = 'tenant'
),
rooms AS (
  SELECT
    r.id AS room_id,
    COALESCE(r.broker_id, r.host_id) AS responsible_user_id,
    ROW_NUMBER() OVER (ORDER BY r.created_at, r.id) AS rn
  FROM public.rooms r
  WHERE r.status = 'approved'
    AND COALESCE(r.is_hidden, FALSE) = FALSE
    AND COALESCE(r.is_available, TRUE) = TRUE
    AND COALESCE(r.available_slots, 1) > 0
    AND COALESCE(r.broker_id, r.host_id) IS NOT NULL
),
tenant_count AS (
  SELECT COUNT(*)::INT AS total FROM tenants
),
room_count AS (
  SELECT COUNT(*)::INT AS total FROM rooms
),
demo_appointments AS (
  SELECT *
  FROM (VALUES
    ('11111111-1111-4111-8111-111111111111'::UUID, 1, 1, NOW() + INTERVAL '1 day 09 hours',  'pending',   NULL),
    ('22222222-2222-4222-8222-222222222222'::UUID, 2, 2, NOW() + INTERVAL '2 days 14 hours', 'confirmed', NULL),
    ('33333333-3333-4333-8333-333333333333'::UUID, 3, 3, NOW() + INTERVAL '3 days 10 hours', 'pending',   NULL),
    ('44444444-4444-4444-8444-444444444444'::UUID, 4, 4, NOW() + INTERVAL '4 days 15 hours', 'confirmed', NULL),
    ('55555555-5555-4555-8555-555555555555'::UUID, 5, 5, NOW() - INTERVAL '2 days',          'completed', NULL),
    ('66666666-6666-4666-8666-666666666666'::UUID, 6, 6, NOW() - INTERVAL '1 day',           'no_show',   NULL),
    ('77777777-7777-4777-8777-777777777777'::UUID, 7, 7, NOW() + INTERVAL '5 days 11 hours', 'cancelled', 'Khách đổi khu vực tìm phòng.'),
    ('88888888-8888-4888-8888-888888888888'::UUID, 8, 8, NOW() + INTERVAL '6 days 16 hours', 'confirmed', NULL)
  ) AS v(id, tenant_rn, room_rn, scheduled_at, status, cancellation_reason)
),
mapped AS (
  SELECT
    d.id,
    rm.room_id,
    tn.id AS tenant_id,
    rm.responsible_user_id AS landlord_id,
    d.scheduled_at,
    d.status,
    d.cancellation_reason
  FROM demo_appointments d
  JOIN tenant_count tc ON tc.total > 0
  JOIN room_count rc ON rc.total > 0
  JOIN tenants tn ON tn.rn = ((d.tenant_rn - 1) % tc.total) + 1
  JOIN rooms rm ON rm.rn = ((d.room_rn - 1) % rc.total) + 1
  WHERE tn.id <> rm.responsible_user_id
)
INSERT INTO public.appointments (
  id,
  room_id,
  tenant_id,
  landlord_id,
  scheduled_at,
  status,
  cancellation_reason,
  created_at,
  updated_at
)
SELECT
  id,
  room_id,
  tenant_id,
  landlord_id,
  scheduled_at,
  status,
  cancellation_reason,
  NOW(),
  NOW()
FROM mapped
ON CONFLICT (id) DO UPDATE SET
  room_id = EXCLUDED.room_id,
  tenant_id = EXCLUDED.tenant_id,
  landlord_id = EXCLUDED.landlord_id,
  scheduled_at = EXCLUDED.scheduled_at,
  status = EXCLUDED.status,
  cancellation_reason = EXCLUDED.cancellation_reason,
  updated_at = NOW();

COMMIT;

-- Optional checks:
-- SELECT a.id, a.status, a.scheduled_at, r.title, t.full_name AS tenant, u.full_name AS responsible
-- FROM public.appointments a
-- JOIN public.rooms r ON r.id = a.room_id
-- JOIN public.users t ON t.id = a.tenant_id
-- JOIN public.users u ON u.id = a.landlord_id
-- WHERE a.id IN (
--   '11111111-1111-4111-8111-111111111111',
--   '22222222-2222-4222-8222-222222222222',
--   '33333333-3333-4333-8333-333333333333',
--   '44444444-4444-4444-8444-444444444444',
--   '55555555-5555-4555-8555-555555555555',
--   '66666666-6666-4666-8666-666666666666',
--   '77777777-7777-4777-8777-777777777777',
--   '88888888-8888-4888-8888-888888888888'
-- )
-- ORDER BY a.scheduled_at DESC;
