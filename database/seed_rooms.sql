-- ============================================================
-- Seed: Sample Room Data
-- Chạy SAU khi đã có ít nhất 1 user landlord trong hệ thống
-- Thay YOUR_LANDLORD_ID bằng UUID thực của landlord
-- ============================================================

-- Bước 1: Lấy landlord ID
-- Chạy query này trước để lấy ID:
-- SELECT id, full_name, role FROM public.users WHERE role = 'landlord' LIMIT 5;

-- Bước 2: Set biến (thay UUID thật vào đây)
DO $$
DECLARE
  v_host UUID;
  v_room UUID;
  v_wifi UUID;
  v_ac UUID;
  v_parking UUID;
  v_kitchen UUID;
  v_washer UUID;
  v_fridge UUID;
  v_balcony UUID;
  v_elevator UUID;
  v_security UUID;
  v_toilet UUID;
  v_hotwater UUID;
BEGIN
  -- Lấy landlord đầu tiên trong hệ thống
  SELECT id INTO v_host FROM public.users WHERE role = 'landlord' LIMIT 1;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy landlord nào! Hãy tạo tài khoản landlord trước.';
  END IF;

  -- Lấy amenity IDs
  SELECT id INTO v_wifi FROM public.amenities WHERE name = 'WiFi';
  SELECT id INTO v_ac FROM public.amenities WHERE name = 'Điều hòa';
  SELECT id INTO v_parking FROM public.amenities WHERE name = 'Chỗ để xe';
  SELECT id INTO v_kitchen FROM public.amenities WHERE name = 'Bếp';
  SELECT id INTO v_washer FROM public.amenities WHERE name = 'Máy giặt';
  SELECT id INTO v_fridge FROM public.amenities WHERE name = 'Tủ lạnh';
  SELECT id INTO v_balcony FROM public.amenities WHERE name = 'Ban công';
  SELECT id INTO v_elevator FROM public.amenities WHERE name = 'Thang máy';
  SELECT id INTO v_security FROM public.amenities WHERE name = 'Bảo vệ 24/7';
  SELECT id INTO v_toilet FROM public.amenities WHERE name = 'Toilet riêng';
  SELECT id INTO v_hotwater FROM public.amenities WHERE name = 'Nước nóng';

  -- ═══════════════════════════════════════════
  -- ROOM 1: Phòng trọ Quận 1
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng trọ cao cấp Quận 1 - Full nội thất',
    'Phòng trọ cao cấp ngay trung tâm Quận 1, đầy đủ nội thất hiện đại. Gần chợ Bến Thành, thuận tiện di chuyển. Phòng sạch sẽ, thoáng mát, an ninh 24/7. Thích hợp cho sinh viên và nhân viên văn phòng.',
    4500000, '123 Nguyễn Huệ', 'Hồ Chí Minh', 25, 'approved', 2, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', true),
    (v_room, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', false);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_ac), (v_room, v_toilet), (v_room, v_hotwater), (v_room, v_security);

  -- ═══════════════════════════════════════════
  -- ROOM 2: Phòng Bình Thạnh
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng trọ giá rẻ Bình Thạnh gần ĐH Hutech',
    'Phòng trọ sạch sẽ, giá sinh viên. Cách ĐH Hutech 500m, gần siêu thị CoopMart. Khu vực yên tĩnh, phù hợp học tập. Có chỗ để xe miễn phí.',
    2800000, '45 Điện Biên Phủ', 'Hồ Chí Minh', 18, 'approved', 3, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800', true),
    (v_room, 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800', false);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_parking), (v_room, v_fridge);

  -- ═══════════════════════════════════════════
  -- ROOM 3: Studio Thủ Đức
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Studio mini Thủ Đức - Gần ĐH Quốc gia',
    'Studio mini đầy đủ tiện nghi, thiết kế hiện đại. Gần làng ĐH Quốc gia, đi bộ 10 phút. Có bếp riêng, toilet riêng, ban công thoáng. WiFi tốc độ cao miễn phí.',
    3200000, '78 Võ Văn Ngân', 'Hồ Chí Minh', 22, 'approved', 1, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800', true),
    (v_room, 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800', false);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_ac), (v_room, v_kitchen), (v_room, v_toilet), (v_room, v_balcony), (v_room, v_hotwater);

  -- ═══════════════════════════════════════════
  -- ROOM 4: Phòng Gò Vấp
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng trọ Gò Vấp giá rẻ - Tự do giờ giấc',
    'Phòng trọ rộng rãi, thoáng mát tại Gò Vấp. Tự do giờ giấc, không chung chủ. Gần ngã tư Phạm Văn Đồng, di chuyển thuận tiện. Giá đã bao gồm điện nước.',
    2200000, '200 Quang Trung', 'Hồ Chí Minh', 20, 'approved', 2, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', true);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_parking), (v_room, v_fridge);

  -- ═══════════════════════════════════════════
  -- ROOM 5: Phòng Hà Nội - Cầu Giấy
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng khép kín Cầu Giấy - Gần ĐH Bách Khoa',
    'Phòng khép kín đầy đủ tiện nghi tại Cầu Giấy. Cách ĐH Bách Khoa HN 1km. Khu dân cư yên tĩnh, an ninh tốt. Có thang máy, bảo vệ 24/7.',
    3800000, '15 Trần Đại Nghĩa', 'Hà Nội', 28, 'approved', 2, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1598928506311-c55ez637643e?w=800', true),
    (v_room, 'https://images.unsplash.com/photo-1585412727339-54e4bae3bbf9?w=800', false);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_ac), (v_room, v_elevator), (v_room, v_security), (v_room, v_toilet), (v_room, v_hotwater);

  -- ═══════════════════════════════════════════
  -- ROOM 6: Phòng Hà Nội - Đống Đa
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng cho thuê Đống Đa - View hồ đẹp',
    'Phòng trọ tầng cao view hồ Đống Đa tuyệt đẹp. Nội thất mới 100%, có ban công rộng. Khu vực trung tâm, gần các trường ĐH và bệnh viện. Phù hợp cho cặp đôi hoặc 2 bạn ở ghép.',
    4200000, '88 Tây Sơn', 'Hà Nội', 30, 'approved', 2, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800', true),
    (v_room, 'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?w=800', false);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_ac), (v_room, v_balcony), (v_room, v_washer), (v_room, v_toilet), (v_room, v_hotwater);

  -- ═══════════════════════════════════════════
  -- ROOM 7: Phòng Đà Nẵng - Hải Châu
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng trọ Hải Châu Đà Nẵng - Gần biển Mỹ Khê',
    'Phòng trọ mới xây tại trung tâm Hải Châu, cách biển Mỹ Khê 2km. Thiết kế tối giản, sạch sẽ. Gần chợ Hàn và cầu Rồng. Không khí trong lành, thích hợp nghỉ dưỡng và làm việc.',
    2500000, '25 Trần Phú', 'Đà Nẵng', 20, 'approved', 3, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800', true);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_ac), (v_room, v_parking), (v_room, v_toilet);

  -- ═══════════════════════════════════════════
  -- ROOM 8: Phòng Cần Thơ
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng trọ Ninh Kiều Cần Thơ - Giá sinh viên',
    'Phòng trọ giá rẻ cho sinh viên tại quận Ninh Kiều. Gần ĐH Cần Thơ, đi bộ 5 phút. Có chỗ để xe rộng, WiFi miễn phí. Khu vực an ninh, yên tĩnh.',
    1800000, '56 Đường 3/2', 'Cần Thơ', 16, 'approved', 4, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800', true);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_parking), (v_room, v_fridge);

  -- ═══════════════════════════════════════════
  -- ROOM 9: Căn hộ mini Quận 7
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Căn hộ mini Quận 7 - Gần Phú Mỹ Hưng',
    'Căn hộ mini full nội thất cao cấp tại Quận 7. Gần khu đô thị Phú Mỹ Hưng, an ninh tuyệt đối. Có hồ bơi, gym miễn phí. Phù hợp cho người đi làm hoặc gia đình nhỏ.',
    5500000, '150 Nguyễn Lương Bằng', 'Hồ Chí Minh', 35, 'approved', 1, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800', true),
    (v_room, 'https://images.unsplash.com/photo-1560448075-bb485b067938?w=800', false);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_ac), (v_room, v_elevator), (v_room, v_security),
    (v_room, v_washer), (v_room, v_kitchen), (v_room, v_toilet), (v_room, v_hotwater), (v_room, v_balcony);

  -- ═══════════════════════════════════════════
  -- ROOM 10: Phòng Tân Bình
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng trọ Tân Bình gần sân bay - Mới xây',
    'Phòng trọ mới xây 100% tại Tân Bình, cách sân bay Tân Sơn Nhất 1.5km. Phòng sạch sẽ, thoáng mát, có cửa sổ lớn. Khu vực nhiều quán ăn, tiện sinh hoạt.',
    3000000, '300 Cộng Hòa', 'Hồ Chí Minh', 22, 'approved', 2, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1564078516393-cf04bd96cf3e?w=800', true);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_ac), (v_room, v_parking), (v_room, v_toilet), (v_room, v_hotwater);

  -- ═══════════════════════════════════════════
  -- ROOM 11: Phòng Huế
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng trọ TP Huế - Gần ĐH Khoa học',
    'Phòng trọ giá rẻ tại thành phố Huế. Gần ĐH Khoa học Huế, thuận tiện đi lại. Khu vực yên tĩnh, phù hợp cho sinh viên. Chủ nhà thân thiện, hỗ trợ nhiệt tình.',
    1500000, '18 Lê Lợi', 'Huế', 15, 'approved', 3, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800', true);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_parking);

  -- ═══════════════════════════════════════════
  -- ROOM 12: Phòng Nha Trang
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng trọ Nha Trang view biển - Trần Phú',
    'Phòng trọ view biển tuyệt đẹp trên đường Trần Phú. Cách bãi biển 200m, gió mát quanh năm. Nội thất đầy đủ, sẵn sàng ở ngay. Phù hợp cho người làm du lịch hoặc freelancer.',
    3500000, '99 Trần Phú', 'Nha Trang', 24, 'approved', 1, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800', true),
    (v_room, 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800', false);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_ac), (v_room, v_balcony), (v_room, v_toilet), (v_room, v_hotwater);

  -- ═══════════════════════════════════════════
  -- ROOM 13: Phòng pending (chờ duyệt)
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng mới đăng Quận 3 - Chờ duyệt',
    'Phòng trọ mới tại Quận 3, đang chờ admin duyệt. Vị trí đắc địa, gần trung tâm thành phố.',
    3800000, '55 Võ Văn Tần', 'Hồ Chí Minh', 26, 'pending', 2, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800', true);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_ac), (v_room, v_toilet);

  -- ═══════════════════════════════════════════
  -- ROOM 14: Phòng hết chỗ
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng trọ Quận 10 - Đã hết chỗ',
    'Phòng trọ tại Quận 10, hiện đã có đủ người ở. Liên hệ chủ nhà để được cập nhật khi có chỗ trống.',
    2900000, '120 Thành Thái', 'Hồ Chí Minh', 20, 'approved', 0, false
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800', true);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_ac), (v_room, v_parking);

  -- ═══════════════════════════════════════════
  -- ROOM 15: Phòng Hà Nội - Thanh Xuân
  -- ═══════════════════════════════════════════
  INSERT INTO public.rooms (id, host_id, title, description, price, address, city, area, status, available_slots, is_available)
  VALUES (gen_random_uuid(), v_host,
    'Phòng trọ Thanh Xuân - Gần Royal City',
    'Phòng trọ khép kín gần Royal City và ĐH Hà Nội. Khu vực sầm uất, nhiều tiện ích xung quanh. Phòng mới sơn sửa, sạch đẹp. Giá bao gồm internet và nước.',
    3500000, '22 Nguyễn Trãi', 'Hà Nội', 24, 'approved', 2, true
  ) RETURNING id INTO v_room;
  INSERT INTO public.room_images (room_id, image_url, is_primary) VALUES
    (v_room, 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800', true);
  INSERT INTO public.room_amenities (room_id, amenity_id) VALUES
    (v_room, v_wifi), (v_room, v_ac), (v_room, v_washer), (v_room, v_toilet), (v_room, v_hotwater);

  RAISE NOTICE 'Đã tạo 15 phòng mẫu thành công cho landlord: %', v_host;
END $$;
