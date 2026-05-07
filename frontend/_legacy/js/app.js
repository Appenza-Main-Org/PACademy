/**
 * App Bootstrap
 * Registers all routes, attaches event handlers, starts the router.
 */
(function() {
  'use strict';

  // ─── Route registrations ──────────────────────────────
  function registerRoutes() {
    // Auth gate
    Router.before((path) => {
      if (path === '/login') return; // allow login
      if (!AuthService.isAuthenticated()) {
        Router.navigate('/login');
        return false;
      }
    });

    // Public
    Router.register('/login', () => {
      const html = LoginPage.render();
      requestAnimationFrame(() => LoginPage.attach());
      return html;
    });

    // Hub
    Router.register('/', () => {
      const html = HubPage.render();
      requestAnimationFrame(() => HubPage.attach());
      return html;
    });

    // Architecture
    Router.register('/architecture', () => {
      const html = ArchitecturePage.render();
      requestAnimationFrame(() => ArchitecturePage.attach());
      return html;
    });

    // ── Admin (1.1) ──
    Router.register('/admin', async () => {
      document.getElementById('app').innerHTML = '<div class="main"><div class="empty"><div class="empty-title">جارٍ التحميل...</div></div></div>';
      const html = await AdminPage.renderDashboard();
      document.getElementById('app').innerHTML = html;
      AdminPage.attach();
    });
    Router.register('/admin/applicants', async () => {
      const html = await AdminPage.renderApplicants();
      document.getElementById('app').innerHTML = html;
      AdminPage.attach();
    });
    Router.register('/admin/applicants/:id', async (params) => {
      const html = await AdminPage.renderApplicantDetail(params);
      document.getElementById('app').innerHTML = html;
      AdminPage.attach();
    });
    Router.register('/admin/users', async () => {
      const html = await AdminPage.renderUsers();
      document.getElementById('app').innerHTML = html;
      AdminPage.attach();
    });
    Router.register('/admin/audit', async () => {
      const html = await AdminPage.renderAudit();
      document.getElementById('app').innerHTML = html;
      AdminPage.attach();
    });
    Router.register('/admin/settings', async () => {
      const html = await AdminPage.renderSettings();
      document.getElementById('app').innerHTML = html;
      AdminPage.attach();
    });
    Router.register('/admin/reports', async () => {
      const html = await AdminPage.renderReports();
      document.getElementById('app').innerHTML = html;
      AdminPage.attach();
    });

    // ── Applicant (1.2) ──
    Router.register('/applicant', () => {
      const html = ApplicantPage.render();
      requestAnimationFrame(() => ApplicantPage.attach());
      return html;
    });

    // ── Committee (2.1) ──
    Router.register('/committee', async () => {
      const html = await CommitteePage.renderOverview();
      document.getElementById('app').innerHTML = html;
      CommitteePage.attach();
    });
    Router.register('/committee/list', async () => {
      const html = await CommitteePage.renderList();
      document.getElementById('app').innerHTML = html;
      CommitteePage.attach();
    });
    Router.register('/committee/schedule', async () => {
      const html = await CommitteePage.renderSchedule();
      document.getElementById('app').innerHTML = html;
      CommitteePage.attach();
    });

    // ── Board (2.2) ──
    Router.register('/board', async () => {
      const html = await BoardPage.renderOverview();
      document.getElementById('app').innerHTML = html;
      BoardPage.attach();
    });
    Router.register('/board/sessions', async () => {
      const html = await BoardPage.renderSessions();
      document.getElementById('app').innerHTML = html;
      BoardPage.attach();
    });
    Router.register('/board/decisions', async () => {
      const html = await BoardPage.renderDecisions();
      document.getElementById('app').innerHTML = html;
      BoardPage.attach();
    });

    // ── Investigations (2.3) ──
    Router.register('/investigations', async () => {
      const html = await InvestigationsPage.renderCases();
      document.getElementById('app').innerHTML = html;
      InvestigationsPage.attach();
    });
    Router.register('/investigations/incoming', async () => {
      const html = await InvestigationsPage.renderIncoming();
      document.getElementById('app').innerHTML = html;
      InvestigationsPage.attach();
    });
    Router.register('/investigations/outgoing', async () => {
      const html = await InvestigationsPage.renderOutgoing();
      document.getElementById('app').innerHTML = html;
      InvestigationsPage.attach();
    });

    // ── Medical (2.4) ──
    Router.register('/medical', async () => {
      const html = await MedicalPage.renderOverview();
      document.getElementById('app').innerHTML = html;
      MedicalPage.attach();
    });
    Router.register('/medical/queue', async () => {
      const html = await MedicalPage.renderQueue();
      document.getElementById('app').innerHTML = html;
      MedicalPage.attach();
    });
    Router.register('/medical/results', async () => {
      const html = await MedicalPage.renderResults();
      document.getElementById('app').innerHTML = html;
      MedicalPage.attach();
    });

    // ── Barcode (2.5) ──
    Router.register('/barcode', async () => {
      const html = await BarcodePage.renderGenerate();
      document.getElementById('app').innerHTML = html;
      BarcodePage.attach();
    });
    Router.register('/barcode/lookup', async () => {
      const html = await BarcodePage.renderLookup();
      document.getElementById('app').innerHTML = html;
      BarcodePage.attach();
    });
    Router.register('/barcode/batch', async () => {
      const html = await BarcodePage.renderBatch();
      document.getElementById('app').innerHTML = html;
      BarcodePage.attach();
    });

    // ── Biometric (2.6) ──
    Router.register('/biometric', async () => {
      const html = await BiometricPage.renderVerify();
      document.getElementById('app').innerHTML = html;
      BiometricPage.attach();
    });
    Router.register('/biometric/enroll', async () => {
      const html = await BiometricPage.renderEnroll();
      document.getElementById('app').innerHTML = html;
      BiometricPage.attach();
    });
    Router.register('/biometric/history', async () => {
      const html = await BiometricPage.renderHistory();
      document.getElementById('app').innerHTML = html;
      BiometricPage.attach();
    });

    // ── Question Bank (2.7) ──
    Router.register('/question-bank', async () => {
      const html = await QuestionBankPage.renderBank();
      document.getElementById('app').innerHTML = html;
      QuestionBankPage.attach();
    });
    Router.register('/question-bank/exams', async () => {
      const html = await QuestionBankPage.renderExams();
      document.getElementById('app').innerHTML = html;
      QuestionBankPage.attach();
    });
    Router.register('/question-bank/results', async () => {
      const html = await QuestionBankPage.renderResults();
      document.getElementById('app').innerHTML = html;
      QuestionBankPage.attach();
    });
  }

  // ─── Boot ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    registerRoutes();
    Router.start();
  });
})();
