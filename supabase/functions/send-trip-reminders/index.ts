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

// 依 trips.target_timezone 對應目的地國家名稱／國旗（比照前端 preference.service.ts 的 COUNTRIES）
const TIMEZONE_TO_COUNTRY: Record<string, { name: string; flag: string }> = {
  'Asia/Taipei': { name: '台灣', flag: '🇹🇼' },
  'Asia/Tokyo': { name: '日本', flag: '🇯🇵' },
  'Asia/Seoul': { name: '韓國', flag: '🇰🇷' },
  'Asia/Shanghai': { name: '中國', flag: '🇨🇳' },
  'Asia/Bangkok': { name: '泰國', flag: '🇹🇭' },
  'Asia/Ho_Chi_Minh': { name: '越南', flag: '🇻🇳' },
  'Asia/Singapore': { name: '新加坡', flag: '🇸🇬' },
  'Asia/Kuala_Lumpur': { name: '馬來西亞', flag: '🇲🇾' },
  'Asia/Jakarta': { name: '印尼', flag: '🇮🇩' },
  'Australia/Sydney': { name: '澳洲', flag: '🇦🇺' },
  'America/New_York': { name: '美國', flag: '🇺🇸' },
  'America/Toronto': { name: '加拿大', flag: '🇨🇦' },
  'Europe/London': { name: '英國', flag: '🇬🇧' },
  'Europe/Paris': { name: '法國', flag: '🇫🇷' },
  'Europe/Berlin': { name: '德國', flag: '🇩🇪' },
  'Europe/Rome': { name: '義大利', flag: '🇮🇹' },
  'Europe/Madrid': { name: '西班牙', flag: '🇪🇸' },
  'Europe/Zurich': { name: '瑞士', flag: '🇨🇭' },
  'Europe/Istanbul': { name: '土耳其', flag: '🇹🇷' },
  'Asia/Dubai': { name: '阿聯酋', flag: '🇦🇪' },
};

interface DueReminder {
  id: string;
  trip_id: string;
  offset_type: string;
  notify_email: string;
  trips: {
    title: string;
    target_timezone: string | null;
    start_date_utc: string | null;
    end_date_utc: string | null;
  } | null;
}

function formatTripDate(iso: string | null, timeZone: string | null): string {
  if (!iso) return '未設定';
  try {
    return new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      timeZone: timeZone ?? 'Asia/Taipei',
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleDateString('zh-TW');
  }
}

function buildReminderEmailHtml(params: {
  tripTitle: string;
  label: string;
  countryText: string;
  departText: string;
  returnText: string;
  link: string;
}): string {
  const { tripTitle, label, countryText, departText, returnText, link } = params;
  return `
    <div style="background:#f4ede1;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang TC','Noto Sans TC',sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#b8874a;padding:24px 28px;">
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">✈️ TravelApp 行程提醒</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 4px;font-size:13px;color:#9a8a70;letter-spacing:0.05em;">${label}</p>
            <h1 style="margin:0 0 20px;font-size:22px;color:#2b2318;">${tripTitle}</h1>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5ee;border-radius:12px;padding:4px 0;">
              <tr>
                <td style="padding:14px 20px;font-size:14px;color:#8a7960;width:88px;">目的地</td>
                <td style="padding:14px 20px;font-size:15px;color:#2b2318;font-weight:600;">${countryText}</td>
              </tr>
              <tr>
                <td style="padding:14px 20px;font-size:14px;color:#8a7960;border-top:1px solid #ece3d3;">去程時間</td>
                <td style="padding:14px 20px;font-size:15px;color:#2b2318;font-weight:600;border-top:1px solid #ece3d3;">${departText}</td>
              </tr>
              <tr>
                <td style="padding:14px 20px;font-size:14px;color:#8a7960;border-top:1px solid #ece3d3;">回程時間</td>
                <td style="padding:14px 20px;font-size:15px;color:#2b2318;font-weight:600;border-top:1px solid #ece3d3;">${returnText}</td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 4px;">
              <tr>
                <td style="border-radius:10px;background:#b8874a;">
                  <a href="${link}" style="display:inline-block;padding:12px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">查看行程內容</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:#f9f5ee;">
            <p style="margin:0;font-size:12px;color:#a99a80;">此信件由 TravelApp 自動寄送，若非本人設定請忽略。</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

async function sendReminderEmail(reminder: DueReminder): Promise<boolean> {
  const trip = reminder.trips;
  const tripTitle = trip?.title ?? '你的行程';
  const link = `${APP_BASE_URL}/trips/${reminder.trip_id}`;
  const label = OFFSET_LABEL[reminder.offset_type] ?? '行程提醒';
  const country = trip?.target_timezone ? TIMEZONE_TO_COUNTRY[trip.target_timezone] : undefined;
  const countryText = country
    ? `${country.flag} ${country.name}`
    : (trip?.target_timezone ?? '未設定');
  const departText = formatTripDate(trip?.start_date_utc ?? null, trip?.target_timezone ?? null);
  const returnText = formatTripDate(trip?.end_date_utc ?? null, trip?.target_timezone ?? null);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: reminder.notify_email,
      subject: `【旅遊提醒】${tripTitle}即將到來`,
      html: buildReminderEmailHtml({ tripTitle, label, countryText, departText, returnText, link }),
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
    .select(
      'id, trip_id, offset_type, notify_email, trips ( title, target_timezone, start_date_utc, end_date_utc )',
    )
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
