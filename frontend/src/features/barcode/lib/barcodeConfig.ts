/**
 * Barcode card configuration model (US-BC-008/009/010).
 *
 * Every option set here is config-driven data (catalogs), never an inline
 * enum in a page — the College System Administrator edits a `BarcodeConfig`
 * value whose option universes are the exported catalogs below. The card
 * preview always renders through the shared `Code128Barcode` regardless of
 * the configured symbology (the mock renderer is linear Code 128; the
 * on-prem backend honours the stored symbology).
 *
 * INTEGRATION NOTE: on the backend these catalogs become lookups
 * (barcode-symbologies, barcode-label-sizes, barcode-content-fields) and the
 * config a singleton row per cycle.
 */

/* ── Format (US-BC-008) ─────────────────────────────────────────────── */

export type BarcodeSymbology = 'code128' | 'code39' | 'qr' | 'datamatrix';

export interface CatalogOption {
  value: string;
  label: string;
}

export const BARCODE_SYMBOLOGIES: readonly CatalogOption[] = [
  { value: 'code128', label: 'Code 128' },
  { value: 'code39', label: 'Code 39' },
  { value: 'qr', label: 'QR Code' },
  { value: 'datamatrix', label: 'Data Matrix' },
];

export interface BarcodeFormatConfig {
  symbology: BarcodeSymbology;
  /** Narrowest bar/module width in px (1.0–3.0). */
  moduleWidth: number;
  /** Symbol height in px (32–96). */
  heightPx: number;
  /** Render the human-readable code beneath the symbol. */
  showText: boolean;
}

/* ── Content (US-BC-009) ────────────────────────────────────────────── */

/** A configurable field on the printed card. `visible` toggles whether it
 *  prints; `adminHidden` marks a field that is retained internally but
 *  never printed (e.g. the full National ID), overriding `visible`. */
export interface BarcodeContentField {
  key: string;
  labelAr: string;
  visible: boolean;
  adminHidden: boolean;
}

/** Default field catalog — Arabic labels copied verbatim from the card. */
export const DEFAULT_CONTENT_FIELDS: readonly BarcodeContentField[] = [
  { key: 'photo', labelAr: 'الصورة', visible: true, adminHidden: false },
  { key: 'name', labelAr: 'الاسم', visible: true, adminHidden: false },
  { key: 'applicantId', labelAr: 'رقم الطلب', visible: true, adminHidden: false },
  { key: 'nationalId', labelAr: 'الرقم القومي', visible: false, adminHidden: true },
  { key: 'governorate', labelAr: 'المحافظة', visible: true, adminHidden: false },
  { key: 'committee', labelAr: 'اللجنة', visible: true, adminHidden: false },
  { key: 'category', labelAr: 'الفئة', visible: false, adminHidden: false },
  { key: 'qualification', labelAr: 'المؤهل', visible: false, adminHidden: false },
  { key: 'validUntil', labelAr: 'صالح حتى', visible: true, adminHidden: false },
];

/* ── Layout (US-BC-010) ─────────────────────────────────────────────── */

export type LayoutOrientation = 'vertical' | 'horizontal';
export type PrinterType = 'label' | 'standard';

export const LAYOUT_ORIENTATIONS: readonly CatalogOption[] = [
  { value: 'vertical', label: 'رأسي' },
  { value: 'horizontal', label: 'أفقي' },
];

export const PRINTER_TYPES: readonly CatalogOption[] = [
  { value: 'label', label: 'طابعة ملصقات' },
  { value: 'standard', label: 'طابعة عادية (A4)' },
];

export interface BarcodeLabelSize {
  code: string;
  labelAr: string;
  widthMm: number;
  heightMm: number;
}

export const BARCODE_LABEL_SIZES: readonly BarcodeLabelSize[] = [
  { code: 'L-58x40', labelAr: 'ملصق 58×40 مم', widthMm: 58, heightMm: 40 },
  { code: 'L-100x50', labelAr: 'ملصق 100×50 مم', widthMm: 100, heightMm: 50 },
  { code: 'L-80x50', labelAr: 'ملصق 80×50 مم', widthMm: 80, heightMm: 50 },
  { code: 'A4-card', labelAr: 'بطاقة ضمن صفحة A4 (40/صفحة)', widthMm: 52, heightMm: 74 },
];

export interface BarcodeLayoutConfig {
  orientation: LayoutOrientation;
  printerType: PrinterType;
  /** FK → BARCODE_LABEL_SIZES.code. */
  labelSizeCode: string;
}

/* ── Composite ──────────────────────────────────────────────────────── */

export interface BarcodeConfig {
  format: BarcodeFormatConfig;
  content: BarcodeContentField[];
  layout: BarcodeLayoutConfig;
}

export const DEFAULT_BARCODE_CONFIG: BarcodeConfig = {
  format: { symbology: 'code128', moduleWidth: 1.4, heightPx: 56, showText: false },
  content: DEFAULT_CONTENT_FIELDS.map((f) => ({ ...f })),
  layout: { orientation: 'vertical', printerType: 'label', labelSizeCode: 'L-58x40' },
};

export function labelSizeByCode(code: string): BarcodeLabelSize | undefined {
  return BARCODE_LABEL_SIZES.find((s) => s.code === code);
}

/** Fields that actually print on a card given a config (visible & not
 *  admin-hidden). */
export function printableFields(config: BarcodeConfig): BarcodeContentField[] {
  return config.content.filter((f) => f.visible && !f.adminHidden);
}
