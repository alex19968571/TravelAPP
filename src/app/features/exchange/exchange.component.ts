import { Component, inject, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { PreferenceService, COUNTRIES, Country } from '../../core/services/preference.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';

const KEYPAD_ROWS: string[][] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', '⌫'],
];

@Component({
  selector: 'app-exchange',
  standalone: true,
  imports: [CommonModule, DecimalPipe, TranslocoModule],
  template: `
    <div class="page-container">
      <h1>{{ 'exchange.title' | transloco }}</h1>

      <!-- 上方：左右兩塊國家/金額 + 中間轉換按鈕 -->
      <div class="converter-card card">
        <div class="side">
          <div class="country-picker" [class.open]="showLeftPicker()">
            <button class="country-trigger" (click)="toggleLeftPicker($event)">
              <span class="fi fi-{{ leftCountry().code.toLowerCase() }}"></span>
              <span class="cname">{{ leftCountry().nativeName }}</span>
              <span class="caret" [class.flipped]="showLeftPicker()">▾</span>
            </button>
            <div class="country-dropdown">
              @for (c of countries; track c.code) {
                <button
                  class="country-option"
                  [class.selected]="c.code === leftCountry().code"
                  (click)="selectLeft(c)"
                >
                  <span class="fi fi-{{ c.code.toLowerCase() }}"></span>
                  <span>{{ c.nativeName }}</span>
                  <span class="currency-badge">{{ c.currency }}</span>
                </button>
              }
            </div>
          </div>
          <div class="amount">{{ amountStr() }}</div>
          <div class="currency-code">{{ leftCountry().currency }}</div>
        </div>

        <button class="swap-btn" (click)="swap()">⇄</button>

        <div class="side">
          <div class="country-picker" [class.open]="showRightPicker()">
            <button class="country-trigger" (click)="toggleRightPicker($event)">
              <span class="fi fi-{{ rightCountry().code.toLowerCase() }}"></span>
              <span class="cname">{{ rightCountry().nativeName }}</span>
              <span class="caret" [class.flipped]="showRightPicker()">▾</span>
            </button>
            <div class="country-dropdown">
              @for (c of countries; track c.code) {
                <button
                  class="country-option"
                  [class.selected]="c.code === rightCountry().code"
                  (click)="selectRight(c)"
                >
                  <span class="fi fi-{{ c.code.toLowerCase() }}"></span>
                  <span>{{ c.nativeName }}</span>
                  <span class="currency-badge">{{ c.currency }}</span>
                </button>
              }
            </div>
          </div>
          <div class="amount converted">{{ convertedAmount() | number: '1.0-2' }}</div>
          <div class="currency-code">{{ rightCountry().currency }}</div>
        </div>
      </div>

      <div class="rate-hint">
        1 {{ leftCountry().currency }} ≈ {{ rate() | number: '1.0-4' }}
        {{ rightCountry().currency }}
      </div>

      <!-- 下方：計算機鍵盤 -->
      <div class="keypad card">
        @for (row of keypadRows; track $index) {
          <div class="keypad-row">
            @for (key of row; track key) {
              <button class="keypad-key" (click)="onKey(key)">{{ key }}</button>
            }
          </div>
        }
        <button class="keypad-clear" (click)="clear()">{{ 'exchange.clear' | transloco }}</button>
      </div>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 500px;
        margin: 0 auto;
        padding: 1.5rem;
        background: var(--bg);
        min-height: 100vh;
      }
      h1 {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 1rem;
      }
      .card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.25rem;
        box-shadow: 0 4px 20px var(--shadow);
        margin-bottom: 1rem;
      }

      .converter-card {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .side {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
      }
      .amount {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
        font-variant-numeric: tabular-nums;
        word-break: break-all;
        text-align: center;
      }
      .amount.converted {
        color: var(--accent);
      }
      .currency-code {
        font-size: 0.8rem;
        color: var(--text-secondary);
        font-weight: 600;
      }

      .swap-btn {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--accent);
        color: white;
        border: none;
        font-size: 1.1rem;
        cursor: pointer;
      }

      .country-picker {
        position: relative;
      }
      .country-trigger {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        background: var(--bg);
        color: var(--text-primary);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        padding: 0.4rem 0.6rem;
        cursor: pointer;
        font-size: 0.8rem;
        white-space: nowrap;
      }
      .country-trigger:hover,
      .country-picker.open .country-trigger {
        border-color: var(--accent);
      }
      .fi {
        width: 1.2em;
        flex-shrink: 0;
        border-radius: 2px;
      }
      .cname {
        font-weight: 500;
        max-width: 68px;
        overflow: hidden;
        text-overflow: ellipsis;
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
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 32px var(--shadow);
        min-width: 190px;
        max-height: 260px;
        overflow-y: auto;
        z-index: 100;
        display: none;
        scrollbar-width: thin;
      }
      .country-picker.open .country-dropdown {
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
      .currency-badge {
        font-size: 0.7rem;
        padding: 0.1rem 0.4rem;
        border-radius: 5px;
        background: var(--accent-light);
        color: var(--accent);
        font-weight: 700;
      }

      .rate-hint {
        text-align: center;
        color: var(--text-secondary);
        font-size: 0.85rem;
        margin-bottom: 1rem;
      }

      .keypad {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }
      .keypad-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.6rem;
      }
      .keypad-key {
        padding: 0.9rem 0;
        border-radius: 12px;
        border: none;
        background: var(--bg);
        color: var(--text-primary);
        font-size: 1.25rem;
        font-weight: 600;
        cursor: pointer;
      }
      .keypad-key:active {
        background: var(--accent-light);
      }
      .keypad-clear {
        padding: 0.75rem 0;
        border-radius: 12px;
        border: none;
        background: var(--accent-light);
        color: var(--accent);
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
      }

      @media (max-width: 420px) {
        .cname {
          display: none;
        }
      }
    `,
  ],
})
export class ExchangeComponent implements OnInit {
  private pref = inject(PreferenceService);
  private rateService = inject(ExchangeRateService);

  countries = COUNTRIES;
  keypadRows = KEYPAD_ROWS;

  leftCountry = signal<Country>(this.pref.country());
  rightCountry = signal<Country>(this.pref.homeCountry());
  amountStr = signal('1');
  rate = signal(1);

  showLeftPicker = signal(false);
  showRightPicker = signal(false);

  convertedAmount = computed(() => (parseFloat(this.amountStr()) || 0) * this.rate());

  async ngOnInit(): Promise<void> {
    await this.rateService.refreshIfNeeded();
    await this.refreshRate();
  }

  private async refreshRate(): Promise<void> {
    this.rate.set(
      await this.rateService.getConversionRate(
        this.leftCountry().currency,
        this.rightCountry().currency,
      ),
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const target = e.target as Node;
    document.querySelectorAll('.country-picker').forEach((el, i) => {
      if (!el.contains(target)) {
        if (i === 0) this.showLeftPicker.set(false);
        else this.showRightPicker.set(false);
      }
    });
  }

  toggleLeftPicker(e: MouseEvent): void {
    e.stopPropagation();
    this.showLeftPicker.set(!this.showLeftPicker());
    this.showRightPicker.set(false);
  }
  toggleRightPicker(e: MouseEvent): void {
    e.stopPropagation();
    this.showRightPicker.set(!this.showRightPicker());
    this.showLeftPicker.set(false);
  }

  async selectLeft(c: Country): Promise<void> {
    this.leftCountry.set(c);
    this.showLeftPicker.set(false);
    await this.refreshRate();
  }

  async selectRight(c: Country): Promise<void> {
    this.rightCountry.set(c);
    this.showRightPicker.set(false);
    await this.refreshRate();
  }

  async swap(): Promise<void> {
    const l = this.leftCountry();
    this.leftCountry.set(this.rightCountry());
    this.rightCountry.set(l);
    await this.refreshRate();
  }

  onKey(key: string): void {
    if (key === '⌫') {
      const next = this.amountStr().slice(0, -1);
      this.amountStr.set(next === '' ? '0' : next);
      return;
    }
    const current = this.amountStr();
    if (key === '.') {
      if (current.includes('.')) return;
      this.amountStr.set(`${current}.`);
      return;
    }
    if (current === '0') {
      this.amountStr.set(key);
    } else {
      this.amountStr.set(current + key);
    }
  }

  clear(): void {
    this.amountStr.set('0');
  }
}
