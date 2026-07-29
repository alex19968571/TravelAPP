import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Trip, TripMember, ItineraryItem } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { AuthService } from '../../core/services/auth.service';

interface DateTab {
  date: Date | null;
  dayNumber: number;
}

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a routerLink="/trips" class="back-btn" [attr.aria-label]="'common.back' | transloco">
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
        <h1>{{ trip()?.title ?? ('tripDetail.loading' | transloco) }}</h1>
      </header>

      @if (trip(); as t) {
        <div class="section-grid">
          <!-- 日期分頁 -->
          <div class="date-tabs-wrap">
            <button class="date-arrow desktop-only" (click)="scrollDates(-1)">‹</button>
            <div class="date-tabs" #dateTabsEl>
              @for (d of dateTabs(); track $index) {
                <button
                  class="date-tab"
                  [class.active]="selectedDayIndex() === $index"
                  (click)="selectedDayIndex.set($index)"
                >
                  {{ formatTabDate(d) }}
                </button>
              }
            </div>
            <button class="date-arrow desktop-only" (click)="scrollDates(1)">›</button>
          </div>

          <div class="card day-content">
            @if (itemsForSelectedDay().length === 0) {
              <p class="empty-day">{{ 'tripDetail.notScheduled' | transloco }}</p>
            } @else {
              <div class="item-list">
                @for (item of itemsForSelectedDay(); track item.id; let i = $index) {
                  <div class="itinerary-item">
                    <span class="order-badge">{{ i + 1 }}</span>
                    <div class="item-info">
                      <strong>{{ item.place_name }}</strong>
                      <span class="coords"
                        >{{ item.latitude.toFixed(4) }}, {{ item.longitude.toFixed(4) }}</span
                      >
                    </div>
                    <button class="remove-btn" (click)="removeItem(item.id)">×</button>
                  </div>
                }
              </div>
            }
            <form [formGroup]="addItemForm" (ngSubmit)="addItem(t.id)" class="add-item-form">
              <input
                formControlName="place_name"
                [placeholder]="'itinerary.spotNamePlaceholder' | transloco"
              />
              <input
                formControlName="latitude"
                type="number"
                step="any"
                [placeholder]="'itinerary.latitude' | transloco"
              />
              <input
                formControlName="longitude"
                type="number"
                step="any"
                [placeholder]="'itinerary.longitude' | transloco"
              />
              <button type="submit" class="btn-primary" [disabled]="addItemForm.invalid">
                {{ 'itinerary.submit' | transloco }}
              </button>
            </form>
          </div>

          <!-- 成員清單 -->
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
        </div>

        <a
          class="fab"
          [routerLink]="['/trips', t.id, 'itinerary']"
          [attr.aria-label]="'tripDetail.openMap' | transloco"
          >＋</a
        >

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
                  <code>{{ role === 'EDITOR' ? t.invite_code_editor : t.invite_code_viewer }}</code>
                  <button
                    class="btn-sm"
                    (click)="
                      copy(role === 'EDITOR' ? t.invite_code_editor : t.invite_code_viewer, 'code')
                    "
                  >
                    {{
                      (copied() === 'code' ? 'tripDetail.copied' : 'tripDetail.copyCode')
                        | transloco
                    }}
                  </button>
                </div>
              </div>

              <div class="modal-row">
                <label>{{ 'tripDetail.inviteLinkLabel' | transloco }}</label>
                <div class="modal-value-row">
                  <span class="link-text">{{
                    inviteLink(role === 'EDITOR' ? t.invite_code_editor : t.invite_code_viewer)
                  }}</span>
                  <button
                    class="btn-sm"
                    (click)="
                      copy(
                        inviteLink(role === 'EDITOR' ? t.invite_code_editor : t.invite_code_viewer),
                        'link'
                      )
                    "
                  >
                    {{
                      (copied() === 'link' ? 'tripDetail.copied' : 'tripDetail.copyLink')
                        | transloco
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
        background: var(--accent-light);
      }
      h1 {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }
      .section-grid {
        display: grid;
        gap: 1.5rem;
      }

      /* 日期分頁 */
      .date-tabs-wrap {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .date-arrow {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--accent-light);
        color: var(--accent);
        border: none;
        font-size: 1.1rem;
        cursor: pointer;
      }
      .date-tabs {
        flex: 1;
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding: 0.25rem 0;
      }
      .date-tabs::-webkit-scrollbar {
        display: none;
      }
      .date-tab {
        flex-shrink: 0;
        padding: 0.5rem 1rem;
        border-radius: 10px;
        border: 1.5px solid var(--border);
        background: var(--surface);
        color: var(--text-secondary);
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        white-space: nowrap;
      }
      .date-tab.active {
        border-color: var(--accent);
        background: var(--accent);
        color: white;
      }

      @media (hover: none) and (pointer: coarse) {
        .desktop-only {
          display: none !important;
        }
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

      .empty-day {
        color: var(--text-secondary);
        font-size: 0.9rem;
        text-align: center;
        padding: 1rem 0;
      }
      .item-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .itinerary-item {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        padding: 0.75rem;
        background: var(--accent-light);
        border-radius: 10px;
      }
      .order-badge {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--accent);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        font-weight: 600;
        flex-shrink: 0;
      }
      .item-info {
        flex: 1;
        color: var(--text-primary);
      }
      .item-info strong {
        display: block;
        font-size: 0.95rem;
      }
      .coords {
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
      .add-item-form {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr auto;
        gap: 0.5rem;
      }
      .add-item-form input {
        padding: 0.55rem 0.75rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 0.875rem;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
        min-width: 0;
      }
      @media (max-width: 600px) {
        .add-item-form {
          grid-template-columns: 1fr 1fr;
        }
      }

      /* 邀請選單 */
      .invite-menu {
        position: relative;
      }
      .icon-btn {
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        font-size: 1.1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
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

      /* 浮動新增按鈕（導向地圖頁） */
      .fab {
        position: fixed;
        right: 1.25rem;
        bottom: 84px;
        z-index: 60;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: var(--accent);
        color: white;
        text-decoration: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.6rem;
        box-shadow: 0 6px 20px var(--shadow);
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
      .btn-primary {
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 0.625rem 1.5rem;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-primary:disabled {
        opacity: 0.5;
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
export class TripDetailComponent implements OnInit {
  @ViewChild('dateTabsEl') dateTabsEl?: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private tripService = inject(TripService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  trip = signal<Trip | undefined>(undefined);
  members = signal<TripMember[]>([]);
  items = signal<ItineraryItem[]>([]);
  copied = signal<string | null>(null);
  showInviteMenu = signal(false);
  inviteModalRole = signal<'EDITOR' | 'VIEWER' | null>(null);
  swipedId = signal<string | null>(null);
  selectedDayIndex = signal(0);

  private touchStartX = 0;
  private touchDeltaX = 0;

  isOwner = computed(() => this.trip()?.owner_id === this.auth.user()?.id);

  dateTabs = computed<DateTab[]>(() => {
    const t = this.trip();
    if (t?.start_date_utc) {
      const start = new Date(t.start_date_utc);
      const end = t.end_date_utc ? new Date(t.end_date_utc) : start;
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const tabs: DateTab[] = [];
      const cur = new Date(startDay);
      let n = 1;
      while (cur <= endDay) {
        tabs.push({ date: new Date(cur), dayNumber: n });
        cur.setDate(cur.getDate() + 1);
        n++;
      }
      return tabs.length ? tabs : [{ date: startDay, dayNumber: 1 }];
    }
    const maxDay = Math.max(1, ...this.items().map((i) => i.day_number));
    return Array.from({ length: maxDay }, (_, i) => ({ date: null, dayNumber: i + 1 }));
  });

  itemsForSelectedDay = computed(() => {
    const tabs = this.dateTabs();
    const dn = tabs[this.selectedDayIndex()]?.dayNumber ?? 1;
    return this.items()
      .filter((i) => i.day_number === dn)
      .sort((a, b) => a.order_index - b.order_index);
  });

  addItemForm = this.fb.group({
    place_name: ['', [Validators.required, Validators.maxLength(200)]],
    latitude: [null as number | null, Validators.required],
    longitude: [null as number | null, Validators.required],
  });

  formatTabDate(tab: DateTab): string {
    if (!tab.date) return `${tab.dayNumber}`;
    return `${tab.date.getMonth() + 1}/${tab.date.getDate()}`;
  }

  scrollDates(dir: number): void {
    this.dateTabsEl?.nativeElement.scrollBy({ left: dir * 140, behavior: 'smooth' });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.trip.set(await this.tripService.getById(id));
    this.members.set(await this.tripService.getMembers(id));
    this.items.set(await this.tripService.getItinerary(id));
  }

  async addItem(tripId: string): Promise<void> {
    if (this.addItemForm.invalid) return;
    const { place_name, latitude, longitude } = this.addItemForm.value;
    const dayNumber = this.dateTabs()[this.selectedDayIndex()]?.dayNumber ?? 1;
    const existing = this.items().filter((i) => i.day_number === dayNumber);
    await this.tripService.addItineraryItem({
      trip_id: tripId,
      day_number: dayNumber,
      order_index: existing.length,
      place_name: place_name!,
      latitude: latitude!,
      longitude: longitude!,
    });
    this.addItemForm.reset();
    this.items.set(await this.tripService.getItinerary(tripId));
  }

  async removeItem(itemId: string): Promise<void> {
    await this.tripService.removeItineraryItem(itemId);
    this.items.set(await this.tripService.getItinerary(this.trip()!.id));
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
      this.swipedId.set(m.id);
    } else if (this.touchDeltaX > 20 || this.swipedId() === m.id) {
      this.swipedId.set(null);
    }
  }

  async removeMember(memberId: string): Promise<void> {
    this.swipedId.set(null);
    await this.tripService.removeMember(memberId);
    this.members.set(await this.tripService.getMembers(this.trip()!.id));
  }
}
