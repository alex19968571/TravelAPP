import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { SyncEngineService } from './sync-engine.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService).client;
  private router = inject(Router);
  private syncEngine = inject(SyncEngineService);

  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly loading = signal(true);

  constructor() {
    this.supabase.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.user.set(data.session?.user ?? null);
      this.loading.set(false);
      if (data.session?.user) {
        this.syncEngine.syncDown(data.session.user.id);
      }
    });

    this.supabase.auth.onAuthStateChange((event, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        this.syncEngine.syncDown(session.user.id);
        // 若是從 /login 或首頁登入才需要導頁；若是深連結（例如 /join/:code、mail 提醒連結）
        // 回來的登入，優先導回 authGuard 記住的「原本要去的頁面」，沒有記錄才 fallback 回 /trips。
        // （常見情境：點深連結時 session 還沒讀取完成，authGuard 誤判未登入先導去 /login，
        //  登入完成後這裡若只寫死導回 /trips，會把原本要去的深連結頁面弄丟）
        if (this.router.url === '/login' || this.router.url === '/') {
          const pending = sessionStorage.getItem('pending_return_url');
          sessionStorage.removeItem('pending_return_url');
          this.router.navigateByUrl(pending && pending !== '/login' ? pending : '/trips');
        }
      } else if (event === 'SIGNED_OUT') {
        this.router.navigate(['/login']);
      }
    });
  }

  // 取得正確的 base URL（相容 GitHub Pages 子路徑，如 /TravelAPP/）
  private getRedirectUrl(): string {
    const base = document.querySelector('base')?.href ?? `${window.location.origin}/`;
    const pending = sessionStorage.getItem('pending_return_url');
    sessionStorage.removeItem('pending_return_url');
    const path = pending ? pending.replace(/^\//, '') : 'trips';
    return `${base}${path}`;
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: this.getRedirectUrl() },
    });
    if (error) console.error('[Auth] Google sign-in error', error);
  }

  async signInWithApple(): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: this.getRedirectUrl() },
    });
    if (error) console.error('[Auth] Apple sign-in error', error);
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) console.error('[Auth] Sign-out error', error);
  }
}
