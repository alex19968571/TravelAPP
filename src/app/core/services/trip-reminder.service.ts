import { Injectable, inject } from '@angular/core';
import { db } from '../db/local.db';
import { SyncEngineService } from './sync-engine.service';
import { SupabaseService } from './supabase.service';
import { ReminderOffsetType, TripReminder } from '../models';
import { generateId } from '../utils/uuid.util';

export interface SaveTripReminderParams {
  tripId: string;
  userId: string;
  offsetTypes: ReminderOffsetType[];
  /** 'YYYY-MM-DDTHH:mm'，僅在 offsetTypes 含 'custom' 時需要 */
  customDateTimeLocal?: string;
  notifyEmail: string;
  enabled: boolean;
  tripStartDateUtc: string | null | undefined;
}

@Injectable({ providedIn: 'root' })
export class TripReminderService {
  private sync = inject(SyncEngineService);
  private supabase = inject(SupabaseService).client;

  async getForTrip(tripId: string, userId: string): Promise<TripReminder[]> {
    return db.trip_reminders
      .where('trip_id')
      .equals(tripId)
      .and((r) => r.user_id === userId)
      .toArray();
  }

  /** 以「先刪舊、再依目前勾選的提醒時間點重建」的方式儲存，避免新增/取消勾選要各自比對差異 */
  async saveForTrip(params: SaveTripReminderParams): Promise<void> {
    const existing = await this.getForTrip(params.tripId, params.userId);
    for (const r of existing) {
      await db.trip_reminders.delete(r.id);
      await this.sync.enqueue('DELETE', 'trip_reminders', { id: r.id });
    }

    const now = new Date().toISOString();
    for (const offsetType of params.offsetTypes) {
      const notifyAtUtc = this.computeNotifyAtUtc(
        offsetType,
        params.tripStartDateUtc,
        params.customDateTimeLocal,
      );
      if (!notifyAtUtc) continue;

      const reminder: TripReminder = {
        id: generateId(),
        trip_id: params.tripId,
        user_id: params.userId,
        offset_type: offsetType,
        notify_at_utc: notifyAtUtc,
        notify_email: params.notifyEmail,
        enabled: params.enabled,
        sent_at_utc: null,
        created_at_utc: now,
      };
      await db.trip_reminders.add(reminder);
      await this.sync.enqueue(
        'CREATE',
        'trip_reminders',
        reminder as unknown as Record<string, unknown>,
      );
    }
  }

  /** 儲存提醒後立即觸發一次寄信檢查，避免使用者乾等到下一次排程（最多 1 分鐘）才寄出到期的提醒 */
  async triggerImmediateCheck(): Promise<void> {
    await this.sync.syncUp(); // 先確保剛存的提醒已同步上雲，Edge Function 才查得到
    try {
      await this.supabase.functions.invoke('send-trip-reminders', { body: {} });
    } catch (err) {
      console.error('[TripReminderService] triggerImmediateCheck error', err);
    }
  }

  async deleteForTrip(tripId: string, userId: string): Promise<void> {
    const existing = await this.getForTrip(tripId, userId);
    for (const r of existing) {
      await db.trip_reminders.delete(r.id);
      await this.sync.enqueue('DELETE', 'trip_reminders', { id: r.id });
    }
  }

  private computeNotifyAtUtc(
    offsetType: ReminderOffsetType,
    tripStartDateUtc: string | null | undefined,
    customDateTimeLocal?: string,
  ): string | null {
    if (offsetType === 'custom') {
      return customDateTimeLocal ? new Date(customDateTimeLocal).toISOString() : null;
    }
    if (!tripStartDateUtc) return null;
    const start = new Date(tripStartDateUtc);

    if (offsetType === 'seven_days_before') {
      const d = new Date(start);
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    if (offsetType === 'one_day_before') {
      const d = new Date(start);
      d.setDate(d.getDate() - 1);
      return d.toISOString();
    }
    if (offsetType === 'month_first') {
      return new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0, 0).toISOString();
    }
    return null;
  }
}
