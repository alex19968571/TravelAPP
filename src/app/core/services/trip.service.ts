import { Injectable, inject } from '@angular/core';
import { db } from '../db/local.db';
import { SyncEngineService } from './sync-engine.service';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { Trip, TripMember, ItineraryItem } from '../models';
import { generateId, generateInviteCode } from '../utils/uuid.util';

@Injectable({ providedIn: 'root' })
export class TripService {
  private sync = inject(SyncEngineService);
  private auth = inject(AuthService);
  private supabase = inject(SupabaseService).client;

  async getAll(): Promise<Trip[]> {
    const userId = this.auth.user()?.id ?? '';
    const owned = await db.trips.where('owner_id').equals(userId).toArray();
    const memberships = await db.trip_members.where('user_id').equals(userId).toArray();
    const memberTripIds = memberships
      .map((m) => m.trip_id)
      .filter((id) => !owned.some((t) => t.id === id));
    const joined = memberTripIds.length ? await db.trips.bulkGet(memberTripIds) : [];
    const all = [...owned, ...joined.filter((t): t is Trip => !!t)];
    return all.sort((a, b) => b.updated_at_utc.localeCompare(a.updated_at_utc));
  }

  async getById(id: string): Promise<Trip | undefined> {
    return db.trips.get(id);
  }

  async create(
    data: Pick<
      Trip,
      'title' | 'target_timezone' | 'base_currency' | 'start_date_utc' | 'end_date_utc'
    >,
  ): Promise<Trip> {
    const userId = this.auth.user()?.id ?? '';
    const now = new Date().toISOString();
    const trip: Trip = {
      id: generateId(),
      owner_id: userId,
      row_version: 1,
      invite_code_editor: generateInviteCode(),
      invite_code_viewer: generateInviteCode(),
      created_at_utc: now,
      updated_at_utc: now,
      ...data,
    };
    await db.trips.add(trip);
    await this.sync.enqueue('CREATE', 'trips', trip as unknown as Record<string, unknown>);

    // 自動將 owner 加入成員表
    const member: TripMember = {
      id: generateId(),
      trip_id: trip.id,
      user_id: userId,
      display_name: this.auth.user()?.email?.split('@')[0] ?? 'Owner',
      role: 'OWNER',
    };
    await db.trip_members.add(member);
    await this.sync.enqueue('CREATE', 'trip_members', member as unknown as Record<string, unknown>);

    return trip;
  }

  async update(
    id: string,
    changes: Partial<
      Pick<Trip, 'title' | 'target_timezone' | 'base_currency' | 'start_date_utc' | 'end_date_utc'>
    >,
  ): Promise<void> {
    const now = new Date().toISOString();
    await db.trips.update(id, { ...changes, updated_at_utc: now });
    await this.sync.enqueue('UPDATE', 'trips', { id, ...changes, updated_at_utc: now });
  }

  async delete(id: string): Promise<void> {
    await db.trips.delete(id);
    await this.sync.enqueue('DELETE', 'trips', { id });
  }

  // ── 邀請碼加入行程 ─────────────────────────────────────────────────
  /** 以邀請碼（可編輯／可查看）加入行程；成功則回傳行程 id，失敗回傳 null */
  async joinByInviteCode(code: string): Promise<string | null> {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return null;

    const { data, error } = await this.supabase.rpc('join_trip_by_invite_code', {
      p_invite_code: trimmed,
    });
    if (error || !data?.length) {
      console.error('[TripService] joinByInviteCode error', error);
      return null;
    }

    const userId = this.auth.user()?.id ?? '';
    await this.sync.syncDown(userId);
    return data[0].trip_id as string;
  }

  // ── 成員管理 ──────────────────────────────────────────────────────
  async getMembers(tripId: string): Promise<TripMember[]> {
    return db.trip_members.where('trip_id').equals(tripId).toArray();
  }

  async addMember(tripId: string, displayName: string, userId?: string): Promise<TripMember> {
    const member: TripMember = {
      id: generateId(),
      trip_id: tripId,
      user_id: userId ?? null,
      display_name: displayName,
      role: 'VIEWER',
    };
    await db.trip_members.add(member);
    await this.sync.enqueue('CREATE', 'trip_members', member as unknown as Record<string, unknown>);
    return member;
  }

  async removeMember(memberId: string): Promise<void> {
    await db.trip_members.delete(memberId);
    await this.sync.enqueue('DELETE', 'trip_members', { id: memberId });
  }

  // ── 景點行程管理 ───────────────────────────────────────────────────
  async getItinerary(tripId: string): Promise<ItineraryItem[]> {
    const items = await db.itinerary_items.where('trip_id').equals(tripId).toArray();
    return items.sort((a, b) => a.day_number - b.day_number || a.order_index - b.order_index);
  }

  async addItineraryItem(
    data: Omit<ItineraryItem, 'id' | 'updated_at_utc'>,
  ): Promise<ItineraryItem> {
    const item: ItineraryItem = {
      id: generateId(),
      updated_at_utc: new Date().toISOString(),
      ...data,
    };
    await db.itinerary_items.add(item);
    await this.sync.enqueue(
      'CREATE',
      'itinerary_items',
      item as unknown as Record<string, unknown>,
    );
    return item;
  }

  async updateItineraryOrder(items: ItineraryItem[]): Promise<void> {
    const now = new Date().toISOString();
    for (const [i, item] of items.entries()) {
      await db.itinerary_items.update(item.id, { order_index: i, updated_at_utc: now });
      await this.sync.enqueue('UPDATE', 'itinerary_items', {
        id: item.id,
        order_index: i,
        updated_at_utc: now,
      });
    }
  }

  async updatePolyline(itemId: string, encodedPolyline: string): Promise<void> {
    const now = new Date().toISOString();
    await db.itinerary_items.update(itemId, {
      encoded_polyline: encodedPolyline,
      updated_at_utc: now,
    });
    await this.sync.enqueue('UPDATE', 'itinerary_items', {
      id: itemId,
      encoded_polyline: encodedPolyline,
      updated_at_utc: now,
    });
  }

  async updateItineraryItem(
    id: string,
    changes: Partial<Pick<ItineraryItem, 'place_name' | 'image_url' | 'notes'>>,
  ): Promise<void> {
    const now = new Date().toISOString();
    await db.itinerary_items.update(id, { ...changes, updated_at_utc: now });
    await this.sync.enqueue('UPDATE', 'itinerary_items', { id, ...changes, updated_at_utc: now });
  }

  async removeItineraryItem(itemId: string): Promise<void> {
    await db.itinerary_items.delete(itemId);
    await this.sync.enqueue('DELETE', 'itinerary_items', { id: itemId });
  }

  /** 上傳景點照片，回傳公開 URL（失敗回傳 null） */
  async uploadItineraryPhoto(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${generateId()}.${ext}`;
    const { error } = await this.supabase.storage
      .from('itinerary-images')
      .upload(path, file, { contentType: file.type });
    if (error) { console.error('[TripService] uploadItineraryPhoto error', error); return null; }
    const { data } = this.supabase.storage.from('itinerary-images').getPublicUrl(path);
    return data.publicUrl;
  }

  /** 在指定日期的第 position（0-based）個位置插入景點，自動往後遞補其餘景點順序 */
  async addItineraryItemAtPosition(
    data: Omit<ItineraryItem, 'id' | 'updated_at_utc' | 'order_index'>,
    position: number,
  ): Promise<ItineraryItem> {
    const dayItems = (await this.getItinerary(data.trip_id))
      .filter(i => i.day_number === data.day_number)
      .sort((a, b) => a.order_index - b.order_index);
    const pos = Math.max(0, Math.min(position, dayItems.length));

    for (let i = dayItems.length - 1; i >= pos; i--) {
      const it = dayItems[i];
      const nextIndex = it.order_index + 1;
      await db.itinerary_items.update(it.id, { order_index: nextIndex });
      await this.sync.enqueue('UPDATE', 'itinerary_items', { id: it.id, order_index: nextIndex });
    }

    const item: ItineraryItem = {
      id: generateId(),
      updated_at_utc: new Date().toISOString(),
      order_index: pos,
      ...data,
    };
    await db.itinerary_items.add(item);
    await this.sync.enqueue('CREATE', 'itinerary_items', item as unknown as Record<string, unknown>);
    return item;
  }
}
