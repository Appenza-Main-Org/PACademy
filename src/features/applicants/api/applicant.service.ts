/**
 * Applicants API Contract
 *
 * REAL ENDPOINTS:
 *   GET    /api/applicants?page=&search=&status=&governorate=&certType=
 *   GET    /api/applicants/:id
 *   GET    /api/applicants/:id/timeline
 *   GET    /api/applicants/stats
 */

import { MOCK } from '@/shared/mock-data';
import { paginate, simulateLatency } from '@/shared/lib/mock-helpers';
import { normalizeArabic } from '@/shared/lib/arabic';
import type { Applicant, ApplicantStatus, Kpis, TimelineEvent } from '@/shared/types/domain';
import type { Pagination } from '@/shared/types/api';

export interface ApplicantFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ApplicantStatus | 'all';
  governorate?: string | 'all';
  certType?: string | 'all';
}

export const applicantService = {
  async list(filters: ApplicantFilters = {}): Promise<Pagination<Applicant>> {
    await simulateLatency();
    const { page = 1, pageSize = 20, search = '', status = 'all', governorate = 'all', certType = 'all' } = filters;
    const needle = normalizeArabic(search);
    let items = MOCK.applicants;
    if (status !== 'all') items = items.filter((a) => a.status === status);
    if (governorate !== 'all') items = items.filter((a) => a.governorate === governorate);
    if (certType !== 'all') items = items.filter((a) => a.certType === certType);
    if (needle) {
      items = items.filter(
        (a) =>
          normalizeArabic(a.name).includes(needle) ||
          a.id.toLowerCase().includes(needle) ||
          a.nationalId.includes(needle),
      );
    }
    return paginate(items, page, pageSize);
  },

  async getById(id: string): Promise<Applicant | null> {
    await simulateLatency();
    return MOCK.applicants.find((a) => a.id === id) ?? null;
  },

  async getStats(): Promise<Kpis> {
    await simulateLatency();
    return MOCK.kpis;
  },

  async getTimeline(id: string): Promise<TimelineEvent[]> {
    await simulateLatency();
    const a = MOCK.applicants.find((x) => x.id === id);
    if (!a) return [];
    const baseTs = new Date(a.registeredAt).getTime();
    const day = 86_400_000;
    const events: TimelineEvent[] = [
      { ts: baseTs, type: 'registration', icon: '📝', title: 'تسجيل أولي', detail: 'تم استلام طلب التقديم على البوابة الرقمية', color: 'info' },
    ];
    if (a.paymentStatus === 'paid') {
      events.push({ ts: baseTs + 1 * day, type: 'payment', icon: '💳', title: 'سداد رسوم التقديم', detail: `تم سداد ${a.paymentAmount} جنيه`, color: 'success' });
    }
    if (a.hasDocuments) {
      events.push({ ts: baseTs + 2 * day, type: 'document', icon: '📎', title: 'استكمال المستندات', detail: 'تم رفع كافة المستندات المطلوبة', color: 'success' });
    }
    if (a.results.medical) {
      events.push({ ts: baseTs + 3 * day, type: 'medical', icon: '🩺', title: 'الكشف الطبي', detail: a.results.medical === 'pass' ? 'لائق طبياً' : 'غير لائق', color: a.results.medical === 'pass' ? 'success' : 'danger' });
    }
    if (a.results.fitness) {
      events.push({ ts: baseTs + 4 * day, type: 'fitness', icon: '🏃', title: 'اختبار اللياقة البدنية', detail: a.results.fitness === 'pass' ? 'اجتاز اختبار اللياقة' : 'لم يجتز', color: a.results.fitness === 'pass' ? 'success' : 'danger' });
    }
    if (a.investigation !== 'pending') {
      events.push({
        ts: baseTs + 5 * day,
        type: 'committee',
        icon: '🔍',
        title: 'نتيجة التحريات',
        detail: a.investigation === 'cleared' ? 'تم الإفراج عن السجل' : 'تم إيقاف الإجراءات',
        color: a.investigation === 'cleared' ? 'success' : 'danger',
      });
    }
    if (a.results.interview) {
      events.push({ ts: baseTs + 6 * day, type: 'interview', icon: '🎤', title: 'المقابلة الشخصية', detail: a.results.interview === 'pass' ? 'تم القبول' : 'لم يتم القبول', color: a.results.interview === 'pass' ? 'success' : 'danger' });
    }
    if (a.results.finalExam) {
      events.push({ ts: baseTs + 7 * day, type: 'exam', icon: '📋', title: 'الاختبار النهائي', detail: `النتيجة: ${a.results.finalExam === 'pass' ? 'ناجح' : 'راسب'}`, color: a.results.finalExam === 'pass' ? 'success' : 'danger' });
    }
    return events.sort((a, b) => b.ts - a.ts);
  },

  async getDistribution(field: 'governorate' | 'certType' | 'status'): Promise<Array<{ label: string; value: number }>> {
    await simulateLatency();
    const counts = new Map<string, number>();
    for (const a of MOCK.applicants) {
      const key = String(a[field]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  },
};
