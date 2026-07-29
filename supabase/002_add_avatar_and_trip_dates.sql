-- ============================================================
-- 002: 使用者頭像 (Supabase Storage) + 行程去/回程日期時間
-- ============================================================

-- 1. user_profiles 新增頭像欄位
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. trips 新增去程/回程日期時間欄位
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS start_date_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date_utc   TIMESTAMPTZ;

-- 3. 建立 avatars Storage bucket（公開讀取，僅本人可寫入自己的資料夾）
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 允許任何人讀取頭像（public bucket）
CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- 僅允許使用者上傳/更新/刪除位於自己 UID 資料夾下的檔案
-- 路徑慣例：avatars/{auth.uid()}/avatar.{ext}
CREATE POLICY "avatars owner write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars owner update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars owner delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
