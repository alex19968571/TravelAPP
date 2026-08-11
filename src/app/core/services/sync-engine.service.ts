import { Injectable, inject, OnDestroy } from '@angular/core';
import { fromEvent, merge, Subject, Subscription } from 'rxjs';
import { debounceTime, filter, takeUntil } from 'rxjs/operators';
import type { Table } from 'dexie';
import { db } from '../db/local.db';
import { SupabaseService } from './supabase.service';
import { SyncQueueItem, Trip, ShoppingItem, Expense } from '../models';
import { generateId } from '../utils/uuid.util';

type TableName =
  'trips' | 'shopping_list' | 'expenses' | 'itinerary_items' | 'trip_members' | 'expense_splits';

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
      const [{ data: ownedTrips }, { data: members }] = await Promise.all([
        this.supabase.from('trips').select('*').eq('owner_id', userId),
        this.supabase.from('trip_members').select('*').eq('user_id', userId),
      ]);

      // 除了自己擁有的行程，也要抓透過邀請碼／連結加入的行程
      const joinedTripIds = [
        ...new Set((members ?? []).map((m) => (m as any).trip_id as string)),
      ].filter((id) => !(ownedTrips ?? []).some((t) => (t as any).id === id));
      const { data: joinedTrips } = joinedTripIds.length
        ? await this.supabase.from('trips').select('*').in('id', joinedTripIds)
        : { data: [] as unknown[] };

      const trips = [...(ownedTrips ?? []), ...(joinedTrips ?? [])];
      const tripIds = trips.map((t) => (t as any).id as string);

      const [
        { data: itineraryItems },
        { data: shoppingItems },
        { data: expenses },
        { data: splits },
      ] = tripIds.length
        ? await Promise.all([
            this.supabase.from('itinerary_items').select('*').in('trip_id', tripIds),
            this.supabase.from('shopping_list').select('*').in('trip_id', tripIds),
            this.supabase.from('expenses').select('*').in('trip_id', tripIds),
            this.supabase.from('expense_splits').select('*'),
          ])
        : [
            { data: [] as any[] },
            { data: [] as any[] },
            { data: [] as any[] },
            { data: [] as any[] },
          ];

      await db.transaction(
        'rw',
        [
          db.trips,
          db.trip_members,
          db.itinerary_items,
          db.shopping_list,
          db.expenses,
          db.expense_splits,
          db.sync_queue,
        ],
        async () => {
          if (trips.length) await db.trips.bulkPut(trips as Trip[]);
          if (members?.length) await db.trip_members.bulkPut(members as any[]);

          // 以伺服器資料為準：清掉「本機有、伺服器已無（例如已在其他裝置刪除）
          // 且不是尚待上傳的本機新資料」的記錄，避免多裝置間資料分歧
          if (tripIds.length) {
            await this.pruneStale(
              db.itinerary_items,
              'itinerary_items',
              'id',
              await db.itinerary_items.where('trip_id').anyOf(tripIds).toArray(),
              new Set((itineraryItems ?? []).map((r: any) => r.id)),
            );
            await this.pruneStale(
              db.shopping_list,
              'shopping_list',
              'client_record_id',
              await db.shopping_list.where('trip_id').anyOf(tripIds).toArray(),
              new Set((shoppingItems ?? []).map((r: any) => r.client_record_id)),
            );
            await this.pruneStale(
              db.expenses,
              'expenses',
              'client_record_id',
              await db.expenses.where('trip_id').anyOf(tripIds).toArray(),
              new Set((expenses ?? []).map((r: any) => r.client_record_id)),
            );
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
      if (item.operation === 'DELETE') {
        const pkField = CONFLICT_FIELD[item.table_name as TableName] ?? 'id';
        await this.supabase
          .from(item.table_name)
          .delete()
          .eq(pkField, (item.payload as any)[pkField]);
      } else {
        const conflictCol = CONFLICT_FIELD[item.table_name as TableName] ?? 'id';
        await this.supabase.from(item.table_name).upsert(item.payload, { onConflict: conflictCol });
      }
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
