/**
 * Biometric Service
 * Endpoints: /api/biometric/enroll, /api/biometric/verify, /api/biometric/match
 */
(function() {
  'use strict';
  const delay = (ms = 800) => new Promise(r => setTimeout(r, ms));

  async function verify(input) {
    await delay();
    // Simulate match: usually positive, occasionally needs second attempt
    const success = Math.random() > 0.15;
    if (!success) return { ok: false, reason: 'لم يتم التعرف، حاول مرة أخرى' };
    const applicant = window.MockData.applicants[Math.floor(Math.random() * 30)];
    return {
      ok: true,
      matchScore: 0.92 + Math.random() * 0.07,
      applicant: { id: applicant.id, name: applicant.name, nationalId: applicant.nationalId, photo: null },
      timestamp: Date.now(),
    };
  }

  async function enroll(applicantId, type) {
    await delay(500);
    return { ok: true, applicantId, type, enrolledAt: Date.now() };
  }

  window.BiometricService = { verify, enroll };
})();
