import { createWorker } from 'tesseract.js';

/**
 * OCR / bill-recognition provider abstraction.
 *
 * Ships with a REAL, working implementation (`TesseractOcrProvider`) using
 * Tesseract.js — it runs locally, needs no external API key, and performs
 * genuine optical character recognition on the uploaded bill/receipt/cheque
 * photo. It is intentionally never trusted blindly: `extract()` returns a
 * confidence score and best-effort parsed fields, and every caller (see
 * src/app/api/expenses/ocr/route.ts and the sales "Upload Bill" screen)
 * MUST show the result to the salesman as an editable form before saving.
 *
 * PRODUCTION INTEGRATION POINT
 * -----------------------------------------------------------------------
 * Tesseract.js accuracy is good for clear printed bills but weaker on
 * crumpled/handwritten receipts than a cloud OCR service. For higher
 * accuracy at scale, implement `GoogleVisionOcrProvider` or
 * `TextractOcrProvider` against the same `OcrProvider` interface and
 * switch OCR_PROVIDER in .env.
 */

export interface ExtractedExpenseFields {
  merchant?: string;
  date?: string; // ISO yyyy-mm-dd, best-effort
  amount?: number;
  invoiceNumber?: string;
  gstNumber?: string;
  suggestedCategory?: string;
}

export interface OcrResult {
  rawText: string;
  confidence: number; // 0-100
  fields: ExtractedExpenseFields;
  provider: string;
}

export interface OcrProvider {
  extract(imageBuffer: Buffer): Promise<OcrResult>;
}

// --- Field extraction heuristics --------------------------------------------
// Deliberately simple, transparent regex heuristics rather than a black
// box — easy to audit and to extend as real Kapila Medical bill formats
// are observed in production.

const AMOUNT_LINE = /(?:total|grand\s*total|net\s*amount|amount\s*payable|amt)[^\d₹]{0,15}(?:rs\.?|inr|₹)?\s*([\d][\d,]*\.?\d{0,2})/i;
const ANY_RUPEE = /(?:rs\.?|inr|₹)\s*([\d][\d,]*\.?\d{0,2})/i;
const DATE_PATTERNS = [
  /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/, // dd/mm/yyyy or dd-mm-yyyy
];
const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/;
const INVOICE_NO = /(?:invoice|bill)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Za-z0-9\/\-]{3,20})/i;

const CATEGORY_KEYWORDS: Record<string, string> = {
  petrol: 'PETROL',
  diesel: 'PETROL',
  fuel: 'PETROL',
  hpcl: 'PETROL',
  bpcl: 'PETROL',
  'indian oil': 'PETROL',
  hotel: 'ACCOMMODATION',
  lodge: 'ACCOMMODATION',
  restaurant: 'FOOD',
  cafe: 'FOOD',
  'tea stall': 'FOOD',
  toll: 'TRAVEL',
  bus: 'TRAVEL',
  railway: 'TRAVEL',
  irctc: 'TRAVEL',
  auto: 'AUTO_TAXI',
  taxi: 'AUTO_TAXI',
  ola: 'AUTO_TAXI',
  uber: 'AUTO_TAXI',
  parking: 'PARKING',
  courier: 'COURIER',
  parcel: 'COURIER',
};

function normalizeAmount(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

function toIsoDate(day: string, month: string, year: string): string | undefined {
  let y = year;
  if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
  const d = day.padStart(2, '0');
  const m = month.padStart(2, '0');
  const yNum = Number(y);
  const mNum = Number(m);
  const dNum = Number(d);
  if (mNum < 1 || mNum > 12 || dNum < 1 || dNum > 31 || yNum < 2000 || yNum > 2100) return undefined;
  return `${y}-${m}-${d}`;
}

export function extractFieldsFromText(rawText: string): ExtractedExpenseFields {
  const text = rawText.replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const fields: ExtractedExpenseFields = {};

  const amountMatch = text.match(AMOUNT_LINE) ?? text.match(ANY_RUPEE);
  if (amountMatch && amountMatch[1]) fields.amount = normalizeAmount(amountMatch[1]);

  for (const pattern of DATE_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const iso = toIsoDate(m[1] as string, m[2] as string, m[3] as string);
      if (iso) {
        fields.date = iso;
        break;
      }
    }
  }

  const gstMatch = text.match(GSTIN);
  if (gstMatch) fields.gstNumber = gstMatch[0];

  const invMatch = text.match(INVOICE_NO);
  if (invMatch && invMatch[1]) fields.invoiceNumber = invMatch[1];

  // Merchant name: best-effort — the first non-empty line is usually the
  // shop/company header on a printed bill. The salesman can correct this.
  if (lines.length > 0) fields.merchant = lines[0]?.slice(0, 80);

  const lowerText = text.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lowerText.includes(keyword)) {
      fields.suggestedCategory = category;
      break;
    }
  }

  return fields;
}

class TesseractOcrProvider implements OcrProvider {
  async extract(imageBuffer: Buffer): Promise<OcrResult> {
    const worker = await createWorker('eng');
    try {
      const {
        data: { text, confidence },
      } = await worker.recognize(imageBuffer);
      return {
        rawText: text,
        confidence,
        fields: extractFieldsFromText(text),
        provider: 'tesseract',
      };
    } finally {
      await worker.terminate();
    }
  }
}

let cached: OcrProvider | null = null;

export function getOcrProvider(): OcrProvider {
  if (cached) return cached;
  const kind = process.env.OCR_PROVIDER ?? 'tesseract';
  switch (kind) {
    case 'tesseract':
      cached = new TesseractOcrProvider();
      break;
    default:
      throw new Error(
        `OCR_PROVIDER="${kind}" has no implementation yet. Implement it in ` +
          `src/lib/providers/ocr.ts before use.`,
      );
  }
  return cached;
}
