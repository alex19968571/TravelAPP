-- ============================================================
-- 004: 修正 trip_members RLS 無限遞迴（造成 REST API 500 錯誤）
-- 003 的 "member read trip members" 政策直接在 trip_members 的政策裡
-- 查詢 trip_members 自己，Postgres 會偵測到遞迴並回傳
-- "infinite recursion detected in policy for relation trip_members"。
-- 改用 SECURITY DEFINER function（以擁有者權限執行，略過 RLS）即可避免。
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_trip_member(p_trip_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members tm2
    WHERE tm2.trip_id = p_trip_id AND tm2.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "member read trip members" ON public.trip_members;
CREATE POLICY "member read trip members"
  ON public.trip_members FOR SELECT
  USING (public.is_trip_member(trip_id));
