import { Component, inject, computed } from '@angular/core';
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
        <a routerLink="/account" routerLinkActive="active" class="nav-tab">
          <span class="nav-icon avatar-frame">
            @if (avatarParsed().type === 'image') {
              <img [src]="$any(avatarParsed()).src" class="avatar-img" alt="avatar" />
            } @else if (avatarParsed().type === 'preset') {
              <span class="avatar-preset" [style.background]="$any(avatarParsed()).bg">{{ $any(avatarParsed()).emoji }}</span>
            } @else {
              <span class="avatar-fallback">👤</span>
            }
          </span>
          <span class="nav-label">{{ 'account.account' | transloco }}</span>
        </a>
      </nav>
    </div>
  `,
  styles: [`
    .shell { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); }

    .top-bar {
      position: sticky; top: 0; z-index: 50;
      display: flex; justify-content: flex-end; align-items: center;
      padding: 0.5rem 1rem; background: var(--header-bg);
      border-bottom: 1px solid var(--border);
    }
    .clock {
      font-size: 0.8rem; font-weight: 600; font-variant-numeric: tabular-nums;
      color: var(--accent); background: var(--accent-light);
      padding: 0.3rem 0.65rem; border-radius: 8px; white-space: nowrap; letter-spacing: 0.02em;
    }

    .shell-content { flex: 1; padding-bottom: 68px; }

    .bottom-nav {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 100;
      display: flex; background: var(--surface); border-top: 1px solid var(--border);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .nav-tab {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
      padding: 0.5rem 0.25rem 0.4rem; border: none; background: transparent; cursor: pointer;
      text-decoration: none; color: var(--text-secondary); font-size: 0.7rem;
    }
    .nav-tab.active { color: var(--accent); }
    .nav-icon { font-size: 1.3rem; line-height: 1; }
    .nav-label { font-size: 0.68rem; }

    .avatar-frame {
      width: 24px; height: 24px; border-radius: 50%; padding: 2px; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center;
    }
    .avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .avatar-preset {
      width: 100%; height: 100%; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: 0.7rem;
    }
    .avatar-fallback { font-size: 1rem; }
  `]
})
export class AppShellComponent {
  profile = inject(UserProfileService);
  pref = inject(PreferenceService);

  avatarParsed = computed(() => parseAvatar(this.profile.avatarUrl()));
}
