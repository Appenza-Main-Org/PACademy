/* eslint-disable */
/**
 * Spec 009 — endpoint smoke test (browser console).
 *
 * What it does:
 *   1. Picks the first cycle from /admin/cycles.
 *   2. Exercises every endpoint added by T093–T098 + the underlying
 *      backend work (T075–T092):
 *        - Committee CRUD (§9)
 *        - Date bindings (§10)
 *        - Cycle exam plan (§8)
 *        - Notification templates (§11)
 *   3. Cleans up after itself (archives test rows).
 *
 * How to run:
 *   1. Make sure the backend is up on http://localhost:5097.
 *   2. Make sure VITE_DEMO_MODE is NOT set in frontend/.env.local.
 *   3. Start the frontend (`npm --prefix frontend run dev`) and open
 *      http://localhost:5173/staff-login. Log in as a super-admin via
 *      the real OTP flow (so you get a real `pa-session` cookie).
 *   4. Open DevTools → Console.
 *   5. Copy-paste this whole file into the console and press Enter.
 *
 * Output:
 *   Green ✅ for each passing step, red ❌ for failures, with the
 *   HTTP status and response body inlined. A failure on any step
 *   halts the script and leaves earlier artifacts in place (you may
 *   need to manually archive the committee it created).
 */

(async () => {
  const TAG = '%c[spec-009]';
  const TAG_STYLE = 'color: #1A6868; font-weight: bold';
  const log = (...args) => console.log(TAG, TAG_STYLE, ...args);
  const ok = (label, ...args) =>
    console.log(`%c✅ ${label}`, 'color: #1f7a1f', ...args);
  const fail = (label, ...args) =>
    console.log(`%c❌ ${label}`, 'color: #c8462c; font-weight: bold', ...args);

  /* ── 0. CSRF token from cookie ─────────────────────────────────── */
  const csrfMatch = document.cookie.match(/csrf-token=([^;]+)/);
  if (!csrfMatch) {
    fail(
      'No csrf-token cookie found. Did you log in via /staff-login? ' +
        'If you used VITE_DEMO_MODE=true, that bypasses the real session — ' +
        'remove it and log in for real.',
    );
    return;
  }
  const csrf = decodeURIComponent(csrfMatch[1]);

  /* Match the frontend's apiClient baseURL — `.env.local` should have
   * `VITE_API_URL=http://localhost:5097`. If you've changed it, edit
   * this constant. */
  const BASE = 'http://localhost:5097';

  /* ── helpers ───────────────────────────────────────────────────── */
  const call = async (method, path, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      headers['X-CSRF-Token'] = csrf;
    }
    const resp = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    let data = null;
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        data = await resp.json();
      } catch {
        /* empty */
      }
    }
    return { status: resp.status, data };
  };

  const assertStatus = (label, resp, expected) => {
    if (resp.status === expected) {
      ok(`${label} → ${resp.status}`);
      return true;
    }
    fail(`${label} → ${resp.status} (expected ${expected})`, resp.data);
    return false;
  };

  /* ── 1. pick a cycle ───────────────────────────────────────────── */
  log('— Step 1: list cycles');
  const cyclesResp = await call('GET', '/admin/cycles');
  if (cyclesResp.status !== 200) {
    fail('GET /admin/cycles failed — cannot continue', cyclesResp);
    return;
  }
  const cycles = Array.isArray(cyclesResp.data)
    ? cyclesResp.data
    : cyclesResp.data?.items ?? [];
  if (cycles.length === 0) {
    fail('No cycles found. Run the backend seeder first: ' +
      'dotnet run --project backend/src/PACademy.Api -- --seed');
    return;
  }
  const cycle = cycles[0];
  ok(`picked cycle ${cycle.id} (${cycle.nameAr ?? cycle.name ?? '?'})`);

  /* ── 2. T093 — committee CRUD ─────────────────────────────────── */
  log('— Step 2: T093 committee CRUD');
  const stamp = Date.now();

  const createResp = await call('POST', '/admin/committees', {
    cycleId: cycle.id,
    key: `smoke-${stamp}`,
    nameAr: 'لجنة اختبار سموك',
    nameEn: null,
    chairUserId: null,
    dailyCapacity: 10,
    specializations: [],
  });
  if (!assertStatus('POST /admin/committees', createResp, 201)) return;
  const committee = createResp.data;
  console.log('   created committee:', committee.id, 'rowVersion:', committee.rowVersion);

  const listResp = await call('GET', `/admin/committees?cycleId=${cycle.id}`);
  if (!assertStatus('GET /admin/committees', listResp, 200)) return;
  console.log(`   list size: ${listResp.data?.length}`);

  const getResp = await call('GET', `/admin/committees/${committee.id}`);
  if (!assertStatus('GET /admin/committees/:id', getResp, 200)) return;

  const updateResp = await call('PATCH', `/admin/committees/${committee.id}`, {
    nameAr: 'لجنة اختبار سموك (محدّثة)',
    dailyCapacity: 15,
    rowVersion: committee.rowVersion,
  });
  if (!assertStatus('PATCH /admin/committees/:id', updateResp, 200)) return;
  let committeeRv = updateResp.data.rowVersion;
  console.log('   new rowVersion:', committeeRv);

  /* Stale rowVersion → expect 409 */
  const staleResp = await call('PATCH', `/admin/committees/${committee.id}`, {
    nameAr: 'should fail',
    rowVersion: committee.rowVersion, // the original, now stale
  });
  if (staleResp.status === 409) {
    ok('PATCH with stale rowVersion → 409 (optimistic locking works)');
  } else {
    fail(
      `PATCH with stale rowVersion → ${staleResp.status} (expected 409)`,
      staleResp.data,
    );
  }

  /* ── 3. T097 — date bindings ──────────────────────────────────── */
  log('— Step 3: T097 date bindings');
  const TEST_DATE = '2026-06-15';

  const upsertResp = await call(
    'PUT',
    `/admin/committees/${committee.id}/date-bindings/${TEST_DATE}`,
    { capacity: 25, rowVersion: null },
  );
  if (!assertStatus('PUT date-binding', upsertResp, 200)) return;
  console.log('   binding:', upsertResp.data);

  const bindingsResp = await call(
    'GET',
    `/admin/committees/${committee.id}/date-bindings`,
  );
  if (!assertStatus('GET date-bindings', bindingsResp, 200)) return;
  console.log(`   bindings count: ${bindingsResp.data?.length}`);

  const upsertAgainResp = await call(
    'PUT',
    `/admin/committees/${committee.id}/date-bindings/${TEST_DATE}`,
    { capacity: 40, rowVersion: upsertResp.data.rowVersion },
  );
  if (!assertStatus('PUT date-binding (update)', upsertAgainResp, 200)) return;
  console.log('   updated capacity:', upsertAgainResp.data.capacity);

  const delBindingResp = await call(
    'DELETE',
    `/admin/committees/${committee.id}/date-bindings/${TEST_DATE}`,
  );
  if (!assertStatus('DELETE date-binding', delBindingResp, 204)) return;

  /* ── 4. T095 — cycle exam plan ────────────────────────────────── */
  log('— Step 4: T095 cycle exam plan');
  const examListResp = await call('GET', `/admin/cycles/${cycle.id}/exam-plan`);
  assertStatus('GET /exam-plan', examListResp, 200);

  const createExamResp = await call('POST', `/admin/cycles/${cycle.id}/exam-plan`, {
    examTypeKey: `smoke-exam-${stamp}`,
    order: 999,
    isRequired: true,
    feeEgp: 50,
  });
  if (!assertStatus('POST /exam-plan', createExamResp, 201)) {
    /* don't return — continue to notifications */
  } else {
    const exam = createExamResp.data;
    console.log('   created exam:', exam.id, 'rv:', exam.rowVersion);

    const updateExamResp = await call('PATCH', `/admin/cycle-exams/${exam.id}`, {
      isRequired: false,
      rowVersion: exam.rowVersion,
    });
    assertStatus('PATCH /cycle-exams/:id', updateExamResp, 200);

    const archiveExamResp = await call(
      'POST',
      `/admin/cycle-exams/${exam.id}/archive`,
      { reason: 'smoke cleanup' },
    );
    assertStatus('POST /cycle-exams/:id/archive', archiveExamResp, 204);
  }

  /* ── 5. T096 — notification templates ─────────────────────────── */
  log('— Step 5: T096 notification templates');
  const tplListResp = await call('GET', '/admin/notification-templates');
  assertStatus('GET /notification-templates', tplListResp, 200);

  const createTplResp = await call('POST', '/admin/notification-templates', {
    triggerEvent: 'application_received',
    subjectAr: 'تم استلام طلبك',
    bodyAr: 'شكراً لتقديمك، سنراجع طلبك قريباً.',
    channel: 'sms',
  });
  if (!assertStatus('POST /notification-templates', createTplResp, 201)) {
    /* don't return — continue to cleanup */
  } else {
    const tpl = createTplResp.data;
    console.log('   created template:', tpl.id, 'isPublished:', tpl.isPublished);

    const publishResp = await call(
      'POST',
      `/admin/notification-templates/${tpl.id}/publish`,
      { rowVersion: tpl.rowVersion },
    );
    if (assertStatus('POST /publish', publishResp, 200)) {
      console.log('   publishedAt:', publishResp.data.publishedAt);

      /* PATCH while published → expect 422 (per contracts §11) */
      const patchPubResp = await call(
        'PATCH',
        `/admin/notification-templates/${tpl.id}`,
        { subjectAr: 'مرفوض', rowVersion: publishResp.data.rowVersion },
      );
      if (patchPubResp.status === 422) {
        ok('PATCH on published template → 422 (guard works)');
      } else {
        fail(
          `PATCH on published template → ${patchPubResp.status} (expected 422)`,
          patchPubResp.data,
        );
      }

      const unpubResp = await call(
        'POST',
        `/admin/notification-templates/${tpl.id}/unpublish`,
        { rowVersion: publishResp.data.rowVersion },
      );
      assertStatus('POST /unpublish', unpubResp, 200);

      const archiveTplResp = await call(
        'POST',
        `/admin/notification-templates/${tpl.id}/archive`,
        { reason: 'smoke cleanup' },
      );
      assertStatus('POST /notification-templates/:id/archive', archiveTplResp, 204);
    }
  }

  /* ── 6. cleanup ───────────────────────────────────────────────── */
  log('— Step 6: cleanup');
  const archiveCmtResp = await call(
    'POST',
    `/admin/committees/${committee.id}/archive`,
    { reason: 'smoke test cleanup' },
  );
  assertStatus('POST /admin/committees/:id/archive', archiveCmtResp, 204);

  log('Done. Re-run any time — every test row is uniquely keyed by timestamp.');
})();
