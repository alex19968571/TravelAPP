import { Component, EventEmitter, Input, Output, forwardRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { MapsService, PlaceSuggestion } from '../../../core/services/maps.service';

/**
 * 地點搜尋自動完成輸入框：輸入關鍵字 → debounce 呼叫 MapsService.searchPlaceSuggestions()
 * 即時顯示建議清單 → 點選帶入。UX 比照 flight-watch.component.ts 的出發地/目的地自動完成
 * （固定機場清單版本），差異是這裡改成即時地點搜尋，供旅行地圖的行程出發地/目的地共用。
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
        [ngModel]="query()"
        (ngModelChange)="onQueryChange($event)"
        [ngModelOptions]="{ standalone: true }"
        (focus)="onFocus()"
        (blur)="onBlur()"
        [placeholder]="placeholder"
        autocomplete="off"
      />
      @if (focused() && suggestions().length) {
        <div class="suggestion-list">
          @for (s of suggestions(); track s.name) {
            <button
              type="button"
              class="suggestion-item"
              (mousedown)="$event.preventDefault()"
              (click)="select(s)"
            >
              <span class="suggestion-city">{{ s.name }}</span>
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
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        box-shadow: 0 8px 24px var(--shadow);
        max-height: 220px;
        overflow-y: auto;
        z-index: 50;
        scrollbar-width: none;
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
      }
    `,
  ],
})
export class PlaceAutocompleteInputComponent implements ControlValueAccessor {
  private mapsService = inject(MapsService);

  @Input() placeholder = '';
  @Output() placeSelected = new EventEmitter<PlaceSuggestion>();

  value = '';
  query = signal('');
  suggestions = signal<PlaceSuggestion[]>([]);
  focused = signal(false);

  private debounceTimer?: ReturnType<typeof setTimeout>;
  private onChangeFn: (v: string) => void = () => {};
  private onTouchedFn: () => void = () => {};

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
  }

  onBlur(): void {
    this.onTouchedFn();
    setTimeout(() => this.focused.set(false), 150);
  }
}
