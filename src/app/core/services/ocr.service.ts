import { Injectable } from '@angular/core';
import { createWorker } from 'tesseract.js';

export interface OcrItem {
  name: string;
  price: number;
}

export interface OcrResult {
  amount: number | null;
  date: string | null;
  items: OcrItem[];
  isReceipt: boolean;
  rawText: string;
}

const AMOUNT_PATTERNS = [
  /(?:TOTAL|AMOUNT|合計|税込|合\s*計|總計|小計)[^\d]*([\d,]+\.?\d*)/i,
  /(?:total|amount)[:\s]*([\d,]+\.?\d*)/i,
];

const DATE_PATTERNS = [
  /(\d{4}[-\/]\d{2}[-\/]\d{2})/,
  /(\d{2}[-\/]\d{2}[-\/]\d{4})/,
  /(\d{4})年(\d{1,2})月(\d{1,2})日/,
];

// 用來判斷圖片是否像收據：出現這些關鍵字之一，或有金額+多筆品項行
const RECEIPT_KEYWORDS =
  /receipt|invoice|total|subtotal|收據|收据|發票|发票|小票|明細|明细|總計|总计|合計|合计|税込|稅|税|領収書|レシート/i;

// 品項行：「名稱 ... 價格」，價格在行尾
const ITEM_LINE_PATTERN =
  /^(.{1,40}?)[\s.．:：]{1,}[$¥￥]?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*$/;

// 總計/稅金/找零等彙總行，不當作品項
const ITEM_SKIP_PATTERN =
  /total|subtotal|amount|tax|change|cash|due|balance|合計|合计|總計|总计|小計|小计|稅|税|找零|現金|现金|应付|應付/i;

@Injectable({ providedIn: 'root' })
export class OcrService {
  private worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  // Tesseract worker 按需初始化（CDN 載入 WASM 語言包）
  private async getWorker() {
    if (!this.worker) {
      this.worker = await createWorker('eng+chi_tra', 1, {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/worker.min.js',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6/tesseract-core-simd.wasm.js',
      });
    }
    return this.worker;
  }

  async recognize(imageFile: File): Promise<OcrResult> {
    let rawText = '';
    try {
      const worker = await this.getWorker();
      const { data } = await worker.recognize(imageFile);
      rawText = data.text;
    } catch (err) {
      console.error('[OCR] recognize error', err);
      return { amount: null, date: null, items: [], isReceipt: false, rawText: '' };
    }

    const amount = this.extractAmount(rawText);
    const items = this.extractItems(rawText);

    return {
      amount,
      date: this.extractDate(rawText),
      items,
      isReceipt: this.looksLikeReceipt(rawText, amount, items),
      rawText,
    };
  }

  /** 判斷辨識結果是否像收據：命中關鍵字，或同時抓到金額與品項 */
  private looksLikeReceipt(text: string, amount: number | null, items: OcrItem[]): boolean {
    if (!text || text.trim().length < 6) return false;
    if (RECEIPT_KEYWORDS.test(text)) return true;
    return amount !== null && items.length > 0;
  }

  private extractItems(text: string): OcrItem[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const items: OcrItem[] = [];

    for (const line of lines) {
      if (ITEM_SKIP_PATTERN.test(line)) continue;
      const match = line.match(ITEM_LINE_PATTERN);
      if (!match) continue;

      const name = match[1].replace(/[.\-·・:：]+$/, '').trim();
      const price = parseFloat(match[2].replace(/,/g, ''));
      // 名稱需含至少一個非數字字元，避免把日期、電話等純數字行誤判為品項
      if (!name || !/[^\d\s]/.test(name) || isNaN(price) || price <= 0) continue;

      items.push({ name, price });
    }
    return items;
  }

  private extractAmount(text: string): number | null {
    for (const pattern of AMOUNT_PATTERNS) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const num = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(num)) return num;
      }
    }
    return null;
  }

  private extractDate(text: string): string | null {
    for (const pattern of DATE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        if (match[3]) {
          // 日文格式：YYYY年MM月DD日
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
        // DD/MM/YYYY → YYYY-MM-DD
        if (/^\d{2}/.test(match[1])) {
          const [d, m, y] = match[1].split(/[-\/]/);
          return `${y}-${m}-${d}`;
        }
        return match[1].replace(/\//g, '-');
      }
    }
    return null;
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
