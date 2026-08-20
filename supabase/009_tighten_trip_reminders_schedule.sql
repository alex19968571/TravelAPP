-- ============================================================
-- 009: 縮短 send-trip-reminders 排程間隔為每 1 分鐘
-- ============================================================
--
-- 008 migration 原本設定每 15 分鐘檢查一次，實測發現提醒到期後最多要等 15 分鐘
-- 才會被寄出（尤其使用者不是「儲存後立即觸發」的情境，例如系統重啟後補漏）。
-- 前端已改成儲存提醒後立即呼叫一次 Edge Function（見 trip-reminder.service.ts
-- 的 triggerImmediateCheck），這裡再把排程本身縮短到每分鐘一次，兩者搭配可以
-- 讓到期時間與實際寄出時間的誤差控制在 1 分鐘內。
--
-- ⚠️ 執行前一樣要把 <YOUR_PROJECT_REF> 和 <YOUR_CRON_SECRET> 換成你在
--    008 migration 裡實際填的值（必須跟 Edge Function 的 CRON_SECRET 一致）。

SELECT cron.unschedule('send-trip-reminders-every-15-min');

SELECT cron.schedule(
  'send-trip-reminders-every-1-min',
  '* * * * *',
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
