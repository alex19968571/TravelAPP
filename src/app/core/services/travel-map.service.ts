import { Injectable, inject } from '@angular/core';
import { db } from '../db/local.db';
import { SyncEngineService } from './sync-engine.service';
import { SupabaseService } from './supabase.service';
import { TravelMapPin } from '../models';
import { generateId } from '../utils/uuid.util';

export interface PublicMapTrip {
  id: string;
  title: string;
  origin: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_country_code: string | null;
  start_date_utc: string | null;
}

@Injectable({ providedIn: 'root' })
export class TravelMapService {
  private sync = inject(SyncEngineService);
  private supabase = inject(SupabaseService).client;

  async getAll(ownerId: string): Promise<TravelMapPin[]> {
    return db.travel_map_pins.where('owner_id').equals(ownerId).toArray();
  }

  async getByTripId(tripId: string): Promise<TravelMapPin | undefined> {
    return db.travel_map_pins.where('trip_id').equals(tripId).first();
  }

  /** 1 行程對應 1 筆，沒有就新增、有就更新 */
  async upsertForTrip(
    tripId: string,
    ownerId: string,
    changes: Partial<Pick<TravelMapPin, 'photo_urls' | 'audio_url' | 'notes' | 'arc_color'>>,
  ): Promise<TravelMapPin> {
    const existing = await this.getByTripId(tripId);
    const now = new Date().toISOString();
    if (existing) {
      const updated: TravelMapPin = { ...existing, ...changes, updated_at_utc: now };
      await db.travel_map_pins.put(updated);
      await this.sync.enqueue(
        'UPDATE',
        'travel_map_pins',
        updated as unknown as Record<string, unknown>,
      );
      return updated;
    }
    const created: TravelMapPin = {
      id: generateId(),
      owner_id: ownerId,
      trip_id: tripId,
      photo_urls: [],
      audio_url: null,
      notes: null,
      arc_color: null,
      created_at_utc: now,
      updated_at_utc: now,
      ...changes,
    };
    await db.travel_map_pins.add(created);
    await this.sync.enqueue(
      'CREATE',
      'travel_map_pins',
      created as unknown as Record<string, unknown>,
    );
    return created;
  }

  async delete(id: string): Promise<void> {
    await db.travel_map_pins.delete(id);
    await this.sync.enqueue('DELETE', 'travel_map_pins', { id });
  }

  async uploadPhoto(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${generateId()}.${ext}`;
    const { error } = await this.supabase.storage
      .from('map-pin-photos')
      .upload(path, file, { contentType: file.type });
    if (error) {
      console.error('[TravelMapService] uploadPhoto error', error);
      return null;
    }
    const { data } = this.supabase.storage.from('map-pin-photos').getPublicUrl(path);
    return data.publicUrl;
  }

  async uploadAudio(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'm4a';
    const path = `${generateId()}.${ext}`;
    const { error } = await this.supabase.storage
      .from('map-pin-audio')
      .upload(path, file, { contentType: file.type });
    if (error) {
      console.error('[TravelMapService] uploadAudio error', error);
      return null;
    }
    const { data } = this.supabase.storage.from('map-pin-audio').getPublicUrl(path);
    return data.publicUrl;
  }

  // ── 公開分享（免登入，直接呼叫 RPC，不經過 Dexie） ──────────────
  async getPublicTrips(token: string): Promise<PublicMapTrip[]> {
    const { data, error } = await this.supabase.rpc('get_public_map_trips', { p_token: token });
    if (error) {
      console.error('[TravelMapService] getPublicTrips error', error);
      return [];
    }
    return (data ?? []) as PublicMapTrip[];
  }

  async getPublicPins(token: string): Promise<TravelMapPin[]> {
    const { data, error } = await this.supabase.rpc('get_public_map_pins', { p_token: token });
    if (error) {
      console.error('[TravelMapService] getPublicPins error', error);
      return [];
    }
    return (data ?? []) as TravelMapPin[];
  }

  async getPublicTripItinerary(token: string, tripId: string): Promise<any[]> {
    const { data, error } = await this.supabase.rpc('get_public_trip_itinerary', {
      p_token: token,
      p_trip_id: tripId,
    });
    if (error) {
      console.error('[TravelMapService] getPublicTripItinerary error', error);
      return [];
    }
    return data ?? [];
  }
}
