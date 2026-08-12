// Supabase Edge Function：機票最低價查詢代理
// 金鑰只存在伺服器端環境變數（Supabase secrets），不會出現在前端 JS 中。
//
// 部署方式：
//   supabase functions deploy flight-price
// 設定金鑰：
//   supabase secrets set RAPIDAPI_KEY=xxx TEQUILA_API_KEY=xxx

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY') ?? '';
const RAPIDAPI_HOST = 'skyscanner89.p.rapidapi.com';
const TEQUILA_API_KEY = Deno.env.get('TEQUILA_API_KEY') ?? '';
const TEQUILA_SEARCH_URL = 'https://api.tequila.kiwi.com/v2/search';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FlightQuery {
  origin: string;
  destination: string;
  depart_date: string;
  return_date?: string | null;
  currency: string;
}

function toDdMmYyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

async function checkViaSkyscanner(q: FlightQuery): Promise<number | null> {
  if (!RAPIDAPI_KEY) return null;
  const params = new URLSearchParams({
    origin: q.origin,
    destination: q.destination,
    departureDate: q.depart_date,
    ...(q.return_date ? { returnDate: q.return_date } : {}),
    currency: q.currency,
  });
  const res = await fetch(`https://${RAPIDAPI_HOST}/flights/search-one-way?${params}`, {
    headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': RAPIDAPI_HOST },
  });
  if (!res.ok) throw new Error(`Skyscanner HTTP ${res.status}`);
  const data = await res.json();
  const prices: number[] = (data?.itineraries ?? data?.data?.itineraries ?? [])
    .map((it: any) => it?.price?.raw ?? it?.pricing_options?.[0]?.price?.amount)
    .filter((p: unknown): p is number => typeof p === 'number' && !isNaN(p));
  return prices.length ? Math.min(...prices) : null;
}

async function checkViaTequila(q: FlightQuery): Promise<number | null> {
  if (!TEQUILA_API_KEY) return null;
  const params = new URLSearchParams({
    fly_from: q.origin,
    fly_to: q.destination,
    date_from: toDdMmYyyy(q.depart_date),
    date_to: toDdMmYyyy(q.depart_date),
    curr: q.currency,
    limit: '10',
    sort: 'price',
  });
  if (q.return_date) {
    params.set('return_from', toDdMmYyyy(q.return_date));
    params.set('return_to', toDdMmYyyy(q.return_date));
  }
  const res = await fetch(`${TEQUILA_SEARCH_URL}?${params}`, {
    headers: { apikey: TEQUILA_API_KEY },
  });
  if (!res.ok) throw new Error(`Tequila HTTP ${res.status}`);
  const data = await res.json();
  const prices: number[] = (data?.data ?? [])
    .map((it: any) => it?.price)
    .filter((p: unknown): p is number => typeof p === 'number' && !isNaN(p));
  return prices.length ? Math.min(...prices) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // 驗證呼叫者已登入（避免未授權濫用金鑰額度）
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const query = (await req.json()) as FlightQuery;

    let price: number | null = null;
    try {
      price = await checkViaSkyscanner(query);
    } catch (err) {
      console.error('[flight-price] skyscanner failed', err);
    }
    if (price === null) {
      try {
        price = await checkViaTequila(query);
      } catch (err) {
        console.error('[flight-price] tequila failed', err);
      }
    }

    return new Response(JSON.stringify({ price }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[flight-price] error', err);
    return new Response(JSON.stringify({ error: 'internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
