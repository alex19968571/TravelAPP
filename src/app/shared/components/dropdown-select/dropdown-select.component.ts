import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
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
    <div class="dropdown-picker" [class.open]="open()">
      <button type="button" class="dropdown-trigger" (click)="toggle()">
        <span class="dropdown-label">{{ selectedLabel() }}</span>
        <span class="caret" [class.flipped]="open()">▾</span>
      </button>
      <div class="dropdown-menu">
        @for (opt of options; track opt.value) {
          <button
            type="button"
            class="dropdown-option"
            [class.selected]="opt.value === value"
            (click)="select(opt.value)"
          >
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
      .dropdown-label {
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
        z-index: 100;
        display: none;
        scrollbar-width: thin;
      }
      .dropdown-picker.open .dropdown-menu {
        display: block;
      }
      .dropdown-option {
        display: block;
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
    `,
  ],
})
export class DropdownSelectComponent implements ControlValueAccessor {
  private elRef = inject(ElementRef<HTMLElement>);

  @Input() options: DropdownOption[] = [];
  @Input() placeholder = '';
  @Output() selectionChange = new EventEmitter<unknown>();

  value: unknown = null;
  open = signal(false);

  private onChangeFn: (v: unknown) => void = () => {};
  private onTouchedFn: () => void = () => {};

  selectedLabel = computed(() => {
    const found = this.options.find((o) => o.value === this.value);
    return found ? found.label : this.placeholder;
  });

  writeValue(v: unknown): void {
    this.value = v;
  }
  registerOnChange(fn: (v: unknown) => void): void {
    this.onChangeFn = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  toggle(): void {
    this.open.set(!this.open());
  }

  select(v: unknown): void {
    this.value = v;
    this.onChangeFn(v);
    this.onTouchedFn();
    this.selectionChange.emit(v);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(e.target as Node)) {
      this.open.set(false);
    }
  }
}
