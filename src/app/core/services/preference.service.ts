import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export interface Country {
  code: string;
  flag: string;
  nativeName: string;
  timezone: string;
  currency: string;
  locale: string;
}

export const COUNTRIES: Country[] = [
  {
    code: 'TW',
    flag: '🇹🇼',
    nativeName: '台灣',
    timezone: 'Asia/Taipei',
    currency: 'TWD',
    locale: 'zh-TW',
  },
  {
    code: 'JP',
    flag: '🇯🇵',
    nativeName: '日本',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
    locale: 'ja-JP',
  },
  {
    code: 'KR',
    flag: '🇰🇷',
    nativeName: '한국',
    timezone: 'Asia/Seoul',
    currency: 'KRW',
    locale: 'ko-KR',
  },
  {
    code: 'CN',
    flag: '🇨🇳',
    nativeName: '中国',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    locale: 'zh-CN',
  },
  {
    code: 'TH',
    flag: '🇹🇭',
    nativeName: 'ไทย',
    timezone: 'Asia/Bangkok',
    currency: 'THB',
    locale: 'th-TH',
  },
  {
    code: 'VN',
    flag: '🇻🇳',
    nativeName: 'Việt Nam',
    timezone: 'Asia/Ho_Chi_Minh',
    currency: 'VND',
    locale: 'vi-VN',
  },
  {
    code: 'SG',
    flag: '🇸🇬',
    nativeName: 'Singapore',
    timezone: 'Asia/Singapore',
    currency: 'SGD',
    locale: 'en-SG',
  },
  {
    code: 'MY',
    flag: '🇲🇾',
    nativeName: 'Malaysia',
    timezone: 'Asia/Kuala_Lumpur',
    currency: 'MYR',
    locale: 'ms-MY',
  },
  {
    code: 'ID',
    flag: '🇮🇩',
    nativeName: 'Indonesia',
    timezone: 'Asia/Jakarta',
    currency: 'IDR',
    locale: 'id-ID',
  },
  {
    code: 'AU',
    flag: '🇦🇺',
    nativeName: 'Australia',
    timezone: 'Australia/Sydney',
    currency: 'AUD',
    locale: 'en-AU',
  },
  {
    code: 'US',
    flag: '🇺🇸',
    nativeName: 'United States',
    timezone: 'America/New_York',
    currency: 'USD',
    locale: 'en-US',
  },
  {
    code: 'CA',
    flag: '🇨🇦',
    nativeName: 'Canada',
    timezone: 'America/Toronto',
    currency: 'CAD',
    locale: 'en-CA',
  },
  {
    code: 'GB',
    flag: '🇬🇧',
    nativeName: 'United Kingdom',
    timezone: 'Europe/London',
    currency: 'GBP',
    locale: 'en-GB',
  },
  {
    code: 'FR',
    flag: '🇫🇷',
    nativeName: 'France',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    locale: 'fr-FR',
  },
  {
    code: 'DE',
    flag: '🇩🇪',
    nativeName: 'Deutschland',
    timezone: 'Europe/Berlin',
    currency: 'EUR',
    locale: 'de-DE',
  },
  {
    code: 'IT',
    flag: '🇮🇹',
    nativeName: 'Italia',
    timezone: 'Europe/Rome',
    currency: 'EUR',
    locale: 'it-IT',
  },
  {
    code: 'ES',
    flag: '🇪🇸',
    nativeName: 'España',
    timezone: 'Europe/Madrid',
    currency: 'EUR',
    locale: 'es-ES',
  },
  {
    code: 'CH',
    flag: '🇨🇭',
    nativeName: 'Schweiz',
    timezone: 'Europe/Zurich',
    currency: 'CHF',
    locale: 'de-CH',
  },
  {
    code: 'TR',
    flag: '🇹🇷',
    nativeName: 'Türkiye',
    timezone: 'Europe/Istanbul',
    currency: 'TRY',
    locale: 'tr-TR',
  },
  {
    code: 'AE',
    flag: '🇦🇪',
    nativeName: 'الإمارات',
    timezone: 'Asia/Dubai',
    currency: 'AED',
    locale: 'ar-AE',
  },
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
  { id: 'gold', label: '黃銅金', accent: '#b8874a', accentLight: '#f5ecdc', accentDark: '#4a3a22' },
  { id: 'purple', label: '紫藍', accent: '#667eea', accentLight: '#f0f0ff', accentDark: '#3a3d8c' },
  { id: 'indigo', label: '靛藍', accent: '#4361ee', accentLight: '#eef0ff', accentDark: '#2a3bb0' },
  { id: 'mint', label: '薄荷', accent: '#06d6a0', accentLight: '#e8fff8', accentDark: '#048f6a' },
  { id: 'coral', label: '珊瑚', accent: '#ef476f', accentLight: '#fff0f3', accentDark: '#b02050' },
  { id: 'amber', label: '琥珀', accent: '#f59e0b', accentLight: '#fffbeb', accentDark: '#b57008' },
  { id: 'slate', label: '石板', accent: '#64748b', accentLight: '#f1f5f9', accentDark: '#3e4e62' },
];

const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '20px',
};

/** 目前有實際翻譯檔的語系；其餘國家 locale 會 fallback 到最接近的一個 */
const AVAILABLE_LANGS = ['zh-TW', 'zh-CN', 'ja-JP', 'en-US'] as const;
type AvailableLang = (typeof AVAILABLE_LANGS)[number];

function resolveLang(locale: string): AvailableLang {
  if ((AVAILABLE_LANGS as readonly string[]).includes(locale)) return locale as AvailableLang;
  if (locale.startsWith('zh')) return 'zh-TW';
  if (locale.startsWith('ja')) return 'ja-JP';
  return 'en-US';
}

function load<T>(key: string, fallback: T): T {
  const v = localStorage.getItem(key);
  return v !== null ? (v as unknown as T) : fallback;
}

@Injectable({ providedIn: 'root' })
export class PreferenceService {
  private transloco = inject(TranslocoService);

  readonly theme = signal<Theme>(load('pref_theme', 'light'));
  readonly colorId = signal<string>(load('pref_color', 'gold'));
  readonly customColorHex = signal<string>(load('pref_custom_color', '#667eea'));
  readonly fontSize = signal<FontSize>(load('pref_fontSize', 'md'));
  /** 當前所在國家（帳號頁切換，影響 UI 語系與換算目標幣別） */
  readonly homeCountryCode = signal<string>(load('pref_home_country', 'TW'));
  /** 目的地國家（標題列切換）；尚未設定時預設帶入所在國家 */
  readonly countryCode = signal<string>(
    localStorage.getItem('pref_country') ?? this.homeCountryCode(),
  );
  private readonly _now = signal<Date>(new Date());

  readonly country = computed(
    () => COUNTRIES.find((c) => c.code === this.countryCode()) ?? COUNTRIES[0],
  );
  readonly homeCountry = computed(
    () => COUNTRIES.find((c) => c.code === this.homeCountryCode()) ?? COUNTRIES[0],
  );
  readonly color = computed(
    () => COLOR_OPTIONS.find((c) => c.id === this.colorId()) ?? COLOR_OPTIONS[0],
  );

  readonly clockDisplay = computed(() => {
    const d = this._now();
    const tz = this.country().timezone;
    const p: Record<string, string> = {};
    new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: tz,
    })
      .formatToParts(d)
      .forEach(({ type, value }) => {
        p[type] = value;
      });
    return `${p['year']}/${p['month']}/${p['day']} ${p['hour']}:${p['minute']}:${p['second']}`;
  });

  constructor() {
    effect(() => {
      const root = document.documentElement;
      const id = this.colorId();
      const theme = this.theme();
      const fs = this.fontSize();
      let accent: string;
      let accentLight: string;
      if (id === 'custom') {
        accent = this.customColorHex();
        accentLight = hexToRgba(accent, theme === 'dark' ? 0.3 : 0.12);
      } else {
        const col = COLOR_OPTIONS.find((c) => c.id === id) ?? COLOR_OPTIONS[0];
        accent = col.accent;
        accentLight = theme === 'dark' ? col.accentDark : col.accentLight;
      }
      root.setAttribute('data-theme', theme);
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-light', accentLight);
      root.style.setProperty('--font-size-base', FONT_SIZE_MAP[fs]);
    });

    // 依「當前所在國家」切換 UI 語系（<html lang=""> + Transloco 實際文字）
    effect(() => {
      const locale = this.homeCountry().locale;
      document.documentElement.lang = locale;
      this.transloco.setActiveLang(resolveLang(locale));
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
  setCustomColor(hex: string): void {
    this.customColorHex.set(hex);
    localStorage.setItem('pref_custom_color', hex);
    this.colorId.set('custom');
    localStorage.setItem('pref_color', 'custom');
  }
  setFontSize(s: FontSize): void {
    this.fontSize.set(s);
    localStorage.setItem('pref_fontSize', s);
  }

  setCountry(code: string): void {
    this.countryCode.set(code);
    localStorage.setItem('pref_country', code);
  }

  setHomeCountry(code: string): void {
    this.homeCountryCode.set(code);
    localStorage.setItem('pref_home_country', code);
    const c = COUNTRIES.find((x) => x.code === code);
    if (c) localStorage.setItem('lang', c.locale);
  }
}
