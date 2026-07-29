import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth.service';
import { PreferenceService, COLOR_OPTIONS } from '../../core/services/preference.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a routerLink="/trips" class="back-btn">← {{ 'common.back' | transloco }}</a>
        <h1>⚙️ {{ 'settings.title' | transloco }}</h1>
      </header>

      <!-- 主題 -->
      <div class="card">
        <h3>{{ 'settings.theme' | transloco }}</h3>
        <div class="theme-grid">
          <button
            class="theme-card"
            [class.selected]="pref.theme() === 'light'"
            (click)="pref.setTheme('light')"
          >
            <span class="theme-preview light-preview">
              <span class="preview-bar"></span>
              <span class="preview-card"></span>
              <span class="preview-card short"></span>
            </span>
            <span class="theme-label">{{ 'settings.themeLight' | transloco }}</span>
          </button>
          <button
            class="theme-card"
            [class.selected]="pref.theme() === 'dark'"
            (click)="pref.setTheme('dark')"
          >
            <span class="theme-preview dark-preview">
              <span class="preview-bar"></span>
              <span class="preview-card"></span>
              <span class="preview-card short"></span>
            </span>
            <span class="theme-label">{{ 'settings.themeDark' | transloco }}</span>
          </button>
        </div>
      </div>

      <!-- 主題色彩 -->
      <div class="card">
        <h3>{{ 'settings.color' | transloco }}</h3>
        <div class="color-grid">
          @for (c of colors; track c.id) {
            <button
              class="color-swatch"
              [class.selected]="pref.colorId() === c.id"
              [style.background]="c.accent"
              [title]="c.label"
              (click)="pref.setColor(c.id)"
            >
              @if (pref.colorId() === c.id) {
                <span class="check">✓</span>
              }
            </button>
          }
        </div>
        <div class="color-labels">
          @for (c of colors; track c.id) {
            <span class="color-label" [class.active]="pref.colorId() === c.id">{{ c.label }}</span>
          }
        </div>
      </div>

      <!-- 字型大小 -->
      <div class="card">
        <h3>{{ 'settings.fontSize' | transloco }}</h3>
        <div class="font-grid">
          <button
            class="font-btn"
            [class.selected]="pref.fontSize() === 'sm'"
            (click)="pref.setFontSize('sm')"
          >
            <span style="font-size:0.8rem">A</span> {{ 'settings.fontSizeSm' | transloco }}
          </button>
          <button
            class="font-btn"
            [class.selected]="pref.fontSize() === 'md'"
            (click)="pref.setFontSize('md')"
          >
            <span style="font-size:1rem">A</span> {{ 'settings.fontSizeMd' | transloco }}
          </button>
          <button
            class="font-btn"
            [class.selected]="pref.fontSize() === 'lg'"
            (click)="pref.setFontSize('lg')"
          >
            <span style="font-size:1.2rem">A</span> {{ 'settings.fontSizeLg' | transloco }}
          </button>
          <button
            class="font-btn"
            [class.selected]="pref.fontSize() === 'xl'"
            (click)="pref.setFontSize('xl')"
          >
            <span style="font-size:1.4rem">A</span> {{ 'settings.fontSizeXl' | transloco }}
          </button>
        </div>
        <p class="font-preview">{{ 'settings.previewText' | transloco }}</p>
      </div>

      <!-- 帳號 -->
      <div class="card">
        <h3>{{ 'settings.account' | transloco }}</h3>
        <p class="account-email">{{ auth.user()?.email }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 600px;
        margin: 0 auto;
        padding: 1.5rem;
        background: var(--bg);
        min-height: 100vh;
      }
      .page-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .back-btn {
        color: var(--accent);
        text-decoration: none;
        font-weight: 500;
      }
      h1 {
        font-size: 1.8rem;
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
      .card h3 {
        margin: 0 0 1.25rem;
        color: var(--text-primary);
        font-size: 1rem;
        font-weight: 600;
      }

      /* 主題 */
      .theme-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .theme-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        border: 2px solid var(--border);
        border-radius: 14px;
        padding: 1rem 0.5rem;
        background: var(--bg);
        cursor: pointer;
        transition:
          border-color 0.2s,
          box-shadow 0.2s;
      }
      .theme-card.selected {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-light);
      }
      .theme-label {
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-primary);
      }
      .theme-preview {
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px;
        height: 80px;
      }
      .light-preview {
        background: #f5f6fa;
      }
      .dark-preview {
        background: #0e0e1a;
      }
      .preview-bar {
        display: block;
        height: 10px;
        border-radius: 4px;
        width: 100%;
        background: var(--accent);
      }
      .light-preview .preview-card {
        background: #fff;
        border-radius: 4px;
        height: 16px;
        display: block;
      }
      .dark-preview .preview-card {
        background: #1a1a2e;
        border-radius: 4px;
        height: 16px;
        display: block;
      }
      .preview-card.short {
        width: 60%;
      }

      /* 色彩 */
      .color-grid {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-bottom: 0.5rem;
      }
      .color-swatch {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 3px solid transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
          transform 0.15s,
          border-color 0.15s;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      .color-swatch:hover {
        transform: scale(1.12);
      }
      .color-swatch.selected {
        border-color: white;
        box-shadow: 0 0 0 3px var(--accent);
      }
      .check {
        color: white;
        font-size: 1.1rem;
        font-weight: 700;
      }
      .color-labels {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .color-label {
        font-size: 0.75rem;
        color: var(--text-secondary);
        width: 44px;
        text-align: center;
      }
      .color-label.active {
        color: var(--accent);
        font-weight: 600;
      }

      /* 字型 */
      .font-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.75rem;
      }
      .font-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        padding: 0.875rem 0.5rem;
        border-radius: 12px;
        border: 2px solid var(--border);
        background: var(--bg);
        cursor: pointer;
        color: var(--text-primary);
        font-weight: 500;
        transition: border-color 0.2s;
      }
      .font-btn.selected {
        border-color: var(--accent);
        background: var(--accent-light);
        color: var(--accent);
      }
      .font-preview {
        margin: 1rem 0 0;
        color: var(--text-secondary);
        font-size: 0.9rem;
        border-top: 1px solid var(--border);
        padding-top: 0.75rem;
      }

      /* 帳號 */
      .account-email {
        color: var(--text-secondary);
        margin: 0;
      }
    `,
  ],
})
export class SettingsComponent {
  auth = inject(AuthService);
  pref = inject(PreferenceService);
  colors = COLOR_OPTIONS;
}
