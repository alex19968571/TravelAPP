import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Trip, TripMember } from '../../core/models';
import { TripService } from '../../core/services/trip.service';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a routerLink="/trips" class="back-btn">← {{ 'common.back' | transloco }}</a>
        <h1>{{ trip()?.title ?? ('tripDetail.loading' | transloco) }}</h1>
      </header>

      @if (trip(); as t) {
        <div class="section-grid">
          <!-- 功能導航 -->
          <div class="nav-cards">
            <a [routerLink]="['/trips', t.id, 'itinerary']" class="nav-card">
              <span class="nav-icon">🗺️</span>
              <span>{{ 'tripDetail.itinerary' | transloco }}</span>
            </a>
            <a [routerLink]="['/trips', t.id, 'shopping']" class="nav-card">
              <span class="nav-icon">🛍️</span>
              <span>{{ 'tripDetail.shopping' | transloco }}</span>
            </a>
            <a [routerLink]="['/trips', t.id, 'expenses']" class="nav-card">
              <span class="nav-icon">💰</span>
              <span>{{ 'tripDetail.expenses' | transloco }}</span>
            </a>
          </div>

          <!-- 成員清單 -->
          <div class="card">
            <h3>{{ 'tripDetail.members' | transloco }}</h3>
            <div class="member-list">
              @for (m of members(); track m.id) {
                <div class="member-row">
                  <span class="member-avatar">{{ m.display_name.charAt(0) }}</span>
                  <span class="member-name">{{ m.display_name }}</span>
                  <span class="member-role badge">{{ m.role }}</span>
                  @if (m.role !== 'OWNER') {
                    <button class="remove-btn" (click)="removeMember(m.id)">×</button>
                  }
                </div>
              }
            </div>
          </div>

          <!-- 邀請成員（邀請碼／連結） -->
          <div class="card">
            <h3>{{ 'tripDetail.inviteTitle' | transloco }}</h3>
            <p class="section-desc">{{ 'tripDetail.inviteDesc' | transloco }}</p>

            <div class="invite-row">
              <div class="invite-label editor">✏️ {{ 'tripDetail.inviteEditor' | transloco }}</div>
              <div class="invite-controls">
                <code class="invite-code">{{ t.invite_code_editor }}</code>
                <button class="btn-sm" (click)="copy(t.invite_code_editor, 'editorCode')">
                  {{
                    (copied() === 'editorCode' ? 'tripDetail.copied' : 'tripDetail.copyCode')
                      | transloco
                  }}
                </button>
                <button
                  class="btn-sm"
                  (click)="copy(inviteLink(t.invite_code_editor), 'editorLink')"
                >
                  {{
                    (copied() === 'editorLink' ? 'tripDetail.copied' : 'tripDetail.copyLink')
                      | transloco
                  }}
                </button>
              </div>
            </div>

            <div class="invite-row">
              <div class="invite-label viewer">👀 {{ 'tripDetail.inviteViewer' | transloco }}</div>
              <div class="invite-controls">
                <code class="invite-code">{{ t.invite_code_viewer }}</code>
                <button class="btn-sm" (click)="copy(t.invite_code_viewer, 'viewerCode')">
                  {{
                    (copied() === 'viewerCode' ? 'tripDetail.copied' : 'tripDetail.copyCode')
                      | transloco
                  }}
                </button>
                <button
                  class="btn-sm"
                  (click)="copy(inviteLink(t.invite_code_viewer), 'viewerLink')"
                >
                  {{
                    (copied() === 'viewerLink' ? 'tripDetail.copied' : 'tripDetail.copyLink')
                      | transloco
                  }}
                </button>
              </div>
            </div>
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
      .section-grid {
        display: grid;
        gap: 1.5rem;
      }
      .nav-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
      }
      .nav-card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        text-align: center;
        box-shadow: 0 4px 20px var(--shadow);
        text-decoration: none;
        color: var(--text-primary);
        transition: transform 0.2s;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }
      .nav-card:hover {
        transform: translateY(-3px);
      }
      .nav-icon {
        font-size: 2.5rem;
      }
      .card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 4px 20px var(--shadow);
      }
      .card h3 {
        margin: 0 0 1rem;
        color: var(--text-primary);
      }
      .section-desc {
        margin: -0.5rem 0 1rem;
        color: var(--text-secondary);
        font-size: 0.85rem;
      }
      .member-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .member-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
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

      .invite-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.875rem 1rem;
        border: 1.5px solid var(--border);
        border-radius: 12px;
        margin-bottom: 0.75rem;
      }
      .invite-row:last-child {
        margin-bottom: 0;
      }
      .invite-label {
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--text-primary);
        white-space: nowrap;
      }
      .invite-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .invite-code {
        font-family: monospace;
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        background: var(--accent-light);
        color: var(--accent);
        padding: 0.3rem 0.6rem;
        border-radius: 8px;
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
      }
      .btn-sm:hover {
        background: var(--accent);
        color: white;
      }
    `,
  ],
})
export class TripDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tripService = inject(TripService);

  trip = signal<Trip | undefined>(undefined);
  members = signal<TripMember[]>([]);
  copied = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.trip.set(await this.tripService.getById(id));
    this.members.set(await this.tripService.getMembers(id));
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

  async removeMember(memberId: string): Promise<void> {
    await this.tripService.removeMember(memberId);
    this.members.set(await this.tripService.getMembers(this.trip()!.id));
  }
}
