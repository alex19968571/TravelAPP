import Dexie, { Table } from 'dexie';
import {
  Trip, TripMember, ItineraryItem, ShoppingItem,
  Expense, ExpenseSplit, SyncQueueItem, BlobStoreItem, ExchangeRate
} from '../models';

export class LocalDb extends Dexie {
  trips!: Table<Trip, string>;
  trip_members!: Table<TripMember, string>;
  itinerary_items!: Table<ItineraryItem, string>;
  shopping_list!: Table<ShoppingItem, string>;
  expenses!: Table<Expense, string>;
  expense_splits!: Table<ExpenseSplit, string>;
  sync_queue!: Table<SyncQueueItem, string>;
  blob_store!: Table<BlobStoreItem, string>;
  exchange_rates!: Table<ExchangeRate, string>;

  constructor() {
    super('TravelAppDB');
    this.version(1).stores({
      trips:            'id, owner_id, updated_at_utc',
      trip_members:     'id, trip_id, user_id',
      itinerary_items:  'id, trip_id, day_number, order_index',
      shopping_list:    'client_record_id, trip_id, updated_at_utc',
      expenses:         'client_record_id, trip_id, updated_at_utc',
      expense_splits:   'id, expense_id, member_id',
      sync_queue:       'id, status, created_at',
      blob_store:       'id, linked_record_id',
      exchange_rates:   'base, date',
    });
  }
}

export const db = new LocalDb();
