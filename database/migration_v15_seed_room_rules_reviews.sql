-- Migration v15: Seed room house rules and review data.
-- Safe to rerun (idempotent).

BEGIN;

-- 1) Add practical house rules to existing rooms.
WITH ranked_rooms AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.rooms
),
rule_templates AS (
  SELECT *
  FROM (VALUES
    (1, FALSE, TRUE,  TRUE,  FALSE, TRUE,  TRUE,  2, 'Giữ yên lặng sau 22h, không hút thuốc trong phòng, khách qua đêm cần báo trước.'),
    (2, FALSE, TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  3, 'Được nấu ăn nhẹ, giữ vệ sinh khu bếp chung, thú cưng nhỏ cần trao đổi trước.'),
    (3, TRUE,  FALSE, TRUE,  FALSE, FALSE, TRUE,  2, 'Nhà chung chủ, hạn chế về sau 23h, không tổ chức tiệc hoặc gây ồn vào buổi tối.'),
    (4, FALSE, TRUE,  FALSE, FALSE, TRUE,  FALSE, 1, 'Không nấu ăn trong phòng, không hút thuốc, ưu tiên người đi làm hoặc sinh viên ở lâu dài.'),
    (5, FALSE, TRUE,  TRUE,  FALSE, TRUE,  TRUE,  4, 'Giữ vệ sinh khu sinh hoạt chung, để xe đúng vị trí, không tự ý khoan tường hoặc thay khóa.'),
    (6, FALSE, TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  2, 'Có thể nuôi thú cưng nhỏ, không để thú cưng gây ồn, dọn vệ sinh hành lang sau khi sử dụng.'),
    (7, TRUE,  FALSE, FALSE, FALSE, FALSE, TRUE,  1, 'Phòng phù hợp người ở một mình, hạn chế tiếp khách, tắt điện nước khi ra khỏi phòng.'),
    (8, FALSE, TRUE,  TRUE,  FALSE, TRUE,  TRUE,  3, 'Tự do giờ giấc, không mở nhạc lớn sau 22h30, báo trước nếu có người thân ở lại.'),
    (9, FALSE, TRUE,  TRUE,  FALSE, FALSE, TRUE,  2, 'Không hút thuốc, không gây ồn trong giờ nghỉ trưa, đóng phí dịch vụ đúng hạn.'),
    (10, FALSE, TRUE, TRUE,  TRUE,  TRUE,  TRUE,  4, 'Phù hợp nhóm bạn ở ghép, giữ trật tự khu dân cư, thú cưng cần tiêm phòng đầy đủ.')
  ) AS v(template_no, is_owner_occupied, has_private_hours, allow_cooking, allow_pets, allow_visitors, has_parking, max_occupants, house_rules)
)
UPDATE public.rooms r
SET
  is_owner_occupied = t.is_owner_occupied,
  has_private_hours = t.has_private_hours,
  allow_cooking = t.allow_cooking,
  allow_pets = t.allow_pets,
  allow_visitors = t.allow_visitors,
  has_parking = t.has_parking,
  max_occupants = t.max_occupants,
  house_rules = t.house_rules,
  updated_at = NOW()
FROM ranked_rooms rr
JOIN rule_templates t ON t.template_no = ((rr.rn - 1) % 10) + 1
WHERE r.id = rr.id;

-- 2) Seed reviews for visible approved rooms using existing tenant accounts.
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS landlord_response TEXT,
  ADD COLUMN IF NOT EXISTS landlord_responded_at TIMESTAMPTZ;

WITH tenants AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.users
  WHERE role = 'tenant'
),
rooms AS (
  SELECT
    r.id,
    r.host_id,
    ROW_NUMBER() OVER (ORDER BY r.created_at, r.id) AS rn
  FROM public.rooms r
  WHERE r.status = 'approved'
    AND COALESCE(r.is_hidden, FALSE) = FALSE
),
tenant_count AS (
  SELECT COUNT(*)::INT AS total FROM tenants
),
review_templates AS (
  SELECT *
  FROM (VALUES
    (1, 1, 5, 'Phòng sạch, đúng ảnh, chủ nhà phản hồi nhanh. Khu vực đi lại thuận tiện và an ninh ổn.'),
    (2, 2, 4, 'Nội thất cơ bản đầy đủ, giá hợp lý. Buổi tối hơi đông xe nhưng không quá ảnh hưởng.'),
    (3, 3, 5, 'Mình rất hài lòng vì phòng thoáng, có chỗ để xe và giờ giấc khá thoải mái.'),
    (4, 4, 3, 'Phòng ổn so với giá, nhưng cách âm chưa tốt. Ai ngủ sớm nên hỏi kỹ trước khi thuê.'),
    (5, 5, 4, 'Khu dân cư yên tĩnh, chủ nhà hỗ trợ nhiệt tình. Điểm cộng là gần chợ và quán ăn.'),
    (6, 6, 5, 'Phòng mới, vệ sinh tốt, nước mạnh. Quy định rõ ràng nên ở khá dễ chịu.'),
    (7, 7, 4, 'Không gian vừa đủ cho một người, chi phí minh bạch. Mình thích phần nội quy rõ ràng.'),
    (8, 8, 3, 'Phòng dùng ổn, nhưng giờ cao điểm hơi kẹt xe. Nên xem phòng vào buổi chiều để đánh giá đúng.'),
    (9, 9, 5, 'Rất đáng tiền, chủ nhà thân thiện, khu vực an toàn. Có thể ở lâu dài.'),
    (10, 10, 4, 'Phòng phù hợp ở ghép, tiện ích xung quanh đầy đủ. Cần giữ vệ sinh chung tốt hơn một chút.'),
    (11, 11, 5, 'Môi giới tư vấn kỹ, lịch xem phòng đúng giờ. Phòng giống mô tả và không phát sinh phí lạ.'),
    (12, 12, 4, 'Tổng thể hài lòng. Nếu bổ sung thêm máy giặt riêng thì sẽ hoàn thiện hơn.')
  ) AS v(review_no, tenant_seed, rating, comment)
),
mapped AS (
  SELECT
    r.id AS room_id,
    t.id AS user_id,
    rt.rating,
    rt.comment,
    CASE
      WHEN rt.rating >= 5 THEN 'Cảm ơn bạn đã đánh giá tốt. Chủ nhà sẽ tiếp tục giữ chất lượng phòng ổn định.'
      WHEN rt.rating = 4 THEN 'Cảm ơn góp ý của bạn. Chủ nhà sẽ ghi nhận để cải thiện thêm trải nghiệm thuê.'
      ELSE NULL
    END AS landlord_response,
    NOW() - ((rt.review_no % 14) || ' days')::INTERVAL AS created_at
  FROM review_templates rt
  JOIN rooms r ON r.rn = ((rt.review_no - 1) % GREATEST((SELECT COUNT(*) FROM rooms), 1)) + 1
  JOIN tenant_count tc ON tc.total > 0
  JOIN tenants t ON t.rn = ((rt.tenant_seed - 1) % tc.total) + 1
  WHERE t.id <> r.host_id
)
INSERT INTO public.reviews (
  room_id,
  user_id,
  rating,
  comment,
  is_hidden,
  landlord_response,
  landlord_responded_at,
  created_at,
  updated_at
)
SELECT
  room_id,
  user_id,
  rating,
  comment,
  FALSE,
  landlord_response,
  CASE WHEN landlord_response IS NOT NULL THEN created_at + INTERVAL '1 day' ELSE NULL END,
  created_at,
  NOW()
FROM mapped
ON CONFLICT (room_id, user_id) DO UPDATE SET
  rating = EXCLUDED.rating,
  comment = EXCLUDED.comment,
  is_hidden = FALSE,
  hidden_reason = NULL,
  hidden_at = NULL,
  hidden_by = NULL,
  landlord_response = EXCLUDED.landlord_response,
  landlord_responded_at = EXCLUDED.landlord_responded_at,
  updated_at = NOW();

COMMIT;

-- Optional checks:
-- SELECT id, title, house_rules, allow_pets, max_occupants FROM public.rooms ORDER BY created_at LIMIT 20;
-- SELECT r.title, rv.rating, rv.comment, u.full_name
-- FROM public.reviews rv
-- JOIN public.rooms r ON r.id = rv.room_id
-- JOIN public.users u ON u.id = rv.user_id
-- ORDER BY rv.created_at DESC;
