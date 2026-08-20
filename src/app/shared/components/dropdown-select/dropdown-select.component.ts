import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

export interface DropdownOption {
  value: unknown;
  label: string;
}

/**
 * 樣式與行為統一參考「國家下拉選單」（exchange / trips-list 頁的 country-picker）：
 * 膠囊按鈕觸發 + 絕對定位選單清單，取代原生 <select> 避免手機版跑版。
 */
@Component({
  selector: 'app-dropdown-select',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div
      class="dropdown-picker"
      [class.open]="open()"
      [class.dropdown-badge]="variant === 'badge'"
      [class.drop-up]="openUpward()"
    >
      <button type="button" class="dropdown-trigger" (click)="toggle()">
        <span class="dropdown-label">{{ selectedLabel() }}</span>
        <svg
          class="caret"
          [class.flipped]="open()"
          viewBox="0 0 24 24"
          width="10"
          height="10"
          fill="currentColor"
        >
          <path d="M12 15.5 4.5 8h15z" />
        </svg>
      </button>
      <div
        class="dropdown-menu"
        [style.position]="menuPosition() ? 'fixed' : null"
        [style.top]="menuPosition()?.top ?? null"
        [style.bottom]="menuPosition()?.bottom ?? null"
        [style.left]="menuPosition()?.left ?? null"
        [style.width]="menuPosition()?.width ?? null"
      >
        @for (opt of options; track opt.value) {
          <button
            type="button"
            class="dropdown-option"
            [class.selected]="isSelected(opt.value)"
            (click)="select(opt.value)"
          >
            @if (multiple) {
              <svg
                class="option-check"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                @if (isSelected(opt.value)) {
                  <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
                }
              </svg>
            }
            {{ opt.label }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .dropdown-picker {
        position: relative;
        width: 100%;
      }
      .dropdown-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.35rem;
        width: 100%;
        background: var(--bg);
        color: var(--text-primary);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        padding: 0.55rem 0.75rem;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .dropdown-trigger:hover,
      .dropdown-picker.open .dropdown-trigger {
        border-color: var(--accent);
      }
      .dropdown-picker.dropdown-badge {
        width: auto;
      }
      .dropdown-picker.dropdown-badge .dropdown-trigger,
      .dropdown-picker.dropdown-badge .dropdown-trigger:hover,
      .dropdown-picker.dropdown-badge .dropdown-trigger:active,
      .dropdown-picker.dropdown-badge .dropdown-trigger:focus {
        width: auto;
        background: transparent !important;
        border: none;
        box-shadow: none;
        appearance: none;
        -webkit-appearance: none;
        padding: 0.15rem 0.3rem;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--accent);
      }
      .dropdown-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .caret {
        flex-shrink: 0;
        font-size: 0.65rem;
        color: var(--text-secondary);
        transition: transform 0.2s;
      }
      .caret.flipped {
        transform: rotate(180deg);
      }
      .dropdown-menu {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 32px var(--shadow);
        max-height: 260px;
        overflow-y: auto;
        z-index: 1000;
        display: none;
        scrollbar-width: none;
      }
      .dropdown-menu::-webkit-scrollbar {
        display: none;
      }
      .dropdown-picker.drop-up .dropdown-menu {
        top: auto;
        bottom: calc(100% + 6px);
      }
      .dropdown-picker.open .dropdown-menu {
        display: block;
      }
      .dropdown-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.625rem 1rem;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        color: var(--text-primary);
        font-size: 0.875rem;
      }
      .dropdown-option:hover {
        background: var(--accent-light);
      }
      .dropdown-option.selected {
        background: var(--accent-light);
        color: var(--accent);
        font-weight: 600;
      }
      .option-check {
        flex-shrink: 0;
        color: var(--accent);
      }
    `,
  ],
})
export class DropdownSelectComponent implements ControlValueAccessor, OnDestroy {
  private static openInstance: DropdownSelectComponent | null = null;

  private elRef = inject(ElementRef<HTMLElement>);

  @Input() options: DropdownOption[] = [];
  @Input() placeholder = '';
  @Input() variant: 'default' | 'badge' = 'default';
  /** 開啟後可複選多個選項，值為陣列，選取後選單不會自動關閉 */
  @Input() multiple = false;
  @Output() selectionChange = new EventEmitter<unknown>();

  value: unknown = null;
  open = signal(false);
  openUpward = signal(false);
  menuPosition = signal<{ top?: string; bottom?: string; left: string; width: string } | null>(
    null,
  );
  private static readonly MENU_ESTIMATED_HEIGHT = 260;

  private onChangeFn: (v: unknown) => void = () => {};
  private onTouchedFn: () => void = () => {};

  selectedLabel(): string {
    if (this.multiple) {
      const values = Array.isArray(this.value) ? this.value : [];
      const labels = this.options.filter((o) => values.includes(o.value)).map((o) => o.label);
      return labels.length ? labels.join('、') : this.placeholder;
    }
    const found = this.options.find((o) => o.value === this.value);
    return found ? found.label : this.placeholder;
  }

  isSelected(v: unknown): boolean {
    return this.multiple ? Array.isArray(this.value) && this.value.includes(v) : v === this.value;
  }

  writeValue(v: unknown): void {
    this.value = this.multiple ? (Array.isArray(v) ? v : []) : v;
  }
  registerOnChange(fn: (v: unknown) => void): void {
    this.onChangeFn = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    if (DropdownSelectComponent.openInstance && DropdownSelectComponent.openInstance !== this) {
      DropdownSelectComponent.openInstance.close();
    }
    DropdownSelectComponent.openInstance = this;
    // 先以「立即捲動」確保觸發按鈕捲動進可視範圍，再依捲動後的最終位置計算選單座標。
    // 若改成先算位置、開啟後才 smooth 捲動，iOS Safari 上 position:fixed 選單不會
    // 隨捲動動畫同步更新，導致選單畫面停留在舊座標、和捲動後的頁面內容重疊跑版。
    this.elRef.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    this.updateOpenDirection();
    this.open.set(true);
  }

  private updateOpenDirection(): void {
    const rect = this.elRef.nativeElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const upward =
      spaceBelow < DropdownSelectComponent.MENU_ESTIMATED_HEIGHT && rect.top > spaceBelow;
    this.openUpward.set(upward);

    // 改用 fixed 定位並以螢幕座標展開，完全跳脫任何祖先層 overflow:auto/hidden
    // （例如可捲動的 modal 或帶 overflow 的輸入框容器）造成的裁切
    if (this.variant === 'badge') {
      // badge 選單靠右對齊、寬度自訂
      const menuWidth = 110;
      this.menuPosition.set({
        left: `${Math.max(4, rect.right - menuWidth)}px`,
        width: `${menuWidth}px`,
        ...(upward
          ? { bottom: `${window.innerHeight - rect.top + 6}px` }
          : { top: `${rect.bottom + 6}px` }),
      });
      return;
    }
    this.menuPosition.set({
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      ...(upward
        ? { bottom: `${window.innerHeight - rect.top + 6}px` }
        : { top: `${rect.bottom + 6}px` }),
    });
  }

  close(): void {
    this.open.set(false);
    this.menuPosition.set(null);
    if (DropdownSelectComponent.openInstance === this) {
      DropdownSelectComponent.openInstance = null;
    }
  }

  select(v: unknown): void {
    if (this.multiple) {
      const current = Array.isArray(this.value) ? this.value : [];
      this.value = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    } else {
      this.value = v;
    }
    this.onChangeFn(this.value);
    this.onTouchedFn();
    this.selectionChange.emit(this.value);
    if (!this.multiple) this.close();
  }

  ngOnDestroy(): void {
    if (DropdownSelectComponent.openInstance === this) {
      DropdownSelectComponent.openInstance = null;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (this.open() && !this.elRef.nativeElement.contains(e.target as Node)) {
      this.close();
    }
  }
}
