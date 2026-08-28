import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { PreferenceService, Country } from './preference.service';
import { ExchangeRateService } from './exchange-rate.service';

/**
 * 換匯計算機的狀態（金額、國家、運算子、歷史紀錄）獨立成 root 單例服務，
 * 而不是放在 ExchangeComponent 裡——路由元件在切換分頁時會被 Angular 銷毀重建，
 * 狀態放在元件內每次切走再切回來就會重置。搬到 providedIn:'root' 的服務後，
 * 狀態只在整個 App 重新啟動（或使用者按 AC 歸零）時才會清空，切換功能頁面
 * 不影響。純 DOM 相關的部分（下拉選單開合、捲軸/縮放）留在元件裡。
 */
@Injectable({ providedIn: 'root' })
export class ExchangeStateService {
  private pref = inject(PreferenceService);
  private rateService = inject(ExchangeRateService);

  leftCountry = signal<Country>(this.pref.country());
  rightCountry = signal<Country>(this.pref.homeCountry());
  amountStr = signal('1');
  /** 上方顯示金額：僅在完成一次運算（按 = 或連續運算的中間結果）後才更新，輸入第二個運算元期間維持顯示上次結果 */
  displayAmount = signal('1');
  rate = signal(1);

  pendingValue = signal<number | null>(null);
  pendingOp = signal<string | null>(null);
  awaitingOperand = signal(false);
  history = signal<string[]>([]);

  convertedAmount = computed(() => (parseFloat(this.displayAmount()) || 0) * this.rate());

  currentLine = computed(() => {
    const op = this.pendingOp();
    const pending = this.pendingValue();
    if (op !== null && pending !== null) {
      if (this.awaitingOperand()) {
        return `${this.formatResult(pending)} ${op}`;
      }
      return `${this.formatResult(pending)} ${op} ${this.amountStr()}`;
    }
    return this.amountStr();
  });

  constructor() {
    /** 標題列切換目的地時，換匯左側國家即時跟著更新（即使目前不在換匯頁面也一樣同步） */
    effect(() => {
      const c = this.pref.country();
      this.leftCountry.set(c);
      this.refreshRate();
    });
  }

  async init(): Promise<void> {
    await this.rateService.refreshIfNeeded();
    await this.refreshRate();
  }

  async refreshRate(): Promise<void> {
    this.rate.set(
      await this.rateService.getConversionRate(
        this.leftCountry().currency,
        this.rightCountry().currency,
      ),
    );
  }

  async selectLeft(c: Country): Promise<void> {
    this.leftCountry.set(c);
    await this.refreshRate();
  }

  async selectRight(c: Country): Promise<void> {
    this.rightCountry.set(c);
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
      this.amountStr.set(next === '' || next === '-' ? '0' : next);
      this.syncDisplayIfComposingFirstOperand();
      return;
    }
    let current = this.amountStr();
    if (this.awaitingOperand()) {
      current = '0';
      this.awaitingOperand.set(false);
    }
    if (key === '.') {
      if (!current.includes('.')) {
        this.amountStr.set(`${current}.`);
      }
      this.syncDisplayIfComposingFirstOperand();
      return;
    }
    if (current === '0') {
      this.amountStr.set(key);
    } else {
      this.amountStr.set(current + key);
    }
    this.syncDisplayIfComposingFirstOperand();
  }

  /** 重置歸零：AC 按鈕，或使用者明確要求清空時呼叫 */
  clear(): void {
    this.amountStr.set('0');
    this.displayAmount.set('0');
    this.pendingValue.set(null);
    this.pendingOp.set(null);
    this.awaitingOperand.set(false);
    this.history.set([]);
  }

  private syncDisplayIfComposingFirstOperand(): void {
    if (this.pendingOp() === null) {
      this.displayAmount.set(this.amountStr());
    }
  }

  isActiveOp(op: string): boolean {
    return this.pendingOp() === op && this.awaitingOperand();
  }

  onOperator(op: string): void {
    const current = parseFloat(this.amountStr()) || 0;
    if (this.pendingOp() !== null && !this.awaitingOperand()) {
      const a = this.pendingValue()!;
      const prevOp = this.pendingOp()!;
      const result = this.calculate(a, current, prevOp);
      this.pushHistory(
        `${this.formatResult(a)} ${prevOp} ${this.formatResult(current)} = ${this.formatResult(result)}`,
      );
      this.amountStr.set(this.formatResult(result));
      this.displayAmount.set(this.formatResult(result));
      this.pendingValue.set(result);
    } else {
      this.pendingValue.set(current);
    }
    this.pendingOp.set(op);
    this.awaitingOperand.set(true);
  }

  equals(): void {
    const op = this.pendingOp();
    if (op === null || this.pendingValue() === null) return;
    const current = parseFloat(this.amountStr()) || 0;
    const a = this.pendingValue()!;
    const result = this.calculate(a, current, op);
    this.pushHistory(
      `${this.formatResult(a)} ${op} ${this.formatResult(current)} = ${this.formatResult(result)}`,
    );
    this.amountStr.set(this.formatResult(result));
    this.displayAmount.set(this.formatResult(result));
    this.pendingValue.set(null);
    this.pendingOp.set(null);
    this.awaitingOperand.set(false);
  }

  private pushHistory(line: string): void {
    this.history.update((h) => [...h, line]);
  }

  percent(): void {
    const current = parseFloat(this.amountStr()) || 0;
    this.amountStr.set(this.formatResult(current / 100));
    this.syncDisplayIfComposingFirstOperand();
  }

  toggleSign(): void {
    const current = parseFloat(this.amountStr()) || 0;
    this.amountStr.set(this.formatResult(-current));
    this.syncDisplayIfComposingFirstOperand();
  }

  private calculate(a: number, b: number, op: string): number {
    switch (op) {
      case '+':
        return a + b;
      case '−':
        return a - b;
      case '×':
        return a * b;
      case '÷':
        return b === 0 ? 0 : a / b;
      default:
        return b;
    }
  }

  private formatResult(n: number): string {
    if (!isFinite(n)) return '0';
    const rounded = Math.round(n * 1e10) / 1e10;
    return String(rounded);
  }
}
