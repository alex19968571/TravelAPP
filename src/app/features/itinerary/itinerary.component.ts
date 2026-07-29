import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ItineraryItem, Trip } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { MapsService } from '../../core/services/maps.service';

@Component({
  selector: 'app-itinerary',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a
          [routerLink]="['/trips', tripId]"
          class="back-btn"
          [attr.aria-label]="'itinerary.backToTrip' | transloco"
          >←</a
        >
        <h1>{{ 'itinerary.title' | transloco }}</h1>
      </header>

      <!-- Google Maps 容器 -->
      <div #mapContainer class="map-container"></div>

      <!-- 按天分組 -->
      @for (day of days(); track day) {
        <div class="day-section card">
          <div class="day-header">
            <h3>{{ dayLabel(day) }}</h3>
            <button class="btn-sm" (click)="loadRoute(day)">
              {{ 'itinerary.showRoute' | transloco }}
            </button>
          </div>

          <div class="item-list">
            @for (item of itemsByDay()[day]; track item.id; let i = $index) {
              <div class="itinerary-item">
                <span class="order-badge">{{ i + 1 }}</span>
                <div class="item-info">
                  <strong>{{ item.place_name }}</strong>
                  <span class="coords"
                    >{{ item.latitude.toFixed(4) }}, {{ item.longitude.toFixed(4) }}</span
                  >
                </div>
                <button class="remove-btn" (click)="removeItem(item.id)">×</button>
              </div>
            }
          </div>
        </div>
      }

      <!-- 新增景點 -->
      <div class="card">
        <h3>{{ 'itinerary.addSpot' | transloco }}</h3>
        <form [formGroup]="form" (ngSubmit)="addItem()">
          <div class="form-grid">
            <div class="form-row">
              <label>{{ 'itinerary.spotName' | transloco }}</label>
              <input
                formControlName="place_name"
                [placeholder]="'itinerary.spotNamePlaceholder' | transloco"
              />
            </div>
            <div class="form-row">
              <label>{{ 'itinerary.dayNumber' | transloco }}</label>
              <input formControlName="day_number" type="number" min="1" placeholder="1" />
            </div>
            <div class="form-row">
              <label>{{ 'itinerary.latitude' | transloco }}</label>
              <input formControlName="latitude" type="number" step="any" placeholder="35.7148" />
            </div>
            <div class="form-row">
              <label>{{ 'itinerary.longitude' | transloco }}</label>
              <input formControlName="longitude" type="number" step="any" placeholder="139.7967" />
            </div>
          </div>
          <button type="submit" class="btn-primary" [disabled]="form.invalid">
            {{ 'itinerary.submit' | transloco }}
          </button>
        </form>
      </div>
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
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .back-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        color: var(--accent);
        text-decoration: none;
        font-size: 1.3rem;
        font-weight: 600;
        background: var(--accent-light);
        flex-shrink: 0;
      }
      h1 {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }
      .map-container {
        width: 100%;
        height: 350px;
        border-radius: 16px;
        margin-bottom: 1.5rem;
        background: #eee;
      }
      .card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 4px 20px var(--shadow);
        margin-bottom: 1rem;
      }
      .day-section.card {
        padding: 1.25rem 1.5rem;
      }
      .day-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }
      .day-header h3 {
        margin: 0;
        color: var(--accent);
        font-size: 1.1rem;
      }
      .btn-sm {
        background: var(--accent-light);
        color: var(--accent);
        border: none;
        border-radius: 8px;
        padding: 0.375rem 0.875rem;
        cursor: pointer;
        font-size: 0.875rem;
      }
      .item-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .itinerary-item {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        padding: 0.75rem;
        background: var(--accent-light);
        border-radius: 10px;
      }
      .order-badge {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--accent);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        font-weight: 600;
        flex-shrink: 0;
      }
      .item-info {
        flex: 1;
        color: var(--text-primary);
      }
      .item-info strong {
        display: block;
        font-size: 0.95rem;
      }
      .coords {
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
      .remove-btn {
        background: none;
        border: none;
        color: #e53e3e;
        cursor: pointer;
        font-size: 1.3rem;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .form-row label {
        display: block;
        font-weight: 500;
        margin-bottom: 0.35rem;
        color: var(--text-secondary);
      }
      .form-row input {
        width: 100%;
        padding: 0.625rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 0.95rem;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      .btn-primary {
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 0.625rem 1.5rem;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-primary:disabled {
        opacity: 0.5;
      }
    `,
  ],
})
export class ItineraryComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private tripService = inject(TripService);
  private mapsService = inject(MapsService);
  private fb = inject(FormBuilder);
  private transloco = inject(TranslocoService);

  tripId!: string;
  items = signal<ItineraryItem[]>([]);
  private map: google.maps.Map | null = null;
  private polyline: google.maps.Polyline | null = null;

  days = computed(() => [...new Set(this.items().map((i) => i.day_number))].sort((a, b) => a - b));
  itemsByDay = computed(() => {
    const grouped: Record<number, ItineraryItem[]> = {};
    for (const item of this.items()) {
      (grouped[item.day_number] ??= []).push(item);
    }
    return grouped;
  });

  form = this.fb.group({
    place_name: ['', [Validators.required, Validators.maxLength(200)]],
    day_number: [1, [Validators.required, Validators.min(1)]],
    latitude: [null as number | null, Validators.required],
    longitude: [null as number | null, Validators.required],
  });

  dayLabel(day: number): string {
    return this.transloco.translate('itinerary.day', { day });
  }

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    await this.loadItems();
    this.initMap();
  }

  private async initMap(): Promise<void> {
    try {
      const center = this.items().length
        ? { lat: this.items()[0].latitude, lng: this.items()[0].longitude }
        : { lat: 25.033, lng: 121.5654 };
      this.map = await this.mapsService.initMap(this.mapContainer.nativeElement, center);
    } catch {
      // Google Maps API key 尚未設定時，靜默忽略
    }
  }

  async loadItems(): Promise<void> {
    this.items.set(await this.tripService.getItinerary(this.tripId));
  }

  async addItem(): Promise<void> {
    if (this.form.invalid) return;
    const { place_name, day_number, latitude, longitude } = this.form.value;
    const existing = this.itemsByDay()[day_number!] ?? [];

    await this.tripService.addItineraryItem({
      trip_id: this.tripId,
      day_number: day_number!,
      order_index: existing.length,
      place_name: place_name!,
      latitude: latitude!,
      longitude: longitude!,
    });
    this.form.reset({ day_number: 1 });
    await this.loadItems();
  }

  async loadRoute(day: number): Promise<void> {
    if (!this.map) return;
    const dayItems = this.itemsByDay()[day];
    if (dayItems.length < 2) return;

    const encodedPolyline = await this.mapsService.getRoute(dayItems);
    if (!encodedPolyline) return;

    // 快取 polyline
    await this.tripService.updatePolyline(dayItems[0].id, encodedPolyline);

    // 清除舊路線後繪製新路線
    this.polyline?.setMap(null);
    this.polyline = this.mapsService.drawPolyline(this.map, encodedPolyline);
  }

  async removeItem(id: string): Promise<void> {
    await this.tripService.removeItineraryItem(id);
    await this.loadItems();
  }

  ngOnDestroy(): void {
    this.polyline?.setMap(null);
  }
}
