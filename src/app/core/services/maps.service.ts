import { Injectable } from '@angular/core';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { environment } from '../../../environments/environment';
import { ItineraryItem, TransportMode } from '../models';
import { filterAirportDirectory } from '../utils/airport-directory.util';

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
  /** 以下 3 個欄位僅機場搜尋結果才有值，供下拉選單比照「自動盯價」呈現兩行（城市＋「國家 · 代碼」） */
  city?: string;
  country?: string;
  code?: string;
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
   * 依關鍵字查詢「多筆」地點建議，供「行程」出發地/目的地自動完成下拉選單使用。
   * 刻意只查機場（`AIRPORT_DIRECTORY`），不做一般地址/地標搜尋——
   * 一來符合「出發地/目的地＝搭機起訖點」的需求，二來一般地址搜尋（Nominatim/Google）
   * 常回傳很長的完整地址字串，塞進下拉選單容易被裁切/需要捲動；改成同步查表後
   * 就不再需要打外部 API，也不會再遇到 Google Geocoding API 未啟用的錯誤。
   */
  async searchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
    return filterAirportDirectory(query).map((a) => ({
      name: `${a.name} (${a.code})`,
      lat: a.lat,
      lng: a.lng,
      countryCode: a.countryCode,
      city: a.name,
      country: a.country,
      code: a.code,
    }));
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
      // AdvancedMarkerElement（旅行地圖大頭針用）必須要有有效的 Map ID 才能運作，
      // 否則 console 會噴「地圖在初始化時未使用有效的地圖 ID」且大頭針不會顯示。
      mapId: environment.googleMapsMapId,
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

  /**
   * 兩點間的弧線，供旅行地圖出發地/目的地連線使用。
   * 單純兩點 `geodesic:true` 在中短距離看起來幾乎是直線（地球曲率要長距離才看得出來），
   * 不符合「像飛行路線圖一樣明顯弓起」的視覺需求，改成沿二次貝茲曲線內插出一串座標，
   * 控制點往中垂線方向（固定偏北，弓起方向一致、視覺統一）外推一段距離做出弧度。
   */
  drawArc(
    map: google.maps.Map,
    from: google.maps.LatLngLiteral,
    to: google.maps.LatLngLiteral,
    color: string,
  ): google.maps.Polyline {
    return new google.maps.Polyline({
      path: this.computeArcPath(from, to),
      geodesic: false,
      strokeColor: color,
      strokeOpacity: 0.85,
      strokeWeight: 3,
      map,
    });
  }

  private computeArcPath(
    from: google.maps.LatLngLiteral,
    to: google.maps.LatLngLiteral,
    segments = 60,
  ): google.maps.LatLngLiteral[] {
    const dLat = to.lat - from.lat;
    const dLng = to.lng - from.lng;
    const midLat = (from.lat + to.lat) / 2;
    const midLng = (from.lng + to.lng) / 2;

    // 中垂線方向有兩個（互為反向），固定挑「往北」的那一個，讓所有弧線弓起方向一致
    const perpA = { lat: -dLng, lng: dLat };
    const perpB = { lat: dLng, lng: -dLat };
    const perp = perpA.lat >= perpB.lat ? perpA : perpB;
    const perpLen = Math.hypot(perp.lat, perp.lng) || 1;

    const bowRatio = 0.18;
    const dist = Math.hypot(dLat, dLng);
    const controlLat = midLat + (perp.lat / perpLen) * dist * bowRatio;
    const controlLng = midLng + (perp.lng / perpLen) * dist * bowRatio;

    const path: google.maps.LatLngLiteral[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const oneMinusT = 1 - t;
      path.push({
        lat: oneMinusT * oneMinusT * from.lat + 2 * oneMinusT * t * controlLat + t * t * to.lat,
        lng: oneMinusT * oneMinusT * from.lng + 2 * oneMinusT * t * controlLng + t * t * to.lng,
      });
    }
    return path;
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

  /**
   * 產生一個弧線顏色，供詳情面板「隨機生成」按鈕使用：
   * - 如果「目的地國家」跟其他行程有相同的（`others` 有同國碼的），改成同色系
   *   （色相固定用 `hueForCountry`，跟 `getDefaultArcColor` 同一套算法）、只挑一個
   *   跟同國家其他行程明暗值都夠遠的明暗度，做出「同色系不同色」的效果。
   * - 沒有同國家的其他行程，才照舊在全部顏色裡隨機挑一個色相角度差夠大的顏色。
   */
  generateDistinctColor(
    countryCode: string | null | undefined,
    others: { countryCode: string | null | undefined; color: string }[],
  ): string {
    const sameCountry = others.filter((o) => countryCode && o.countryCode === countryCode);
    if (sameCountry.length) {
      const hue = this.hueForCountry(countryCode);
      const usedLightness = sameCountry
        .map((o) => this.parseHsl(o.color)?.l ?? null)
        .filter((l): l is number => l !== null);

      const MIN_L_DISTANCE = 12;
      const MAX_ATTEMPTS = 20;
      let bestLightness = 55;
      let bestDistance = -1;
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const candidate = 30 + Math.random() * 45; // 30%~75%，跟 getDefaultArcColor 的區間一致
        const distance = usedLightness.length
          ? Math.min(...usedLightness.map((l) => Math.abs(l - candidate)))
          : Infinity;
        if (distance >= MIN_L_DISTANCE) return this.hslToHex(hue, 65, candidate);
        if (distance > bestDistance) {
          bestDistance = distance;
          bestLightness = candidate;
        }
      }
      return this.hslToHex(hue, 65, bestLightness);
    }

    const usedHues = others
      .map((o) => this.parseHsl(o.color)?.h ?? null)
      .filter((h): h is number => h !== null);

    const MIN_H_DISTANCE = 30;
    const MAX_ATTEMPTS = 30;
    let bestHue = Math.floor(Math.random() * 360);
    let bestMinDistance = -1;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const candidate = Math.floor(Math.random() * 360);
      const minDistance = usedHues.length
        ? Math.min(...usedHues.map((h) => this.hueDistance(candidate, h)))
        : Infinity;
      if (minDistance >= MIN_H_DISTANCE) return this.hslToHex(candidate, 65, 50);
      if (minDistance > bestMinDistance) {
        bestMinDistance = minDistance;
        bestHue = candidate;
      }
    }
    return this.hslToHex(bestHue, 65, 50);
  }

  private hueDistance(a: number, b: number): number {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  /**
   * hsl → `#rrggbb`。`generateDistinctColor()` 一律回傳 hex 而非 `hsl(...)` 字串——
   * 原生 `<input type="color">` 只認得 hex，塞 hsl(...) 進去會被瀏覽器判定成無效值、
   * 靜默顯示黑色，導致色票（黑色）跟實際存進去、畫在地圖上的顏色（hsl 字串本身）不一致。
   */
  private hslToHex(h: number, s: number, l: number): string {
    const sNorm = s / 100;
    const lNorm = l / 100;
    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lNorm - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const toHex = (v: number) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /** 解析 `hsl(h, s%, l%)` 或 `#rrggbb` 字串取得 {h, s, l}，解析失敗回傳 null */
  private parseHsl(color: string): { h: number; s: number; l: number } | null {
    const hslMatch = color.match(
      /^hsl\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)$/i,
    );
    if (hslMatch) {
      return {
        h: ((parseFloat(hslMatch[1]) % 360) + 360) % 360,
        s: parseFloat(hslMatch[2]),
        l: parseFloat(hslMatch[3]),
      };
    }

    const hexMatch = color.match(/^#([0-9a-f]{6})$/i);
    if (!hexMatch) return null;
    const r = parseInt(hexMatch[1].slice(0, 2), 16) / 255;
    const g = parseInt(hexMatch[1].slice(2, 4), 16) / 255;
    const b = parseInt(hexMatch[1].slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: l * 100 };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
    return { h, s: s * 100, l: l * 100 };
  }
}

export interface ArcColorTripInput {
  id: string;
  destination_country_code?: string | null;
  start_date_utc?: string | null;
}
