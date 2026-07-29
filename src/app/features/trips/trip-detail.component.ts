import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Trip, TripMember } from '../../core/models';
import { TripService } from '../../core/services/trip.service';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslocoModule],
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

          <!-- 成員管理 -->
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

            <form [formGroup]="memberForm" (ngSubmit)="addMember()" class="add-member-form">
              <input
                formControlName="display_name"
                [placeholder]="'tripDetail.addMemberPlaceholder' | transloco"
              />
              <button type="submit" [disabled]="memberForm.invalid" class="btn-primary">
                {{ 'tripDetail.addMember' | transloco }}
              </button>
            </form>
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
      .member-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 1rem;
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
      .add-member-form {
        display: flex;
        gap: 0.75rem;
      }
      .add-member-form input {
        flex: 1;
        padding: 0.625rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 0.95rem;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      .btn-primary {
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 0.625rem 1.25rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .btn-primary:disabled {
        opacity: 0.5;
      }
    `,
  ],
})
export class TripDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tripService = inject(TripService);
  private fb = inject(FormBuilder);

  trip = signal<Trip | undefined>(undefined);
  members = signal<TripMember[]>([]);

  memberForm = this.fb.group({
    display_name: ['', [Validators.required, Validators.maxLength(100)]],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.trip.set(await this.tripService.getById(id));
    this.members.set(await this.tripService.getMembers(id));
  }

  async addMember(): Promise<void> {
    if (this.memberForm.invalid) return;
    const tripId = this.trip()!.id;
    await this.tripService.addMember(tripId, this.memberForm.value.display_name!);
    this.memberForm.reset();
    this.members.set(await this.tripService.getMembers(tripId));
  }

  async removeMember(memberId: string): Promise<void> {
    await this.tripService.removeMember(memberId);
    this.members.set(await this.tripService.getMembers(this.trip()!.id));
  }
}
