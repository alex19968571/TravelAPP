import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Expense, ExpenseSplit, TripMember } from '../../core/models';
import { ExpenseService } from '../../core/services/expense.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { OcrService } from '../../core/services/ocr.service';
import { TripService } from '../../core/services/trip.service';
import { PreferenceService } from '../../core/services/preference.service';
import { generateId } from '../../core/utils/uuid.util';

interface ShareRow {
  memberId: string;
  name: string;
  weight: number;
}
interface OriginalAmount {
  currency: string;
  amount: number;
}
interface GrossEntry {
  memberId: string;
  convertedTotal: number;
  originals: OriginalAmount[];
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a
          [routerLink]="['/trips']"
          class="back-btn"
          [attr.aria-label]="'expenses.backToTrip' | transloco"
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
        <h1>💰 {{ 'expenses.title' | transloco }}</h1>
      </header>

      <!-- OCR 收據掃描 -->
      <div class="card ocr-card">
        <h3>📷 {{ 'expenses.scan' | transloco }}</h3>
        <label class="upload-btn">
          {{ 'expenses.selectImage' | transloco }}
          <input type="file" accept="image/*" hidden (change)="scanReceipt($event)" />
        </label>
        @if (ocrLoading()) {
          <div class="ocr-loading">⏳ {{ 'expenses.recognizing' | transloco }}</div>
        }
        @if (ocrResult()) {
          <div class="ocr-result">
            <p>🔍 {{ 'expenses.recognizedResult' | transloco }}</p>
            <div class="ocr-fields">
              <span
                >{{ 'expenses.amount' | transloco }}：<strong>{{
                  ocrResult()!.amount ?? ('expenses.notRecognized' | transloco)
                }}</strong></span
              >
              <span
                >{{ 'expenses.date' | transloco }}：<strong>{{
                  ocrResult()!.date ?? ('expenses.notRecognized' | transloco)
                }}</strong></span
              >
            </div>
            <button class="btn-sm" (click)="applyOcr()">
              {{ 'expenses.applyOcr' | transloco }}
            </button>
          </div>
        }
      </div>

      <!-- 新增記帳 -->
      <form [formGroup]="form" (ngSubmit)="addExpense()" class="card">
        <h3>{{ 'expenses.newExpense' | transloco }}</h3>
        <div class="form-grid">
          <div class="form-row span-2">
            <label>{{ 'expenses.itemName' | transloco }} *</label>
            <input
              formControlName="title"
              [placeholder]="'expenses.itemNamePlaceholder' | transloco"
            />
          </div>
          <div class="form-row">
            <label>{{ 'expenses.amount' | transloco }} *</label>
            <input formControlName="amount" type="number" min="0" step="any" />
            @if (amountConverted() !== null) {
              <div class="amount-hint">
                ≈ <strong>{{ amountConverted()! | number: '1.0-0' }}</strong> {{ homeCurrency() }}
              </div>
            }
          </div>
          <div class="form-row">
            <label>{{ 'expenses.currency' | transloco }}</label>
            <select formControlName="currency_code">
              <option value="TWD">TWD</option>
              <option value="JPY">JPY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="THB">THB</option>
              <option value="KRW">KRW</option>
              <option value="HKD">HKD</option>
              <option value="SGD">SGD</option>
              <option value="MYR">MYR</option>
              <option value="AUD">AUD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ 'expenses.expenseDate' | transloco }} *</label>
            <input formControlName="expense_date" type="date" />
          </div>
          <div class="form-row">
            <label>{{ 'expenses.payer' | transloco }} *</label>
            <select formControlName="payer_member_id">
              @for (m of members(); track m.id) {
                <option [value]="m.id">{{ m.display_name }}</option>
              }
            </select>
          </div>
          <div class="form-row span-2">
            <label>{{ 'expenses.splitMethod' | transloco }}</label>
            <div class="split-ctrl-row">
              <select formControlName="split_type" (change)="onSplitTypeChange()">
                <option value="EQUAL">{{ 'expenses.splitEqual' | transloco }}</option>
                <option value="SHARES">{{ 'expenses.splitShares' | transloco }}</option>
              </select>
              <div class="person-count-wrap">
                <span class="person-label">{{ 'expenses.personCount' | transloco }}</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  [value]="personCount()"
                  (input)="onPersonCountInput($event)"
                  class="count-input"
                />
              </div>
            </div>
          </div>

          <!-- 平均分攤預覽 -->
          @if (splitType() === 'EQUAL' && (form.get('amount')?.value ?? 0) > 0) {
            <div class="form-row span-2">
              <div class="per-person-box">
                {{ 'expenses.perPerson' | transloco }}
                <strong>{{
                  (form.get('amount')?.value ?? 0) / personCount() | number: '1.0-2'
                }}</strong>
                {{ form.get('currency_code')?.value }}
                @if (amountConverted() !== null) {
                  <span class="per-person-conv">
                    ≈ {{ amountConverted()! / personCount() | number: '1.0-0' }}
                    {{ homeCurrency() }}
                  </span>
                }
              </div>
            </div>
          }

          <!-- 依比例分帳表：只有切換回 EQUAL 才隱藏 -->
          @if (splitType() === 'SHARES') {
            <div class="form-row span-2">
              @if (shareRows().length === 0) {
                <div class="shares-empty">請先選擇分帳方式或設定人數</div>
              } @else {
                <div class="shares-table">
                  @for (row of shareRows(); track $index; let i = $index) {
                    <div class="share-row">
                      <input
                        class="share-name-input"
                        [value]="row.name"
                        (input)="updateShareRowName(i, $any($event.target).value)"
                        [placeholder]="'expenses.memberNamePlaceholder' | transloco"
                      />
                      <div class="share-weight-cell">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          [value]="row.weight"
                          (input)="updateShareRowWeight(i, +$any($event.target).value)"
                          class="weight-input"
                        />
                        <span class="pct-sign">%</span>
                      </div>
                      @if ((form.get('amount')?.value ?? 0) > 0) {
                        <span class="share-amount-cell">
                          {{
                            ((form.get('amount')?.value ?? 0) * row.weight) / 100 | number: '1.0-2'
                          }}
                          {{ form.get('currency_code')?.value }}
                          @if (amountConverted() !== null) {
                            <span class="share-conv"
                              >≈ {{ (amountConverted()! * row.weight) / 100 | number: '1.0-0' }}
                              {{ homeCurrency() }}</span
                            >
                          }
                        </span>
                      }
                    </div>
                  }
                  <div class="weight-sum" [class.bad]="shareWeightSum() !== 100">
                    {{ sumLabel() }}
                    @if (shareWeightSum() !== 100) {
                      <span class="weight-warn">{{ 'expenses.needs100' | transloco }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <button
          type="submit"
          class="btn-primary"
          [disabled]="
            form.invalid || submitting() || (splitType() === 'SHARES' && shareWeightSum() !== 100)
          "
        >
          {{ submitting() ? ('expenses.saving' | transloco) : ('expenses.add' | transloco) }}
        </button>
      </form>

      <!-- 費用清單 -->
      <div class="expenses-list">
        @for (expense of expenses(); track expense.client_record_id) {
          <div class="expense-card card" (click)="toggleExpand(expense)">
            <div class="expense-header">
              <div>
                <div class="expense-title">{{ expense.title }}</div>
                <div class="expense-meta">
                  {{ expense.expense_date_utc | date: 'yyyy/MM/dd' }} ・ {{ expense.currency_code }}
                  {{ expense.amount | number: '1.0-2' }}
                  <span class="converted"
                    >≈ TWD {{ expense.converted_amount | number: '1.0-0' }}</span
                  >
                </div>
              </div>
              <div class="expense-right">
                <span class="expand-icon">{{
                  expandedExpenseId() === expense.client_record_id ? '▲' : '▼'
                }}</span>
                <button
                  class="remove-btn"
                  (click)="$event.stopPropagation(); deleteExpense(expense.client_record_id)"
                >
                  🗑
                </button>
              </div>
            </div>

            <!-- 展開：各成員應付明細 -->
            @if (expandedExpenseId() === expense.client_record_id) {
              <div class="expense-splits" (click)="$event.stopPropagation()">
                @if (expandedSplits().length === 0) {
                  <div class="splits-empty">{{ 'expenses.noSplitData' | transloco }}</div>
                } @else {
                  @for (split of expandedSplits(); track split.id) {
                    <div
                      class="split-detail"
                      [class.is-payer]="split.member_id === expense.payer_member_id"
                    >
                      <span class="split-name">
                        {{ getMemberName(split.member_id) }}
                        @if (split.member_id === expense.payer_member_id) {
                          <span class="payer-badge">{{ 'expenses.payerBadge' | transloco }}</span>
                        }
                      </span>
                      @if (expense.split_type === 'SHARES') {
                        <span class="split-weight"
                          >{{ split.share_weight | number: '1.0-0' }}%</span
                        >
                      }
                      <span class="split-amount">
                        {{ split.owed_amount | number: '1.0-2' }} {{ expense.currency_code }}
                      </span>
                    </div>
                  }
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- 結算總覽 -->
      @if (expenses().length > 0) {
        <div class="card settlement">
          <h3>{{ 'expenses.settlement' | transloco }}</h3>

          @if (grossReceivable().length > 0) {
            <div class="settle-group">
              <div class="settle-group-title positive-title">
                {{ 'expenses.shouldReceive' | transloco }}
              </div>
              @for (entry of grossReceivable(); track entry.memberId) {
                <div class="settlement-row positive">
                  <span class="member-name">{{ getMemberName(entry.memberId) }}</span>
                  <span class="settle-amounts">
                    @for (orig of entry.originals; track orig.currency) {
                      <span class="settle-orig"
                        >+{{ orig.amount | number: '1.0-0' }} {{ orig.currency }}</span
                      >
                    }
                    <span class="settle-converted"
                      >+{{ entry.convertedTotal | number: '1.0-0' }} {{ homeCurrency() }}</span
                    >
                  </span>
                </div>
              }
            </div>
          }

          @if (grossPayable().length > 0) {
            <div class="settle-group">
              <div class="settle-group-title negative-title">
                {{ 'expenses.shouldPay' | transloco }}
              </div>
              @for (entry of grossPayable(); track entry.memberId) {
                <div class="settlement-row negative">
                  <span class="member-name">{{ getMemberName(entry.memberId) }}</span>
                  <span class="settle-amounts">
                    @for (orig of entry.originals; track orig.currency) {
                      <span class="settle-orig"
                        >-{{ orig.amount | number: '1.0-0' }} {{ orig.currency }}</span
                      >
                    }
                    <span class="settle-converted"
                      >-{{ entry.convertedTotal | number: '1.0-0' }} {{ homeCurrency() }}</span
                    >
                  </span>
                </div>
              }
            </div>
          }
        </div>
      }
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
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
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
      h1 {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }
      .card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 4px 20px var(--shadow);
        margin-bottom: 1rem;
      }
      .ocr-card h3 {
        margin: 0 0 1rem;
        color: var(--text-primary);
      }
      .upload-btn {
        display: inline-block;
        cursor: pointer;
        padding: 0.5rem 1.25rem;
        background: var(--accent-light);
        color: var(--accent);
        border-radius: 10px;
        font-size: 0.9rem;
        border: 1.5px solid var(--accent);
      }
      .ocr-loading {
        margin-top: 0.75rem;
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      .ocr-result {
        margin-top: 1rem;
        padding: 0.75rem 1rem;
        background: #f8fff8;
        border: 1px solid #48bb78;
        border-radius: 10px;
      }
      .ocr-result p {
        margin: 0 0 0.5rem;
        font-weight: 500;
      }
      .ocr-fields {
        display: flex;
        gap: 1.5rem;
        margin-bottom: 0.75rem;
        font-size: 0.9rem;
      }
      .btn-sm {
        background: #48bb78;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0.375rem 1rem;
        cursor: pointer;
        font-size: 0.875rem;
      }

      /* ── 表單 ── */
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1.25rem;
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
      .form-row input,
      .form-row select {
        width: 100%;
        padding: 0.625rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 0.95rem;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
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
      .split-ctrl-row select {
        flex: 1;
      }
      .person-count-wrap {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-shrink: 0;
      }
      .person-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-secondary);
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
        background: var(--accent-light);
        border-radius: 10px;
        font-size: 0.9rem;
        color: var(--text-secondary);
        flex-wrap: wrap;
      }
      .per-person-box strong {
        color: var(--accent);
        font-size: 1.05rem;
      }
      .per-person-conv {
        font-size: 0.78rem;
        color: #48bb78;
        margin-left: 0.25rem;
      }

      /* 依比例分帳表 */
      .shares-empty {
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      .shares-table {
        border: 1.5px solid var(--border);
        border-radius: 10px;
        overflow: hidden;
      }
      .share-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--border);
      }
      .share-row:last-of-type {
        border-bottom: none;
      }
      .share-name-input {
        flex: 1;
        padding: 0.4rem 0.625rem !important;
        border: 1.5px solid var(--border) !important;
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
        border: 1.5px solid var(--border) !important;
        border-radius: 8px !important;
        font-size: 0.9rem !important;
        text-align: center;
      }
      .pct-sign {
        font-size: 0.85rem;
        color: var(--text-secondary);
      }
      .share-amount-cell {
        text-align: right;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--accent);
        flex-shrink: 0;
      }
      .share-conv {
        display: block;
        font-size: 0.72rem;
        font-weight: 400;
        color: #48bb78;
        margin-top: 0.1rem;
      }
      .weight-sum {
        padding: 0.4rem 0.75rem;
        font-size: 0.82rem;
        font-weight: 600;
        color: #48bb78;
        background: #f8fff8;
      }
      .weight-sum.bad {
        color: #e53e3e;
        background: #fff5f5;
      }
      .weight-warn {
        font-weight: 400;
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

      /* ── 費用清單 ── */
      .expenses-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .expense-card.card {
        padding: 1rem 1.25rem;
        cursor: pointer;
        transition: box-shadow 0.15s;
      }
      .expense-card.card:hover {
        box-shadow: 0 6px 24px var(--shadow);
      }
      .expense-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .expense-title {
        font-weight: 600;
        font-size: 1rem;
        margin-bottom: 0.25rem;
        color: var(--text-primary);
      }
      .expense-meta {
        font-size: 0.875rem;
        color: var(--text-secondary);
      }
      .converted {
        color: var(--accent);
        font-weight: 500;
        margin-left: 0.5rem;
      }
      .expense-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-shrink: 0;
      }
      .expand-icon {
        font-size: 0.7rem;
        color: var(--text-secondary);
      }
      .remove-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1rem;
        color: #e53e3e;
      }

      /* 展開：分帳明細 */
      .expense-splits {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--border);
      }
      .splits-empty {
        color: var(--text-secondary);
        font-size: 0.85rem;
        padding: 0.25rem 0;
      }
      .split-detail {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.375rem 0;
        font-size: 0.875rem;
        color: var(--text-secondary);
        border-bottom: 1px solid var(--border);
      }
      .split-detail:last-child {
        border-bottom: none;
      }
      .split-detail.is-payer {
        background: var(--accent-light);
        border-radius: 6px;
        padding: 0.375rem 0.5rem;
      }
      .split-name {
        flex: 1;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .payer-badge {
        font-size: 0.7rem;
        font-weight: 700;
        color: var(--accent);
        background: var(--accent-light);
        border-radius: 4px;
        padding: 0.1rem 0.375rem;
      }
      .split-weight {
        color: var(--accent);
        font-weight: 600;
        min-width: 3rem;
        text-align: right;
        font-size: 0.8rem;
      }
      .split-amount {
        font-weight: 600;
        color: var(--text-primary);
        min-width: 6rem;
        text-align: right;
      }

      /* ── 結算 ── */
      .settlement h3 {
        margin: 0 0 1rem;
        color: var(--text-primary);
      }
      .settle-group {
        margin-bottom: 0.75rem;
      }
      .settle-group:last-child {
        margin-bottom: 0;
      }
      .settle-group-title {
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        padding: 0.25rem 0.625rem;
        border-radius: 6px;
        display: inline-block;
        margin-bottom: 0.5rem;
      }
      .positive-title {
        background: #f0fff8;
        color: #2d8a56;
      }
      .negative-title {
        background: #fff5f5;
        color: #c53030;
      }
      .settlement-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0.625rem;
        border-radius: 8px;
        font-size: 0.95rem;
        margin-bottom: 0.25rem;
        flex-wrap: wrap;
        gap: 0.25rem;
      }
      .settlement-row.positive {
        background: #f8fffc;
      }
      .settlement-row.negative {
        background: #fff8f8;
      }
      .member-name {
        color: var(--text-primary);
        flex: 1;
        min-width: 6rem;
      }
      .settle-amounts {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
        justify-content: flex-end;
      }
      .settle-orig {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .settlement-row.positive .settle-orig {
        color: #2d8a56;
      }
      .settlement-row.negative .settle-orig {
        color: #c53030;
      }
      .settle-converted {
        font-size: 0.78rem;
        font-weight: 500;
        padding: 0.1rem 0.4rem;
        border-radius: 5px;
      }
      .settlement-row.positive .settle-converted {
        background: #e6fff2;
        color: #276749;
      }
      .settlement-row.negative .settle-converted {
        background: #fff0f0;
        color: #9b2c2c;
      }
    `,
  ],
})
export class ExpensesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private expenseService = inject(ExpenseService);
  private exchangeRateService = inject(ExchangeRateService);
  private ocrService = inject(OcrService);
  private tripService = inject(TripService);
  private fb = inject(FormBuilder);
  private pref = inject(PreferenceService);
  private transloco = inject(TranslocoService);

  tripId!: string;
  expenses = signal<Expense[]>([]);
  members = signal<TripMember[]>([]);
  grossSettlement = signal<{ receivable: GrossEntry[]; payable: GrossEntry[] }>({
    receivable: [],
    payable: [],
  });
  ocrResult = signal<{ amount: number | null; date: string | null } | null>(null);
  ocrLoading = signal(false);
  submitting = signal(false);

  readonly grossReceivable = computed(() =>
    this.grossSettlement().receivable.filter((e) => e.convertedTotal > 0.001),
  );
  readonly grossPayable = computed(() =>
    this.grossSettlement().payable.filter((e) => e.convertedTotal > 0.001),
  );

  // 分帳相關
  personCount = signal<number>(2);
  splitType = signal<'EQUAL' | 'SHARES'>('EQUAL');
  shareRows = signal<ShareRow[]>([]);
  readonly shareWeightSum = computed(() => this.shareRows().reduce((s, r) => s + r.weight, 0));
  readonly homeCurrency = computed(() => this.pref.homeCountry().currency);

  sumLabel(): string {
    return this.transloco.translate('expenses.sum', { sum: this.shareWeightSum() });
  }

  // 金額換算
  private _amountConverted = signal<number | null>(null);
  readonly amountConverted = this._amountConverted.asReadonly();

  // 展開費用明細
  expandedExpenseId = signal<string | null>(null);
  expandedSplits = signal<ExpenseSplit[]>([]);

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency_code: [this.pref.country().currency, Validators.required],
    expense_date: [new Date().toISOString().split('T')[0], Validators.required],
    payer_member_id: ['', Validators.required],
    split_type: ['EQUAL' as 'EQUAL' | 'SHARES'],
  });

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    await Promise.all([this.loadExpenses(), this.loadMembers()]);
    this.exchangeRateService.refreshIfNeeded();

    this.form.get('amount')!.valueChanges.subscribe(() => this.calcAmountConversion());
    this.form.get('currency_code')!.valueChanges.subscribe(() => this.calcAmountConversion());
  }

  private async loadExpenses(): Promise<void> {
    this.expenses.set(await this.expenseService.getByTrip(this.tripId));
    await this.computeGrossSettlement();
  }

  private async loadMembers(): Promise<void> {
    const members = await this.tripService.getMembers(this.tripId);
    this.members.set(members);
    if (members.length > 0) {
      this.form.patchValue({ payer_member_id: members[0].id });
    }
  }

  private async computeGrossSettlement(): Promise<void> {
    const expenses = this.expenses();
    // recvMap: payer_member_id → { converted: total receivable, originals: per-currency amounts }
    const recvMap = new Map<string, { converted: number; originals: Map<string, number> }>();
    // payMap: member_id → { converted: total payable, originals: per-currency amounts }
    const payMap = new Map<string, { converted: number; originals: Map<string, number> }>();

    const add = (
      map: Map<string, { converted: number; originals: Map<string, number> }>,
      memberId: string,
      conv: number,
      currency: string,
      orig: number,
    ) => {
      if (!map.has(memberId)) map.set(memberId, { converted: 0, originals: new Map() });
      const entry = map.get(memberId)!;
      entry.converted += conv;
      entry.originals.set(currency, (entry.originals.get(currency) ?? 0) + orig);
    };

    for (const expense of expenses) {
      const splits = await this.expenseService.getSplits(expense.client_record_id);
      const payerSplit = splits.find((s) => s.member_id === expense.payer_member_id);
      // Payer's receivable = total - payer's own share
      const recvConv = expense.converted_amount - (payerSplit?.converted_owed_amount ?? 0);
      const recvOrig = expense.amount - (payerSplit?.owed_amount ?? 0);
      if (recvConv > 0.001) {
        add(recvMap, expense.payer_member_id, recvConv, expense.currency_code, recvOrig);
      }
      // Each split member's payable = their owed amount
      for (const split of splits) {
        if (split.converted_owed_amount > 0.001) {
          add(
            payMap,
            split.member_id,
            split.converted_owed_amount,
            expense.currency_code,
            split.owed_amount,
          );
        }
      }
    }

    const toEntries = (
      map: Map<string, { converted: number; originals: Map<string, number> }>,
    ): GrossEntry[] =>
      [...map.entries()].map(([memberId, v]) => ({
        memberId,
        convertedTotal: Math.round(v.converted * 100) / 100,
        originals: [...v.originals.entries()].map(([currency, amount]) => ({
          currency,
          amount: Math.round(amount * 100) / 100,
        })),
      }));

    this.grossSettlement.set({ receivable: toEntries(recvMap), payable: toEntries(payMap) });
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

  // ── 展開費用明細 ────────────────────────────────
  async toggleExpand(expense: Expense): Promise<void> {
    if (this.expandedExpenseId() === expense.client_record_id) {
      this.expandedExpenseId.set(null);
      this.expandedSplits.set([]);
      return;
    }
    this.expandedExpenseId.set(expense.client_record_id);
    const splits = await this.expenseService.getSplits(expense.client_record_id);
    // 墊款人排第一
    const sorted = [...splits].sort((a, b) => {
      if (a.member_id === expense.payer_member_id) return -1;
      if (b.member_id === expense.payer_member_id) return 1;
      return 0;
    });
    this.expandedSplits.set(sorted);
  }

  // ── 分帳方式 ────────────────────────────────────
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
    this.shareRows.set(
      Array.from({ length: count }, (_, i) => ({
        memberId: members[i]?.id ?? generateId(), // 虛擬成員也給唯一 ID，避免 settlement 合算
        name: members[i]?.display_name ?? `成員 ${i + 1}`,
        weight: i === count - 1 ? eq + rem : eq,
      })),
    );
  }

  private resizeShareRows(count: number): void {
    const members = this.members();
    const existing = this.shareRows();
    let rows = existing.slice(0, count);
    while (rows.length < count) {
      const i = rows.length;
      rows.push({
        memberId: members[i]?.id ?? generateId(),
        name: members[i]?.display_name ?? `成員 ${i + 1}`,
        weight: 0,
      });
    }
    const sumExcLast = rows.slice(0, -1).reduce((s, r) => s + r.weight, 0);
    rows = [
      ...rows.slice(0, -1),
      { ...rows[rows.length - 1], weight: Math.max(0, 100 - sumExcLast) },
    ];
    this.shareRows.set(rows);
  }

  // 提交前：把不在 trip_members 裡的虛擬成員自動寫入，確保名稱與 ID 永久保存
  private async ensureShareRowMembers(): Promise<void> {
    const existingIds = new Set(this.members().map((m) => m.id));
    const rows = this.shareRows();
    const updated = [...rows];
    let created = false;

    for (let i = 0; i < updated.length; i++) {
      if (!existingIds.has(updated[i].memberId)) {
        const newMember = await this.tripService.addMember(this.tripId, updated[i].name);
        updated[i] = { ...updated[i], memberId: newMember.id };
        created = true;
      }
    }

    if (created) {
      this.shareRows.set(updated);
      await this.loadMembers(); // 重新載入，使 getMemberName 可以解析新成員
    }
  }

  updateShareRowName(index: number, name: string): void {
    this.shareRows.update((rows) => rows.map((r, i) => (i === index ? { ...r, name } : r)));
  }

  updateShareRowWeight(index: number, weight: number): void {
    this.shareRows.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, weight: Math.max(0, weight) } : r)),
    );
  }

  // ── OCR ─────────────────────────────────────────
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

  // ── 新增費用 ─────────────────────────────────────
  async addExpense(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    if (this.splitType() === 'SHARES' && this.shareWeightSum() !== 100) return;
    this.submitting.set(true);
    try {
      // 提交前確保虛擬成員已寫入 trip_members（避免 memberId 為空或找不到名稱）
      if (this.splitType() === 'SHARES') {
        await this.ensureShareRowMembers();
      }

      const { title, amount, currency_code, expense_date, payer_member_id, split_type } =
        this.form.value;
      const dateStr = expense_date!;
      const { rate } = await this.exchangeRateService.getRate(dateStr, currency_code!);

      const shareWeights =
        split_type === 'SHARES'
          ? this.shareRows().map((r) => ({ memberId: r.memberId, weight: r.weight }))
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
        currency_code: this.pref.country().currency,
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

  // ── 工具方法 ─────────────────────────────────────
  getMemberName(memberId: string): string {
    if (!memberId) return this.transloco.translate('expenses.unnamed');
    return this.members().find((m) => m.id === memberId)?.display_name ?? memberId;
  }

  async deleteExpense(id: string): Promise<void> {
    if (!confirm(this.transloco.translate('expenses.deleteConfirm'))) return;
    if (this.expandedExpenseId() === id) {
      this.expandedExpenseId.set(null);
      this.expandedSplits.set([]);
    }
    await this.expenseService.delete(id);
    await this.loadExpenses();
  }
}
