import { Injectable, inject } from '@angular/core';
import imageCompression from 'browser-image-compression';
import { db } from '../db/local.db';
import { SyncEngineService } from './sync-engine.service';
import { ShoppingItem } from '../models';
import { generateId } from '../utils/uuid.util';

@Injectable({ providedIn: 'root' })
export class ShoppingService {
  private sync = inject(SyncEngineService);

  async getByTrip(tripId: string): Promise<ShoppingItem[]> {
    return db.shopping_list.where('trip_id').equals(tripId).sortBy('updated_at_utc');
  }

  async create(data: Omit<ShoppingItem, 'client_record_id' | 'updated_at_utc'>): Promise<ShoppingItem> {
    const item: ShoppingItem = {
      client_record_id: generateId(),
      updated_at_utc: new Date().toISOString(),
      ...data,
    };
    await db.shopping_list.add(item);
    await this.sync.enqueue('CREATE', 'shopping_list', item as unknown as Record<string, unknown>);
    return item;
  }

  async update(id: string, changes: Partial<ShoppingItem>): Promise<void> {
    const now = new Date().toISOString();
    await db.shopping_list.update(id, { ...changes, updated_at_utc: now });
    await this.sync.enqueue('UPDATE', 'shopping_list', {
      client_record_id: id, ...changes, updated_at_utc: now,
    });
  }

  async toggleBought(id: string, current: boolean): Promise<void> {
    await this.update(id, { is_bought: !current });
  }

  async delete(id: string): Promise<void> {
    await db.shopping_list.delete(id);
    await this.sync.enqueue('DELETE', 'shopping_list', { client_record_id: id });
  }

  // 圖片壓縮 → 上傳或存入 BlobStore（離線）
  async handleImageUpload(file: File, itemId: string): Promise<string> {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1080,
      useWebWorker: true,
    });

    if (navigator.onLine) {
      // 有網路：直接存入 BlobStore 交由 SyncEngine 上傳
      // SyncEngine flushBlobs 會在 syncUp 時自動處理
    }

    const blobId = generateId();
    await db.blob_store.add({
      id: blobId,
      blob: compressed,
      mime_type: compressed.type || 'image/jpeg',
      linked_record_id: itemId,
      linked_field: 'image_url',
    });

    // 立即嘗試上傳（有網路時）
    return blobId;
  }
}
