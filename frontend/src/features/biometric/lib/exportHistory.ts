/**
 * Real, client-side export of the biometric verification history from the data
 * already loaded on the page (the `/api/biometric/reports` +
 * `/api/biometric/verifications` responses) — no mock, no fake filename.
 *
 *   • excel → a real `.xlsx` workbook (summary + daily + verification log)
 *             via the shared `xlsx` helper.
 *   • word  → a real `.doc` (Word-compatible HTML blob) with the same content.
 *   • pdf   → the browser's native print-to-PDF over a formatted print view.
 *
 * Content reflects whatever filter is active on screen, because the caller
 * passes the already-filtered log rows.
 */

import { buildXlsxWorkbookBlob } from '@/shared/lib/xlsx';
import { downloadBlob } from '@/shared/lib/download';
import type { ExportFormat } from '../api/biometric.service';

export interface HistoryExportData {
  title: string;
  generatedAt: string;
  /** stable, filesystem-safe suffix for the download name */
  fileSlug: string;
  /** [label, value] KPI pairs */
  summary: ReadonlyArray<readonly [string, string]>;
  /** [day label, count] pairs for the daily breakdown */
  daily: ReadonlyArray<readonly [string, string]>;
  log: { headers: readonly string[]; rows: ReadonlyArray<readonly string[]> };
}

const WORD_MIME = 'application/msword';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

function buildReportHtml(data: HistoryExportData): string {
  const summaryRows = data.summary
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('');
  const dailyRows = data.daily
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join('');
  const logHead = data.log.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const logBody = data.log.rows.length
    ? data.log.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${data.log.headers.length}" style="text-align:center;color:#888">لا توجد عمليات</td></tr>`;

  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title>
<style>
  body{font-family:'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif;color:#0E0C07;padding:28px;direction:rtl}
  h1{font-size:20px;margin:0 0 4px}
  h2{font-size:14px;margin:20px 0 8px;color:#1A6868}
  .meta{color:#777;font-size:12px;margin-bottom:18px}
  table{border-collapse:collapse;width:100%;margin-bottom:8px;font-size:12px}
  th,td{border:1px solid #d8d4cc;padding:6px 9px;text-align:right;vertical-align:top}
  th{background:#f4f2ed;font-weight:700}
  @media print{body{padding:0}}
</style></head>
<body>
  <h1>${escapeHtml(data.title)}</h1>
  <div class="meta">${escapeHtml(data.generatedAt)}</div>
  <h2>الملخص</h2>
  <table>${summaryRows}</table>
  <h2>العمليات اليومية</h2>
  <table><tr><th>اليوم</th><th>عدد العمليات</th></tr>${dailyRows}</table>
  <h2>سجل التحقق</h2>
  <table><tr>${logHead}</tr>${logBody}</table>
</body></html>`;
}

/**
 * Produce and deliver the report in the requested format. Throws on a blocked
 * print popup (pdf) so the caller can surface a toast.
 */
export function exportBiometricHistory(format: ExportFormat, data: HistoryExportData): void {
  if (format === 'excel') {
    const blob = buildXlsxWorkbookBlob([
      {
        name: 'الملخص',
        headers: ['البند', 'القيمة'],
        rows: [...data.summary.map((s) => [...s]), [' ', ' '], ...data.daily.map((d) => [...d])],
      },
      { name: 'سجل التحقق', headers: data.log.headers, rows: data.log.rows.map((r) => [...r]) },
    ]);
    downloadBlob(blob, `biometric-report-${data.fileSlug}.xlsx`);
    return;
  }

  const html = buildReportHtml(data);

  if (format === 'word') {
    // Word opens HTML natively; the BOM + msword MIME make it a real .doc.
    downloadBlob(new Blob(['﻿', html], { type: WORD_MIME }), `biometric-report-${data.fileSlug}.doc`);
    return;
  }

  // pdf → native print dialog (Save as PDF). No PDF lib in the bundle by design.
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) throw new Error('POPUP_BLOCKED');
  win.document.write(html);
  win.document.close();
  win.focus();
  // Let layout settle before invoking print.
  window.setTimeout(() => win.print(), 300);
}
