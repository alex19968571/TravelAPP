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
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Trip } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { AuthService } from '../../core/services/auth.service';
import {
  UserProfileService,
  PRESET_AVATARS,
  PresetAvatar,
  parseAvatar,
} from '../../core/services/user-profile.service';
import { PreferenceService, COUNTRIES, Country } from '../../core/services/preference.service';

@Component({
  selector: 'app-trips-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <h1 class="header-title">{{ 'trips.myTrips' | transloco }}</h1>

        <div class="header-actions">
          <!-- 當地時間 -->
          <div class="header-clock">{{ pref.clockDisplay() }}</div>

          <a routerLink="/settings" class="btn-icon">⚙️</a>

          <!-- 目的地國家選單 -->
          <div class="country-picker" [class.open]="showCountry()">
            <button class="country-trigger" (click)="toggleCountry($event)">
              <span class="fi fi-{{ pref.countryCode().toLowerCase() }}"></span>
              <span class="cname">{{ pref.country().nativeName }}</span>
              <span class="caret" [class.flipped]="showCountry()">▾</span>
            </button>
            <div class="country-dropdown">
              @for (c of countries; track c.code) {
                <button
                  class="country-option"
                  [class.selected]="c.code === pref.countryCode()"
                  (click)="selectCountry(c)"
                >
                  <span class="fi fi-{{ c.code.toLowerCase() }}"></span>
                  <span>{{ c.nativeName }}</span>
                  <span class="currency-badge">{{ c.currency }}</span>
                </button>
              }
            </div>
          </div>

          <!-- 圓形帳戶按鈕（取代原本登出按鈕） -->
          <div class="account-menu" [class.open]="showAccount()">
            <button class="account-trigger" (click)="toggleAccount($event)">
              <span class="avatar-frame">
                @if (avatarParsed().type === 'image') {
                  <img [src]="$any(avatarParsed()).src" class="avatar-img" alt="avatar" />
                } @else if (avatarParsed().type === 'preset') {
                  <span class="avatar-preset" [style.background]="$any(avatarParsed()).bg">{{
                    $any(avatarParsed()).emoji
                  }}</span>
                } @else {
                  <span class="avatar-fallback">👤</span>
                }
              </span>
            </button>

            <div class="account-dropdown">
              <button class="account-item" (click)="openAvatarPicker($event)">
                👤 {{ 'account.changeAvatar' | transloco }}
              </button>
              <input
                #avatarInput
                type="file"
                accept="image/*"
                hidden
                (change)="onAvatarSelected($event)"
              />

              <div class="account-item account-country" (click)="$event.stopPropagation()">
                <div class="account-country-label">📍 {{ 'account.homeCountry' | transloco }}</div>
                <div class="country-picker-inline" [class.open]="showHomeCountry()">
                  <button class="country-trigger" (click)="toggleHomeCountry($event)">
                    <span class="fi fi-{{ pref.homeCountry().code.toLowerCase() }}"></span>
                    <span class="cname">{{ pref.homeCountry().nativeName }}</span>
                    <span class="caret" [class.flipped]="showHomeCountry()">▾</span>
                  </button>
                  <div class="country-dropdown">
                    @for (c of countries; track c.code) {
                      <button
                        class="country-option"
                        [class.selected]="c.code === pref.homeCountryCode()"
                        (click)="selectHomeCountry(c)"
                      >
                        <span class="fi fi-{{ c.code.toLowerCase() }}"></span>
                        <span>{{ c.nativeName }}</span>
                        <span class="currency-badge">{{ c.currency }}</span>
                      </button>
                    }
                  </div>
                </div>
              </div>

              <button class="account-item danger" (click)="auth.signOut()">
                → {{ 'auth.signOut' | transloco }}
              </button>
            </div>
          </div>
        </div>
      </header>

      @if (showAvatarPicker()) {
        <div class="modal-backdrop" (click)="showAvatarPicker.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>{{ 'account.changeAvatar' | transloco }}</h3>
            <button class="btn-secondary full-width" (click)="avatarInputRef.nativeElement.click()">
              📷 {{ 'account.uploadPhoto' | transloco }}
            </button>
            <p class="section-desc">{{ 'account.orChoosePreset' | transloco }}</p>
            <div class="preset-grid">
              @for (p of presetAvatars; track p.id) {
                <button class="preset-swatch" [style.background]="p.bg" (click)="selectPreset(p)">
                  {{ p.emoji }}
                </button>
              }
            </div>
          </div>
        </div>
      }

      <!-- 行程列表工具列：'+' 獨立一列，右上角 -->
      <div class="list-toolbar">
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
                <option value="Asia/Taipei">台北 (UTC+8)</option>
                <option value="Asia/Tokyo">東京 (UTC+9)</option>
                <option value="Asia/Seoul">首爾 (UTC+9)</option>
                <option value="Asia/Shanghai">上海 (UTC+8)</option>
                <option value="Asia/Bangkok">曼谷 (UTC+7)</option>
                <option value="Asia/Ho_Chi_Minh">胡志明 (UTC+7)</option>
                <option value="Asia/Singapore">新加坡 (UTC+8)</option>
                <option value="Asia/Kuala_Lumpur">吉隆坡 (UTC+8)</option>
                <option value="Asia/Jakarta">雅加達 (UTC+7)</option>
                <option value="Australia/Sydney">雪梨 (UTC+10)</option>
                <option value="Europe/London">倫敦 (UTC+0)</option>
                <option value="Europe/Paris">巴黎 (UTC+1)</option>
                <option value="Europe/Berlin">柏林 (UTC+1)</option>
                <option value="Europe/Rome">羅馬 (UTC+1)</option>
                <option value="America/New_York">紐約 (UTC-5)</option>
                <option value="America/Toronto">多倫多 (UTC-5)</option>
              </select>
              <span class="select-caret">▾</span>
            </div>
          </div>
          <div class="form-row">
            <label>{{ 'trips.currency' | transloco }}</label>
            <div class="select-wrap">
              <select formControlName="base_currency">
                <option value="TWD">TWD 台幣</option>
                <option value="JPY">JPY 日圓</option>
                <option value="KRW">KRW 韓圓</option>
                <option value="CNY">CNY 人民幣</option>
                <option value="THB">THB 泰銖</option>
                <option value="VND">VND 越南盾</option>
                <option value="SGD">SGD 新幣</option>
                <option value="MYR">MYR 馬幣</option>
                <option value="IDR">IDR 盾</option>
                <option value="AUD">AUD 澳幣</option>
                <option value="GBP">GBP 英鎊</option>
                <option value="EUR">EUR 歐元</option>
                <option value="USD">USD 美元</option>
                <option value="CAD">CAD 加元</option>
                <option value="CHF">CHF 瑞郎</option>
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

      @if (trips().length === 0) {
        <div class="empty-state">
          <p>🗺️</p>
          <p>{{ 'trips.noTrips' | transloco }}</p>
        </div>
      }

      <div class="trips-grid">
        @for (trip of trips(); track trip.id) {
          <div class="trip-card card">
            <div class="trip-info" [routerLink]="['/trips', trip.id]">
              <h3>{{ trip.title }}</h3>
              <div class="trip-meta">
                <span>🌏 {{ trip.target_timezone }}</span>
                <span>💰 {{ trip.base_currency }}</span>
              </div>
            </div>
            <div class="trip-nav">
              <a [routerLink]="['/trips', trip.id, 'itinerary']" class="nav-btn">{{
                'trips.itinerary' | transloco
              }}</a>
              <a [routerLink]="['/trips', trip.id, 'shopping']" class="nav-btn">{{
                'trips.shopping' | transloco
              }}</a>
              <a [routerLink]="['/trips', trip.id, 'expenses']" class="nav-btn">{{
                'trips.expenses' | transloco
              }}</a>
              <button class="nav-btn danger" (click)="deleteTrip(trip.id)">
                {{ 'trips.delete' | transloco }}
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

      /* ── Header ── */
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .header-title {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .header-clock {
        font-size: 0.8rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--accent);
        background: var(--accent-light);
        padding: 0.35rem 0.7rem;
        border-radius: 8px;
        white-space: nowrap;
        letter-spacing: 0.02em;
      }

      .btn-icon {
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 0.5rem 0.875rem;
        cursor: pointer;
        font-size: 0.95rem;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        transition: opacity 0.15s;
      }
      .btn-icon:hover {
        opacity: 0.85;
      }

      /* ── 國家選單（共用樣式） ── */
      .country-picker,
      .country-picker-inline {
        position: relative;
      }
      .country-trigger {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        background: var(--surface);
        color: var(--text-primary);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        font-size: 0.875rem;
        white-space: nowrap;
        transition: border-color 0.2s;
        width: 100%;
      }
      .country-trigger:hover,
      .country-picker.open .country-trigger,
      .country-picker-inline.open .country-trigger {
        border-color: var(--accent);
      }
      .fi {
        width: 1.3em;
        flex-shrink: 0;
        border-radius: 2px;
      }
      .cname {
        font-weight: 500;
        max-width: 72px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .currency-badge {
        font-size: 0.7rem;
        padding: 0.1rem 0.4rem;
        border-radius: 5px;
        background: var(--accent-light);
        color: var(--accent);
        font-weight: 700;
      }
      .caret {
        font-size: 0.7rem;
        color: var(--text-secondary);
        transition: transform 0.2s;
        margin-left: auto;
      }
      .caret.flipped {
        transform: rotate(180deg);
      }

      .country-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 32px var(--shadow);
        min-width: 190px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 100;
        display: none;
        scrollbar-width: thin;
      }
      .country-picker.open .country-dropdown,
      .country-picker-inline.open .country-dropdown {
        display: block;
      }
      .country-option {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        width: 100%;
        padding: 0.625rem 1rem;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        color: var(--text-primary);
        font-size: 0.875rem;
        transition: background 0.15s;
      }
      .country-option:hover {
        background: var(--accent-light);
      }
      .country-option.selected {
        background: var(--accent-light);
        color: var(--accent);
        font-weight: 600;
      }
      .country-option:first-child {
        border-radius: 10px 10px 0 0;
      }
      .country-option:last-child {
        border-radius: 0 0 10px 10px;
      }

      /* ── 帳戶圓形按鈕 ── */
      .account-menu {
        position: relative;
      }
      .account-trigger {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 1.5px solid var(--border);
        background: var(--surface);
        cursor: pointer;
        padding: 0;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color 0.2s;
      }
      .account-trigger:hover,
      .account-menu.open .account-trigger {
        border-color: var(--accent);
      }
      /* 頭像邊框留白：外圈容器留一圈 padding，圖片/預設圖不貼齊邊緣 */
      .avatar-frame {
        width: 100%;
        height: 100%;
        padding: 3px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .avatar-img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
      }
      .avatar-preset {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
      }
      .avatar-fallback {
        font-size: 1.1rem;
      }

      /* ── 彈窗（頭像選擇 / 邀請等共用） ── */
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
        max-width: 360px;
        width: 100%;
        box-shadow: 0 12px 40px var(--shadow);
      }
      .modal-card h3 {
        margin: 0 0 1rem;
        color: var(--text-primary);
      }
      .full-width {
        width: 100%;
        text-align: center;
      }
      .section-desc {
        margin: 1rem 0 0;
        color: var(--text-secondary);
        font-size: 0.85rem;
      }
      .preset-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.75rem;
        margin-top: 0.75rem;
      }
      .preset-swatch {
        width: 100%;
        aspect-ratio: 1;
        border-radius: 50%;
        border: none;
        font-size: 1.4rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s;
      }
      .preset-swatch:hover {
        transform: scale(1.08);
      }

      .account-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 32px var(--shadow);
        min-width: 220px;
        z-index: 100;
        display: none;
        padding: 0.4rem;
      }
      .account-menu.open .account-dropdown {
        display: block;
      }
      .account-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.625rem 0.75rem;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        color: var(--text-primary);
        font-size: 0.875rem;
        border-radius: 8px;
      }
      .account-item:hover {
        background: var(--accent-light);
      }
      .account-item.danger {
        color: #e53e3e;
      }
      .account-item.danger:hover {
        background: #fff0f0;
      }
      .account-country {
        display: block;
        cursor: default;
      }
      .account-country:hover {
        background: transparent;
      }
      .account-country-label {
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-bottom: 0.4rem;
        font-weight: 500;
      }

      /* ── 行程列表工具列（+ 選單） ── */
      .list-toolbar {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 0.75rem;
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
      .add-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.625rem 0.75rem;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        color: var(--text-primary);
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
        cursor: not-allowed;
      }
      .btn-secondary {
        background: var(--accent-light);
        color: var(--text-secondary);
        border: none;
        border-radius: 10px;
        padding: 0.625rem 1.5rem;
        cursor: pointer;
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
      .trip-card.card {
        padding: 1.25rem 1.5rem;
      }
      .trip-info {
        cursor: pointer;
        margin-bottom: 1rem;
      }
      .trip-info h3 {
        font-size: 1.2rem;
        font-weight: 600;
        margin: 0 0 0.5rem;
        color: var(--text-primary);
      }
      .trip-meta {
        display: flex;
        gap: 1rem;
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      .trip-nav {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .nav-btn {
        padding: 0.4rem 1rem;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        background: var(--accent-light);
        color: var(--accent);
        font-weight: 500;
        text-decoration: none;
        font-size: 0.875rem;
        display: inline-block;
      }
      .nav-btn.danger {
        background: #fff0f0;
        color: #e53e3e;
      }

      @media (max-width: 600px) {
        .header-clock {
          font-size: 0.7rem;
          padding: 0.3rem 0.55rem;
        }
        .cname {
          display: none;
        }
        .form-row-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class TripsListComponent implements OnInit {
  @ViewChild('avatarInput') avatarInputRef!: ElementRef<HTMLInputElement>;

  tripService = inject(TripService);
  auth = inject(AuthService);
  profile = inject(UserProfileService);
  pref = inject(PreferenceService);
  fb = inject(FormBuilder);

  countries = COUNTRIES;
  trips = signal<Trip[]>([]);
  showForm = signal(false);
  showCountry = signal(false);
  showAccount = signal(false);
  showHomeCountry = signal(false);
  showAddMenu = signal(false);
  showJoin = signal(false);
  joinCode = signal('');
  joinError = signal(false);
  joining = signal(false);
  showAvatarPicker = signal(false);
  presetAvatars = PRESET_AVATARS;
  avatarParsed = computed(() => parseAvatar(this.profile.avatarUrl()));

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    start_date_local: [''],
    end_date_local: [''],
    target_timezone: [this.pref.country().timezone, Validators.required],
    base_currency: [this.pref.country().currency, Validators.required],
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const target = e.target as Node;
    if (!document.querySelector('.country-picker')?.contains(target)) this.showCountry.set(false);
    if (!document.querySelector('.account-menu')?.contains(target)) {
      this.showAccount.set(false);
      this.showHomeCountry.set(false);
    } else if (!document.querySelector('.account-menu .country-picker-inline')?.contains(target)) {
      this.showHomeCountry.set(false);
    }
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

  toggleCountry(e: MouseEvent): void {
    e.stopPropagation();
    this.showCountry.set(!this.showCountry());
  }

  selectCountry(c: Country): void {
    this.pref.setCountry(c.code);
    this.form.patchValue({ target_timezone: c.timezone, base_currency: c.currency });
    this.showCountry.set(false);
  }

  toggleAccount(e: MouseEvent): void {
    e.stopPropagation();
    this.showAccount.set(!this.showAccount());
  }

  toggleHomeCountry(e: MouseEvent): void {
    e.stopPropagation();
    this.showHomeCountry.set(!this.showHomeCountry());
  }

  selectHomeCountry(c: Country): void {
    this.pref.setHomeCountry(c.code);
    this.showHomeCountry.set(false);
  }

  openAvatarPicker(e: MouseEvent): void {
    e.stopPropagation();
    this.showAccount.set(false);
    this.showAvatarPicker.set(true);
  }

  async selectPreset(preset: PresetAvatar): Promise<void> {
    await this.profile.setPresetAvatar(preset);
    this.showAvatarPicker.set(false);
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await this.profile.uploadAvatar(file);
    (event.target as HTMLInputElement).value = '';
    this.showAvatarPicker.set(false);
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

  async deleteTrip(id: string): Promise<void> {
    if (!confirm('確定刪除此行程？相關購物清單與記帳也會一併刪除。')) return;
    await this.tripService.delete(id);
    await this.loadTrips();
  }
}
