/**
 * Reports API Contract — Sprint 1 (KARASA_GAPS §1.2.F).
 *
 * INTEGRATION CONTRACT:
 *   GET /api/reports/:templateKey?cycleId=    → ReportDocument
 *   GET /api/reports/:templateKey/export?format=csv|pdf|docx&cycleId=
 *
 * Demo computes report rows on the fly from MOCK; real backend will
 * pre-aggregate and stream the response. Browser-side print covers the
 * PDF case via PrintLayout; CSV/RTF stubs cover Excel/Word until the
 * heavy xlsx/docx libraries are added in Sprint 10 hardening.
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { ReportDocument, ReportTemplateKey } from '@/shared/types/domain';

export const REPORT_TEMPLATE_LABELS: Record<ReportTemplateKey, string> = {
  'applicants-by-status':       'المتقدمون حسب الحالة',
  'applicants-by-governorate':  'المتقدمون حسب المحافظة',
  'applicants-by-certificate':  'المتقدمون حسب الشهادة',
  'rejections-with-reasons':    'الرفضات وأسبابها',
  'medical-results-summary':    'ملخّص نتائج القومسيون الطبي',
  'exam-pass-rates':            'معدّلات نجاح الاختبارات',
  'investigation-status':       'حالة التحريات',
  'cycle-summary':              'ملخّص الدورة الكامل',
  'audit-export':               'سجل العمليات (Audit)',
};

export const reportsService = {
  async generate(templateKey: ReportTemplateKey, cycleId: string | null = null): Promise<ReportDocument> {
    await simulateLatency(400, 800);
    const generatedAt = new Date().toISOString();
    return {
      key: templateKey,
      title: REPORT_TEMPLATE_LABELS[templateKey],
      generatedAt,
      cycleId,
      rows: buildRows(templateKey),
    };
  },

  /** Generate a printable PDF by triggering the browser print dialog over a PrintLayout-wrapped page. */
  async exportPdf(): Promise<void> {
    await simulateLatency(120, 220);
    if (typeof window !== 'undefined') window.print();
  },

  /** Generate an Excel-compatible CSV (UTF-8 BOM). */
  async exportCsv(templateKey: ReportTemplateKey, cycleId: string | null = null): Promise<Blob> {
    const doc = await reportsService.generate(templateKey, cycleId);
    const header = ['label', 'value', 'secondary'];
    const rows = doc.rows.map((r) => [escape(r.label), escape(String(r.value)), escape(r.secondary ?? '')]);
    const body = '﻿' + [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    return new Blob([body], { type: 'text/csv;charset=utf-8' });
  },

  /** Stub Word export — produces an RTF file Word opens cleanly in lieu of docx. */
  async exportRtf(templateKey: ReportTemplateKey, cycleId: string | null = null): Promise<Blob> {
    const doc = await reportsService.generate(templateKey, cycleId);
    const lines = [
      `\\par {\\b ${doc.title}}\\par`,
      `\\par {\\i تاريخ الإصدار: ${doc.generatedAt}}\\par`,
      ...doc.rows.map((r) => `\\par ${r.label}: ${r.value}${r.secondary ? ` (${r.secondary})` : ''}\\par`),
    ];
    const body = `{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}\\f0\\fs24 ${lines.join('')}}`;
    return new Blob([body], { type: 'application/rtf' });
  },
};

function buildRows(key: ReportTemplateKey): { label: string; value: number | string; secondary?: string }[] {
  const k = MOCK.kpis;
  if (key === 'applicants-by-status') {
    return [
      { label: 'في الانتظار',        value: k.pending },
      { label: 'قيد المراجعة',       value: k.underReview },
      { label: 'مقبول',              value: k.approved, secondary: pct(k.approved, k.totalApplicants) },
      { label: 'مرفوض',              value: k.rejected, secondary: pct(k.rejected, k.totalApplicants) },
    ];
  }
  if (key === 'applicants-by-governorate') {
    const map = new Map<string, number>();
    for (const a of MOCK.applicants) map.set(a.governorate, (map.get(a.governorate) ?? 0) + 1);
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label, value]) => ({ label, value, secondary: pct(value, MOCK.applicants.length) }));
  }
  if (key === 'applicants-by-certificate') {
    return Object.entries(MOCK.kpis.byCertType)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, secondary: pct(value, MOCK.applicants.length) }));
  }
  if (key === 'rejections-with-reasons') {
    return [
      { label: 'عدم استيفاء الشروط الطبية',        value: 42 },
      { label: 'عدم اجتياز الاختبار البدني',         value: 28 },
      { label: 'بيانات تحريات غير ملائمة',           value: 19 },
      { label: 'عدم استكمال المستندات',              value: 11 },
      { label: 'عدم اجتياز المقابلة الشخصية',         value: 8 },
    ];
  }
  if (key === 'medical-results-summary') {
    const passed = MOCK.applicants.filter((a) => a.results.medical === 'pass').length;
    const failed = MOCK.applicants.filter((a) => a.results.medical === 'fail').length;
    return [
      { label: 'لائق طبياً',  value: passed },
      { label: 'غير لائق',   value: failed },
      { label: 'لم يُفحص بعد', value: MOCK.applicants.length - passed - failed },
    ];
  }
  if (key === 'exam-pass-rates') {
    const passed = MOCK.applicants.filter((a) => a.results.finalExam === 'pass').length;
    const failed = MOCK.applicants.filter((a) => a.results.finalExam === 'fail').length;
    return [
      { label: 'ناجح',  value: passed, secondary: pct(passed, passed + failed) },
      { label: 'راسب',  value: failed, secondary: pct(failed, passed + failed) },
    ];
  }
  if (key === 'investigation-status') {
    const cleared = MOCK.applicants.filter((a) => a.investigation === 'cleared').length;
    const flagged = MOCK.applicants.filter((a) => a.investigation === 'flagged').length;
    const pending = MOCK.applicants.filter((a) => a.investigation === 'pending').length;
    return [
      { label: 'تم الإفراج', value: cleared },
      { label: 'تم الإيقاف', value: flagged },
      { label: 'قيد الفحص',  value: pending },
    ];
  }
  if (key === 'cycle-summary') {
    return [
      { label: 'إجمالي المتقدمين',     value: MOCK.kpis.totalApplicants },
      { label: 'مدفوع الرسوم',         value: MOCK.kpis.paidApplicants },
      { label: 'تم القبول',              value: MOCK.kpis.approved },
      { label: 'تم الرفض',              value: MOCK.kpis.rejected },
      { label: 'قيد المراجعة',         value: MOCK.kpis.underReview },
      { label: 'في الانتظار',          value: MOCK.kpis.pending },
    ];
  }
  /* audit-export */
  return MOCK.audit.slice(0, 50).map((e) => ({
    label: `${e.userName} · ${e.actionLabel}`,
    value: e.entityId,
    secondary: new Date(e.timestamp).toLocaleString('ar-EG'),
  }));
}

function pct(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function escape(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}
