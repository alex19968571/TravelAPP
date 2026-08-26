import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  OnInit,
  AfterViewInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ItineraryItem, TravelMapPin } from '../../core/models';
import { MapsService } from '../../core/services/maps.service';
import { TravelMapService } from '../../core/services/travel-map.service';
import { AuthService } from '../../core/services/auth.service';

export interface TravelMapDetailTrip {
  id: string;
  title: string;
  origin?: string | null;
  destination?: string | null;
}

/**
 * 目的地大頭針點擊後的詳情面板：內嵌該趟行程的每日路線小地圖 + 每日清單（可跳轉當天）
 * + 照片(最多3)/聲音/筆記 + 弧線顏色調整。authenticated（travel-map.component.ts）與
 * public（public-map.component.ts）共用同一份，用 [readOnly] 切換是否顯示編輯功能。
 */
@Component({
  selector: 'app-travel-map-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule],
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal-card detail-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="header-text">
            <h3>{{ trip.title }}</h3>
            @if (trip.origin && trip.destination) {
              <div class="route-line">{{ trip.origin }} → {{ trip.destination }}</div>
            }
          </div>
          <button
            type="button"
            class="close-x-btn"
            [attr.aria-label]="'common.close' | transloco"
            (click)="close()"
          >
            ✕
          </button>
        </div>

        <div class="detail-scroll">
          <div class="mini-map" #miniMapEl></div>

          @if (daySummaries().length > 0) {
            <div class="day-list">
              @for (d of daySummaries(); track d.day) {
                <button type="button" class="day-row" (click)="goToDay(d.day)">
                  <span>{{ 'travelMap.dayLabel' | transloco: { day: d.day } }}</span>
                  <span class="day-meta">{{ d.firstPlace }}｜{{ d.count }}</span>
                </button>
              }
            </div>
          }

          @if (photoUrlsDraft().length > 0) {
            <div class="photo-carousel">
              <div class="carousel-track">
                @for (url of photoUrlsDraft(); track url) {
                  <div class="carousel-slide">
                    <img [src]="url" alt="" class="photo-full" />
                    @if (editing()) {
                      <button type="button" class="photo-remove" (click)="removePhoto(url)">
                        ✕
                      </button>
                    }
                  </div>
                }
              </div>
              @if (photoUrlsDraft().length > 1) {
                <div class="carousel-dots">
                  @for (url of photoUrlsDraft(); track url) {
                    <span class="dot"></span>
                  }
                </div>
              }
            </div>
          } @else if (!editing()) {
            <p class="empty-hint">{{ 'travelMap.noContent' | transloco }}</p>
          }

          @if (!editing()) {
            @if (audioUrlDraft()) {
              <div class="field-block">
                <label>{{ 'travelMap.audio' | transloco }}</label>
                <audio controls [src]="audioUrlDraft()"></audio>
              </div>
            }

            @if (notesDraft()) {
              <div class="field-block">
                <label>{{ 'travelMap.notes' | transloco }}</label>
                <p class="notes-text">{{ notesDraft() }}</p>
              </div>
            }
          }

          @if (editing()) {
            <div class="edit-panel">
              <label>{{ 'travelMap.photos' | transloco }}（{{ photoUrlsDraft().length }}/3）</label>
              <label
                class="file-btn"
                [class.disabled]="uploadingPhoto() || photoUrlsDraft().length >= 3"
              >
                {{ 'common.chooseFile' | transloco }}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  [disabled]="uploadingPhoto() || photoUrlsDraft().length >= 3"
                  (change)="onPhotoSelected($event)"
                />
              </label>

              <label>{{ 'travelMap.audio' | transloco }}</label>
              @if (audioUrlDraft()) {
                <audio controls [src]="audioUrlDraft()"></audio>
                <button type="button" class="btn-secondary" (click)="removeAudio()">
                  {{ 'travelMap.removeAudio' | transloco }}
                </button>
              } @else {
                <label class="file-btn" [class.disabled]="uploadingAudio()">
                  {{ 'common.chooseFile' | transloco }}
                  <input
                    type="file"
                    accept="audio/*"
                    hidden
                    [disabled]="uploadingAudio()"
                    (change)="onAudioSelected($event)"
                  />
                </label>
              }

              <label>{{ 'travelMap.notes' | transloco }}</label>
              <textarea
                [ngModel]="notesDraft()"
                (ngModelChange)="notesDraft.set($event)"
                rows="3"
              ></textarea>

              <label>{{ 'travelMap.arcColor' | transloco }}</label>
              <div class="color-row">
                <input
                  type="color"
                  [value]="colorDraft() ?? '#667eea'"
                  (input)="onColorInput($event)"
                />
                <button type="button" class="btn-secondary" (click)="randomizeColor()">
                  {{ 'travelMap.randomColor' | transloco }}
                </button>
              </div>
            </div>
          }
        </div>

        @if (!readOnly) {
          <div class="modal-actions">
            @if (editing()) {
              <button type="button" class="btn-secondary" (click)="editing.set(false)">
                {{ 'common.cancel' | transloco }}
              </button>
              <button type="button" class="btn-primary" [disabled]="saving()" (click)="save()">
                {{ 'common.save' | transloco }}
              </button>
            } @else {
              <button type="button" class="btn-primary" (click)="startEdit()">
                {{ 'travelMap.edit' | transloco }}
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 250;
        padding: 1rem;
      }
      .detail-card {
        background: var(--surface);
        border-radius: 16px;
        max-width: 480px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 12px 40px var(--shadow);
      }
      .modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 1.25rem 1.25rem 0.75rem;
      }
      .modal-header h3 {
        margin: 0;
        color: var(--text-primary);
      }
      .route-line {
        margin-top: 0.25rem;
        font-size: 0.85rem;
        color: var(--text-secondary);
      }
      .close-x-btn {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: var(--icon-bg);
        color: var(--text-secondary);
        cursor: pointer;
      }
      .detail-scroll {
        overflow-y: auto;
        padding: 0 1.25rem 1.25rem;
        scrollbar-width: none;
      }
      .detail-scroll::-webkit-scrollbar {
        display: none;
      }
      .mini-map {
        width: 100%;
        height: 180px;
        border-radius: 12px;
        overflow: hidden;
        background: var(--bg);
        margin-bottom: 0.75rem;
      }
      .day-list {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        margin-bottom: 0.75rem;
      }
      .day-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        background: transparent;
        color: var(--text-primary);
        cursor: pointer;
        font-size: 0.85rem;
        text-align: left;
      }
      .day-row:hover {
        background: var(--accent-light);
      }
      .day-meta {
        color: var(--text-secondary);
        font-size: 0.78rem;
      }
      .field-block {
        margin-bottom: 0.75rem;
      }
      .field-block label {
        display: block;
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-bottom: 0.35rem;
      }
      .photo-carousel {
        margin-bottom: 0.75rem;
      }
      .carousel-track {
        display: flex;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        border-radius: 12px;
      }
      .carousel-track::-webkit-scrollbar {
        display: none;
      }
      .carousel-slide {
        position: relative;
        flex: 0 0 100%;
        scroll-snap-align: start;
      }
      .photo-full {
        width: 100%;
        border-radius: 12px;
        display: block;
      }
      .carousel-dots {
        display: flex;
        justify-content: center;
        gap: 0.35rem;
        margin-top: 0.5rem;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--border);
      }
      .photo-remove {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: none;
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        cursor: pointer;
        font-size: 0.75rem;
      }
      audio {
        width: 100%;
      }
      .notes-text {
        box-sizing: border-box;
        width: 100%;
        color: var(--text-primary);
        font-size: 0.9rem;
        white-space: pre-wrap;
        margin: 0;
        padding: 0.5rem 0.75rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        background: var(--input-bg);
      }
      .empty-hint {
        color: var(--text-secondary);
        font-size: 0.85rem;
        margin: 0 0 0.75rem;
      }
      .edit-panel {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--border);
      }
      .edit-panel label {
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-top: 0.4rem;
      }
      .edit-panel textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 0.5rem 0.75rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        background: var(--input-bg);
        color: var(--text-primary);
        font-family: inherit;
        resize: vertical;
      }
      .color-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .color-row input[type='color'] {
        flex: 1;
        min-width: 0;
        height: 38px;
        padding: 0.15rem;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        background: var(--input-bg);
        cursor: pointer;
      }
      .color-row .btn-secondary {
        flex: 1;
      }
      .modal-actions {
        display: flex;
        gap: 0.75rem;
        padding: 0.75rem 1.25rem 1.25rem;
      }
      .modal-actions .btn-primary,
      .modal-actions .btn-secondary {
        flex: 1;
        text-align: center;
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
        padding: 0.625rem 1.25rem;
        cursor: pointer;
      }
      .file-btn {
        display: flex;
        width: 100%;
        box-sizing: border-box;
        justify-content: center;
        background: var(--accent-light);
        color: var(--text-secondary);
        border: none;
        border-radius: 10px;
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .file-btn.disabled {
        opacity: 0.5;
        pointer-events: none;
      }
    `,
  ],
})
export class TravelMapDetailComponent implements OnInit, AfterViewInit {
  @ViewChild('miniMapEl') miniMapElRef!: ElementRef<HTMLElement>;

  @Input({ required: true }) trip!: TravelMapDetailTrip;
  @Input() pin: TravelMapPin | undefined;
  @Input() itineraryItems: ItineraryItem[] = [];
  @Input() readOnly = false;
  /** 其他行程目前使用中的弧線顏色（含自訂與預設計算出來的），供「隨機生成」避開重複色 */
  @Input() usedColors: string[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<TravelMapPin>();

  private mapsService = inject(MapsService);
  private travelMapService = inject(TravelMapService);
  private auth = inject(AuthService);
  private router = inject(Router);

  editing = signal(false);
  saving = signal(false);
  notesDraft = signal('');
  colorDraft = signal<string | null>(null);
  uploadingPhoto = signal(false);
  uploadingAudio = signal(false);
  photoUrlsDraft = signal<string[]>([]);
  audioUrlDraft = signal<string | null>(null);

  daySummaries = computed(() => {
    const grouped = new Map<number, ItineraryItem[]>();
    for (const item of this.itineraryItems) {
      if (!grouped.has(item.day_number)) grouped.set(item.day_number, []);
      grouped.get(item.day_number)!.push(item);
    }
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, items]) => ({
        day,
        count: items.length,
        firstPlace: [...items].sort((a, b) => a.order_index - b.order_index)[0]?.place_name ?? '',
      }));
  });

  ngOnInit(): void {
    this.photoUrlsDraft.set(this.pin?.photo_urls ?? []);
    this.audioUrlDraft.set(this.pin?.audio_url ?? null);
    this.notesDraft.set(this.pin?.notes ?? '');
    this.colorDraft.set(this.pin?.arc_color ?? null);
  }

  async ngAfterViewInit(): Promise<void> {
    if (this.itineraryItems.length === 0) return;
    try {
      const first = this.itineraryItems[0];
      const map = await this.mapsService.initMap(this.miniMapElRef.nativeElement, {
        lat: first.latitude,
        lng: first.longitude,
      });
      const { bounds } = this.mapsService.renderDayColoredRoute(map, this.itineraryItems);
      map.fitBounds(bounds, 40);
    } catch (err) {
      console.warn('[TravelMapDetail] mini map init failed', err);
    }
  }

  goToDay(day: number): void {
    this.router.navigate(['/trips', this.trip.id, 'itinerary'], { queryParams: { day } });
  }

  startEdit(): void {
    this.editing.set(true);
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;
    const remaining = 3 - this.photoUrlsDraft().length;
    const toUpload = Array.from(files).slice(0, Math.max(0, remaining));
    this.uploadingPhoto.set(true);
    try {
      for (const file of toUpload) {
        const url = await this.travelMapService.uploadPhoto(file);
        if (url) this.photoUrlsDraft.set([...this.photoUrlsDraft(), url]);
      }
    } finally {
      this.uploadingPhoto.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  removePhoto(url: string): void {
    this.photoUrlsDraft.set(this.photoUrlsDraft().filter((u) => u !== url));
  }

  async onAudioSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingAudio.set(true);
    try {
      const url = await this.travelMapService.uploadAudio(file);
      if (url) this.audioUrlDraft.set(url);
    } finally {
      this.uploadingAudio.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  removeAudio(): void {
    this.audioUrlDraft.set(null);
  }

  randomizeColor(): void {
    this.colorDraft.set(this.mapsService.generateDistinctColor(this.usedColors));
  }

  onColorInput(event: Event): void {
    this.colorDraft.set((event.target as HTMLInputElement).value);
  }

  async save(): Promise<void> {
    const ownerId = this.auth.user()?.id;
    if (!ownerId) return;
    this.saving.set(true);
    try {
      const updated = await this.travelMapService.upsertForTrip(this.trip.id, ownerId, {
        photo_urls: this.photoUrlsDraft(),
        audio_url: this.audioUrlDraft(),
        notes: this.notesDraft() || null,
        arc_color: this.colorDraft(),
      });
      this.editing.set(false);
      this.saved.emit(updated);
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.closed.emit();
  }
}
