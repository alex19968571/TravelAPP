import { Component, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import {
  PreferenceService,
  COLOR_OPTIONS,
  COUNTRIES,
  Country,
} from '../../core/services/preference.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  template: `
    <div class="page-container">
      <h1 class="page-title">{{ 'settings.title' | transloco }}</h1>

      <!-- 目的地國家 -->
      <div class="card">
        <h3>{{ 'settings.destCountry' | transloco }}</h3>
        <p class="section-desc">{{ 'settings.destCountryDesc' | transloco }}</p>
        <div class="country-picker-inline" [class.open]="showCountry()">
          <button class="country-trigger" (click)="toggleCountry($event)">
            <span class="fi fi-{{ pref.countryCode().toLowerCase() }}"></span>
            <span class="cname">{{ pref.country().nativeName }}</span>
            <span class="currency-badge">{{ pref.country().currency }}</span>
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
                <span class="cname">{{ c.nativeName }}</span>
                <span class="currency-badge">{{ c.currency }}</span>
              </button>
            }
          </div>
        </div>
      </div>

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
      .page-title {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 1rem;
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
      .section-desc {
        margin: -0.75rem 0 1rem;
        color: var(--text-secondary);
        font-size: 0.85rem;
      }

      /* 國家選單 */
      .country-picker-inline {
        position: relative;
      }
      .country-trigger {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        background: var(--bg);
        color: var(--text-primary);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        padding: 0.75rem 1rem;
        cursor: pointer;
        font-size: 0.95rem;
        transition: border-color 0.2s;
        text-align: left;
      }
      .country-trigger:hover {
        border-color: var(--accent);
      }
      .country-picker-inline.open .country-trigger {
        border-color: var(--accent);
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
      }
      .fi {
        width: 1.4em;
        flex-shrink: 0;
        border-radius: 2px;
      }
      .cname {
        flex: 1;
        font-weight: 500;
      }
      .currency-badge {
        font-size: 0.75rem;
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
        background: var(--accent-light);
        color: var(--accent);
        font-weight: 600;
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
        left: 0;
        right: 0;
        background: var(--surface);
        border: 1.5px solid var(--accent);
        border-top: none;
        border-bottom-left-radius: 12px;
        border-bottom-right-radius: 12px;
        max-height: 240px;
        overflow-y: auto;
        z-index: 100;
        display: none;
        scrollbar-width: thin;
      }
      .country-picker-inline.open .country-dropdown {
        display: block;
      }
      .country-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.625rem 1rem;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        color: var(--text-primary);
        font-size: 0.9rem;
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
  pref = inject(PreferenceService);
  colors = COLOR_OPTIONS;
  countries = COUNTRIES;
  showCountry = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const el = document.querySelector('.country-picker-inline');
    if (el && !el.contains(e.target as Node)) this.showCountry.set(false);
  }

  toggleCountry(e: MouseEvent): void {
    e.stopPropagation();
    this.showCountry.set(!this.showCountry());
  }

  selectCountry(c: Country): void {
    this.pref.setCountry(c.code);
    this.showCountry.set(false);
  }
}
