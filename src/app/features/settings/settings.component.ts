import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a routerLink="/trips" class="back-btn">← 返回</a>
        <h1>⚙️ 設定</h1>
      </header>

      <div class="card">
        <h3>語言 / Language</h3>
        <div class="lang-buttons">
          <button [class.active]="lang() === 'zh-TW'" (click)="setLang('zh-TW')">繁體中文</button>
          <button [class.active]="lang() === 'en-US'" (click)="setLang('en-US')">English</button>
        </div>
      </div>

      <div class="card">
        <h3>預設設定</h3>
        <form [formGroup]="form">
          <div class="form-row">
            <label>預設時區</label>
            <select formControlName="default_timezone">
              <option value="Asia/Taipei">台北 (UTC+8)</option>
              <option value="Asia/Tokyo">東京 (UTC+9)</option>
              <option value="Asia/Bangkok">曼谷 (UTC+7)</option>
              <option value="Europe/Paris">巴黎 (UTC+1)</option>
              <option value="America/New_York">紐約 (UTC-5)</option>
            </select>
          </div>
          <div class="form-row">
            <label>預設貨幣</label>
            <select formControlName="default_currency">
              <option value="TWD">TWD 台幣</option>
              <option value="JPY">JPY 日圓</option>
              <option value="USD">USD 美元</option>
              <option value="EUR">EUR 歐元</option>
              <option value="THB">THB 泰銖</option>
            </select>
          </div>
        </form>
      </div>

      <div class="card danger-zone">
        <h3>帳號</h3>
        <p>目前登入：{{ auth.user()?.email }}</p>
        <button class="btn-danger" (click)="auth.signOut()">登出</button>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 600px; margin: 0 auto; padding: 1.5rem; }
    .page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .back-btn { color: #667eea; text-decoration: none; font-weight: 500; }
    h1 { font-size: 1.8rem; font-weight: 700; color: #1a1a2e; margin: 0; }
    .card { background: white; border-radius: 16px; padding: 1.5rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 1rem; }
    .card h3 { margin: 0 0 1rem; color: #1a1a2e; }
    .lang-buttons { display: flex; gap: 0.75rem; }
    .lang-buttons button { padding: 0.5rem 1.25rem; border-radius: 10px; border: 1.5px solid #ddd;
      background: white; cursor: pointer; font-size: 0.95rem; }
    .lang-buttons button.active { border-color: #667eea; background: #f0f0ff; color: #667eea; font-weight: 600; }
    .form-row { margin-bottom: 1rem; }
    .form-row label { display: block; font-weight: 500; margin-bottom: 0.35rem; color: #555; }
    .form-row select { width: 100%; padding: 0.625rem 0.875rem; border: 1.5px solid #ddd;
      border-radius: 10px; font-size: 0.95rem; }
    .danger-zone p { color: #666; margin-bottom: 1rem; }
    .btn-danger { background: #e53e3e; color: white; border: none; border-radius: 10px;
      padding: 0.625rem 1.5rem; cursor: pointer; font-weight: 600; }
  `]
})
export class SettingsComponent {
  auth = inject(AuthService);
  fb = inject(FormBuilder);
  lang = signal('zh-TW');

  form = this.fb.group({
    default_timezone: ['Asia/Taipei'],
    default_currency: ['TWD'],
  });

  setLang(code: string): void {
    this.lang.set(code);
    localStorage.setItem('lang', code);
  }
}
