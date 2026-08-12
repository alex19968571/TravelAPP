import { Injectable } from '@angular/core';
import { db } from '../db/local.db';
import { haversineDistanceKm } from '../utils/geo.util';

export interface NearbySpotsResult {
  placeName: string;
  radiusKm: number;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class NearbySpotsService {
  /** 找出今天對應的行程天數內的景點，並回報目前位置周邊有幾個。無對應資料時回傳 null。 */
  async findTodaysNearbySpots(radiusKm = 5): Promise<NearbySpotsResult | null> {
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);

    const trips = await db.trips.toArray();
    const activeTrip = trips.find((t) => {
      if (!t.start_date_utc) return false;
      const start = new Date(t.start_date_utc.split('T')[0]);
      const end = t.end_date_utc ? new Date(t.end_date_utc.split('T')[0]) : start;
      return today >= start && today <= end;
    });
    if (!activeTrip || !activeTrip.start_date_utc) return null;

    const start = new Date(activeTrip.start_date_utc.split('T')[0]);
    const dayNumber = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;

    const items = await db.itinerary_items
      .where('trip_id')
      .equals(activeTrip.id)
      .and((i) => i.day_number === dayNumber)
      .toArray();
    if (!items.length) return null;

    const position = await this.getCurrentPosition();
    if (!position) return null;

    const count = items.filter(
      (i) => haversineDistanceKm(position.lat, position.lng, i.latitude, i.longitude) <= radiusKm,
    ).length;

    const placeName = await this.reverseGeocode(position.lat, position.lng);

    return { placeName, radiusKm, count };
  }

  private getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 },
      );
    });
  }

  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-TW`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const addr = data?.address ?? {};
      return (
        addr.suburb ||
        addr.city_district ||
        addr.city ||
        addr.town ||
        addr.county ||
        data?.display_name ||
        '目前位置'
      );
    } catch {
      return '目前位置';
    }
  }
}
