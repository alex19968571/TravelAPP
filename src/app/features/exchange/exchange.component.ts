import {
  Component,
  inject,
  OnInit,
  AfterViewInit,
  signal,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { COUNTRIES, Country } from '../../core/services/preference.service';
import { ExchangeStateService } from '../../core/services/exchange-state.service';

const KEYPAD_ROWS: string[][] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
];

@Component({
  selector: 'app-exchange',
  standalone: true,
  imports: [CommonModule, DecimalPipe, TranslocoModule],
  template: `
    <div class="page-container">
      <div class="scale-wrap" #scaleWrap>
        <!-- 上方：左右兩塊國家/金額 + 中間轉換按鈕 -->
        <div class="converter-card card">
          <div class="side">
            <div class="country-picker" [class.open]="showLeftPicker()">
              <button class="country-trigger" (click)="toggleLeftPicker($event)">
                <span class="fi fi-{{ state.leftCountry().code.toLowerCase() }}"></span>
                <span class="cname">{{ state.leftCountry().nativeName }}</span>
                <span class="ccode">{{ state.leftCountry().currency }}</span>
                <span class="caret" [class.flipped]="showLeftPicker()">▾</span>
              </button>
              <div class="country-dropdown">
                @for (c of countries; track c.code) {
                  <button
                    class="country-option"
                    [class.selected]="c.code === state.leftCountry().code"
                    (click)="selectLeft(c)"
                  >
                    <span class="fi fi-{{ c.code.toLowerCase() }}"></span>
                    <span>{{ c.nativeName }}</span>
                    <span class="currency-badge">{{ c.currency }}</span>
                  </button>
                }
              </div>
            </div>
            <div class="amount">{{ state.displayAmount() }}</div>
            <div class="currency-code">{{ state.leftCountry().currency }}</div>
          </div>

          <button class="swap-btn" (click)="swap()">⇄</button>

          <div class="side">
            <div class="country-picker" [class.open]="showRightPicker()">
              <button class="country-trigger" (click)="toggleRightPicker($event)">
                <span class="fi fi-{{ state.rightCountry().code.toLowerCase() }}"></span>
                <span class="cname">{{ state.rightCountry().nativeName }}</span>
                <span class="ccode">{{ state.rightCountry().currency }}</span>
                <span class="caret" [class.flipped]="showRightPicker()">▾</span>
              </button>
              <div class="country-dropdown">
                @for (c of countries; track c.code) {
                  <button
                    class="country-option"
                    [class.selected]="c.code === state.rightCountry().code"
                    (click)="selectRight(c)"
                  >
                    <span class="fi fi-{{ c.code.toLowerCase() }}"></span>
                    <span>{{ c.nativeName }}</span>
                    <span class="currency-badge">{{ c.currency }}</span>
                  </button>
                }
              </div>
            </div>
            <div class="amount converted">{{ state.convertedAmount() | number: '1.0-2' }}</div>
            <div class="currency-code">{{ state.rightCountry().currency }}</div>
          </div>
        </div>

        <div class="rate-hint">
          1 {{ state.leftCountry().currency }} ≈ {{ state.rate() | number: '1.0-4' }}
          {{ state.rightCountry().currency }}
        </div>

        <!-- 計算過程（輸入同時即時同步顯示，逐行顯示，舊紀錄往上滑動消失） -->
        <div class="calc-history" #historyEl>
          @for (line of state.history(); track $index) {
            <div class="calc-history-line">{{ line }}</div>
          }
          <div class="calc-history-line calc-history-current">{{ state.currentLine() }}</div>
        </div>

        <!-- 下方：計算機鍵盤（iPhone 計算機版面，支援四則運算並即時換匯） -->
        <div class="keypad card">
          <div class="keypad-row">
            <button class="keypad-key keypad-key--fn" (click)="onKey('⌫')">⌫</button>
            <button class="keypad-key keypad-key--fn" (click)="clear()">AC</button>
            <button class="keypad-key keypad-key--fn" (click)="percent()">%</button>
            <button
              class="keypad-key keypad-key--op"
              [class.active]="state.isActiveOp('÷')"
              (click)="onOperator('÷')"
            >
              ÷
            </button>
          </div>
          @for (row of keypadRows; track $index; let ri = $index) {
            <div class="keypad-row">
              @for (key of row; track key) {
                <button class="keypad-key" (click)="onKey(key)">{{ key }}</button>
              }
              <button
                class="keypad-key keypad-key--op"
                [class.active]="state.isActiveOp(opSymbols[ri])"
                (click)="onOperator(opSymbols[ri])"
              >
                {{ opSymbols[ri] }}
              </button>
            </div>
          }
          <div class="keypad-row">
            <button class="keypad-key keypad-key--fn" (click)="toggleSign()">+/-</button>
            <button class="keypad-key" (click)="onKey('0')">0</button>
            <button class="keypad-key" (click)="onKey('.')">.</button>
            <button class="keypad-key keypad-key--op" (click)="equals()">=</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 500px;
        width: 100%;
        margin: 0 auto;
        padding: 1.5rem;
        background: var(--bg);
        box-sizing: border-box;
        height: 100%;
        min-height: 0;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .page-container::-webkit-scrollbar {
        display: none;
      }
      .scale-wrap {
        width: 100%;
        transform-origin: center center;
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
        background: var(--icon-bg);
        color: var(--accent);
        border: none;
        font-size: 1.1rem;
        cursor: pointer;
        transition: background 0.15s;
      }
      .swap-btn:hover {
        background: var(--icon-bg-hover);
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
      .ccode {
        display: none;
        font-weight: 700;
        color: var(--accent);
        font-size: 0.75rem;
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
        margin-bottom: 0.5rem;
      }

      .calc-history {
        height: 3.8rem;
        overflow-y: auto;
        overflow-x: hidden;
        margin-bottom: 0.75rem;
        padding: 0 0.25rem;
        scroll-behavior: smooth;
        scrollbar-width: none;
      }
      .calc-history::-webkit-scrollbar {
        display: none;
      }
      .calc-history-line {
        text-align: right;
        font-family: var(--font-mono);
        font-size: 1.1rem;
        color: var(--text-secondary);
        line-height: 1.9rem;
        white-space: nowrap;
      }
      .calc-history-current {
        color: var(--text-primary);
        font-weight: 600;
      }

      .keypad {
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
        background: var(--keypad-bg);
        border-radius: 22px;
        padding: 1.1rem;
      }
      .keypad-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.7rem;
      }
      .keypad-key {
        aspect-ratio: 1;
        border-radius: 50%;
        border: none;
        background: var(--keypad-key-bg);
        color: var(--keypad-key-color);
        font-family: var(--font-mono);
        font-size: 1.4rem;
        font-weight: 500;
        cursor: pointer;
        transition:
          transform 0.1s ease,
          background 0.1s ease;
      }
      .keypad-key:active {
        background: var(--keypad-key-active-bg);
        transform: scale(0.94);
      }
      .keypad-key--fn {
        background: var(--keypad-fn-bg);
        color: var(--keypad-fn-color);
        font-size: 1.1rem;
      }
      .keypad-key--fn:active {
        background: var(--keypad-fn-active-bg);
      }
      .keypad-key--op {
        background: var(--accent);
        color: #ffffff;
        font-size: 1.5rem;
      }
      .keypad-key--op:active,
      .keypad-key--op.active {
        opacity: 0.8;
      }

      @media (max-width: 420px) {
        .page-container {
          padding: 0.5rem 0.15rem;
        }
        .cname {
          display: none;
        }
        .ccode {
          display: inline;
        }
        .country-trigger {
          flex: 1;
          justify-content: center;
          padding: 0.4rem 0.5rem;
        }
        .side {
          min-width: 0;
        }
      }
    `,
  ],
})
export class ExchangeComponent implements OnInit, AfterViewInit {
  @ViewChild('scaleWrap') scaleWrap?: ElementRef<HTMLElement>;
  @ViewChild('historyEl') historyEl?: ElementRef<HTMLElement>;

  /** 計算機狀態（金額/國家/運算子/歷史紀錄）都在這個 root 單例服務裡，
   *  切換功能頁面回來不會重置，只有整個 App 重啟或按 AC 才會清空 */
  state = inject(ExchangeStateService);

  countries = COUNTRIES;
  keypadRows = KEYPAD_ROWS;
  opSymbols = ['×', '−', '+'];

  showLeftPicker = signal(false);
  showRightPicker = signal(false);

  async ngOnInit(): Promise<void> {
    await this.state.init();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.applyScale());
    this.scrollHistoryToBottom();
  }

  @HostListener('window:resize')
  applyScale(): void {
    const el = this.scaleWrap?.nativeElement;
    if (!el || !el.parentElement) return;
    el.style.transform = 'none';
    const contentH = el.scrollHeight;
    const contentW = el.scrollWidth;
    const availH = el.parentElement.clientHeight;
    const availW = el.parentElement.clientWidth;
    if (!contentH || !contentW) return;
    const scale = Math.min(1, availH / contentH, availW / contentW);
    el.style.transform = scale < 1 ? `scale(${scale})` : 'none';
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
    await this.state.selectLeft(c);
    this.showLeftPicker.set(false);
  }

  async selectRight(c: Country): Promise<void> {
    await this.state.selectRight(c);
    this.showRightPicker.set(false);
  }

  async swap(): Promise<void> {
    await this.state.swap();
  }

  onKey(key: string): void {
    this.state.onKey(key);
    this.scrollHistoryToBottom();
  }

  clear(): void {
    this.state.clear();
  }

  onOperator(op: string): void {
    this.state.onOperator(op);
    this.scrollHistoryToBottom();
  }

  equals(): void {
    this.state.equals();
    this.scrollHistoryToBottom();
  }

  percent(): void {
    this.state.percent();
    this.scrollHistoryToBottom();
  }

  toggleSign(): void {
    this.state.toggleSign();
    this.scrollHistoryToBottom();
  }

  private scrollHistoryToBottom(): void {
    setTimeout(() => {
      const el = this.historyEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
