import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Location } from '@angular/common';

/** 邊緣觸控起點需在螢幕最左側幾 px 內，才視為「邊緣滑動」手勢 */
const EDGE_ZONE_PX = 24;
/** 需向右拖曳超過這個距離才觸發返回上一頁 */
const SWIPE_THRESHOLD_PX = 70;
/** 已經在這些分頁首頁時，邊緣滑動不執行返回（沒有更上層可回） */
const TAB_HOME_ROUTES = ['/trips', '/exchange', '/settings', '/account'];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: [`
    :host { display: block; min-height: 100vh; }
  `]
})
export class App {
  private location = inject(Location);
  private router = inject(Router);
  private startX = 0;
  private startY = 0;
  private tracking = false;

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
