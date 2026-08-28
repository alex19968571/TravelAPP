ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS is_one_way boolean NOT NULL DEFAULT false;
