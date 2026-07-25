-- ============================================================
-- Travel APP Initial Schema
-- ============================================================

-- 1. 使用者主表
CREATE TABLE public.user_profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             VARCHAR(255) NOT NULL,
  default_timezone  VARCHAR(50)  DEFAULT 'Asia/Taipei',
  default_currency  VARCHAR(3)   DEFAULT 'TWD',
  created_at_utc    TIMESTAMPTZ  DEFAULT NOW()
);

-- 2. 行程主表
CREATE TABLE public.trips (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(100) NOT NULL,
  target_timezone  VARCHAR(50)  NOT NULL,
  base_currency    VARCHAR(3)   NOT NULL,
  owner_id         UUID         NOT NULL REFERENCES public.user_profiles(id),
  row_version      BIGINT       DEFAULT 1,
  created_at_utc   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at_utc   TIMESTAMPTZ  DEFAULT NOW()
);

-- 3. 行程成員表（支援虛擬成員：user_id 可為 NULL）
CREATE TABLE public.trip_members (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID         NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id      UUID         REFERENCES public.user_profiles(id),
  display_name VARCHAR(100) NOT NULL,
  role         VARCHAR(20)  DEFAULT 'VIEWER'
);

-- 4. 每日景點行程表（含 Google Polyline 快取）
CREATE TABLE public.itinerary_items (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID          NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number       INT           NOT NULL,
  order_index      INT           NOT NULL,
  place_name       VARCHAR(200)  NOT NULL,
  latitude         NUMERIC(10,7) NOT NULL,
  longitude        NUMERIC(10,7) NOT NULL,
  encoded_polyline TEXT,
  updated_at_utc   TIMESTAMPTZ   DEFAULT NOW()
);

-- 5. 購物清單表
CREATE TABLE public.shopping_list (
  client_record_id UUID         PRIMARY KEY,
  trip_id          UUID         NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title            VARCHAR(100) NOT NULL,
  description      TEXT,
  item_url         TEXT,
  image_url        TEXT,
  quantity         INT          DEFAULT 1,
  unit_price       NUMERIC(18,4) DEFAULT 0,
  total_amount     NUMERIC(18,4) DEFAULT 0,
  is_bought        BOOLEAN      DEFAULT FALSE,
  updated_at_utc   TIMESTAMPTZ  DEFAULT NOW()
);

-- 6. 記帳主表（含 OCR JSONB 與當日匯率）
CREATE TABLE public.expenses (
  client_record_id UUID          PRIMARY KEY,
  trip_id          UUID          NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title            VARCHAR(100)  NOT NULL,
  amount           NUMERIC(18,4) NOT NULL,
  currency_code    VARCHAR(3)    NOT NULL,
  exchange_rate    NUMERIC(18,6) NOT NULL,
  converted_amount NUMERIC(18,4) NOT NULL,
  expense_date_utc TIMESTAMPTZ   NOT NULL,
  payer_member_id  UUID          NOT NULL REFERENCES public.trip_members(id),
  receipt_image_url TEXT,
  ocr_raw_data     JSONB,
  split_type       VARCHAR(20)   DEFAULT 'EQUAL',
  updated_at_utc   TIMESTAMPTZ   DEFAULT NOW()
);

-- 7. 多人分帳明細表
CREATE TABLE public.expense_splits (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id            UUID          NOT NULL REFERENCES public.expenses(client_record_id) ON DELETE CASCADE,
  member_id             UUID          NOT NULL REFERENCES public.trip_members(id),
  owed_amount           NUMERIC(18,4) NOT NULL,
  converted_owed_amount NUMERIC(18,4) NOT NULL,
  share_weight          NUMERIC(8,2)  DEFAULT 1.0
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits  ENABLE ROW LEVEL SECURITY;

-- user_profiles: 只能讀寫自己的資料
CREATE POLICY "user own profile"
  ON public.user_profiles FOR ALL
  USING (auth.uid() = id);

-- trips: owner 全權限；成員有讀取權（透過 trip_members 關聯）
CREATE POLICY "owner all on trips"
  ON public.trips FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "member read trips"
  ON public.trips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members tm
      WHERE tm.trip_id = id AND tm.user_id = auth.uid()
    )
  );

-- trip_members: owner 全權限；自身成員可讀
CREATE POLICY "owner all on members"
  ON public.trip_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "member read own membership"
  ON public.trip_members FOR SELECT
  USING (user_id = auth.uid());

-- itinerary_items: 隸屬有權限的行程才可存取
CREATE POLICY "trip access on itinerary"
  ON public.itinerary_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_id AND (
        t.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = auth.uid())
      )
    )
  );

-- shopping_list
CREATE POLICY "trip access on shopping"
  ON public.shopping_list FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_id AND (
        t.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = auth.uid())
      )
    )
  );

-- expenses
CREATE POLICY "trip access on expenses"
  ON public.expenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_id AND (
        t.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = auth.uid())
      )
    )
  );

-- expense_splits
CREATE POLICY "trip access on splits"
  ON public.expense_splits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      JOIN public.trips t ON t.id = e.trip_id
      WHERE e.client_record_id = expense_id AND (
        t.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = auth.uid())
      )
    )
  );

-- ============================================================
-- Auto-update row_version trigger on trips
-- ============================================================
CREATE OR REPLACE FUNCTION public.bump_row_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.row_version := OLD.row_version + 1;
  NEW.updated_at_utc := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trips_bump_version
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.bump_row_version();

-- Auto-create user_profile on first OAuth login
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
