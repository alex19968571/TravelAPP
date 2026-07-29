import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="logo">✈️</div>
        <h1>{{ 'app.name' | transloco }}</h1>
        <p class="subtitle">{{ 'app.tagline' | transloco }}</p>

        <div class="actions">
          <button class="btn-oauth btn-google" (click)="auth.signInWithGoogle()">
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path
                fill="#FFC107"
                d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.3 0-9.6-2.9-11.3-7.1l-6.5 5C9.7 39.7 16.3 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.5 5.8l6.2 5.2C40.9 35.5 44 30.1 44 24c0-1.3-.1-2.7-.4-4z"
              />
            </svg>
            {{ 'auth.signInGoogle' | transloco }}
          </button>

          <!-- Apple 登入需 Apple Developer 帳號，暫時停用 -->
        </div>
      </div>
    </div>
  `,
  styles: [
    `
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
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        max-width: 400px;
        width: 100%;
      }
      .logo {
        font-size: 4rem;
        margin-bottom: 1rem;
      }
      h1 {
        font-size: 1.8rem;
        font-weight: 700;
        color: #1a1a2e;
        margin: 0;
      }
      .subtitle {
        color: #666;
        margin: 0.5rem 0 2.5rem;
        font-size: 0.95rem;
      }
      .actions {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .btn-oauth {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 0.875rem 1.5rem;
        border-radius: 12px;
        border: none;
        font-size: 0.95rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-google {
        background: #f8f9fa;
        color: #3c4043;
        border: 1px solid #dadce0;
      }
      .btn-google:hover {
        background: #f1f3f4;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      .btn-apple {
        background: #000;
        color: white;
      }
      .btn-apple:hover {
        background: #1a1a1a;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
    `,
  ],
})
export class LoginComponent {
  auth = inject(AuthService);
}
