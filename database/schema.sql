-- ============================================================
-- RoommieMatch - Supabase SQL Schema v2
-- Chạy toàn bộ script này trong Supabase SQL Editor
-- ============================================================

-- 0. Đảm bảo schema public tồn tại
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
SET search_path TO public;

-- ============================================================
-- TABLE: users (Đồng bộ với Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'tenant' CHECK (role IN ('tenant', 'landlord', 'admin')),
  avatar_url  TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: rooms (Bài đăng phòng)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  price            INTEGER NOT NULL,
  address          TEXT NOT NULL,
  city             TEXT NOT NULL DEFAULT 'Hà Nội',
  area             NUMERIC(6,2),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  is_available     BOOLEAN DEFAULT TRUE,
  latitude         NUMERIC(10,7),
  longitude        NUMERIC(10,7),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: room_images (Hình ảnh phòng)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.room_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: amenities (Danh sách tiện ích)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.amenities (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT
);

-- ============================================================
-- TABLE: room_amenities (Bảng nối: rooms <-> amenities)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.room_amenities (
  room_id    UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  amenity_id UUID NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, amenity_id)
);

-- ============================================================
-- TABLE: reviews (Đánh giá phòng từ Tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);

-- ============================================================
-- TABLE: conversations (Cuộc hội thoại Tenant <-> Landlord)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  tenant_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  landlord_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, tenant_id, landlord_id)
);

-- ============================================================
-- TABLE: messages (Tin nhắn)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: reports (Báo cáo vi phạm)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  room_id     UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: favorites (Phòng yêu thích của Tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  room_id    UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, room_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rooms_status   ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_host_id  ON public.rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_rooms_city     ON public.rooms(city);
CREATE INDEX IF NOT EXISTS idx_reviews_room   ON public.reviews(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv  ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);

-- ============================================================
-- TRIGGER: Tự động cập nhật updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON public.users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_rooms_updated_at ON public.rooms;
CREATE TRIGGER trigger_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_images    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites      ENABLE ROW LEVEL SECURITY;

-- ── users ──
DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;
CREATE POLICY "Users are viewable by everyone" ON public.users FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
CREATE POLICY "Service role can insert users" ON public.users FOR INSERT WITH CHECK (TRUE);

-- ── rooms ──
DROP POLICY IF EXISTS "Approved rooms viewable" ON public.rooms;
CREATE POLICY "Approved rooms viewable" ON public.rooms FOR SELECT
  USING (status = 'approved' OR auth.uid() = host_id);

DROP POLICY IF EXISTS "Landlords insert rooms" ON public.rooms;
CREATE POLICY "Landlords insert rooms" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Landlords update own rooms" ON public.rooms;
CREATE POLICY "Landlords update own rooms" ON public.rooms FOR UPDATE USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Landlords delete own rooms" ON public.rooms;
CREATE POLICY "Landlords delete own rooms" ON public.rooms FOR DELETE USING (auth.uid() = host_id);

-- ── room_images ──
DROP POLICY IF EXISTS "Room images viewable" ON public.room_images;
CREATE POLICY "Room images viewable" ON public.room_images FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Hosts manage room images" ON public.room_images;
CREATE POLICY "Hosts manage room images" ON public.room_images FOR ALL USING (
  EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND host_id = auth.uid())
);

-- ── amenities ──
DROP POLICY IF EXISTS "Amenities viewable" ON public.amenities;
CREATE POLICY "Amenities viewable" ON public.amenities FOR SELECT USING (TRUE);

-- ── room_amenities ──
DROP POLICY IF EXISTS "Room amenities viewable" ON public.room_amenities;
CREATE POLICY "Room amenities viewable" ON public.room_amenities FOR SELECT USING (TRUE);

-- ── reviews ──
DROP POLICY IF EXISTS "Reviews viewable" ON public.reviews;
CREATE POLICY "Reviews viewable" ON public.reviews FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Auth users write reviews" ON public.reviews;
CREATE POLICY "Auth users write reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── conversations ──
DROP POLICY IF EXISTS "Participants view conversations" ON public.conversations;
CREATE POLICY "Participants view conversations" ON public.conversations FOR SELECT
  USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Participants insert conversations" ON public.conversations;
CREATE POLICY "Participants insert conversations" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

-- ── messages ──
DROP POLICY IF EXISTS "Participants view messages" ON public.messages;
CREATE POLICY "Participants view messages" ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = conversation_id
      AND (tenant_id = auth.uid() OR landlord_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Participants send messages" ON public.messages;
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- ── reports ──
DROP POLICY IF EXISTS "Users view own reports" ON public.reports;
CREATE POLICY "Users view own reports" ON public.reports FOR SELECT USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Auth users create reports" ON public.reports;
CREATE POLICY "Auth users create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ── favorites ──
DROP POLICY IF EXISTS "Users view own favorites" ON public.favorites;
CREATE POLICY "Users view own favorites" ON public.favorites FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage favorites" ON public.favorites;
CREATE POLICY "Users manage favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- SEED DATA: Tiện ích mặc định
-- ============================================================
INSERT INTO public.amenities (name, icon) VALUES
  ('WiFi',             'wifi'),
  ('Điều hòa',         'ac_unit'),
  ('Chỗ để xe',        'local_parking'),
  ('Bếp',              'kitchen'),
  ('Máy giặt',         'local_laundry_service'),
  ('Tủ lạnh',          'kitchen'),
  ('Ban công',         'balcony'),
  ('Thang máy',        'elevator'),
  ('Bảo vệ 24/7',     'security'),
  ('Camera an ninh',   'videocam'),
  ('Tự do giờ giấc',  'access_time'),
  ('Toilet riêng',     'bathroom'),
  ('Nước nóng',        'hot_tub'),
  ('Gần trường học',   'school'),
  ('Gần chợ/siêu thị','shopping_cart')
ON CONFLICT (name) DO NOTHING;
