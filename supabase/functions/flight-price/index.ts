// Supabase Edge Function：機票最低價查詢代理
// 金鑰只存在伺服器端環境變數（Supabase secrets），不會出現在前端 JS 中。
//
// 部署方式：
//   supabase functions deploy flight-price
// 設定金鑰：
//   supabase secrets set RAPIDAPI_KEY=xxx TEQUILA_API_KEY=xxx

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY') ?? '';
const RAPIDAPI_HOST = 'skyscanner-flights4.p.rapidapi.com';
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

/** 票價欄位在這支 API 是字串（例如 "$450.00" 或 "450"），統一去除非數字字元後解析 */
function parsePriceString(raw: unknown): number | null {
  if (typeof raw === 'number') return isNaN(raw) ? null : raw;
  if (typeof raw !== 'string') return null;
  const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? null : num;
}

interface ItineraryLegSegment {
  flight: string;
  from: string;
  to: string;
  dep: string;
  arr: string;
  durMin: number;
}

interface ItineraryLeg {
  from: string;
  to: string;
  dep: string;
  arr: string;
  durMin: number;
  stops: number;
  /** 轉機段落明細（每個航段一筆），供前端算出轉機機場與等待時間；直飛或 API 未提供時可能為空陣列 */
  segments: ItineraryLegSegment[];
}

interface Itinerary {
  price: number;
  priceLabel: string;
  carriers: string[];
  bucket: string;
  legs: ItineraryLeg[];
}

interface SkyscannerResult {
  price: number | null;
  itineraries: Itinerary[];
}

function mapSkyscannerResults(results: any[]): Itinerary[] {
  return results
    .map((it: any): Itinerary | null => {
      const price = parsePriceString(it?.price) ?? it?.price_raw ?? null;
      if (price === null) return null;
      const legs: ItineraryLeg[] = (it?.legs ?? []).map((leg: any) => ({
        from: leg?.from ?? '',
        to: leg?.to ?? '',
        dep: leg?.dep ?? '',
        arr: leg?.arr ?? '',
        durMin: typeof leg?.dur_min === 'number' ? leg.dur_min : 0,
        stops: typeof leg?.stops === 'number' ? leg.stops : 0,
        segments: (leg?.segments ?? []).map((seg: any) => ({
          flight: seg?.flight ?? '',
          from: seg?.from ?? '',
          to: seg?.to ?? '',
          dep: seg?.dep ?? '',
          arr: seg?.arr ?? '',
          durMin: typeof seg?.dur_min === 'number' ? seg.dur_min : 0,
        })),
      }));
      return {
        price,
        priceLabel: typeof it?.price === 'string' ? it.price : `${price}`,
        carriers: Array.isArray(it?.carriers) ? it.carriers : [],
        bucket: it?.bucket ?? '',
        legs,
      };
    })
    .filter((it: Itinerary | null): it is Itinerary => it !== null)
    .sort((a, b) => a.price - b.price);
}

async function fetchSkyscannerResults(path: string, params: URLSearchParams): Promise<Itinerary[]> {
  const res = await fetch(`https://${RAPIDAPI_HOST}${path}?${params}`, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });
  if (!res.ok) throw new Error(`Skyscanner HTTP ${res.status}`);
  const data = await res.json();
  return mapSkyscannerResults(data?.results ?? []);
}

async function checkViaSkyscanner(q: FlightQuery): Promise<SkyscannerResult> {
  if (!RAPIDAPI_KEY) return { price: null, itineraries: [] };
  const common = {
    limit: '20',
    adults: '1',
    currency: q.currency,
    cabin: 'economy',
    market: 'US',
    locale: 'en-US',
  };

  // 有填回程日期 → 呼叫來回票 Search Round Trip Flights，否則呼叫單程票 Search One Way Flights
  const itineraries = q.return_date
    ? await fetchSkyscannerResults(
        '/api/v1/roundtrip',
        new URLSearchParams({
          origin: q.origin,
          destination: q.destination,
          date: q.depart_date,
          return_date: q.return_date,
          ...common,
        }),
      )
    : await fetchSkyscannerResults(
        '/api/v1/search',
        new URLSearchParams({
          origin: q.origin,
          destination: q.destination,
          date: q.depart_date,
          ...common,
        }),
      );

  return {
    price: itineraries.length ? itineraries[0].price : null,
    itineraries: itineraries.slice(0, 20),
  };
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
    let itineraries: Itinerary[] = [];
    try {
      const result = await checkViaSkyscanner(query);
      price = result.price;
      itineraries = result.itineraries;
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

    return new Response(JSON.stringify({ price, itineraries }), {
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
