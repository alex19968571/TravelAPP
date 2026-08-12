import { Injectable, inject } from '@angular/core';
import { db } from '../db/local.db';
import { SyncEngineService } from './sync-engine.service';
import { FlightWatch } from '../models';
import { generateId } from '../utils/uuid.util';

@Injectable({ providedIn: 'root' })
export class FlightWatchService {
  private sync = inject(SyncEngineService);

  async getAll(ownerId: string): Promise<FlightWatch[]> {
    return db.flight_watches.where('owner_id').equals(ownerId).sortBy('updated_at_utc');
  }

  async create(
    data: Omit<
      FlightWatch,
      'id' | 'last_price' | 'last_checked_at' | 'created_at_utc' | 'updated_at_utc'
    >,
  ): Promise<FlightWatch> {
    const now = new Date().toISOString();
    const item: FlightWatch = {
      id: generateId(),
      last_price: null,
      last_checked_at: null,
      created_at_utc: now,
      updated_at_utc: now,
      ...data,
    };
    await db.flight_watches.add(item);
    await this.sync.enqueue('CREATE', 'flight_watches', item as unknown as Record<string, unknown>);
    return item;
  }

  async update(id: string, changes: Partial<FlightWatch>): Promise<void> {
    const now = new Date().toISOString();
    await db.flight_watches.update(id, { ...changes, updated_at_utc: now });
    const full = await db.flight_watches.get(id);
    if (full) {
      await this.sync.enqueue(
        'UPDATE',
        'flight_watches',
        full as unknown as Record<string, unknown>,
      );
    }
  }

  async delete(id: string): Promise<void> {
    await db.flight_watches.delete(id);
    await this.sync.enqueue('DELETE', 'flight_watches', { id });
  }
}
