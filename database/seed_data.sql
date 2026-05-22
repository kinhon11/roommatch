-- ============================================================
-- RoommieMatch - Seed Data mẫu (6 phòng)
-- Yêu cầu: Đã đăng nhập bằng landlord@test.com trên web app
--          để tạo record trong public.users
-- ============================================================

-- Kiểm tra landlord tồn tại chưa
SELECT id, email, role FROM public.users WHERE email = 'landlord@test.com';

-- ============================================================
-- INSERT 6 PHÒNG (dùng subquery thay vì biến)
-- ============================================================

-- ── PHÒNG 1: HCM ──
INSERT INTO public.rooms (host_id, title, description, price, address, city, area, status)
SELECT
  id,
  'Phòng trọ cao cấp full nội thất, gần ĐH Bách Khoa',
  'Phòng trọ hiện đại, đầy đủ nội thất cao cấp. Gần trường đại học, siêu thị và các tiện ích. Phòng rộng rãi, thoáng mát, an ninh tốt.',
  3500000,
  '15 Nguyễn Văn Cừ, Phường 4, Quận 5',
  'Hồ Chí Minh',
  25,
  'approved'
FROM public.users WHERE email = 'landlord@test.com';

-- Ảnh phòng 1
INSERT INTO public.room_images (room_id, image_url, is_primary)
SELECT r.id, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', true
FROM public.rooms r JOIN public.users u ON r.host_id = u.id
WHERE u.email = 'landlord@test.com' AND r.title = 'Phòng trọ cao cấp full nội thất, gần ĐH Bách Khoa';

INSERT INTO public.room_images (room_id, image_url, is_primary)
SELECT r.id, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800', false
FROM public.rooms r JOIN public.users u ON r.host_id = u.id
WHERE u.email = 'landlord@test.com' AND r.title = 'Phòng trọ cao cấp full nội thất, gần ĐH Bách Khoa';

-- Tiện ích phòng 1
INSERT INTO public.room_amenities (room_id, amenity_id)
SELECT r.id, a.id FROM public.rooms r
JOIN public.users u ON r.host_id = u.id
JOIN public.amenities a ON a.name IN ('WiFi', 'Điều hòa', 'Chỗ để xe', 'Tủ lạnh', 'Nước nóng')
WHERE u.email = 'landlord@test.com' AND r.title = 'Phòng trọ cao cấp full nội thất, gần ĐH Bách Khoa';

-- ── PHÒNG 2: HN ──
INSERT INTO public.rooms (host_id, title, description, price, address, city, area, status)
SELECT id,
  'Studio tiện nghi trung tâm Hà Nội, gần phố cổ',
  'Studio đẹp, đầy đủ tiện nghi tại vị trí cực đắc địa ngay trung tâm. Ban công view đẹp, an ninh 24/7.',
  5500000, '42 Hàng Bông, Hoàn Kiếm', 'Hà Nội', 30, 'approved'
FROM public.users WHERE email = 'landlord@test.com';

INSERT INTO public.room_images (room_id, image_url, is_primary)
SELECT r.id, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800', true
FROM public.rooms r JOIN public.users u ON r.host_id = u.id
WHERE u.email = 'landlord@test.com' AND r.title = 'Studio tiện nghi trung tâm Hà Nội, gần phố cổ';

INSERT INTO public.room_amenities (room_id, amenity_id)
SELECT r.id, a.id FROM public.rooms r
JOIN public.users u ON r.host_id = u.id
JOIN public.amenities a ON a.name IN ('WiFi', 'Điều hòa', 'Bảo vệ 24/7', 'Toilet riêng')
WHERE u.email = 'landlord@test.com' AND r.title = 'Studio tiện nghi trung tâm Hà Nội, gần phố cổ';

-- ── PHÒNG 3: ĐÀ NẴNG ──
INSERT INTO public.rooms (host_id, title, description, price, address, city, area, status)
SELECT id,
  'Phòng trọ giá rẻ sinh viên, gần ĐH Kinh Tế Đà Nẵng',
  'Phòng trọ sạch sẽ, thoáng mát, phù hợp sinh viên. Giá rẻ, gần trường học và chợ.',
  1800000, '88 Nguyễn Lương Bằng, Liên Chiểu', 'Đà Nẵng', 18, 'approved'
FROM public.users WHERE email = 'landlord@test.com';

INSERT INTO public.room_images (room_id, image_url, is_primary)
SELECT r.id, 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800', true
FROM public.rooms r JOIN public.users u ON r.host_id = u.id
WHERE u.email = 'landlord@test.com' AND r.title = 'Phòng trọ giá rẻ sinh viên, gần ĐH Kinh Tế Đà Nẵng';

INSERT INTO public.room_amenities (room_id, amenity_id)
SELECT r.id, a.id FROM public.rooms r
JOIN public.users u ON r.host_id = u.id
JOIN public.amenities a ON a.name IN ('WiFi', 'Chỗ để xe', 'Nước nóng')
WHERE u.email = 'landlord@test.com' AND r.title = 'Phòng trọ giá rẻ sinh viên, gần ĐH Kinh Tế Đà Nẵng';

-- ── PHÒNG 4: HCM BÌNH THẠNH ──
INSERT INTO public.rooms (host_id, title, description, price, address, city, area, status)
SELECT id,
  'Căn hộ mini sang trọng Q.Bình Thạnh, đầy đủ nội thất',
  'Căn hộ mini được thiết kế tinh tế, hiện đại. Khu vực an ninh, gần nhiều nhà hàng quán cà phê.',
  6500000, '78 Xô Viết Nghệ Tĩnh, Phường 26, Bình Thạnh', 'Hồ Chí Minh', 35, 'approved'
FROM public.users WHERE email = 'landlord@test.com';

INSERT INTO public.room_images (room_id, image_url, is_primary)
SELECT r.id, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', true
FROM public.rooms r JOIN public.users u ON r.host_id = u.id
WHERE u.email = 'landlord@test.com' AND r.title = 'Căn hộ mini sang trọng Q.Bình Thạnh, đầy đủ nội thất';

INSERT INTO public.room_amenities (room_id, amenity_id)
SELECT r.id, a.id FROM public.rooms r
JOIN public.users u ON r.host_id = u.id
JOIN public.amenities a ON a.name IN ('WiFi', 'Điều hòa', 'Máy giặt', 'Tủ lạnh', 'Bảo vệ 24/7', 'Toilet riêng')
WHERE u.email = 'landlord@test.com' AND r.title = 'Căn hộ mini sang trọng Q.Bình Thạnh, đầy đủ nội thất';

-- ── PHÒNG 5: HẢI PHÒNG ──
INSERT INTO public.rooms (host_id, title, description, price, address, city, area, status)
SELECT id,
  'Phòng trọ rộng rãi Hải Phòng, có ban công',
  'Phòng rộng rãi thoải mái, có ban công nhìn ra vườn cây xanh mát. Gần bến xe trung tâm.',
  2200000, '55 Lê Lợi, Hồng Bàng', 'Hải Phòng', 22, 'approved'
FROM public.users WHERE email = 'landlord@test.com';

INSERT INTO public.room_images (room_id, image_url, is_primary)
SELECT r.id, 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800', true
FROM public.rooms r JOIN public.users u ON r.host_id = u.id
WHERE u.email = 'landlord@test.com' AND r.title = 'Phòng trọ rộng rãi Hải Phòng, có ban công';

INSERT INTO public.room_amenities (room_id, amenity_id)
SELECT r.id, a.id FROM public.rooms r
JOIN public.users u ON r.host_id = u.id
JOIN public.amenities a ON a.name IN ('WiFi', 'Chỗ để xe', 'Nước nóng', 'Toilet riêng')
WHERE u.email = 'landlord@test.com' AND r.title = 'Phòng trọ rộng rãi Hải Phòng, có ban công';

-- ── PHÒNG 6: NHA TRANG ──
INSERT INTO public.rooms (host_id, title, description, price, address, city, area, status)
SELECT id,
  'Phòng trọ cao cấp Nha Trang view biển',
  'Phòng cao cấp với tầm nhìn tuyệt đẹp ra biển Nha Trang. Nội thất hiện đại, máy lạnh, WC riêng.',
  4200000, '10 Trần Phú, Lộc Thọ', 'Nha Trang', 28, 'approved'
FROM public.users WHERE email = 'landlord@test.com';

INSERT INTO public.room_images (room_id, image_url, is_primary)
SELECT r.id, 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800', true
FROM public.rooms r JOIN public.users u ON r.host_id = u.id
WHERE u.email = 'landlord@test.com' AND r.title = 'Phòng trọ cao cấp Nha Trang view biển';

INSERT INTO public.room_images (room_id, image_url, is_primary)
SELECT r.id, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800', false
FROM public.rooms r JOIN public.users u ON r.host_id = u.id
WHERE u.email = 'landlord@test.com' AND r.title = 'Phòng trọ cao cấp Nha Trang view biển';

INSERT INTO public.room_amenities (room_id, amenity_id)
SELECT r.id, a.id FROM public.rooms r
JOIN public.users u ON r.host_id = u.id
JOIN public.amenities a ON a.name IN ('WiFi', 'Điều hòa', 'Toilet riêng', 'Nước nóng', 'Bảo vệ 24/7')
WHERE u.email = 'landlord@test.com' AND r.title = 'Phòng trọ cao cấp Nha Trang view biển';

-- ── Xác nhận kết quả ──
SELECT r.title, r.city, r.price, r.status,
       COUNT(DISTINCT ri.id) AS so_anh,
       COUNT(DISTINCT ra.amenity_id) AS so_tien_ich
FROM public.rooms r
JOIN public.users u ON r.host_id = u.id
LEFT JOIN public.room_images ri ON ri.room_id = r.id
LEFT JOIN public.room_amenities ra ON ra.room_id = r.id
WHERE u.email = 'landlord@test.com'
GROUP BY r.id, r.title, r.city, r.price, r.status
ORDER BY r.created_at;
