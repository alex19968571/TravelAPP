import { Injectable } from '@angular/core';
import { createWorker } from 'tesseract.js';

export interface OcrResult {
  amount: number | null;
  date: string | null;
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
      return { amount: null, date: null, rawText: '' };
    }

    return {
      amount: this.extractAmount(rawText),
      date: this.extractDate(rawText),
      rawText,
    };
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
