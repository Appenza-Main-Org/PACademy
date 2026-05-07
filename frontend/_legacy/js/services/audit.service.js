/**
 * Audit Trail Service
 * Endpoints: /api/audit
 */
(function() {
  'use strict';
  const delay = (ms = 150) => new Promise(r => setTimeout(r, ms));

  async function list(filters = {}) {
    await delay();
    let items = [...window.MockData.audit];
    if (filters.userId) items = items.filter(x => x.userId === filters.userId);
    if (filters.action) items = items.filter(x => x.action === filters.action);
    return items.slice(0, filters.limit || 50);
  }

  window.AuditService = { list };
})();
