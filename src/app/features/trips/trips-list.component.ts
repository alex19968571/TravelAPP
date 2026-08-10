import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Trip } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { PreferenceService, COUNTRIES } from '../../core/services/preference.service';

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Taipei', label: '台北 (UTC+8)' },
  { value: 'Asia/Tokyo', label: '東京 (UTC+9)' },
  { value: 'Asia/Seoul', label: '首爾 (UTC+9)' },
  { value: 'Asia/Shanghai', label: '上海 (UTC+8)' },
  { value: 'Asia/Bangkok', label: '曼谷 (UTC+7)' },
  { value: 'Asia/Ho_Chi_Minh', label: '胡志明 (UTC+7)' },
  { value: 'Asia/Singapore', label: '新加坡 (UTC+8)' },
  { value: 'Asia/Kuala_Lumpur', label: '吉隆坡 (UTC+8)' },
  { value: 'Asia/Jakarta', label: '雅加達 (UTC+7)' },
  { value: 'Australia/Sydney', label: '雪梨 (UTC+10)' },
  { value: 'Europe/London', label: '倫敦 (UTC+0)' },
  { value: 'Europe/Paris', label: '巴黎 (UTC+1)' },
  { value: 'Europe/Berlin', label: '柏林 (UTC+1)' },
  { value: 'Europe/Rome', label: '羅馬 (UTC+1)' },
  { value: 'America/New_York', label: '紐約 (UTC-5)' },
  { value: 'America/Toronto', label: '多倫多 (UTC-5)' },
];

const CURRENCY_OPTIONS = [
  { value: 'TWD', label: 'TWD 台幣' },
  { value: 'JPY', label: 'JPY 日圓' },
  { value: 'KRW', label: 'KRW 韓圓' },
  { value: 'CNY', label: 'CNY 人民幣' },
  { value: 'THB', label: 'THB 泰銖' },
  { value: 'VND', label: 'VND 越南盾' },
  { value: 'SGD', label: 'SGD 新幣' },
  { value: 'MYR', label: 'MYR 馬幣' },
  { value: 'IDR', label: 'IDR 盾' },
  { value: 'AUD', label: 'AUD 澳幣' },
  { value: 'GBP', label: 'GBP 英鎊' },
  { value: 'EUR', label: 'EUR 歐元' },
  { value: 'USD', label: 'USD 美元' },
  { value: 'CAD', label: 'CAD 加元' },
  { value: 'CHF', label: 'CHF 瑞郎' },
];

@Component({
  selector: 'app-trips-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <!-- 篩選列（左）+ '+' 選單（右） -->
      <div class="list-toolbar">
        <div class="filter-bar">
          <div class="select-wrap filter-year">
            <select
              [ngModel]="filterYear()"
              (ngModelChange)="filterYear.set($event)"
              name="filterYear"
            >
              <option value="">{{ 'trips.filterAllYears' | transloco }}</option>
              @for (y of availableYears(); track y) {
                <option [value]="y">{{ y }}</option>
              }
            </select>
            <span class="select-caret">▾</span>
          </div>
          <div class="select-wrap filter-month">
            <select
              [ngModel]="filterMonth()"
              (ngModelChange)="filterMonth.set($event)"
              name="filterMonth"
            >
              <option value="">{{ 'trips.filterAllMonths' | transloco }}</option>
              @for (mo of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; track mo) {
                <option [value]="mo">{{ mo }}</option>
              }
            </select>
            <span class="select-caret">▾</span>
          </div>
          <div class="country-picker filter-country" [class.open]="showCountryPicker()">
            <button
              class="country-trigger"
              type="button"
              (click)="showCountryPicker.set(!showCountryPicker())"
            >
              @if (filterCountryCode()) {
                <span class="fi fi-{{ filterCountryCode().toLowerCase() }}"></span>
              }
              <span class="cname">{{
                filterCountryLabel() || ('trips.filterAllCountries' | transloco)
              }}</span>
              <span class="caret" [class.flipped]="showCountryPicker()">▾</span>
            </button>
            <div class="country-dropdown">
              <button
                class="country-option"
                [class.selected]="!filterCountryCode()"
                (click)="filterCountryCode.set(''); showCountryPicker.set(false)"
              >
                <span>{{ 'trips.filterAllCountries' | transloco }}</span>
              </button>
              @for (c of countries; track c.code) {
                <button
                  class="country-option"
                  [class.selected]="c.code === filterCountryCode()"
                  (click)="filterCountryCode.set(c.code); showCountryPicker.set(false)"
                >
                  <span class="fi fi-{{ c.code.toLowerCase() }}"></span>
                  <span>{{ c.nativeName }}</span>
                </button>
              }
            </div>
          </div>
        </div>
        <div class="add-menu" [class.open]="showAddMenu()">
          <button class="btn-icon" (click)="toggleAddMenu($event)">＋</button>
          <div class="add-dropdown">
            <button class="add-option" (click)="openJoinPrompt()">
              🔑 {{ 'trips.enterInviteCode' | transloco }}
            </button>
            <button class="add-option" (click)="openCreateForm()">
              🗺️ {{ 'trips.create' | transloco }}
            </button>
          </div>
        </div>
      </div>

      @if (showJoin()) {
        <form class="card join-form" (ngSubmit)="submitJoin()">
          <h3>{{ 'trips.enterInviteCode' | transloco }}</h3>
          <div class="form-row">
            <label>{{ 'trips.inviteCode' | transloco }}</label>
            <input
              [ngModel]="joinCode()"
              (ngModelChange)="joinCode.set($event)"
              name="joinCode"
              [placeholder]="'trips.inviteCodePlaceholder' | transloco"
              style="text-transform: uppercase;"
            />
          </div>
          @if (joinError()) {
            <p class="join-error">{{ 'trips.joinError' | transloco }}</p>
          }
          <div class="form-actions">
            <button type="button" class="btn-secondary" (click)="showJoin.set(false)">
              {{ 'trips.cancel' | transloco }}
            </button>
            <button type="submit" class="btn-primary" [disabled]="!joinCode().trim() || joining()">
              {{ (joining() ? 'trips.joining' : 'trips.join') | transloco }}
            </button>
          </div>
        </form>
      }

      @if (showForm()) {
        <form [formGroup]="form" (ngSubmit)="createTrip()" class="trip-form card">
          <h3>{{ 'trips.create' | transloco }}</h3>
          <div class="form-row">
            <label>{{ 'trips.titleLabel' | transloco }}</label>
            <input formControlName="title" [placeholder]="'trips.titlePlaceholder' | transloco" />
          </div>
          <div class="form-row-grid">
            <div class="form-row">
              <label>{{ 'trips.startDate' | transloco }}</label>
              <input formControlName="start_date_local" type="datetime-local" />
            </div>
            <div class="form-row">
              <label>{{ 'trips.endDate' | transloco }}</label>
              <input formControlName="end_date_local" type="datetime-local" />
            </div>
          </div>
          <div class="form-row">
            <label>{{ 'trips.timezone' | transloco }}</label>
            <div class="select-wrap">
              <select formControlName="target_timezone">
                @for (o of timezoneOptions; track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
              <span class="select-caret">▾</span>
            </div>
          </div>
          <div class="form-row">
            <label>{{ 'trips.currency' | transloco }}</label>
            <div class="select-wrap">
              <select formControlName="base_currency">
                @for (o of currencyOptions; track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
              <span class="select-caret">▾</span>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" (click)="showForm.set(false)">
              {{ 'trips.cancel' | transloco }}
            </button>
            <button type="submit" class="btn-primary" [disabled]="form.invalid">
              {{ 'trips.submit' | transloco }}
            </button>
          </div>
        </form>
      }

      @if (filteredTrips().length === 0) {
        <div class="empty-state">
          <p>🗺️</p>
          <p>{{ 'trips.noTrips' | transloco }}</p>
        </div>
      }

      <div class="trips-grid">
        @for (trip of filteredTrips(); track trip.id) {
          <div class="trip-card-wrap">
            <button class="swipe-delete" (click)="confirmDeleteTrip(trip)">
              {{ 'trips.delete' | transloco }}
            </button>
            <div
              class="trip-card card"
              [class.swiped]="swipedTripId() === trip.id"
              (touchstart)="onTouchStart($event)"
              (touchmove)="onTouchMove($event)"
              (touchend)="onTouchEnd($event, trip)"
              (click)="onCardClick(trip)"
            >
              <button
                class="info-btn"
                (click)="openEditTrip(trip); $event.stopPropagation()"
              >
                ⓘ
              </button>
              <div class="trip-card-body">
                <div class="trip-info">
                  <div class="trip-route">{{ trip.target_timezone }}</div>
                  <h3>{{ trip.title }}</h3>
                </div>
                <div class="trip-stub">
                  @if (formatDateRange(trip); as range) {
                    <div class="trip-dates">{{ range }}</div>
                  }
                  <div class="trip-currency">{{ trip.base_currency }}</div>
                </div>
              </div>
              <div class="trip-perf-h"></div>
              <div class="trip-nav">
                <a
                  [routerLink]="['/trips', trip.id]"
                  class="nav-btn"
                  (click)="$event.stopPropagation()"
                  >{{ 'trips.itinerary' | transloco }}</a
                >
                <a
                  [routerLink]="['/trips', trip.id, 'shopping']"
                  class="nav-btn"
                  (click)="$event.stopPropagation()"
                  >{{ 'trips.shopping' | transloco }}</a
                >
                <a
                  [routerLink]="['/trips', trip.id, 'expenses']"
                  class="nav-btn"
                  (click)="$event.stopPropagation()"
                  >{{ 'trips.expenses' | transloco }}</a
                >
                <a
                  [routerLink]="['/trips', trip.id, 'members']"
                  class="nav-btn"
                  (click)="$event.stopPropagation()"
                  >{{ 'tripDetail.members' | transloco }}</a
                >
              </div>
            </div>
          </div>
        }
      </div>


      @if (editingTrip(); as et) {
        <div class="modal-backdrop" (click)="closeEditTrip()">
          <div class="modal-card edit-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ 'trips.edit' | transloco }}</h3>
              <button class="trash-btn" (click)="confirmDeleteTrip(et)">🗑</button>
            </div>
            <form [formGroup]="editForm" (ngSubmit)="saveEditTrip(et.id)">
              <div class="form-row">
                <label>{{ 'trips.titleLabel' | transloco }}</label>
                <input formControlName="title" />
              </div>
              <div class="form-row-grid">
                <div class="form-row">
                  <label>{{ 'trips.startDate' | transloco }}</label>
                  <input formControlName="start_date_local" type="datetime-local" />
                </div>
                <div class="form-row">
                  <label>{{ 'trips.endDate' | transloco }}</label>
                  <input formControlName="end_date_local" type="datetime-local" />
                </div>
              </div>
              <div class="form-row">
                <label>{{ 'trips.timezone' | transloco }}</label>
                <div class="select-wrap">
                  <select formControlName="target_timezone">
                    @for (o of timezoneOptions; track o.value) {
                      <option [value]="o.value">{{ o.label }}</option>
                    }
                  </select>
                  <span class="select-caret">▾</span>
                </div>
              </div>
              <div class="form-row">
                <label>{{ 'trips.currency' | transloco }}</label>
                <div class="select-wrap">
                  <select formControlName="base_currency">
                    @for (o of currencyOptions; track o.value) {
                      <option [value]="o.value">{{ o.label }}</option>
                    }
                  </select>
                  <span class="select-caret">▾</span>
                </div>
              </div>
              <div class="form-actions">
                <button type="button" class="btn-secondary" (click)="closeEditTrip()">
                  {{ 'trips.cancel' | transloco }}
                </button>
                <button type="submit" class="btn-primary" [disabled]="editForm.invalid">
                  {{ 'common.save' | transloco }}
                </button>
              </div>
            </form>
          </div>
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
      .page-title {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 1rem;
      }

      .btn-icon {
        background: var(--icon-bg);
        color: var(--accent);
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        cursor: pointer;
        font-size: 1.2rem;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      }
      .btn-icon:hover {
        background: var(--icon-bg-hover);
      }

      /* ── 行程列表工具列（+ 選單） ── */
      .list-toolbar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.6rem;
        margin-bottom: 0.75rem;
      }
      .filter-bar {
        display: flex;
        gap: 0.5rem;
        flex: 1;
        min-width: 0;
      }
      .filter-year select,
      .filter-month select {
        padding: 0.5rem 1.75rem 0.5rem 0.6rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 0.8rem;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
        appearance: none;
        -webkit-appearance: none;
      }
      .filter-year {
        width: 78px;
      }
      .filter-month {
        width: 64px;
      }
      .filter-country {
        flex: 1;
        min-width: 0;
        position: relative;
      }
      .filter-country .country-trigger {
        width: 100%;
      }
      .country-trigger {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        background: var(--input-bg);
        color: var(--text-primary);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        padding: 0.5rem 0.6rem;
        cursor: pointer;
        font-size: 0.8rem;
        white-space: nowrap;
      }
      .country-trigger:hover,
      .country-picker.open .country-trigger {
        border-color: var(--accent);
      }
      .fi {
        width: 1.2em;
        flex-shrink: 0;
        border-radius: 2px;
      }
      .cname {
        flex: 1;
        min-width: 0;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .caret {
        font-size: 0.65rem;
        color: var(--text-secondary);
        transition: transform 0.2s;
        flex-shrink: 0;
      }
      .caret.flipped {
        transform: rotate(180deg);
      }
      .country-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 32px var(--shadow);
        max-height: 260px;
        overflow-y: auto;
        z-index: 100;
        display: none;
      }
      .country-picker.open .country-dropdown {
        display: block;
      }
      .country-option {
        gap: 0.6rem;
        padding: 0.625rem 1rem;
        font-size: 0.85rem;
      }
      .country-option:hover {
        background: var(--accent-light);
      }
      .country-option.selected {
        background: var(--accent-light);
        color: var(--accent);
        font-weight: 600;
      }
      .add-menu {
        position: relative;
      }
      .add-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 32px var(--shadow);
        min-width: 200px;
        z-index: 100;
        display: none;
        padding: 0.4rem;
      }
      .add-menu.open .add-dropdown {
        display: block;
      }
      .add-option,
      .country-option {
        display: flex;
        align-items: center;
        width: 100%;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        color: var(--text-primary);
      }
      .add-option {
        gap: 0.5rem;
        padding: 0.625rem 0.75rem;
        font-size: 0.875rem;
        border-radius: 8px;
      }
      .add-option:hover {
        background: var(--accent-light);
      }
      .join-error {
        color: #e53e3e;
        font-size: 0.85rem;
        margin: -0.5rem 0 1rem;
      }

      /* ── Cards ── */
      .card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 4px 20px var(--shadow);
        margin-bottom: 1rem;
      }
      .trip-form h3 {
        margin: 0 0 1rem;
        color: var(--text-primary);
      }
      .form-row {
        margin-bottom: 1rem;
      }
      .form-row-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .form-row label {
        display: block;
        font-weight: 500;
        margin-bottom: 0.35rem;
        color: var(--text-secondary);
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

      /* ── 下拉選單：套用與國家選單一致的箭頭圖示 ── */
      .select-wrap {
        position: relative;
      }
      .select-wrap select {
        width: 100%;
        padding: 0.625rem 2.25rem 0.625rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 0.95rem;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
        appearance: none;
        -webkit-appearance: none;
      }
      .select-wrap .select-caret {
        position: absolute;
        right: 0.875rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.7rem;
        color: var(--text-secondary);
        pointer-events: none;
      }

      .form-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
      }
      .btn-primary,
      .btn-secondary {
        border: none;
        border-radius: 10px;
        padding: 0.625rem 1.5rem;
        cursor: pointer;
      }
      .btn-primary {
        background: var(--accent);
        color: white;
        font-weight: 600;
      }
      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn-secondary {
        background: var(--accent-light);
        color: var(--text-secondary);
      }
      .empty-state {
        text-align: center;
        padding: 4rem 2rem;
        color: var(--text-secondary);
        font-size: 1.1rem;
      }
      .empty-state p:first-child {
        font-size: 3rem;
      }
      .trips-grid {
        display: grid;
        gap: 1rem;
      }

      /* ── 行程卡片 + 左滑刪除 ── */
      .trip-card-wrap {
        position: relative;
        overflow: hidden;
        border-radius: 16px;
      }
      .swipe-delete {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 88px;
        background: #e53e3e;
        color: white;
        border: none;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        display: none;
      }
      .trip-card.card {
        padding: 0;
        margin-bottom: 0;
        position: relative;
        display: flex;
        flex-direction: column;
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
        overflow: hidden;
      }
      .trip-card.card:hover,
      .trip-card.card:active {
        transform: translateY(-4px);
        box-shadow: 0 18px 36px var(--shadow);
      }
      .trip-card-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.6rem;
        padding: 1.35rem 1.25rem 1.5rem;
        cursor: pointer;
      }
      .trip-info {
        min-width: 0;
        width: 100%;
      }
      .trip-route {
        font-family: var(--font-mono);
        font-size: 0.68rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-secondary);
        margin-bottom: 0.35rem;
      }
      .trip-info h3 {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans TC', sans-serif;
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0;
        color: var(--text-primary);
      }
      .trip-perf-h {
        position: relative;
        height: 1px;
        margin: 0 1.25rem;
        background-image: linear-gradient(90deg, var(--border) 60%, transparent 0%);
        background-size: 8px 1px;
        background-repeat: repeat-x;
      }
      .trip-perf-h::before,
      .trip-perf-h::after {
        content: '';
        position: absolute;
        top: -7px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--bg);
        border: 1px solid var(--border);
      }
      .trip-perf-h::before {
        left: -7px;
      }
      .trip-perf-h::after {
        right: -7px;
      }
      .trip-stub {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.15rem;
        padding-top: 0.3rem;
      }
      .trip-dates {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        color: var(--text-primary);
        font-size: 1.15rem;
        font-weight: 700;
        white-space: nowrap;
      }
      .trip-currency {
        font-family: var(--font-mono);
        font-size: 0.72rem;
        color: var(--accent);
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .info-btn {
        position: absolute;
        top: 0.6rem;
        right: 0.6rem;
        z-index: 5;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--icon-bg);
        color: var(--text-secondary);
        border: none;
        font-size: 0.72rem;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        transition: background 0.15s;
      }
      .info-btn:hover {
        background: var(--icon-bg-hover);
      }
      .trip-nav {
        display: flex;
      }
      .nav-btn {
        flex: 1;
        text-align: center;
        padding: 0.75rem 0.4rem;
        border: none;
        cursor: pointer;
        background: none;
        color: var(--text-secondary);
        font-weight: 600;
        text-decoration: none;
        font-size: 0.78rem;
      }
      .nav-btn:hover,
      .nav-btn:active {
        color: var(--accent);
      }

      @media (hover: none) and (pointer: coarse) {
        .desktop-only {
          display: none !important;
        }
        .swipe-delete {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .trip-card.swiped {
          transform: translateX(-88px);
        }
      }

      /* ── 彈窗 ── */
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
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        max-width: 380px;
        width: 100%;
        box-shadow: 0 12px 40px var(--shadow);
      }
      .modal-card h3 {
        margin: 0;
        color: var(--text-primary);
      }
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }
      .trash-btn {
        background: #fff0f0;
        color: #e53e3e;
        border: none;
        border-radius: 8px;
        width: 34px;
        height: 34px;
        font-size: 1rem;
        cursor: pointer;
      }
      .action-sheet {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 0.75rem;
      }
      .action-item {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        width: 100%;
        padding: 0.75rem 1rem;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        color: var(--text-primary);
        font-size: 0.95rem;
        border-radius: 10px;
      }
      .action-item:hover {
        background: var(--accent-light);
      }

      /* 編輯視窗：容器較窄，日期欄位固定單欄，避免 datetime-local 原生控件把版面撐壞 */
      .edit-modal {
        max-width: 420px;
      }
      .edit-modal .form-row-grid {
        grid-template-columns: 1fr;
      }

      @media (max-width: 600px) {
        .form-row-grid {
          grid-template-columns: 1fr;
        }
        .trip-card.card {
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class TripsListComponent implements OnInit {
  @ViewChild('avatarInput') avatarInputRef?: ElementRef<HTMLInputElement>;

  tripService = inject(TripService);
  pref = inject(PreferenceService);
  fb = inject(FormBuilder);
  private router = inject(Router);

  timezoneOptions = TIMEZONE_OPTIONS;
  currencyOptions = CURRENCY_OPTIONS;

  isTouch =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  trips = signal<Trip[]>([]);
  countries = COUNTRIES;
  filterYear = signal('');
  filterMonth = signal('');
  filterCountryCode = signal('');
  showCountryPicker = signal(false);

  availableYears = computed(() => {
    const years = new Set<number>();
    for (const t of this.trips()) {
      if (t.start_date_utc) years.add(new Date(t.start_date_utc).getFullYear());
    }
    return [...years].sort((a, b) => b - a);
  });

  filterCountryLabel = computed(
    () => this.countries.find((c) => c.code === this.filterCountryCode())?.nativeName ?? '',
  );

  tripCountry(trip: Trip): (typeof COUNTRIES)[number] | undefined {
    return (
      COUNTRIES.find((c) => c.timezone === trip.target_timezone) ??
      COUNTRIES.find((c) => c.currency === trip.base_currency)
    );
  }

  filteredTrips = computed(() => {
    const year = this.filterYear() ? +this.filterYear() : null;
    const month = this.filterMonth() ? +this.filterMonth() : null;
    const countryCode = this.filterCountryCode();

    return this.trips().filter((t) => {
      if (year) {
        const start = t.start_date_utc ? new Date(t.start_date_utc) : null;
        if (!start) return false;
        const end = t.end_date_utc ? new Date(t.end_date_utc) : start;
        const rangeStart = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
        const rangeEnd = month
          ? new Date(year, month, 0, 23, 59, 59)
          : new Date(year, 11, 31, 23, 59, 59);
        if (end < rangeStart || start > rangeEnd) return false;
      }
      if (countryCode) {
        const c = this.tripCountry(t);
        if (!c || c.code !== countryCode) return false;
      }
      return true;
    });
  });

  showForm = signal(false);
  showAddMenu = signal(false);
  showJoin = signal(false);
  joinCode = signal('');
  joinError = signal(false);
  joining = signal(false);
  swipedTripId = signal<string | null>(null);
  editingTrip = signal<Trip | null>(null);

  private touchStartX = 0;
  private touchDeltaX = 0;

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    start_date_local: [''],
    end_date_local: [''],
    target_timezone: [this.pref.country().timezone, Validators.required],
    base_currency: [this.pref.country().currency, Validators.required],
  });

  editForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    start_date_local: [''],
    end_date_local: [''],
    target_timezone: ['', Validators.required],
    base_currency: ['', Validators.required],
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const target = e.target as Node;
    if (!document.querySelector('.add-menu')?.contains(target)) this.showAddMenu.set(false);
  }

  toggleAddMenu(e: MouseEvent): void {
    e.stopPropagation();
    this.showAddMenu.set(!this.showAddMenu());
  }

  openJoinPrompt(): void {
    this.showAddMenu.set(false);
    this.showForm.set(false);
    this.joinCode.set('');
    this.joinError.set(false);
    this.showJoin.set(true);
  }

  openCreateForm(): void {
    this.showAddMenu.set(false);
    this.showJoin.set(false);
    this.showForm.set(true);
  }

  async submitJoin(): Promise<void> {
    const code = this.joinCode().trim();
    if (!code) return;
    this.joining.set(true);
    this.joinError.set(false);
    try {
      const tripId = await this.tripService.joinByInviteCode(code);
      if (tripId) {
        this.showJoin.set(false);
        await this.loadTrips();
      } else {
        this.joinError.set(true);
      }
    } finally {
      this.joining.set(false);
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadTrips();
  }

  async loadTrips(): Promise<void> {
    this.trips.set(await this.tripService.getAll());
  }

  async createTrip(): Promise<void> {
    if (this.form.invalid) return;
    const { title, target_timezone, base_currency, start_date_local, end_date_local } =
      this.form.value;
    await this.tripService.create({
      title: title!,
      target_timezone: target_timezone!,
      base_currency: base_currency!,
      start_date_utc: start_date_local ? new Date(start_date_local).toISOString() : undefined,
      end_date_utc: end_date_local ? new Date(end_date_local).toISOString() : undefined,
    });
    this.form.reset({
      target_timezone: this.pref.country().timezone,
      base_currency: this.pref.country().currency,
      start_date_local: '',
      end_date_local: '',
    });
    this.showForm.set(false);
    await this.loadTrips();
  }

  // ── 卡片互動 ──────────────────────────────────────────
  onCardClick(trip: Trip): void {
    this.router.navigate(['/trips', trip.id]);
  }

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
    this.touchDeltaX = 0;
  }

  onTouchMove(e: TouchEvent): void {
    this.touchDeltaX = e.touches[0].clientX - this.touchStartX;
  }

  onTouchEnd(e: TouchEvent, trip: Trip): void {
    if (this.touchDeltaX < -40) {
      e.preventDefault();
      this.swipedTripId.set(trip.id);
      return;
    }
    if (this.swipedTripId() === trip.id) {
      e.preventDefault();
      this.swipedTripId.set(null);
      return;
    }
  }

  // ── 日期顯示 ──────────────────────────────────────────
  formatDateRange(trip: Trip): string {
    if (!trip.start_date_utc) return '';
    const fmt = (iso: string) => {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    };
    const start = fmt(trip.start_date_utc);
    if (!trip.end_date_utc || trip.end_date_utc === trip.start_date_utc) return start;
    return `${start} ~ ${fmt(trip.end_date_utc)}`;
  }

  // ── 編輯 / 刪除 ────────────────────────────────────────
  private toLocalInput(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  openEditTrip(trip: Trip): void {
    this.editForm.reset({
      title: trip.title,
      start_date_local: this.toLocalInput(trip.start_date_utc),
      end_date_local: this.toLocalInput(trip.end_date_utc),
      target_timezone: trip.target_timezone,
      base_currency: trip.base_currency,
    });
    this.editingTrip.set(trip);
  }

  closeEditTrip(): void {
    this.editingTrip.set(null);
  }

  async saveEditTrip(id: string): Promise<void> {
    if (this.editForm.invalid) return;
    const { title, target_timezone, base_currency, start_date_local, end_date_local } =
      this.editForm.value;
    await this.tripService.update(id, {
      title: title!,
      target_timezone: target_timezone!,
      base_currency: base_currency!,
      start_date_utc: start_date_local ? new Date(start_date_local).toISOString() : null,
      end_date_utc: end_date_local ? new Date(end_date_local).toISOString() : null,
    });
    this.editingTrip.set(null);
    await this.loadTrips();
  }

  async confirmDeleteTrip(trip: Trip): Promise<void> {
    if (!confirm('確定刪除此行程？相關購物清單與記帳也會一併刪除。')) return;
    await this.tripService.delete(trip.id);
    this.swipedTripId.set(null);
    this.editingTrip.set(null);
    await this.loadTrips();
  }
}
