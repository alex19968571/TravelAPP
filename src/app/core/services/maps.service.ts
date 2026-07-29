import { Injectable } from '@angular/core';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { environment } from '../../../environments/environment';
import { ItineraryItem, TransportMode } from '../models';

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

  /** 依地址／地點名稱查詢座標；
   *  1. 直接解析「緯度,經度」格式
   *  2. 嘗試 Google Geocoding API
   *  3. Fallback：Nominatim（OpenStreetMap，免 API key）
   */
  async searchPlace(query: string): Promise<{ name: string; lat: number; lng: number } | null> {
    const latLngMatch = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (latLngMatch) {
      const lat = parseFloat(latLngMatch[1]);
      const lng = parseFloat(latLngMatch[2]);
      return { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
    }

    await this.ensureLoaded();

    // 先嘗試 Google Geocoding API
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address: query });
      const first = result.results[0];
      if (first) {
        return {
          name: first.formatted_address,
          lat: first.geometry.location.lat(),
          lng: first.geometry.location.lng(),
        };
      }
    } catch {
      // Geocoding API 未啟用，改用 Nominatim
    }

    // Fallback: Nominatim (OpenStreetMap)
    return this.nominatimForward(query);
  }

  /** Nominatim 正向地理編碼（免費，不需 API key） */
  private async nominatimForward(query: string): Promise<{ name: string; lat: number; lng: number } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TravelAPP/1.0', 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.length) return null;
      return { name: data[0].display_name, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch (err) {
      console.error('[Maps] Nominatim forward geocoding failed', err);
      return null;
    }
  }

  /** 反向地理編碼（取得點擊座標的地名）：Google Geocoding → Nominatim → 座標字串 */
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    // 嘗試 Google Geocoding
    try {
      const geocoder = new google.maps.Geocoder();
      const res = await geocoder.geocode({ location: { lat, lng } });
      if (res.results?.[0]?.formatted_address) return res.results[0].formatted_address;
    } catch { /* fallback */ }

    // Fallback: Nominatim
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TravelAPP/1.0', 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' },
      });
      if (res.ok) {
        const data = await res.json();
        return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }
    } catch { /* ignore */ }

    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
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

  /** 估算兩點間的行程時間（分鐘），支援步行/開車/大眾運輸；失敗回傳 null */
  async estimateDuration(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    mode: TransportMode,
  ): Promise<number | null> {
    const modeMap: Partial<Record<TransportMode, google.maps.TravelMode>> = {
      walk:    google.maps.TravelMode.WALKING,
      drive:   google.maps.TravelMode.DRIVING,
      bike:    google.maps.TravelMode.BICYCLING,
      transit: google.maps.TravelMode.TRANSIT,
    };
    const travelMode = modeMap[mode];
    if (!travelMode) return null;
    try {
      await this.ensureLoaded();
      const svc = new google.maps.DirectionsService();
      const result = await svc.route({
        origin: from,
        destination: to,
        travelMode,
      });
      const durationSec = result.routes[0]?.legs[0]?.duration?.value ?? null;
      return durationSec !== null ? Math.round(durationSec / 60) : null;
    } catch (err) {
      console.warn('[Maps] estimateDuration failed', err);
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
