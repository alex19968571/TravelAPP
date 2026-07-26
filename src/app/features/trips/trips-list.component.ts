import {
  Component, inject, OnInit, signal, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Trip } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { AuthService } from '../../core/services/auth.service';
import { PreferenceService, COUNTRIES, Country } from '../../core/services/preference.service';

@Component({
  selector: 'app-trips-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <h1 class="header-title">我的行程</h1>

        <div class="header-actions">
          <!-- 當地時間（＋ 左側） -->
          <div class="header-clock">{{ pref.clockDisplay() }}</div>

          <button class="btn-icon" (click)="showForm.set(!showForm())">＋</button>
          <a routerLink="/settings" class="btn-icon">⚙️</a>

          <!-- 目的地國家選單（登出左側） -->
          <div class="country-picker" [class.open]="showCountry()">
            <button class="country-trigger" (click)="toggleCountry($event)">
              <span class="fi fi-{{ pref.countryCode().toLowerCase() }}"></span>
              <span class="cname">{{ pref.country().nativeName }}</span>
              <span class="caret" [class.flipped]="showCountry()">▾</span>
            </button>
            <div class="country-dropdown">
              @for (c of countries; track c.code) {
                <button class="country-option"
                        [class.selected]="c.code === pref.countryCode()"
                        (click)="selectCountry(c)">
                  <span class="fi fi-{{ c.code.toLowerCase() }}"></span>
                  <span>{{ c.nativeName }}</span>
                  <span class="currency-badge">{{ c.currency }}</span>
                </button>
              }
            </div>
          </div>

          <button class="btn-icon btn-logout" (click)="auth.signOut()">登出</button>
        </div>
      </header>

      @if (showForm()) {
        <form [formGroup]="form" (ngSubmit)="createTrip()" class="trip-form card">
          <h3>新增行程</h3>
          <div class="form-row">
            <label>行程名稱</label>
            <input formControlName="title" placeholder="例：日本東京五天四夜" />
          </div>
          <div class="form-row">
            <label>時區</label>
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
          </div>
          <div class="form-row">
            <label>基礎貨幣</label>
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
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" (click)="showForm.set(false)">取消</button>
            <button type="submit" class="btn-primary" [disabled]="form.invalid">建立行程</button>
          </div>
        </form>
      }

      @if (trips().length === 0) {
        <div class="empty-state">
          <p>🗺️</p>
          <p>尚無行程，點擊右上角「＋」開始規劃吧！</p>
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
              <a [routerLink]="['/trips', trip.id, 'itinerary']" class="nav-btn">行程</a>
              <a [routerLink]="['/trips', trip.id, 'shopping']"  class="nav-btn">購物</a>
              <a [routerLink]="['/trips', trip.id, 'expenses']"  class="nav-btn">記帳</a>
              <button class="nav-btn danger" (click)="deleteTrip(trip.id)">刪除</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 900px; margin: 0 auto; padding: 1.5rem;
      background: var(--bg); min-height: 100vh;
    }

    /* ── Header ── */
    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.5rem;
    }
    .header-title {
      font-size: 1.6rem; font-weight: 700; color: var(--text-primary); margin: 0;
    }
    .header-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

    .header-clock {
      font-size: 0.8rem; font-weight: 600; font-variant-numeric: tabular-nums;
      color: var(--accent); background: var(--accent-light);
      padding: 0.35rem 0.7rem; border-radius: 8px; white-space: nowrap;
      letter-spacing: 0.02em;
    }

    .btn-icon {
      background: var(--accent); color: white; border: none;
      border-radius: 10px; padding: 0.5rem 0.875rem;
      cursor: pointer; font-size: 0.95rem; text-decoration: none;
      display: inline-flex; align-items: center; transition: opacity 0.15s;
    }
    .btn-icon:hover { opacity: 0.85; }
    .btn-logout { background: #e53e3e; }

    /* ── 國家選單 ── */
    .country-picker { position: relative; }
    .country-trigger {
      display: flex; align-items: center; gap: 0.4rem;
      background: var(--surface); color: var(--text-primary);
      border: 1.5px solid var(--border); border-radius: 10px;
      padding: 0.5rem 0.75rem; cursor: pointer;
      font-size: 0.875rem; white-space: nowrap;
      transition: border-color 0.2s;
    }
    .country-trigger:hover,
    .country-picker.open .country-trigger { border-color: var(--accent); }
    .fi { width: 1.3em; flex-shrink: 0; border-radius: 2px; }
    .cname { font-weight: 500; max-width: 72px; overflow: hidden; text-overflow: ellipsis; }
    .currency-badge {
      font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 5px;
      background: var(--accent-light); color: var(--accent); font-weight: 700;
    }
    .caret { font-size: 0.7rem; color: var(--text-secondary); transition: transform 0.2s; }
    .caret.flipped { transform: rotate(180deg); }

    .country-dropdown {
      position: absolute; top: calc(100% + 6px); right: 0;
      background: var(--surface); border: 1.5px solid var(--border);
      border-radius: 12px; box-shadow: 0 8px 32px var(--shadow);
      min-width: 190px; max-height: 300px; overflow-y: auto;
      z-index: 100; display: none; scrollbar-width: thin;
    }
    .country-picker.open .country-dropdown { display: block; }
    .country-option {
      display: flex; align-items: center; gap: 0.6rem;
      width: 100%; padding: 0.625rem 1rem; border: none;
      background: transparent; cursor: pointer; text-align: left;
      color: var(--text-primary); font-size: 0.875rem; transition: background 0.15s;
    }
    .country-option:hover    { background: var(--accent-light); }
    .country-option.selected { background: var(--accent-light); color: var(--accent); font-weight: 600; }
    .country-option:first-child { border-radius: 10px 10px 0 0; }
    .country-option:last-child  { border-radius: 0 0 10px 10px; }

    /* ── Cards ── */
    .card {
      background: var(--surface); border-radius: 16px; padding: 1.5rem;
      box-shadow: 0 4px 20px var(--shadow); margin-bottom: 1rem;
    }
    .trip-form h3 { margin: 0 0 1rem; color: var(--text-primary); }
    .form-row { margin-bottom: 1rem; }
    .form-row label { display: block; font-weight: 500; margin-bottom: 0.35rem; color: var(--text-secondary); }
    .form-row input, .form-row select {
      width: 100%; padding: 0.625rem 0.875rem 0.625rem 0.875rem;
      border: 1.5px solid var(--border); border-radius: 10px; font-size: 0.95rem;
      box-sizing: border-box; background: var(--input-bg); color: var(--text-primary);
    }
    .form-row select { padding-right: 2.5rem; }
    .form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
    .btn-primary {
      background: var(--accent); color: white; border: none;
      border-radius: 10px; padding: 0.625rem 1.5rem; font-weight: 600; cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      background: var(--accent-light); color: var(--text-secondary);
      border: none; border-radius: 10px; padding: 0.625rem 1.5rem; cursor: pointer;
    }
    .empty-state { text-align: center; padding: 4rem 2rem; color: var(--text-secondary); font-size: 1.1rem; }
    .empty-state p:first-child { font-size: 3rem; }
    .trips-grid { display: grid; gap: 1rem; }
    .trip-card.card { padding: 1.25rem 1.5rem; }
    .trip-info { cursor: pointer; margin-bottom: 1rem; }
    .trip-info h3 { font-size: 1.2rem; font-weight: 600; margin: 0 0 0.5rem; color: var(--text-primary); }
    .trip-meta { display: flex; gap: 1rem; color: var(--text-secondary); font-size: 0.9rem; }
    .trip-nav { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .nav-btn {
      padding: 0.4rem 1rem; border-radius: 8px; border: none; cursor: pointer;
      background: var(--accent-light); color: var(--accent);
      font-weight: 500; text-decoration: none; font-size: 0.875rem; display: inline-block;
    }
    .nav-btn.danger { background: #fff0f0; color: #e53e3e; }

    @media (max-width: 600px) {
      .header-clock { font-size: 0.7rem; padding: 0.3rem 0.55rem; }
      .cname { display: none; }
    }
  `]
})
export class TripsListComponent implements OnInit {
  tripService = inject(TripService);
  auth        = inject(AuthService);
  pref        = inject(PreferenceService);
  fb          = inject(FormBuilder);

  countries = COUNTRIES;
  trips       = signal<Trip[]>([]);
  showForm    = signal(false);
  showCountry = signal(false);

  form = this.fb.group({
    title:           ['', [Validators.required, Validators.maxLength(100)]],
    target_timezone: [this.pref.country().timezone, Validators.required],
    base_currency:   [this.pref.country().currency, Validators.required],
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const picker = document.querySelector('.country-picker');
    if (picker && !picker.contains(e.target as Node)) this.showCountry.set(false);
  }

  async ngOnInit(): Promise<void> { await this.loadTrips(); }

  async loadTrips(): Promise<void> { this.trips.set(await this.tripService.getAll()); }

  toggleCountry(e: MouseEvent): void {
    e.stopPropagation();
    this.showCountry.set(!this.showCountry());
  }

  selectCountry(c: Country): void {
    this.pref.setCountry(c.code);
    this.form.patchValue({ target_timezone: c.timezone, base_currency: c.currency });
    this.showCountry.set(false);
  }

  async createTrip(): Promise<void> {
    if (this.form.invalid) return;
    const { title, target_timezone, base_currency } = this.form.value;
    await this.tripService.create({ title: title!, target_timezone: target_timezone!, base_currency: base_currency! });
    this.form.reset({ target_timezone: this.pref.country().timezone, base_currency: this.pref.country().currency });
    this.showForm.set(false);
    await this.loadTrips();
  }

  async deleteTrip(id: string): Promise<void> {
    if (!confirm('確定刪除此行程？相關購物清單與記帳也會一併刪除。')) return;
    await this.tripService.delete(id);
    await this.loadTrips();
  }
}
