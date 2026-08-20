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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ReminderOffsetType, Trip } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { TripReminderService } from '../../core/services/trip-reminder.service';
import { AuthService } from '../../core/services/auth.service';
import { PreferenceService, COUNTRIES } from '../../core/services/preference.service';
import { PageTransitionService } from '../../core/services/page-transition.service';
import { DropdownSelectComponent } from '../../shared/components/dropdown-select/dropdown-select.component';

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Taipei', key: 'taipei', utc: '+8' },
  { value: 'Asia/Tokyo', key: 'tokyo', utc: '+9' },
  { value: 'Asia/Seoul', key: 'seoul', utc: '+9' },
  { value: 'Asia/Shanghai', key: 'shanghai', utc: '+8' },
  { value: 'Asia/Bangkok', key: 'bangkok', utc: '+7' },
  { value: 'Asia/Ho_Chi_Minh', key: 'hoChiMinh', utc: '+7' },
  { value: 'Asia/Singapore', key: 'singapore', utc: '+8' },
  { value: 'Asia/Kuala_Lumpur', key: 'kualaLumpur', utc: '+8' },
  { value: 'Asia/Jakarta', key: 'jakarta', utc: '+7' },
  { value: 'Australia/Sydney', key: 'sydney', utc: '+10' },
  { value: 'Europe/London', key: 'london', utc: '+0' },
  { value: 'Europe/Paris', key: 'paris', utc: '+1' },
  { value: 'Europe/Berlin', key: 'berlin', utc: '+1' },
  { value: 'Europe/Rome', key: 'rome', utc: '+1' },
  { value: 'America/New_York', key: 'newYork', utc: '-5' },
  { value: 'America/Toronto', key: 'toronto', utc: '-5' },
];

const CURRENCY_OPTIONS = [
  { value: 'TWD', key: 'twd' },
  { value: 'JPY', key: 'jpy' },
  { value: 'KRW', key: 'krw' },
  { value: 'CNY', key: 'cny' },
  { value: 'THB', key: 'thb' },
  { value: 'VND', key: 'vnd' },
  { value: 'SGD', key: 'sgd' },
  { value: 'MYR', key: 'myr' },
  { value: 'IDR', key: 'idr' },
  { value: 'AUD', key: 'aud' },
  { value: 'GBP', key: 'gbp' },
  { value: 'EUR', key: 'eur' },
  { value: 'USD', key: 'usd' },
  { value: 'CAD', key: 'cad' },
  { value: 'CHF', key: 'chf' },
];

@Component({
  selector: 'app-trips-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    TranslocoModule,
    DropdownSelectComponent,
  ],
  template: `
    <div class="page-container">
      <!-- 篩選列（左）+ '+' 選單（右） -->
      <div class="list-toolbar">
        <div class="filter-bar">
          <app-dropdown-select
            class="filter-year"
            [options]="yearOptions()"
            [ngModel]="filterYear()"
            (ngModelChange)="filterYear.set($event)"
            name="filterYear"
          ></app-dropdown-select>
          <app-dropdown-select
            class="filter-month"
            [options]="monthOptions()"
            [ngModel]="filterMonth()"
            (ngModelChange)="filterMonth.set($event)"
            name="filterMonth"
          ></app-dropdown-select>
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
          <button class="btn-icon" (click)="toggleAddMenu()">＋</button>
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

      <div class="page-scroll">
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
                {{ 'common.cancel' | transloco }}
              </button>
              <button
                type="submit"
                class="btn-primary"
                [disabled]="!joinCode().trim() || joining()"
              >
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
              <app-dropdown-select
                [options]="timezoneDropdownOptions()"
                formControlName="target_timezone"
              ></app-dropdown-select>
            </div>
            <div class="form-row">
              <label>{{ 'trips.currency' | transloco }}</label>
              <app-dropdown-select
                [options]="currencyDropdownOptions()"
                formControlName="base_currency"
              ></app-dropdown-select>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="showForm.set(false)">
                {{ 'common.cancel' | transloco }}
              </button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid">
                {{ 'trips.submit' | transloco }}
              </button>
            </div>
          </form>
        }

        @if (filteredTrips().length === 0) {
          <div class="empty-state">
            <p>{{ 'trips.noTrips' | transloco }}</p>
          </div>
        }

        <div class="trips-grid">
          @for (trip of filteredTrips(); track trip.id) {
            <div class="trip-card-slot">
              <div class="trip-card-wrap">
                <div
                  class="trip-card card"
                  [class.dragging]="isLiveDragging() && dragTripId() === trip.id"
                  [ngStyle]="cardDragStyle(trip)"
                  (pointerdown)="onCardPointerDown($event, trip)"
                  (pointermove)="onCardPointerMove($event, trip)"
                  (pointerup)="onCardPointerUp($event, trip)"
                  (pointerleave)="onCardPointerCancel()"
                  (pointercancel)="onCardPointerCancel()"
                  (contextmenu)="$event.preventDefault()"
                  (click)="onCardClick(trip)"
                >
                  <button class="info-btn" (click)="openEditTrip(trip); $event.stopPropagation()">
                    ⓘ
                  </button>
                  <button
                    class="reminder-btn"
                    type="button"
                    [attr.aria-label]="'trips.reminder.title' | transloco"
                    (click)="openReminderModal(trip); $event.stopPropagation()"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path
                        d="M12 2a6 6 0 0 0-6 6v3.09c0 .68-.24 1.34-.68 1.86L4 15h16l-1.32-2.05a3 3 0 0 1-.68-1.86V8a6 6 0 0 0-6-6zm0 20a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22z"
                      />
                    </svg>
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

                @if (longPressedTripId() === trip.id) {
                  <div class="delete-overlay" (click)="cancelLongPress()">
                    <button
                      type="button"
                      class="delete-overlay-btn"
                      [attr.aria-label]="'trips.delete' | transloco"
                      (click)="onDeleteBtnClick(trip, $event)"
                    >
                      🗑
                    </button>
                  </div>
                }
              </div>

              <button
                type="button"
                class="scrapbook-btn"
                [class.dragging]="isLiveDragging() && dragTripId() === trip.id"
                [ngStyle]="reelDragStyle(trip)"
                [attr.aria-label]="'scrapbook.title' | transloco"
                (click)="onScrapbookBtnClick(trip, $event)"
              >
                <span class="film-frame"></span>
              </button>
            </div>
          }
        </div>
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
                <app-dropdown-select
                  [options]="timezoneDropdownOptions()"
                  formControlName="target_timezone"
                ></app-dropdown-select>
              </div>
              <div class="form-row">
                <label>{{ 'trips.currency' | transloco }}</label>
                <app-dropdown-select
                  [options]="currencyDropdownOptions()"
                  formControlName="base_currency"
                ></app-dropdown-select>
              </div>
              <div class="form-actions">
                <button type="button" class="btn-secondary" (click)="closeEditTrip()">
                  {{ 'common.cancel' | transloco }}
                </button>
                <button type="submit" class="btn-primary" [disabled]="editForm.invalid">
                  {{ 'common.save' | transloco }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      @if (reminderTrip(); as rt) {
        <div class="modal-backdrop" (click)="closeReminderModal()">
          <div
            class="modal-card reminder-modal modal-card-compact"
            (click)="$event.stopPropagation()"
          >
            <div class="scale-wrap" #reminderScaleWrap>
              <div class="modal-header">
                <h3>{{ 'trips.reminder.title' | transloco }}</h3>
              </div>
              <div class="form-row">
                <label>{{ 'trips.reminder.when' | transloco }}</label>
                <app-dropdown-select
                  [options]="reminderOffsetDropdownOptions()"
                  [multiple]="true"
                  [placeholder]="'trips.reminder.whenPlaceholder' | transloco"
                  [ngModel]="reminderSelectedOffsets()"
                  (ngModelChange)="reminderSelectedOffsets.set($event); reminderSaveError.set(false)"
                  name="reminderOffsets"
                ></app-dropdown-select>
              </div>
              @if (isReminderOffsetSelected('custom')) {
                <div class="form-row">
                  <label>{{ 'trips.reminder.customDateTime' | transloco }}</label>
                  <input
                    type="datetime-local"
                    [ngModel]="reminderCustomDateTime()"
                    (ngModelChange)="reminderCustomDateTime.set($event)"
                    name="reminderCustomDateTime"
                  />
                </div>
              }
              <div class="form-row">
                <label>{{ 'trips.reminder.email' | transloco }}</label>
                <input
                  type="email"
                  [ngModel]="reminderEmail()"
                  (ngModelChange)="reminderEmail.set($event)"
                  name="reminderEmail"
                />
              </div>
              <div class="form-row reminder-toggle-row">
                <label>{{ 'trips.reminder.enable' | transloco }}</label>
                <button
                  type="button"
                  class="pill-switch"
                  [class.on]="reminderEnabled()"
                  [attr.aria-pressed]="reminderEnabled()"
                  (click)="reminderEnabled.set(!reminderEnabled())"
                >
                  <span class="pill-knob"></span>
                </button>
              </div>
              @if (reminderSaveError()) {
                <p class="reminder-error">{{ 'trips.reminder.needDate' | transloco }}</p>
              }
              <div class="form-actions">
                <button type="button" class="btn-secondary" (click)="closeReminderModal()">
                  {{ 'common.cancel' | transloco }}
                </button>
                <button
                  type="button"
                  class="btn-primary"
                  [disabled]="savingReminder()"
                  (click)="saveReminder(rt)"
                >
                  {{ 'common.save' | transloco }}
                </button>
              </div>
            </div>
          </div>
        </div>
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
        flex-shrink: 0;
        background: var(--bg);
        padding-top: 0.5rem;
        margin-top: -0.5rem;
        /* 網頁版：跟 .trips-grid 的右側膠捲手勢留白 (padding-right: 100px) 對齊，
           讓工具列與下方行程卡片右邊緣切齊，手機版在 @media (max-width: 600px) 內重設為 0 */
        margin-right: 100px;
      }
      .filter-bar {
        display: flex;
        gap: 0.5rem;
        flex: 9 1 0;
        min-width: 0;
      }
      .filter-year {
        flex: 2 1 0;
        min-width: 0;
      }
      .filter-month {
        flex: 2 1 0;
        min-width: 0;
      }
      .filter-country {
        flex: 5 1 0;
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
        flex: 1 1 0;
        display: flex;
        justify-content: flex-end;
        align-items: center;
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
      .trip-form.card {
        /* 網頁版：跟 .trips-grid 的右側留白對齊，手機版在 @media (max-width: 600px) 內重設為 0 */
        margin-right: 100px;
      }
      .form-row {
        margin-bottom: 1rem;
        overflow-x: hidden;
        max-width: 100%;
      }
      .form-row-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        min-width: 0;
      }
      .form-row-grid > .form-row {
        min-width: 0;
      }
      .form-row label {
        display: block;
        font-weight: 500;
        margin-bottom: 0.35rem;
        color: var(--text-secondary);
      }
      .form-row input {
        width: 100%;
        min-width: 0;
        padding: 0.625rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 16px;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
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
      .trips-grid {
        display: grid;
        gap: 1rem;
        /* 保留右側 gutter：讓行程剪貼簿膠捲可以露出在卡片外面，
           又不會被 .page-container / .page-scroll 的捲動裁切吃掉
          （那兩層有設 overflow，裁切範圍就是本容器的 box，padding 內側仍在範圍內）。 */
        padding-right: 100px;
      }

      /* ── 行程卡片 + 長按刪除 ── */
      .trip-card-slot {
        position: relative;
      }
      .trip-card-wrap {
        position: relative;
        /* 不能再用 transform:translateZ(0) 做 GPU 層提升——那會讓這層自己形成新的
           stacking context，導致裡面卡片的 z-index:1 只在該 context 內比較，
           永遠贏不了外層 .scrapbook-btn 的 z-index:0，膠捲反而蓋在卡片上面。
           改用明確的 z-index 讓卡片這層在 .trip-card-slot 底下正確排到膠捲之上。 */
        z-index: 1;
        overflow: hidden;
        border-radius: 16px;
        -webkit-tap-highlight-color: transparent;
      }
      .delete-overlay {
        position: absolute;
        inset: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.55);
        border-radius: inherit;
        animation: delete-overlay-fade-in 0.15s ease;
      }
      @keyframes delete-overlay-fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      .delete-overlay-btn {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        border: none;
        background: #e53e3e;
        color: white;
        font-size: 1.4rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
      }
      .trip-card.card {
        padding: 0;
        margin-bottom: 0;
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        background: var(--surface);
        border-radius: 16px;
        transition:
          transform 0.2s ease,
          opacity 0.2s ease,
          box-shadow 0.2s ease;
        /* 卡片自己保留裁切：內部縮圖/hover 效果需要方角被裁成圓角，
           缺口裝飾則利用這層裁切「咬」出一個洞。 */
        overflow: hidden;
        -webkit-tap-highlight-color: transparent;
        /* 長按刪除／左滑拖曳膠捲手勢期間，避免手機瀏覽器跳出文字選取/放大鏡選單；
           水平方向交給 JS 判斷，垂直方向仍讓瀏覽器原生捲動處理。 */
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
        touch-action: pan-y;
      }
      .trip-card.card:hover,
      .trip-card.card:active {
        transform: translateY(-4px);
        box-shadow: 0 18px 36px var(--shadow);
      }
      /* 即時拖曳中：關閉 transition，讓卡片位移／淡出 1:1 跟手，不要有動畫延遲 */
      .trip-card.card.dragging {
        transition: none;
      }
      /* 登機證右側中間的圓形撕票缺口裝飾：掛在卡片本身，縮小時會跟著卡片一起移動 */
      .trip-card.card::after {
        content: '';
        position: absolute;
        right: -15px;
        top: 50%;
        transform: translateY(-50%);
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--bg);
        z-index: 2;
        pointer-events: none;
      }

      /* ── 行程剪貼簿：橫向底片膠捲，露出到卡片右側外面（網頁分兩階段 hover／手機左滑） ── */
      .scrapbook-btn {
        position: absolute;
        top: 10px;
        bottom: 10px;
        /* 預設／第一階段：大部分藏在卡片後面（z-index 比卡片低），只露出一小截，
           露出的那一截跟卡片邊緣是連續的（沒有空隙），滑鼠才能連續滑過去不中斷 hover。 */
        right: -18px;
        width: 84px;
        z-index: 0;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background: #161616;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        opacity: 0;
        pointer-events: none;
        transition:
          opacity 0.2s ease,
          right 0.25s ease,
          transform 0.25s ease;
        /* 只在上下留打孔的位置，左右不留黑邊，讓畫面格能撐滿整個寬度 */
        padding: 12px 0;
        overflow: hidden;
      }
      /* 上下兩排底片打孔，橫向排列（正確的水平底片方向） */
      .scrapbook-btn::before,
      .scrapbook-btn::after {
        content: '';
        position: absolute;
        left: 4px;
        right: 4px;
        height: 6px;
        background-image: radial-gradient(circle, #fff 0 1.6px, transparent 1.8px);
        background-size: 11px 6px;
        background-repeat: repeat-x;
        background-position: 2px center;
      }
      .scrapbook-btn::before {
        top: 3px;
      }
      .scrapbook-btn::after {
        bottom: 3px;
      }
      /* 畫面窗格：兩格並排的底片畫面，中間一條分隔線。
         固定用亮色（不用 var(--bg)），底片本身的視覺不應該跟著深色模式變暗——
         不管淺色或深色主題，底片都要維持「黑色機身＋白色畫面格」的樣子。 */
      .film-frame {
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
        background: #f2ede1;
      }
      .film-frame::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 0;
        bottom: 0;
        width: 4px;
        margin-left: -2px;
        background: #161616;
      }
      /* 即時拖曳中：關閉 transition，跟卡片一樣不要有動畫延遲 */
      .scrapbook-btn.dragging {
        transition: none;
      }
      @media (hover: hover) and (pointer: fine) {
        /* 第一階段：滑鼠移入登機證任一處，膠捲先露出一小截（大部分仍藏在卡片後面），卡片不縮小 */
        .trip-card-slot:hover .scrapbook-btn {
          opacity: 1;
          pointer-events: auto;
        }
        /* 第二階段：滑鼠移到膠捲露出的那一小截上，膠捲整個滑出來，登機證往左等比縮小並加上陰影 */
        /* 膠捲跟卡片套用「完全相同」的 translateX，兩者才會同步位移、中間不會露出空白 */
        .trip-card-slot:has(.scrapbook-btn:hover) .scrapbook-btn {
          right: -84px;
          transform: translateX(-38px);
        }
        .trip-card-slot:has(.scrapbook-btn:hover) .trip-card.card {
          transform: translateX(-38px);
          box-shadow: 0 18px 36px var(--shadow);
        }
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
      .reminder-btn {
        position: absolute;
        top: 0.6rem;
        left: 0.6rem;
        z-index: 5;
        width: 20px;
        height: 20px;
        border-radius: 6px;
        background: var(--icon-bg);
        color: #9ca3af;
        border: none;
        font-size: 0.72rem;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      }
      .reminder-btn:hover {
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
        box-sizing: border-box;
        overflow-x: hidden;
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

      /* ── 提醒通知視窗（比照自動盯價彈窗：compact 不滿版 + 內容等比縮放不出捲軸） ── */
      .reminder-modal.modal-card-compact {
        max-width: 380px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .reminder-modal .scale-wrap {
        width: 100%;
        transform-origin: center center;
      }
      .reminder-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .reminder-toggle-row label {
        margin-bottom: 0;
      }
      .pill-switch {
        position: relative;
        width: 44px;
        height: 24px;
        border-radius: 999px;
        border: none;
        background: var(--border);
        cursor: pointer;
        padding: 0;
        transition: background 0.2s ease;
        flex-shrink: 0;
      }
      .pill-switch.on {
        background: var(--accent);
      }
      .pill-knob {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        transition: transform 0.2s ease;
      }
      .pill-switch.on .pill-knob {
        transform: translateX(20px);
      }
      .reminder-error {
        color: #e53e3e;
        font-size: 0.85rem;
        margin: -0.5rem 0 1rem;
      }

      @media (max-width: 600px) {
        .form-row-grid {
          grid-template-columns: 1fr;
        }
        .trip-card.card {
          flex-wrap: wrap;
        }
        /* 手機版不額外保留 gutter（桌機版的 100px 在這裡重設為 0），
           登機證維持正常滿版寬度；膠捲改成貼齊卡片（.trip-card-wrap）右邊緣、
           完全包在原本的卡片範圍內，拖曳時純粹靠卡片本身左移露出，
           不需要跟桌機版一樣的外側留白空間。 */
        .trips-grid {
          padding-right: 0;
        }
        .list-toolbar,
        .trip-form.card {
          margin-right: 0;
        }
        .scrapbook-btn {
          right: 0;
          width: 110px;
        }
      }
    `,
  ],
})
export class TripsListComponent implements OnInit {
  @ViewChild('avatarInput') avatarInputRef?: ElementRef<HTMLInputElement>;

  tripService = inject(TripService);
  tripReminderService = inject(TripReminderService);
  private auth = inject(AuthService);
  pref = inject(PreferenceService);
  fb = inject(FormBuilder);
  private router = inject(Router);
  private transloco = inject(TranslocoService);
  private pageTransition = inject(PageTransitionService);

  timezoneOptions = TIMEZONE_OPTIONS;
  currencyOptions = CURRENCY_OPTIONS;

  timezoneDropdownOptions(): { value: string; label: string }[] {
    return TIMEZONE_OPTIONS.map((o) => ({
      value: o.value,
      label: `${this.transloco.translate('timezones.' + o.key)} (UTC${o.utc})`,
    }));
  }
  currencyDropdownOptions(): { value: string; label: string }[] {
    return CURRENCY_OPTIONS.map((o) => ({
      value: o.value,
      label: `${o.value} ${this.transloco.translate('currencies.' + o.key)}`,
    }));
  }

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

  /** 窄螢幕（手機版）用縮寫文字，避免年份/月份篩選欄位被壓縮成兩行 */
  private isNarrowScreen(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 480;
  }

  yearOptions(): { value: string; label: string }[] {
    const allLabel = this.transloco.translate(
      this.isNarrowScreen() ? 'trips.filterYearShort' : 'trips.filterAllYears',
    );
    return [
      { value: '', label: allLabel },
      ...this.availableYears().map((y) => ({ value: String(y), label: String(y) })),
    ];
  }

  monthOptions(): { value: string; label: string }[] {
    const allLabel = this.transloco.translate(
      this.isNarrowScreen() ? 'trips.filterMonthShort' : 'trips.filterAllMonths',
    );
    return [
      { value: '', label: allLabel },
      ...Array.from({ length: 12 }, (_, i) => {
        const mo = i + 1;
        return { value: String(mo), label: String(mo) };
      }),
    ];
  }

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
      if (year && month) {
        const start = t.start_date_utc ? new Date(t.start_date_utc) : null;
        if (!start) return false;
        const end = t.end_date_utc ? new Date(t.end_date_utc) : start;
        const rangeStart = new Date(year, month - 1, 1);
        const rangeEnd = new Date(year, month, 0, 23, 59, 59);
        if (end < rangeStart || start > rangeEnd) return false;
      } else if (year) {
        const start = t.start_date_utc ? new Date(t.start_date_utc) : null;
        if (!start) return false;
        const end = t.end_date_utc ? new Date(t.end_date_utc) : start;
        const rangeStart = new Date(year, 0, 1);
        const rangeEnd = new Date(year, 11, 31, 23, 59, 59);
        if (end < rangeStart || start > rangeEnd) return false;
      } else if (month) {
        // 不限年份：只要行程涵蓋範圍內有任一個月符合該月份即符合
        const start = t.start_date_utc ? new Date(t.start_date_utc) : null;
        if (!start) return false;
        const end = t.end_date_utc ? new Date(t.end_date_utc) : start;
        let matched = false;
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
        while (cursor <= endCursor) {
          if (cursor.getMonth() + 1 === month) {
            matched = true;
            break;
          }
          cursor.setMonth(cursor.getMonth() + 1);
        }
        if (!matched) return false;
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
  /** 目前處於「長按刪除確認」狀態（反黑＋垃圾桶按鈕）的行程 id */
  longPressedTripId = signal<string | null>(null);
  /** 手機左滑手勢正在互動（含放開後的完成/彈回動畫）中的行程 id；網頁版 hover 純用 CSS 處理，不吃這裡 */
  dragTripId = signal<string | null>(null);
  /** 左滑進度 0~1，即時對應手指拖曳距離；放開後動畫收斂到 0（取消）或 1（進入行程剪貼簿） */
  dragProgress = signal(0);
  /** true 時代表手指正在即時拖曳中（此時卡片不套用 CSS transition，才能 1:1 跟手）；
   *  放開手指後改為 false，讓收斂到 0 或 1 的動畫可以套用 transition 平滑過渡 */
  isLiveDragging = signal(false);
  editingTrip = signal<Trip | null>(null);

  // ── 行程提醒通知 ──────────────────────────────────────────────
  reminderOffsetOptions: { value: ReminderOffsetType; labelKey: string }[] = [
    { value: 'month_first', labelKey: 'trips.reminder.monthFirst' },
    { value: 'seven_days_before', labelKey: 'trips.reminder.sevenDaysBefore' },
    { value: 'one_day_before', labelKey: 'trips.reminder.oneDayBefore' },
    { value: 'custom', labelKey: 'trips.reminder.custom' },
  ];
  reminderTrip = signal<Trip | null>(null);
  reminderSelectedOffsets = signal<ReminderOffsetType[]>([]);
  reminderCustomDateTime = signal('');
  reminderEmail = signal('');
  reminderEnabled = signal(true);
  reminderSaveError = signal(false);
  savingReminder = signal(false);
  @ViewChild('reminderScaleWrap') reminderScaleWrap?: ElementRef<HTMLElement>;

  reminderOffsetDropdownOptions(): { value: ReminderOffsetType; label: string }[] {
    return this.reminderOffsetOptions.map((o) => ({
      value: o.value,
      label: this.transloco.translate(o.labelKey),
    }));
  }

  private static readonly LONG_PRESS_MS = 500;
  private static readonly LONG_PRESS_MOVE_TOLERANCE_PX = 10;
  /** 左滑最大拖曳距離（px），對應 dragProgress = 1（完全展開） */
  private static readonly SCRAPBOOK_MAX_DRAG_PX = 110;
  /** 放開手指時，拖曳進度需超過此比例才視為「確定進入」，否則彈回 */
  private static readonly SCRAPBOOK_COMMIT_RATIO = 0.6;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressTriggered = false;
  private longPressStartX = 0;
  private longPressStartY = 0;
  /** 移動超過容忍值後鎖定的手勢軸向；僅觸控手勢才會判斷左滑膠捲（滑鼠用 hover，不吃這條路徑） */
  private swipeAxis: 'x' | 'y' | null = null;

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    start_date_local: [this.todayAtMidnightLocal()],
    end_date_local: [this.todayAtMidnightLocal()],
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

  toggleAddMenu(): void {
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
    this.form.get('start_date_local')?.valueChanges.subscribe((value) => {
      if (value) this.form.patchValue({ end_date_local: value }, { emitEvent: false });
    });
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
      start_date_local: this.todayAtMidnightLocal(),
      end_date_local: this.todayAtMidnightLocal(),
    });
    this.showForm.set(false);
    await this.loadTrips();
  }

  // ── 卡片互動：長按進入刪除確認態／觸控左滑即時跟手拖曳出行程剪貼簿膠捲 ──
  onCardClick(trip: Trip): void {
    // 長按或拖曳剛觸發後，手指放開瀏覽器仍會補一個 click，這裡吃掉避免誤觸導覽
    if (this.longPressTriggered) {
      this.longPressTriggered = false;
      return;
    }
    if (this.longPressedTripId()) {
      // 有卡片正處於刪除確認態時，點其他地方先取消，不直接導覽
      this.longPressedTripId.set(null);
      return;
    }
    if (this.dragTripId() === trip.id) return; // 拖曳/收斂動畫進行中，不觸發導覽
    this.router.navigate(['/trips', trip.id]);
  }

  /** 卡片即時跟手位移樣式；非拖曳中的卡片回傳 null 交由 CSS 預設樣式處理。
   *  卡片全程只做位移，維持完全不透明——不管是拖曳中還是放開後補完到底，
   *  都不會自己淡出；畫面切換交給過場動畫（膠捲放大蓋過整個畫面）處理即可。 */
  cardDragStyle(trip: Trip): Record<string, string> | null {
    if (this.dragTripId() !== trip.id) return null;
    const p = this.dragProgress();
    return { transform: `translateX(${-p * TripsListComponent.SCRAPBOOK_MAX_DRAG_PX}px)` };
  }

  /** 膠捲在拖曳中才需要蓋過 opacity:0 的預設隱藏樣式；實際「越拖越長」的效果是卡片位移自然露出的 */
  reelDragStyle(trip: Trip): Record<string, string> | null {
    if (this.dragTripId() !== trip.id) return null;
    return { opacity: '1', 'pointer-events': this.dragProgress() > 0.05 ? 'auto' : 'none' };
  }

  onCardPointerDown(e: PointerEvent, trip: Trip): void {
    if (this.longPressedTripId() || this.dragTripId()) return;
    this.longPressTriggered = false;
    this.longPressStartX = e.clientX;
    this.longPressStartY = e.clientY;
    this.swipeAxis = null;
    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      this.longPressedTripId.set(trip.id);
    }, TripsListComponent.LONG_PRESS_MS);
  }

  onCardPointerMove(e: PointerEvent, trip: Trip): void {
    const dx = e.clientX - this.longPressStartX;
    const dy = e.clientY - this.longPressStartY;

    if (!this.swipeAxis) {
      if (
        Math.abs(dx) < TripsListComponent.LONG_PRESS_MOVE_TOLERANCE_PX &&
        Math.abs(dy) < TripsListComponent.LONG_PRESS_MOVE_TOLERANCE_PX
      ) {
        return; // 意圖閥值：微幅抖動不判斷方向，也不打斷長按計時
      }
      // 已產生明確移動：不再是「按住不動」，取消長按計時，改判斷滑動軸向
      this.clearLongPressTimer();
      // 只有觸控手勢才進入左滑拖曳膠捲的邏輯，滑鼠用 hover 走 CSS，避免互相干擾
      this.swipeAxis = e.pointerType === 'touch' && Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (this.swipeAxis === 'x') {
        this.isLiveDragging.set(true);
        this.dragTripId.set(trip.id);
      }
    }

    if (this.swipeAxis !== 'x') return; // 垂直手勢：完全放手，讓瀏覽器原生捲動接手
    // 即時跟手：只吃左滑（dx 為負），依拖曳距離換算成 0~1 的進度，往右滑會自然回到 0
    const px = Math.min(Math.max(-dx, 0), TripsListComponent.SCRAPBOOK_MAX_DRAG_PX);
    this.dragProgress.set(px / TripsListComponent.SCRAPBOOK_MAX_DRAG_PX);
  }

  onCardPointerUp(e: PointerEvent, trip: Trip): void {
    this.clearLongPressTimer();
    if (this.swipeAxis === 'x' && this.dragTripId() === trip.id) {
      this.isLiveDragging.set(false); // 放開後改走 CSS transition，收斂動畫才會平滑
      if (this.dragProgress() >= TripsListComponent.SCRAPBOOK_COMMIT_RATIO) {
        this.longPressTriggered = true; // 吃掉緊接而來的補發 click
        this.commitScrapbookDrag(trip, e.target as HTMLElement);
      } else {
        this.cancelScrapbookDrag();
      }
    }
    this.swipeAxis = null;
  }

  onCardPointerCancel(): void {
    this.clearLongPressTimer();
    if (this.swipeAxis === 'x') {
      this.isLiveDragging.set(false);
      this.cancelScrapbookDrag();
    }
    this.swipeAxis = null;
  }

  /** 拖曳超過門檻放開：動畫補完到底（卡片位移到底、膠捲完全展開，卡片本身不淡出），
   *  完成後播放過場動畫（膠捲放大蓋滿整個畫面）並導頁。
   *  這裡刻意不搶先重置 dragTripId／dragProgress——維持卡片＋膠捲展開的畫面，
   *  讓全螢幕過場動畫直接接續當下已展開的膠捲往下長，不會有中途跳回原狀的割裂感；
   *  等真正導頁後，這個元件會被 Angular 整個銷毀，不需要手動清狀態。 */
  private commitScrapbookDrag(trip: Trip, target: HTMLElement): void {
    this.dragProgress.set(1);
    const btn = target?.closest('.trip-card-slot')?.querySelector<HTMLElement>('.scrapbook-btn');
    setTimeout(() => {
      this.enterScrapbook(trip, btn);
    }, 220); // 對應卡片 transform 的 CSS transition 時長，讓收斂動畫播完再接續過場
  }

  /** 拖曳未達門檻放開：卡片彈回原位、膠捲被登機證重新蓋過去 */
  private cancelScrapbookDrag(): void {
    this.dragProgress.set(0);
    setTimeout(() => {
      // 等彈回動畫播完才清掉 dragTripId，避免中途瞬間跳回無拖曳樣式造成閃爍
      this.dragTripId.set(null);
    }, 220);
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  cancelLongPress(): void {
    this.longPressedTripId.set(null);
  }

  onDeleteBtnClick(trip: Trip, e: MouseEvent): void {
    e.stopPropagation();
    void this.confirmDeleteTrip(trip);
  }

  // ── 行程剪貼簿：網頁 hover／手機左滑拖曳，點擊或拖曳完成後播放過場動畫再導頁 ──
  onScrapbookBtnClick(trip: Trip, e: MouseEvent): void {
    e.stopPropagation();
    this.enterScrapbook(trip, e.currentTarget as HTMLElement);
  }

  private enterScrapbook(trip: Trip, originEl?: HTMLElement | null): void {
    const rect = originEl?.getBoundingClientRect();
    // 傳完整矩形（而非只有中心點），過場遮罩才能直接從膠捲目前實際的大小/位置長成滿版
    const origin = rect
      ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
      : null;
    void this.pageTransition.playFilmReel(origin, () =>
      this.router.navigate(['/trips', trip.id, 'scrapbook']),
    );
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

  private todayAtMidnightLocal(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`;
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
    if (!confirm(this.transloco.translate('trips.deleteConfirm'))) {
      // 取消刪除：該行程卡片恢復原樣式（反黑消失）
      this.longPressedTripId.set(null);
      return;
    }
    await this.tripService.delete(trip.id);
    this.longPressedTripId.set(null);
    this.editingTrip.set(null);
    await this.loadTrips();
  }

  // ── 行程提醒通知 ──────────────────────────────────────────────
  private nowDateTimeLocal(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private dateTimeToLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async openReminderModal(trip: Trip): Promise<void> {
    const userId = this.auth.user()?.id ?? '';
    const existing = await this.tripReminderService.getForTrip(trip.id, userId);
    this.reminderSelectedOffsets.set(existing.map((r) => r.offset_type));
    this.reminderEnabled.set(existing.length ? existing.some((r) => r.enabled) : true);
    this.reminderEmail.set(existing[0]?.notify_email ?? this.auth.user()?.email ?? '');

    const custom = existing.find((r) => r.offset_type === 'custom');
    // 預設帶入當前日期時間，不可留空（未設定自訂提醒時亦先備妥預設值，選取「其他」即可直接使用）
    this.reminderCustomDateTime.set(
      custom ? this.dateTimeToLocalInput(custom.notify_at_utc) : this.nowDateTimeLocal(),
    );
    this.reminderSaveError.set(false);
    this.reminderTrip.set(trip);
    setTimeout(() => this.applyReminderScale());
  }

  closeReminderModal(): void {
    this.reminderTrip.set(null);
  }

  isReminderOffsetSelected(type: ReminderOffsetType): boolean {
    return this.reminderSelectedOffsets().includes(type);
  }

  @HostListener('window:resize')
  applyReminderScale(): void {
    const el = this.reminderScaleWrap?.nativeElement;
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

  async saveReminder(trip: Trip): Promise<void> {
    const offsets = this.reminderSelectedOffsets();
    const needsStartDate = offsets.some((o) => o !== 'custom');
    const needsCustomDateTime = offsets.includes('custom');
    if (
      (needsStartDate && !trip.start_date_utc) ||
      (needsCustomDateTime && !this.reminderCustomDateTime())
    ) {
      this.reminderSaveError.set(true);
      return;
    }

    this.savingReminder.set(true);
    try {
      await this.tripReminderService.saveForTrip({
        tripId: trip.id,
        userId: this.auth.user()?.id ?? '',
        offsetTypes: offsets,
        customDateTimeLocal: needsCustomDateTime ? this.reminderCustomDateTime() : undefined,
        notifyEmail: this.reminderEmail().trim() || this.auth.user()?.email || '',
        enabled: this.reminderEnabled(),
        tripStartDateUtc: trip.start_date_utc,
      });
      this.closeReminderModal();
    } finally {
      this.savingReminder.set(false);
    }
  }
}
