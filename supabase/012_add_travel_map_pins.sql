-- ============================================================
-- 012: 旅行地圖標記（travel_map_pins）——每趟有目的地的行程最多一筆附加內容
-- ============================================================

CREATE TABLE IF NOT EXISTS public.travel_map_pins (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  trip_id uuid NOT NULL UNIQUE REFERENCES public.trips(id) ON DELETE CASCADE,
  photo_urls text[] NOT NULL DEFAULT '{}',
  audio_url text,
  notes text,
  arc_color text,
  created_at_utc timestamptz NOT NULL DEFAULT now(),
  updated_at_utc timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photo_urls_max_3 CHECK (array_length(photo_urls, 1) IS NULL OR array_length(photo_urls, 1) <= 3)
);

ALTER TABLE public.travel_map_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own travel map pins"
  ON public.travel_map_pins FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

INSERT INTO storage.buckets (id, name, public) VALUES ('map-pin-photos', 'map-pin-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('map-pin-audio', 'map-pin-audio', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "map pin photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'map-pin-photos');

CREATE POLICY "map pin photos authenticated write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'map-pin-photos' AND auth.role() = 'authenticated');

CREATE POLICY "map pin audio public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'map-pin-audio');

CREATE POLICY "map pin audio authenticated write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'map-pin-audio' AND auth.role() = 'authenticated');
