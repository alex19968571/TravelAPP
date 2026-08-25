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
  /** 大眾運輸預估票價（Google 僅部分地區提供，可能為 undefined） */
  fareText?: string;
}

export interface PlaceSuggestion {
  name: string;
  lat: number;
  lng: number;
  /** ISO alpha-2 國碼（小寫），供旅行地圖依國家分色使用 */
  countryCode?: string | null;
}

const DAY_COLORS = ['#667eea', '#ed8936', '#48bb78', '#f56565', '#9f7aea', '#38b2ac'];

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
    await importLibrary('marker');
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

  /**
   * 依關鍵字查詢「多筆」地點建議（供輸入框即時顯示建議清單，例如旅行地圖的出發地/目的地）。
   * `searchPlace()` 只回傳單一最佳結果，不適合做這種 UX，故另開一支方法。
   * 優先用 Google Geocoding（可能回傳多筆 `results`），沒有結果／未啟用時 fallback 到
   * Nominatim 的多筆搜尋（`limit=8`），兩者都盡量帶出國碼供地圖依國家分色使用。
   */
  async searchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
    const q = query.trim();
    if (!q) return [];

    // Nominatim 優先：免金鑰、不需另外在 Google Cloud 專案啟用 Geocoding API，
    // 避免每次輸入都在 Console 噴 "This API is not activated" 錯誤。
    // Google Geocoding 僅作為 Nominatim 查無結果時的備援。
    const nominatimResults = await this.nominatimForwardMulti(q);
    if (nominatimResults.length) return nominatimResults;

    try {
      await this.ensureLoaded();
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address: q });
      return (result.results ?? []).slice(0, 8).map((r) => {
        const countryComponent = r.address_components?.find((c) => c.types.includes('country'));
        return {
          name: r.formatted_address,
          lat: r.geometry.location.lat(),
          lng: r.geometry.location.lng(),
          countryCode: countryComponent?.short_name?.toLowerCase() ?? null,
        };
      });
    } catch {
      return [];
    }
  }

  /** Nominatim 多筆正向地理編碼（免費，不需 API key），供 searchPlaceSuggestions 使用 */
  private async nominatimForwardMulti(query: string): Promise<PlaceSuggestion[]> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TravelAPP/1.0', 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data as any[]).map((d) => ({
        name: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        countryCode: d.address?.country_code ?? null,
      }));
    } catch (err) {
      console.error('[Maps] Nominatim multi forward geocoding failed', err);
      return [];
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
      const options: RouteOption[] = routes.map((r) => {
        const leg = r.legs[0];
        return {
          durationMin: Math.round((leg?.duration?.value ?? 0) / 60),
          distanceText: leg?.distance?.text ?? '',
          summary: r.summary || '',
          overviewPolyline: r.overview_polyline ?? '',
          steps: (leg?.steps ?? []).map((s) => this.mapDirectionsStep(s)),
          fareText: r.fare?.text,
        };
      });
      // Google 有時會回傳多筆內容完全相同的「替代路線」（同一路線、不同 metadata），
      // 依路線圖形（或缺少圖形時退回時間+距離+摘要）去重，避免畫面上出現重複選項
      const seen = new Set<string>();
      const deduped = options.filter((o) => {
        const key = o.overviewPolyline || `${o.durationMin}|${o.distanceText}|${o.summary}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return deduped.sort((a, b) => a.durationMin - b.durationMin);
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

  /**
   * 旅行地圖用的大頭針：沒有照片用預設紅色 PinElement；有照片用圓形裁切縮圖取代大頭針
   * （對應「去的地方如果有附圖片，用圖片縮圖顯示，不用大頭針」）。
   */
  createPinMarker(
    map: google.maps.Map,
    position: google.maps.LatLngLiteral,
    photoUrl?: string | null,
  ): google.maps.marker.AdvancedMarkerElement {
    if (photoUrl) {
      const content = document.createElement('div');
      content.style.width = '40px';
      content.style.height = '40px';
      content.style.borderRadius = '50%';
      content.style.border = '3px solid #fff';
      content.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
      content.style.overflow = 'hidden';
      const img = document.createElement('img');
      img.src = photoUrl;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      content.appendChild(img);
      return new google.maps.marker.AdvancedMarkerElement({ map, position, content });
    }
    return new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      content: new google.maps.marker.PinElement({}).element,
    });
  }

  /** 兩點間的弧線（geodesic），供旅行地圖出發地/目的地連線使用 */
  drawArc(
    map: google.maps.Map,
    from: google.maps.LatLngLiteral,
    to: google.maps.LatLngLiteral,
    color: string,
  ): google.maps.Polyline {
    return new google.maps.Polyline({
      path: [from, to],
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.85,
      strokeWeight: 3,
      map,
    });
  }

  /**
   * 依 `day_number` 分組畫出每日路線（不同天不同顏色的 marker + polyline），
   * 從 `itinerary.component.ts` 的 renderSpotMarkers() 抽出，供該頁與旅行地圖的
   * 行程小地圖共用，避免重複實作同一套繪圖邏輯。呼叫端負責在清除/重繪前自行
   * `setMap(null)` 舊的 markers/polylines。
   */
  renderDayColoredRoute(
    map: google.maps.Map,
    items: ItineraryItem[],
    onMarkerClick?: (item: ItineraryItem, marker: google.maps.Marker) => void,
  ): {
    markers: google.maps.Marker[];
    polylines: google.maps.Polyline[];
    bounds: google.maps.LatLngBounds;
  } {
    const markers: google.maps.Marker[] = [];
    const polylines: google.maps.Polyline[] = [];
    const bounds = new google.maps.LatLngBounds();

    const grouped = new Map<number, ItineraryItem[]>();
    for (const item of items) {
      if (!grouped.has(item.day_number)) grouped.set(item.day_number, []);
      grouped.get(item.day_number)!.push(item);
    }

    grouped.forEach((dayItems, day) => {
      const color = DAY_COLORS[(day - 1) % DAY_COLORS.length];
      const sorted = [...dayItems].sort((a, b) => a.order_index - b.order_index);

      sorted.forEach((item, idx) => {
        const pos: google.maps.LatLngLiteral = { lat: item.latitude, lng: item.longitude };
        bounds.extend(pos);

        const marker = new google.maps.Marker({
          position: pos,
          map,
          label: { text: String(idx + 1), color: 'white', fontWeight: 'bold', fontSize: '12px' },
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
        if (onMarkerClick) marker.addListener('click', () => onMarkerClick(item, marker));
        markers.push(marker);
      });

      if (sorted.length >= 2) {
        polylines.push(
          new google.maps.Polyline({
            path: sorted.map((i) => ({ lat: i.latitude, lng: i.longitude })),
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 3,
            map,
          }),
        );
      }
    });

    return { markers, polylines, bounds };
  }

  /**
   * 旅行地圖弧線預設顏色：色相依 `destination_country_code` 固定（同國家同色系），
   * 明暗依「去過同一國家的所有行程」以 `start_date_utc` 由舊到新排序後的名次決定
   * ——最早去的最淺、最晚去的最深。authenticated（Trip）與 public（PublicMapTrip）
   * 兩種行程資料形狀都只需要這 3 個欄位，故用最小介面共用。
   */
  getDefaultArcColor(trip: ArcColorTripInput, allTrips: ArcColorTripInput[]): string {
    const hue = this.hueForCountry(trip.destination_country_code);
    const sameCountry = allTrips
      .filter(
        (t) => t.destination_country_code === trip.destination_country_code && t.start_date_utc,
      )
      .sort(
        (a, b) => new Date(a.start_date_utc!).getTime() - new Date(b.start_date_utc!).getTime(),
      );
    const idx = sameCountry.findIndex((t) => t.id === trip.id);
    const count = sameCountry.length;
    const lightness = count <= 1 || idx < 0 ? 55 : 75 - (idx / (count - 1)) * 40;
    return `hsl(${hue}, 65%, ${lightness}%)`;
  }

  private hueForCountry(code: string | null | undefined): number {
    if (!code) return 210;
    let hash = 0;
    for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) % 360;
    return hash;
  }
}

export interface ArcColorTripInput {
  id: string;
  destination_country_code?: string | null;
  start_date_utc?: string | null;
}
