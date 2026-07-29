import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Trip, ItineraryItem } from '../../core/models';
import { TripService } from '../../core/services/trip.service';

interface DateTab { date: Date | null; dayNumber: number; }

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a routerLink="/trips" class="back-btn" [attr.aria-label]="'common.back' | transloco">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </a>
        <h1>{{ trip()?.title ?? ('tripDetail.loading' | transloco) }}</h1>
      </header>

      @if (trip(); as t) {
        <!-- 日期分頁 -->
        <div class="date-tabs-wrap">
          <button class="date-arrow desktop-only" (click)="scrollDates(-1)">‹</button>
          <div class="date-tabs" #dateTabsEl>
            @for (d of dateTabs(); track $index) {
              <button class="date-tab" [class.active]="selectedDayIndex() === $index" (click)="selectedDayIndex.set($index)">
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
              @for (item of itemsForSelectedDay(); track item.id; let i = $index) {
                <div class="itinerary-item">
                  <span class="order-badge">{{ i + 1 }}</span>
                  <div class="item-info">
                    <strong>{{ item.place_name }}</strong>
                    <span class="coords">{{ item.latitude.toFixed(4) }}, {{ item.longitude.toFixed(4) }}</span>
                  </div>
                  <button class="remove-btn" (click)="removeItem(item.id)">×</button>
                </div>
              }
            </div>
          }
          <form [formGroup]="addItemForm" (ngSubmit)="addItem(t.id)" class="add-item-form">
            <input formControlName="place_name" [placeholder]="'itinerary.spotNamePlaceholder' | transloco" />
            <input formControlName="latitude" type="number" step="any" [placeholder]="'itinerary.latitude' | transloco" />
            <input formControlName="longitude" type="number" step="any" [placeholder]="'itinerary.longitude' | transloco" />
            <button type="submit" class="btn-primary" [disabled]="addItemForm.invalid">{{ 'itinerary.submit' | transloco }}</button>
          </form>
        </div>

        <a class="fab" [routerLink]="['/trips', t.id, 'itinerary']" [attr.aria-label]="'tripDetail.openMap' | transloco">＋</a>
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 900px; margin: 0 auto; padding: 1.5rem; background: var(--bg); min-height: 100vh; }
    .page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .back-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      color: var(--accent); text-decoration: none; font-size: 1.3rem; font-weight: 600;
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

    @media (hover: none) and (pointer: coarse) {
      .desktop-only { display: none !important; }
    }

    .card { background: var(--surface); border-radius: 16px; padding: 1.5rem;
      box-shadow: 0 4px 20px var(--shadow); }

    .empty-day { color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 1rem 0; }
    .item-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
    .itinerary-item { display: flex; align-items: center; gap: 0.875rem; padding: 0.75rem;
      background: var(--accent-light); border-radius: 10px; }
    .order-badge { width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: white;
      display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 600; flex-shrink: 0; }
    .item-info { flex: 1; color: var(--text-primary); }
    .item-info strong { display: block; font-size: 0.95rem; }
    .coords { font-size: 0.8rem; color: var(--text-secondary); }
    .remove-btn { background: none; border: none; color: #e53e3e; cursor: pointer;
      font-size: 1.2rem; padding: 0 0.25rem; }
    .add-item-form { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 0.5rem; }
    .add-item-form input {
      padding: 0.55rem 0.75rem; border: 1.5px solid var(--border); border-radius: 10px;
      font-size: 0.875rem; box-sizing: border-box; background: var(--input-bg); color: var(--text-primary);
      min-width: 0;
    }
    @media (max-width: 600px) { .add-item-form { grid-template-columns: 1fr 1fr; } }

    .btn-primary {
      background: var(--accent); color: white; border: none; border-radius: 10px;
      padding: 0.625rem 1.5rem; font-weight: 600; cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.5; }

    /* 浮動新增按鈕（導向地圖頁） */
    .fab {
      position: fixed; right: 1.25rem; bottom: 84px; z-index: 60;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--accent); color: white; text-decoration: none;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.6rem; box-shadow: 0 6px 20px var(--shadow);
    }
  `]
})
export class TripDetailComponent implements OnInit {
  @ViewChild('dateTabsEl') dateTabsEl?: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private tripService = inject(TripService);
  private fb = inject(FormBuilder);

  trip = signal<Trip | undefined>(undefined);
  items = signal<ItineraryItem[]>([]);
  selectedDayIndex = signal(0);

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

  itemsForSelectedDay = computed(() => {
    const tabs = this.dateTabs();
    const dn = tabs[this.selectedDayIndex()]?.dayNumber ?? 1;
    return this.items().filter(i => i.day_number === dn).sort((a, b) => a.order_index - b.order_index);
  });

  addItemForm = this.fb.group({
    place_name: ['', [Validators.required, Validators.maxLength(200)]],
    latitude: [null as number | null, Validators.required],
    longitude: [null as number | null, Validators.required],
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

  async addItem(tripId: string): Promise<void> {
    if (this.addItemForm.invalid) return;
    const { place_name, latitude, longitude } = this.addItemForm.value;
    const dayNumber = this.dateTabs()[this.selectedDayIndex()]?.dayNumber ?? 1;
    const existing = this.items().filter(i => i.day_number === dayNumber);
    await this.tripService.addItineraryItem({
      trip_id: tripId,
      day_number: dayNumber,
      order_index: existing.length,
      place_name: place_name!,
      latitude: latitude!,
      longitude: longitude!,
    });
    this.addItemForm.reset();
    this.items.set(await this.tripService.getItinerary(tripId));
  }

  async removeItem(itemId: string): Promise<void> {
    await this.tripService.removeItineraryItem(itemId);
    this.items.set(await this.tripService.getItinerary(this.trip()!.id));
  }
}
