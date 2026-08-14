import { Injectable, signal } from '@angular/core';

export type FilmReelPhase = 'hidden' | 'start' | 'expand' | 'fade';

@Injectable({ providedIn: 'root' })
export class PageTransitionService {
  phase = signal<FilmReelPhase>('hidden');
  origin = signal<{ x: number; y: number } | null>(null);

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
    origin: { x: number; y: number } | null,
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
