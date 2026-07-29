import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { TripService } from '../../core/services/trip.service';

@Component({
  selector: 'app-join-trip',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  template: `
    <div class="join-container">
      <div class="join-card">
        @if (status() === 'loading') {
          <p>⏳ {{ 'join.joining' | transloco }}</p>
        } @else if (status() === 'error') {
          <p class="error">❌ {{ 'join.invalidCode' | transloco }}</p>
          <a routerLink="/trips" class="btn-primary">{{ 'join.backToTrips' | transloco }}</a>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .join-container {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg);
        padding: 1rem;
      }
      .join-card {
        background: var(--surface);
        border-radius: 20px;
        padding: 3rem 2.5rem;
        text-align: center;
        box-shadow: 0 8px 32px var(--shadow);
        max-width: 400px;
        width: 100%;
        color: var(--text-primary);
      }
      .error {
        color: #e53e3e;
        margin-bottom: 1.5rem;
      }
      .btn-primary {
        display: inline-block;
        background: var(--accent);
        color: white;
        text-decoration: none;
        border-radius: 10px;
        padding: 0.625rem 1.5rem;
        font-weight: 600;
      }
    `,
  ],
})
export class JoinTripComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tripService = inject(TripService);

  status = signal<'loading' | 'error'>('loading');

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.paramMap.get('code') ?? '';
    const tripId = await this.tripService.joinByInviteCode(code);
    if (tripId) {
      this.router.navigate(['/trips', tripId]);
    } else {
      this.status.set('error');
    }
  }
}
