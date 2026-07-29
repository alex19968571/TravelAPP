import {
  Component,
  inject,
  signal,
  computed,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../services/auth.service';
import {
  UserProfileService,
  PRESET_AVATARS,
  PresetAvatar,
  parseAvatar,
} from '../services/user-profile.service';
import { PreferenceService, COUNTRIES, Country } from '../services/preference.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, TranslocoModule],
  template: `
    <div class="shell">
      <div class="top-bar">
        <div class="clock">{{ pref.clockDisplay() }}</div>
      </div>

      <main class="shell-content">
        <router-outlet />
      </main>

      <nav class="bottom-nav">
        <a routerLink="/trips" routerLinkActive="active" class="nav-tab">
          <span class="nav-icon">🗺️</span>
          <span class="nav-label">{{ 'nav.trips' | transloco }}</span>
        </a>
        <a routerLink="/exchange" routerLinkActive="active" class="nav-tab">
          <span class="nav-icon">💱</span>
          <span class="nav-label">{{ 'nav.exchange' | transloco }}</span>
        </a>
        <a routerLink="/settings" routerLinkActive="active" class="nav-tab">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">{{ 'nav.settings' | transloco }}</span>
        </a>
        <button
          class="nav-tab account-tab"
          [class.active]="showAccount()"
          (click)="toggleAccount($event)"
        >
          <span class="nav-icon avatar-frame">
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
          <span class="nav-label">{{ 'account.account' | transloco }}</span>
        </button>
      </nav>

      @if (showAccount()) {
        <div class="account-panel" (click)="$event.stopPropagation()">
          <button class="account-item" (click)="openAvatarPicker()">
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
      }

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
    </div>
  `,
  styles: [
    `
      .shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--bg);
      }

      .top-bar {
        position: sticky;
        top: 0;
        z-index: 50;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        padding: 0.5rem 1rem;
        background: var(--header-bg);
        border-bottom: 1px solid var(--border);
      }
      .clock {
        font-size: 0.8rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--accent);
        background: var(--accent-light);
        padding: 0.3rem 0.65rem;
        border-radius: 8px;
        white-space: nowrap;
        letter-spacing: 0.02em;
      }

      .shell-content {
        flex: 1;
        padding-bottom: 68px;
      }

      .bottom-nav {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 100;
        display: flex;
        background: var(--surface);
        border-top: 1px solid var(--border);
        padding-bottom: env(safe-area-inset-bottom);
      }
      .nav-tab {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        padding: 0.5rem 0.25rem 0.4rem;
        border: none;
        background: transparent;
        cursor: pointer;
        text-decoration: none;
        color: var(--text-secondary);
        font-size: 0.7rem;
      }
      .nav-tab.active {
        color: var(--accent);
      }
      .nav-icon {
        font-size: 1.3rem;
        line-height: 1;
      }
      .nav-label {
        font-size: 0.68rem;
      }

      .avatar-frame {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        padding: 2px;
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
        font-size: 0.7rem;
      }
      .avatar-fallback {
        font-size: 1rem;
      }

      /* ── 帳戶面板（從底部帳戶分頁展開） ── */
      .account-panel {
        position: fixed;
        right: 0.75rem;
        bottom: 68px;
        z-index: 150;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 32px var(--shadow);
        min-width: 220px;
        padding: 0.4rem;
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

      /* 國家選單（共用樣式） */
      .country-picker-inline {
        position: relative;
      }
      .country-trigger {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        width: 100%;
        background: var(--bg);
        color: var(--text-primary);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        font-size: 0.875rem;
        white-space: nowrap;
        transition: border-color 0.2s;
      }
      .country-trigger:hover,
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
        max-width: 96px;
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
        bottom: calc(100% + 6px);
        right: 0;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 32px var(--shadow);
        min-width: 190px;
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

      /* ── 彈窗（頭像選擇） ── */
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
      .btn-secondary {
        background: var(--accent-light);
        color: var(--text-secondary);
        border: none;
        border-radius: 10px;
        padding: 0.625rem 1.5rem;
        cursor: pointer;
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
    `,
  ],
})
export class AppShellComponent {
  @ViewChild('avatarInput') avatarInputRef!: ElementRef<HTMLInputElement>;

  auth = inject(AuthService);
  profile = inject(UserProfileService);
  pref = inject(PreferenceService);

  countries = COUNTRIES;
  presetAvatars = PRESET_AVATARS;
  avatarParsed = computed(() => parseAvatar(this.profile.avatarUrl()));

  showAccount = signal(false);
  showHomeCountry = signal(false);
  showAvatarPicker = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const target = e.target as Node;
    const insidePanel = document.querySelector('.account-panel')?.contains(target);
    const insideTab = document.querySelector('.account-tab')?.contains(target);
    if (!insidePanel && !insideTab) {
      this.showAccount.set(false);
      this.showHomeCountry.set(false);
    } else if (!document.querySelector('.account-panel .country-picker-inline')?.contains(target)) {
      this.showHomeCountry.set(false);
    }
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

  openAvatarPicker(): void {
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
}
