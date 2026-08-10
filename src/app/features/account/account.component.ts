import {
  Component,
  inject,
  computed,
  signal,
  AfterViewInit,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth.service';
import {
  UserProfileService,
  PRESET_AVATARS,
  PresetAvatar,
  parseAvatar,
} from '../../core/services/user-profile.service';
import { PreferenceService, COUNTRIES, Country } from '../../core/services/preference.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  template: `
    <div class="page-container">
      <div class="scale-wrap" #scaleWrap>
        <div class="avatar-hero">
          <button class="avatar-big" (click)="showAvatarPicker.set(true)">
            @if (avatarParsed().type === 'image') {
              <img [src]="$any(avatarParsed()).src" class="avatar-img" alt="avatar" />
            } @else if (avatarParsed().type === 'preset') {
              <span class="avatar-preset" [style.background]="$any(avatarParsed()).bg">{{
                $any(avatarParsed()).emoji
              }}</span>
            } @else {
              <span class="avatar-fallback">👤</span>
            }
          </button>
          <div class="account-name">{{ auth.user()?.email }}</div>
        </div>

        <div class="card">
          <button class="row-item" (click)="showAvatarPicker.set(true)">
            <span>👤 {{ 'account.changeAvatar' | transloco }}</span>
            <span class="chevron">›</span>
          </button>

          <div class="row-item country-row" (click)="toggleHomeCountry($event)">
            <span class="row-label">📍 {{ 'account.homeCountry' | transloco }}</span>
            <div class="country-picker-inline" [class.open]="showHomeCountry()">
              <div class="country-trigger">
                <span class="fi fi-{{ pref.homeCountry().code.toLowerCase() }}"></span>
                <span class="cname">{{ pref.homeCountry().nativeName }}</span>
                <span class="caret" [class.flipped]="showHomeCountry()">▾</span>
              </div>
              <div class="country-dropdown" (click)="$event.stopPropagation()">
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

          <button class="row-item danger" (click)="auth.signOut()">
            <span>→ {{ 'auth.signOut' | transloco }}</span>
          </button>
        </div>
      </div>

      @if (showAvatarPicker()) {
        <div class="modal-backdrop" (click)="showAvatarPicker.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>{{ 'account.changeAvatar' | transloco }}</h3>
            <button class="btn-secondary full-width" (click)="avatarInputRef.nativeElement.click()">
              📷 {{ 'account.uploadPhoto' | transloco }}
            </button>
            <input
              #avatarInput
              type="file"
              accept="image/*"
              hidden
              (change)="onAvatarSelected($event)"
            />
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
      .page-container {
        max-width: 500px;
        margin: 0 auto;
        padding: 6.5rem 1.5rem 1.5rem;
        background: var(--bg);
        height: calc(100dvh - 112px);
        min-height: 0;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        overflow: hidden;
      }
      .scale-wrap {
        width: 100%;
        transform-origin: center center;
      }
      @media (hover: hover) and (pointer: fine) {
        .page-container {
          padding-top: 1.5rem;
          align-items: center;
        }
      }
      h1 {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 1.5rem;
        text-align: center;
      }

      .avatar-hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
      }
      .avatar-big {
        width: 96px;
        height: 96px;
        border-radius: 50%;
        padding: 4px;
        box-sizing: border-box;
        border: none;
        background: var(--surface);
        box-shadow: 0 4px 20px var(--shadow);
        cursor: pointer;
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
        font-size: 2.5rem;
      }
      .avatar-fallback {
        font-size: 3rem;
      }
      .account-name {
        color: var(--text-secondary);
        font-size: 0.9rem;
      }

      .card {
        background: var(--surface);
        border-radius: 16px;
        box-shadow: 0 4px 20px var(--shadow);
        /* overflow: visible — 讓絕對定位下拉選單可以超出 card 邊界 */
      }
      .row-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        width: 100%;
        padding: 1rem 1.25rem;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        color: var(--text-primary);
        font-size: 0.95rem;
        border-bottom: 1px solid var(--border);
      }
      .row-item:first-child {
        border-radius: 16px 16px 0 0;
      }
      .row-item:last-child {
        border-bottom: none;
        border-radius: 0 0 16px 16px;
      }
      .row-item:hover {
        background: var(--accent-light);
      }
      .row-item.danger {
        color: #e53e3e;
      }
      .row-item.danger:hover {
        background: #fff0f0;
      }
      .chevron {
        color: var(--text-secondary);
      }

      .country-row {
        cursor: pointer;
      }
      .row-label {
        flex-shrink: 0;
      }
      .country-picker-inline {
        position: relative;
        flex: 1;
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
        padding: 0.4rem 0.6rem;
        font-size: 0.85rem;
        white-space: nowrap;
        pointer-events: none;
      }
      .country-picker-inline.open .country-trigger {
        border-color: var(--accent);
      }
      .fi {
        width: 1.2em;
        flex-shrink: 0;
        border-radius: 2px;
      }
      .cname {
        flex: 1;
        font-weight: 500;
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
        font-size: 0.65rem;
        color: var(--text-secondary);
        transition: transform 0.2s;
      }
      .caret.flipped {
        transform: rotate(180deg);
      }
      .country-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        left: 0;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 32px var(--shadow);
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
export class AccountComponent implements AfterViewInit {
  @ViewChild('avatarInput') avatarInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('scaleWrap') scaleWrap?: ElementRef<HTMLElement>;

  auth = inject(AuthService);
  profile = inject(UserProfileService);
  pref = inject(PreferenceService);

  countries = COUNTRIES;
  presetAvatars = PRESET_AVATARS;
  avatarParsed = computed(() => parseAvatar(this.profile.avatarUrl()));

  showHomeCountry = signal(false);
  showAvatarPicker = signal(false);

  ngAfterViewInit(): void {
    setTimeout(() => this.applyScale());
  }

  @HostListener('window:resize')
  applyScale(): void {
    const el = this.scaleWrap?.nativeElement;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    el.style.transform = 'none';
    const contentH = el.scrollHeight;
    const contentW = el.scrollWidth;
    const cs = getComputedStyle(parent);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const availH = parent.clientHeight - padY;
    const availW = parent.clientWidth - padX;
    if (!contentH || !contentW) return;
    const scale = Math.min(1, availH / contentH, availW / contentW);
    el.style.transform = scale < 1 ? `scale(${scale})` : 'none';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!document.querySelector('.country-picker-inline')?.contains(e.target as Node)) {
      this.showHomeCountry.set(false);
    }
  }

  toggleHomeCountry(e: MouseEvent): void {
    e.stopPropagation();
    this.showHomeCountry.set(!this.showHomeCountry());
  }

  selectHomeCountry(c: Country): void {
    this.pref.setHomeCountry(c.code);
    this.showHomeCountry.set(false);
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
