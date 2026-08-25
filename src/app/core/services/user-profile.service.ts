import { Injectable, inject, signal, effect } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface PresetAvatar {
  id: string;
  emoji: string;
  bg: string;
}

/** 男/女人像 + 動物頭像 emoji，搭配不同色彩圓形背景 */
export const PRESET_AVATARS: PresetAvatar[] = [
  { id: 'man1', emoji: '👨', bg: '#667eea' },
  { id: 'woman1', emoji: '👩', bg: '#ef476f' },
  { id: 'man2', emoji: '👨‍🦱', bg: '#06d6a0' },
  { id: 'woman2', emoji: '👩‍🦱', bg: '#f59e0b' },
  { id: 'man3', emoji: '👨‍🦰', bg: '#4361ee' },
  { id: 'woman3', emoji: '👩‍🦰', bg: '#c026d3' },
  { id: 'dog', emoji: '🐶', bg: '#fbbf24' },
  { id: 'cat', emoji: '🐱', bg: '#fb923c' },
  { id: 'fox', emoji: '🦊', bg: '#f97316' },
  { id: 'bear', emoji: '🐻', bg: '#a16207' },
  { id: 'panda', emoji: '🐼', bg: '#64748b' },
  { id: 'koala', emoji: '🐨', bg: '#94a3b8' },
];

const PRESET_PREFIX = 'preset:';

export type ParsedAvatar =
  { type: 'image'; src: string } | { type: 'preset'; emoji: string; bg: string } | { type: 'none' };

export function parseAvatar(url: string | null | undefined): ParsedAvatar {
  if (!url) return { type: 'none' };
  if (url.startsWith(PRESET_PREFIX)) {
    const [, emoji, bg] = url.split(':');
    return { type: 'preset', emoji, bg: bg ?? '#667eea' };
  }
  return { type: 'image', src: url };
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private supabase = inject(SupabaseService).client;
  private auth = inject(AuthService);

  readonly avatarUrl = signal<string | null>(null);
  readonly uploading = signal(false);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.loadProfile(user.id);
      } else {
        this.avatarUrl.set(null);
      }
    });
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data } = await this.supabase
      .from('user_profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();
    this.avatarUrl.set(data?.['avatar_url'] ?? null);
  }

  /** 批次查詢多個帳號（不限自己）的頭像，供行程成員清單顯示使用 */
  async getAvatarUrls(userIds: string[]): Promise<Record<string, string | null>> {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) return {};
    const { data } = await this.supabase
      .from('user_profiles')
      .select('id, avatar_url')
      .in('id', ids);
    const map: Record<string, string | null> = {};
    for (const row of data ?? []) {
      map[row['id']] = row['avatar_url'] ?? null;
    }
    return map;
  }

  async uploadAvatar(file: File): Promise<void> {
    const user = this.auth.user();
    if (!user) return;

    this.uploading.set(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await this.supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) {
        console.error('[UserProfile] upload error', uploadError);
        return;
      }

      const { data } = this.supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;

      const { error: upsertError } = await this.supabase
        .from('user_profiles')
        .upsert({ id: user.id, email: user.email, avatar_url: url }, { onConflict: 'id' });
      if (upsertError) {
        console.error('[UserProfile] profile upsert error', upsertError);
        return;
      }

      this.avatarUrl.set(url);
    } finally {
      this.uploading.set(false);
    }
  }

  /** 取得（沒有就建立）旅行地圖公開分享用的 token，供組出 /shared-map/:token 連結 */
  async getOrCreateMapShareToken(): Promise<string> {
    const user = this.auth.user();
    if (!user) throw new Error('Not authenticated');

    const { data } = await this.supabase
      .from('user_profiles')
      .select('map_share_token')
      .eq('id', user.id)
      .maybeSingle();
    const existing = data?.['map_share_token'];
    if (existing) return existing;

    const token = crypto.randomUUID();
    const { error } = await this.supabase
      .from('user_profiles')
      .upsert({ id: user.id, email: user.email, map_share_token: token }, { onConflict: 'id' });
    if (error) {
      console.error('[UserProfile] getOrCreateMapShareToken error', error);
      throw error;
    }
    return token;
  }

  async setPresetAvatar(preset: PresetAvatar): Promise<void> {
    const user = this.auth.user();
    if (!user) return;

    const value = `${PRESET_PREFIX}${preset.emoji}:${preset.bg}`;
    const { error } = await this.supabase
      .from('user_profiles')
      .upsert({ id: user.id, email: user.email, avatar_url: value }, { onConflict: 'id' });
    if (error) {
      console.error('[UserProfile] preset avatar upsert error', error);
      return;
    }

    this.avatarUrl.set(value);
  }
}
