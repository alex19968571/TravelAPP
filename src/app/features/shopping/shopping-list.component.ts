import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ShoppingItem } from '../../core/models';
import { ShoppingService } from '../../core/services/shopping.service';
import { SyncEngineService } from '../../core/services/sync-engine.service';
import { PreferenceService } from '../../core/services/preference.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, DecimalPipe, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a [routerLink]="['/trips', tripId]" class="back-btn">{{
          'shopping.backToTrip' | transloco
        }}</a>
        <div class="header-mid">
          <h1>🛍️ {{ 'shopping.title' | transloco }}</h1>
          <div class="currency-indicator">
            <span class="fi fi-{{ pref.countryCode().toLowerCase() }}"></span>
            {{ destCurrency() }}
          </div>
        </div>
        <div class="summary">
          <div class="summary-main">
            {{ 'shopping.total' | transloco }}
            <strong>{{ totalAmount() | number: '1.0-0' }}</strong> {{ destCurrency() }} ({{
              boughtCount()
            }}/{{ items().length }})
          </div>
          @if (showConversion()) {
            <div class="summary-converted">
              ≈ {{ totalAmount() * convRate() | number: '1.0-0' }} {{ homeCurrency() }}
            </div>
          }
        </div>
      </header>

      <!-- 新增表單 -->
      <form [formGroup]="form" (ngSubmit)="addItem()" class="card add-form">
        <div class="form-grid">
          <div class="form-row span-2">
            <label>{{ 'shopping.itemName' | transloco }} *</label>
            <input
              formControlName="title"
              [placeholder]="'shopping.itemNamePlaceholder' | transloco"
            />
          </div>
          <div class="form-row">
            <label>{{ 'shopping.quantity' | transloco }}</label>
            <input formControlName="quantity" type="number" min="1" />
          </div>

          <!-- 雙欄單價 -->
          <div class="form-row">
            <label>{{ 'shopping.unitPrice' | transloco }}</label>
            <div class="dual-price-row">
              <div class="price-col">
                <span class="currency-label">{{ destCurrency() }}</span>
                <input formControlName="unit_price" type="number" min="0" step="any" />
              </div>
              @if (showConversion()) {
                <button
                  type="button"
                  class="convert-btn"
                  (click)="convertUnitPrice()"
                  title="換算成 {{ homeCurrency() }}"
                >
                  ⇄
                </button>
                <div class="price-col">
                  <span class="currency-label">{{ homeCurrency() }}</span>
                  <input
                    type="number"
                    [value]="unitPriceHome() ?? ''"
                    readonly
                    class="readonly-input"
                    placeholder="—"
                  />
                </div>
              }
            </div>
          </div>

          <div class="form-row span-2">
            <label>{{ 'shopping.note' | transloco }}</label>
            <input
              formControlName="description"
              [placeholder]="'shopping.notePlaceholder' | transloco"
            />
          </div>
          <div class="form-row span-2">
            <label>{{ 'shopping.link' | transloco }}</label>
            <input
              formControlName="item_url"
              [placeholder]="'shopping.linkPlaceholder' | transloco"
            />
          </div>
        </div>

        <div class="form-total">
          <span
            >{{ 'shopping.subtotal' | transloco }}：<strong>{{
              formTotal() | number: '1.0-0'
            }}</strong>
            {{ destCurrency() }}</span
          >
          @if (showConversion() && formTotal() > 0) {
            <span class="sub-converted"
              >≈ {{ formTotal() * convRate() | number: '1.0-0' }} {{ homeCurrency() }}</span
            >
          }
        </div>
        <button type="submit" class="btn-primary" [disabled]="form.invalid">
          {{ 'shopping.addItem' | transloco }}
        </button>
      </form>

      <!-- 清單 -->
      <div class="items-list">
        @for (item of items(); track item.client_record_id) {
          <div class="item-card card" [class.bought]="item.is_bought">
            <div class="item-main">
              <input
                type="checkbox"
                [checked]="item.is_bought"
                (change)="toggleBought(item)"
                class="checkbox"
              />
              <div class="item-info">
                <div class="item-title">{{ item.title }}</div>
                @if (item.description) {
                  <div class="item-desc">{{ item.description }}</div>
                }
                @if (item.item_url) {
                  <a [href]="item.item_url" target="_blank" class="item-link">{{
                    'shopping.viewLink' | transloco
                  }}</a>
                }
              </div>
              <div class="item-price">
                <div class="qty">× {{ item.quantity }}</div>
                <div class="amount">
                  {{ item.total_amount | number: '1.0-0' }} {{ destCurrency() }}
                </div>
                @if (showConversion()) {
                  <div class="amount-converted">
                    ≈ {{ item.total_amount * convRate() | number: '1.0-0' }} {{ homeCurrency() }}
                  </div>
                }
              </div>
            </div>

            <div class="item-actions">
              <label class="image-upload-btn">
                📷 {{ 'shopping.uploadImage' | transloco }}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  (change)="uploadImage($event, item.client_record_id)"
                />
              </label>
              @if (item.image_url) {
                <img [src]="item.image_url" class="item-image" alt="商品圖" />
              }
              <button class="remove-btn" (click)="deleteItem(item.client_record_id)">
                {{ 'shopping.delete' | transloco }}
              </button>
            </div>
          </div>
        }
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
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
      }
      .back-btn {
        color: var(--accent);
        text-decoration: none;
        font-weight: 500;
        white-space: nowrap;
        margin-top: 0.25rem;
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

      .currency-indicator {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--accent);
        background: var(--accent-light);
        padding: 0.2rem 0.6rem;
        border-radius: 6px;
      }
      .fi {
        width: 1.2em;
        border-radius: 2px;
        flex-shrink: 0;
      }

      .summary {
        text-align: right;
      }
      .summary-main {
        color: var(--accent);
        font-size: 0.95rem;
      }
      .summary-main strong {
        font-size: 1.1rem;
      }
      .summary-converted {
        font-size: 0.78rem;
        color: var(--text-secondary);
        margin-top: 0.15rem;
      }

      /* ── 表單 ── */
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
      .span-2 {
        grid-column: 1 / -1;
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
        font-size: 0.95rem;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
      }

      /* ── 雙欄單價 ── */
      .dual-price-row {
        display: flex;
        align-items: flex-end;
        gap: 0.5rem;
      }
      .price-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;
      }
      .currency-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--accent);
        letter-spacing: 0.03em;
      }
      .convert-btn {
        background: var(--accent-light);
        color: var(--accent);
        border: 1.5px solid var(--accent);
        border-radius: 8px;
        padding: 0.55rem 0.7rem;
        cursor: pointer;
        font-size: 1rem;
        flex-shrink: 0;
        line-height: 1;
        transition: background 0.15s;
      }
      .convert-btn:hover {
        background: var(--accent);
        color: white;
      }
      .readonly-input {
        background: var(--bg) !important;
        color: var(--text-secondary) !important;
        cursor: not-allowed;
      }

      /* 小計 */
      .form-total {
        margin-bottom: 1rem;
        color: var(--text-secondary);
        font-size: 0.95rem;
      }
      .form-total strong {
        color: var(--accent);
        font-size: 1.1rem;
      }
      .sub-converted {
        display: block;
        font-size: 0.78rem;
        color: #48bb78;
        margin-top: 0.15rem;
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

      /* ── 清單項目 ── */
      .items-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .item-card.card {
        padding: 1rem 1.25rem;
        transition: opacity 0.2s;
      }
      .item-card.bought {
        opacity: 0.5;
      }
      .item-main {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 0.75rem;
      }
      .checkbox {
        width: 20px;
        height: 20px;
        accent-color: var(--accent);
        flex-shrink: 0;
        margin-top: 3px;
        cursor: pointer;
      }
      .item-info {
        flex: 1;
      }
      .item-title {
        font-weight: 600;
        font-size: 1rem;
        color: var(--text-primary);
      }
      .item-desc {
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin-top: 0.25rem;
      }
      .item-link {
        font-size: 0.8rem;
        color: var(--accent);
        text-decoration: none;
        margin-top: 0.25rem;
        display: block;
      }
      .item-price {
        text-align: right;
        flex-shrink: 0;
      }
      .qty {
        font-size: 0.875rem;
        color: var(--text-secondary);
      }
      .amount {
        font-weight: 700;
        color: var(--text-primary);
        font-size: 1.05rem;
      }
      .amount-converted {
        font-size: 0.78rem;
        color: #48bb78;
        margin-top: 0.15rem;
      }

      .item-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .image-upload-btn {
        cursor: pointer;
        color: var(--accent);
        font-size: 0.875rem;
        padding: 0.375rem 0.875rem;
        border: 1.5px solid var(--accent);
        border-radius: 8px;
      }
      .item-image {
        width: 60px;
        height: 60px;
        object-fit: cover;
        border-radius: 8px;
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
export class ShoppingListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private shoppingService = inject(ShoppingService);
  private syncEngine = inject(SyncEngineService);
  private fb = inject(FormBuilder);
  readonly pref = inject(PreferenceService);
  private rateService = inject(ExchangeRateService);

  tripId!: string;
  items = signal<ShoppingItem[]>([]);

  private _convRate = signal<number>(1);
  private _unitPriceHome = signal<number | null>(null);

  readonly destCurrency = computed(() => this.pref.country().currency);
  readonly homeCurrency = computed(() => this.pref.homeCountry().currency);
  readonly showConversion = computed(() => this.destCurrency() !== this.homeCurrency());
  readonly convRate = this._convRate.asReadonly();
  readonly unitPriceHome = this._unitPriceHome.asReadonly();

  readonly quantity = computed(() => Number(this.form.get('quantity')?.value ?? 1));
  readonly unitPrice = computed(() => Number(this.form.get('unit_price')?.value ?? 0));
  readonly formTotal = computed(() => this.quantity() * this.unitPrice());

  readonly totalAmount = computed(() => this.items().reduce((sum, i) => sum + i.total_amount, 0));
  readonly boughtCount = computed(() => this.items().filter((i) => i.is_bought).length);

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unit_price: [0, [Validators.required, Validators.min(0)]],
    description: [''],
    item_url: [''],
  });

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    await Promise.all([this.loadItems(), this.loadConvRate()]);
    this.rateService.refreshIfNeeded();
  }

  private async loadConvRate(): Promise<void> {
    const rate = await this.rateService.getConversionRate(this.destCurrency(), this.homeCurrency());
    this._convRate.set(rate);
  }

  convertUnitPrice(): void {
    // 直接讀 form 值，computed signal 不追蹤 ReactiveForm 的變動
    const price = Number(this.form.get('unit_price')?.value ?? 0);
    if (price <= 0) {
      this._unitPriceHome.set(0);
      return;
    }
    this._unitPriceHome.set(Math.round(price * this._convRate() * 100) / 100);
  }

  async loadItems(): Promise<void> {
    this.items.set(await this.shoppingService.getByTrip(this.tripId));
  }

  async addItem(): Promise<void> {
    if (this.form.invalid) return;
    const { title, quantity, unit_price, description, item_url } = this.form.value;
    const qty = quantity!;
    const price = unit_price!;
    await this.shoppingService.create({
      trip_id: this.tripId,
      title: title!,
      quantity: qty,
      unit_price: price,
      total_amount: qty * price,
      description: description || undefined,
      item_url: item_url || undefined,
      is_bought: false,
    });
    this.form.reset({ quantity: 1, unit_price: 0 });
    this._unitPriceHome.set(null);
    await this.loadItems();
  }

  async toggleBought(item: ShoppingItem): Promise<void> {
    await this.shoppingService.toggleBought(item.client_record_id, item.is_bought);
    await this.loadItems();
  }

  async uploadImage(event: Event, itemId: string): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await this.shoppingService.handleImageUpload(file, itemId);
    await this.syncEngine.syncUp();
    await this.loadItems();
  }

  async deleteItem(id: string): Promise<void> {
    await this.shoppingService.delete(id);
    await this.loadItems();
  }
}
