import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Expense, TripMember } from '../../core/models';
import { ExpenseService } from '../../core/services/expense.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { OcrService } from '../../core/services/ocr.service';
import { TripService } from '../../core/services/trip.service';
import { PreferenceService } from '../../core/services/preference.service';

interface ShareRow { memberId: string; name: string; weight: number; }

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a [routerLink]="['/trips', tripId]" class="back-btn">← 返回行程</a>
        <h1>💰 記帳分帳</h1>
      </header>

      @if (rateInfo()) {
        <div class="rate-banner" [class.offline]="rateInfo()!.isOffline">
          匯率資料：{{ rateInfo()!.date }}
          @if (rateInfo()!.isOffline) { <span class="offline-tag">（離線快取）</span> }
        </div>
      }

      <!-- OCR 收據掃描 -->
      <div class="card ocr-card">
        <h3>📷 掃描收據</h3>
        <label class="upload-btn">
          選擇收據圖片
          <input type="file" accept="image/*" hidden (change)="scanReceipt($event)" />
        </label>
        @if (ocrLoading()) {
          <div class="ocr-loading">⏳ 辨識中，請稍候...</div>
        }
        @if (ocrResult()) {
          <div class="ocr-result">
            <p>🔍 辨識結果（請確認後填入表單）</p>
            <div class="ocr-fields">
              <span>金額：<strong>{{ ocrResult()!.amount ?? '未辨識' }}</strong></span>
              <span>日期：<strong>{{ ocrResult()!.date ?? '未辨識' }}</strong></span>
            </div>
            <button class="btn-sm" (click)="applyOcr()">套用至表單</button>
          </div>
        }
      </div>

      <!-- 新增記帳 -->
      <form [formGroup]="form" (ngSubmit)="addExpense()" class="card">
        <h3>新增費用</h3>
        <div class="form-grid">
          <div class="form-row span-2">
            <label>項目名稱 *</label>
            <input formControlName="title" placeholder="例：午餐" />
          </div>
          <div class="form-row">
            <label>金額 *</label>
            <input formControlName="amount" type="number" min="0" step="any" />
            @if (amountConverted() !== null) {
              <div class="amount-hint">
                ≈ <strong>{{ amountConverted()! | number:'1.0-0' }}</strong> {{ homeCurrency() }}
              </div>
            }
          </div>
          <div class="form-row">
            <label>貨幣</label>
            <select formControlName="currency_code">
              <option value="TWD">TWD</option>
              <option value="JPY">JPY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="THB">THB</option>
            </select>
          </div>
          <div class="form-row">
            <label>消費日期 *</label>
            <input formControlName="expense_date" type="date" />
          </div>
          <div class="form-row">
            <label>墊款人 *</label>
            <select formControlName="payer_member_id">
              @for (m of members(); track m.id) {
                <option [value]="m.id">{{ m.display_name }}</option>
              }
            </select>
          </div>
          <div class="form-row span-2">
            <label>分帳方式</label>
            <div class="split-ctrl-row">
              <select formControlName="split_type" (change)="onSplitTypeChange()">
                <option value="EQUAL">平均分攤</option>
                <option value="SHARES">依比例</option>
              </select>
              <div class="person-count-wrap">
                <span class="person-label">人數</span>
                <input type="number" min="1" max="20" [value]="personCount()"
                       (input)="onPersonCountInput($event)" class="count-input" />
              </div>
            </div>
          </div>

          <!-- 平均分攤預覽 -->
          @if (form.get('split_type')?.value === 'EQUAL' && (form.get('amount')?.value ?? 0) > 0) {
            <div class="form-row span-2">
              <div class="per-person-box">
                每人
                <strong>{{ (form.get('amount')?.value ?? 0) / personCount() | number:'1.0-2' }}</strong>
                {{ form.get('currency_code')?.value }}
                @if (amountConverted() !== null) {
                  <span class="per-person-conv">
                    ≈ {{ amountConverted()! / personCount() | number:'1.0-0' }} {{ homeCurrency() }}
                  </span>
                }
              </div>
            </div>
          }

          <!-- 依比例分帳表 -->
          @if (form.get('split_type')?.value === 'SHARES' && shareRows().length > 0) {
            <div class="form-row span-2">
              <div class="shares-table">
                @for (row of shareRows(); track $index; let i = $index) {
                  <div class="share-row">
                    <input class="share-name-input"
                           [value]="row.name"
                           (input)="updateShareRowName(i, $any($event.target).value)"
                           placeholder="成員名稱" />
                    <div class="share-weight-cell">
                      <input type="number" min="0" max="100"
                             [value]="row.weight"
                             (input)="updateShareRowWeight(i, +$any($event.target).value)"
                             class="weight-input" />
                      <span class="pct-sign">%</span>
                    </div>
                    @if ((form.get('amount')?.value ?? 0) > 0) {
                      <span class="share-amount-cell">
                        {{ (form.get('amount')?.value ?? 0) * row.weight / 100 | number:'1.0-2' }}
                        {{ form.get('currency_code')?.value }}
                      </span>
                    }
                  </div>
                }
                <div class="weight-sum" [class.bad]="shareWeightSum() !== 100">
                  合計 {{ shareWeightSum() }}%
                  @if (shareWeightSum() !== 100) {
                    <span class="weight-warn">（需為 100%）</span>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        <button type="submit" class="btn-primary" [disabled]="form.invalid || submitting() || (form.get('split_type')?.value === 'SHARES' && shareWeightSum() !== 100)">
          {{ submitting() ? '儲存中...' : '記帳' }}
        </button>
      </form>

      <!-- 費用清單 -->
      <div class="expenses-list">
        @for (expense of expenses(); track expense.client_record_id) {
          <div class="expense-card card">
            <div class="expense-header">
              <div>
                <div class="expense-title">{{ expense.title }}</div>
                <div class="expense-meta">
                  {{ expense.expense_date_utc | date:'yyyy/MM/dd' }} ・
                  {{ expense.currency_code }} {{ expense.amount | number:'1.0-2' }}
                  <span class="converted">≈ TWD {{ expense.converted_amount | number:'1.0-0' }}</span>
                </div>
              </div>
              <button class="remove-btn" (click)="deleteExpense(expense.client_record_id)">🗑</button>
            </div>
          </div>
        }
      </div>

      <!-- 結算 -->
      @if (expenses().length > 0) {
        <div class="card settlement">
          <h3>結算總覽</h3>
          @for (entry of settlement(); track entry.memberId) {
            <div class="settlement-row" [class.positive]="entry.amount > 0" [class.negative]="entry.amount < 0">
              <span>{{ getMemberName(entry.memberId) }}</span>
              <span>
                {{ entry.amount > 0 ? '應收' : '應付' }}
                <strong>{{ (entry.amount | number:'1.0-0') }}</strong> 元
              </span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 900px; margin: 0 auto; padding: 1.5rem; }
    .page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .back-btn { color: #667eea; text-decoration: none; font-weight: 500; }
    h1 { font-size: 1.6rem; font-weight: 700; color: #1a1a2e; margin: 0; }
    .rate-banner { padding: 0.6rem 1rem; background: #f0f0ff; color: #667eea; border-radius: 10px;
      margin-bottom: 1rem; font-size: 0.875rem; }
    .rate-banner.offline { background: #fff8e1; color: #e6a817; }
    .offline-tag { font-weight: 600; }
    .card { background: white; border-radius: 16px; padding: 1.5rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 1rem; }
    .ocr-card h3 { margin: 0 0 1rem; }
    .upload-btn { display: inline-block; cursor: pointer; padding: 0.5rem 1.25rem;
      background: #f0f0ff; color: #667eea; border-radius: 10px; font-size: 0.9rem; border: 1.5px solid #667eea; }
    .ocr-loading { margin-top: 0.75rem; color: #666; font-size: 0.9rem; }
    .ocr-result { margin-top: 1rem; padding: 0.75rem 1rem; background: #f8fff8;
      border: 1px solid #48bb78; border-radius: 10px; }
    .ocr-result p { margin: 0 0 0.5rem; font-weight: 500; }
    .ocr-fields { display: flex; gap: 1.5rem; margin-bottom: 0.75rem; font-size: 0.9rem; }
    .btn-sm { background: #48bb78; color: white; border: none; border-radius: 8px;
      padding: 0.375rem 1rem; cursor: pointer; font-size: 0.875rem; }

    /* ── 表單 ── */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem; }
    .span-2 { grid-column: 1 / -1; }
    .form-row label { display: block; font-weight: 500; margin-bottom: 0.35rem; color: #555; font-size: 0.9rem; }
    .form-row input, .form-row select {
      width: 100%; padding: 0.625rem 0.875rem; border: 1.5px solid #ddd;
      border-radius: 10px; font-size: 0.95rem; box-sizing: border-box;
    }
    .form-row select {
      padding-right: 3rem;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23667eea' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 1rem center;
      background-size: 12px;
    }

    /* 金額換算提示 */
    .amount-hint {
      margin-top: 0.4rem;
      font-size: 0.82rem;
      color: #48bb78;
      padding: 0.25rem 0.5rem;
      background: #f0fff8;
      border: 1px solid #c6f6d5;
      border-radius: 6px;
      display: inline-block;
    }

    /* 分帳方式列 */
    .split-ctrl-row {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }
    .split-ctrl-row select { flex: 1; }
    .person-count-wrap {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-shrink: 0;
    }
    .person-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #555;
      white-space: nowrap;
    }
    .count-input {
      width: 3.5rem !important;
      padding: 0.625rem 0.5rem !important;
      text-align: center;
    }

    /* 平均分攤預覽 */
    .per-person-box {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.625rem 1rem;
      background: #f0f0ff;
      border-radius: 10px;
      font-size: 0.9rem;
      color: #555;
      flex-wrap: wrap;
    }
    .per-person-box strong { color: #667eea; font-size: 1.05rem; }
    .per-person-conv {
      font-size: 0.78rem;
      color: #48bb78;
      margin-left: 0.25rem;
    }

    /* 依比例分帳表 */
    .shares-table {
      border: 1.5px solid #eee;
      border-radius: 10px;
      overflow: hidden;
    }
    .share-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid #f0f0f0;
    }
    .share-row:last-of-type { border-bottom: none; }
    .share-name-input {
      flex: 1;
      padding: 0.4rem 0.625rem !important;
      border: 1.5px solid #ddd !important;
      border-radius: 8px !important;
      font-size: 0.9rem !important;
      width: auto !important;
    }
    .share-weight-cell {
      display: flex;
      align-items: center;
      gap: 0.2rem;
      flex-shrink: 0;
    }
    .weight-input {
      width: 3.5rem !important;
      padding: 0.4rem 0.375rem !important;
      border: 1.5px solid #ddd !important;
      border-radius: 8px !important;
      font-size: 0.9rem !important;
      text-align: center;
    }
    .pct-sign { font-size: 0.85rem; color: #888; }
    .share-amount-cell {
      min-width: 5rem;
      text-align: right;
      font-size: 0.85rem;
      font-weight: 600;
      color: #667eea;
      flex-shrink: 0;
    }
    .weight-sum {
      padding: 0.4rem 0.75rem;
      font-size: 0.82rem;
      font-weight: 600;
      color: #48bb78;
      background: #f8fff8;
    }
    .weight-sum.bad { color: #e53e3e; background: #fff5f5; }
    .weight-warn { font-weight: 400; }

    .btn-primary { background: #667eea; color: white; border: none; border-radius: 10px;
      padding: 0.625rem 1.5rem; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.5; }
    .expenses-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .expense-card.card { padding: 1rem 1.25rem; }
    .expense-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .expense-title { font-weight: 600; font-size: 1rem; margin-bottom: 0.25rem; }
    .expense-meta { font-size: 0.875rem; color: #666; }
    .converted { color: #667eea; font-weight: 500; margin-left: 0.5rem; }
    .remove-btn { background: none; border: none; cursor: pointer; font-size: 1rem; color: #e53e3e; }
    .settlement h3 { margin: 0 0 1rem; }
    .settlement-row { display: flex; justify-content: space-between; padding: 0.625rem 0;
      border-bottom: 1px solid #f0f0f0; font-size: 0.95rem; }
    .settlement-row:last-child { border-bottom: none; }
    .settlement-row.positive strong { color: #48bb78; }
    .settlement-row.negative strong { color: #e53e3e; }
  `]
})
export class ExpensesComponent implements OnInit {
  private route             = inject(ActivatedRoute);
  private expenseService    = inject(ExpenseService);
  private exchangeRateService = inject(ExchangeRateService);
  private ocrService        = inject(OcrService);
  private tripService       = inject(TripService);
  private fb                = inject(FormBuilder);
  private pref              = inject(PreferenceService);

  tripId!: string;
  expenses   = signal<Expense[]>([]);
  members    = signal<TripMember[]>([]);
  settlement = signal<{ memberId: string; amount: number }[]>([]);
  rateInfo   = signal<{ date: string; isOffline: boolean } | null>(null);
  ocrResult  = signal<{ amount: number | null; date: string | null } | null>(null);
  ocrLoading = signal(false);
  submitting = signal(false);

  personCount = signal<number>(2);
  splitType   = signal<'EQUAL' | 'SHARES'>('EQUAL');
  shareRows   = signal<ShareRow[]>([]);

  readonly shareWeightSum = computed(() => this.shareRows().reduce((s, r) => s + r.weight, 0));
  readonly homeCurrency   = computed(() => this.pref.homeCountry().currency);

  private _amountConverted = signal<number | null>(null);
  readonly amountConverted = this._amountConverted.asReadonly();

  form = this.fb.group({
    title:            ['', [Validators.required, Validators.maxLength(100)]],
    amount:           [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency_code:    ['TWD', Validators.required],
    expense_date:     [new Date().toISOString().split('T')[0], Validators.required],
    payer_member_id:  ['', Validators.required],
    split_type:       ['EQUAL' as 'EQUAL' | 'SHARES'],
  });

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    await Promise.all([
      this.loadExpenses(),
      this.loadMembers(),
      this.loadRateInfo(),
    ]);
    this.exchangeRateService.refreshIfNeeded();

    this.form.get('amount')!.valueChanges.subscribe(() => this.calcAmountConversion());
    this.form.get('currency_code')!.valueChanges.subscribe(() => this.calcAmountConversion());
  }

  private async loadExpenses(): Promise<void> {
    this.expenses.set(await this.expenseService.getByTrip(this.tripId));
    await this.loadSettlement();
  }

  private async loadMembers(): Promise<void> {
    const members = await this.tripService.getMembers(this.tripId);
    this.members.set(members);
    if (members.length > 0) {
      this.form.patchValue({ payer_member_id: members[0].id });
    }
  }

  private async loadRateInfo(): Promise<void> {
    const date = await this.exchangeRateService.getLatestCacheDate();
    if (date) {
      const cached = await this.exchangeRateService.getRate(date, 'TWD');
      this.rateInfo.set({ date, isOffline: cached.isOffline });
    }
  }

  private async loadSettlement(): Promise<void> {
    const balanceMap = await this.expenseService.calcSettlement(this.tripId);
    const entries = [...balanceMap.entries()].map(([memberId, amount]) => ({ memberId, amount }));
    this.settlement.set(entries.filter(e => Math.abs(e.amount) > 0.001));
  }

  private async calcAmountConversion(): Promise<void> {
    const amount = this.form.get('amount')?.value as number | null;
    const currency = this.form.get('currency_code')?.value as string;
    const home = this.homeCurrency();
    if (!amount || amount <= 0 || !currency || currency === home) {
      this._amountConverted.set(null);
      return;
    }
    const rate = await this.exchangeRateService.getConversionRate(currency, home);
    this._amountConverted.set(Math.round(amount * rate * 100) / 100);
  }

  onSplitTypeChange(): void {
    const value = this.form.get('split_type')?.value as 'EQUAL' | 'SHARES';
    this.splitType.set(value);
    if (value === 'SHARES') this.initShareRows();
  }

  onPersonCountInput(event: Event): void {
    const value = Math.max(1, Math.min(20, +(event.target as HTMLInputElement).value || 1));
    (event.target as HTMLInputElement).value = String(value);
    this.personCount.set(value);
    if (this.splitType() === 'SHARES') this.resizeShareRows(value);
  }

  private initShareRows(): void {
    const count = this.personCount();
    const members = this.members();
    const eq = Math.floor(100 / count);
    const rem = 100 - eq * count;
    this.shareRows.set(Array.from({ length: count }, (_, i) => ({
      memberId: members[i]?.id ?? '',
      name:     members[i]?.display_name ?? `成員 ${i + 1}`,
      weight:   i === count - 1 ? eq + rem : eq,
    })));
  }

  private resizeShareRows(count: number): void {
    const members = this.members();
    const existing = this.shareRows();
    let rows = existing.slice(0, count);
    while (rows.length < count) {
      const i = rows.length;
      rows.push({ memberId: members[i]?.id ?? '', name: members[i]?.display_name ?? `成員 ${i + 1}`, weight: 0 });
    }
    const sumExcLast = rows.slice(0, -1).reduce((s, r) => s + r.weight, 0);
    rows = [...rows.slice(0, -1), { ...rows[rows.length - 1], weight: Math.max(0, 100 - sumExcLast) }];
    this.shareRows.set(rows);
  }

  updateShareRowName(index: number, name: string): void {
    this.shareRows.update(rows => rows.map((r, i) => i === index ? { ...r, name } : r));
  }

  updateShareRowWeight(index: number, weight: number): void {
    this.shareRows.update(rows => rows.map((r, i) => i === index ? { ...r, weight: Math.max(0, weight) } : r));
  }

  async scanReceipt(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.ocrLoading.set(true);
    try {
      const result = await this.ocrService.recognize(file);
      this.ocrResult.set({ amount: result.amount, date: result.date });
    } finally {
      this.ocrLoading.set(false);
    }
  }

  applyOcr(): void {
    const result = this.ocrResult();
    if (!result) return;
    if (result.amount !== null) this.form.patchValue({ amount: result.amount });
    if (result.date !== null) this.form.patchValue({ expense_date: result.date });
    this.ocrResult.set(null);
  }

  async addExpense(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    if (this.splitType() === 'SHARES' && this.shareWeightSum() !== 100) return;
    this.submitting.set(true);
    try {
      const { title, amount, currency_code, expense_date, payer_member_id, split_type } = this.form.value;
      const dateStr = expense_date!;
      const { rate, rateDate, isOffline } = await this.exchangeRateService.getRate(dateStr, currency_code!);

      const shareWeights = split_type === 'SHARES'
        ? this.shareRows().map(r => ({ memberId: r.memberId, weight: r.weight }))
        : undefined;

      await this.expenseService.create({
        trip_id: this.tripId,
        title: title!,
        amount: amount!,
        currency_code: currency_code!,
        exchange_rate: rate,
        expense_date_utc: new Date(dateStr).toISOString(),
        payer_member_id: payer_member_id!,
        split_type: split_type!,
        members: this.members(),
        share_weights: shareWeights,
      });

      this.form.reset({
        currency_code: 'TWD',
        expense_date: new Date().toISOString().split('T')[0],
        payer_member_id: this.members()[0]?.id ?? '',
        split_type: 'EQUAL',
      });
      this._amountConverted.set(null);
      this.splitType.set('EQUAL');
      this.shareRows.set([]);
      await this.loadExpenses();
    } finally {
      this.submitting.set(false);
    }
  }

  getMemberName(memberId: string): string {
    return this.members().find(m => m.id === memberId)?.display_name ?? memberId;
  }

  async deleteExpense(id: string): Promise<void> {
    if (!confirm('確定刪除此筆記帳？')) return;
    await this.expenseService.delete(id);
    await this.loadExpenses();
  }
}
