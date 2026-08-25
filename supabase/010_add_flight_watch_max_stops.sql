-- ============================================================
-- 010: 自動盯價新增「轉機次數」篩選欄位（max_stops）
-- ============================================================

ALTER TABLE public.flight_watches
  ADD COLUMN IF NOT EXISTS max_stops text NOT NULL DEFAULT 'any';

ALTER TABLE public.flight_watches
  ADD CONSTRAINT flight_watches_max_stops_check
    CHECK (max_stops IN ('any', 'direct', 'one', 'twoPlus'));
