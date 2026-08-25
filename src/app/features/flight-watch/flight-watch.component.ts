import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { FlightWatch, FlightMaxStops, Trip } from '../../core/models';
import { FlightWatchService } from '../../core/services/flight-watch.service';
import {
  FlightPriceService,
  FlightItinerary,
  FlightItineraryLeg,
} from '../../core/services/flight-price.service';
import { AuthService } from '../../core/services/auth.service';
import { PreferenceService } from '../../core/services/preference.service';
import { TripService } from '../../core/services/trip.service';
import { DropdownSelectComponent } from '../../shared/components/dropdown-select/dropdown-select.component';

interface Airport {
  code: string;
  city: string;
  country: string;
}

/** 常用機場資料（城市/國家皆支援中文搜尋），供出發地/目的地自動完成使用 */
const AIRPORTS: Airport[] = [
  { code: 'TPE', city: '台北', country: '台灣' },
  { code: 'TSA', city: '台北(松山)', country: '台灣' },
  { code: 'KHH', city: '高雄', country: '台灣' },
  { code: 'RMQ', city: '台中', country: '台灣' },
  { code: 'NRT', city: '東京(成田)', country: '日本' },
  { code: 'HND', city: '東京(羽田)', country: '日本' },
  { code: 'KIX', city: '大阪', country: '日本' },
  { code: 'NGO', city: '名古屋', country: '日本' },
  { code: 'FUK', city: '福岡', country: '日本' },
  { code: 'CTS', city: '札幌', country: '日本' },
  { code: 'OKA', city: '沖繩', country: '日本' },
  { code: 'ICN', city: '首爾(仁川)', country: '南韓' },
  { code: 'GMP', city: '首爾(金浦)', country: '南韓' },
  { code: 'PUS', city: '釜山', country: '南韓' },
  { code: 'HKG', city: '香港', country: '香港' },
  { code: 'MFM', city: '澳門', country: '澳門' },
  { code: 'PVG', city: '上海(浦東)', country: '中國' },
  { code: 'SHA', city: '上海(虹橋)', country: '中國' },
  { code: 'PEK', city: '北京(首都)', country: '中國' },
  { code: 'PKX', city: '北京(大興)', country: '中國' },
  { code: 'CAN', city: '廣州', country: '中國' },
  { code: 'SZX', city: '深圳', country: '中國' },
  { code: 'BKK', city: '曼谷', country: '泰國' },
  { code: 'DMK', city: '曼谷(廊曼)', country: '泰國' },
  { code: 'HKT', city: '普吉島', country: '泰國' },
  { code: 'CNX', city: '清邁', country: '泰國' },
  { code: 'SGN', city: '胡志明市', country: '越南' },
  { code: 'HAN', city: '河內', country: '越南' },
  { code: 'DAD', city: '峴港', country: '越南' },
  { code: 'SIN', city: '新加坡', country: '新加坡' },
  { code: 'KUL', city: '吉隆坡', country: '馬來西亞' },
  { code: 'CGK', city: '雅加達', country: '印尼' },
  { code: 'DPS', city: '峇里島', country: '印尼' },
  { code: 'MNL', city: '馬尼拉', country: '菲律賓' },
  { code: 'CEB', city: '宿霧', country: '菲律賓' },
  { code: 'DEL', city: '新德里', country: '印度' },
  { code: 'BOM', city: '孟買', country: '印度' },
  { code: 'DXB', city: '杜拜', country: '阿聯酋' },
  { code: 'DOH', city: '杜哈', country: '卡達' },
  { code: 'IST', city: '伊斯坦堡', country: '土耳其' },
  { code: 'LHR', city: '倫敦(希斯洛)', country: '英國' },
  { code: 'CDG', city: '巴黎(戴高樂)', country: '法國' },
  { code: 'FRA', city: '法蘭克福', country: '德國' },
  { code: 'FCO', city: '羅馬', country: '義大利' },
  { code: 'AMS', city: '阿姆斯特丹', country: '荷蘭' },
  { code: 'ZRH', city: '蘇黎世', country: '瑞士' },
  { code: 'JFK', city: '紐約(甘迺迪)', country: '美國' },
  { code: 'LAX', city: '洛杉磯', country: '美國' },
  { code: 'SFO', city: '舊金山', country: '美國' },
  { code: 'SEA', city: '西雅圖', country: '美國' },
  { code: 'YVR', city: '溫哥華', country: '加拿大' },
  { code: 'YYZ', city: '多倫多', country: '加拿大' },
  { code: 'SYD', city: '雪梨', country: '澳洲' },
  { code: 'MEL', city: '墨爾本', country: '澳洲' },
  { code: 'AKL', city: '奧克蘭', country: '紐西蘭' },
];

/**
 * 機場代碼直接對應時區／幣別，供匯入行程時依「去程目的地機場」帶入使用。
 * 不透過 AIRPORTS.country 字串比對 COUNTRIES.nativeName 間接查詢——
 * 兩者的國家名稱書寫不一定一致（例如「南韓」對不上「한국」、「中國」對不上「中国」），
 * 且 COUNTRIES 未涵蓋紐西蘭、香港、澳門、菲律賓、印度、卡達、荷蘭等地，會查不到值。
 * 同一國家內時區可能不同（例如美國東西岸），故仍需以機場代碼為單位個別列出。
 */
const AIRPORT_TZ_CURRENCY: Record<string, { timezone: string; currency: string }> = {
  TPE: { timezone: 'Asia/Taipei', currency: 'TWD' },
  TSA: { timezone: 'Asia/Taipei', currency: 'TWD' },
  KHH: { timezone: 'Asia/Taipei', currency: 'TWD' },
  RMQ: { timezone: 'Asia/Taipei', currency: 'TWD' },
  NRT: { timezone: 'Asia/Tokyo', currency: 'JPY' },
  HND: { timezone: 'Asia/Tokyo', currency: 'JPY' },
  KIX: { timezone: 'Asia/Tokyo', currency: 'JPY' },
  NGO: { timezone: 'Asia/Tokyo', currency: 'JPY' },
  FUK: { timezone: 'Asia/Tokyo', currency: 'JPY' },
  CTS: { timezone: 'Asia/Tokyo', currency: 'JPY' },
  OKA: { timezone: 'Asia/Tokyo', currency: 'JPY' },
  ICN: { timezone: 'Asia/Seoul', currency: 'KRW' },
  GMP: { timezone: 'Asia/Seoul', currency: 'KRW' },
  PUS: { timezone: 'Asia/Seoul', currency: 'KRW' },
  HKG: { timezone: 'Asia/Hong_Kong', currency: 'HKD' },
  MFM: { timezone: 'Asia/Macau', currency: 'MOP' },
  PVG: { timezone: 'Asia/Shanghai', currency: 'CNY' },
  SHA: { timezone: 'Asia/Shanghai', currency: 'CNY' },
  PEK: { timezone: 'Asia/Shanghai', currency: 'CNY' },
  PKX: { timezone: 'Asia/Shanghai', currency: 'CNY' },
  CAN: { timezone: 'Asia/Shanghai', currency: 'CNY' },
  SZX: { timezone: 'Asia/Shanghai', currency: 'CNY' },
  BKK: { timezone: 'Asia/Bangkok', currency: 'THB' },
  DMK: { timezone: 'Asia/Bangkok', currency: 'THB' },
  HKT: { timezone: 'Asia/Bangkok', currency: 'THB' },
  CNX: { timezone: 'Asia/Bangkok', currency: 'THB' },
  SGN: { timezone: 'Asia/Ho_Chi_Minh', currency: 'VND' },
  HAN: { timezone: 'Asia/Ho_Chi_Minh', currency: 'VND' },
  DAD: { timezone: 'Asia/Ho_Chi_Minh', currency: 'VND' },
  SIN: { timezone: 'Asia/Singapore', currency: 'SGD' },
  KUL: { timezone: 'Asia/Kuala_Lumpur', currency: 'MYR' },
  CGK: { timezone: 'Asia/Jakarta', currency: 'IDR' },
  DPS: { timezone: 'Asia/Makassar', currency: 'IDR' },
  MNL: { timezone: 'Asia/Manila', currency: 'PHP' },
  CEB: { timezone: 'Asia/Manila', currency: 'PHP' },
  DEL: { timezone: 'Asia/Kolkata', currency: 'INR' },
  BOM: { timezone: 'Asia/Kolkata', currency: 'INR' },
  DXB: { timezone: 'Asia/Dubai', currency: 'AED' },
  DOH: { timezone: 'Asia/Qatar', currency: 'QAR' },
  IST: { timezone: 'Europe/Istanbul', currency: 'TRY' },
  LHR: { timezone: 'Europe/London', currency: 'GBP' },
  CDG: { timezone: 'Europe/Paris', currency: 'EUR' },
  FRA: { timezone: 'Europe/Berlin', currency: 'EUR' },
  FCO: { timezone: 'Europe/Rome', currency: 'EUR' },
  AMS: { timezone: 'Europe/Amsterdam', currency: 'EUR' },
  ZRH: { timezone: 'Europe/Zurich', currency: 'CHF' },
  JFK: { timezone: 'America/New_York', currency: 'USD' },
  LAX: { timezone: 'America/Los_Angeles', currency: 'USD' },
  SFO: { timezone: 'America/Los_Angeles', currency: 'USD' },
  SEA: { timezone: 'America/Los_Angeles', currency: 'USD' },
  YVR: { timezone: 'America/Vancouver', currency: 'CAD' },
  YYZ: { timezone: 'America/Toronto', currency: 'CAD' },
  SYD: { timezone: 'Australia/Sydney', currency: 'AUD' },
  MEL: { timezone: 'Australia/Melbourne', currency: 'AUD' },
  AKL: { timezone: 'Pacific/Auckland', currency: 'NZD' },
};

const CURRENCY_CODES = [
  'TWD',
  'JPY',
  'USD',
  'EUR',
  'THB',
  'KRW',
  'HKD',
  'SGD',
  'MYR',
  'AUD',
  'GBP',
];

@Component({
  selector: 'app-flight-watch',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    DecimalPipe,
    TranslocoModule,
    DropdownSelectComponent,
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div class="header-mid">
          <h1>✈️ {{ 'flightWatch.title' | transloco }}</h1>
        </div>
        <button class="btn-icon add-trigger" type="button" (click)="openAddModal()">＋</button>
      </header>

      @if (showAddModal()) {
        <div class="modal-backdrop" (click)="closeAddModal()">
          <form
            [formGroup]="form"
            (ngSubmit)="submitWatch()"
            class="card add-form modal-card modal-card-compact"
            (click)="$event.stopPropagation()"
          >
            <div class="scale-wrap" #scaleWrap>
              <h3 class="modal-title">
                {{ (editingWatchId() ? 'flightWatch.editWatch' : 'flightWatch.title') | transloco }}
              </h3>
              <div class="form-grid">
                <div class="form-row span-2 route-row">
                  <div class="autocomplete-field">
                    <label>{{ 'flightWatch.origin' | transloco }} *</label>
                    <input
                      [ngModel]="originQuery()"
                      (ngModelChange)="onOriginQueryChange($event)"
                      [ngModelOptions]="{ standalone: true }"
                      (focus)="originFocused.set(true)"
                      (blur)="onOriginBlur()"
                      [placeholder]="'flightWatch.originPlaceholder' | transloco"
                      autocomplete="off"
                    />
                    @if (originFocused() && originSuggestions().length) {
                      <div class="suggestion-list">
                        @for (a of originSuggestions(); track a.code) {
                          <button
                            type="button"
                            class="suggestion-item"
                            (mousedown)="$event.preventDefault()"
                            (click)="selectOrigin(a)"
                          >
                            <span class="suggestion-city">{{ a.city }}</span>
                            <span class="suggestion-meta">{{ a.country }} · {{ a.code }}</span>
                          </button>
                        }
                      </div>
                    }
                  </div>
                  <button
                    type="button"
                    class="swap-route-btn"
                    (click)="swapRoute()"
                    [attr.aria-label]="'flightWatch.swap' | transloco"
                  >
                    ⇄
                  </button>
                  <div class="autocomplete-field">
                    <label>{{ 'flightWatch.destination' | transloco }} *</label>
                    <input
                      [ngModel]="destinationQuery()"
                      (ngModelChange)="onDestinationQueryChange($event)"
                      [ngModelOptions]="{ standalone: true }"
                      (focus)="destinationFocused.set(true)"
                      (blur)="onDestinationBlur()"
                      [placeholder]="'flightWatch.destinationPlaceholder' | transloco"
                      autocomplete="off"
                    />
                    @if (destinationFocused() && destinationSuggestions().length) {
                      <div class="suggestion-list">
                        @for (a of destinationSuggestions(); track a.code) {
                          <button
                            type="button"
                            class="suggestion-item"
                            (mousedown)="$event.preventDefault()"
                            (click)="selectDestination(a)"
                          >
                            <span class="suggestion-city">{{ a.city }}</span>
                            <span class="suggestion-meta">{{ a.country }} · {{ a.code }}</span>
                          </button>
                        }
                      </div>
                    }
                  </div>
                </div>
                <div class="form-row">
                  <label>{{ 'flightWatch.departDate' | transloco }} *</label>
                  <input formControlName="depart_date" type="date" />
                </div>
                <div class="form-row">
                  <label>{{ 'flightWatch.returnDate' | transloco }}</label>
                  <input formControlName="return_date" type="date" />
                </div>
                <div class="form-row span-2">
                  <label>{{ 'flightWatch.maxStopsLabel' | transloco }}</label>
                  <app-dropdown-select
                    [options]="maxStopsDropdownOptions()"
                    formControlName="max_stops"
                  ></app-dropdown-select>
                </div>
                <div class="form-row span-2">
                  <label>{{ 'flightWatch.targetPrice' | transloco }}</label>
                  <div class="amount-input-wrap">
                    <input
                      formControlName="target_price"
                      type="text"
                      inputmode="decimal"
                      autocomplete="off"
                      class="amount-input-lg"
                    />
                    <app-dropdown-select
                      class="amount-currency-badge"
                      variant="badge"
                      [options]="currencyDropdownOptions"
                      formControlName="currency"
                    ></app-dropdown-select>
                  </div>
                </div>
              </div>
              <div class="form-actions">
                <button type="button" class="btn-secondary" (click)="closeAddModal()">
                  {{ 'common.cancel' | transloco }}
                </button>
                <button type="submit" class="btn-primary" [disabled]="form.invalid">
                  {{ (editingWatchId() ? 'common.save' : 'flightWatch.addWatch') | transloco }}
                </button>
              </div>
            </div>
          </form>
        </div>
      }

      <div class="page-scroll">
        @if (watches().length === 0) {
          <div class="empty-state">
            <p>{{ 'flightWatch.noWatches' | transloco }}</p>
          </div>
        }
        <div class="items-list">
          @for (watch of watches(); track watch.id) {
            <div class="item-card card" (click)="openEditModal(watch)">
              <div class="item-main">
                <div class="item-info">
                  <div class="item-title">{{ watch.origin }} → {{ watch.destination }}</div>
                  <div class="item-desc">
                    {{ watch.depart_date }}
                    @if (watch.return_date) {
                      ～ {{ watch.return_date }}
                    }
                  </div>
                  @if (watch.target_price) {
                    <div class="item-desc">
                      {{ 'flightWatch.targetPrice' | transloco }}：{{
                        watch.target_price | number: '1.0-0'
                      }}
                      {{ watch.currency }}
                    </div>
                  }
                </div>
                <div class="item-price">
                  @if (checking() === watch.id) {
                    <div class="amount">{{ 'flightWatch.checking' | transloco }}</div>
                  } @else if (priceRange(watch.id); as range) {
                    <div class="price-range-row">
                      <span
                        class="amount"
                        [class.below-target]="
                          watch.target_price != null && range.min.price <= watch.target_price
                        "
                      >
                        {{ range.min.price | number: '1.0-0' }} {{ watch.currency }}
                      </span>
                      <span class="price-range-carrier">{{ range.min.carriers.join('、') }}</span>
                    </div>
                    @if (range.max.price !== range.min.price) {
                      <div class="price-range-row">
                        <span class="amount-secondary">
                          {{ range.max.price | number: '1.0-0' }} {{ watch.currency }}
                        </span>
                        <span class="price-range-carrier">{{ range.max.carriers.join('、') }}</span>
                      </div>
                    }
                    <div class="amount-checked">{{ formatCheckedAt(watch.last_checked_at) }}</div>
                  } @else if (watch.last_price !== null) {
                    <div
                      class="amount"
                      [class.below-target]="
                        watch.target_price != null && watch.last_price <= watch.target_price
                      "
                    >
                      {{ watch.last_price | number: '1.0-0' }} {{ watch.currency }}
                    </div>
                    <div class="amount-checked">{{ formatCheckedAt(watch.last_checked_at) }}</div>
                  } @else {
                    <div class="amount-unavailable">
                      {{ 'flightWatch.priceUnavailable' | transloco }}
                    </div>
                  }
                </div>
              </div>
              <div class="item-actions">
                <button
                  class="detail-btn"
                  type="button"
                  (click)="openDetailModal(watch); $event.stopPropagation()"
                >
                  {{ 'flightWatch.viewDetails' | transloco }}
                </button>
                <button
                  class="refresh-btn"
                  type="button"
                  (click)="recheck(watch); $event.stopPropagation()"
                  [disabled]="checking() === watch.id"
                >
                  🔄 {{ 'flightWatch.recheck' | transloco }}
                </button>
                <button
                  class="remove-btn"
                  type="button"
                  (click)="deleteWatch(watch.id); $event.stopPropagation()"
                >
                  {{ 'flightWatch.delete' | transloco }}
                </button>
              </div>
            </div>
          }
        </div>
      </div>

      @if (detailWatch(); as dw) {
        <div class="modal-backdrop" (click)="closeDetailModal()">
          <div class="modal-card detail-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <span class="header-spacer" aria-hidden="true"></span>
              <h3 class="modal-title">{{ dw.origin }} → {{ dw.destination }}</h3>
              <button
                type="button"
                class="close-x-btn"
                [attr.aria-label]="'common.close' | transloco"
                (click)="closeDetailModal()"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="detail-modal-scroll">
              @if (loadingItineraries()) {
                <p class="detail-status">{{ 'flightWatch.loadingDetails' | transloco }}</p>
              } @else if (filteredItineraries().length === 0) {
                <p class="detail-status">{{ 'flightWatch.noDetails' | transloco }}</p>
              } @else {
                <div class="itinerary-list">
                  @for (it of filteredItineraries(); track $index) {
                    <div
                      class="boarding-pass"
                      [class.selected]="selectedItinerary() === it"
                      (click)="selectItinerary(it)"
                    >
                      <div class="boarding-pass-header">
                        <span class="boarding-pass-carriers">{{ it.carriers.join('、') }}</span>
                        <span class="boarding-pass-price">{{ it.priceLabel }}</span>
                      </div>
                      <div class="boarding-pass-divider"></div>
                      <div class="boarding-pass-legs">
                        @for (leg of it.legs; track $index) {
                          <div class="itinerary-leg-block">
                            <div class="itinerary-leg">
                              <span class="leg-route">{{ leg.from }} → {{ leg.to }}</span>
                              <span class="leg-time"
                                >{{ formatLegTime(leg.dep) }} - {{ formatLegTime(leg.arr) }}</span
                              >
                              <span class="leg-duration">{{ formatDuration(leg.durMin) }}</span>
                              <span class="leg-stops">{{
                                (leg.stops === 0 ? 'flightWatch.direct' : 'flightWatch.viaStops')
                                  | transloco: { count: leg.stops }
                              }}</span>
                            </div>
                            @if (legConnections(leg).length > 0) {
                              <div class="leg-connections">
                                @for (conn of legConnections(leg); track $index) {
                                  <div class="leg-connection">
                                    {{
                                      'flightWatch.transferDetail'
                                        | transloco
                                          : {
                                              airport: conn.airport,
                                              duration: formatDuration(conn.waitMin),
                                            }
                                    }}
                                  </div>
                                }
                              </div>
                            }
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }

      @if (showImportModal()) {
        @if (selectedItinerary(); as sel) {
          <div class="modal-backdrop import-backdrop" (click)="closeImportModal()">
            <div
              class="modal-card import-modal modal-card-compact"
              (click)="$event.stopPropagation()"
            >
              @if (importSuccess()) {
                <p class="import-success">{{ 'flightWatch.importSuccess' | transloco }}</p>
              } @else {
                <h3 class="modal-title">{{ 'flightWatch.importToTrip' | transloco }}</h3>
                <app-dropdown-select
                  [options]="tripDropdownOptions()"
                  [ngModel]="importTargetTripId()"
                  (ngModelChange)="importTargetTripId.set($event)"
                  name="importTargetTrip"
                  [placeholder]="'flightWatch.selectTrip' | transloco"
                ></app-dropdown-select>
                <div class="form-actions">
                  <button type="button" class="btn-secondary" (click)="closeImportModal()">
                    {{ 'common.cancel' | transloco }}
                  </button>
                  <button
                    type="button"
                    class="btn-primary"
                    [disabled]="!importTargetTripId() || importing()"
                    (click)="confirmImport(sel)"
                  >
                    {{ 'common.confirm' | transloco }}
                  </button>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 900px;
        width: 100%;
        margin: 0 auto;
        padding: 1.5rem;
        background: var(--bg);
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-sizing: border-box;
      }
      .page-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .page-scroll::-webkit-scrollbar {
        display: none;
      }
      .page-header {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        flex-shrink: 0;
        /* 網頁版：跟「行程」頁面右側預留寬度一致，手機版在 @media (max-width: 600px) 內重設為 0 */
        margin-right: 100px;
      }
      .header-mid {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        flex-wrap: wrap;
      }
      h1 {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }
      .add-trigger {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: var(--icon-bg);
        color: var(--accent);
        font-size: 1.2rem;
        cursor: pointer;
      }

      .card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 4px 20px var(--shadow);
        margin-bottom: 1rem;
      }
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .form-row label {
        display: block;
        font-weight: 500;
        margin-bottom: 0.35rem;
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      .form-row input {
        width: 100%;
        padding: 0.625rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 1rem;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      .amount-input-wrap {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        height: 3rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        padding: 0 0.5rem 0 0.875rem;
        box-sizing: border-box;
        background: var(--input-bg);
      }
      input.amount-input-lg,
      input.amount-input-lg:hover,
      input.amount-input-lg:focus,
      input.amount-input-lg:focus-visible {
        flex: 1;
        min-width: 0;
        width: auto;
        height: 100%;
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: textfield;
        padding: 0 !important;
        text-indent: 0 !important;
        background: transparent;
        font-size: 1.1rem;
        color: var(--text-primary);
      }
      .amount-currency-badge {
        flex-shrink: 0;
      }
      .span-2 {
        grid-column: 1 / -1;
      }
      .route-row {
        display: flex;
        align-items: flex-end;
        gap: 0.5rem;
      }
      .autocomplete-field {
        flex: 1;
        min-width: 0;
        position: relative;
      }
      .autocomplete-field input {
        padding: 0.75rem 1rem;
        font-size: 1.05rem;
        border-radius: 12px;
      }
      .swap-route-btn {
        flex-shrink: 0;
        align-self: flex-end;
        margin-bottom: 9px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        background: var(--accent);
        color: #fff;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .suggestion-list {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        box-shadow: 0 8px 24px var(--shadow);
        max-height: 220px;
        overflow-y: auto;
        z-index: 50;
        scrollbar-width: none;
      }
      .suggestion-list::-webkit-scrollbar {
        display: none;
      }
      .suggestion-item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
      }
      .suggestion-item:hover {
        background: var(--accent-light);
      }
      .suggestion-city {
        font-size: 0.9rem;
        color: var(--text-primary);
        font-weight: 600;
      }
      .suggestion-meta {
        font-size: 0.75rem;
        color: var(--text-secondary);
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
      .btn-secondary {
        background: var(--accent-light);
        color: var(--text-secondary);
        border: none;
        border-radius: 10px;
        padding: 0.625rem 1.5rem;
        cursor: pointer;
      }
      .form-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 200;
        padding: 1rem;
      }
      .modal-card {
        max-width: 460px;
        width: 100%;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .scale-wrap {
        width: 100%;
        transform-origin: center center;
      }

      .empty-state {
        text-align: center;
        padding: 4rem 2rem;
        color: var(--text-secondary);
        font-size: 1.1rem;
      }
      .items-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        /* 網頁版：跟「行程」頁面右側預留寬度一致，手機版在 @media (max-width: 600px) 內重設為 0 */
        margin-right: 100px;
      }
      @media (max-width: 600px) {
        .page-header,
        .items-list {
          margin-right: 0;
        }
      }
      .item-card.card {
        padding: 1rem 1.25rem;
        cursor: pointer;
      }
      .modal-title {
        margin: 0 0 1rem;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text-primary);
      }
      .item-main {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.75rem;
      }
      .item-title {
        font-weight: 700;
        font-size: 1.1rem;
        color: var(--text-primary);
      }
      .item-desc {
        font-size: 0.85rem;
        color: var(--text-secondary);
        margin-top: 0.2rem;
      }
      .item-price {
        text-align: right;
        flex-shrink: 0;
      }
      .amount {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        color: var(--text-primary);
        font-size: 1.15rem;
      }
      .amount.below-target {
        color: #48bb78;
      }
      .amount-secondary {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        color: var(--text-secondary);
        font-size: 0.95rem;
      }
      .price-range-row {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .price-range-row + .price-range-row {
        margin-top: 0.3rem;
      }
      .price-range-carrier {
        font-size: 0.72rem;
        color: var(--text-secondary);
        margin-top: 0.1rem;
        max-width: 180px;
        text-align: right;
        overflow-wrap: break-word;
      }
      .amount-checked {
        font-size: 0.72rem;
        color: var(--text-secondary);
        margin-top: 0.3rem;
      }
      .amount-unavailable {
        font-size: 0.85rem;
        color: var(--text-secondary);
      }
      .item-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .refresh-btn {
        cursor: pointer;
        color: var(--accent);
        font-size: 0.875rem;
        padding: 0.375rem 0.875rem;
        border: 1.5px solid var(--accent);
        border-radius: 8px;
        background: transparent;
      }
      .refresh-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .remove-btn {
        background: none;
        border: none;
        color: #e53e3e;
        cursor: pointer;
        font-size: 0.875rem;
        margin-left: auto;
      }
      .detail-btn {
        cursor: pointer;
        color: var(--text-secondary);
        font-size: 0.875rem;
        padding: 0.375rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 8px;
        background: transparent;
      }
      .detail-modal {
        max-width: 480px;
        max-height: 85vh;
        overflow: visible;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        background: transparent;
        box-shadow: none;
      }
      .detail-modal-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        padding: 0 1.25rem 1.25rem;
      }
      .detail-modal-scroll::-webkit-scrollbar {
        display: none;
      }
      .detail-modal .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        flex-shrink: 0;
        width: 100%;
        box-sizing: border-box;
        padding: 0.9rem 1.25rem;
        background: var(--surface);
        box-shadow: 0 4px 16px var(--shadow);
        border-radius: 16px 16px 0 0;
        z-index: 1;
      }
      .detail-modal .header-spacer {
        width: 28px;
        flex-shrink: 0;
      }
      .detail-modal .modal-title {
        flex: 1;
        min-width: 0;
        margin: 0;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .detail-modal .close-x-btn {
        flex-shrink: 0;
      }
      .close-x-btn {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: var(--icon-bg);
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .close-x-btn:hover {
        background: var(--icon-bg-hover);
      }
      .detail-status {
        color: var(--text-secondary);
        font-size: 0.9rem;
        text-align: center;
        padding: 2rem 0;
      }
      .itinerary-list {
        background: transparent;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding-top: 0.25rem;
      }
      .boarding-pass {
        position: relative;
        max-width: 100%;
        box-sizing: border-box;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 14px;
        box-shadow: 0 6px 18px var(--shadow);
        overflow: hidden;
        cursor: pointer;
        transition:
          border-color 0.15s,
          box-shadow 0.15s,
          transform 0.1s;
        /* 手機版預設點擊會出現一層半透明白色高亮，蓋住整張卡片看起來像「背景變全白」，
           比照「行程」頁登機證卡片（trips-list.component.ts .trip-card）關閉這個預設效果 */
        -webkit-tap-highlight-color: transparent;
      }
      .boarding-pass:active {
        transform: scale(0.98);
      }
      /* 登機證右側中間的圓形撕票缺口，做法參考「行程」頁登機證卡片（trips-list.component.ts .trip-card::after）：
         缺口顏色需對齊此彈窗的背景（半透明遮罩），才能呈現「咬出一個洞」的效果 */
      .boarding-pass::after {
        content: '';
        position: absolute;
        right: -15px;
        top: 50%;
        transform: translateY(-50%);
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.45);
        z-index: 2;
        pointer-events: none;
      }
      .boarding-pass.selected {
        border-color: var(--accent);
        box-shadow: 0 6px 18px var(--accent-light);
      }
      .boarding-pass-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.2rem;
        padding: 0.9rem 1rem 0.7rem;
      }
      .boarding-pass-carriers {
        font-weight: 600;
        color: var(--text-primary);
        font-size: 0.9rem;
        overflow-wrap: break-word;
      }
      .boarding-pass-price {
        font-family: var(--font-mono);
        font-weight: 700;
        color: var(--accent);
        font-size: 1.05rem;
      }
      .boarding-pass-divider {
        position: relative;
        height: 0;
        border-top: 2px dashed var(--border);
        margin: 0 0.5rem;
      }
      .boarding-pass-divider::before,
      .boarding-pass-divider::after {
        content: '';
        position: absolute;
        top: -8px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--surface);
      }
      .boarding-pass-divider::before {
        left: -8px;
      }
      .boarding-pass-divider::after {
        right: -8px;
      }
      .boarding-pass-legs {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.7rem 1rem 0.9rem;
      }
      .import-success {
        color: #48bb78;
        font-weight: 600;
        text-align: center;
        margin: 0;
      }
      .itinerary-leg-block {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        max-width: 100%;
      }
      .itinerary-leg {
        display: flex;
        flex-wrap: wrap;
        gap: 0.2rem 0.5rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
        max-width: 100%;
      }
      .leg-route {
        font-weight: 600;
        color: var(--text-primary);
      }
      .leg-time,
      .leg-duration,
      .leg-stops {
        white-space: nowrap;
      }
      .leg-connections {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        padding-left: 0.75rem;
        border-left: 2px solid var(--border);
      }
      .leg-connection {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      @media (max-width: 480px) {
        .itinerary-leg {
          flex-direction: column;
          gap: 0.1rem;
        }
      }
      .import-modal {
        max-width: 420px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        background: var(--surface);
        border-radius: 16px;
        box-shadow: 0 12px 40px var(--shadow);
        padding: 1.5rem;
      }
      .import-backdrop {
        z-index: 210;
      }
    `,
  ],
})
export class FlightWatchComponent implements OnInit {
  @ViewChild('scaleWrap') scaleWrap?: ElementRef<HTMLElement>;

  private flightWatchService = inject(FlightWatchService);
  private flightPriceService = inject(FlightPriceService);
  private auth = inject(AuthService);
  private tripService = inject(TripService);
  private fb = inject(FormBuilder);
  private pref = inject(PreferenceService);
  private transloco = inject(TranslocoService);
  private router = inject(Router);

  private static readonly NEW_TRIP_VALUE = '__new__';

  watches = signal<FlightWatch[]>([]);
  showAddModal = signal(false);
  checking = signal<string | null>(null);
  /** 各追蹤路線目前查到的最低/最高價航班（僅存於記憶體，重整頁面或當日已檢查過則需回退顯示 last_price） */
  priceRanges = signal<Map<string, { min: FlightItinerary; max: FlightItinerary }>>(new Map());
  /** 非 null 時代表目前彈窗是在編輯這筆既有追蹤，而不是新增 */
  editingWatchId = signal<string | null>(null);
  detailWatch = signal<FlightWatch | null>(null);
  itineraries = signal<FlightItinerary[]>([]);
  /** 依目前追蹤路線設定的「轉機次數」篩選後的明細清單 */
  filteredItineraries = computed(() => {
    const watch = this.detailWatch();
    const list = this.itineraries();
    if (!watch || watch.max_stops === 'any') return list;
    return list.filter((it) =>
      it.legs.every((leg) => this.stopsMatchesFilter(leg.stops, watch.max_stops)),
    );
  });
  loadingItineraries = signal(false);
  myTrips = signal<Trip[]>([]);
  selectedItinerary = signal<FlightItinerary | null>(null);
  showImportModal = signal(false);
  importTargetTripId = signal('');
  importing = signal(false);
  importSuccess = signal(false);

  tripDropdownOptions(): { value: string; label: string }[] {
    return [
      ...this.myTrips().map((t) => ({ value: t.id, label: t.title })),
      {
        value: FlightWatchComponent.NEW_TRIP_VALUE,
        label: this.transloco.translate('trips.create'),
      },
    ];
  }

  currencyDropdownOptions = CURRENCY_CODES.map((c) => ({ value: c, label: c }));

  maxStopsDropdownOptions(): { value: FlightMaxStops; label: string }[] {
    return (['any', 'direct', 'one', 'twoPlus'] as FlightMaxStops[]).map((value) => ({
      value,
      label: this.transloco.translate(`flightWatch.maxStops.${value}`),
    }));
  }

  originQuery = signal('');
  destinationQuery = signal('');
  originFocused = signal(false);
  destinationFocused = signal(false);

  originSuggestions = computed(() => this.filterAirports(this.originQuery()));
  destinationSuggestions = computed(() => this.filterAirports(this.destinationQuery()));

  form = this.fb.group({
    origin: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    destination: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    depart_date: [this.todayDateString(), Validators.required],
    return_date: [this.todayDateString()],
    max_stops: ['any' as FlightMaxStops],
    target_price: [null as number | null],
    currency: ['TWD', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
  });

  private todayDateString(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async ngOnInit(): Promise<void> {
    this.form.patchValue({ currency: this.pref.homeCountry().currency });
    this.form.get('depart_date')?.valueChanges.subscribe((value) => {
      if (value) this.form.patchValue({ return_date: value }, { emitEvent: false });
    });
    await this.loadWatches();
    for (const watch of this.watches()) {
      this.flightPriceService.refreshIfNeeded(watch).then((itineraries) => {
        if (itineraries) this.setPriceRange(watch.id, itineraries);
        this.loadWatches();
      });
    }
  }

  /** 依查到的明細清單計算最低/最高價，更新對應追蹤路線的顯示用快取（僅存於記憶體） */
  private setPriceRange(watchId: string, itineraries: FlightItinerary[]): void {
    if (itineraries.length === 0) return;
    let min = itineraries[0];
    let max = itineraries[0];
    for (const it of itineraries) {
      if (it.price < min.price) min = it;
      if (it.price > max.price) max = it;
    }
    const next = new Map(this.priceRanges());
    next.set(watchId, { min, max });
    this.priceRanges.set(next);
  }

  priceRange(watchId: string): { min: FlightItinerary; max: FlightItinerary } | undefined {
    return this.priceRanges().get(watchId);
  }

  private get ownerId(): string {
    return this.auth.user()!.id;
  }

  async loadWatches(): Promise<void> {
    this.watches.set(await this.flightWatchService.getAll(this.ownerId));
  }

  openAddModal(): void {
    this.editingWatchId.set(null);
    this.showAddModal.set(true);
    setTimeout(() => this.applyScale());
  }

  openEditModal(watch: FlightWatch): void {
    this.editingWatchId.set(watch.id);
    this.form.reset({
      origin: watch.origin,
      destination: watch.destination,
      depart_date: watch.depart_date,
      return_date: watch.return_date ?? watch.depart_date,
      max_stops: watch.max_stops,
      target_price: watch.target_price,
      currency: watch.currency,
    });
    this.originQuery.set(this.airportLabel(watch.origin));
    this.destinationQuery.set(this.airportLabel(watch.destination));
    this.originFocused.set(false);
    this.destinationFocused.set(false);
    this.showAddModal.set(true);
    setTimeout(() => this.applyScale());
  }

  private airportLabel(code: string): string {
    const a = AIRPORTS.find((x) => x.code === code);
    return a ? `${a.city} (${a.code})` : code;
  }

  @HostListener('window:resize')
  applyScale(): void {
    const el = this.scaleWrap?.nativeElement;
    if (!el || !el.parentElement) return;
    el.style.transform = 'none';
    const contentH = el.scrollHeight;
    const contentW = el.scrollWidth;
    const availH = el.parentElement.clientHeight;
    const availW = el.parentElement.clientWidth;
    if (!contentH || !contentW) return;
    const scale = Math.min(1, availH / contentH, availW / contentW);
    el.style.transform = scale < 1 ? `scale(${scale})` : 'none';
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.editingWatchId.set(null);
    this.form.reset({
      currency: this.pref.homeCountry().currency,
      max_stops: 'any',
      depart_date: this.todayDateString(),
      return_date: this.todayDateString(),
    });
    this.originQuery.set('');
    this.destinationQuery.set('');
    this.originFocused.set(false);
    this.destinationFocused.set(false);
  }

  private filterAirports(query: string): Airport[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return AIRPORTS.filter(
      (a) =>
        a.city.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q),
    ).slice(0, 8);
  }

  onOriginQueryChange(value: string): void {
    this.originQuery.set(value);
    if (this.form.get('origin')?.value) this.form.patchValue({ origin: '' });
  }

  onDestinationQueryChange(value: string): void {
    this.destinationQuery.set(value);
    if (this.form.get('destination')?.value) this.form.patchValue({ destination: '' });
  }

  selectOrigin(a: Airport): void {
    this.form.patchValue({ origin: a.code });
    this.originQuery.set(`${a.city} (${a.code})`);
    this.originFocused.set(false);
  }

  selectDestination(a: Airport): void {
    this.form.patchValue({ destination: a.code });
    this.destinationQuery.set(`${a.city} (${a.code})`);
    this.destinationFocused.set(false);
  }

  onOriginBlur(): void {
    setTimeout(() => this.originFocused.set(false), 150);
  }

  onDestinationBlur(): void {
    setTimeout(() => this.destinationFocused.set(false), 150);
  }

  swapRoute(): void {
    const origin = this.form.get('origin')?.value ?? '';
    const destination = this.form.get('destination')?.value ?? '';
    this.form.patchValue({ origin: destination, destination: origin });
    const oq = this.originQuery();
    this.originQuery.set(this.destinationQuery());
    this.destinationQuery.set(oq);
  }

  async submitWatch(): Promise<void> {
    const editingId = this.editingWatchId();
    if (editingId) {
      await this.updateWatch(editingId);
    } else {
      await this.addWatch();
    }
  }

  private async updateWatch(id: string): Promise<void> {
    if (this.form.invalid) return;
    const v = this.form.value;
    await this.flightWatchService.update(id, {
      origin: v.origin!.toUpperCase(),
      destination: v.destination!.toUpperCase(),
      depart_date: v.depart_date!,
      return_date: v.return_date || null,
      max_stops: v.max_stops!,
      target_price: v.target_price ? Number(v.target_price) : null,
      currency: v.currency!.toUpperCase(),
    });
    this.closeAddModal();
    await this.loadWatches();
    const watch = this.watches().find((w) => w.id === id);
    if (watch) {
      this.checking.set(id);
      const { price, itineraries } = await this.flightPriceService.checkItinerariesWithPrice(watch);
      await this.flightWatchService.update(id, {
        last_price: price,
        last_checked_at: new Date().toISOString(),
      });
      this.setPriceRange(id, itineraries);
      this.checking.set(null);
      await this.loadWatches();
    }
  }

  private async addWatch(): Promise<void> {
    if (this.form.invalid) return;
    const v = this.form.value;
    const created = await this.flightWatchService.create({
      owner_id: this.ownerId,
      origin: v.origin!.toUpperCase(),
      destination: v.destination!.toUpperCase(),
      depart_date: v.depart_date!,
      return_date: v.return_date || null,
      max_stops: v.max_stops!,
      target_price: v.target_price ? Number(v.target_price) : null,
      currency: v.currency!.toUpperCase(),
    });
    this.closeAddModal();
    await this.loadWatches();
    this.checking.set(created.id);
    const itineraries = await this.flightPriceService.refreshIfNeeded(created);
    if (itineraries) this.setPriceRange(created.id, itineraries);
    this.checking.set(null);
    await this.loadWatches();
  }

  async recheck(watch: FlightWatch): Promise<void> {
    this.checking.set(watch.id);
    const { price, itineraries } = await this.flightPriceService.checkItinerariesWithPrice(watch);
    await this.flightWatchService.update(watch.id, {
      last_price: price,
      last_checked_at: new Date().toISOString(),
    });
    this.setPriceRange(watch.id, itineraries);
    this.checking.set(null);
    await this.loadWatches();
  }

  async deleteWatch(id: string): Promise<void> {
    await this.flightWatchService.delete(id);
    await this.loadWatches();
  }

  formatCheckedAt(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  async openDetailModal(watch: FlightWatch): Promise<void> {
    this.detailWatch.set(watch);
    this.itineraries.set([]);
    this.selectedItinerary.set(null);
    this.showImportModal.set(false);
    this.importTargetTripId.set('');
    this.importSuccess.set(false);
    this.loadingItineraries.set(true);
    try {
      const [results, trips] = await Promise.all([
        this.flightPriceService.checkItineraries(watch),
        this.tripService.getAll(),
      ]);
      this.itineraries.set(results);
      this.myTrips.set(trips);
    } finally {
      this.loadingItineraries.set(false);
    }
  }

  closeDetailModal(): void {
    this.detailWatch.set(null);
    this.itineraries.set([]);
    this.selectedItinerary.set(null);
    this.showImportModal.set(false);
    this.importTargetTripId.set('');
    this.importSuccess.set(false);
  }

  selectItinerary(it: FlightItinerary): void {
    this.selectedItinerary.set(it);
    this.importTargetTripId.set('');
    this.importSuccess.set(false);
    this.showImportModal.set(true);
  }

  closeImportModal(): void {
    this.showImportModal.set(false);
    this.selectedItinerary.set(null);
    this.importTargetTripId.set('');
    this.importSuccess.set(false);
  }

  private countryInfoForAirport(code: string): { timezone: string; currency: string } | undefined {
    return AIRPORT_TZ_CURRENCY[code];
  }

  /** 單一航段的轉機次數是否符合追蹤路線設定的篩選條件 */
  private stopsMatchesFilter(stops: number, filter: FlightMaxStops): boolean {
    switch (filter) {
      case 'direct':
        return stops === 0;
      case 'one':
        return stops === 1;
      case 'twoPlus':
        return stops >= 2;
      default:
        return true;
    }
  }

  /** 產生預設行程名稱，若已有同名行程則加上流水號（新行程、新行程2、新行程3...） */
  private generateDefaultTripTitle(): string {
    const base = this.transloco.translate('flightWatch.defaultTripTitle');
    const existingTitles = new Set(this.myTrips().map((t) => t.title));
    if (!existingTitles.has(base)) return base;
    let n = 2;
    while (existingTitles.has(`${base}${n}`)) n++;
    return `${base}${n}`;
  }

  async confirmImport(it: FlightItinerary): Promise<void> {
    const selectedValue = this.importTargetTripId();
    if (!selectedValue) return;
    this.importing.set(true);
    try {
      const outbound = it.legs[0];
      const inbound = it.legs[1];
      const countryInfo = outbound ? this.countryInfoForAirport(outbound.to) : undefined;
      const tripPatch = {
        ...(outbound ? { start_date_utc: new Date(outbound.dep).toISOString() } : {}),
        ...(inbound
          ? { end_date_utc: new Date(inbound.arr).toISOString() }
          : outbound
            ? { end_date_utc: new Date(outbound.arr).toISOString() }
            : {}),
        ...(countryInfo?.timezone ? { target_timezone: countryInfo.timezone } : {}),
        ...(countryInfo?.currency ? { base_currency: countryInfo.currency } : {}),
      };

      let targetTripId = selectedValue;
      if (selectedValue === FlightWatchComponent.NEW_TRIP_VALUE) {
        const created = await this.tripService.create({
          title: this.generateDefaultTripTitle(),
          target_timezone: countryInfo?.timezone ?? this.pref.homeCountry().timezone,
          base_currency: countryInfo?.currency ?? this.pref.homeCountry().currency,
          ...tripPatch,
        });
        targetTripId = created.id;
      } else {
        await this.tripService.update(selectedValue, tripPatch);
      }
      this.importSuccess.set(true);
      setTimeout(() => {
        this.closeDetailModal();
        this.router.navigate(['/trips', targetTripId]);
      }, 800);
    } finally {
      this.importing.set(false);
    }
  }

  formatLegTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  formatDuration(durMin: number): string {
    const h = Math.floor(durMin / 60);
    const m = durMin % 60;
    return `${h}h${String(m).padStart(2, '0')}m`;
  }

  /** 依航段明細算出每個轉機點的機場與等待時間（相鄰兩航段的抵達/起飛時間差） */
  legConnections(leg: FlightItineraryLeg): { airport: string; waitMin: number }[] {
    const segments = leg.segments;
    if (!segments || segments.length < 2) return [];
    const connections: { airport: string; waitMin: number }[] = [];
    for (let i = 0; i < segments.length - 1; i++) {
      const arrTime = new Date(segments[i].arr).getTime();
      const depTime = new Date(segments[i + 1].dep).getTime();
      const waitMin = Math.max(0, Math.round((depTime - arrTime) / 60000));
      connections.push({ airport: segments[i].to, waitMin });
    }
    return connections;
  }
}
