-- ============================================================
-- 008: 定期呼叫 send-trip-reminders Edge Function（pg_cron + pg_net）
-- ============================================================
--
-- ⚠️ 執行前請先手動修改下方兩個佔位字串，換成你自己的值，再貼到
--    Supabase Dashboard -> SQL Editor 執行（或用 supabase db push）：
--    1. <YOUR_PROJECT_REF>  → 專案的 Supabase project ref
--    2. <YOUR_CRON_SECRET>  → 跟 `supabase secrets set CRON_SECRET=xxx` 設定的值完全一致
--       （自訂一組隨機字串即可，只要跟 Edge Function 的 CRON_SECRET 一致，
--        用來防止此 Edge Function 端點被任意呼叫濫用寄信額度）

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'send-trip-reminders-every-15-min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/send-trip-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<YOUR_CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
