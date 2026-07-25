import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="logo">✈️</div>
        <h1>旅遊記帳本</h1>
        <p class="subtitle">離線優先・多人分帳・收據掃描</p>

        <div class="actions">
          <button class="btn-oauth btn-google" (click)="auth.signInWithGoogle()">
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.3 0-9.6-2.9-11.3-7.1l-6.5 5C9.7 39.7 16.3 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.5 5.8l6.2 5.2C40.9 35.5 44 30.1 44 24c0-1.3-.1-2.7-.4-4z"/>
            </svg>
            以 Google 帳號登入
          </button>

          <button class="btn-oauth btn-apple" (click)="auth.signInWithApple()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            以 Apple 帳號登入
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }
    .login-card {
      background: white;
      border-radius: 20px;
      padding: 3rem 2.5rem;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      max-width: 400px;
      width: 100%;
    }
    .logo { font-size: 4rem; margin-bottom: 1rem; }
    h1 { font-size: 1.8rem; font-weight: 700; color: #1a1a2e; margin: 0; }
    .subtitle { color: #666; margin: 0.5rem 0 2.5rem; font-size: 0.95rem; }
    .actions { display: flex; flex-direction: column; gap: 1rem; }
    .btn-oauth {
      display: flex; align-items: center; justify-content: center; gap: 0.75rem;
      padding: 0.875rem 1.5rem; border-radius: 12px; border: none;
      font-size: 0.95rem; font-weight: 500; cursor: pointer; transition: all 0.2s;
    }
    .btn-google { background: #f8f9fa; color: #3c4043; border: 1px solid #dadce0; }
    .btn-google:hover { background: #f1f3f4; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .btn-apple { background: #000; color: white; }
    .btn-apple:hover { background: #1a1a1a; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  `]
})
export class LoginComponent {
  auth = inject(AuthService);
}
