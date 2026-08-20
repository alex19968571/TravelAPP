// Supabase Edge Function：行程提醒通知定時寄信
// 由 pg_cron + pg_net 定期以 POST 呼叫（見 008_schedule_trip_reminders.sql），
// 掃描 trip_reminders 中已到期、尚未寄送的提醒，透過 Resend 寄信通知，並標記為已寄送。
//
// 部署方式：
//   supabase functions deploy send-trip-reminders
// 設定金鑰：
//   supabase secrets set RESEND_API_KEY=xxx RESEND_FROM_EMAIL="TravelApp <reminder@yourdomain.com>" CRON_SECRET=xxx

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';
// 去除結尾斜線，避免跟後面手動補上的 '/trips/:id' 兜出雙斜線造成連結失效
const APP_BASE_URL = (
  Deno.env.get('APP_BASE_URL') ?? 'https://alex19968571.github.io/TravelAPP'
).replace(/\/+$/, '');
// 僅允許帶有正確共用密鑰的排程呼叫，或已登入使用者本人的請求（見 isAuthorized），
// 避免此端點被任意呼叫濫用寄信額度
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const OFFSET_LABEL: Record<string, string> = {
  month_first: '本月提醒',
  seven_days_before: '出發前 7 天提醒',
  one_day_before: '出發前 1 天提醒',
  custom: '自訂時間提醒',
};

interface DueReminder {
  id: string;
  trip_id: string;
  offset_type: string;
  notify_email: string;
  trips: { title: string } | null;
}

async function sendReminderEmail(reminder: DueReminder): Promise<boolean> {
  const tripTitle = reminder.trips?.title ?? '你的行程';
  const link = `${APP_BASE_URL}/trips/${reminder.trip_id}`;
  const label = OFFSET_LABEL[reminder.offset_type] ?? '行程提醒';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: reminder.notify_email,
      subject: `【旅遊提醒】${tripTitle}`,
      html: `
        <p>嗨，這是你設定的${label}：</p>
        <p><strong>${tripTitle}</strong></p>
        <p><a href="${link}">點此查看行程內容</a></p>
      `,
    }),
  });
  if (!res.ok) {
    console.error('[send-trip-reminders] Resend error', res.status, await res.text());
    return false;
  }
  return true;
}

// 驗證呼叫者：pg_cron 排程帶 CRON_SECRET，或前端使用者儲存提醒後帶自己的登入 JWT 立即觸發檢查
async function isAuthorized(req: Request): Promise<boolean> {
  if (CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET) return true;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return false;
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await anonClient.auth.getUser();
  return !error && !!data?.user;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  if (!(await isAuthorized(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: due, error } = await supabase
    .from('trip_reminders')
    .select('id, trip_id, offset_type, notify_email, trips ( title )')
    .eq('enabled', true)
    .is('sent_at_utc', null)
    .lte('notify_at_utc', new Date().toISOString())
    .limit(50);

  if (error) {
    console.error('[send-trip-reminders] query error', error);
    return new Response(JSON.stringify({ error: 'query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let sentCount = 0;
  for (const reminder of (due ?? []) as unknown as DueReminder[]) {
    const ok = await sendReminderEmail(reminder);
    if (ok) {
      await supabase
        .from('trip_reminders')
        .update({ sent_at_utc: new Date().toISOString() })
        .eq('id', reminder.id);
      sentCount++;
    }
  }

  return new Response(JSON.stringify({ checked: due?.length ?? 0, sent: sentCount }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
