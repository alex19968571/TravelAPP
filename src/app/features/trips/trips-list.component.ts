import { Component, inject, OnInit, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Trip } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { PreferenceService } from '../../core/services/preference.service';

@Component({
  selector: 'app-trips-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <h1 class="page-title">{{ 'trips.myTrips' | transloco }}</h1>

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
      .page-title {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 1rem;
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
        .form-row-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class TripsListComponent implements OnInit {
  tripService = inject(TripService);
  pref = inject(PreferenceService);
  fb = inject(FormBuilder);

  trips = signal<Trip[]>([]);
  showForm = signal(false);
  showAddMenu = signal(false);
  showJoin = signal(false);
  joinCode = signal('');
  joinError = signal(false);
  joining = signal(false);

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

  async deleteTrip(id: string): Promise<void> {
    if (!confirm('確定刪除此行程？相關購物清單與記帳也會一併刪除。')) return;
    await this.tripService.delete(id);
    await this.loadTrips();
  }
}
