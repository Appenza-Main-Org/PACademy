/**
 * Investigations Service
 * Endpoints: /api/investigations, /api/investigations/:id/cases
 */
(function() {
  'use strict';
  const delay = (ms = 150) => new Promise(r => setTimeout(r, ms));

  async function getCases(filters = {}) {
    await delay();
    return window.MockData.applicants
      .filter(a => filters.status ? a.investigation === filters.status : true)
      .slice(0, 60)
      .map(a => ({
        applicantId: a.id,
        applicantName: a.name,
        nationalId: a.nationalId,
        governorate: a.governorate,
        status: a.investigation,
        sentAt: new Date(Date.now() - Math.random() * 30 * 24 * 3600 * 1000).toISOString(),
        receivedAt: a.investigation !== 'pending'
          ? new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000).toISOString()
          : null,
        officer: 'النقيب يوسف أحمد المصري',
      }));
  }

  async function getStats() {
    await delay();
    const cases = await getCases();
    return {
      total: cases.length,
      pending: cases.filter(c => c.status === 'pending').length,
      cleared: cases.filter(c => c.status === 'cleared').length,
      flagged: cases.filter(c => c.status === 'flagged').length,
    };
  }

  window.InvestigationsService = { getCases, getStats };
})();
