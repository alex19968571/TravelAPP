-- ============================================================
-- 003: 行程邀請碼／邀請連結（可編輯／可查看）+ 角色權限強制
-- ============================================================

-- 1. trips 新增兩組邀請碼欄位（分別對應可編輯／可查看權限）
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS invite_code_editor TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_code_viewer TEXT UNIQUE;

-- 2. 成員可讀取同行程內所有成員（原本僅能讀到自己那筆）
CREATE POLICY "member read trip members"
  ON public.trip_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members tm2
      WHERE tm2.trip_id = trip_members.trip_id AND tm2.user_id = auth.uid()
    )
  );

-- 3. 權限判斷 helper functions（SECURITY DEFINER，供 RLS 與 RPC 共用）
CREATE OR REPLACE FUNCTION public.has_trip_read_access(p_trip_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = p_trip_id AND (
      t.owner_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = auth.uid())
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_trip_edit_access(p_trip_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = p_trip_id AND (
      t.owner_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.trip_members tm
        WHERE tm.trip_id = t.id AND tm.user_id = auth.uid() AND tm.role <> 'VIEWER'
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_expense_read_access(p_expense_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.has_trip_read_access(e.trip_id)
  FROM public.expenses e WHERE e.client_record_id = p_expense_id;
$$;

CREATE OR REPLACE FUNCTION public.has_expense_edit_access(p_expense_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.has_trip_edit_access(e.trip_id)
  FROM public.expenses e WHERE e.client_record_id = p_expense_id;
$$;

-- 4. 依角色拆分讀寫政策：VIEWER 只能讀，不能新增/修改/刪除
DROP POLICY IF EXISTS "trip access on itinerary" ON public.itinerary_items;
CREATE POLICY "itinerary read"   ON public.itinerary_items FOR SELECT USING (public.has_trip_read_access(trip_id));
CREATE POLICY "itinerary insert" ON public.itinerary_items FOR INSERT WITH CHECK (public.has_trip_edit_access(trip_id));
CREATE POLICY "itinerary update" ON public.itinerary_items FOR UPDATE USING (public.has_trip_edit_access(trip_id));
CREATE POLICY "itinerary delete" ON public.itinerary_items FOR DELETE USING (public.has_trip_edit_access(trip_id));

DROP POLICY IF EXISTS "trip access on shopping" ON public.shopping_list;
CREATE POLICY "shopping read"   ON public.shopping_list FOR SELECT USING (public.has_trip_read_access(trip_id));
CREATE POLICY "shopping insert" ON public.shopping_list FOR INSERT WITH CHECK (public.has_trip_edit_access(trip_id));
CREATE POLICY "shopping update" ON public.shopping_list FOR UPDATE USING (public.has_trip_edit_access(trip_id));
CREATE POLICY "shopping delete" ON public.shopping_list FOR DELETE USING (public.has_trip_edit_access(trip_id));

DROP POLICY IF EXISTS "trip access on expenses" ON public.expenses;
CREATE POLICY "expenses read"   ON public.expenses FOR SELECT USING (public.has_trip_read_access(trip_id));
CREATE POLICY "expenses insert" ON public.expenses FOR INSERT WITH CHECK (public.has_trip_edit_access(trip_id));
CREATE POLICY "expenses update" ON public.expenses FOR UPDATE USING (public.has_trip_edit_access(trip_id));
CREATE POLICY "expenses delete" ON public.expenses FOR DELETE USING (public.has_trip_edit_access(trip_id));

DROP POLICY IF EXISTS "trip access on splits" ON public.expense_splits;
CREATE POLICY "splits read"   ON public.expense_splits FOR SELECT USING (public.has_expense_read_access(expense_id));
CREATE POLICY "splits insert" ON public.expense_splits FOR INSERT WITH CHECK (public.has_expense_edit_access(expense_id));
CREATE POLICY "splits update" ON public.expense_splits FOR UPDATE USING (public.has_expense_edit_access(expense_id));
CREATE POLICY "splits delete" ON public.expense_splits FOR DELETE USING (public.has_expense_edit_access(expense_id));

-- 5. 以邀請碼加入行程（SECURITY DEFINER：讓非成員也能透過正確的邀請碼查到並加入）
CREATE OR REPLACE FUNCTION public.join_trip_by_invite_code(p_invite_code text)
RETURNS TABLE(trip_id uuid, member_role text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trip_id uuid;
  v_role    text;
  v_email   text;
  v_name    text;
BEGIN
  SELECT id INTO v_trip_id FROM public.trips WHERE invite_code_editor = p_invite_code;
  IF v_trip_id IS NOT NULL THEN
    v_role := 'EDITOR';
  ELSE
    SELECT id INTO v_trip_id FROM public.trips WHERE invite_code_viewer = p_invite_code;
    IF v_trip_id IS NOT NULL THEN
      v_role := 'VIEWER';
    END IF;
  END IF;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_INVITE_CODE';
  END IF;

  SELECT email INTO v_email FROM public.user_profiles WHERE id = auth.uid();
  v_name := COALESCE(NULLIF(split_part(v_email, '@', 1), ''), 'Member');

  IF EXISTS (SELECT 1 FROM public.trip_members WHERE trip_id = v_trip_id AND user_id = auth.uid()) THEN
    -- 已是成員：用新邀請碼的權限覆蓋（OWNER 不受影響）
    UPDATE public.trip_members SET role = v_role
    WHERE trip_id = v_trip_id AND user_id = auth.uid() AND role <> 'OWNER';
  ELSE
    INSERT INTO public.trip_members (id, trip_id, user_id, display_name, role)
    VALUES (gen_random_uuid(), v_trip_id, auth.uid(), v_name, v_role);
  END IF;

  RETURN QUERY SELECT v_trip_id, v_role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_trip_by_invite_code(text) TO authenticated;
