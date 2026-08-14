import { Injectable } from '@angular/core';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { environment } from '../../../environments/environment';
import { ItineraryItem, TransportMode } from '../models';

export interface RouteStepTransitInfo {
  lineName: string;
  lineShortName: string;
  vehicleType: string;
  lineColor: string;
  departureStop: string;
  arrivalStop: string;
  numStops: number;
}

export interface RouteStep {
  mode: 'walk' | 'transit' | 'drive' | 'bike';
  durationText: string;
  distanceText: string;
  instructions: string;
  transit?: RouteStepTransitInfo;
}

export interface RouteOption {
  durationMin: number;
  distanceText: string;
  summary: string;
  overviewPolyline: string;
  steps: RouteStep[];
}

@Injectable({ providedIn: 'root' })
export class MapsService {
  private initialized = false;

  /** 部分交通模式（尤其是大眾運輸）在無路線可用時，Google 舊版 DirectionsService
   *  可能延遲數十秒才回傳 ZERO_RESULTS，這裡加上逾時保護避免 UI 卡住。 */
  private withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('DIRECTIONS_TIMEOUT')), ms)),
    ]);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.initialized) return;
    setOptions({ key: environment.googleMapsApiKey });
    await importLibrary('maps');
    await importLibrary('routes');
    await importLibrary('geocoding');
    await importLibrary('geometry');
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
  private async nominatimForward(
    query: string,
  ): Promise<{ name: string; lat: number; lng: number } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TravelAPP/1.0', 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.length) return null;
      return {
        name: data[0].display_name,
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
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
    } catch {
      /* fallback */
    }

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
    } catch {
      /* ignore */
    }

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
    const destination = {
      lat: items[items.length - 1].latitude,
      lng: items[items.length - 1].longitude,
    };
    const waypoints = items.slice(1, -1).map((item) => ({
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

  private mapDirectionsStep(s: google.maps.DirectionsStep): RouteStep {
    const modeMap: Record<string, RouteStep['mode']> = {
      WALKING: 'walk',
      TRANSIT: 'transit',
      DRIVING: 'drive',
      BICYCLING: 'bike',
    };
    const step: RouteStep = {
      mode: modeMap[s.travel_mode as unknown as string] ?? 'walk',
      durationText: s.duration?.text ?? '',
      distanceText: s.distance?.text ?? '',
      instructions: (s.instructions ?? '').replace(/<[^>]+>/g, ''),
    };
    if (s.transit) {
      step.transit = {
        lineName: s.transit.line?.name ?? '',
        lineShortName: s.transit.line?.short_name || s.transit.line?.name || '',
        vehicleType: s.transit.line?.vehicle?.type ?? '',
        lineColor: s.transit.line?.color || '#667eea',
        departureStop: s.transit.departure_stop?.name ?? '',
        arrivalStop: s.transit.arrival_stop?.name ?? '',
        numStops: s.transit.num_stops ?? 0,
      };
    }
    return step;
  }

  /** 查詢兩點間所有可行路線（依所需時間由短到長排序，含逐步說明與路線 Polyline），失敗回傳 null */
  async estimateRoutes(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    mode: TransportMode,
  ): Promise<RouteOption[] | null> {
    if (mode !== 'walk' && mode !== 'drive' && mode !== 'bike' && mode !== 'transit') return null;
    try {
      await this.ensureLoaded();
      const modeMap: Record<'walk' | 'drive' | 'bike' | 'transit', google.maps.TravelMode> = {
        walk: google.maps.TravelMode.WALKING,
        drive: google.maps.TravelMode.DRIVING,
        bike: google.maps.TravelMode.BICYCLING,
        transit: google.maps.TravelMode.TRANSIT,
      };
      const svc = new google.maps.DirectionsService();
      const result = await this.withTimeout(
        svc.route({
          origin: from,
          destination: to,
          travelMode: modeMap[mode],
          provideRouteAlternatives: true,
        }),
      );
      const routes = result.routes ?? [];
      if (!routes.length) return null;
      return routes
        .map((r) => {
          const leg = r.legs[0];
          return {
            durationMin: Math.round((leg?.duration?.value ?? 0) / 60),
            distanceText: leg?.distance?.text ?? '',
            summary: r.summary || '',
            overviewPolyline: r.overview_polyline ?? '',
            steps: (leg?.steps ?? []).map((s) => this.mapDirectionsStep(s)),
          };
        })
        .sort((a, b) => a.durationMin - b.durationMin);
    } catch (err) {
      // ZERO_RESULTS／逾時屬於預期中的「查無路線」情境，不視為錯誤
      const status = (err as { code?: string })?.code;
      if (status !== 'ZERO_RESULTS' && (err as Error)?.message !== 'DIRECTIONS_TIMEOUT') {
        console.warn('[Maps] estimateRoutes failed', err);
      }
      return null;
    }
  }

  /** 將編碼路線字串解碼為座標陣列，供小地圖繪製路線使用 */
  async decodePolyline(encoded: string): Promise<google.maps.LatLngLiteral[]> {
    await this.ensureLoaded();
    return google.maps.geometry.encoding
      .decodePath(encoded)
      .map((p) => ({ lat: p.lat(), lng: p.lng() }));
  }

  /** 估算兩點間的行程時間（分鐘），支援步行/開車/大眾運輸；失敗回傳 null */
  async estimateDuration(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    mode: TransportMode,
  ): Promise<number | null> {
    if (mode !== 'walk' && mode !== 'drive' && mode !== 'bike' && mode !== 'transit') return null;
    try {
      await this.ensureLoaded();
      const modeMap: Record<'walk' | 'drive' | 'bike' | 'transit', google.maps.TravelMode> = {
        walk: google.maps.TravelMode.WALKING,
        drive: google.maps.TravelMode.DRIVING,
        bike: google.maps.TravelMode.BICYCLING,
        transit: google.maps.TravelMode.TRANSIT,
      };
      const travelMode = modeMap[mode];
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
