-- ============================================================
-- 005: 景點照片欄位 + Storage bucket
-- ============================================================

ALTER TABLE public.itinerary_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('itinerary-images', 'itinerary-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "itinerary images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'itinerary-images');

CREATE POLICY "itinerary images authenticated write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'itinerary-images' AND auth.role() = 'authenticated');

CREATE POLICY "itinerary images authenticated update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'itinerary-images' AND auth.role() = 'authenticated');
