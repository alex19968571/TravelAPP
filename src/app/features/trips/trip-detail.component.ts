import {
  Component, inject, OnInit, signal, computed, ViewChild, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Trip, ItineraryItem, TransportMode } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { MapsService } from '../../core/services/maps.service';

interface DateTab { date: Date | null; dayNumber: number; }

const TRANSPORT_OPTIONS: { mode: TransportMode; label: string; icon: string }[] = [
  { mode: 'walk',    label: '步行',    icon: '🚶' },
  { mode: 'drive',   label: '開車',    icon: '🚗' },
  { mode: 'bike',    label: '騎車',    icon: '🚲' },
  { mode: 'transit', label: '大眾運輸', icon: '🚇' },
  { mode: 'flight',  label: '飛機',    icon: '✈️' },
  { mode: 'custom',  label: '自訂',    icon: '✏️' },
];

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a routerLink="/trips" class="back-btn" [attr.aria-label]="'common.back' | transloco">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </a>
        <h1>{{ trip()?.title ?? ('tripDetail.loading' | transloco) }}</h1>
      </header>

      @if (trip(); as t) {
        <!-- 日期分頁 -->
        <div class="date-tabs-wrap">
          <button class="date-arrow desktop-only" (click)="scrollDates(-1)">‹</button>
          <div class="date-tabs" #dateTabsEl>
            @for (d of dateTabs(); track $index) {
              <button class="date-tab"
                      [class.active]="selectedDayIndex() === $index"
                      (click)="selectedDayIndex.set($index)">
                {{ formatTabDate(d) }}
              </button>
            }
          </div>
          <button class="date-arrow desktop-only" (click)="scrollDates(1)">›</button>
        </div>

        <div class="card day-content">
          @if (itemsForSelectedDay().length === 0) {
            <p class="empty-day">{{ 'tripDetail.notScheduled' | transloco }}</p>
          } @else {
            <div class="item-list">
              @for (item of itemsForSelectedDay(); track item.id; let i = $index; let last = $last) {
                <!-- 景點卡片 -->
                <div class="itinerary-item" (click)="openEdit(item)">
                  <span class="order-badge">{{ i + 1 }}</span>
                  @if (item.image_url) {
                    <img [src]="item.image_url" class="item-thumb" alt="" />
                  } @else {
                    <div class="item-thumb-empty">📍</div>
                  }
                  <div class="item-info">
                    <strong>{{ item.place_name }}</strong>
                    @if (item.notes) {
                      <span class="item-notes">{{ item.notes }}</span>
                    }
                    <span class="coords">{{ item.latitude.toFixed(4) }}, {{ item.longitude.toFixed(4) }}</span>
                  </div>
                  <button class="remove-btn" (click)="removeItem(item.id, $event)">×</button>
                </div>

                <!-- 景點間交通（最後一個景點後不顯示） -->
                @if (!last) {
                  <div class="transport-row">
                    <div class="transport-modes">
                      @for (opt of transportOpts; track opt.mode) {
                        <button class="transport-btn"
                                [class.active]="item.next_transport_mode === opt.mode"
                                (click)="setTransportMode(item, opt.mode, $event)"
                                [title]="opt.label">
                          {{ opt.icon }}
                        </button>
                      }
                    </div>
                    @if (item.next_transport_mode) {
                      <div class="transport-time">
                        <input type="number" class="time-input" min="1"
                               [value]="item.next_transport_minutes ?? ''"
                               placeholder="分鐘"
                               (change)="setTransportTime(item, $event)" />
                        <span class="time-unit">分</span>
                        @if (canAutoCalc(item.next_transport_mode)) {
                          <button class="auto-calc-btn"
                                  [disabled]="calcingId() === item.id"
                                  (click)="autoCalc(item, $event)">
                            {{ calcingId() === item.id ? '計算中...' : '自動' }}
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              }
            </div>
          }
        </div>

        <a class="fab"
           [routerLink]="['/trips', t.id, 'itinerary']"
           [queryParams]="{ day: dateTabs()[selectedDayIndex()]?.dayNumber ?? 1 }"
           [attr.aria-label]="'tripDetail.openMap' | transloco">＋</a>
      }
    </div>

    <!-- ── 編輯景點 Modal ── -->
    @if (editingItem()) {
      <div class="modal-backdrop" (click)="closeEdit()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h3>✏️ 編輯景點</h3>

          <!-- 圖片 -->
          <button class="photo-block" type="button" (click)="editPhotoInput.click()">
            @if (editPhotoUrl()) {
              <img [src]="editPhotoUrl()!" class="photo-img" alt="" />
              <div class="photo-overlay">點擊更換圖片</div>
            } @else if (editUploadingPhoto()) {
              <div class="photo-placeholder">
                <span>⏳</span><span class="photo-hint">上傳中...</span>
              </div>
            } @else {
              <div class="photo-placeholder">
                <span class="photo-plus">＋</span>
                <span class="photo-hint">上傳景點圖片</span>
              </div>
            }
          </button>
          <input #editPhotoInput type="file" accept="image/*" hidden
                 (change)="onEditPhotoSelected($event)" />

          <!-- 名稱 -->
          <div class="field-group">
            <label class="field-label">景點名稱</label>
            <input class="field-input" [(ngModel)]="editName" placeholder="景點名稱" />
          </div>

          <!-- 日期（切換天數） -->
          <div class="field-group">
            <label class="field-label">日期</label>
            <div class="day-picker">
              @for (d of dateTabs(); track d.dayNumber) {
                <button class="day-btn"
                        [class.active]="editDayNumber() === d.dayNumber"
                        (click)="editDayNumber.set(d.dayNumber)">
                  {{ formatTabDate(d) }}
                </button>
              }
            </div>
          </div>

          <!-- 筆記 -->
          <div class="field-group">
            <label class="field-label">筆記</label>
            <textarea class="field-input field-notes" [(ngModel)]="editNotes"
                      placeholder="選填備註" rows="3"></textarea>
          </div>

          <!-- 按鈕 -->
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeEdit()">取消</button>
            <button class="btn-primary" [disabled]="!editName.trim() || editSaving()"
                    (click)="saveEdit()">
              {{ editSaving() ? '儲存中...' : '儲存' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-container {
      max-width: 900px; margin: 0 auto; padding: 1.5rem;
      background: var(--bg); min-height: 100vh;
    }
    .page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .back-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      color: var(--accent); text-decoration: none;
      background: var(--accent-light);
    }
    h1 { font-size: 1.8rem; font-weight: 700; color: var(--text-primary); margin: 0; }

    /* 日期分頁 */
    .date-tabs-wrap { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; }
    .date-arrow {
      flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
      background: var(--accent-light); color: var(--accent); border: none;
      font-size: 1.1rem; cursor: pointer;
    }
    .date-tabs {
      flex: 1; display: flex; gap: 0.5rem; overflow-x: auto; scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0.25rem 0;
    }
    .date-tabs::-webkit-scrollbar { display: none; }
    .date-tab {
      flex-shrink: 0; padding: 0.5rem 1rem; border-radius: 10px;
      border: 1.5px solid var(--border); background: var(--surface);
      color: var(--text-secondary); font-weight: 600; font-size: 0.9rem; cursor: pointer;
      white-space: nowrap;
    }
    .date-tab.active { border-color: var(--accent); background: var(--accent); color: white; }
    @media (hover: none) and (pointer: coarse) { .desktop-only { display: none !important; } }

    .card {
      background: var(--surface); border-radius: 16px; padding: 1.5rem;
      box-shadow: 0 4px 20px var(--shadow);
    }
    .empty-day { color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 1rem 0; }
    .item-list { display: flex; flex-direction: column; gap: 0; }

    /* ── 景點卡片 ── */
    .itinerary-item {
      display: flex; align-items: center; gap: 0.875rem; padding: 0.75rem;
      background: var(--accent-light); border-radius: 10px; cursor: pointer;
      transition: opacity 0.15s;
    }
    .itinerary-item:hover { opacity: 0.85; }
    .order-badge {
      width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 600; flex-shrink: 0;
    }
    .item-thumb {
      width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex-shrink: 0;
    }
    .item-thumb-empty {
      width: 48px; height: 48px; border-radius: 8px; background: var(--border);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.2rem; flex-shrink: 0;
    }
    .item-info { flex: 1; color: var(--text-primary); min-width: 0; }
    .item-info strong { display: block; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .item-notes { display: block; font-size: 0.78rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
    .coords { font-size: 0.75rem; color: var(--text-secondary); }
    .remove-btn {
      background: none; border: none; color: #e53e3e; cursor: pointer;
      font-size: 1.2rem; padding: 0.25rem; flex-shrink: 0; line-height: 1;
    }

    /* ── 交通方式 ── */
    .transport-row {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem;
      border-left: 2px dashed var(--border); margin-left: 14px;
    }
    .transport-modes { display: flex; gap: 0.25rem; flex-wrap: wrap; }
    .transport-btn {
      font-size: 1rem; border: 1.5px solid var(--border); border-radius: 8px;
      background: var(--bg); padding: 0.2rem 0.45rem; cursor: pointer; line-height: 1.2;
      transition: border-color 0.15s, background 0.15s;
    }
    .transport-btn.active {
      border-color: var(--accent); background: var(--accent-light);
    }
    .transport-time { display: flex; align-items: center; gap: 0.3rem; margin-left: 0.25rem; }
    .time-input {
      width: 56px; padding: 0.2rem 0.4rem; border: 1.5px solid var(--border);
      border-radius: 8px; font-size: 0.85rem; background: var(--input-bg);
      color: var(--text-primary); text-align: center;
    }
    .time-unit { font-size: 0.8rem; color: var(--text-secondary); }
    .auto-calc-btn {
      font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 8px;
      background: var(--accent); color: white; border: none; cursor: pointer;
    }
    .auto-calc-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* 浮動按鈕 */
    .fab {
      position: fixed; right: 1.25rem; bottom: 84px; z-index: 60;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--accent); color: white; text-decoration: none;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.6rem; box-shadow: 0 6px 20px var(--shadow);
    }

    /* ── 編輯 Modal ── */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center; z-index: 300; padding: 1rem;
    }
    .modal-card {
      background: var(--surface); border-radius: 16px; padding: 1.5rem;
      max-width: 420px; width: 100%; box-shadow: 0 12px 40px var(--shadow);
      max-height: 90vh; overflow-y: auto;
      display: flex; flex-direction: column; gap: 1rem;
    }
    .modal-card h3 { margin: 0; color: var(--text-primary); font-size: 1rem; font-weight: 700; }

    .photo-block {
      width: 100%; aspect-ratio: 4/3; max-height: 200px;
      background: var(--bg); border: 2px dashed var(--border); border-radius: 12px;
      cursor: pointer; position: relative; overflow: hidden;
      display: flex; align-items: center; justify-content: center; padding: 0;
    }
    .photo-block:hover { border-color: var(--accent); }
    .photo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .photo-overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0.4);
      color: white; font-size: 0.85rem; font-weight: 500;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.2s;
    }
    .photo-block:hover .photo-overlay { opacity: 1; }
    .photo-placeholder {
      display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
    }
    .photo-plus { font-size: 2rem; color: var(--text-secondary); }
    .photo-hint { font-size: 0.8rem; color: var(--text-secondary); }

    .field-group { display: flex; flex-direction: column; gap: 0.3rem; }
    .field-label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); }
    .field-input {
      width: 100%; padding: 0.6rem 0.875rem; border: 1.5px solid var(--border);
      border-radius: 10px; font-size: 0.95rem; box-sizing: border-box;
      background: var(--input-bg); color: var(--text-primary);
    }
    .field-input:focus { outline: none; border-color: var(--accent); }
    .field-notes { resize: vertical; min-height: 68px; font-family: inherit; }

    .day-picker { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .day-btn {
      padding: 0.4rem 0.8rem; border-radius: 8px; border: 1.5px solid var(--border);
      background: var(--bg); color: var(--text-secondary); font-size: 0.85rem; cursor: pointer;
    }
    .day-btn.active {
      border-color: var(--accent); background: var(--accent-light); color: var(--accent); font-weight: 600;
    }

    .modal-actions { display: flex; gap: 0.75rem; }
    .btn-primary {
      flex: 1; background: var(--accent); color: white; border: none;
      border-radius: 10px; padding: 0.75rem; font-weight: 600; cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-secondary {
      flex: 1; background: var(--bg); color: var(--text-secondary);
      border: 1.5px solid var(--border); border-radius: 10px;
      padding: 0.75rem; font-weight: 600; cursor: pointer;
    }
  `],
})
export class TripDetailComponent implements OnInit {
  @ViewChild('dateTabsEl') dateTabsEl?: ElementRef<HTMLElement>;

  private route       = inject(ActivatedRoute);
  private tripService = inject(TripService);
  private mapsService = inject(MapsService);

  trip       = signal<Trip | undefined>(undefined);
  items      = signal<ItineraryItem[]>([]);
  selectedDayIndex = signal(0);

  // 編輯 Modal 狀態
  editingItem     = signal<ItineraryItem | null>(null);
  editName        = '';
  editNotes       = '';
  editDayNumber   = signal(1);
  editPhotoUrl    = signal<string | null>(null);
  editUploadingPhoto = signal(false);
  editSaving      = signal(false);
  private editLocalBlob: string | null = null;

  // 交通自動計算狀態
  calcingId = signal<string | null>(null);

  transportOpts = TRANSPORT_OPTIONS;

  dateTabs = computed<DateTab[]>(() => {
    const t = this.trip();
    if (t?.start_date_utc) {
      const start    = new Date(t.start_date_utc);
      const end      = t.end_date_utc ? new Date(t.end_date_utc) : start;
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

  itemsForSelectedDay = computed(() => {
    const dn = this.dateTabs()[this.selectedDayIndex()]?.dayNumber ?? 1;
    return this.items()
      .filter(i => i.day_number === dn)
      .sort((a, b) => a.order_index - b.order_index);
  });

  formatTabDate(tab: DateTab): string {
    if (!tab.date) return `${tab.dayNumber}`;
    return `${tab.date.getMonth() + 1}/${tab.date.getDate()}`;
  }

  scrollDates(dir: number): void {
    this.dateTabsEl?.nativeElement.scrollBy({ left: dir * 140, behavior: 'smooth' });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.trip.set(await this.tripService.getById(id));
    this.items.set(await this.tripService.getItinerary(id));
  }

  async removeItem(itemId: string, e: MouseEvent): Promise<void> {
    e.stopPropagation();
    await this.tripService.removeItineraryItem(itemId);
    this.items.set(await this.tripService.getItinerary(this.trip()!.id));
  }

  // ── 編輯 Modal ────────────────────────────────────────────────
  openEdit(item: ItineraryItem): void {
    this.editingItem.set(item);
    this.editName     = item.place_name;
    this.editNotes    = item.notes ?? '';
    this.editDayNumber.set(item.day_number);
    this.editLocalBlob = null;
    this.editPhotoUrl.set(item.image_url ?? null);
  }

  closeEdit(): void {
    this.revokeEditBlob();
    this.editingItem.set(null);
  }

  async onEditPhotoSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.revokeEditBlob();
    this.editLocalBlob = URL.createObjectURL(file);
    this.editPhotoUrl.set(this.editLocalBlob);
    this.editUploadingPhoto.set(true);
    try {
      const remoteUrl = await this.tripService.uploadItineraryPhoto(file);
      if (remoteUrl) {
        URL.revokeObjectURL(this.editLocalBlob!);
        this.editLocalBlob = null;
        this.editPhotoUrl.set(remoteUrl);
      }
    } finally {
      this.editUploadingPhoto.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  private revokeEditBlob(): void {
    if (this.editLocalBlob) { URL.revokeObjectURL(this.editLocalBlob); this.editLocalBlob = null; }
  }

  async saveEdit(): Promise<void> {
    const item = this.editingItem();
    if (!item || !this.editName.trim()) return;
    this.editSaving.set(true);
    try {
      await this.tripService.updateItineraryItem(item.id, {
        place_name: this.editName.trim(),
        notes:      this.editNotes.trim() || undefined,
        image_url:  this.editPhotoUrl() ?? undefined,
        day_number: this.editDayNumber(),
      });
      this.items.set(await this.tripService.getItinerary(this.trip()!.id));
      this.closeEdit();
    } finally {
      this.editSaving.set(false);
    }
  }

  // ── 交通方式 ─────────────────────────────────────────────────
  canAutoCalc(mode: TransportMode | null | undefined): boolean {
    return mode === 'walk' || mode === 'drive' || mode === 'bike' || mode === 'transit';
  }

  async setTransportMode(item: ItineraryItem, mode: TransportMode, e: MouseEvent): Promise<void> {
    e.stopPropagation();
    // 切換同一模式則取消
    const newMode = item.next_transport_mode === mode ? null : mode;
    await this.tripService.updateItineraryItem(item.id, { next_transport_mode: newMode });
    this.items.set(await this.tripService.getItinerary(this.trip()!.id));
  }

  async setTransportTime(item: ItineraryItem, e: Event): Promise<void> {
    const minutes = parseInt((e.target as HTMLInputElement).value, 10);
    if (isNaN(minutes) || minutes < 1) return;
    await this.tripService.updateItineraryItem(item.id, { next_transport_minutes: minutes });
    this.items.set(await this.tripService.getItinerary(this.trip()!.id));
  }

  async autoCalc(item: ItineraryItem, e: MouseEvent): Promise<void> {
    e.stopPropagation();
    const dayItems = this.itemsForSelectedDay();
    const idx = dayItems.findIndex(i => i.id === item.id);
    const next = dayItems[idx + 1];
    if (!next || !item.next_transport_mode) return;

    this.calcingId.set(item.id);
    try {
      const minutes = await this.mapsService.estimateDuration(
        { lat: item.latitude,  lng: item.longitude },
        { lat: next.latitude,  lng: next.longitude },
        item.next_transport_mode,
      );
      if (minutes !== null) {
        await this.tripService.updateItineraryItem(item.id, { next_transport_minutes: minutes });
        this.items.set(await this.tripService.getItinerary(this.trip()!.id));
      }
    } finally {
      this.calcingId.set(null);
    }
  }
}
