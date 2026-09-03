import { Injectable, inject } from '@angular/core';
import { FlightMaxStops, FlightWatch } from '../models';
import { FlightWatchService } from './flight-watch.service';
import { SupabaseService } from './supabase.service';

export interface FlightItineraryLegSegment {
  flight: string;
  from: string;
  to: string;
  dep: string;
  arr: string;
  durMin: number;
}

export interface FlightItineraryLeg {
  from: string;
  to: string;
  dep: string;
  arr: string;
  durMin: number;
  stops: number;
  /** 轉機航段明細（依序），直飛或 API 未提供時可能為空陣列 */
  segments: FlightItineraryLegSegment[];
}

export interface FlightItinerary {
  price: number;
  priceLabel: string;
  carriers: string[];
  bucket: string;
  legs: FlightItineraryLeg[];
}

/** 單一航段的轉機次數是否符合追蹤路線設定的篩選條件（跟 flight-watch.component.ts
 *  明細彈窗的 filteredItineraries 用的是同一套規則，兩邊篩選結果才會一致） */
function stopsMatchesFilter(stops: number, filter: FlightMaxStops): boolean {
  switch (filter) {
    case 'direct':
      return stops === 0;
    case 'one':
      return stops === 1;
    case 'twoPlus':
      return stops >= 2;
    default:
      return true;
  }
}

/** 依追蹤路線的「轉機次數」篩選明細清單——查價 API 沒有篩選參數，回傳的一律是
 *  「不限轉機」的完整清單，所有由這份清單推算價格的地方（列表卡片最低/最高價、
 *  持久化的 last_price）都要先套用這個篩選，才會跟「查看明細」彈窗算出一致的結果。 */
export function filterItinerariesByMaxStops(
  itineraries: FlightItinerary[],
  maxStops: FlightMaxStops,
): FlightItinerary[] {
  if (maxStops === 'any') return itineraries;
  return itineraries.filter((it) => it.legs.every((leg) => stopsMatchesFilter(leg.stops, maxStops)));
}

@Injectable({ providedIn: 'root' })
export class FlightPriceService {
  private flightWatchService = inject(FlightWatchService);
  private supabase = inject(SupabaseService).client;

  /** 即時查詢完整航班明細清單（航空公司、直飛/轉機、去回程時間），供「查看航班明細」彈窗使用 */
  async checkItineraries(watch: FlightWatch): Promise<FlightItinerary[]> {
    try {
      const { data, error } = await this.supabase.functions.invoke('flight-price', {
        body: {
          origin: watch.origin,
          destination: watch.destination,
          depart_date: watch.depart_date,
          return_date: watch.return_date,
          currency: watch.currency,
        },
      });
      if (error) throw error;
      return Array.isArray(data?.itineraries) ? data.itineraries : [];
    } catch (err) {
      console.warn('[FlightPrice] checkItineraries failed', err);
      return [];
    }
  }

  /**
   * 查詢最低價格「同時」取得完整明細清單（同一個 edge function 回應本來就同時帶有
   * price 與 itineraries 兩個欄位），供列表卡片同時顯示最低/最高價與對應航空公司使用。
   */
  async checkItinerariesWithPrice(
    watch: FlightWatch,
  ): Promise<{ price: number | null; itineraries: FlightItinerary[] }> {
    try {
      const { data, error } = await this.supabase.functions.invoke('flight-price', {
        body: {
          origin: watch.origin,
          destination: watch.destination,
          depart_date: watch.depart_date,
          return_date: watch.return_date,
          currency: watch.currency,
        },
      });
      if (error) throw error;
      const raw: FlightItinerary[] = Array.isArray(data?.itineraries) ? data.itineraries : [];
      // API 回傳的 data.price 是「不限轉機」清單裡的最低價，沒有套用追蹤路線的
      // max_stops 篩選；改成用篩選後的清單自己算最低價，才會跟明細彈窗一致。
      const itineraries = filterItinerariesByMaxStops(raw, watch.max_stops);
      const price = itineraries.length ? Math.min(...itineraries.map((it) => it.price)) : null;
      return { price, itineraries };
    } catch (err) {
      console.warn('[FlightPrice] checkItinerariesWithPrice failed', err);
      return { price: null, itineraries: [] };
    }
  }

  /** 同一天已檢查過就跳過，避免浪費免費額度（比照 exchange-rate.service 的每日快取邏輯） */
  async refreshIfNeeded(watch: FlightWatch): Promise<FlightItinerary[] | null> {
    if (!navigator.onLine) return null;
    const today = new Date().toISOString().split('T')[0];
    if (watch.last_checked_at?.split('T')[0] === today) return null;

    const { price, itineraries } = await this.checkItinerariesWithPrice(watch);
    await this.flightWatchService.update(watch.id, {
      last_price: price,
      last_checked_at: new Date().toISOString(),
    });
    return itineraries;
  }
}
