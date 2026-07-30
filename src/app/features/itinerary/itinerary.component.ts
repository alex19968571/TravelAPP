import {
  Component,
  inject,
  OnInit,
  AfterViewInit,
  signal,
  computed,
  ViewChild,
  ElementRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ItineraryItem, Trip } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { MapsService } from '../../core/services/maps.service';

interface DateTab {
  date: Date | null;
  dayNumber: number;
}
interface SearchResult {
  name: string;
  lat: number;
  lng: number;
}

const DAY_COLORS = ['#667eea', '#ed8936', '#48bb78', '#f56565', '#9f7aea', '#38b2ac'];

@Component({
  selector: 'app-itinerary',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a
          [routerLink]="['/trips', tripId]"
          class="back-btn"
          [attr.aria-label]="'itinerary.backToTrip' | transloco"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </a>
        <h1>{{ 'itinerary.title' | transloco }}</h1>
      </header>

      <!-- 搜尋列 -->
      <form class="search-row" (ngSubmit)="search()">
        <input
          [(ngModel)]="searchQuery"
          name="searchQuery"
          [placeholder]="'itinerary.searchPlaceholder' | transloco"
        />
        <button type="submit" class="btn-primary" [disabled]="!searchQuery.trim() || searching()">
          {{ (searching() ? 'itinerary.searching' : 'itinerary.searchButton') | transloco }}
        </button>
      </form>

      @if (searchNotFound()) {
        <p class="not-found">{{ 'itinerary.notFound' | transloco }}</p>
      }

      <!-- 地圖 -->
      <div #mapEl class="map-container"></div>

      <!-- 功能區塊：新增 / 編輯景點（垂直排列） -->
      @if (panelVisible()) {
        <div class="card staging-card">
          <!-- 標題列 -->
          <div class="panel-title">
            {{ editingItemId() ? '✏️ 編輯景點' : '＋ 新增景點' }}
          </div>

          <!-- 圖片（label 原生關聯 input，確保首次點擊即觸發） -->
          <label class="photo-block">
            @if (stagingPhotoUrl()) {
              <img [src]="stagingPhotoUrl()!" class="photo-img" alt="" />
              <div class="photo-overlay">點擊更換圖片</div>
            } @else if (uploadingPhoto()) {
              <div class="photo-placeholder">
                <span class="upload-spin">⏳</span>
                <span class="photo-hint">上傳中...</span>
              </div>
            } @else {
              <div class="photo-placeholder">
                <span class="photo-plus">＋</span>
                <span class="photo-hint">上傳景點圖片</span>
              </div>
            }
            <input type="file" accept="image/*" hidden (change)="onPhotoSelected($event)" />
          </label>

          <!-- 景點名稱 -->
          <div class="field-group">
            <label class="field-label">景點名稱</label>
            <input
              class="field-input"
              [(ngModel)]="stagingName"
              name="stagingName"
              placeholder="輸入景點名稱"
            />
          </div>

          <!-- 加入日期（僅新增模式） -->
          @if (!editingItemId()) {
            <div class="field-group">
              <label class="field-label">加入日期</label>
              <button class="date-select-btn" type="button" (click)="showDatePicker.set(true)">
                <span class="select-text">{{ selectedDateLabel() }}</span>
                <svg
                  class="select-arrow"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
          }

          <!-- 筆記 -->
          <div class="field-group">
            <label class="field-label">筆記</label>
            <textarea
              class="field-input field-notes"
              [(ngModel)]="stagingNotes"
              name="stagingNotes"
              placeholder="選填備註"
              rows="3"
            ></textarea>
          </div>

          <!-- 按鈕列 -->
          <div class="panel-actions">
            <button class="btn-secondary" type="button" (click)="closePanel()">取消</button>
            @if (editingItemId()) {
              <button
                class="btn-primary"
                type="button"
                [disabled]="!stagingName.trim()"
                (click)="confirmSave()"
              >
                儲存
              </button>
            } @else {
              <button
                class="btn-primary"
                type="button"
                [disabled]="!stagingName.trim()"
                (click)="onStagingConfirm()"
              >
                確認
              </button>
            }
          </div>
        </div>
      }

      <!-- 日期選單 Modal -->
      @if (showDatePicker()) {
        <div class="modal-backdrop" (click)="showDatePicker.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>{{ 'itinerary.chooseDate' | transloco }}</h3>
            <div class="picker-list">
              @for (d of dateTabs(); track $index) {
                <button
                  class="picker-option"
                  [class.selected]="selectedDate()?.dayNumber === d.dayNumber"
                  (click)="chooseDate(d)"
                >
                  {{ formatTabDate(d) }}
                </button>
              }
            </div>
          </div>
        </div>
      }

      <!-- 順序選擇 Modal -->
      @if (showPositionPicker()) {
        <div class="modal-backdrop" (click)="showPositionPicker.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>{{ 'itinerary.choosePosition' | transloco }}</h3>
            <div class="picker-list">
              @for (p of positionOptions(); track p) {
                <button
                  class="picker-option"
                  [class.selected]="p === selectedPosition()"
                  (click)="selectedPosition.set(p)"
                >
                  {{ positionLabel(p) }}
                </button>
              }
            </div>
            <button class="btn-primary full-width" (click)="confirmAdd()">
              {{ 'common.confirm' | transloco }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 900px;
        margin: 0 auto;
        padding: 1.5rem;
        background: var(--bg);
        min-height: 100vh;
      }
      .page-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .back-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        flex-shrink: 0;
        color: var(--accent);
        text-decoration: none;
        background: var(--icon-bg);
        transition: background 0.15s;
      }
      .back-btn:hover {
        background: var(--icon-bg-hover);
      }
      h1 {
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }

      /* ── 搜尋 ── */
      .search-row {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }
      .search-row .btn-primary {
        flex: 2;
      }
      .search-row input {
        flex: 8;
        padding: 0.625rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 0.95rem;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      .not-found {
        color: var(--text-secondary);
        font-size: 0.9rem;
        margin: -0.25rem 0 0.75rem;
      }

      /* ── 地圖 ── */
      .map-container {
        width: 100%;
        height: 340px;
        border-radius: 16px;
        overflow: hidden;
        margin-bottom: 1rem;
        background: var(--bg);
        border: 1px solid var(--border);
      }

      /* ── 功能區塊（垂直排列） ── */
      .card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.25rem;
        box-shadow: 0 4px 20px var(--shadow);
        margin-bottom: 1rem;
      }
      .staging-card {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .panel-title {
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border);
      }

      /* ── 圖片區塊 ── */
      .photo-block {
        width: 100%;
        aspect-ratio: 4/3;
        max-height: 240px;
        background: var(--bg);
        border: 2px dashed var(--border);
        border-radius: 12px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: border-color 0.2s;
      }
      .photo-block:hover {
        border-color: var(--accent);
      }
      .photo-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .photo-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        color: white;
        font-size: 0.875rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
      }
      .photo-block:hover .photo-overlay {
        opacity: 1;
      }
      .photo-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }
      .photo-plus {
        font-size: 2.2rem;
        color: var(--text-secondary);
        line-height: 1;
      }
      .photo-hint {
        font-size: 0.85rem;
        color: var(--text-secondary);
      }
      .upload-spin {
        font-size: 1.5rem;
      }

      /* ── 欄位 ── */
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .field-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .field-input {
        width: 100%;
        padding: 0.625rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 0.95rem;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      .field-input:focus {
        outline: none;
        border-color: var(--accent);
      }
      .field-notes {
        resize: vertical;
        min-height: 72px;
        font-family: inherit;
      }

      .date-select-btn {
        width: 100%;
        padding: 0.625rem 2rem;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--accent-light);
        color: var(--accent);
        border: 1.5px solid var(--accent);
        border-radius: 10px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
      }
      .date-select-btn .select-text {
        flex: 1;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .date-select-btn .select-arrow {
        position: absolute;
        right: 0.75rem;
        flex-shrink: 0;
      }

      /* ── 按鈕列 ── */
      .panel-actions {
        display: flex;
        gap: 0.75rem;
      }
      .btn-primary {
        flex: 1;
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 0.75rem 1.25rem;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.95rem;
      }
      .btn-primary:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .btn-secondary {
        flex: 1;
        background: var(--bg);
        color: var(--text-secondary);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        padding: 0.75rem 1.25rem;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.95rem;
      }
      .full-width {
        width: 100%;
        margin-top: 0.75rem;
      }

      /* ── Modal ── */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 200;
        padding: 1rem;
      }
      .modal-card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        max-width: 340px;
        width: 100%;
        box-shadow: 0 12px 40px var(--shadow);
      }
      .modal-card h3 {
        margin: 0 0 1rem;
        color: var(--text-primary);
      }
      .picker-list {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        max-height: 320px;
        overflow-y: auto;
      }
      .picker-option {
        padding: 0.625rem 0.875rem;
        border-radius: 10px;
        border: 1.5px solid var(--border);
        background: var(--bg);
        color: var(--text-primary);
        cursor: pointer;
        text-align: left;
        font-size: 0.9rem;
      }
      .picker-option:hover {
        border-color: var(--accent);
      }
      .picker-option.selected {
        border-color: var(--accent);
        background: var(--accent-light);
        color: var(--accent);
        font-weight: 600;
      }
    `,
  ],
})
export class ItineraryComponent implements OnInit, AfterViewInit {
  @ViewChild('mapEl') mapElRef!: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private tripService = inject(TripService);
  private mapsService = inject(MapsService);
  private transloco = inject(TranslocoService);
  private ngZone = inject(NgZone);

  tripId!: string;
  trip = signal<Trip | undefined>(undefined);
  items = signal<ItineraryItem[]>([]);

  searchQuery = '';
  searching = signal(false);
  searchResult = signal<SearchResult | null>(null);
  searchNotFound = signal(false);

  // ── 功能區塊狀態 ─────────────────────────────────────────────
  stagingName = '';
  stagingNotes = '';
  stagingLat = signal<number | null>(null);
  stagingLng = signal<number | null>(null);
  stagingPhotoUrl = signal<string | null>(null);
  uploadingPhoto = signal(false);
  editingItemId = signal<string | null>(null);

  // 功能區塊顯示條件：新增（有座標）或編輯（有 ID）
  readonly panelVisible = computed(
    () => this.stagingLat() !== null || this.editingItemId() !== null,
  );

  showDatePicker = signal(false);
  showPositionPicker = signal(false);
  selectedDate = signal<DateTab | null>(null);
  selectedPosition = signal(0);

  // ── 地圖物件（不放 Signal，避免 Proxy 問題）────────────────
  private mapInstance: google.maps.Map | null = null;
  private searchMarker: google.maps.Marker | null = null;
  private infoWindow: google.maps.InfoWindow | null = null;
  private spotMarkers: google.maps.Marker[] = [];
  private polylineObjects: google.maps.Polyline[] = [];
  private localPhotoBlob: string | null = null; // for revokeObjectURL

  // ── Computed ─────────────────────────────────────────────────
  dateTabs = computed<DateTab[]>(() => {
    const t = this.trip();
    if (t?.start_date_utc) {
      const start = new Date(t.start_date_utc);
      const end = t.end_date_utc ? new Date(t.end_date_utc) : start;
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const tabs: DateTab[] = [];
      const cur = new Date(startDay);
      let n = 1;
      while (cur <= endDay) {
        tabs.push({ date: new Date(cur), dayNumber: n });
        cur.setDate(cur.getDate() + 1);
        n++;
      }
      return tabs.length ? tabs : [{ date: startDay, dayNumber: 1 }];
    }
    const maxDay = Math.max(1, ...this.items().map((i) => i.day_number));
    return Array.from({ length: maxDay }, (_, i) => ({ date: null, dayNumber: i + 1 }));
  });

  selectedDateLabel = computed(() => {
    const d = this.selectedDate();
    return d ? this.formatTabDate(d) : this.transloco.translate('itinerary.chooseDate');
  });

  positionOptions = computed(() => {
    const d = this.selectedDate();
    if (!d) return [0];
    const count = this.items().filter((i) => i.day_number === d.dayNumber).length;
    return Array.from({ length: count + 1 }, (_, i) => i);
  });

  // ── 生命週期 ─────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    this.trip.set(await this.tripService.getById(this.tripId));
    this.items.set(await this.tripService.getItinerary(this.tripId));

    const dayParam = Number(this.route.snapshot.queryParamMap.get('day'));
    if (dayParam) {
      const match = this.dateTabs().find((d) => d.dayNumber === dayParam);
      if (match) this.selectedDate.set(match);
    }
    this.renderSpotMarkers();
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      const center = await this.getDefaultCenter();
      this.mapInstance = await this.mapsService.initMap(this.mapElRef.nativeElement, center);
      this.renderSpotMarkers();

      // 點擊地圖空白處 → 顯示地點小卡 + 新增按鈕
      this.mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        const coordName = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        this.ngZone.run(() => this.showSearchOnMap({ name: coordName, lat, lng }));
        // 非同步取得真實地名後更新小卡
        this.mapsService.reverseGeocode(lat, lng).then((name) => {
          if (name !== coordName) {
            this.ngZone.run(() => this.showSearchOnMap({ name, lat, lng }));
          }
        });
      });
    } catch (err) {
      console.warn('[Itinerary] Map init failed', err);
    }
  }

  // ── 地圖預設中心 ──────────────────────────────────────────────
  private getDefaultCenter(): Promise<google.maps.LatLngLiteral> {
    const items = this.items();
    if (items.length > 0)
      return Promise.resolve({ lat: items[0].latitude, lng: items[0].longitude });
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 25.0478, lng: 121.5319 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: 25.0478, lng: 121.5319 }),
        { timeout: 3000 },
      );
    });
  }

  // ── 繪製景點 Marker + Polyline ─────────────────────────────
  private renderSpotMarkers(): void {
    if (!this.mapInstance) return;
    this.spotMarkers.forEach((m) => m.setMap(null));
    this.spotMarkers = [];
    this.polylineObjects.forEach((p) => p.setMap(null));
    this.polylineObjects = [];

    const grouped = new Map<number, ItineraryItem[]>();
    for (const item of this.items()) {
      if (!grouped.has(item.day_number)) grouped.set(item.day_number, []);
      grouped.get(item.day_number)!.push(item);
    }

    const bounds = new google.maps.LatLngBounds();
    let hasItems = false;

    grouped.forEach((dayItems, day) => {
      const color = DAY_COLORS[(day - 1) % DAY_COLORS.length];
      const sorted = [...dayItems].sort((a, b) => a.order_index - b.order_index);

      sorted.forEach((item, idx) => {
        const pos: google.maps.LatLngLiteral = { lat: item.latitude, lng: item.longitude };
        bounds.extend(pos);
        hasItems = true;

        const marker = new google.maps.Marker({
          position: pos,
          map: this.mapInstance!,
          label: { text: String(idx + 1), color: 'white', fontWeight: 'bold', fontSize: '12px' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2,
            scale: 14,
          },
          title: `第 ${day} 天 #${idx + 1}：${item.place_name}`,
        });

        // 點擊已有景點 → 顯示 InfoWindow + 編輯按鈕
        marker.addListener('click', () => {
          this.ngZone.run(() => this.showSpotInfoWindow(item, marker));
        });

        this.spotMarkers.push(marker);
      });

      if (sorted.length >= 2) {
        const polyline = new google.maps.Polyline({
          path: sorted.map((i) => ({ lat: i.latitude, lng: i.longitude })),
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 3,
          map: this.mapInstance!,
        });
        this.polylineObjects.push(polyline);
      }
    });

    if (hasItems) this.mapInstance!.fitBounds(bounds, 60);
  }

  // ── 搜尋 ─────────────────────────────────────────────────────
  async search(): Promise<void> {
    const query = this.searchQuery.trim();
    if (!query) return;
    this.searching.set(true);
    this.searchNotFound.set(false);
    try {
      const result = await this.mapsService.searchPlace(query);
      if (result) {
        this.searchResult.set(result);
        this.showSearchOnMap(result);
      } else this.searchNotFound.set(true);
    } finally {
      this.searching.set(false);
    }
  }

  // InfoWindow：搜尋結果 / 地圖點擊（顯示「新增景點」按鈕）
  private showSearchOnMap(r: SearchResult): void {
    if (!this.mapInstance) return;
    if (this.searchMarker) this.searchMarker.setMap(null);
    if (this.infoWindow) this.infoWindow.close();

    this.mapInstance.panTo({ lat: r.lat, lng: r.lng });
    this.mapInstance.setZoom(15);

    this.searchMarker = new google.maps.Marker({
      position: { lat: r.lat, lng: r.lng },
      map: this.mapInstance,
      icon: {
        url:
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">' +
              '<path fill="#e53e3e" stroke="white" stroke-width="2"' +
              ' d="M14 2C8.5 2 4 6.5 4 12c0 7.5 10 22 10 22S24 19.5 24 12C24 6.5 19.5 2 14 2z"/>' +
              '<circle fill="white" cx="14" cy="12" r="4"/></svg>',
          ),
        scaledSize: new google.maps.Size(28, 36),
        anchor: new google.maps.Point(14, 36),
      },
    });

    this.infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding:10px 4px 4px;min-width:170px;font-family:sans-serif;box-sizing:border-box">
          <div style="font-weight:600;font-size:0.875rem;margin-bottom:4px;color:#1a1a2e;word-break:break-word">
            ${this.escHtml(r.name)}</div>
          <div style="font-size:0.72rem;color:#888;margin-bottom:10px">
            ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</div>
          <button id="map-add-spot-btn"
            style="width:100%;padding:8px 0;background:#667eea;color:white;border:none;
                   border-radius:8px;font-weight:600;font-size:0.875rem;cursor:pointer">
            ＋ 新增景點
          </button>
        </div>`,
    });
    this.infoWindow.open(this.mapInstance, this.searchMarker);

    google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
      document.getElementById('map-add-spot-btn')?.addEventListener('click', () => {
        this.ngZone.run(() => this.stageNewSpot(r));
      });
    });
  }

  // InfoWindow：已有景點（顯示「✏️ 編輯」按鈕）
  private showSpotInfoWindow(item: ItineraryItem, marker: google.maps.Marker): void {
    if (this.infoWindow) this.infoWindow.close();
    if (this.searchMarker) {
      this.searchMarker.setMap(null);
      this.searchMarker = null;
    }

    const btnId = `edit-btn-${item.id.slice(0, 8)}`;
    this.infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding:10px 4px 4px;min-width:170px;font-family:sans-serif;box-sizing:border-box">
          <div style="font-weight:600;font-size:0.875rem;margin-bottom:4px;color:#1a1a2e;word-break:break-word">
            ${this.escHtml(item.place_name)}</div>
          ${item.notes ? `<div style="font-size:0.78rem;color:#666;margin-bottom:8px">${this.escHtml(item.notes)}</div>` : ''}
          <button id="${btnId}"
            style="width:100%;padding:8px 0;background:#667eea;color:white;border:none;
                   border-radius:8px;font-weight:600;font-size:0.875rem;cursor:pointer">
            ✏️ 編輯
          </button>
        </div>`,
    });
    this.infoWindow.open(this.mapInstance!, marker);

    google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        this.ngZone.run(() => this.startEdit(item));
      });
    });
  }

  private escHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── 功能區塊操作 ────────────────────────────────────────────
  // 新增模式：從地圖點擊或搜尋結果進入
  stageNewSpot(r: SearchResult): void {
    this.editingItemId.set(null);
    this.stagingName = r.name;
    this.stagingNotes = '';
    this.stagingLat.set(r.lat);
    this.stagingLng.set(r.lng);
    this.revokeLocalPhoto();
    this.stagingPhotoUrl.set(null);
    if (this.infoWindow) this.infoWindow.close();
  }

  // 編輯模式：從已有景點 InfoWindow 進入
  startEdit(item: ItineraryItem): void {
    this.editingItemId.set(item.id);
    this.stagingName = item.place_name;
    this.stagingNotes = item.notes ?? '';
    this.stagingLat.set(null); // 編輯模式不需座標（已有）
    this.stagingLng.set(null);
    this.revokeLocalPhoto();
    this.stagingPhotoUrl.set(item.image_url ?? null);
    if (this.infoWindow) this.infoWindow.close();
  }

  closePanel(): void {
    this.editingItemId.set(null);
    this.stagingLat.set(null);
    this.stagingLng.set(null);
    this.stagingName = '';
    this.stagingNotes = '';
    this.revokeLocalPhoto();
    this.stagingPhotoUrl.set(null);
  }

  // 圖片上傳：立即顯示本地預覽，背景上傳後換成遠端 URL
  async onPhotoSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.revokeLocalPhoto();
    this.localPhotoBlob = URL.createObjectURL(file);
    this.stagingPhotoUrl.set(this.localPhotoBlob); // 立即顯示縮圖

    this.uploadingPhoto.set(true);
    try {
      const remoteUrl = await this.tripService.uploadItineraryPhoto(file);
      if (remoteUrl) {
        URL.revokeObjectURL(this.localPhotoBlob!);
        this.localPhotoBlob = null;
        this.stagingPhotoUrl.set(remoteUrl);
      }
    } finally {
      this.uploadingPhoto.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  private revokeLocalPhoto(): void {
    if (this.localPhotoBlob) {
      URL.revokeObjectURL(this.localPhotoBlob);
      this.localPhotoBlob = null;
    }
  }

  // 新增模式「確認」：未選日期則先開日期選單
  onStagingConfirm(): void {
    const d = this.selectedDate();
    if (!d) {
      this.showDatePicker.set(true);
      return;
    }
    const count = this.items().filter((i) => i.day_number === d.dayNumber).length;
    this.selectedPosition.set(count);
    this.showPositionPicker.set(true);
  }

  // 編輯模式「儲存」
  async confirmSave(): Promise<void> {
    const id = this.editingItemId();
    if (!id || !this.stagingName.trim()) return;
    await this.tripService.updateItineraryItem(id, {
      place_name: this.stagingName.trim(),
      image_url: this.stagingPhotoUrl() ?? undefined,
      notes: this.stagingNotes.trim() || undefined,
    });
    this.items.set(await this.tripService.getItinerary(this.tripId));
    this.closePanel();
    this.renderSpotMarkers();
  }

  // ── 日期 / 順序 Modal ────────────────────────────────────────
  chooseDate(d: DateTab): void {
    this.selectedDate.set(d);
    this.showDatePicker.set(false);
    // 選完日期後自動進入順序選擇
    const count = this.items().filter((i) => i.day_number === d.dayNumber).length;
    this.selectedPosition.set(count); // 預設放到最後
    this.showPositionPicker.set(true);
  }

  async confirmAdd(): Promise<void> {
    const d = this.selectedDate();
    const lat = this.stagingLat();
    const lng = this.stagingLng();
    if (!d || lat === null || lng === null || !this.stagingName.trim()) return;

    await this.tripService.addItineraryItemAtPosition(
      {
        trip_id: this.tripId,
        day_number: d.dayNumber,
        place_name: this.stagingName.trim(),
        latitude: lat,
        longitude: lng,
        image_url: this.stagingPhotoUrl() ?? undefined,
        notes: this.stagingNotes.trim() || undefined,
      },
      this.selectedPosition(),
    );

    this.items.set(await this.tripService.getItinerary(this.tripId));
    this.showPositionPicker.set(false);
    if (this.searchMarker) {
      this.searchMarker.setMap(null);
      this.searchMarker = null;
    }
    this.closePanel();
    this.renderSpotMarkers();
  }

  // ── 工具 ─────────────────────────────────────────────────────
  formatTabDate(tab: DateTab): string {
    if (!tab.date) return `第 ${tab.dayNumber} 天`;
    return `第 ${tab.dayNumber} 天（${tab.date.getMonth() + 1}/${tab.date.getDate()}）`;
  }

  positionLabel(p: number): string {
    const d = this.selectedDate();
    if (!d) return `第 ${p + 1} 個位置`;
    const dayItems = this.items()
      .filter((i) => i.day_number === d.dayNumber)
      .sort((a, b) => a.order_index - b.order_index);
    if (dayItems.length === 0) return '第 1 個位置（唯一）';
    if (p === 0) return `排在最前面（${dayItems[0].place_name} 之前）`;
    if (p === dayItems.length) return `排在最後面（${dayItems[p - 1].place_name} 之後）`;
    return `排在 ${dayItems[p - 1].place_name} 之後`;
  }
}
