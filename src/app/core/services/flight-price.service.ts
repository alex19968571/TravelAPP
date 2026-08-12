import { Injectable, inject } from '@angular/core';
import { FlightWatch } from '../models';
import { FlightWatchService } from './flight-watch.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class FlightPriceService {
  private flightWatchService = inject(FlightWatchService);
  private supabase = inject(SupabaseService).client;

  /**
   * 對單一追蹤路線查詢目前最低票價。
   * 實際查詢（RapidAPI Skyscanner 主要來源 + Kiwi Tequila 備援）在 Supabase Edge Function
   * `flight-price` 內執行，金鑰只存在伺服器端環境變數，不會出現在前端 JS 中。
   */
  async checkPrice(watch: FlightWatch): Promise<number | null> {
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
      return typeof data?.price === 'number' ? data.price : null;
    } catch (err) {
      console.warn('[FlightPrice] checkPrice failed', err);
      return null;
    }
  }

  /** 同一天已檢查過就跳過，避免浪費免費額度（比照 exchange-rate.service 的每日快取邏輯） */
  async refreshIfNeeded(watch: FlightWatch): Promise<void> {
    if (!navigator.onLine) return;
    const today = new Date().toISOString().split('T')[0];
    if (watch.last_checked_at?.split('T')[0] === today) return;

    const price = await this.checkPrice(watch);
    await this.flightWatchService.update(watch.id, {
      last_price: price,
      last_checked_at: new Date().toISOString(),
    });
  }
}
