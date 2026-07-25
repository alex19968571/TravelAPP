import { Injectable } from '@angular/core';
import { db } from '../db/local.db';
import { ExchangeRate } from '../models';

const FRANKFURTER_URL = 'https://api.frankfurter.app/latest';

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  // 啟動時自動嘗試更新（有網路才執行）
  async refreshIfNeeded(): Promise<void> {
    if (!navigator.onLine) return;
    const today = new Date().toISOString().split('T')[0];
    const cached = await db.exchange_rates.get(today);
    if (cached) return; // 今日已有快取，跳過

    try {
      const res = await fetch(FRANKFURTER_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const record: ExchangeRate = {
        base: data.base,
        date: data.date,
        rates: data.rates,
        fetched_at: new Date().toISOString(),
      };
      await db.exchange_rates.put(record);
    } catch (err) {
      console.warn('[ExchangeRate] fetch failed, using cache', err);
    }
  }

  // 取得指定日期的匯率（fallback 至最近一筆）
  async getRate(date: string, targetCurrency: string, baseCurrency = 'EUR'): Promise<{ rate: number; rateDate: string; isOffline: boolean }> {
    let record = await db.exchange_rates.get(date);
    let isOffline = false;

    if (!record) {
      // 找最近一筆快取
      const all = await db.exchange_rates.orderBy('date').reverse().first();
      if (!all) return { rate: 1, rateDate: date, isOffline: true };
      record = all;
      isOffline = true;
    }

    if (targetCurrency === baseCurrency) return { rate: 1, rateDate: record.date, isOffline };
    const rate = record.rates[targetCurrency] ?? 1;
    return { rate, rateDate: record.date, isOffline };
  }

  async getLatestCacheDate(): Promise<string | null> {
    const record = await db.exchange_rates.orderBy('date').reverse().first();
    return record?.date ?? null;
  }
}
