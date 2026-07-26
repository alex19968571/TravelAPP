import { Injectable } from '@angular/core';
import { db } from '../db/local.db';
import { ExchangeRate } from '../models';

// open.er-api.com 支援 CORS，免費且穩定
const RATE_API_URL = 'https://open.er-api.com/v6/latest/EUR';

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  // 啟動時自動嘗試更新（有網路才執行）
  async refreshIfNeeded(): Promise<void> {
    if (!navigator.onLine) return;
    const today = new Date().toISOString().split('T')[0];
    const cached = await db.exchange_rates.get(today);
    if (cached) return; // 今日已有快取，跳過

    try {
      const res = await fetch(RATE_API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // open.er-api.com 回傳 base_code / time_last_update_utc
      const dateStr = data.time_last_update_utc
        ? new Date(data.time_last_update_utc).toISOString().split('T')[0]
        : today;
      const record: ExchangeRate = {
        base: data.base_code ?? 'EUR',
        date: dateStr,
        rates: data.rates,
        fetched_at: new Date().toISOString(),
      };
      await db.exchange_rates.put(record);
    } catch (err) {
      console.warn('[ExchangeRate] fetch failed, using cache', err);
    }
  }

  // 取得指定日期的換算率：fromCurrency → TWD（fallback 至最近一筆快取）
  async getRate(date: string, fromCurrency: string): Promise<{ rate: number; rateDate: string; isOffline: boolean }> {
    let record = await db.exchange_rates.get(date);
    let isOffline = false;

    if (!record) {
      const all = await db.exchange_rates.orderBy('date').reverse().first();
      if (!all) return { rate: 1, rateDate: date, isOffline: true };
      record = all;
      isOffline = true;
    }

    // API 以 EUR 為基準：rates[X] = EUR→X 的匯率
    // fromCurrency→TWD = (EUR→TWD) / (EUR→fromCurrency)
    const rates = record.rates as Record<string, number>;
    if (fromCurrency === 'TWD') return { rate: 1, rateDate: record.date, isOffline };
    const twdRate  = rates['TWD']          ?? 1;
    const fromRate = fromCurrency === 'EUR' ? 1 : (rates[fromCurrency] ?? 1);
    return { rate: twdRate / fromRate, rateDate: record.date, isOffline };
  }

  async getLatestCacheDate(): Promise<string | null> {
    const record = await db.exchange_rates.orderBy('date').reverse().first();
    return record?.date ?? null;
  }

  /**
   * 取得換算乘數：destAmount * rate = homeAmount
   * Frankfurter 以 EUR 為 base（EUR→X 的匯率）
   */
  async getConversionRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1;
    const record = await db.exchange_rates.orderBy('date').reverse().first();
    if (!record) return 1;
    const rates = record.rates as Record<string, number>;
    const fromRate = fromCurrency === 'EUR' ? 1 : (rates[fromCurrency] ?? 1);
    const toRate   = toCurrency   === 'EUR' ? 1 : (rates[toCurrency]   ?? 1);
    return toRate / fromRate;
  }
}
