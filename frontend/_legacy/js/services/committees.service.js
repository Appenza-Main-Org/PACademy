/**
 * Committees Service
 * Endpoints: /api/committees, /api/committees/:id/applicants
 */
(function() {
  'use strict';
  const delay = (ms = 150) => new Promise(r => setTimeout(r, ms));
  async function list() { await delay(); return window.MockData.committees; }
  async function getById(id) {
    await delay();
    return window.MockData.committees.find(c => c.id === id);
  }
  async function getApplicantsForCommittee(name) {
    await delay();
    return window.MockData.applicants.filter(a => a.committee === name).slice(0, 50);
  }
  window.CommitteesService = { list, getById, getApplicantsForCommittee };
})();
