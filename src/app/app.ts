import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Location } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
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
    <!-- 跨頁面過場動畫遮罩：掛在根層級，不會隨路由切換被銷毀。
         起始矩形直接吃觸發元素目前的實際大小/位置，銜接手機版拖曳到底時
         已經展開的膠捲，長成滿版時才不會有位置/尺寸跳動的割裂感。 -->
    @if (transition.phase() !== 'hidden') {
      <div
        class="film-reel-transition"
        [class.expand]="transition.phase() === 'expand' || transition.phase() === 'fade'"
        [class.fade]="transition.phase() === 'fade'"
        [style.top.px]="isExpanded() ? 0 : (transition.origin()?.y ?? viewportCenterY() - 28)"
        [style.left.px]="isExpanded() ? 0 : (transition.origin()?.x ?? viewportCenterX() - 28)"
        [style.width]="isExpanded() ? '100vw' : (transition.origin()?.width ?? 56) + 'px'"
        [style.height]="isExpanded() ? '100vh' : (transition.origin()?.height ?? 56) + 'px'"
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
        /* 深色機身＋小圓角，跟 .scrapbook-btn 的外觀一致，起始瞬間才會像同一個東西的延續 */
        border-radius: 4px;
        background: #161616;
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
          border-radius 0.42s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .film-reel-transition.expand {
        /* top/left/width/height 改由 inline style 依 phase 直接算出目標值來驅動 transition
           （inline style 的優先權必定蓋過這裡的 class 規則，寫在這裡永遠不會生效，
           之前就是因為這樣才卡住沒有真的長到滿版）。這裡只留 inline style 沒處理的部分。 */
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

  isExpanded(): boolean {
    const p = this.transition.phase();
    return p === 'expand' || p === 'fade';
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

    // PWA 版本更新偵測：預設 Service Worker 只會在背景下載新版本，
    // 使用者要手動重新整理兩次才會真正吃到最新部署，導致改完 push 上去、
    // 使用者卻一直看到舊畫面。這裡偵測到新版本下載完成就直接自動重整，
    // 確保每次部署後使用者下一次操作就能拿到最新版本。
    const swUpdate = inject(SwUpdate);
    if (swUpdate.isEnabled) {
      swUpdate.versionUpdates
        .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
        .subscribe(() => document.location.reload());
      void swUpdate.checkForUpdate();

      // 手機瀏覽器常見情境是「切回背景的分頁/從主畫面重新開啟」而非整個重新啟動，
      // 只在啟動當下檢查一次會漏掉這種情況，改為每次頁面重新可見時都再檢查一次新版本。
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void swUpdate.checkForUpdate();
      });
    }
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
