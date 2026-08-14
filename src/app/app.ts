import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Location } from '@angular/common';
import { PageTransitionService } from './core/services/page-transition.service';

/** 邊緣觸控起點需在螢幕最左側幾 px 內，才視為「邊緣滑動」手勢 */
const EDGE_ZONE_PX = 24;
/** 需向右拖曳超過這個距離才觸發返回上一頁 */
const SWIPE_THRESHOLD_PX = 70;
/** 已經在這些分頁首頁時，邊緣滑動不執行返回（沒有更上層可回） */
const TAB_HOME_ROUTES = ['/trips', '/exchange', '/settings', '/account'];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    <!-- 跨頁面過場動畫遮罩：掛在根層級，不會隨路由切換被銷毀 -->
    @if (transition.phase() !== 'hidden') {
      <div
        class="film-reel-transition"
        [class.expand]="transition.phase() === 'expand' || transition.phase() === 'fade'"
        [class.fade]="transition.phase() === 'fade'"
        [style.--ox]="(transition.origin()?.x ?? viewportCenterX()) + 'px'"
        [style.--oy]="(transition.origin()?.y ?? viewportCenterY()) + 'px'"
      >
        <span class="film-reel-icon">🎞️</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }
      .film-reel-transition {
        position: fixed;
        top: var(--oy);
        left: var(--ox);
        width: 56px;
        height: 56px;
        margin: -28px 0 0 -28px;
        border-radius: 50%;
        background: #111;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        z-index: 900;
        opacity: 1;
        transition:
          top 0.42s cubic-bezier(0.22, 1, 0.36, 1),
          left 0.42s cubic-bezier(0.22, 1, 0.36, 1),
          width 0.42s cubic-bezier(0.22, 1, 0.36, 1),
          height 0.42s cubic-bezier(0.22, 1, 0.36, 1),
          margin 0.42s cubic-bezier(0.22, 1, 0.36, 1),
          border-radius 0.42s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .film-reel-transition.expand {
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        margin: 0;
        border-radius: 0;
      }
      .film-reel-transition.fade {
        transition: opacity 0.28s ease;
        opacity: 0;
      }
      .film-reel-icon {
        font-size: 1.6rem;
        transition: font-size 0.42s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .film-reel-transition.expand .film-reel-icon {
        font-size: 4rem;
      }
    `,
  ],
})
export class App {
  private location = inject(Location);
  private router = inject(Router);
  transition = inject(PageTransitionService);
  private startX = 0;
  private startY = 0;
  private tracking = false;

  viewportCenterX(): number {
    return window.innerWidth / 2;
  }

  viewportCenterY(): number {
    return window.innerHeight / 2;
  }

  constructor() {
    // 鎖住兩指縮放：Angular 的 HostListener 會被 zone.js 預設註冊為
    // passive，preventDefault() 會被忽略，改用原生 addEventListener
    // 並明確指定 { passive: false } 才能真正攔截手勢。
    document.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (e.touches.length > 1) e.preventDefault();
      },
      { passive: false },
    );
    document.addEventListener('gesturestart', (e: Event) => e.preventDefault());
  }

  // 獨立安裝的 PWA（standalone 模式）沒有瀏覽器原生的邊緣滑動返回手勢，
  // 這裡用簡單的觸控偵測補上：從螢幕最左緣開始、明顯向右拖曳即視為「返回上一頁」。
  @HostListener('document:touchstart', ['$event'])
  onTouchStart(e: TouchEvent): void {
    const t = e.touches[0];
    this.tracking = t.clientX <= EDGE_ZONE_PX;
    this.startX = t.clientX;
    this.startY = t.clientY;
  }

  @HostListener('document:touchend', ['$event'])
  onTouchEnd(e: TouchEvent): void {
    if (!this.tracking) return;
    this.tracking = false;
    if (TAB_HOME_ROUTES.includes(this.router.url)) return; // 已在分頁首頁，沒有上一層可回
    const t = e.changedTouches[0];
    const dx = t.clientX - this.startX;
    const dy = Math.abs(t.clientY - this.startY);
    if (dx > SWIPE_THRESHOLD_PX && dy < 60) {
      this.location.back();
    }
  }
}
