import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { UserProfileService, parseAvatar } from '../services/user-profile.service';
import { PreferenceService } from '../services/preference.service';

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
        <div class="clock">{{ pref.clockDisplay() }}</div>
      </div>

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

          <a routerLink="/trips" routerLinkActive="active" class="side-tab">
            <span class="side-icon">🗺️</span>
            <span class="side-label">{{ 'nav.trips' | transloco }}</span>
          </a>
          <a routerLink="/exchange" routerLinkActive="active" class="side-tab">
            <span class="side-icon">💱</span>
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

      .shell-body {
        flex: 1;
        display: flex;
      }

      .shell-content {
        flex: 1;
        min-width: 0;
        padding-bottom: 68px;
      }

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
          transition: width 0.2s ease;
          position: sticky;
          top: 49px;
          align-self: flex-start;
          height: calc(100vh - 49px);
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
export class AppShellComponent {
  profile = inject(UserProfileService);
  pref = inject(PreferenceService);

  private readonly SIDEBAR_KEY = 'sidebar_collapsed';
  sidebarCollapsed = signal<boolean>(localStorage.getItem(this.SIDEBAR_KEY) === '1');

  avatarParsed = computed(() => parseAvatar(this.profile.avatarUrl()));

  toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    localStorage.setItem(this.SIDEBAR_KEY, next ? '1' : '0');
  }
}
