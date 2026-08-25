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
  /** 出發地顯示名稱（地點搜尋選定），供旅行地圖弧線起點使用 */
  origin?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  /** 目的地顯示名稱（地點搜尋選定），供旅行地圖大頭針/弧線終點使用 */
  destination?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  /** 目的地所在國家 ISO alpha-2 代碼（小寫），供旅行地圖弧線依國家分色 */
  destination_country_code?: string | null;
  created_at_utc: string;
  updated_at_utc: string;
}

/** 旅行地圖：每趟有目的地的行程最多一筆附加內容（照片/聲音/筆記/自訂弧線顏色） */
export interface TravelMapPin {
  id: string;
  owner_id: string;
  trip_id: string;
  photo_urls: string[];
  audio_url?: string | null;
  notes?: string | null;
  arc_color?: string | null;
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

export type ReminderOffsetType = 'month_first' | 'seven_days_before' | 'one_day_before' | 'custom';

export interface TripReminder {
  id: string;
  trip_id: string;
  user_id: string;
  offset_type: ReminderOffsetType;
  /** 實際寄信時間點（UTC），建立時依 offset_type 換算好存入，寄信端只需比對此欄位 */
  notify_at_utc: string;
  notify_email: string;
  enabled: boolean;
  sent_at_utc: string | null;
  created_at_utc: string;
}

/** 轉機次數篩選：不限 / 直達 / 轉機一次 / 轉機兩次(含)以上 */
export type FlightMaxStops = 'any' | 'direct' | 'one' | 'twoPlus';

export interface FlightWatch {
  id: string;
  owner_id: string;
  origin: string;
  destination: string;
  depart_date: string;
  return_date?: string | null;
  target_price?: number | null;
  currency: string;
  max_stops: FlightMaxStops;
  last_price: number | null;
  last_checked_at: string | null;
  created_at_utc: string;
  updated_at_utc: string;
}
