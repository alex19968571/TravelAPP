import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { MapsService, PlaceSuggestion } from '../../../core/services/maps.service';

/**
 * 地點（機場）自動完成輸入框：輸入關鍵字 → debounce 呼叫 MapsService.searchPlaceSuggestions()
 * 即時顯示建議清單 → 點選帶入。UX／樣式比照 flight-watch.component.ts 的出發地/目的地自動完成
 * （兩行式建議項目：城市/機場名稱＋「國家 · 代碼」）。
 *
 * 下拉選單改用 `position: fixed`＋JS 動態計算座標（而非比照 flight-watch 原本的
 * `position: absolute`）：本元件會被用在「編輯行程」彈窗（`.modal-card`）內，
 * 該彈窗因為設了 `overflow-x: hidden`，瀏覽器會依 CSS 規範自動把 overflow-y 算成
 * auto，使彈窗變成一個會裁切內容的捲動容器——absolute 定位的下拉選單只要超出彈窗
 * 目前捲動可見的範圍就會被裁掉/蓋住。改成 fixed 定位、座標直接來自輸入框的
 * `getBoundingClientRect()`，可以讓下拉選單相對「視窗」浮動，不受任何祖先層 overflow
 * 影響，同時外層彈窗捲動時即時重新計算位置以跟隨輸入框。
 */
@Component({
  selector: 'app-place-autocomplete-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PlaceAutocompleteInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="autocomplete-field">
      <input
        #inputEl
        [ngModel]="query()"
        (ngModelChange)="onQueryChange($event)"
        [ngModelOptions]="{ standalone: true }"
        (focus)="onFocus()"
        (blur)="onBlur()"
        [placeholder]="placeholder"
        autocomplete="off"
      />
      @if (focused() && suggestions().length) {
        <div
          class="suggestion-list"
          [style.top.px]="dropdownTop()"
          [style.left.px]="dropdownLeft()"
          [style.width.px]="dropdownWidth()"
        >
          @for (s of suggestions(); track s.name) {
            <button
              type="button"
              class="suggestion-item"
              (mousedown)="$event.preventDefault()"
              (click)="select(s)"
            >
              <span class="suggestion-city">{{ s.city ?? s.name }}</span>
              @if (s.country || s.code) {
                <span class="suggestion-meta">{{ s.country }} · {{ s.code }}</span>
              }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .autocomplete-field {
        position: relative;
        width: 100%;
      }
      input {
        width: 100%;
        box-sizing: border-box;
        padding: 0.625rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 1rem;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      .suggestion-list {
        position: fixed;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        box-shadow: 0 8px 24px var(--shadow);
        max-height: 220px;
        overflow-y: auto;
        z-index: 1000;
        scrollbar-width: none;
        box-sizing: border-box;
      }
      .suggestion-list::-webkit-scrollbar {
        display: none;
      }
      .suggestion-item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
      }
      .suggestion-item:hover {
        background: var(--accent-light);
      }
      .suggestion-city {
        font-size: 0.9rem;
        color: var(--text-primary);
        font-weight: 600;
      }
      .suggestion-meta {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
    `,
  ],
})
export class PlaceAutocompleteInputComponent implements ControlValueAccessor, OnDestroy {
  private mapsService = inject(MapsService);

  @ViewChild('inputEl') private inputElRef!: ElementRef<HTMLInputElement>;

  @Input() placeholder = '';
  @Output() placeSelected = new EventEmitter<PlaceSuggestion>();

  value = '';
  query = signal('');
  suggestions = signal<PlaceSuggestion[]>([]);
  focused = signal(false);
  dropdownTop = signal(0);
  dropdownLeft = signal(0);
  dropdownWidth = signal(0);

  private debounceTimer?: ReturnType<typeof setTimeout>;
  private onChangeFn: (v: string) => void = () => {};
  private onTouchedFn: () => void = () => {};
  private repositionHandler = () => this.updateDropdownPosition();

  constructor() {
    // capture 階段監聽任何祖先層（例如彈窗本身）的捲動，即時跟隨輸入框重新定位；
    // 捲動事件不會冒泡，一般 addEventListener 的 bubble 階段收不到巢狀捲動容器的事件。
    document.addEventListener('scroll', this.repositionHandler, true);
    window.addEventListener('resize', this.repositionHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.repositionHandler, true);
    window.removeEventListener('resize', this.repositionHandler);
  }

  private updateDropdownPosition(): void {
    if (!this.focused() || !this.inputElRef) return;
    const rect = this.inputElRef.nativeElement.getBoundingClientRect();
    this.dropdownTop.set(rect.bottom + 4);
    this.dropdownLeft.set(rect.left);
    this.dropdownWidth.set(rect.width);
  }

  writeValue(v: string): void {
    this.value = v ?? '';
    this.query.set(this.value);
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChangeFn = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    if (this.value) {
      this.value = '';
      this.onChangeFn('');
    }
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (!value.trim()) {
      this.suggestions.set([]);
      return;
    }
    this.debounceTimer = setTimeout(() => this.search(value), 400);
  }

  private async search(q: string): Promise<void> {
    const results = await this.mapsService.searchPlaceSuggestions(q);
    this.suggestions.set(results);
    if (results.length) this.updateDropdownPosition();
  }

  select(s: PlaceSuggestion): void {
    this.value = s.name;
    this.query.set(s.name);
    this.onChangeFn(s.name);
    this.onTouchedFn();
    this.suggestions.set([]);
    this.focused.set(false);
    this.placeSelected.emit(s);
  }

  onFocus(): void {
    this.focused.set(true);
    this.updateDropdownPosition();
  }

  onBlur(): void {
    this.onTouchedFn();
    setTimeout(() => this.focused.set(false), 150);
  }
}
