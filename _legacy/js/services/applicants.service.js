/**
 * Applicants Service
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/applicants?page=&search=&status=&governorate=&certType=
 *   GET    /api/applicants/:id
 *   POST   /api/applicants               (create — applicant self-registration)
 *   PUT    /api/applicants/:id           (admin update)
 *   POST   /api/applicants/:id/stage     (advance stage)
 *   POST   /api/applicants/:id/payment   (record payment)
 *   GET    /api/applicants/:id/timeline  (full audit timeline)
 *   GET    /api/applicants/stats        (aggregated KPIs)
 */
(function() {
  'use strict';

  function delay(ms = 200) { return new Promise(r => setTimeout(r, ms)); }

  async function list(filters = {}) {
    await delay();
    let result = [...window.MockData.applicants];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.nationalId.includes(q)
      );
    }
    if (filters.status) result = result.filter(a => a.status === filters.status);
    if (filters.governorate) result = result.filter(a => a.governorate === filters.governorate);
    if (filters.certType) result = result.filter(a => a.certType === filters.certType);
    if (filters.committee) result = result.filter(a => a.committee === filters.committee);
    if (filters.gender) result = result.filter(a => a.gender === filters.gender);

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const total = result.length;
    const data = result.slice((page - 1) * pageSize, page * pageSize);

    return { data, total, page, pageSize };
  }

  async function getById(id) {
    await delay();
    return window.MockData.applicants.find(a => a.id === id) || null;
  }

  async function getStats() {
    await delay();
    return window.MockData.kpis;
  }

  async function getTimeline(id) {
    await delay();
    const a = await getById(id);
    if (!a) return [];
    // Generate a plausible timeline
    const events = [];
    const base = new Date(a.registeredAt).getTime();
    events.push({
      ts: base, type: 'registration',
      icon: '📝', title: 'تسجيل أولي',
      detail: 'بدء عملية التقدم على الإنترنت',
      color: 'info',
    });
    if (a.paymentStatus === 'paid') {
      events.push({
        ts: base + 24 * 3600 * 1000, type: 'payment',
        icon: '💳', title: 'سداد رسوم التقدم',
        detail: `تم سداد ${a.paymentAmount} جنيه إلكترونياً`,
        color: 'success',
      });
    }
    if (a.stage >= 2) {
      events.push({
        ts: base + 2 * 24 * 3600 * 1000, type: 'family',
        icon: '👥', title: 'إدراج بيانات الأسرة',
        detail: `تم إدراج بيانات ${a.familySize} من أفراد الأسرة`,
        color: 'info',
      });
    }
    if (a.stage >= 4) {
      events.push({
        ts: base + 4 * 24 * 3600 * 1000, type: 'appointment',
        icon: '📅', title: 'تحديد موعد الاختبار الأول',
        detail: 'موعد القومسيون الطبي',
        color: 'info',
      });
    }
    if (a.results.medical) {
      events.push({
        ts: base + 7 * 24 * 3600 * 1000, type: 'medical',
        icon: '🩺', title: 'اختبار القومسيون الطبي',
        detail: a.results.medical === 'pass' ? 'اجتياز الاختبار الطبي' : 'عدم اجتياز الاختبار الطبي',
        color: a.results.medical === 'pass' ? 'success' : 'danger',
      });
    }
    if (a.investigation === 'cleared') {
      events.push({
        ts: base + 10 * 24 * 3600 * 1000, type: 'investigation',
        icon: '✓', title: 'انتهاء التحريات',
        detail: 'الموافقة على المتقدم',
        color: 'success',
      });
    }
    return events.sort((x, y) => y.ts - x.ts);
  }

  async function getDistribution(field) {
    await delay();
    const items = window.MockData.applicants;
    const counts = {};
    items.forEach(a => {
      const k = a[field] || 'غير محدد';
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  window.ApplicantsService = {
    list,
    getById,
    getStats,
    getTimeline,
    getDistribution,
  };
})();
