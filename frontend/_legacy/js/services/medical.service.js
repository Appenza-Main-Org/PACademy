/**
 * Medical Commission Service
 * Endpoints: /api/medical/stations, /api/medical/queue, /api/medical/results
 */
(function() {
  'use strict';
  const delay = (ms = 150) => new Promise(r => setTimeout(r, ms));
  async function getStations() { await delay(); return window.MockData.medicalStations; }
  async function getQueue(stationId) {
    await delay();
    const station = window.MockData.medicalStations.find(s => s.id === stationId);
    if (!station) return [];
    return window.MockData.applicants.slice(0, station.queue).map(a => ({
      ...a,
      orderNumber: Math.floor(Math.random() * 100) + 1,
    }));
  }
  async function recordResult(applicantId, stationId, result) {
    await delay(300);
    return { ok: true, applicantId, stationId, result, timestamp: Date.now() };
  }
  window.MedicalService = { getStations, getQueue, recordResult };
})();
