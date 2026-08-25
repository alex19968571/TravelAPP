import { Component, ViewChild, ElementRef, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Trip, ItineraryItem, TravelMapPin } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { TravelMapService } from '../../core/services/travel-map.service';
import { UserProfileService } from '../../core/services/user-profile.service';
import { AuthService } from '../../core/services/auth.service';
import { MapsService } from '../../core/services/maps.service';
import { TravelMapDetailComponent } from './travel-map-detail.component';

interface DetailData {
  trip: Trip;
  pin: TravelMapPin | undefined;
  items: ItineraryItem[];
}

@Component({
  selector: 'app-travel-map',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule, TravelMapDetailComponent],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a class="back-btn" routerLink="/account">‹</a>
        <h1>🗺️ {{ 'travelMap.title' | transloco }}</h1>
        <button type="button" class="share-btn" (click)="share()">
          {{ (copied() ? 'travelMap.copied' : 'travelMap.share') | transloco }}
        </button>
      </header>

      <div class="map-wrap">
        <div class="map-el" #mapEl></div>
        @if (loading()) {
          <div class="map-loading">{{ 'travelMap.loading' | transloco }}</div>
        }
      </div>
    </div>

    @if (detailData(); as d) {
      <app-travel-map-detail
        [trip]="d.trip"
        [pin]="d.pin"
        [itineraryItems]="d.items"
        [readOnly]="false"
        (closed)="detailData.set(null)"
        (saved)="onPinSaved($event)"
      ></app-travel-map-detail>
    }
  `,
  styles: [
    `
      .page-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .page-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1.5rem;
        flex-shrink: 0;
      }
      .back-btn {
        font-size: 1.5rem;
        color: var(--text-secondary);
        text-decoration: none;
      }
      h1 {
        flex: 1;
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }
      .share-btn {
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 0.5rem 1rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .map-wrap {
        position: relative;
        flex: 1;
        min-height: 0;
      }
      .map-el {
        width: 100%;
        height: 100%;
      }
      .map-loading {
        position: absolute;
        top: 1rem;
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface);
        color: var(--text-secondary);
        padding: 0.5rem 1rem;
        border-radius: 10px;
        box-shadow: 0 4px 16px var(--shadow);
        font-size: 0.85rem;
      }
    `,
  ],
})
export class TravelMapComponent implements AfterViewInit {
  @ViewChild('mapEl') mapElRef!: ElementRef<HTMLElement>;

  private mapsService = inject(MapsService);
  private tripService = inject(TripService);
  private travelMapService = inject(TravelMapService);
  private userProfileService = inject(UserProfileService);
  private auth = inject(AuthService);

  loading = signal(true);
  copied = signal(false);
  detailData = signal<DetailData | null>(null);

  private mapInstance: google.maps.Map | null = null;
  private trips: Trip[] = [];
  private pinsByTripId = new Map<string, TravelMapPin>();

  async ngAfterViewInit(): Promise<void> {
    const ownerId = this.auth.user()?.id;
    if (!ownerId) return;
    try {
      const [trips, pins] = await Promise.all([
        this.tripService.getAll(),
        this.travelMapService.getAll(ownerId),
      ]);
      this.trips = trips;
      this.pinsByTripId = new Map(pins.map((p) => [p.trip_id, p]));

      this.mapInstance = await this.mapsService.initMap(this.mapElRef.nativeElement, {
        lat: 20,
        lng: 0,
      });
      this.mapInstance.setZoom(2);
      this.renderMap();
    } catch (err) {
      console.warn('[TravelMap] init failed', err);
    } finally {
      this.loading.set(false);
    }
  }

  private renderMap(): void {
    if (!this.mapInstance) return;
    for (const trip of this.trips) {
      if (trip.destination_lat == null || trip.destination_lng == null) continue;
      const destPos = { lat: trip.destination_lat, lng: trip.destination_lng };
      const pin = this.pinsByTripId.get(trip.id);
      const destMarker = this.mapsService.createPinMarker(
        this.mapInstance,
        destPos,
        pin?.photo_urls?.[0],
      );
      destMarker.addListener('gmp-click', () => this.openDetail(trip, pin));

      if (trip.origin_lat != null && trip.origin_lng != null) {
        const originPos = { lat: trip.origin_lat, lng: trip.origin_lng };
        const originMarker = this.mapsService.createPinMarker(this.mapInstance, originPos);
        originMarker.addListener('gmp-click', () => {
          const infoWindow = new google.maps.InfoWindow({ content: trip.origin ?? '' });
          infoWindow.open({ map: this.mapInstance!, anchor: originMarker });
        });
        const color = pin?.arc_color || this.mapsService.getDefaultArcColor(trip, this.trips);
        this.mapsService.drawArc(this.mapInstance, originPos, destPos, color);
      }
    }
  }

  async openDetail(trip: Trip, pin: TravelMapPin | undefined): Promise<void> {
    const items = await this.tripService.getItinerary(trip.id);
    this.detailData.set({ trip, pin, items });
  }

  async onPinSaved(updated: TravelMapPin): Promise<void> {
    this.pinsByTripId.set(updated.trip_id, updated);
    const current = this.detailData();
    if (current) this.detailData.set({ ...current, pin: updated });
  }

  async share(): Promise<void> {
    const token = await this.userProfileService.getOrCreateMapShareToken();
    // 用 document.baseURI（反映 <base href>，部署到 GitHub Pages 子路徑如
    // /TravelAPP/ 時會含在內）而非 location.origin，避免分享連結漏掉部署子路徑
    // 導致 404（GH Pages 的 SPA fallback 404.html 只涵蓋子路徑底下的網址）。
    const url = `${document.baseURI}shared-map/${token}`;
    await navigator.clipboard.writeText(url);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
