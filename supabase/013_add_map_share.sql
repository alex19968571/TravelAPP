-- ============================================================
-- 013: 旅行地圖公開分享（免登入唯讀連結）
-- ============================================================

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS map_share_token text UNIQUE;

CREATE OR REPLACE FUNCTION public.get_public_map_trips(p_token text)
RETURNS TABLE(
  id uuid,
  title text,
  origin text,
  origin_lat double precision,
  origin_lng double precision,
  destination text,
  destination_lat double precision,
  destination_lng double precision,
  destination_country_code text,
  start_date_utc timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.title, t.origin, t.origin_lat, t.origin_lng,
         t.destination, t.destination_lat, t.destination_lng, t.destination_country_code,
         t.start_date_utc
  FROM public.trips t
  JOIN public.user_profiles u ON u.id = t.owner_id
  WHERE u.map_share_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.get_public_map_pins(p_token text)
RETURNS SETOF public.travel_map_pins
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM public.travel_map_pins p
  JOIN public.user_profiles u ON u.id = p.owner_id
  WHERE u.map_share_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.get_public_trip_itinerary(p_token text, p_trip_id uuid)
RETURNS SETOF public.itinerary_items
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.* FROM public.itinerary_items i
  JOIN public.trips t ON t.id = i.trip_id
  JOIN public.user_profiles u ON u.id = t.owner_id
  WHERE u.map_share_token = p_token AND t.id = p_trip_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_map_trips(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_map_pins(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_trip_itinerary(text, uuid) TO anon;
