import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Trip, TripMember } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-trip-members',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a
          [routerLink]="['/trips']"
          class="back-btn"
          [attr.aria-label]="'itinerary.backToTrip' | transloco"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </a>
        <h1>{{ 'tripDetail.members' | transloco }}</h1>
      </header>

      <div class="card">
        <div class="card-header-row">
          <h3>{{ 'tripDetail.members' | transloco }}</h3>
          <div class="invite-menu" [class.open]="showInviteMenu()">
            <button class="icon-btn" (click)="toggleInviteMenu($event)">＋</button>
            <div class="invite-dropdown">
              <button class="invite-option" (click)="openInviteModal('EDITOR')">
                ✏️ {{ 'tripDetail.inviteEditor' | transloco }}
              </button>
              <button class="invite-option" (click)="openInviteModal('VIEWER')">
                👀 {{ 'tripDetail.inviteViewer' | transloco }}
              </button>
            </div>
          </div>
        </div>

        <div class="member-list">
          @for (m of members(); track m.id) {
            <div class="member-row-wrap">
              <button class="swipe-delete" (click)="removeMember(m.id)">
                {{ 'common.delete' | transloco }}
              </button>
              <div
                class="member-row"
                [class.swiped]="swipedId() === m.id"
                (touchstart)="onTouchStart($event)"
                (touchmove)="onTouchMove($event)"
                (touchend)="onTouchEnd($event, m)"
              >
                <span class="member-avatar">{{ m.display_name.charAt(0) }}</span>
                <span class="member-name">{{ m.display_name }}</span>
                <span class="member-role badge">{{ m.role }}</span>
                @if (canRemove(m)) {
                  <button class="remove-btn" (click)="removeMember(m.id)">×</button>
                }
              </div>
            </div>
          }
        </div>
      </div>

      @if (inviteModalRole(); as role) {
        <div class="modal-backdrop" (click)="closeInviteModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>
              {{
                (role === 'EDITOR' ? 'tripDetail.inviteEditor' : 'tripDetail.inviteViewer')
                  | transloco
              }}
            </h3>

            <div class="modal-row">
              <label>{{ 'trips.inviteCode' | transloco }}</label>
              <div class="modal-value-row">
                <code>{{
                  role === 'EDITOR' ? trip()?.invite_code_editor : trip()?.invite_code_viewer
                }}</code>
                <button
                  class="btn-sm"
                  (click)="
                    copy(
                      role === 'EDITOR' ? trip()?.invite_code_editor : trip()?.invite_code_viewer,
                      'code'
                    )
                  "
                >
                  {{
                    (copied() === 'code' ? 'tripDetail.copied' : 'tripDetail.copyCode') | transloco
                  }}
                </button>
              </div>
            </div>

            <div class="modal-row">
              <label>{{ 'tripDetail.inviteLinkLabel' | transloco }}</label>
              <div class="modal-value-row">
                <span class="link-text">{{
                  inviteLink(
                    role === 'EDITOR' ? trip()?.invite_code_editor : trip()?.invite_code_viewer
                  )
                }}</span>
                <button
                  class="btn-sm"
                  (click)="
                    copy(
                      inviteLink(
                        role === 'EDITOR' ? trip()?.invite_code_editor : trip()?.invite_code_viewer
                      ),
                      'link'
                    )
                  "
                >
                  {{
                    (copied() === 'link' ? 'tripDetail.copied' : 'tripDetail.copyLink') | transloco
                  }}
                </button>
              </div>
            </div>

            <button class="btn-secondary full-width" (click)="closeInviteModal()">
              {{ 'common.confirm' | transloco }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 900px;
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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        flex-shrink: 0;
        color: var(--accent);
        text-decoration: none;
        font-size: 1.3rem;
        font-weight: 600;
        background: var(--icon-bg);
        transition: background 0.15s;
      }
      .back-btn:hover {
        background: var(--icon-bg-hover);
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
      }
      .card h3 {
        margin: 0;
        color: var(--text-primary);
      }
      .card-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }

      /* 邀請選單 */
      .invite-menu {
        position: relative;
      }
      .icon-btn {
        background: var(--icon-bg);
        color: var(--accent);
        border: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        font-size: 1.1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      }
      .icon-btn:hover {
        background: var(--icon-bg-hover);
      }
      .invite-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 32px var(--shadow);
        min-width: 180px;
        z-index: 100;
        display: none;
        padding: 0.4rem;
      }
      .invite-menu.open .invite-dropdown {
        display: block;
      }
      .invite-option {
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
      .invite-option:hover {
        background: var(--accent-light);
      }

      /* 成員清單 */
      .member-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .member-row-wrap {
        position: relative;
        overflow: hidden;
        border-radius: 10px;
      }
      .swipe-delete {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 72px;
        background: #e53e3e;
        color: white;
        border: none;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        display: none;
      }
      .member-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: var(--surface);
        position: relative;
        transition: transform 0.2s ease;
      }
      .member-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--accent);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 0.9rem;
        flex-shrink: 0;
      }
      .member-name {
        flex: 1;
        font-weight: 500;
        color: var(--text-primary);
      }
      .badge {
        font-size: 0.75rem;
        padding: 0.2rem 0.6rem;
        border-radius: 20px;
        background: var(--accent-light);
        color: var(--accent);
      }
      .remove-btn {
        background: none;
        border: none;
        color: #e53e3e;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0 0.25rem;
      }

      @media (hover: none) and (pointer: coarse) {
        .remove-btn {
          display: none;
        }
        .swipe-delete {
          display: block;
        }
        .member-row.swiped {
          transform: translateX(-72px);
        }
      }

      /* ── 彈窗 ── */
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
        max-width: 380px;
        width: 100%;
        box-shadow: 0 12px 40px var(--shadow);
      }
      .modal-card h3 {
        margin: 0 0 1rem;
      }
      .modal-row {
        margin-bottom: 1rem;
      }
      .modal-row label {
        display: block;
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-bottom: 0.35rem;
      }
      .modal-value-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .modal-value-row code {
        font-family: monospace;
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        background: var(--accent-light);
        color: var(--accent);
        padding: 0.3rem 0.6rem;
        border-radius: 8px;
        flex-shrink: 0;
      }
      .link-text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
      .btn-sm {
        background: var(--accent-light);
        color: var(--accent);
        border: none;
        border-radius: 8px;
        padding: 0.375rem 0.75rem;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 500;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .btn-sm:hover {
        background: var(--accent);
        color: white;
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
        margin-top: 0.5rem;
      }
    `,
  ],
})
export class TripMembersComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tripService = inject(TripService);
  private auth = inject(AuthService);

  tripId!: string;
  trip = signal<Trip | undefined>(undefined);
  members = signal<TripMember[]>([]);
  copied = signal<string | null>(null);
  showInviteMenu = signal(false);
  inviteModalRole = signal<'EDITOR' | 'VIEWER' | null>(null);
  swipedId = signal<string | null>(null);

  private touchStartX = 0;
  private touchDeltaX = 0;

  isOwner = computed(() => this.trip()?.owner_id === this.auth.user()?.id);

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    this.trip.set(await this.tripService.getById(this.tripId));
    this.members.set(await this.tripService.getMembers(this.tripId));
  }

  canRemove(m: TripMember): boolean {
    return this.isOwner() && m.role !== 'OWNER';
  }

  toggleInviteMenu(e: MouseEvent): void {
    e.stopPropagation();
    this.showInviteMenu.set(!this.showInviteMenu());
  }

  openInviteModal(role: 'EDITOR' | 'VIEWER'): void {
    this.showInviteMenu.set(false);
    this.copied.set(null);
    this.inviteModalRole.set(role);
  }

  closeInviteModal(): void {
    this.inviteModalRole.set(null);
  }

  inviteLink(code: string | null | undefined): string {
    const base = document.querySelector('base')?.href ?? `${window.location.origin}/`;
    return `${base}join/${code}`;
  }

  async copy(text: string | null | undefined, key: string): Promise<void> {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    this.copied.set(key);
    setTimeout(() => {
      if (this.copied() === key) this.copied.set(null);
    }, 1500);
  }

  // ── 觸控左滑刪除（Gmail / iOS 郵件慣用手勢） ──────────────────
  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
    this.touchDeltaX = 0;
  }

  onTouchMove(e: TouchEvent): void {
    this.touchDeltaX = e.touches[0].clientX - this.touchStartX;
  }

  onTouchEnd(e: TouchEvent, m: TripMember): void {
    if (!this.canRemove(m)) return;
    if (this.touchDeltaX < -40) {
      e.preventDefault();
      this.swipedId.set(m.id);
    } else if (this.touchDeltaX > 20 || this.swipedId() === m.id) {
      e.preventDefault();
      this.swipedId.set(null);
    }
  }

  async removeMember(memberId: string): Promise<void> {
    this.swipedId.set(null);
    await this.tripService.removeMember(memberId);
    this.members.set(await this.tripService.getMembers(this.tripId));
  }
}
