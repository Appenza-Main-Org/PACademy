/**
 * Build the v2 Excel template that admins fill out before uploading
 * through the import wizard. The headers match the auto-mapping synonym
 * list in `targetFields.ts` so a downloaded → filled → re-uploaded file
 * walks every wizard step without a single manual column pick.
 *
 *   Sheet 1: "درجات المتقدمين" — header row + one realistic example row.
 *     Headers (column order, Arabic, bold + frozen):
 *       الرقم القومي · رقم الجلوس · الاسم باللغة العربية · النوع ·
 *       الشعبة · سنة التخرج · المجموع الكلي · الدرجة العظمى
 *   Sheet 2: "الإرشادات" (hidden) — accepted max-grade values, accepted
 *     `الشعبة` values, duplicate-handling rule.
 *
 * The first header's cell comment carries `TEMPLATE_VERSION` so older
 * templates can be detected later. The xlsx package is lazy-loaded so
 * this doesn't bloat the main bundle.
 */

import { downloadBlob } from '@/shared/lib/download';
import type * as XLSXType from 'xlsx';

/** Bump this when the template's column set or order changes. */
export const TEMPLATE_VERSION = '2026-05-A';

export const TEMPLATE_FILENAME = 'applicant-grades-template.xlsx';

export const TEMPLATE_HEADERS = [
  'الرقم القومي',
  'رقم الجلوس',
  'الاسم باللغة العربية',
  'النوع',
  'الشعبة',
  'سنة التخرج',
  'فئة المدرسة',
  'المجموع الكلي',
  'الدرجة العظمى',
] as const;

const EXAMPLE_ROW = [
  '30412180103456',
  '142018',
  'أحمد محمد إبراهيم سعد',
  'ذكر',
  'علمي علوم',
  '٢٠٢٦',
  'الثانوية العامة',
  '392',
  '410',
];

const INSTRUCTIONS_AOA = [
  ['إرشادات تعبئة نموذج درجات المتقدمين'],
  [],
  ['• تطابق رؤوس الأعمدة مع النموذج لضمان نجاح الاستيراد بدون خطوة ربط الأعمدة.'],
  ['• الرقم القومي: 14 رقمًا — تُقبَل الأرقام العربية الشرقية والإنجليزية على حدٍّ سواء.'],
  ['• الدرجة العظمى المقبولة: 410 (ثانوية عامة) أو 510 (ثانوية أزهرية).'],
  ['• قيم الشعبة المقبولة: علمي علوم · علمي رياضة · أدبي · أزهري علمي · أزهري أدبي.'],
  ['• فئة المدرسة (اختياري): الثانوية العامة · الثانوية الأزهرية · الشهادة الثانوية من الخارج · الدبلومات الأجنبية · مدارس المتفوقين في العلوم والتكنولوجيا STEM — يطابق قائمة فئة المدرسة في الإعدادات.'],
  ['• الصفوف ذات الأرقام القومية المكررة تظهر في خطوة المراجعة قبل الكتابة.'],
  ['• الصيغ المقبولة للملف: .xlsx · .xls · .csv · .mdb · .accdb'],
  [],
  [`إصدار النموذج: ${TEMPLATE_VERSION}`],
];

export async function buildTemplateWorkbookBlob(): Promise<Blob> {
  const XLSX = (await import('xlsx')) as typeof XLSXType;
  const aoa: unknown[][] = [
    [...TEMPLATE_HEADERS],
    EXAMPLE_ROW,
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  /* Stamp the template version into the first header cell's comment.
   * The cell may not exist yet if XLSX.utils.aoa_to_sheet skipped it
   * (it shouldn't, but guard regardless). */
  const cell = sheet['A1'];
  if (cell) {
    cell.c = [
      { a: 'template-version', t: `template-version=${TEMPLATE_VERSION}` },
    ];
  }

  /* Freeze the header row + auto-widen the columns generously enough
   * that the Arabic labels render without truncation in Excel. */
  sheet['!freeze'] = { ySplit: 1 };
  sheet['!cols'] = TEMPLATE_HEADERS.map((h) => ({
    wch: Math.max(18, h.length + 4),
  }));

  /* Make row 1 bold by writing inline cell styles. SheetJS open-source
   * doesn't fully support styling, but freeze + comment + column width
   * survive a round-trip through Excel. */

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'درجات المتقدمين');

  const instructions = XLSX.utils.aoa_to_sheet(INSTRUCTIONS_AOA);
  instructions['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, instructions, 'الإرشادات');
  /* Hide the instructions sheet so admins land on the data sheet. */
  if (wb.Workbook == null) wb.Workbook = { Sheets: [] };
  if (wb.Workbook.Sheets == null) wb.Workbook.Sheets = [];
  wb.Workbook.Sheets[0] = { Hidden: 0 };
  wb.Workbook.Sheets[1] = { Hidden: 1 };

  const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([bin], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function downloadTemplateWorkbook(): Promise<void> {
  const blob = await buildTemplateWorkbookBlob();
  downloadBlob(blob, TEMPLATE_FILENAME);
}
