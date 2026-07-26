import { Injectable, signal, computed, effect } from '@angular/core';

export interface Country {
  code: string;
  flag: string;
  nativeName: string;
  timezone: string;
  currency: string;
  locale: string;
}

export const COUNTRIES: Country[] = [
  { code: 'TW', flag: '🇹🇼', nativeName: '台灣',         timezone: 'Asia/Taipei',          currency: 'TWD', locale: 'zh-TW' },
  { code: 'JP', flag: '🇯🇵', nativeName: '日本',         timezone: 'Asia/Tokyo',           currency: 'JPY', locale: 'ja-JP' },
  { code: 'KR', flag: '🇰🇷', nativeName: '한국',         timezone: 'Asia/Seoul',           currency: 'KRW', locale: 'ko-KR' },
  { code: 'CN', flag: '🇨🇳', nativeName: '中国',         timezone: 'Asia/Shanghai',        currency: 'CNY', locale: 'zh-CN' },
  { code: 'TH', flag: '🇹🇭', nativeName: 'ไทย',         timezone: 'Asia/Bangkok',         currency: 'THB', locale: 'th-TH' },
  { code: 'VN', flag: '🇻🇳', nativeName: 'Việt Nam',    timezone: 'Asia/Ho_Chi_Minh',     currency: 'VND', locale: 'vi-VN' },
  { code: 'SG', flag: '🇸🇬', nativeName: 'Singapore',   timezone: 'Asia/Singapore',       currency: 'SGD', locale: 'en-SG' },
  { code: 'MY', flag: '🇲🇾', nativeName: 'Malaysia',    timezone: 'Asia/Kuala_Lumpur',    currency: 'MYR', locale: 'ms-MY' },
  { code: 'ID', flag: '🇮🇩', nativeName: 'Indonesia',   timezone: 'Asia/Jakarta',         currency: 'IDR', locale: 'id-ID' },
  { code: 'AU', flag: '🇦🇺', nativeName: 'Australia',   timezone: 'Australia/Sydney',     currency: 'AUD', locale: 'en-AU' },
  { code: 'US', flag: '🇺🇸', nativeName: 'United States', timezone: 'America/New_York',  currency: 'USD', locale: 'en-US' },
  { code: 'CA', flag: '🇨🇦', nativeName: 'Canada',      timezone: 'America/Toronto',      currency: 'CAD', locale: 'en-CA' },
  { code: 'GB', flag: '🇬🇧', nativeName: 'United Kingdom', timezone: 'Europe/London',    currency: 'GBP', locale: 'en-GB' },
  { code: 'FR', flag: '🇫🇷', nativeName: 'France',      timezone: 'Europe/Paris',         currency: 'EUR', locale: 'fr-FR' },
  { code: 'DE', flag: '🇩🇪', nativeName: 'Deutschland', timezone: 'Europe/Berlin',        currency: 'EUR', locale: 'de-DE' },
  { code: 'IT', flag: '🇮🇹', nativeName: 'Italia',      timezone: 'Europe/Rome',          currency: 'EUR', locale: 'it-IT' },
  { code: 'ES', flag: '🇪🇸', nativeName: 'España',      timezone: 'Europe/Madrid',        currency: 'EUR', locale: 'es-ES' },
  { code: 'CH', flag: '🇨🇭', nativeName: 'Schweiz',     timezone: 'Europe/Zurich',        currency: 'CHF', locale: 'de-CH' },
  { code: 'TR', flag: '🇹🇷', nativeName: 'Türkiye',     timezone: 'Europe/Istanbul',      currency: 'TRY', locale: 'tr-TR' },
  { code: 'AE', flag: '🇦🇪', nativeName: 'الإمارات',   timezone: 'Asia/Dubai',           currency: 'AED', locale: 'ar-AE' },
];

export type Theme = 'light' | 'dark';
export type FontSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ColorOption {
  id: string;
  label: string;
  accent: string;
  accentLight: string;
  accentDark: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  { id: 'purple', label: '紫藍', accent: '#667eea', accentLight: '#f0f0ff', accentDark: '#3a3d8c' },
  { id: 'indigo', label: '靛藍', accent: '#4361ee', accentLight: '#eef0ff', accentDark: '#2a3bb0' },
  { id: 'mint',   label: '薄荷', accent: '#06d6a0', accentLight: '#e8fff8', accentDark: '#048f6a' },
  { id: 'coral',  label: '珊瑚', accent: '#ef476f', accentLight: '#fff0f3', accentDark: '#b02050' },
  { id: 'amber',  label: '琥珀', accent: '#f59e0b', accentLight: '#fffbeb', accentDark: '#b57008' },
  { id: 'slate',  label: '石板', accent: '#64748b', accentLight: '#f1f5f9', accentDark: '#3e4e62' },
];

const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: '14px', md: '16px', lg: '18px', xl: '20px',
};

function load<T>(key: string, fallback: T): T {
  const v = localStorage.getItem(key);
  return v !== null ? (v as unknown as T) : fallback;
}

@Injectable({ providedIn: 'root' })
export class PreferenceService {
  readonly theme      = signal<Theme>(load('pref_theme', 'light'));
  readonly colorId    = signal<string>(load('pref_color', 'purple'));
  readonly fontSize   = signal<FontSize>(load('pref_fontSize', 'md'));
  readonly countryCode = signal<string>(load('pref_country', 'TW'));
  private  readonly _now = signal<Date>(new Date());

  readonly country = computed(() =>
    COUNTRIES.find(c => c.code === this.countryCode()) ?? COUNTRIES[0]
  );

  readonly color = computed(() =>
    COLOR_OPTIONS.find(c => c.id === this.colorId()) ?? COLOR_OPTIONS[0]
  );

  readonly clockDisplay = computed(() => {
    const d   = this._now();
    const tz  = this.country().timezone;
    const fmt = new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: tz,
    });
    const p: Record<string, string> = {};
    fmt.formatToParts(d).forEach(({ type, value }) => { p[type] = value; });
    return `${p['year']}/${p['month']}/${p['day']} ${p['hour']}:${p['minute']}:${p['second']}`;
  });

  constructor() {
    // Apply CSS variables whenever signals change
    effect(() => {
      const root  = document.documentElement;
      const col   = this.color();
      const theme = this.theme();
      const fs    = this.fontSize();

      root.setAttribute('data-theme', theme);
      root.style.setProperty('--accent',       col.accent);
      root.style.setProperty('--accent-light', theme === 'dark' ? col.accentDark : col.accentLight);
      root.style.setProperty('--font-size-base', FONT_SIZE_MAP[fs]);
    });

    setInterval(() => this._now.set(new Date()), 1000);
  }

  setTheme(t: Theme): void {
    this.theme.set(t);
    localStorage.setItem('pref_theme', t);
  }

  setColor(id: string): void {
    this.colorId.set(id);
    localStorage.setItem('pref_color', id);
  }

  setFontSize(s: FontSize): void {
    this.fontSize.set(s);
    localStorage.setItem('pref_fontSize', s);
  }

  setCountry(code: string): void {
    this.countryCode.set(code);
    localStorage.setItem('pref_country', code);
    const c = COUNTRIES.find(x => x.code === code);
    if (c) localStorage.setItem('lang', c.locale);
  }
}
