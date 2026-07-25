import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Trip } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-trips-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <h1>我的行程</h1>
        <div class="header-actions">
          <button class="btn-icon" (click)="showForm.set(!showForm())">＋</button>
          <a routerLink="/settings" class="btn-icon">⚙️</a>
          <button class="btn-icon" (click)="auth.signOut()">登出</button>
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
              <option value="Asia/Bangkok">曼谷 (UTC+7)</option>
              <option value="Europe/Paris">巴黎 (UTC+1)</option>
              <option value="America/New_York">紐約 (UTC-5)</option>
            </select>
          </div>
          <div class="form-row">
            <label>基礎貨幣</label>
            <select formControlName="base_currency">
              <option value="TWD">TWD 台幣</option>
              <option value="JPY">JPY 日圓</option>
              <option value="USD">USD 美元</option>
              <option value="EUR">EUR 歐元</option>
              <option value="THB">THB 泰銖</option>
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
              <a [routerLink]="['/trips', trip.id, 'shopping']" class="nav-btn">購物</a>
              <a [routerLink]="['/trips', trip.id, 'expenses']" class="nav-btn">記帳</a>
              <button class="nav-btn danger" (click)="deleteTrip(trip.id)">刪除</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 900px; margin: 0 auto; padding: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h1 { font-size: 1.8rem; font-weight: 700; color: #1a1a2e; margin: 0; }
    .header-actions { display: flex; gap: 0.5rem; }
    .btn-icon { background: #667eea; color: white; border: none; border-radius: 10px;
      padding: 0.5rem 1rem; cursor: pointer; font-size: 1rem; }
    .card { background: white; border-radius: 16px; padding: 1.5rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 1rem; }
    .trip-form h3 { margin: 0 0 1rem; }
    .form-row { margin-bottom: 1rem; }
    .form-row label { display: block; font-weight: 500; margin-bottom: 0.35rem; color: #555; }
    .form-row input, .form-row select {
      width: 100%; padding: 0.625rem 0.875rem; border: 1.5px solid #ddd;
      border-radius: 10px; font-size: 0.95rem; box-sizing: border-box; }
    .form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
    .btn-primary { background: #667eea; color: white; border: none; border-radius: 10px;
      padding: 0.625rem 1.5rem; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #f1f3f4; color: #555; border: none; border-radius: 10px;
      padding: 0.625rem 1.5rem; cursor: pointer; }
    .empty-state { text-align: center; padding: 4rem 2rem; color: #999; font-size: 1.1rem; }
    .empty-state p:first-child { font-size: 3rem; }
    .trips-grid { display: grid; gap: 1rem; }
    .trip-card.card { padding: 1.25rem 1.5rem; cursor: default; }
    .trip-info { cursor: pointer; margin-bottom: 1rem; }
    .trip-info h3 { font-size: 1.2rem; font-weight: 600; margin: 0 0 0.5rem; color: #1a1a2e; }
    .trip-meta { display: flex; gap: 1rem; color: #666; font-size: 0.9rem; }
    .trip-nav { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .nav-btn { padding: 0.4rem 1rem; border-radius: 8px; border: none; cursor: pointer;
      background: #f0f0ff; color: #667eea; font-weight: 500; text-decoration: none;
      font-size: 0.875rem; display: inline-block; }
    .nav-btn.danger { background: #fff0f0; color: #e53e3e; }
  `]
})
export class TripsListComponent implements OnInit {
  tripService = inject(TripService);
  auth = inject(AuthService);
  fb = inject(FormBuilder);

  trips = signal<Trip[]>([]);
  showForm = signal(false);

  form = this.fb.group({
    title:            ['', [Validators.required, Validators.maxLength(100)]],
    target_timezone:  ['Asia/Taipei', Validators.required],
    base_currency:    ['TWD', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    await this.loadTrips();
  }

  async loadTrips(): Promise<void> {
    this.trips.set(await this.tripService.getAll());
  }

  async createTrip(): Promise<void> {
    if (this.form.invalid) return;
    const { title, target_timezone, base_currency } = this.form.value;
    await this.tripService.create({ title: title!, target_timezone: target_timezone!, base_currency: base_currency! });
    this.form.reset({ target_timezone: 'Asia/Taipei', base_currency: 'TWD' });
    this.showForm.set(false);
    await this.loadTrips();
  }

  async deleteTrip(id: string): Promise<void> {
    if (!confirm('確定刪除此行程？相關購物清單與記帳也會一併刪除。')) return;
    await this.tripService.delete(id);
    await this.loadTrips();
  }
}
