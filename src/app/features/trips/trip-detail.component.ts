import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Trip, ItineraryItem, TransportMode } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { MapsService } from '../../core/services/maps.service';

interface DateTab {
  date: Date | null;
  dayNumber: number;
}

const TRANSPORT_OPTIONS: { mode: TransportMode; icon: string }[] = [
  { mode: 'walk', icon: '🚶' },
  { mode: 'drive', icon: '🚗' },
  { mode: 'bike', icon: '🚲' },
  { mode: 'transit', icon: '🚇' },
  { mode: 'flight', icon: '✈️' },
  { mode: 'custom', icon: '✏️' },
];

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a routerLink="/trips" class="back-btn" [attr.aria-label]="'common.back' | transloco">
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
        <h1>{{ trip()?.title ?? ('tripDetail.loading' | transloco) }}</h1>
      </header>

      @if (trip(); as t) {
        <!-- 日期分頁 -->
        <div class="date-tabs-wrap">
          <button class="date-arrow desktop-only" (click)="scrollDates(-1)">‹</button>
          <div class="date-tabs" #dateTabsEl>
            @for (d of dateTabs(); track $index) {
              <button
                class="date-tab"
                [class.active]="selectedDayIndex() === $index"
                (click)="selectedDayIndex.set($index)"
              >
                {{ formatTabDate(d) }}
              </button>
            }
          </div>
          <button class="date-arrow desktop-only" (click)="scrollDates(1)">›</button>
        </div>

        <div class="card day-content">
          @if (itemsForSelectedDay().length === 0) {
            <p class="empty-day">{{ 'tripDetail.notScheduled' | transloco }}</p>
          } @else {
            <div class="item-list">
              @for (
                item of itemsForSelectedDay();
                track item.id;
                let i = $index;
                let last = $last
              ) {
                <!-- 景點卡片 -->
                <div class="itinerary-item" (click)="openEdit(item)">
                  <span class="order-badge">{{ i + 1 }}</span>
                  @if (item.image_url) {
                    <img [src]="item.image_url" class="item-thumb" alt="" />
                  } @else {
                    <div class="item-thumb-empty">📍</div>
                  }
                  <div class="item-info">
                    <strong>{{ item.place_name }}</strong>
                    @if (item.notes) {
                      <span class="item-notes">{{ item.notes }}</span>
                    }
                    <span class="coords"
                      >{{ item.latitude.toFixed(4) }}, {{ item.longitude.toFixed(4) }}</span
                    >
                  </div>
                  <button class="remove-btn" (click)="removeItem(item.id, $event)">×</button>
                </div>

                <!-- 景點間交通列（最後一個景點後不顯示） -->
                @if (!last) {
                  <div class="transport-row">
                    <button
                      class="transport-label"
                      (click)="openTransportModal(item, itemsForSelectedDay()[i + 1], $event)"
                    >
                      {{ getTransportText(item) }}
                    </button>
                  </div>
                }
              }
            </div>
          }
        </div>

        <a
          class="fab"
          [routerLink]="['/trips', t.id, 'itinerary']"
          [queryParams]="{ day: dateTabs()[selectedDayIndex()]?.dayNumber ?? 1 }"
          [attr.aria-label]="'tripDetail.openMap' | transloco"
          >＋</a
        >
      }
    </div>

    <!-- ── 編輯景點 Modal ── -->
    @if (editingItem()) {
      <div class="modal-backdrop" (click)="closeEdit()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h3>✏️ 編輯景點</h3>

          <!-- 圖片：label 包 input，確保首次點擊即觸發檔案選取 -->
          <label class="photo-block">
            @if (editPhotoUrl()) {
              <img [src]="editPhotoUrl()!" class="photo-img" alt="" />
              <div class="photo-overlay">點擊更換圖片</div>
            } @else if (editUploadingPhoto()) {
              <div class="photo-placeholder">
                <span>⏳</span><span class="photo-hint">上傳中...</span>
              </div>
            } @else {
              <div class="photo-placeholder">
                <span class="photo-plus">＋</span>
                <span class="photo-hint">上傳景點圖片</span>
              </div>
            }
            <input type="file" accept="image/*" hidden (change)="onEditPhotoSelected($event)" />
          </label>

          <!-- 名稱 -->
          <div class="field-group">
            <label class="field-label">景點名稱</label>
            <input class="field-input" [(ngModel)]="editName" placeholder="景點名稱" />
          </div>

          <!-- 日期（切換天數） -->
          <div class="field-group">
            <label class="field-label">日期</label>
            <div class="date-dropdown-wrap">
              <button
                type="button"
                class="date-select-btn"
                (click)="showEditDatePicker.set(!showEditDatePicker())"
              >
                <span class="select-text">{{ editDateLabel() }}</span>
                <svg
                  class="select-arrow"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              @if (showEditDatePicker()) {
                <div class="date-dropdown-panel">
                  @for (d of dateTabs(); track d.dayNumber) {
                    <button
                      type="button"
                      class="date-dropdown-option"
                      [class.selected]="editDayNumber() === d.dayNumber"
                      (click)="editDayNumber.set(d.dayNumber); showEditDatePicker.set(false)"
                    >
                      {{ formatTabDate(d) }}
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <!-- 筆記 -->
          <div class="field-group">
            <label class="field-label">筆記</label>
            <textarea
              class="field-input field-notes"
              [(ngModel)]="editNotes"
              placeholder="選填備註"
              rows="3"
            ></textarea>
          </div>

          <!-- 按鈕 -->
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeEdit()">取消</button>
            <button
              class="btn-primary"
              [disabled]="!editName.trim() || editSaving()"
              (click)="saveEdit()"
            >
              {{ editSaving() ? '儲存中...' : '儲存' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── 交通方式設定 Modal ── -->
    @if (editingTransportFrom()) {
      <div class="modal-backdrop" (click)="closeTransportModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h3>{{ 'transport.editTitle' | transloco }}</h3>

          <!-- 交通方式下拉選單 -->
          <div class="field-group">
            <div class="select-wrap">
              <select
                class="field-input"
                [ngModel]="tMode()"
                (ngModelChange)="onTModeChange($event)"
              >
                <option value="">{{ 'transport.pleaseSelect' | transloco }}</option>
                @for (opt of transportOpts; track opt.mode) {
                  <option [value]="opt.mode">
                    {{ opt.icon }} {{ 'transport.' + opt.mode | transloco }}
                  </option>
                }
              </select>
              <svg
                class="select-arrow-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>

          @if (tMode()) {
            <!-- 系統 / 自訂 標籤頁 -->
            <div class="time-tabs">
              <button
                class="time-tab"
                [class.active]="tTimeTab() === 'system'"
                [disabled]="!canAutoCalc(tMode())"
                (click)="tTimeTab.set('system')"
              >
                {{ 'transport.system' | transloco }}
              </button>
              <button
                class="time-tab"
                [class.active]="tTimeTab() === 'custom'"
                (click)="tTimeTab.set('custom')"
              >
                {{ 'transport.customTime' | transloco }}
              </button>
            </div>

            @if (tTimeTab() === 'system') {
              <div class="tab-content">
                @if (canAutoCalc(tMode())) {
                  <button class="btn-auto-calc" [disabled]="tCalcing()" (click)="tAutoCalc()">
                    {{
                      tCalcing()
                        ? ('transport.calculating' | transloco)
                        : ('transport.autoCalc' | transloco)
                    }}
                  </button>
                  @if (tCalcResult() !== null) {
                    <div class="calc-result">
                      {{ 'transport.estimated' | transloco
                      }}{{ formatDurationNoPlus(tCalcResult()!) }}
                    </div>
                  } @else if (tCalcFailed()) {
                    <p class="no-auto-msg">{{ 'transport.calcFailed' | transloco }}</p>
                  }
                } @else {
                  <p class="no-auto-msg">{{ 'transport.noAutoCalc' | transloco }}</p>
                }
              </div>
            } @else {
              <div class="tab-content">
                <div class="time-picker">
                  <input
                    type="number"
                    class="time-num"
                    min="0"
                    max="99"
                    [ngModel]="tHours()"
                    (ngModelChange)="tHours.set(+$event || 0)"
                    placeholder="0"
                  />
                  <span class="time-sep">{{ 'transport.hour' | transloco }}</span>
                  <input
                    type="number"
                    class="time-num"
                    min="0"
                    max="59"
                    [ngModel]="tMins()"
                    (ngModelChange)="tMins.set(+$event || 0)"
                    placeholder="0"
                  />
                  <span class="time-sep">{{ 'transport.minute' | transloco }}</span>
                </div>
              </div>
            }
          }

          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeTransportModal()">
              {{ 'common.cancel' | transloco }}
            </button>
            <button class="btn-primary" [disabled]="tSaving()" (click)="saveTransport()">
              {{ tSaving() ? ('common.loading' | transloco) : ('common.save' | transloco) }}
            </button>
          </div>
        </div>
      </div>
    }
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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        flex-shrink: 0;
        color: var(--accent);
        text-decoration: none;
        background: var(--icon-bg);
        transition: background 0.15s;
      }
      .back-btn:hover {
        background: var(--icon-bg-hover);
      }
      h1 {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }

      /* 日期分頁 */
      .date-tabs-wrap {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
      }
      .date-arrow {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--icon-bg);
        color: var(--accent);
        border: none;
        font-size: 1.1rem;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 0.15s;
      }
      .date-arrow:hover {
        background: var(--icon-bg-hover);
      }
      .date-tabs {
        flex: 1;
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding: 0.25rem 0;
      }
      .date-tabs::-webkit-scrollbar {
        display: none;
      }
      .date-tab {
        flex: 1;
        min-width: 0;
        padding: 0.5rem 0.5rem;
        border-radius: 10px;
        border: 1.5px solid var(--border);
        background: var(--surface);
        color: var(--text-secondary);
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .date-tab.active {
        border-color: var(--accent);
        background: var(--accent);
        color: white;
      }
      @media (hover: none) and (pointer: coarse) {
        .desktop-only {
          display: none !important;
        }
      }

      .card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 4px 20px var(--shadow);
      }
      .empty-day {
        color: var(--text-secondary);
        font-size: 0.9rem;
        text-align: center;
        padding: 1rem 0;
      }
      .item-list {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      /* ── 景點卡片 ── */
      .itinerary-item {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        padding: 0.75rem;
        background: var(--accent-light);
        border-radius: 10px;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .itinerary-item:hover {
        opacity: 0.85;
      }
      .order-badge {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--accent);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        font-weight: 600;
        flex-shrink: 0;
      }
      .item-thumb {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        object-fit: cover;
        flex-shrink: 0;
      }
      .item-thumb-empty {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        background: var(--border);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        flex-shrink: 0;
      }
      .item-info {
        flex: 1;
        color: var(--text-primary);
        min-width: 0;
      }
      .item-info strong {
        display: block;
        font-size: 0.95rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .item-notes {
        display: block;
        font-size: 0.78rem;
        color: var(--text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 1px;
      }
      .coords {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .remove-btn {
        background: var(--icon-bg);
        border: none;
        color: #e53e3e;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0.25rem;
        flex-shrink: 0;
        line-height: 1;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      }
      .remove-btn:hover {
        background: var(--icon-bg-hover);
      }

      /* ── 景點間交通列 ── */
      .transport-row {
        display: flex;
        align-items: center;
        padding: 0.2rem 0.75rem;
        border-left: 2px dashed var(--border);
        margin-left: 14px;
      }
      .transport-label {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.3rem 0.875rem;
        border-radius: 20px;
        font-size: 0.78rem;
        color: var(--text-secondary);
        text-align: left;
        letter-spacing: 0.01em;
        transition:
          background 0.15s,
          color 0.15s;
      }
      .transport-label:hover {
        background: var(--accent-light);
        color: var(--accent);
      }

      /* 浮動按鈕 */
      .fab {
        position: fixed;
        right: 1.25rem;
        bottom: 84px;
        z-index: 60;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: var(--icon-bg);
        color: var(--accent);
        text-decoration: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.6rem;
        box-shadow: 0 6px 20px var(--shadow);
        backdrop-filter: blur(6px);
        transition: background 0.15s;
      }
      .fab:hover {
        background: var(--icon-bg-hover);
      }

      /* ── Modal 共用 ── */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 300;
        padding: 1rem;
      }
      .modal-card {
        background: var(--surface);
        border-radius: 16px;
        padding: 1.5rem;
        max-width: 420px;
        width: 100%;
        box-shadow: 0 12px 40px var(--shadow);
        max-height: 90vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .modal-card h3 {
        margin: 0;
        color: var(--text-primary);
        font-size: 1rem;
        font-weight: 700;
      }

      /* ── 圖片上傳（label 取代 button） ── */
      .photo-block {
        display: flex;
        width: 100%;
        aspect-ratio: 4/3;
        max-height: 200px;
        background: var(--bg);
        border: 2px dashed var(--border);
        border-radius: 12px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        align-items: center;
        justify-content: center;
      }
      .photo-block:hover {
        border-color: var(--accent);
      }
      .photo-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .photo-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        color: white;
        font-size: 0.85rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
      }
      .photo-block:hover .photo-overlay {
        opacity: 1;
      }
      .photo-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4rem;
      }
      .photo-plus {
        font-size: 2rem;
        color: var(--text-secondary);
      }
      .photo-hint {
        font-size: 0.8rem;
        color: var(--text-secondary);
      }

      .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .field-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .select-wrap {
        position: relative;
      }
      .select-wrap .select-arrow-icon {
        position: absolute;
        right: 0.875rem;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-secondary);
        pointer-events: none;
      }
      select.field-input {
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        padding-right: 2.25rem;
      }
      .field-input {
        width: 100%;
        padding: 0.6rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 0.95rem;
        box-sizing: border-box;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      .field-input:focus {
        outline: none;
        border-color: var(--accent);
      }
      .field-notes {
        resize: vertical;
        min-height: 68px;
        font-family: inherit;
      }

      .date-dropdown-wrap {
        position: relative;
      }
      .date-select-btn {
        width: 100%;
        padding: 0.5rem 2rem;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--accent-light);
        color: var(--accent);
        border: 1.5px solid var(--accent);
        border-radius: 10px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
      }
      .date-select-btn .select-text {
        flex: 1;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .date-select-btn .select-arrow {
        position: absolute;
        right: 0.75rem;
        flex-shrink: 0;
      }
      .date-dropdown-panel {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        z-index: 20;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        box-shadow: 0 8px 32px var(--shadow);
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      .date-dropdown-option {
        padding: 0.6rem 0.875rem;
        text-align: center;
        background: none;
        border: none;
        border-bottom: 1px solid var(--border);
        color: var(--text-primary);
        font-size: 0.9rem;
        cursor: pointer;
      }
      .date-dropdown-option:last-child {
        border-bottom: none;
      }
      .date-dropdown-option.selected {
        color: var(--accent);
        font-weight: 600;
        background: var(--accent-light);
      }

      .modal-actions {
        display: flex;
        gap: 0.75rem;
      }
      .btn-primary {
        flex: 1;
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 0.75rem;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-primary:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .btn-secondary {
        flex: 1;
        background: var(--bg);
        color: var(--text-secondary);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        padding: 0.75rem;
        font-weight: 600;
        cursor: pointer;
      }

      /* ── 交通方式 Modal 專用 ── */
      .time-tabs {
        display: flex;
        gap: 0.4rem;
        background: var(--bg);
        padding: 0.3rem;
        border-radius: 10px;
      }
      .time-tab {
        flex: 1;
        padding: 0.45rem 0.5rem;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition:
          background 0.15s,
          color 0.15s;
      }
      .time-tab.active {
        background: var(--surface);
        color: var(--accent);
        box-shadow: 0 2px 8px var(--shadow);
      }
      .time-tab:disabled {
        opacity: 0.38;
        cursor: not-allowed;
      }

      .tab-content {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .btn-auto-calc {
        width: 100%;
        padding: 0.65rem 1rem;
        border: none;
        border-radius: 10px;
        background: var(--accent);
        color: white;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .btn-auto-calc:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .calc-result {
        text-align: center;
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--accent);
        padding: 0.25rem 0;
      }

      .no-auto-msg {
        font-size: 0.85rem;
        color: var(--text-secondary);
        text-align: center;
        margin: 0;
        padding: 0.5rem 0;
      }

      .time-picker {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        justify-content: center;
      }
      .time-num {
        width: 64px;
        padding: 0.55rem 0.5rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 1.1rem;
        font-weight: 600;
        text-align: center;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      .time-num:focus {
        outline: none;
        border-color: var(--accent);
      }
      .time-sep {
        font-size: 0.9rem;
        color: var(--text-secondary);
        font-weight: 500;
      }
    `,
  ],
})
export class TripDetailComponent implements OnInit {
  @ViewChild('dateTabsEl') dateTabsEl?: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private tripService = inject(TripService);
  private mapsService = inject(MapsService);
  private transloco = inject(TranslocoService);

  trip = signal<Trip | undefined>(undefined);
  items = signal<ItineraryItem[]>([]);
  selectedDayIndex = signal(0);

  // ── 編輯景點 Modal 狀態 ──
  editingItem = signal<ItineraryItem | null>(null);
  editName = '';
  editNotes = '';
  editDayNumber = signal(1);
  showEditDatePicker = signal(false);
  editPhotoUrl = signal<string | null>(null);
  editUploadingPhoto = signal(false);
  editSaving = signal(false);
  private editLocalBlob: string | null = null;

  // ── 交通方式 Modal 狀態 ──
  editingTransportFrom = signal<ItineraryItem | null>(null);
  editingTransportTo = signal<ItineraryItem | null>(null);
  tMode = signal<TransportMode | null>(null);
  tTimeTab = signal<'system' | 'custom'>('custom');
  tHours = signal(0);
  tMins = signal(0);
  tCalcResult = signal<number | null>(null);
  tCalcing = signal(false);
  tCalcFailed = signal(false);
  tSaving = signal(false);

  transportOpts = TRANSPORT_OPTIONS;

  dateTabs = computed<DateTab[]>(() => {
    const t = this.trip();
    if (t?.start_date_utc) {
      const start = new Date(t.start_date_utc);
      const end = t.end_date_utc ? new Date(t.end_date_utc) : start;
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const tabs: DateTab[] = [];
      const cur = new Date(startDay);
      let n = 1;
      while (cur <= endDay) {
        tabs.push({ date: new Date(cur), dayNumber: n });
        cur.setDate(cur.getDate() + 1);
        n++;
      }
      return tabs.length ? tabs : [{ date: startDay, dayNumber: 1 }];
    }
    const maxDay = Math.max(1, ...this.items().map((i) => i.day_number));
    return Array.from({ length: maxDay }, (_, i) => ({ date: null, dayNumber: i + 1 }));
  });

  itemsForSelectedDay = computed(() => {
    const dn = this.dateTabs()[this.selectedDayIndex()]?.dayNumber ?? 1;
    return this.items()
      .filter((i) => i.day_number === dn)
      .sort((a, b) => a.order_index - b.order_index);
  });

  formatTabDate(tab: DateTab): string {
    if (!tab.date) return `${tab.dayNumber}`;
    return `${tab.date.getMonth() + 1}/${tab.date.getDate()}`;
  }

  editDateLabel(): string {
    const d = this.dateTabs().find((t) => t.dayNumber === this.editDayNumber());
    return d ? this.formatTabDate(d) : '';
  }

  scrollDates(dir: number): void {
    this.dateTabsEl?.nativeElement.scrollBy({ left: dir * 140, behavior: 'smooth' });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.trip.set(await this.tripService.getById(id));
    this.items.set(await this.tripService.getItinerary(id));
  }

  async removeItem(itemId: string, e: MouseEvent): Promise<void> {
    e.stopPropagation();
    await this.tripService.removeItineraryItem(itemId);
    this.items.set(await this.tripService.getItinerary(this.trip()!.id));
  }

  // ── 編輯景點 Modal ──────────────────────────────────────────────
  openEdit(item: ItineraryItem): void {
    this.editingItem.set(item);
    this.editName = item.place_name;
    this.editNotes = item.notes ?? '';
    this.editDayNumber.set(item.day_number);
    this.editLocalBlob = null;
    this.editPhotoUrl.set(item.image_url ?? null);
  }

  closeEdit(): void {
    this.revokeEditBlob();
    this.editingItem.set(null);
  }

  async onEditPhotoSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.revokeEditBlob();
    this.editLocalBlob = URL.createObjectURL(file);
    this.editPhotoUrl.set(this.editLocalBlob);
    this.editUploadingPhoto.set(true);
    try {
      const remoteUrl = await this.tripService.uploadItineraryPhoto(file);
      if (remoteUrl) {
        URL.revokeObjectURL(this.editLocalBlob!);
        this.editLocalBlob = null;
        this.editPhotoUrl.set(remoteUrl);
      }
    } finally {
      this.editUploadingPhoto.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  private revokeEditBlob(): void {
    if (this.editLocalBlob) {
      URL.revokeObjectURL(this.editLocalBlob);
      this.editLocalBlob = null;
    }
  }

  async saveEdit(): Promise<void> {
    const item = this.editingItem();
    if (!item || !this.editName.trim()) return;
    this.editSaving.set(true);
    try {
      await this.tripService.updateItineraryItem(item.id, {
        place_name: this.editName.trim(),
        notes: this.editNotes.trim() || undefined,
        image_url: this.editPhotoUrl() ?? undefined,
        day_number: this.editDayNumber(),
      });
      this.items.set(await this.tripService.getItinerary(this.trip()!.id));
      this.closeEdit();
    } finally {
      this.editSaving.set(false);
    }
  }

  // ── 交通方式 Modal ──────────────────────────────────────────────
  canAutoCalc(mode: TransportMode | null | undefined): boolean {
    return mode === 'walk' || mode === 'drive' || mode === 'bike' || mode === 'transit';
  }

  openTransportModal(
    item: ItineraryItem,
    nextItem: ItineraryItem | undefined,
    e: MouseEvent,
  ): void {
    e.stopPropagation();
    if (!nextItem) return;
    this.editingTransportFrom.set(item);
    this.editingTransportTo.set(nextItem);
    const mode = item.next_transport_mode ?? null;
    this.tMode.set(mode);
    this.tCalcResult.set(null);
    this.tCalcFailed.set(false);
    const mins = item.next_transport_minutes ?? 0;
    this.tHours.set(Math.floor(mins / 60));
    this.tMins.set(mins % 60);
    this.tTimeTab.set(this.canAutoCalc(mode) ? 'system' : 'custom');
  }

  closeTransportModal(): void {
    this.editingTransportFrom.set(null);
    this.editingTransportTo.set(null);
  }

  onTModeChange(value: string): void {
    const mode = value ? (value as TransportMode) : null;
    this.tMode.set(mode);
    this.tCalcResult.set(null);
    this.tCalcFailed.set(false);
    if (mode && !this.canAutoCalc(mode)) {
      this.tTimeTab.set('custom');
    }
  }

  async tAutoCalc(): Promise<void> {
    const from = this.editingTransportFrom();
    const to = this.editingTransportTo();
    const mode = this.tMode();
    if (!from || !to || !mode) return;
    this.tCalcing.set(true);
    this.tCalcResult.set(null);
    this.tCalcFailed.set(false);
    try {
      const minutes = await this.mapsService.estimateDuration(
        { lat: from.latitude, lng: from.longitude },
        { lat: to.latitude, lng: to.longitude },
        mode,
      );
      this.tCalcResult.set(minutes);
      this.tCalcFailed.set(minutes === null);
    } finally {
      this.tCalcing.set(false);
    }
  }

  async saveTransport(): Promise<void> {
    const from = this.editingTransportFrom();
    if (!from) return;
    this.tSaving.set(true);
    try {
      const mode = this.tMode();
      let minutes: number | null = null;
      if (this.tTimeTab() === 'system') {
        minutes = this.tCalcResult();
      } else {
        const total = this.tHours() * 60 + this.tMins();
        minutes = total > 0 ? total : null;
      }
      await this.tripService.updateItineraryItem(from.id, {
        next_transport_mode: mode,
        next_transport_minutes: minutes,
      });
      this.items.set(await this.tripService.getItinerary(this.trip()!.id));
      this.closeTransportModal();
    } finally {
      this.tSaving.set(false);
    }
  }

  formatDuration(minutes: number | null | undefined): string {
    if (!minutes) return '+0';
    const h = this.transloco.translate('transport.hour');
    const m = this.transloco.translate('transport.minute');
    if (minutes < 60) return `+${minutes}${m}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `+${hours}${h}${mins}${m}` : `+${hours}${h}`;
  }

  formatDurationNoPlus(minutes: number): string {
    const h = this.transloco.translate('transport.hour');
    const m = this.transloco.translate('transport.minute');
    if (minutes < 60) return `${minutes}${m}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}${h}${mins}${m}` : `${hours}${h}`;
  }

  getTransportText(item: ItineraryItem): string {
    if (!item.next_transport_mode) {
      return this.transloco.translate('transport.noSelection');
    }
    const icon = TRANSPORT_OPTIONS.find((o) => o.mode === item.next_transport_mode)?.icon ?? '';
    const label = this.transloco.translate(`transport.${item.next_transport_mode}`);
    return `${icon} ${label} ${this.formatDuration(item.next_transport_minutes)}`;
  }
}
