import { Injectable, inject, OnDestroy } from '@angular/core';
import { fromEvent, merge, Subject, Subscription } from 'rxjs';
import { debounceTime, filter, takeUntil } from 'rxjs/operators';
import type { Table } from 'dexie';
import { db } from '../db/local.db';
import { SupabaseService } from './supabase.service';
import {
  SyncQueueItem,
  Trip,
  ShoppingItem,
  Expense,
  FlightWatch,
  TripReminder,
  TravelMapPin,
} from '../models';
import { generateId } from '../utils/uuid.util';

type TableName =
  | 'trips'
  | 'shopping_list'
  | 'expenses'
  | 'itinerary_items'
  | 'trip_members'
  | 'expense_splits'
  | 'flight_watches'
  | 'trip_reminders'
  | 'travel_map_pins';

const CONFLICT_FIELD: Partial<Record<TableName, string>> = {
  shopping_list: 'client_record_id',
  expenses: 'client_record_id',
};

@Injectable({ providedIn: 'root' })
export class SyncEngineService implements OnDestroy {
  private supabase = inject(SupabaseService).client;
  private destroy$ = new Subject<void>();
  private syncing = false;

  constructor() {
    this.initNetworkListener();
  }

  private initNetworkListener(): void {
    const online$ = fromEvent(window, 'online');
    const visible$ = fromEvent(document, 'visibilitychange').pipe(
      filter(() => document.visibilityState === 'visible'),
    );

    merge(online$, visible$)
      .pipe(debounceTime(3000), takeUntil(this.destroy$))
      .subscribe(() => this.syncUp());
  }

  // ── Sync-Down：登入後從雲端覆蓋寫入本地 ──────────────────────────
  async syncDown(userId: string): Promise<void> {
    try {
      // 先把本機尚未上傳的異動（sync_queue 裡的 PENDING/FAILED 項目）送出去，
      // 避免「剛編輯完就重整」時，這裡撈回的還是編輯前的舊遠端資料，把本機剛存的
      // 異動蓋掉（尤其 Ctrl+F5 這種會整個重新載入頁面的操作，很容易跟尚未送達
      // 伺服器的背景同步撞在一起）。
      await this.syncUp();

      const [
        { data: ownedTrips, error: ownedTripsErr },
        { data: members, error: membersErr },
        { data: flightWatches, error: flightWatchesErr },
        { data: tripReminders, error: tripRemindersErr },
        { data: travelMapPins, error: travelMapPinsErr },
      ] = await Promise.all([
        this.supabase.from('trips').select('*').eq('owner_id', userId),
        this.supabase.from('trip_members').select('*').eq('user_id', userId),
        this.supabase.from('flight_watches').select('*').eq('owner_id', userId),
        this.supabase.from('trip_reminders').select('*').eq('user_id', userId),
        this.supabase.from('travel_map_pins').select('*').eq('owner_id', userId),
      ]);
      if (ownedTripsErr) console.error('[SyncEngine] fetch trips error', ownedTripsErr);
      if (membersErr) console.error('[SyncEngine] fetch trip_members error', membersErr);
      if (flightWatchesErr)
        console.error('[SyncEngine] fetch flight_watches error', flightWatchesErr);
      if (tripRemindersErr)
        console.error('[SyncEngine] fetch trip_reminders error', tripRemindersErr);
      if (travelMapPinsErr)
        console.error('[SyncEngine] fetch travel_map_pins error', travelMapPinsErr);

      // 除了自己擁有的行程，也要抓透過邀請碼／連結加入的行程
      const joinedTripIds = [
        ...new Set((members ?? []).map((m) => (m as any).trip_id as string)),
      ].filter((id) => !(ownedTrips ?? []).some((t) => (t as any).id === id));
      const { data: joinedTrips, error: joinedTripsErr } = joinedTripIds.length
        ? await this.supabase.from('trips').select('*').in('id', joinedTripIds)
        : { data: [] as unknown[], error: null };
      if (joinedTripsErr) console.error('[SyncEngine] fetch joined trips error', joinedTripsErr);

      const trips = [...(ownedTrips ?? []), ...(joinedTrips ?? [])];
      const tripIds = trips.map((t) => (t as any).id as string);
      const tripsQueryOk = !ownedTripsErr && !joinedTripsErr;

      const [
        { data: itineraryItems, error: itineraryErr },
        { data: shoppingItems, error: shoppingErr },
        { data: expenses, error: expensesErr },
        { data: splits },
      ] = tripIds.length
        ? await Promise.all([
            this.supabase.from('itinerary_items').select('*').in('trip_id', tripIds),
            this.supabase.from('shopping_list').select('*').in('trip_id', tripIds),
            this.supabase.from('expenses').select('*').in('trip_id', tripIds),
            this.supabase.from('expense_splits').select('*'),
          ])
        : ([
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ] as any[]);

      if (itineraryErr) console.error('[SyncEngine] fetch itinerary_items error', itineraryErr);
      if (shoppingErr) console.error('[SyncEngine] fetch shopping_list error', shoppingErr);
      if (expensesErr) console.error('[SyncEngine] fetch expenses error', expensesErr);

      await db.transaction(
        'rw',
        [
          db.trips,
          db.trip_members,
          db.itinerary_items,
          db.shopping_list,
          db.expenses,
          db.expense_splits,
          db.flight_watches,
          db.trip_reminders,
          db.travel_map_pins,
          db.sync_queue,
        ],
        async () => {
          if (tripsQueryOk) {
            await this.pruneStale(
              db.trips,
              'trips',
              'id',
              await db.trips.toArray(),
              new Set(tripIds),
            );
          }
          if (trips.length) {
            const safeTrips = await this.excludePending('trips', trips as Trip[], 'id');
            if (safeTrips.length) await db.trips.bulkPut(safeTrips);
          }

          if (!membersErr) {
            await this.pruneStale(
              db.trip_members,
              'trip_members',
              'id',
              await db.trip_members.where('user_id').equals(userId).toArray(),
              new Set((members ?? []).map((m: any) => m.id)),
            );
          }
          if (members?.length) await db.trip_members.bulkPut(members as any[]);

          if (!flightWatchesErr) {
            await this.pruneStale(
              db.flight_watches,
              'flight_watches',
              'id',
              await db.flight_watches.where('owner_id').equals(userId).toArray(),
              new Set((flightWatches ?? []).map((r: any) => r.id)),
            );
          }
          if (flightWatches?.length)
            await db.flight_watches.bulkPut(flightWatches as FlightWatch[]);

          if (!tripRemindersErr) {
            await this.pruneStale(
              db.trip_reminders,
              'trip_reminders',
              'id',
              await db.trip_reminders.where('user_id').equals(userId).toArray(),
              new Set((tripReminders ?? []).map((r: any) => r.id)),
            );
          }
          if (tripReminders?.length)
            await db.trip_reminders.bulkPut(tripReminders as TripReminder[]);

          if (!travelMapPinsErr) {
            await this.pruneStale(
              db.travel_map_pins,
              'travel_map_pins',
              'id',
              await db.travel_map_pins.where('owner_id').equals(userId).toArray(),
              new Set((travelMapPins ?? []).map((r: any) => r.id)),
            );
          }
          if (travelMapPins?.length)
            await db.travel_map_pins.bulkPut(travelMapPins as TravelMapPin[]);

          // 以伺服器資料為準：清掉「本機有、伺服器已無（例如已在其他裝置刪除）
          // 且不是尚待上傳的本機新資料」的記錄，避免多裝置間資料分歧。
          // 只有在該表格查詢確實成功時才清理，避免查詢失敗（回傳 null/空陣列）
          // 被誤判成「伺服器上真的沒有資料」而整批刪掉本機資料。
          if (tripIds.length) {
            if (!itineraryErr) {
              await this.pruneStale(
                db.itinerary_items,
                'itinerary_items',
                'id',
                await db.itinerary_items.where('trip_id').anyOf(tripIds).toArray(),
                new Set((itineraryItems ?? []).map((r: any) => r.id)),
              );
            }
            if (!shoppingErr) {
              await this.pruneStale(
                db.shopping_list,
                'shopping_list',
                'client_record_id',
                await db.shopping_list.where('trip_id').anyOf(tripIds).toArray(),
                new Set((shoppingItems ?? []).map((r: any) => r.client_record_id)),
              );
            }
            if (!expensesErr) {
              await this.pruneStale(
                db.expenses,
                'expenses',
                'client_record_id',
                await db.expenses.where('trip_id').anyOf(tripIds).toArray(),
                new Set((expenses ?? []).map((r: any) => r.client_record_id)),
              );
            }
          }

          if (itineraryItems?.length) await db.itinerary_items.bulkPut(itineraryItems as any[]);
          if (shoppingItems?.length)
            await db.shopping_list.bulkPut(shoppingItems as ShoppingItem[]);
          if (expenses?.length) await db.expenses.bulkPut(expenses as Expense[]);
          if (splits?.length) await db.expense_splits.bulkPut(splits as any[]);
        },
      );
    } catch (err) {
      console.error('[SyncEngine] syncDown error', err);
    }
  }

  /**
   * 從即將 bulkPut 覆蓋本機的遠端資料中，剔除「本機仍有尚未上傳成功」的記錄
   * （sync_queue 裡還有該筆的 PENDING/FAILED/SYNCING 項目），避免用撈到的舊遠端
   * 資料覆蓋掉本機剛做的、伺服器還沒收到的異動。呼叫端已在 syncDown() 開頭先跑過
   * syncUp() 把佇列清空，這裡是防止 syncUp 失敗（例如剛好離線）時的最後一道防線。
   */
  private async excludePending<T>(tableName: string, records: T[], idField: string): Promise<T[]> {
    const pending = await db.sync_queue.where('table_name').equals(tableName).toArray();
    if (!pending.length) return records;
    const protectedIds = new Set(pending.map((p) => (p.payload as any)[idField]).filter(Boolean));
    return protectedIds.size
      ? records.filter(
          (r) => !protectedIds.has((r as unknown as Record<string, unknown>)[idField] as string),
        )
      : records;
  }

  /** 刪除本機存在、但伺服器已沒有、且未在同步佇列中等待上傳的記錄 */
  private async pruneStale(
    table: Table<any, string>,
    tableName: string,
    idField: string,
    localRecords: any[],
    serverIds: Set<string>,
  ): Promise<void> {
    const pending = await db.sync_queue.where('table_name').equals(tableName).toArray();
    const protectedIds = new Set(pending.map((p) => (p.payload as any)[idField]).filter(Boolean));
    const staleIds = localRecords
      .map((r) => r[idField] as string)
      .filter((id) => !serverIds.has(id) && !protectedIds.has(id));
    if (staleIds.length) await table.bulkDelete(staleIds);
  }

  // ── Sync-Up：批次處理 SyncQueue → Supabase ───────────────────────
  async syncUp(): Promise<void> {
    if (this.syncing || !navigator.onLine) return;
    this.syncing = true;

    try {
      await this.flushBlobs();
      const pending = await db.sync_queue
        .where('status')
        .anyOf(['PENDING', 'FAILED'])
        .and((item) => item.retry_count < 5)
        .sortBy('created_at');

      for (const item of pending) {
        await this.processSyncItem(item);
      }
    } catch (err) {
      console.error('[SyncEngine] syncUp error', err);
    } finally {
      this.syncing = false;
    }
  }

  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    await db.sync_queue.update(item.id, { status: 'SYNCING' });
    try {
      // supabase-js 的 query builder 不會在 API 錯誤時 throw（例如 PostgREST schema
      // cache 還沒認到新欄位、RLS 擋掉寫入等），只會回傳 { error }。之前這裡完全沒檢查
      // error，導致上傳「看起來成功」、佇列項目照樣被刪掉，實際上資料根本沒寫進
      // Supabase（這就是行程出發地/目的地存檔後 Supabase 端一直是 NULL 的原因）。
      let error: { message?: string } | null = null;
      if (item.operation === 'DELETE') {
        const pkField = CONFLICT_FIELD[item.table_name as TableName] ?? 'id';
        ({ error } = await this.supabase
          .from(item.table_name)
          .delete()
          .eq(pkField, (item.payload as any)[pkField]));
      } else {
        const conflictCol = CONFLICT_FIELD[item.table_name as TableName] ?? 'id';
        ({ error } = await this.supabase
          .from(item.table_name)
          .upsert(item.payload, { onConflict: conflictCol }));
      }
      if (error) throw error;
      await db.sync_queue.delete(item.id);
    } catch (err) {
      console.error(`[SyncEngine] failed item ${item.id}`, err);
      await db.sync_queue.update(item.id, {
        status: 'FAILED',
        retry_count: item.retry_count + 1,
      });
    }
  }

  // ── 待傳 Blob 先補上傳，取得 URL 後回填本地 ──────────────────────
  private async flushBlobs(): Promise<void> {
    const blobs = await db.blob_store.toArray();
    for (const item of blobs) {
      try {
        const ext = item.mime_type.split('/')[1] ?? 'jpg';
        const path = `${item.linked_record_id}/${item.id}.${ext}`;
        const { error } = await this.supabase.storage
          .from('shopping-images')
          .upload(path, item.blob, { contentType: item.mime_type, upsert: true });

        if (!error) {
          const { data } = this.supabase.storage.from('shopping-images').getPublicUrl(path);
          // 回填對應 table 的 image_url 欄位
          if (item.linked_field === 'image_url') {
            await db.shopping_list.update(item.linked_record_id, { image_url: data.publicUrl });
            // 加入 SyncQueue 更新雲端
            await this.enqueue('UPDATE', 'shopping_list', {
              client_record_id: item.linked_record_id,
              image_url: data.publicUrl,
              updated_at_utc: new Date().toISOString(),
            });
          }
          await db.blob_store.delete(item.id);
        }
      } catch (err) {
        console.error('[SyncEngine] blob flush error', err);
      }
    }
  }

  // ── 公開方法：寫入操作時同步加入 SyncQueue ───────────────────────
  async enqueue(
    operation: SyncQueueItem['operation'],
    tableName: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await db.sync_queue.add({
      id: generateId(),
      operation,
      table_name: tableName,
      payload,
      status: 'PENDING',
      retry_count: 0,
      created_at: new Date().toISOString(),
    });
    // 有網路時立即嘗試同步
    if (navigator.onLine) {
      setTimeout(() => this.syncUp(), 100);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
