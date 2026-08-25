import { Component, ViewChild, ElementRef, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { ItineraryItem, TravelMapPin } from '../../core/models';
import { TravelMapService, PublicMapTrip } from '../../core/services/travel-map.service';
import { MapsService } from '../../core/services/maps.service';
import { TravelMapDetailComponent } from './travel-map-detail.component';

interface PublicDetailData {
  trip: PublicMapTrip;
  pin: TravelMapPin | undefined;
  items: ItineraryItem[];
}

/** 旅行地圖公開分享頁：免登入唯讀檢視，透過 /shared-map/:token 存取 */
@Component({
  selector: 'app-public-map',
  standalone: true,
  imports: [CommonModule, TranslocoModule, TravelMapDetailComponent],
  template: `
    <div class="page-container">
      <header class="page-header">
        <h1>🗺️ {{ 'travelMap.title' | transloco }}</h1>
      </header>

      <div class="map-wrap">
        <div class="map-el" #mapEl></div>
        @if (loading()) {
          <div class="map-loading">{{ 'travelMap.loading' | transloco }}</div>
        } @else if (notFound()) {
          <div class="map-loading">{{ 'travelMap.shareNotFound' | transloco }}</div>
        }
      </div>
    </div>

    @if (detailData(); as d) {
      <app-travel-map-detail
        [trip]="d.trip"
        [pin]="d.pin"
        [itineraryItems]="d.items"
        [readOnly]="true"
        (closed)="detailData.set(null)"
      ></app-travel-map-detail>
    }
  `,
  styles: [
    `
      .page-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        min-height: 0;
      }
      .page-header {
        padding: 1.5rem;
        flex-shrink: 0;
      }
      h1 {
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
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
export class PublicMapComponent implements AfterViewInit {
  @ViewChild('mapEl') mapElRef!: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private mapsService = inject(MapsService);
  private travelMapService = inject(TravelMapService);

  loading = signal(true);
  notFound = signal(false);
  detailData = signal<PublicDetailData | null>(null);

  private mapInstance: google.maps.Map | null = null;
  private token = '';
  private trips: PublicMapTrip[] = [];
  private pinsByTripId = new Map<string, TravelMapPin>();

  async ngAfterViewInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    try {
      const [trips, pins] = await Promise.all([
        this.travelMapService.getPublicTrips(this.token),
        this.travelMapService.getPublicPins(this.token),
      ]);
      this.trips = trips;
      this.pinsByTripId = new Map(pins.map((p) => [p.trip_id, p]));

      if (trips.length === 0 && pins.length === 0) {
        this.notFound.set(true);
      }

      this.mapInstance = await this.mapsService.initMap(this.mapElRef.nativeElement, {
        lat: 20,
        lng: 0,
      });
      this.mapInstance.setZoom(2);
      this.renderMap();
    } catch (err) {
      console.warn('[PublicMap] init failed', err);
      this.notFound.set(true);
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

  async openDetail(trip: PublicMapTrip, pin: TravelMapPin | undefined): Promise<void> {
    const items = await this.travelMapService.getPublicTripItinerary(this.token, trip.id);
    this.detailData.set({ trip, pin, items: items as ItineraryItem[] });
  }
}
