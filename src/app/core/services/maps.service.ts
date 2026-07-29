import { Injectable } from '@angular/core';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { environment } from '../../../environments/environment';
import { ItineraryItem } from '../models';

@Injectable({ providedIn: 'root' })
export class MapsService {
  private initialized = false;

  private async ensureLoaded(): Promise<void> {
    if (this.initialized) return;
    setOptions({ key: environment.googleMapsApiKey });
    await importLibrary('maps');
    await importLibrary('routes');
    await importLibrary('geocoding');
    this.initialized = true;
  }

  /** 依地址／地點名稱查詢座標；輸入若已是「緯度,經度」格式則直接解析，不呼叫 API */
  async searchPlace(query: string): Promise<{ name: string; lat: number; lng: number } | null> {
    const latLngMatch = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (latLngMatch) {
      const lat = parseFloat(latLngMatch[1]);
      const lng = parseFloat(latLngMatch[2]);
      return { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
    }

    await this.ensureLoaded();
    const geocoder = new google.maps.Geocoder();
    try {
      const result = await geocoder.geocode({ address: query });
      const first = result.results[0];
      if (!first) return null;
      return {
        name: first.formatted_address,
        lat: first.geometry.location.lat(),
        lng: first.geometry.location.lng(),
      };
    } catch (err) {
      console.error('[Maps] searchPlace error', err);
      return null;
    }
  }

  async initMap(element: HTMLElement, center: google.maps.LatLngLiteral): Promise<google.maps.Map> {
    await this.ensureLoaded();
    return new google.maps.Map(element, {
      center,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
    });
  }

  // 依景點清單取得路線 Polyline（優先讀取快取，避免重複呼叫 API）
  async getRoute(items: ItineraryItem[]): Promise<string | null> {
    if (items.length < 2) return null;

    // 若首個景點已有快取 polyline，直接返回
    if (items[0].encoded_polyline) return items[0].encoded_polyline;

    await this.ensureLoaded();
    const directionsService = new google.maps.DirectionsService();
    const origin = { lat: items[0].latitude, lng: items[0].longitude };
    const destination = { lat: items[items.length - 1].latitude, lng: items[items.length - 1].longitude };
    const waypoints = items.slice(1, -1).map(item => ({
      location: { lat: item.latitude, lng: item.longitude },
      stopover: true,
    }));

    try {
      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.WALKING,
      });
      return result.routes[0]?.overview_polyline ?? null;
    } catch (err) {
      console.error('[Maps] getRoute error', err);
      return null;
    }
  }

  drawPolyline(map: google.maps.Map, encodedPolyline: string): google.maps.Polyline {
    const path = google.maps.geometry.encoding.decodePath(encodedPolyline);
    return new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#667eea',
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map,
    });
  }
}
