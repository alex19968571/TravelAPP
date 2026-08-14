import {
  Component,
  inject,
  OnInit,
  AfterViewInit,
  signal,
  computed,
  ViewChild,
  ViewChildren,
  QueryList,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Trip, ItineraryItem, TransportMode } from '../../core/models';
import { TripService } from '../../core/services/trip.service';
import { MapsService, RouteOption } from '../../core/services/maps.service';
import { DropdownSelectComponent } from '../../shared/components/dropdown-select/dropdown-select.component';

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
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule, DropdownSelectComponent],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a
          routerLink="/trips"
          class="icon-circle back-btn"
          [attr.aria-label]="'common.back' | transloco"
        >
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
          <button class="icon-circle date-arrow desktop-only" (click)="scrollDates(-1)">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div class="date-tabs" [class.date-tabs-few]="dateTabs().length <= 4" #dateTabsEl>
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
          <button class="icon-circle date-arrow desktop-only" (click)="scrollDates(1)">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <div class="card day-content">
          @if (itemsForSelectedDay().length === 0) {
            <p class="empty-day">{{ 'tripDetail.notScheduled' | transloco }}</p>
          } @else {
            <div class="item-list">
              @for (item of displayList(); track item.id; let i = $index; let last = $last) {
                <!-- 景點卡片 -->
                <div
                  class="itinerary-item"
                  [class.dragging]="draggingId() === item.id"
                  [attr.data-item-id]="item.id"
                  (click)="openEdit(item)"
                >
                  <button
                    class="drag-handle"
                    type="button"
                    (pointerdown)="onDragStart($event, item)"
                    (click)="$event.stopPropagation()"
                    [attr.aria-label]="'tripDetail.reorder' | transloco"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="8" cy="6" r="1.5"></circle>
                      <circle cx="16" cy="6" r="1.5"></circle>
                      <circle cx="8" cy="12" r="1.5"></circle>
                      <circle cx="16" cy="12" r="1.5"></circle>
                      <circle cx="8" cy="18" r="1.5"></circle>
                      <circle cx="16" cy="18" r="1.5"></circle>
                    </svg>
                  </button>
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
                      (click)="openTransportModal(item, displayList()[i + 1], $event)"
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
          class="icon-circle fab"
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
          <h3>{{ 'tripDetail.editSpotTitle' | transloco }}</h3>

          <!-- 圖片：label 包 input，確保首次點擊即觸發檔案選取 -->
          <label class="photo-block">
            @if (editPhotoUrl()) {
              <img [src]="editPhotoUrl()!" class="photo-img" alt="" />
              <div class="photo-overlay">{{ 'itinerary.changePhoto' | transloco }}</div>
            } @else if (editUploadingPhoto()) {
              <div class="photo-placeholder">
                <span>⏳</span
                ><span class="photo-hint">{{ 'itinerary.uploading' | transloco }}</span>
              </div>
            } @else {
              <div class="photo-placeholder">
                <span class="photo-plus">＋</span>
                <span class="photo-hint">{{ 'itinerary.uploadPhotoHint' | transloco }}</span>
              </div>
            }
            <input type="file" accept="image/*" hidden (change)="onEditPhotoSelected($event)" />
          </label>

          <!-- 名稱 -->
          <div class="field-group">
            <label class="field-label">{{ 'itinerary.nameLabel' | transloco }}</label>
            <input
              class="field-input"
              [(ngModel)]="editName"
              [placeholder]="'tripDetail.namePlaceholder' | transloco"
            />
          </div>

          <!-- 日期（切換天數） -->
          <div class="field-group">
            <label class="field-label">{{ 'tripDetail.dateLabel' | transloco }}</label>
            <app-dropdown-select
              [options]="dateOptions()"
              [ngModel]="editDayNumber()"
              (ngModelChange)="editDayNumber.set(+$event)"
            ></app-dropdown-select>
          </div>

          <!-- 筆記 -->
          <div class="field-group">
            <label class="field-label">{{ 'itinerary.noteLabel' | transloco }}</label>
            <textarea
              class="field-input field-notes"
              [(ngModel)]="editNotes"
              [placeholder]="'itinerary.noteInputPlaceholder' | transloco"
              rows="3"
            ></textarea>
          </div>

          <!-- 按鈕 -->
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeEdit()">
              {{ 'common.cancel' | transloco }}
            </button>
            <button
              class="btn-primary"
              [disabled]="!editName.trim() || editSaving()"
              (click)="saveEdit()"
            >
              {{ (editSaving() ? 'tripDetail.saving' : 'itinerary.save') | transloco }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── 交通方式設定 Modal ── -->
    @if (editingTransportFrom()) {
      <div class="modal-backdrop" (click)="closeTransportModal()">
        @if (currentDetailRoute(); as route) {
          <!-- 路線詳情「頁」：地圖 + 逐步說明（點路線列後跳轉至此） -->
          <div
            class="modal-card modal-card-compact route-detail-card"
            (click)="$event.stopPropagation()"
          >
            <div class="detail-page-header">
              <button
                type="button"
                class="icon-circle detail-back-btn"
                [attr.aria-label]="'common.back' | transloco"
                (click)="closeRouteDetail()"
              >
                ‹
              </button>
              <h3>
                {{
                  route.summary ||
                    ('transport.routeOption' | transloco: { n: (tExpandedRouteIdx() ?? 0) + 1 })
                }}
              </h3>
            </div>

            <div class="route-detail-map-big" #routeDetailMapEl></div>

            <div class="route-detail-summary-bar">
              <span class="route-detail-total-time">{{
                formatDurationNoPlus(route.durationMin)
              }}</span>
              @if (route.distanceText) {
                <span class="route-distance">· {{ route.distanceText }}</span>
              }
              @if (route.fareText) {
                <span class="route-detail-fare">{{ route.fareText }}</span>
              }
            </div>

            <div class="route-steps route-steps-big">
              @for (s of route.steps; track $index) {
                <div class="step-row">
                  <span class="step-icon">{{ stepIcon(s.mode) }}</span>
                  <div class="step-body">
                    @if (s.mode === 'transit' && s.transit) {
                      <span class="step-line-badge" [style.background]="s.transit.lineColor">{{
                        s.transit.lineShortName || s.transit.lineName
                      }}</span>
                      <span class="step-text">
                        {{ s.transit.departureStop }} → {{ s.transit.arrivalStop }}
                        @if (s.transit.numStops) {
                          <span class="step-stops"
                            >({{
                              'transport.viaStops' | transloco: { n: s.transit.numStops }
                            }})</span
                          >
                        }
                      </span>
                    } @else {
                      <span class="step-text">{{ s.instructions }}</span>
                    }
                  </div>
                  <span class="step-duration">{{ s.durationText }}</span>
                </div>
              }
            </div>

            <div class="modal-actions">
              <button class="btn-secondary" (click)="closeRouteDetail()">
                {{ 'common.back' | transloco }}
              </button>
              <button class="btn-primary" (click)="closeRouteDetail()">
                {{ 'transport.thisRouteSelected' | transloco }}
              </button>
            </div>
          </div>
        } @else {
          <div class="modal-card modal-card-compact" (click)="$event.stopPropagation()">
            <h3>{{ 'transport.editTitle' | transloco }}</h3>

            <!-- 交通方式下拉選單 -->
            <div class="field-group">
              <app-dropdown-select
                [options]="transportOptions()"
                [placeholder]="'transport.pleaseSelect' | transloco"
                [ngModel]="tMode()"
                (ngModelChange)="onTModeChange($event)"
              ></app-dropdown-select>
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
                    @if (tRouteOptions()?.length) {
                      <div class="route-options">
                        @for (r of tRouteOptions(); track $index; let ri = $index) {
                          <button
                            type="button"
                            class="route-option"
                            [class.selected]="tSelectedRouteIdx() === ri"
                            (click)="viewRouteDetail(ri)"
                          >
                            <span class="route-summary">{{
                              r.summary || ('transport.routeOption' | transloco: { n: ri + 1 })
                            }}</span>
                            <span class="route-meta">
                              <span class="route-duration">{{
                                formatDurationNoPlus(r.durationMin)
                              }}</span>
                              @if (r.distanceText) {
                                <span class="route-distance">· {{ r.distanceText }}</span>
                              }
                              <span class="route-nav-caret">›</span>
                            </span>
                          </button>
                        }
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
        }
      </div>
    }
  `,
  styles: [
    `
      .page-container {
        max-width: 900px;
        width: 100%;
        margin: 0 auto;
        padding: 1.5rem;
        background: var(--bg);
        box-sizing: border-box;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .page-container::-webkit-scrollbar {
        display: none;
      }
      .page-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
        position: sticky;
        top: 0;
        z-index: 41;
        background: var(--bg);
        padding-top: 0.5rem;
        margin-top: -0.5rem;
      }
      .icon-circle {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        border: none;
        background: var(--icon-bg);
        cursor: pointer;
        transition: background 0.15s;
      }
      .back-btn {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        color: var(--accent);
        text-decoration: none;
      }
      .back-btn:hover,
      .date-arrow:hover,
      .fab:hover {
        background: var(--icon-bg-hover);
      }
      h1 {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }

      .date-tabs-wrap {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        position: sticky;
        top: 64px;
        z-index: 40;
        background: var(--bg);
        padding-top: 0.5rem;
        margin-top: -0.5rem;
      }
      .date-arrow {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        color: var(--accent);
        padding: 0;
      }
      .date-tabs {
        flex: 1;
        min-width: 0;
        display: flex;
        gap: 0;
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
        /* 預設一次固定顯示 4 個，其餘用捲動/箭頭切換，而不是全部擠進同一列 */
        flex: 0 0 25%;
        min-width: 80px;
        padding: 0.5rem 0.5rem;
        border: 1.5px solid var(--border);
        margin-left: -1.5px;
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
      .date-tab:first-child {
        margin-left: 0;
        border-top-left-radius: 10px;
        border-bottom-left-radius: 10px;
      }
      .date-tab:last-child {
        border-top-right-radius: 10px;
        border-bottom-right-radius: 10px;
      }
      /* 日期數量 <= 4 時，等比放大填滿整列（不需捲動） */
      .date-tabs-few .date-tab {
        flex: 1 1 0;
        min-width: 0;
      }
      .date-tab.active {
        position: relative;
        z-index: 1;
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

      .itinerary-item {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        padding: 0.75rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 10px;
        cursor: pointer;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
      }
      .itinerary-item:hover {
        border-color: var(--accent);
        box-shadow: 0 4px 14px var(--shadow);
      }
      .itinerary-item.dragging {
        opacity: 0.4;
      }
      .drag-handle {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: grab;
        touch-action: none;
        -webkit-user-select: none;
        user-select: none;
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
        font-family: var(--font-mono);
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
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #e53e3e;
        font-size: 1.2rem;
        padding: 0.25rem;
        flex-shrink: 0;
        line-height: 1;
        width: 28px;
        height: 28px;
      }

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

      .fab {
        position: fixed;
        right: 1.25rem;
        bottom: 84px;
        z-index: 60;
        width: 52px;
        height: 52px;
        color: var(--accent);
        text-decoration: none;
        font-size: 1.6rem;
        box-shadow: 0 6px 20px var(--shadow);
        backdrop-filter: blur(6px);
      }

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

      .photo-block {
        width: 100%;
        aspect-ratio: 4/3;
        max-height: 200px;
        background: var(--bg);
        border: 2px dashed var(--border);
        border-radius: 12px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
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
      .photo-block,
      .photo-overlay {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .photo-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        color: white;
        font-size: 0.85rem;
        font-weight: 500;
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

      .modal-actions {
        display: flex;
        gap: 0.75rem;
      }
      .btn-primary,
      .btn-secondary {
        flex: 1;
        border-radius: 10px;
        padding: 0.75rem;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-primary,
      .btn-auto-calc {
        background: var(--accent);
        color: white;
        border: none;
      }
      .btn-secondary {
        background: none;
        color: var(--accent);
        border: 1.5px solid var(--accent);
      }
      .btn-primary:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

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
        border-radius: 10px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .btn-auto-calc:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .route-options {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.75rem;
      }
      .route-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        width: 100%;
        padding: 0.625rem 0.875rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
        cursor: pointer;
        text-align: left;
      }
      .route-option:hover {
        border-color: var(--accent);
      }
      .route-option.selected {
        border-color: var(--accent);
        background: var(--accent-light);
      }
      .route-summary {
        font-size: 0.9rem;
        color: var(--text-primary);
        font-weight: 600;
      }
      .route-meta {
        flex-shrink: 0;
        font-size: 0.85rem;
        color: var(--text-secondary);
        white-space: nowrap;
      }
      .route-duration {
        font-weight: 700;
        color: var(--accent);
      }
      .route-distance {
        margin-left: 0.15rem;
      }
      .route-nav-caret {
        display: inline-block;
        margin-left: 0.3rem;
        font-size: 1rem;
        color: var(--text-secondary);
      }

      /* ── 路線詳情「頁」：跳轉呈現，取代選單畫面 ── */
      .route-detail-card {
        max-width: 480px;
        padding: 0;
        overflow: hidden;
      }
      .detail-page-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem 1.25rem 0;
        flex-shrink: 0;
      }
      .detail-page-header h3 {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .detail-back-btn {
        width: 32px;
        height: 32px;
        flex-shrink: 0;
        font-size: 1.3rem;
        line-height: 1;
        color: var(--accent);
      }
      .route-detail-map-big {
        width: 100%;
        height: 200px;
        background: var(--bg);
        flex-shrink: 0;
      }
      .route-detail-summary-bar {
        display: flex;
        align-items: baseline;
        gap: 0.3rem;
        padding: 0.75rem 1.25rem 0;
        flex-shrink: 0;
      }
      .route-detail-total-time {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--accent);
      }
      .route-detail-fare {
        margin-left: auto;
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .route-steps-big {
        flex: 1;
        min-height: 0;
        padding: 0.75rem 1.25rem 1rem;
        overflow-y: auto;
      }
      .route-detail-card .modal-actions {
        padding: 0 1.25rem 1.25rem;
      }
      .route-steps {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }
      .step-row {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
      }
      .step-icon {
        flex-shrink: 0;
        font-size: 1rem;
        line-height: 1.4;
      }
      .step-body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .step-line-badge {
        align-self: flex-start;
        color: white;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0.1rem 0.5rem;
        border-radius: 6px;
      }
      .step-text {
        font-size: 0.85rem;
        color: var(--text-primary);
        line-height: 1.4;
      }
      .step-stops {
        color: var(--text-secondary);
      }
      .step-duration {
        flex-shrink: 0;
        font-size: 0.8rem;
        color: var(--text-secondary);
        white-space: nowrap;
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
export class TripDetailComponent implements OnInit, AfterViewInit {
  @ViewChild('dateTabsEl') dateTabsEl?: ElementRef<HTMLElement>;
  @ViewChildren('routeDetailMapEl') routeDetailMapEls!: QueryList<ElementRef<HTMLDivElement>>;

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
  tRouteOptions = signal<RouteOption[] | null>(null);
  tSelectedRouteIdx = signal<number | null>(null);
  /** 目前正在檢視詳情「頁」的路線索引；非 null 時取代選單畫面，顯示地圖＋逐步說明 */
  tExpandedRouteIdx = signal<number | null>(null);
  tSaving = signal(false);

  currentDetailRoute = computed<RouteOption | null>(() => {
    const idx = this.tExpandedRouteIdx();
    if (idx === null) return null;
    return this.tRouteOptions()?.[idx] ?? null;
  });

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

  // ── 拖曳排序 ──
  draggingId = signal<string | null>(null);
  workingOrder = signal<ItineraryItem[] | null>(null);
  displayList = computed(() => this.workingOrder() ?? this.itemsForSelectedDay());

  formatTabDate(tab: DateTab): string {
    if (!tab.date) return `${tab.dayNumber}`;
    return `${tab.date.getMonth() + 1}/${tab.date.getDate()}`;
  }

  dateOptions(): { value: number; label: string }[] {
    return this.dateTabs().map((d) => ({ value: d.dayNumber, label: this.formatTabDate(d) }));
  }

  transportOptions(): { value: TransportMode; label: string }[] {
    return this.transportOpts.map((opt) => ({
      value: opt.mode,
      label: `${opt.icon} ${this.transloco.translate('transport.' + opt.mode)}`,
    }));
  }

  scrollDates(dir: number): void {
    const el = this.dateTabsEl?.nativeElement;
    if (!el) return;
    // 一次捲動一整頁（可視寬度），對應「一次固定顯示 4 個」的版面
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.trip.set(await this.tripService.getById(id));
    this.items.set(await this.tripService.getItinerary(id));
  }

  ngAfterViewInit(): void {
    // 路線詳情展開時才會渲染出小地圖容器（accordion 手風琴模式，同時最多一個）
    this.routeDetailMapEls.changes.subscribe((list: QueryList<ElementRef<HTMLDivElement>>) => {
      const el = list.first;
      if (el) this.renderRouteDetailMap(el.nativeElement);
    });
  }

  async removeItem(itemId: string, e: MouseEvent): Promise<void> {
    e.stopPropagation();
    await this.tripService.removeItineraryItem(itemId);
    this.items.set(await this.tripService.getItinerary(this.trip()!.id));
  }

  // ── 拖曳排序 ──────────────────────────────────────────────────
  onDragStart(ev: PointerEvent, item: ItineraryItem): void {
    ev.preventDefault();
    this.workingOrder.set([...this.itemsForSelectedDay()]);
    this.draggingId.set(item.id);
    window.addEventListener('pointermove', this.onDragMove);
    window.addEventListener('pointerup', this.onDragEnd);
  }

  private onDragMove = (ev: PointerEvent): void => {
    const id = this.draggingId();
    const list = this.workingOrder();
    if (!id || !list) return;
    const el = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest(
      '.itinerary-item',
    );
    const targetId = el?.getAttribute('data-item-id');
    if (!targetId || targetId === id) return;
    const fromIdx = list.findIndex((i) => i.id === id);
    const toIdx = list.findIndex((i) => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    this.workingOrder.set(next);
  };

  private onDragEnd = async (): Promise<void> => {
    window.removeEventListener('pointermove', this.onDragMove);
    window.removeEventListener('pointerup', this.onDragEnd);
    const list = this.workingOrder();
    this.draggingId.set(null);
    this.workingOrder.set(null);
    if (!list) return;
    const original = this.itemsForSelectedDay();
    const changed = list.some((it, idx) => it.id !== original[idx]?.id);
    if (!changed) return;
    await this.tripService.updateItineraryOrder(list);
    // 順序改變後，景點間交通方式與時間回到預設（未設定）
    for (const it of list) {
      if (it.next_transport_mode || it.next_transport_minutes) {
        await this.tripService.updateItineraryItem(it.id, {
          next_transport_mode: null,
          next_transport_minutes: null,
        });
      }
    }
    this.items.set(await this.tripService.getItinerary(this.trip()!.id));
  };

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
    this.tRouteOptions.set(null);
    this.tSelectedRouteIdx.set(null);
    this.tExpandedRouteIdx.set(null);
    const mins = item.next_transport_minutes ?? 0;
    this.tHours.set(Math.floor(mins / 60));
    this.tMins.set(mins % 60);
    const useSystem = this.canAutoCalc(mode);
    this.tTimeTab.set(useSystem ? 'system' : 'custom');
    if (useSystem) {
      // 先前已用「系統」模式儲存過交通方式：重新查詢路線清單，並反白當初選定的方案
      void this.tAutoCalc(mins > 0 ? mins : null);
    }
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
    this.tRouteOptions.set(null);
    this.tSelectedRouteIdx.set(null);
    this.tExpandedRouteIdx.set(null);
    if (mode && !this.canAutoCalc(mode)) {
      this.tTimeTab.set('custom');
    }
  }

  selectRoute(idx: number): void {
    const routes = this.tRouteOptions();
    if (!routes?.[idx]) return;
    this.tSelectedRouteIdx.set(idx);
    this.tCalcResult.set(routes[idx].durationMin);
  }

  /** 點擊路線列：選取該方案，並切換到路線詳情「頁」（地圖＋逐步說明） */
  viewRouteDetail(idx: number): void {
    this.selectRoute(idx);
    this.tExpandedRouteIdx.set(idx);
  }

  closeRouteDetail(): void {
    this.tExpandedRouteIdx.set(null);
  }

  stepIcon(mode: RouteOption['steps'][number]['mode']): string {
    switch (mode) {
      case 'walk':
        return '🚶';
      case 'transit':
        return '🚇';
      case 'drive':
        return '🚗';
      case 'bike':
        return '🚲';
      default:
        return '•';
    }
  }

  /** 在展開的路線詳情內繪製迷你地圖並描繪該路線 Polyline */
  private async renderRouteDetailMap(el: HTMLDivElement): Promise<void> {
    const idx = this.tExpandedRouteIdx();
    if (idx === null) return;
    const route = this.tRouteOptions()?.[idx];
    if (!route?.overviewPolyline) return;
    try {
      const path = await this.mapsService.decodePolyline(route.overviewPolyline);
      if (!path.length) return;
      const map = await this.mapsService.initMap(el, path[0]);
      const polyline = this.mapsService.drawPolyline(map, route.overviewPolyline);
      const bounds = new google.maps.LatLngBounds();
      polyline.getPath().forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 24);
    } catch (err) {
      console.warn('[TripDetail] renderRouteDetailMap failed', err);
    }
  }

  /** @param preselectDurationMin 重新開啟已儲存過的交通設定時，用來比對並反白先前選定的路線 */
  async tAutoCalc(preselectDurationMin?: number | null): Promise<void> {
    const from = this.editingTransportFrom();
    const to = this.editingTransportTo();
    const mode = this.tMode();
    if (!from || !to || !mode) return;
    this.tCalcing.set(true);
    this.tCalcResult.set(null);
    this.tCalcFailed.set(false);
    this.tRouteOptions.set(null);
    this.tSelectedRouteIdx.set(null);
    this.tExpandedRouteIdx.set(null);
    try {
      const routes = await this.mapsService.estimateRoutes(
        { lat: from.latitude, lng: from.longitude },
        { lat: to.latitude, lng: to.longitude },
        mode,
      );
      this.tRouteOptions.set(routes);
      this.tCalcFailed.set(!routes?.length);
      if (routes?.length) {
        const matchIdx = routes.findIndex((r) => r.durationMin === preselectDurationMin);
        this.selectRoute(matchIdx >= 0 ? matchIdx : 0);
      }
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
