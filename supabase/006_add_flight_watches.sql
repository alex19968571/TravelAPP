-- ============================================================
-- 006: 機票自動盯價（flight_watches）
-- ============================================================

CREATE TABLE IF NOT EXISTS public.flight_watches (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  origin text NOT NULL,
  destination text NOT NULL,
  depart_date date NOT NULL,
  return_date date,
  target_price numeric,
  currency text NOT NULL,
  last_price numeric,
  last_checked_at timestamptz,
  created_at_utc timestamptz NOT NULL DEFAULT now(),
  updated_at_utc timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flight_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own flight watches"
  ON public.flight_watches FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
