import {
  Component, inject, OnInit, AfterViewInit,
  signal, computed, ViewChild, ElementRef, NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ItineraryItem, Trip } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { MapsService } from '../../core/services/maps.service';

interface DateTab { date: Date | null; dayNumber: number; }
interface SearchResult { name: string; lat: number; lng: number; }

const DAY_COLORS = ['#667eea', '#ed8936', '#48bb78', '#f56565', '#9f7aea', '#38b2ac'];

@Component({
  selector: 'app-itinerary',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a [routerLink]="['/trips', tripId]" class="back-btn"
           [attr.aria-label]="'itinerary.backToTrip' | transloco">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </a>
        <h1>{{ 'itinerary.title' | transloco }}</h1>
      </header>

      <!-- 搜尋列：地址／景點名稱／經緯度 -->
      <form class="search-row" (ngSubmit)="search()">
        <input
          [(ngModel)]="searchQuery"
          name="searchQuery"
          [placeholder]="'itinerary.searchPlaceholder' | transloco"
        />
        <button type="submit" class="btn-primary"
                [disabled]="!searchQuery.trim() || searching()">
          {{ (searching() ? 'itinerary.searching' : 'itinerary.searchButton') | transloco }}
        </button>
      </form>

      @if (searchNotFound()) {
        <p class="not-found">{{ 'itinerary.notFound' | transloco }}</p>
      }

      <!-- 地圖：始終顯示 -->
      <div #mapEl class="map-container"></div>

      <!-- 暫存編輯區：點擊地圖「新增景點」後出現 -->
      @if (stagingLat() !== null) {
        <div class="card staging-card">
          <div class="staging-row">
            <!-- 圖片上傳 -->
            <button class="photo-btn" (click)="photoInput.click()" type="button">
              @if (stagingPhotoUrl()) {
                <img [src]="stagingPhotoUrl()" class="photo-thumb" alt="" />
              } @else if (uploadingPhoto()) {
                <span class="photo-loading">…</span>
              } @else {
                <span class="photo-plus">＋</span>
              }
            </button>
            <input #photoInput type="file" accept="image/*" hidden
                   (change)="onPhotoSelected($event)" />

            <!-- 景點名稱 (可編輯) -->
            <input class="staging-name" [(ngModel)]="stagingName"
                   name="stagingName"
                   [placeholder]="'itinerary.spotNamePlaceholder' | transloco" />

            <!-- 日期選單 -->
            <button class="date-select-btn" type="button"
                    (click)="showDatePicker.set(true)">
              {{ selectedDateLabel() }} ▾
            </button>
          </div>

          <!-- 確認加入按鈕 -->
          <button class="btn-primary confirm-btn" type="button"
                  [disabled]="!stagingName.trim() || !selectedDate()"
                  (click)="onStagingConfirm()">
            {{ 'common.confirm' | transloco }}
          </button>
        </div>
      }

      <!-- 日期選單 Modal -->
      @if (showDatePicker()) {
        <div class="modal-backdrop" (click)="showDatePicker.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>{{ 'itinerary.chooseDate' | transloco }}</h3>
            <div class="picker-list">
              @for (d of dateTabs(); track $index) {
                <button class="picker-option"
                        [class.selected]="selectedDate()?.dayNumber === d.dayNumber"
                        (click)="chooseDate(d)">
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
                <button class="picker-option"
                        [class.selected]="p === selectedPosition()"
                        (click)="selectedPosition.set(p)">
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
  styles: [`
    .page-container {
      max-width: 900px; margin: 0 auto; padding: 1.5rem;
      background: var(--bg); min-height: 100vh;
    }
    .page-header {
      display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;
    }
    .back-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      color: var(--accent); text-decoration: none;
      background: var(--accent-light);
    }
    h1 { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0; }

    /* ── 搜尋 ── */
    .search-row { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
    .search-row input {
      flex: 1; padding: 0.625rem 0.875rem; border: 1.5px solid var(--border);
      border-radius: 10px; font-size: 0.95rem; box-sizing: border-box;
      background: var(--input-bg); color: var(--text-primary);
    }
    .not-found { color: var(--text-secondary); font-size: 0.9rem; margin: -0.25rem 0 0.75rem; }

    /* ── 地圖 ── */
    .map-container {
      width: 100%; height: 340px; border-radius: 16px; overflow: hidden;
      margin-bottom: 1rem; background: var(--bg); border: 1px solid var(--border);
    }

    /* ── 暫存區 ── */
    .card {
      background: var(--surface); border-radius: 16px; padding: 1.25rem;
      box-shadow: 0 4px 20px var(--shadow); margin-bottom: 1rem;
    }
    .staging-card { display: flex; flex-direction: column; gap: 0.875rem; }
    .staging-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

    .photo-btn {
      flex-shrink: 0; width: 52px; height: 52px; border-radius: 10px;
      background: var(--bg); border: 2px dashed var(--border); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; padding: 0;
    }
    .photo-plus { font-size: 1.4rem; color: var(--text-secondary); }
    .photo-loading { font-size: 1rem; color: var(--text-secondary); }
    .photo-thumb { width: 100%; height: 100%; object-fit: cover; }

    .staging-name {
      flex: 1; min-width: 120px; padding: 0.6rem 0.75rem;
      border: 1.5px solid var(--border); border-radius: 10px;
      font-size: 0.95rem; box-sizing: border-box;
      background: var(--input-bg); color: var(--text-primary);
    }
    .date-select-btn {
      flex-shrink: 0; background: var(--accent-light); color: var(--accent);
      border: 1.5px solid var(--accent); border-radius: 10px;
      padding: 0.6rem 0.875rem; font-size: 0.85rem; font-weight: 600;
      cursor: pointer; white-space: nowrap;
    }
    .confirm-btn { width: 100%; padding: 0.75rem; font-size: 0.95rem; }

    /* ── 按鈕 ── */
    .btn-primary {
      background: var(--accent); color: white; border: none;
      border-radius: 10px; padding: 0.625rem 1.25rem;
      font-weight: 600; cursor: pointer; white-space: nowrap;
    }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .full-width { width: 100%; margin-top: 0.75rem; }

    /* ── Modal ── */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 200; padding: 1rem;
    }
    .modal-card {
      background: var(--surface); border-radius: 16px; padding: 1.5rem;
      max-width: 340px; width: 100%;
      box-shadow: 0 12px 40px var(--shadow);
    }
    .modal-card h3 { margin: 0 0 1rem; color: var(--text-primary); }
    .picker-list {
      display: flex; flex-direction: column; gap: 0.4rem;
      max-height: 320px; overflow-y: auto;
    }
    .picker-option {
      padding: 0.625rem 0.875rem; border-radius: 10px;
      border: 1.5px solid var(--border);
      background: var(--bg); color: var(--text-primary);
      cursor: pointer; text-align: left; font-size: 0.9rem;
    }
    .picker-option:hover { border-color: var(--accent); }
    .picker-option.selected {
      border-color: var(--accent); background: var(--accent-light);
      color: var(--accent); font-weight: 600;
    }
  `],
})
export class ItineraryComponent implements OnInit, AfterViewInit {
  @ViewChild('mapEl') mapElRef!: ElementRef<HTMLDivElement>;

  private route       = inject(ActivatedRoute);
  private tripService = inject(TripService);
  private mapsService = inject(MapsService);
  private transloco   = inject(TranslocoService);
  private ngZone      = inject(NgZone);

  tripId!: string;
  trip  = signal<Trip | undefined>(undefined);
  items = signal<ItineraryItem[]>([]);

  searchQuery   = '';
  searching     = signal(false);
  searchResult  = signal<SearchResult | null>(null);
  searchNotFound = signal(false);

  stagingName     = '';
  stagingLat      = signal<number | null>(null);
  stagingLng      = signal<number | null>(null);
  stagingPhotoUrl = signal<string | null>(null);
  uploadingPhoto  = signal(false);

  showDatePicker    = signal(false);
  showPositionPicker = signal(false);
  selectedDate      = signal<DateTab | null>(null);
  selectedPosition  = signal(0);

  // ── 地圖相關（Google Maps API 物件不放進 Signal，避免代理問題） ──
  private mapInstance: google.maps.Map | null = null;
  private searchMarker: google.maps.Marker | null = null;
  private infoWindow: google.maps.InfoWindow | null = null;
  private spotMarkers: google.maps.Marker[] = [];
  private polylineObjects: google.maps.Polyline[] = [];

  // ── Computed ──────────────────────────────────────────────────────
  dateTabs = computed<DateTab[]>(() => {
    const t = this.trip();
    if ((t as any)?.start_date_utc) {
      const start = new Date((t as any).start_date_utc);
      const end   = (t as any).end_date_utc ? new Date((t as any).end_date_utc) : start;
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay   = new Date(end.getFullYear(),   end.getMonth(),   end.getDate());
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
    const maxDay = Math.max(1, ...this.items().map(i => i.day_number));
    return Array.from({ length: maxDay }, (_, i) => ({ date: null, dayNumber: i + 1 }));
  });

  selectedDateLabel = computed(() => {
    const d = this.selectedDate();
    return d ? this.formatTabDate(d) : this.transloco.translate('itinerary.chooseDate');
  });

  positionOptions = computed(() => {
    const d = this.selectedDate();
    if (!d) return [0];
    const count = this.items().filter(i => i.day_number === d.dayNumber).length;
    return Array.from({ length: count + 1 }, (_, i) => i);
  });

  // ── 生命週期 ────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    this.trip.set(await this.tripService.getById(this.tripId));
    this.items.set(await this.tripService.getItinerary(this.tripId));

    const dayParam = Number(this.route.snapshot.queryParamMap.get('day'));
    if (dayParam) {
      const match = this.dateTabs().find(d => d.dayNumber === dayParam);
      if (match) this.selectedDate.set(match);
    }
    // 若地圖已初始化（ngAfterViewInit 先完成），立即繪製景點
    this.renderSpotMarkers();
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      const center = await this.getDefaultCenter();
      this.mapInstance = await this.mapsService.initMap(
        this.mapElRef.nativeElement, center,
      );
      // 若行程資料已載入（ngOnInit 先完成），立即繪製景點
      this.renderSpotMarkers();

      // 點擊地圖空白處 → 顯示地點小卡 + 新增按鈕
      this.mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        // 先立即顯示座標小卡，再非同步更新為地名
        const coordName = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        this.ngZone.run(() => this.showSearchOnMap({ name: coordName, lat, lng }));
        // 嘗試反向地理編碼取得真實地名
        this.mapsService.reverseGeocode(lat, lng).then(name => {
          if (name !== coordName) {
            this.ngZone.run(() => this.showSearchOnMap({ name, lat, lng }));
          }
        });
      });
    } catch (err) {
      console.warn('[Itinerary] Map init failed', err);
    }
  }

  // ── 地圖預設中心：優先讀景點，再讀 GPS，再 fallback 台北 ───────
  private getDefaultCenter(): Promise<google.maps.LatLngLiteral> {
    const items = this.items();
    if (items.length > 0) {
      return Promise.resolve({ lat: items[0].latitude, lng: items[0].longitude });
    }
    return new Promise(resolve => {
      if (!navigator.geolocation) {
        resolve({ lat: 25.0478, lng: 121.5319 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        ()  => resolve({ lat: 25.0478, lng: 121.5319 }),
        { timeout: 3000 },
      );
    });
  }

  // ── 繪製所有景點 Marker + Polyline ─────────────────────────────
  private renderSpotMarkers(): void {
    if (!this.mapInstance) return;

    this.spotMarkers.forEach(m => m.setMap(null));
    this.spotMarkers = [];
    this.polylineObjects.forEach(p => p.setMap(null));
    this.polylineObjects = [];

    const items = this.items();
    const grouped = new Map<number, ItineraryItem[]>();
    for (const item of items) {
      if (!grouped.has(item.day_number)) grouped.set(item.day_number, []);
      grouped.get(item.day_number)!.push(item);
    }

    const bounds = new google.maps.LatLngBounds();
    let hasItems = false;

    grouped.forEach((dayItems, day) => {
      const color  = DAY_COLORS[(day - 1) % DAY_COLORS.length];
      const sorted = [...dayItems].sort((a, b) => a.order_index - b.order_index);

      sorted.forEach((item, idx) => {
        const pos: google.maps.LatLngLiteral = { lat: item.latitude, lng: item.longitude };
        bounds.extend(pos);
        hasItems = true;

        const marker = new google.maps.Marker({
          position: pos,
          map: this.mapInstance!,
          label: {
            text: String(idx + 1),
            color: 'white',
            fontWeight: 'bold',
            fontSize: '12px',
          },
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
        this.spotMarkers.push(marker);
      });

      // 連接同日景點的直線
      if (sorted.length >= 2) {
        const polyline = new google.maps.Polyline({
          path: sorted.map(i => ({ lat: i.latitude, lng: i.longitude })),
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 3,
          map: this.mapInstance!,
        });
        this.polylineObjects.push(polyline);
      }
    });

    if (hasItems) {
      this.mapInstance!.fitBounds(bounds, 60);
    }
  }

  // ── 搜尋 ────────────────────────────────────────────────────────
  async search(): Promise<void> {
    const query = this.searchQuery.trim();
    if (!query) return;
    this.searching.set(true);
    this.searchNotFound.set(false);
    this.searchResult.set(null);
    try {
      const result = await this.mapsService.searchPlace(query);
      if (result) {
        this.searchResult.set(result);
        this.showSearchOnMap(result);
      } else {
        this.searchNotFound.set(true);
      }
    } finally {
      this.searching.set(false);
    }
  }

  private showSearchOnMap(r: SearchResult): void {
    if (!this.mapInstance) return;

    // 清除上一次的搜尋 Marker / InfoWindow
    if (this.searchMarker) this.searchMarker.setMap(null);
    if (this.infoWindow) this.infoWindow.close();

    this.mapInstance.panTo({ lat: r.lat, lng: r.lng });
    this.mapInstance.setZoom(15);

    // 紅色 Pin marker
    this.searchMarker = new google.maps.Marker({
      position: { lat: r.lat, lng: r.lng },
      map: this.mapInstance,
      icon: {
        url: 'data:image/svg+xml,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">' +
          '<path fill="#e53e3e" stroke="white" stroke-width="2"' +
          ' d="M14 2C8.5 2 4 6.5 4 12c0 7.5 10 22 10 22S24 19.5 24 12C24 6.5 19.5 2 14 2z"/>' +
          '<circle fill="white" cx="14" cy="12" r="4"/>' +
          '</svg>',
        ),
        scaledSize: new google.maps.Size(28, 36),
        anchor: new google.maps.Point(14, 36),
      },
    });

    // InfoWindow：地點小卡 + 新增按鈕
    this.infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding:10px 4px 4px;min-width:170px;font-family:sans-serif;box-sizing:border-box">
          <div style="font-weight:600;font-size:0.875rem;margin-bottom:4px;color:#1a1a2e;word-break:break-word">
            ${this.escHtml(r.name)}
          </div>
          <div style="font-size:0.72rem;color:#888;margin-bottom:10px">
            ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}
          </div>
          <button id="map-add-spot-btn"
            style="width:100%;padding:8px 0;background:#667eea;color:white;border:none;
                   border-radius:8px;font-weight:600;font-size:0.875rem;cursor:pointer">
            ＋ 新增景點
          </button>
        </div>
      `,
    });

    this.infoWindow.open(this.mapInstance, this.searchMarker);

    // 按鈕點擊需透過 ngZone 回到 Angular 變更偵測
    google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
      document.getElementById('map-add-spot-btn')?.addEventListener('click', () => {
        this.ngZone.run(() => this.stageResult(r));
      });
    });
  }

  private escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── 暫存區 ──────────────────────────────────────────────────────
  stageResult(r: SearchResult): void {
    this.stagingName = r.name;
    this.stagingLat.set(r.lat);
    this.stagingLng.set(r.lng);
    this.stagingPhotoUrl.set(null);
    this.searchResult.set(null);
    this.searchQuery = '';
    if (this.infoWindow) this.infoWindow.close();
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingPhoto.set(true);
    try {
      const url = await this.tripService.uploadItineraryPhoto(file);
      this.stagingPhotoUrl.set(url);
    } finally {
      this.uploadingPhoto.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  // 點擊「確認」：若日期未選先開日期選單，否則直接開順序選單
  onStagingConfirm(): void {
    const d = this.selectedDate();
    if (!d) {
      this.showDatePicker.set(true);
      return;
    }
    const count = this.items().filter(i => i.day_number === d.dayNumber).length;
    this.selectedPosition.set(count); // 預設最後面
    this.showPositionPicker.set(true);
  }

  // ── 日期 / 順序 Modal ─────────────────────────────────────────
  chooseDate(d: DateTab): void {
    this.selectedDate.set(d);
    this.showDatePicker.set(false);
    // 選完日期只關閉 Modal，讓使用者再點「確認」觸發順序選單
  }

  async confirmAdd(): Promise<void> {
    const d   = this.selectedDate();
    const lat = this.stagingLat();
    const lng = this.stagingLng();
    if (!d || lat === null || lng === null || !this.stagingName.trim()) return;

    await this.tripService.addItineraryItemAtPosition(
      {
        trip_id:    this.tripId,
        day_number: d.dayNumber,
        place_name: this.stagingName.trim(),
        latitude:   lat,
        longitude:  lng,
      },
      this.selectedPosition(),
    );

    this.items.set(await this.tripService.getItinerary(this.tripId));
    this.showPositionPicker.set(false);

    // 清空暫存，方便接續輸入下一個景點
    this.stagingName = '';
    this.stagingLat.set(null);
    this.stagingLng.set(null);
    this.stagingPhotoUrl.set(null);

    // 清除紅色搜尋 Marker，重繪所有景點
    if (this.searchMarker) { this.searchMarker.setMap(null); this.searchMarker = null; }
    this.renderSpotMarkers();
  }

  // ── 工具方法 ─────────────────────────────────────────────────
  formatTabDate(tab: DateTab): string {
    if (!tab.date) return `第 ${tab.dayNumber} 天`;
    const m = tab.date.getMonth() + 1;
    const d = tab.date.getDate();
    return `第 ${tab.dayNumber} 天（${m}/${d}）`;
  }

  positionLabel(p: number): string {
    return this.transloco.translate('itinerary.positionN', { n: p + 1 });
  }
}
