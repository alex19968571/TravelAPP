import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

/** 行程剪貼簿：由行程列表滑動/點擊膠捲進入，功能內容之後再設計，先留空頁面。 */
@Component({
  selector: 'app-trip-scrapbook',
  standalone: true,
  imports: [RouterModule, TranslocoModule],
  template: `
    <div class="page-scroll">
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
          <h1>{{ 'scrapbook.title' | transloco }}</h1>
        </header>

        <div class="empty-state">
          <span class="empty-icon">🎞️</span>
          <p>{{ 'scrapbook.comingSoon' | transloco }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      /* 外層滿版捲動 + 內層置中欄寬拆兩層：捲動範圍（.page-scroll）才能貼齊
         視窗邊緣，滑鼠在置中欄位兩側空白處滾輪也能捲動。 */
      .page-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .page-scroll::-webkit-scrollbar {
        display: none;
      }
      .page-container {
        max-width: 900px;
        width: 100%;
        margin: 0 auto;
        padding: 1.5rem;
        background: var(--bg);
        box-sizing: border-box;
      }
      .page-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
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
      .back-btn:hover {
        background: var(--icon-bg-hover);
      }
      h1 {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 4rem 1rem;
        color: var(--text-secondary);
      }
      .empty-icon {
        font-size: 3rem;
      }
    `,
  ],
})
export class TripScrapbookComponent {
  private route = inject(ActivatedRoute);
  tripId = this.route.snapshot.paramMap.get('id');
}
