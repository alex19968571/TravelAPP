export interface UserProfile {
  id: string;
  email: string;
  default_timezone: string;
  default_currency: string;
  avatar_url?: string | null;
  created_at_utc: string;
}

export interface Trip {
  id: string;
  title: string;
  target_timezone: string;
  base_currency: string;
  owner_id: string;
  row_version: number;
  start_date_utc?: string | null;
  end_date_utc?: string | null;
  invite_code_editor?: string | null;
  invite_code_viewer?: string | null;
  created_at_utc: string;
  updated_at_utc: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string | null;
  display_name: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
}

export type TransportMode = 'walk' | 'drive' | 'bike' | 'transit' | 'flight' | 'custom';

export interface ItineraryItem {
  id: string;
  trip_id: string;
  day_number: number;
  order_index: number;
  place_name: string;
  latitude: number;
  longitude: number;
  image_url?: string | null;
  notes?: string | null;
  encoded_polyline?: string;
  /** 到下一個景點的交通方式 */
  next_transport_mode?: TransportMode | null;
  /** 到下一個景點的所需分鐘數 */
  next_transport_minutes?: number | null;
  updated_at_utc: string;
}

export interface ShoppingItem {
  client_record_id: string;
  trip_id: string;
  title: string;
  description?: string;
  item_url?: string;
  image_url?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  is_bought: boolean;
  updated_at_utc: string;
}

export interface Expense {
  client_record_id: string;
  trip_id: string;
  title: string;
  amount: number;
  currency_code: string;
  exchange_rate: number;
  converted_amount: number;
  expense_date_utc: string;
  payer_member_id: string;
  receipt_image_url?: string;
  ocr_raw_data?: Record<string, unknown>;
  split_type: 'EQUAL' | 'EXACT' | 'SHARES';
  updated_at_utc: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  owed_amount: number;
  converted_owed_amount: number;
  share_weight: number;
}

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncStatus = 'PENDING' | 'SYNCING' | 'FAILED';

export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  table_name: string;
  payload: Record<string, unknown>;
  status: SyncStatus;
  retry_count: number;
  created_at: string;
}

export interface BlobStoreItem {
  id: string;
  blob: Blob;
  mime_type: string;
  linked_record_id: string;
  linked_field: string;
}

export interface ExchangeRate {
  base: string;
  date: string;
  rates: Record<string, number>;
  fetched_at: string;
}
