import { Component, inject, computed, signal, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { UserProfileService, parseAvatar } from '../services/user-profile.service';
import { PreferenceService, COUNTRIES, Country } from '../services/preference.service';
import { NearbySpotsService, NearbySpotsResult } from '../services/nearby-spots.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, TranslocoModule],
  template: `
    <div class="shell" [class.sidebar-collapsed]="sidebarCollapsed()">
      <div class="top-bar">
        <a routerLink="/trips" class="logo">
          <span class="logo-icon">🧳</span>
          <span class="logo-text">Tt</span>
        </a>
        <div class="top-right">
          <div class="dest-picker" [class.open]="showDestPicker()">
            <button class="dest-trigger" type="button" (click)="toggleDestPicker($event)">
              <span class="dest-label">{{ 'common.destination' | transloco }}</span>
              <span class="fi fi-{{ pref.country().code.toLowerCase() }}"></span>
              <span class="dest-code">{{ pref.country().code }}</span>
              <span class="caret" [class.flipped]="showDestPicker()">▾</span>
            </button>
            <div class="dest-dropdown">
              @for (c of countries; track c.code) {
                <button
                  type="button"
                  class="dest-option"
                  [class.selected]="c.code === pref.countryCode()"
                  (click)="selectDest(c)"
                >
                  <span class="fi fi-{{ c.code.toLowerCase() }}"></span>
                  <span class="cname">{{ c.nativeName }}</span>
                  <span class="currency-badge">{{ c.currency }}</span>
                </button>
              }
            </div>
          </div>
          <div class="clock">{{ pref.clockDisplay() }}</div>
        </div>
      </div>

      @if (nearbySpots(); as spots) {
        <div class="nearby-banner">
          <span class="nearby-text">{{
            'nearby.message'
              | transloco: { place: spots.placeName, radius: spots.radiusKm, count: spots.count }
          }}</span>
          <button
            class="nearby-dismiss"
            type="button"
            (click)="dismissNearby()"
            [attr.aria-label]="'common.close' | transloco"
          >
            ✕
          </button>
        </div>
      }

      <div class="shell-body">
        <nav class="side-nav">
          <button
            class="collapse-toggle"
            type="button"
            (click)="toggleSidebar()"
            [attr.aria-label]="'nav.collapse' | transloco"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="2"></rect>
              <line x1="10" y1="4" x2="10" y2="20"></line>
            </svg>
          </button>

          <a routerLink="/flight-watch" routerLinkActive="active" class="side-tab">
            <span class="side-icon">✈️</span>
            <span class="side-label">{{ 'nav.flightWatch' | transloco }}</span>
          </a>
          <a routerLink="/trips" routerLinkActive="active" class="side-tab">
            <span class="side-icon">🗺️</span>
            <span class="side-label">{{ 'nav.trips' | transloco }}</span>
          </a>
          <a routerLink="/exchange" routerLinkActive="active" class="side-tab">
            <span class="side-icon">⇄</span>
            <span class="side-label">{{ 'nav.exchange' | transloco }}</span>
          </a>
          <a routerLink="/settings" routerLinkActive="active" class="side-tab">
            <span class="side-icon">⚙️</span>
            <span class="side-label">{{ 'nav.settings' | transloco }}</span>
          </a>

          <div class="side-spacer"></div>

          <a routerLink="/account" routerLinkActive="active" class="side-tab">
            <span class="side-icon avatar-frame">
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
            <span class="side-label">{{ 'account.account' | transloco }}</span>
          </a>
        </nav>

        <main class="shell-content">
          <router-outlet />
        </main>
      </div>

      <nav class="bottom-nav">
        <a routerLink="/flight-watch" routerLinkActive="active" class="nav-tab">
          <span class="nav-icon">✈️</span>
          <span class="nav-label">{{ 'nav.flightWatch' | transloco }}</span>
        </a>
        <a routerLink="/trips" routerLinkActive="active" class="nav-tab">
          <span class="nav-icon">🗺️</span>
          <span class="nav-label">{{ 'nav.trips' | transloco }}</span>
        </a>
        <a routerLink="/exchange" routerLinkActive="active" class="nav-tab nav-tab-fab">
          <span class="nav-icon nav-icon-fab">⇄</span>
        </a>
        <a routerLink="/settings" routerLinkActive="active" class="nav-tab">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">{{ 'nav.settings' | transloco }}</span>
        </a>
        <a routerLink="/account" routerLinkActive="active" class="nav-tab">
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
        </a>
      </nav>
    </div>
  `,
  styles: [
    `
      .shell {
        height: 100dvh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: var(--bg);
      }

      .top-bar {
        position: sticky;
        top: 0;
        z-index: 50;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 1rem;
        background: var(--header-bg);
        border-bottom: 1px solid var(--border);
      }
      .logo {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
      }
      .logo-icon {
        font-size: 1.2rem;
        line-height: 1;
      }
      .logo-text {
        font-size: 1.1rem;
        font-weight: 800;
        color: var(--accent);
        letter-spacing: 0.02em;
      }
      .top-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .dest-picker {
        position: relative;
      }
      .dest-trigger {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-secondary);
        white-space: nowrap;
        border: none;
        background: transparent;
        cursor: pointer;
        padding: 0.25rem 0.3rem;
        border-radius: 8px;
        transition: background 0.15s;
      }
      .dest-trigger:hover {
        background: var(--icon-bg);
      }
      .dest-label {
        font-size: 0.72rem;
        font-weight: 500;
        color: var(--text-secondary);
      }
      .dest-trigger .fi {
        width: 1.15em;
        border-radius: 2px;
        flex-shrink: 0;
      }
      .dest-trigger .caret {
        font-size: 0.65rem;
        color: var(--text-secondary);
        transition: transform 0.2s;
      }
      .dest-trigger .caret.flipped {
        transform: rotate(180deg);
      }
      .dest-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 32px var(--shadow);
        min-width: 190px;
        max-height: 280px;
        overflow-y: auto;
        z-index: 100;
        display: none;
        scrollbar-width: thin;
      }
      .dest-picker.open .dest-dropdown {
        display: block;
      }
      .dest-option {
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
      .dest-option:hover {
        background: var(--accent-light);
      }
      .dest-option.selected {
        background: var(--accent-light);
        color: var(--accent);
        font-weight: 600;
      }
      .dest-option .fi {
        width: 1.2em;
        flex-shrink: 0;
        border-radius: 2px;
      }
      .dest-option .cname {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dest-option .currency-badge {
        font-size: 0.7rem;
        padding: 0.1rem 0.4rem;
        border-radius: 5px;
        background: var(--accent-light);
        color: var(--accent);
        font-weight: 700;
        flex-shrink: 0;
      }
      .dest-option.selected .currency-badge {
        background: var(--surface);
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

      .nearby-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: var(--accent-light);
        color: var(--accent);
        font-size: 0.82rem;
        font-weight: 600;
      }
      .nearby-dismiss {
        border: none;
        background: transparent;
        color: var(--accent);
        cursor: pointer;
        font-size: 0.8rem;
        flex-shrink: 0;
        padding: 0.15rem 0.4rem;
      }

      .shell-body {
        flex: 1;
        min-height: 0;
        display: flex;
      }

      .shell-content {
        flex: 1;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding-bottom: 68px;
      }
      /* 被路由插入的頁面元件（router-outlet 的下一個手足節點）填滿剩餘高度、
         捲動與否交由各頁面自己決定，外層 shell 本身永遠不捲動。
         這條規則實際定義在 src/styles.scss（全域），因為 router-outlet
         動態插入的元件不會帶有本元件的 ngcontent 封裝屬性，元件層級的
         scoped 選擇器（含 ::ng-deep）無法可靠命中它。 */

      /* ── 左側可收合清單（僅網頁版顯示）── */
      .side-nav {
        display: none;
      }

      /* ── 底部選單（手機/平板顯示）── */
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
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--icon-bg);
        transition: background 0.15s;
      }
      .nav-tab:hover .nav-icon {
        background: var(--icon-bg-hover);
      }
      .nav-icon.avatar-frame {
        background: transparent;
      }
      .nav-label {
        font-size: 0.68rem;
      }

      /* ── 中間凸起圓形按鈕（換匯）── */
      .nav-tab-fab {
        justify-content: flex-start;
        padding-top: 0;
      }
      .nav-icon-fab {
        width: 56px;
        height: 56px;
        font-size: 1.6rem;
        position: relative;
        top: -18px;
        color: #fff;
        background: var(--accent);
        box-shadow: 0 4px 12px var(--shadow);
      }
      .nav-tab-fab:hover .nav-icon-fab {
        background: var(--accent);
      }

      .avatar-frame {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        padding: 3px;
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

      /* ── 網頁版：底部選單改為左側可收合清單 ── */
      @media (hover: hover) and (pointer: fine) {
        .bottom-nav {
          display: none;
        }
        .shell-content {
          padding-bottom: 0;
        }

        .side-nav {
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          width: 208px;
          background: var(--surface);
          border-right: 1px solid var(--border);
          padding: 0.75rem 0.5rem;
          gap: 0.25rem;
          overflow-y: auto;
          scrollbar-width: none;
          transition: width 0.2s ease;
          position: sticky;
          top: 49px;
          align-self: flex-start;
          height: calc(100vh - 49px);
        }
        .side-nav::-webkit-scrollbar {
          display: none;
        }
        .sidebar-collapsed .side-nav {
          width: 64px;
        }

        .collapse-toggle {
          align-self: flex-end;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: var(--icon-bg);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          margin-bottom: 0.5rem;
          transition:
            background 0.15s,
            transform 0.2s;
          flex-shrink: 0;
        }
        .collapse-toggle:hover {
          background: var(--icon-bg-hover);
        }

        .side-tab {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 0.6rem;
          border-radius: 10px;
          text-decoration: none;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
        }
        .side-tab.active {
          color: var(--accent);
          background: var(--accent-light);
        }
        .side-icon {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          background: var(--icon-bg);
          transition: background 0.15s;
        }
        .side-tab:hover .side-icon {
          background: var(--icon-bg-hover);
        }
        .side-icon.avatar-frame {
          background: transparent;
          width: 32px;
          height: 32px;
        }
        .side-label {
          font-size: 0.9rem;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-collapsed .side-label {
          display: none;
        }
        .sidebar-collapsed .side-tab {
          justify-content: center;
        }

        .side-spacer {
          flex: 1;
        }
      }
    `,
  ],
})
export class AppShellComponent implements OnInit {
  profile = inject(UserProfileService);
  pref = inject(PreferenceService);
  private nearbySpotsService = inject(NearbySpotsService);

  private readonly SIDEBAR_KEY = 'sidebar_collapsed';
  sidebarCollapsed = signal<boolean>(localStorage.getItem(this.SIDEBAR_KEY) === '1');

  avatarParsed = computed(() => parseAvatar(this.profile.avatarUrl()));

  nearbySpots = signal<NearbySpotsResult | null>(null);

  countries = COUNTRIES;
  showDestPicker = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const el = document.querySelector('.dest-picker');
    if (el && !el.contains(e.target as Node)) this.showDestPicker.set(false);
  }

  toggleDestPicker(e: MouseEvent): void {
    e.stopPropagation();
    this.showDestPicker.set(!this.showDestPicker());
  }

  selectDest(c: Country): void {
    this.pref.setCountry(c.code);
    this.showDestPicker.set(false);
  }

  async ngOnInit(): Promise<void> {
    const result = await this.nearbySpotsService.findTodaysNearbySpots().catch(() => null);
    if (result && result.count > 0) this.nearbySpots.set(result);
  }

  dismissNearby(): void {
    this.nearbySpots.set(null);
  }

  toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    localStorage.setItem(this.SIDEBAR_KEY, next ? '1' : '0');
  }
}
