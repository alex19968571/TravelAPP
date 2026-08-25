-- ============================================================
-- 011: Trip 新增出發地/目的地（含座標與目的地國碼），供旅行地圖使用
-- ============================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS origin TEXT,
  ADD COLUMN IF NOT EXISTS origin_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS origin_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS destination TEXT,
  ADD COLUMN IF NOT EXISTS destination_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS destination_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS destination_country_code TEXT;
