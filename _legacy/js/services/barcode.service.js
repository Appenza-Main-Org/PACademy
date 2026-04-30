/**
 * Barcode Service
 * Endpoints: /api/barcode/generate/:applicantId, /api/barcode/lookup
 */
(function() {
  'use strict';
  const delay = (ms = 100) => new Promise(r => setTimeout(r, ms));

  async function generate(applicantId) {
    await delay();
    return {
      applicantId,
      code: applicantId.replace('APP-', '') + Math.floor(Math.random() * 9000 + 1000),
      issuedAt: Date.now(),
      validUntil: Date.now() + 90 * 24 * 3600 * 1000,
    };
  }

  async function lookup(code) {
    await delay();
    const num = code.replace(/\D/g, '').slice(0, 7);
    const applicantId = `APP-${num}`;
    const a = window.MockData.applicants.find(x => x.id === applicantId);
    return a || null;
  }

  window.BarcodeService = { generate, lookup };
})();
