import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ItineraryItem, Trip } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { MapsService } from '../../core/services/maps.service';

interface DateTab { date: Date | null; dayNumber: number; }
interface SearchResult { name: string; lat: number; lng: number; }

@Component({
  selector: 'app-itinerary',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a [routerLink]="['/trips', tripId]" class="back-btn" [attr.aria-label]="'itinerary.backToTrip' | transloco">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </a>
      </header>

      <!-- 搜尋列：地址／景點名稱／經緯度 -->
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

      @if (searchResult(); as r) {
        <div class="card result-card">
          <div class="result-info">
            <strong>{{ r.name }}</strong>
            <span class="coords">{{ r.lat.toFixed(5) }}, {{ r.lng.toFixed(5) }}</span>
          </div>
          <button class="btn-primary" (click)="stageResult(r)">{{ 'itinerary.addToStaging' | transloco }}</button>
        </div>
      }

      <!-- 暫存編輯區：待加入行程的景點 -->
      @if (stagingLat() !== null) {
        <div class="card staging-card">
          <div class="staging-row">
            <button class="photo-btn" (click)="photoInput.click()">
              @if (stagingPhotoUrl()) {
                <img [src]="stagingPhotoUrl()" class="photo-thumb" alt="" />
              } @else if (uploadingPhoto()) {
                <span class="photo-loading">…</span>
              } @else {
                <span class="photo-plus">＋</span>
              }
            </button>
            <input #photoInput type="file" accept="image/*" hidden (change)="onPhotoSelected($event)" />

            <input class="staging-name" [(ngModel)]="stagingName" name="stagingName" />

            <button class="date-select-btn" (click)="showDatePicker.set(true)">
              {{ selectedDateLabel() }} ▾
            </button>
          </div>
        </div>
      }

      @if (showDatePicker()) {
        <div class="modal-backdrop" (click)="showDatePicker.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>{{ 'itinerary.chooseDate' | transloco }}</h3>
            <div class="picker-list">
              @for (d of dateTabs(); track $index) {
                <button class="picker-option" (click)="chooseDate(d)">{{ formatTabDate(d) }}</button>
              }
            </div>
          </div>
        </div>
      }

      @if (showPositionPicker()) {
        <div class="modal-backdrop" (click)="showPositionPicker.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>{{ 'itinerary.choosePosition' | transloco }}</h3>
            <div class="picker-list">
              @for (p of positionOptions(); track p) {
                <button class="picker-option" [class.selected]="p === selectedPosition()" (click)="selectedPosition.set(p)">
                  {{ positionLabel(p) }}
                </button>
              }
            </div>
            <button class="btn-primary full-width" (click)="confirmAdd()">{{ 'common.confirm' | transloco }}</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 600px; margin: 0 auto; padding: 1.5rem; background: var(--bg); min-height: 100vh; }
    .page-header { display: flex; align-items: center; margin-bottom: 1rem; }
    .back-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      color: var(--accent); text-decoration: none; font-size: 1.3rem; font-weight: 600;
      background: var(--accent-light);
    }

    .search-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .search-row input {
      flex: 1; padding: 0.625rem 0.875rem; border: 1.5px solid var(--border); border-radius: 10px;
      font-size: 0.95rem; box-sizing: border-box; background: var(--input-bg); color: var(--text-primary);
    }
    .not-found { color: var(--text-secondary); font-size: 0.9rem; margin: -0.5rem 0 1rem; }

    .card { background: var(--surface); border-radius: 16px; padding: 1.25rem; box-shadow: 0 4px 20px var(--shadow); margin-bottom: 1rem; }
    .result-card { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .result-info { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; color: var(--text-primary); }
    .result-info strong { font-size: 0.95rem; }
    .coords { font-size: 0.8rem; color: var(--text-secondary); }

    .staging-row { display: flex; align-items: center; gap: 0.75rem; }
    .photo-btn {
      flex-shrink: 0; width: 48px; height: 48px; border-radius: 10px;
      background: var(--bg); border: 1.5px dashed var(--border); cursor: pointer;
      display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 0;
    }
    .photo-plus { font-size: 1.3rem; color: var(--text-secondary); }
    .photo-loading { font-size: 1rem; color: var(--text-secondary); }
    .photo-thumb { width: 100%; height: 100%; object-fit: cover; }
    .staging-name {
      flex: 1; min-width: 0; padding: 0.6rem 0.75rem; border: 1.5px solid var(--border); border-radius: 10px;
      font-size: 0.95rem; box-sizing: border-box; background: var(--input-bg); color: var(--text-primary);
    }
    .date-select-btn {
      flex-shrink: 0; background: var(--accent-light); color: var(--accent); border: none;
      border-radius: 10px; padding: 0.6rem 0.875rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
      white-space: nowrap;
    }

    .btn-primary {
      background: var(--accent); color: white; border: none; border-radius: 10px;
      padding: 0.625rem 1.25rem; font-weight: 600; cursor: pointer; white-space: nowrap;
    }
    .btn-primary:disabled { opacity: 0.5; }
    .full-width { width: 100%; margin-top: 0.75rem; }

    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
      display: flex; align-items: center; justify-content: center; z-index: 200; padding: 1rem;
    }
    .modal-card { background: var(--surface); border-radius: 16px; padding: 1.5rem; max-width: 340px; width: 100%; box-shadow: 0 12px 40px var(--shadow); }
    .modal-card h3 { margin: 0 0 1rem; color: var(--text-primary); }
    .picker-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 320px; overflow-y: auto; }
    .picker-option {
      padding: 0.625rem 0.875rem; border-radius: 10px; border: 1.5px solid var(--border);
      background: var(--bg); color: var(--text-primary); cursor: pointer; text-align: left; font-size: 0.9rem;
    }
    .picker-option.selected { border-color: var(--accent); background: var(--accent-light); color: var(--accent); font-weight: 600; }
  `]
})
export class ItineraryComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tripService = inject(TripService);
  private mapsService = inject(MapsService);
  private transloco = inject(TranslocoService);

  tripId!: string;
  trip = signal<Trip | undefined>(undefined);
  items = signal<ItineraryItem[]>([]);

  searchQuery = '';
  searching = signal(false);
  searchResult = signal<SearchResult | null>(null);
  searchNotFound = signal(false);

  stagingName = '';
  stagingLat = signal<number | null>(null);
  stagingLng = signal<number | null>(null);
  stagingPhotoUrl = signal<string | null>(null);
  uploadingPhoto = signal(false);

  showDatePicker = signal(false);
  showPositionPicker = signal(false);
  selectedDate = signal<DateTab | null>(null);
  selectedPosition = signal(0);

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

  formatTabDate(tab: DateTab): string {
    if (!tab.date) return `${tab.dayNumber}`;
    return `${tab.date.getMonth() + 1}/${tab.date.getDate()}`;
  }

  positionLabel(p: number): string {
    return this.transloco.translate('itinerary.positionN', { n: p + 1 });
  }

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    this.trip.set(await this.tripService.getById(this.tripId));
    this.items.set(await this.tripService.getItinerary(this.tripId));

    const dayParam = Number(this.route.snapshot.queryParamMap.get('day'));
    if (dayParam) {
      const match = this.dateTabs().find(d => d.dayNumber === dayParam);
      if (match) this.selectedDate.set(match);
    }
  }

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
      } else {
        this.searchNotFound.set(true);
      }
    } finally {
      this.searching.set(false);
    }
  }

  stageResult(r: SearchResult): void {
    this.stagingName = r.name;
    this.stagingLat.set(r.lat);
    this.stagingLng.set(r.lng);
    this.stagingPhotoUrl.set(null);
    this.searchResult.set(null);
    this.searchQuery = '';
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

  chooseDate(d: DateTab): void {
    this.selectedDate.set(d);
    this.showDatePicker.set(false);
    const count = this.items().filter(i => i.day_number === d.dayNumber).length;
    this.selectedPosition.set(count); // 預設在最後面
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
      },
      this.selectedPosition(),
    );

    this.items.set(await this.tripService.getItinerary(this.tripId));
    this.showPositionPicker.set(false);
    // 清空暫存區塊，方便接續新增下一個景點
    this.stagingName = '';
    this.stagingLat.set(null);
    this.stagingLng.set(null);
    this.stagingPhotoUrl.set(null);
  }
}
