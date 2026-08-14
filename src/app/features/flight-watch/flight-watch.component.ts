import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { FlightWatch } from '../../core/models';
import { FlightWatchService } from '../../core/services/flight-watch.service';
import { FlightPriceService } from '../../core/services/flight-price.service';
import { AuthService } from '../../core/services/auth.service';
import { PreferenceService } from '../../core/services/preference.service';
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
        <button class="btn-icon add-trigger" type="button" (click)="showAddModal.set(true)">
          ＋
        </button>
      </header>

      @if (showAddModal()) {
        <div class="modal-backdrop" (click)="closeAddModal()">
          <form
            [formGroup]="form"
            (ngSubmit)="addWatch()"
            class="card add-form modal-card modal-card-compact"
            (click)="$event.stopPropagation()"
          >
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
                <label>{{ 'flightWatch.targetPrice' | transloco }}</label>
                <div class="amount-input-wrap">
                  <input
                    formControlName="target_price"
                    type="text"
                    inputmode="decimal"
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
                {{ 'flightWatch.addWatch' | transloco }}
              </button>
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
            <div class="item-card card">
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
                  class="refresh-btn"
                  type="button"
                  (click)="recheck(watch)"
                  [disabled]="checking() === watch.id"
                >
                  🔄 {{ 'flightWatch.recheck' | transloco }}
                </button>
                <button class="remove-btn" type="button" (click)="deleteWatch(watch.id)">
                  {{ 'flightWatch.delete' | transloco }}
                </button>
              </div>
            </div>
          }
        </div>
      </div>
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
        padding: 0;
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
        overflow-y: auto;
        scrollbar-width: none;
      }
      .modal-card::-webkit-scrollbar {
        display: none;
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
      }
      .item-card.card {
        padding: 1rem 1.25rem;
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
      .amount-checked {
        font-size: 0.72rem;
        color: var(--text-secondary);
        margin-top: 0.15rem;
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
    `,
  ],
})
export class FlightWatchComponent implements OnInit {
  private flightWatchService = inject(FlightWatchService);
  private flightPriceService = inject(FlightPriceService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private pref = inject(PreferenceService);

  watches = signal<FlightWatch[]>([]);
  showAddModal = signal(false);
  checking = signal<string | null>(null);

  currencyDropdownOptions = CURRENCY_CODES.map((c) => ({ value: c, label: c }));

  originQuery = signal('');
  destinationQuery = signal('');
  originFocused = signal(false);
  destinationFocused = signal(false);

  originSuggestions = computed(() => this.filterAirports(this.originQuery()));
  destinationSuggestions = computed(() => this.filterAirports(this.destinationQuery()));

  form = this.fb.group({
    origin: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    destination: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    depart_date: ['', Validators.required],
    return_date: [''],
    target_price: [null as number | null],
    currency: ['TWD', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
  });

  async ngOnInit(): Promise<void> {
    this.form.patchValue({ currency: this.pref.homeCountry().currency });
    await this.loadWatches();
    for (const watch of this.watches()) {
      this.flightPriceService.refreshIfNeeded(watch).then(() => this.loadWatches());
    }
  }

  private get ownerId(): string {
    return this.auth.user()!.id;
  }

  async loadWatches(): Promise<void> {
    this.watches.set(await this.flightWatchService.getAll(this.ownerId));
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.form.reset({ currency: this.pref.homeCountry().currency });
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

  async addWatch(): Promise<void> {
    if (this.form.invalid) return;
    const v = this.form.value;
    const created = await this.flightWatchService.create({
      owner_id: this.ownerId,
      origin: v.origin!.toUpperCase(),
      destination: v.destination!.toUpperCase(),
      depart_date: v.depart_date!,
      return_date: v.return_date || null,
      target_price: v.target_price ? Number(v.target_price) : null,
      currency: v.currency!.toUpperCase(),
    });
    this.closeAddModal();
    await this.loadWatches();
    this.checking.set(created.id);
    await this.flightPriceService.refreshIfNeeded(created);
    this.checking.set(null);
    await this.loadWatches();
  }

  async recheck(watch: FlightWatch): Promise<void> {
    this.checking.set(watch.id);
    const price = await this.flightPriceService.checkPrice(watch);
    await this.flightWatchService.update(watch.id, {
      last_price: price,
      last_checked_at: new Date().toISOString(),
    });
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
}
