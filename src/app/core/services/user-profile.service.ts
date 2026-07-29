import { Injectable, inject, signal, effect } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

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
}
