-- ============================================================
-- 007: 行程提醒通知（trip_reminders）
-- ============================================================

CREATE TABLE IF NOT EXISTS public.trip_reminders (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offset_type text NOT NULL CHECK (offset_type IN ('month_first', 'seven_days_before', 'one_day_before', 'custom')),
  notify_at_utc timestamptz NOT NULL,
  notify_email text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sent_at_utc timestamptz,
  created_at_utc timestamptz NOT NULL DEFAULT now()
);

-- 排程寄信端（send-trip-reminders Edge Function）用 service role 掃描到期提醒的查詢索引
CREATE INDEX IF NOT EXISTS idx_trip_reminders_due
  ON public.trip_reminders (notify_at_utc)
  WHERE enabled AND sent_at_utc IS NULL;

ALTER TABLE public.trip_reminders ENABLE ROW LEVEL SECURITY;

-- 使用者只能管理自己建立的提醒；新增時需對該行程至少有讀取權限
CREATE POLICY "own trip reminders select"
  ON public.trip_reminders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "own trip reminders insert"
  ON public.trip_reminders FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_trip_read_access(trip_id));

CREATE POLICY "own trip reminders update"
  ON public.trip_reminders FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "own trip reminders delete"
  ON public.trip_reminders FOR DELETE
  USING (user_id = auth.uid());
