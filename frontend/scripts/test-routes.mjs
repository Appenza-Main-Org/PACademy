#!/usr/bin/env node
/**
 * test-routes.mjs — verifies every route returns 200 + a real SPA shell.
 *
 * Use cases:
 *   1. After deploy: confirm Vercel's SPA rewrite catches direct-URL hits
 *      (the /board/members → 404 NOT_FOUND class of bug).
 *   2. Locally: confirm vite dev's HTML5-history-fallback is wired.
 *
 * Usage:
 *   node scripts/test-routes.mjs                  # against http://localhost:5173
 *   node scripts/test-routes.mjs https://pa-cademy.vercel.app
 */

const BASE = (process.argv[2] ?? 'http://localhost:5173').replace(/\/+$/, '');

const ROUTES = [
  // Public
  '/', '/apply', '/staff-login', '/login', '/terms', '/help',
  // Staff hub + admin
  '/hub', '/architecture', '/profile',
  '/admin', '/admin/applicants', '/admin/applicants/APP-2026000001',
  '/admin/users', '/admin/audit', '/admin/settings', '/admin/reports',
  '/admin/reference-data', '/admin/admission-rules', '/admin/cycles',
  '/admin/cycles/CYC-2025-M', '/admin/committees',
  // Committees
  '/committee', '/committee/list', '/committee/schedule', '/committee/create', '/committee/C-01',
  // Board
  '/board', '/board/sessions', '/board/sessions/create', '/board/sessions/SES-0001/live',
  '/board/decisions', '/board/members',
  // Investigations
  '/investigations', '/investigations/incoming', '/investigations/outgoing',
  '/investigations/create', '/investigations/cases/CASE-00001', '/investigations/distribution',
  // Medical
  '/medical', '/medical/queue', '/medical/results',
  '/medical/station/bmi', '/medical/station/eye', '/medical/certificate',
  // Barcode
  '/barcode', '/barcode/lookup', '/barcode/batch', '/barcode/scan', '/barcode/replace', '/barcode/scans',
  // Biometric
  '/biometric', '/biometric/enroll', '/biometric/history', '/biometric/verify-ops', '/biometric/monitoring',
  // Exams
  '/question-bank', '/question-bank/manage', '/question-bank/exams',
  '/question-bank/exams/create', '/question-bank/results',
  // Applicant portal (12 stages)
  '/applicant', '/applicant/auth/step-1', '/applicant/auth/step-2',
  '/applicant/profile/personal', '/applicant/profile/education', '/applicant/profile/marital',
  '/applicant/payment', '/applicant/profile/family', '/applicant/exam-schedule',
  '/applicant/print-card', '/applicant/follow-up', '/applicant/acquaintance-doc',
  // 404 fallback
  '/this-route-does-not-exist',
];

function fmt(n, w = 3) { return String(n).padStart(w); }

async function check(url) {
  const res = await fetch(url, { redirect: 'manual' });
  const html = res.status >= 200 && res.status < 400 ? await res.text() : '';
  const isShell = html.includes('<div id="root">') || html.includes('id=root');
  return { status: res.status, length: html.length, isShell };
}

const results = [];
let passes = 0, fails = 0;

console.log(`\n  Route-walker against ${BASE}\n`);

for (const route of ROUTES) {
  const url = BASE + route;
  try {
    const { status, length, isShell } = await check(url);
    const ok = status === 200 && isShell;
    if (ok) passes += 1; else fails += 1;
    const flag = ok ? '✓' : '✗';
    console.log(`  ${flag}  ${fmt(status)}   ${fmt(length, 6)}b   ${route}`);
    results.push({ route, status, length, isShell, ok });
  } catch (e) {
    fails += 1;
    console.log(`  ✗  ERR        -   ${route}   (${e.message})`);
    results.push({ route, status: 0, error: e.message, ok: false });
  }
}

console.log(`\n  ${passes} passed · ${fails} failed (of ${ROUTES.length})\n`);
process.exit(fails > 0 ? 1 : 0);
