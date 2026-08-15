import { Injectable, signal } from '@angular/core';

export type FilmReelPhase = 'hidden' | 'start' | 'expand' | 'fade';

/** 過場動畫的起始矩形（畫面座標），讓遮罩從觸發元素「目前實際的大小/位置」長成滿版，
 *  而不是從一個固定小圓點開始，銜接手機版拖曳到底時已經展開的膠捲才不會有割裂感。 */
export interface FilmReelOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class PageTransitionService {
  phase = signal<FilmReelPhase>('hidden');
  origin = signal<FilmReelOrigin | null>(null);

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  /**
   * 播放「膠捲從觸發點放大佔滿螢幕 → 導頁 → 淡出」的過場動畫。
   * 掛載在 App 根層級，不會隨路由切換被銷毀，動畫才能跨頁面完整播放。
   */
  async playFilmReel(
    origin: FilmReelOrigin | null,
    navigate: () => Promise<unknown>,
  ): Promise<void> {
    this.origin.set(origin);
    this.phase.set('start');
    await this.nextFrame();
    this.phase.set('expand');
    await this.wait(420);
    await navigate();
    this.phase.set('fade');
    await this.wait(280);
    this.phase.set('hidden');
    this.origin.set(null);
  }
}
