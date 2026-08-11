import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ShoppingItem } from '../../core/models';
import { ShoppingService } from '../../core/services/shopping.service';
import { SyncEngineService } from '../../core/services/sync-engine.service';
import { PreferenceService } from '../../core/services/preference.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { DropdownSelectComponent } from '../../shared/components/dropdown-select/dropdown-select.component';

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
  selector: 'app-shopping-list',
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
        <a
          [routerLink]="['/trips']"
          class="back-btn"
          [attr.aria-label]="'shopping.backToTrip' | transloco"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </a>
        <div class="header-mid">
          <h1>🛍️ {{ 'shopping.title' | transloco }}</h1>
        </div>
        <button class="btn-icon add-trigger" type="button" (click)="showAddModal.set(true)">
          ＋
        </button>
      </header>

      <!-- 新增彈窗 -->
      @if (showAddModal()) {
        <div class="modal-backdrop" (click)="closeAddModal()">
          <form
            [formGroup]="form"
            (ngSubmit)="addItem()"
            class="card add-form modal-card"
            (click)="$event.stopPropagation()"
          >
            <label class="photo-block">
              @if (stagingPhotoUrl()) {
                <img [src]="stagingPhotoUrl()!" class="photo-img" alt="" />
              } @else {
                <div class="photo-placeholder">
                  <span class="photo-plus">＋</span>
                  <span class="photo-hint">{{ 'shopping.addPhoto' | transloco }}</span>
                </div>
              }
              <input
                type="file"
                accept="image/*"
                hidden
                (change)="onStagingPhotoSelected($event)"
              />
            </label>
            <div class="form-grid">
              <div class="form-row span-2">
                <label>{{ 'shopping.itemName' | transloco }} *</label>
                <input
                  formControlName="title"
                  [placeholder]="'shopping.itemNamePlaceholder' | transloco"
                />
              </div>
              <!-- 雙欄單價 -->
              <div class="form-row span-2">
                <label>{{ 'shopping.unitPrice' | transloco }}</label>
                <div class="dual-price-row">
                  <div class="price-col">
                    <div class="input-suffix-wrap">
                      <input formControlName="unit_price" type="number" min="0" step="any" />
                      <app-dropdown-select
                        class="currency-suffix-select"
                        variant="badge"
                        [options]="currencyOptions"
                        [ngModel]="formLeftCurrency()"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="onFormLeftCurrencyChange($event)"
                      ></app-dropdown-select>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="convert-btn"
                    (click)="convertUnitPrice()"
                    title="換算成 {{ formRightCurrency() }}"
                  >
                    ⇄
                  </button>
                  <div class="price-col">
                    <div class="input-suffix-wrap">
                      <input
                        type="number"
                        [value]="unitPriceHome() ?? ''"
                        readonly
                        class="readonly-input"
                        placeholder="—"
                      />
                      <app-dropdown-select
                        class="currency-suffix-select"
                        variant="badge"
                        [options]="currencyOptions"
                        [ngModel]="formRightCurrency()"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="onFormRightCurrencyChange($event)"
                      ></app-dropdown-select>
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-row span-2">
                <label>{{ 'shopping.quantity' | transloco }}</label>
                <input formControlName="quantity" type="number" min="1" />
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
                {{ formLeftCurrency() }}</span
              >
              @if (formShowConversion() && formTotal() > 0) {
                <span class="sub-converted"
                  >≈ {{ formTotal() * formConvRate() | number: '1.0-0' }}
                  {{ formRightCurrency() }}</span
                >
              }
            </div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="closeAddModal()">
                {{ 'common.cancel' | transloco }}
              </button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid">
                {{ (editingItemId() ? 'common.save' : 'shopping.addItem') | transloco }}
              </button>
            </div>
          </form>
        </div>
      }

      <!-- 清單 -->
      <div class="list-toolbar">
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
      </div>
      @if (items().length === 0) {
        <div class="empty-state">
          <p>{{ 'shopping.noItems' | transloco }}</p>
        </div>
      }
      <div class="items-list">
        @for (item of items(); track item.client_record_id) {
          <div class="item-card card" [class.bought]="item.is_bought" (click)="openEditItem(item)">
            <div class="item-main">
              <input
                type="checkbox"
                [checked]="item.is_bought"
                (change)="toggleBought(item)"
                (click)="$event.stopPropagation()"
                class="checkbox"
              />
              <div class="item-info">
                <div class="item-title">{{ item.title }}</div>
                @if (item.description) {
                  <div class="item-desc">{{ item.description }}</div>
                }
                @if (item.item_url) {
                  <a
                    [href]="item.item_url"
                    target="_blank"
                    class="item-link"
                    (click)="$event.stopPropagation()"
                    >{{ 'shopping.viewLink' | transloco }}</a
                  >
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

            <div class="item-actions" (click)="$event.stopPropagation()">
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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        color: var(--accent);
        text-decoration: none;
        font-size: 1.3rem;
        font-weight: 600;
        background: var(--icon-bg);
        flex-shrink: 0;
        transition: background 0.15s;
      }
      .back-btn:hover {
        background: var(--icon-bg-hover);
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

      .list-toolbar {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 0.6rem;
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
      .input-suffix-wrap {
        position: relative;
      }
      .input-suffix-wrap input {
        width: 100%;
        padding-right: 3.2rem;
        box-sizing: border-box;
        -moz-appearance: textfield;
      }
      .input-suffix-wrap input::-webkit-outer-spin-button,
      .input-suffix-wrap input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .currency-suffix-select {
        position: absolute;
        right: 0.4rem;
        top: 50%;
        transform: translateY(-50%);
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
      .photo-block {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        aspect-ratio: 16/9;
        max-height: 160px;
        background: var(--bg);
        border: 2px dashed var(--border);
        border-radius: 12px;
        cursor: pointer;
        overflow: hidden;
        margin-bottom: 1rem;
      }
      .photo-block:hover {
        border-color: var(--accent);
      }
      .photo-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .photo-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3rem;
        color: var(--text-secondary);
      }
      .photo-plus {
        font-size: 1.6rem;
      }
      .photo-hint {
        font-size: 0.8rem;
      }

      /* ── 清單項目 ── */
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
        transition: opacity 0.2s;
        cursor: pointer;
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
        font-family: var(--font-mono);
        font-size: 0.875rem;
        color: var(--text-secondary);
      }
      .amount {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        color: var(--text-primary);
        font-size: 1.05rem;
      }
      .amount-converted {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
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

  readonly currencyOptions = CURRENCY_CODES.map((c) => ({ value: c, label: c }));
  formLeftCurrency = signal(this.pref.country().currency);
  formRightCurrency = signal(this.pref.homeCountry().currency);
  private _formConvRate = signal<number>(1);
  readonly formConvRate = this._formConvRate.asReadonly();
  readonly formShowConversion = computed(
    () => this.formLeftCurrency() !== this.formRightCurrency(),
  );

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

  showAddModal = signal(false);
  editingItemId = signal<string | null>(null);
  stagingPhotoUrl = signal<string | null>(null);
  private stagingPhotoFile: File | null = null;

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    await Promise.all([this.loadItems(), this.loadConvRate()]);
    this.rateService.refreshIfNeeded();
  }

  private async loadConvRate(): Promise<void> {
    const rate = await this.rateService.getConversionRate(this.destCurrency(), this.homeCurrency());
    this._convRate.set(rate);
    this._formConvRate.set(rate);
  }

  private async refreshFormRate(): Promise<void> {
    const rate = await this.rateService.getConversionRate(
      this.formLeftCurrency(),
      this.formRightCurrency(),
    );
    this._formConvRate.set(rate);
    this.convertUnitPrice();
  }

  onFormLeftCurrencyChange(code: string): void {
    this.formLeftCurrency.set(code);
    this.refreshFormRate();
  }

  onFormRightCurrencyChange(code: string): void {
    this.formRightCurrency.set(code);
    this.refreshFormRate();
  }

  convertUnitPrice(): void {
    // 直接讀 form 值，computed signal 不追蹤 ReactiveForm 的變動
    const price = Number(this.form.get('unit_price')?.value ?? 0);
    if (price <= 0) {
      this._unitPriceHome.set(0);
      return;
    }
    this._unitPriceHome.set(Math.round(price * this._formConvRate() * 100) / 100);
  }

  async loadItems(): Promise<void> {
    this.items.set(await this.shoppingService.getByTrip(this.tripId));
  }

  onStagingPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.stagingPhotoFile = file;
    this.stagingPhotoUrl.set(URL.createObjectURL(file));
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.editingItemId.set(null);
    this.form.reset({ quantity: 1, unit_price: 0 });
    this._unitPriceHome.set(null);
    this.formLeftCurrency.set(this.pref.country().currency);
    this.formRightCurrency.set(this.pref.homeCountry().currency);
    this._formConvRate.set(this._convRate());
    this.stagingPhotoFile = null;
    this.stagingPhotoUrl.set(null);
  }

  openEditItem(item: ShoppingItem): void {
    this.editingItemId.set(item.client_record_id);
    this.form.reset({
      title: item.title,
      quantity: item.quantity,
      unit_price: item.unit_price,
      description: item.description ?? '',
      item_url: item.item_url ?? '',
    });
    this.stagingPhotoFile = null;
    this.stagingPhotoUrl.set(item.image_url ?? null);
    this.showAddModal.set(true);
  }

  async addItem(): Promise<void> {
    if (this.form.invalid) return;
    const { title, quantity, unit_price, description, item_url } = this.form.value;
    const qty = quantity!;
    const price = unit_price!;
    const editingId = this.editingItemId();

    if (editingId) {
      await this.shoppingService.update(editingId, {
        title: title!,
        quantity: qty,
        unit_price: price,
        total_amount: qty * price,
        description: description || undefined,
        item_url: item_url || undefined,
      });
      if (this.stagingPhotoFile) {
        await this.shoppingService.handleImageUpload(this.stagingPhotoFile, editingId);
        await this.syncEngine.syncUp();
      }
    } else {
      const created = await this.shoppingService.create({
        trip_id: this.tripId,
        title: title!,
        quantity: qty,
        unit_price: price,
        total_amount: qty * price,
        description: description || undefined,
        item_url: item_url || undefined,
        is_bought: false,
      });
      if (this.stagingPhotoFile) {
        await this.shoppingService.handleImageUpload(
          this.stagingPhotoFile,
          created.client_record_id,
        );
        await this.syncEngine.syncUp();
      }
    }
    this.closeAddModal();
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
