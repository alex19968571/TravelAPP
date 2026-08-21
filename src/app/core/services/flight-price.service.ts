import { Injectable, inject } from '@angular/core';
import { FlightWatch } from '../models';
import { FlightWatchService } from './flight-watch.service';
import { SupabaseService } from './supabase.service';

export interface FlightItineraryLeg {
  from: string;
  to: string;
  dep: string;
  arr: string;
  durMin: number;
  stops: number;
}

export interface FlightItinerary {
  price: number;
  priceLabel: string;
  carriers: string[];
  bucket: string;
  legs: FlightItineraryLeg[];
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
      return {
        price: typeof data?.price === 'number' ? data.price : null,
        itineraries: Array.isArray(data?.itineraries) ? data.itineraries : [],
      };
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
