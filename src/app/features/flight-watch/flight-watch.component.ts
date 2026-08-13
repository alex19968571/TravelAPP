import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { FlightWatch } from '../../core/models';
import { FlightWatchService } from '../../core/services/flight-watch.service';
import { FlightPriceService } from '../../core/services/flight-price.service';
import { AuthService } from '../../core/services/auth.service';
import { PreferenceService } from '../../core/services/preference.service';

@Component({
  selector: 'app-flight-watch',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, DecimalPipe, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a [routerLink]="['/trips']" class="back-btn" [attr.aria-label]="'common.back' | transloco">
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
        <div class="header-mid">
          <h1>✈️ {{ 'flightWatch.title' | transloco }}</h1>
        </div>
        <button class="btn-icon add-trigger" type="button" (click)="showAddModal.set(true)">
          ＋
        </button>
      </header>

      @if (showAddModal()) {
        <div class="modal-backdrop" (click)="closeAddModal()">
          <form
            [formGroup]="form"
            (ngSubmit)="addWatch()"
            class="card add-form modal-card"
            (click)="$event.stopPropagation()"
          >
            <div class="form-grid">
              <div class="form-row">
                <label>{{ 'flightWatch.origin' | transloco }} *</label>
                <input
                  formControlName="origin"
                  maxlength="3"
                  placeholder="TPE"
                  style="text-transform:uppercase"
                />
              </div>
              <div class="form-row">
                <label>{{ 'flightWatch.destination' | transloco }} *</label>
                <input
                  formControlName="destination"
                  maxlength="3"
                  placeholder="NRT"
                  style="text-transform:uppercase"
                />
              </div>
              <div class="form-row">
                <label>{{ 'flightWatch.departDate' | transloco }} *</label>
                <input formControlName="depart_date" type="date" />
              </div>
              <div class="form-row">
                <label>{{ 'flightWatch.returnDate' | transloco }}</label>
                <input formControlName="return_date" type="date" />
              </div>
              <div class="form-row">
                <label>{{ 'flightWatch.targetPrice' | transloco }}</label>
                <input formControlName="target_price" type="number" min="0" step="any" />
              </div>
              <div class="form-row">
                <label>{{ 'flightWatch.currency' | transloco }}</label>
                <input formControlName="currency" maxlength="3" style="text-transform:uppercase" />
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="closeAddModal()">
                {{ 'common.cancel' | transloco }}
              </button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid">
                {{ 'flightWatch.addWatch' | transloco }}
              </button>
            </div>
          </form>
        </div>
      }

      <div class="page-scroll">
        @if (watches().length === 0) {
          <div class="empty-state">
            <p>{{ 'flightWatch.noWatches' | transloco }}</p>
          </div>
        }
        <div class="items-list">
          @for (watch of watches(); track watch.id) {
            <div class="item-card card">
              <div class="item-main">
                <div class="item-info">
                  <div class="item-title">{{ watch.origin }} → {{ watch.destination }}</div>
                  <div class="item-desc">
                    {{ watch.depart_date }}
                    @if (watch.return_date) {
                      ～ {{ watch.return_date }}
                    }
                  </div>
                  @if (watch.target_price) {
                    <div class="item-desc">
                      {{ 'flightWatch.targetPrice' | transloco }}：{{
                        watch.target_price | number: '1.0-0'
                      }}
                      {{ watch.currency }}
                    </div>
                  }
                </div>
                <div class="item-price">
                  @if (checking() === watch.id) {
                    <div class="amount">{{ 'flightWatch.checking' | transloco }}</div>
                  } @else if (watch.last_price !== null) {
                    <div
                      class="amount"
                      [class.below-target]="
                        watch.target_price != null && watch.last_price <= watch.target_price
                      "
                    >
                      {{ watch.last_price | number: '1.0-0' }} {{ watch.currency }}
                    </div>
                    <div class="amount-checked">{{ formatCheckedAt(watch.last_checked_at) }}</div>
                  } @else {
                    <div class="amount-unavailable">
                      {{ 'flightWatch.priceUnavailable' | transloco }}
                    </div>
                  }
                </div>
              </div>
              <div class="item-actions">
                <button
                  class="refresh-btn"
                  type="button"
                  (click)="recheck(watch)"
                  [disabled]="checking() === watch.id"
                >
                  🔄 {{ 'flightWatch.recheck' | transloco }}
                </button>
                <button class="remove-btn" type="button" (click)="deleteWatch(watch.id)">
                  {{ 'flightWatch.delete' | transloco }}
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 900px;
        width: 100%;
        margin: 0 auto;
        padding: 1.5rem;
        background: var(--bg);
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-sizing: border-box;
      }
      .page-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .page-scroll::-webkit-scrollbar {
        display: none;
      }
      .page-header {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        flex-shrink: 0;
      }
      .back-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        color: var(--accent);
        text-decoration: none;
        background: var(--icon-bg);
        flex-shrink: 0;
      }
      .header-mid {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        flex-wrap: wrap;
      }
      h1 {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }
      .add-trigger {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: var(--icon-bg);
        color: var(--accent);
        font-size: 1.2rem;
        cursor: pointer;
      }

      .card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 4px 20px var(--shadow);
        margin-bottom: 1rem;
      }
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .form-row label {
        display: block;
        font-weight: 500;
        margin-bottom: 0.35rem;
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      .form-row input {
        width: 100%;
        padding: 0.625rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 1rem;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
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
      .form-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
      }
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
        max-width: 460px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        scrollbar-width: none;
      }
      .modal-card::-webkit-scrollbar {
        display: none;
      }

      .empty-state {
        text-align: center;
        padding: 4rem 2rem;
        color: var(--text-secondary);
        font-size: 1.1rem;
      }
      .items-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .item-card.card {
        padding: 1rem 1.25rem;
      }
      .item-main {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.75rem;
      }
      .item-title {
        font-weight: 700;
        font-size: 1.1rem;
        color: var(--text-primary);
      }
      .item-desc {
        font-size: 0.85rem;
        color: var(--text-secondary);
        margin-top: 0.2rem;
      }
      .item-price {
        text-align: right;
        flex-shrink: 0;
      }
      .amount {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        color: var(--text-primary);
        font-size: 1.15rem;
      }
      .amount.below-target {
        color: #48bb78;
      }
      .amount-checked {
        font-size: 0.72rem;
        color: var(--text-secondary);
        margin-top: 0.15rem;
      }
      .amount-unavailable {
        font-size: 0.85rem;
        color: var(--text-secondary);
      }
      .item-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .refresh-btn {
        cursor: pointer;
        color: var(--accent);
        font-size: 0.875rem;
        padding: 0.375rem 0.875rem;
        border: 1.5px solid var(--accent);
        border-radius: 8px;
        background: transparent;
      }
      .refresh-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .remove-btn {
        background: none;
        border: none;
        color: #e53e3e;
        cursor: pointer;
        font-size: 0.875rem;
        margin-left: auto;
      }
    `,
  ],
})
export class FlightWatchComponent implements OnInit {
  private flightWatchService = inject(FlightWatchService);
  private flightPriceService = inject(FlightPriceService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private pref = inject(PreferenceService);

  watches = signal<FlightWatch[]>([]);
  showAddModal = signal(false);
  checking = signal<string | null>(null);

  form = this.fb.group({
    origin: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    destination: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    depart_date: ['', Validators.required],
    return_date: [''],
    target_price: [null as number | null],
    currency: ['TWD', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
  });

  async ngOnInit(): Promise<void> {
    this.form.patchValue({ currency: this.pref.homeCountry().currency });
    await this.loadWatches();
    for (const watch of this.watches()) {
      this.flightPriceService.refreshIfNeeded(watch).then(() => this.loadWatches());
    }
  }

  private get ownerId(): string {
    return this.auth.user()!.id;
  }

  async loadWatches(): Promise<void> {
    this.watches.set(await this.flightWatchService.getAll(this.ownerId));
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.form.reset({ currency: this.pref.homeCountry().currency });
  }

  async addWatch(): Promise<void> {
    if (this.form.invalid) return;
    const v = this.form.value;
    const created = await this.flightWatchService.create({
      owner_id: this.ownerId,
      origin: v.origin!.toUpperCase(),
      destination: v.destination!.toUpperCase(),
      depart_date: v.depart_date!,
      return_date: v.return_date || null,
      target_price: v.target_price ?? null,
      currency: v.currency!.toUpperCase(),
    });
    this.closeAddModal();
    await this.loadWatches();
    this.checking.set(created.id);
    await this.flightPriceService.refreshIfNeeded(created);
    this.checking.set(null);
    await this.loadWatches();
  }

  async recheck(watch: FlightWatch): Promise<void> {
    this.checking.set(watch.id);
    const price = await this.flightPriceService.checkPrice(watch);
    await this.flightWatchService.update(watch.id, {
      last_price: price,
      last_checked_at: new Date().toISOString(),
    });
    this.checking.set(null);
    await this.loadWatches();
  }

  async deleteWatch(id: string): Promise<void> {
    await this.flightWatchService.delete(id);
    await this.loadWatches();
  }

  formatCheckedAt(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
