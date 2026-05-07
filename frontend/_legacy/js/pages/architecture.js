/**
 * Architecture View — visual representation of the entire platform
 */
(function() {
  'use strict';

  function render() {
    const auth = Store.get('auth');
    if (!auth) { Router.navigate('/login'); return ''; }

    return `
      <div class="shell">
        ${Shell.appHeader({ key: 'architecture', icon: '🏗️', title: 'معمارية النظام' })}
        <main class="main">
          <div style="max-width:1280px;margin:0 auto;">
            <div class="breadcrumbs">
              <a href="#/">الرئيسية</a> ›
              <span>معمارية النظام</span>
            </div>

            ${Shell.pageHead(
              '<span style="font-size:24px;">🏗️</span> معمارية المنظومة الكاملة',
              'البناء الفني الموحّد لتطبيقات الإنترنت والشبكة الداخلية'
            )}

            ${legend()}
            ${diagram()}
            ${integrationsTable()}
            ${techStack()}
          </div>
        </main>
      </div>
    `;
  }

  function legend() {
    return `
      <div class="card mb-5">
        <div class="card-body" style="display:flex;gap:20px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;border-radius:3px;background:#DDE7F2;border:1px solid #2D5BA0;"></div><span class="text-sm">طبقة العرض (UI)</span></div>
          <div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;border-radius:3px;background:#FAF6E8;border:1px solid #C9A961;"></div><span class="text-sm">طبقة الأمان</span></div>
          <div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;border-radius:3px;background:#D7F0E1;border:1px solid #1A8754;"></div><span class="text-sm">طبقة الخدمات</span></div>
          <div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;border-radius:3px;background:#EBD8F0;border:1px solid #7C2D8E;"></div><span class="text-sm">طبقة البيانات</span></div>
          <div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;border-radius:3px;background:#FBD6D6;border:1px solid #B82C2C;"></div><span class="text-sm">التكامل الخارجي</span></div>
        </div>
      </div>
    `;
  }

  function diagram() {
    return `
      <div class="arch-canvas mb-5">
        <!-- Internet Tier -->
        <div class="arch-tier" style="background:#F0F5FB;border-color:#B4CCE5;">
          <div class="arch-tier-label" style="color:#1B3A6B;">🌐 طبقة الإنترنت — Public Internet Tier</div>
          <div class="arch-blocks">
            <div class="arch-block" data-app="admin">
              <div class="arch-block-icon">⚙️</div>
              <div>1.1 إدارة المنظومة</div>
              <div class="arch-block-meta">Administrator Site</div>
            </div>
            <div class="arch-block" data-app="applicant">
              <div class="arch-block-icon">🎓</div>
              <div>1.2 موقع المتقدمين</div>
              <div class="arch-block-meta">Applicant Site</div>
            </div>
          </div>
        </div>

        <!-- Security Layer -->
        <div class="arch-tier" style="background:#FAF6E8;border-color:#E8D9A8;">
          <div class="arch-tier-label" style="color:#A8893F;">🔐 طبقة الأمان — DMZ + Firewall</div>
          <div class="arch-blocks">
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#FAF6E8;color:#A8893F;">🛡️</div>
              <div>WAF</div>
              <div class="arch-block-meta">Web Application Firewall</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#FAF6E8;color:#A8893F;">🔑</div>
              <div>Identity Service</div>
              <div class="arch-block-meta">JWT + RBAC + 11 أدوار</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#FAF6E8;color:#A8893F;">📊</div>
              <div>Audit Trail</div>
              <div class="arch-block-meta">سجل عمليات شامل</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#FAF6E8;color:#A8893F;">🔒</div>
              <div>API Gateway</div>
              <div class="arch-block-meta">Rate limiting + TLS</div>
            </div>
          </div>
        </div>

        <!-- Internal Tier -->
        <div class="arch-tier" style="background:#F7F9FC;border-color:#CBD5E0;">
          <div class="arch-tier-label" style="color:#4A5568;">🏢 طبقة الشبكة الداخلية — Internal Network Tier</div>
          <div class="arch-blocks">
            <div class="arch-block" data-app="committee">
              <div class="arch-block-icon">📋</div>
              <div>2.1 لجان القبول</div>
              <div class="arch-block-meta">Committees Mgmt</div>
            </div>
            <div class="arch-block" data-app="board">
              <div class="arch-block-icon">⚖️</div>
              <div>2.2 الهيئة</div>
              <div class="arch-block-meta">Board Secretariat</div>
            </div>
            <div class="arch-block" data-app="investigations">
              <div class="arch-block-icon">🔍</div>
              <div>2.3 التحريات</div>
              <div class="arch-block-meta">Investigations</div>
            </div>
            <div class="arch-block" data-app="medical">
              <div class="arch-block-icon">🩺</div>
              <div>2.4 القومسيون</div>
              <div class="arch-block-meta">Medical Commission</div>
            </div>
            <div class="arch-block" data-app="barcode">
              <div class="arch-block-icon">🏷️</div>
              <div>2.5 الباركود</div>
              <div class="arch-block-meta">Barcode Mgmt</div>
            </div>
            <div class="arch-block" data-app="biometric">
              <div class="arch-block-icon">👁️</div>
              <div>2.6 البيومتري</div>
              <div class="arch-block-meta">Biometric Verify</div>
            </div>
            <div class="arch-block" data-app="exams">
              <div class="arch-block-icon">📝</div>
              <div>2.7 الاختبارات</div>
              <div class="arch-block-meta">Question Bank</div>
            </div>
          </div>
        </div>

        <!-- Service Layer -->
        <div class="arch-tier" style="background:#D7F0E1;border-color:#7DCFA0;">
          <div class="arch-tier-label" style="color:#1A8754;">🔧 طبقة الخدمات المشتركة — Shared Services</div>
          <div class="arch-blocks">
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#D7F0E1;color:#1A8754;">📤</div>
              <div>Reports Engine</div>
              <div class="arch-block-meta">Word/Excel/PDF</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#D7F0E1;color:#1A8754;">📨</div>
              <div>Notifications</div>
              <div class="arch-block-meta">SMS + Email</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#D7F0E1;color:#1A8754;">💾</div>
              <div>File Storage</div>
              <div class="arch-block-meta">Encrypted blobs</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#D7F0E1;color:#1A8754;">⚡</div>
              <div>Cache Layer</div>
              <div class="arch-block-meta">Redis</div>
            </div>
          </div>
        </div>

        <!-- Data Layer -->
        <div class="arch-tier" style="background:#EBD8F0;border-color:#C49ECC;">
          <div class="arch-tier-label" style="color:#7C2D8E;">💽 طبقة البيانات — Data Layer</div>
          <div class="arch-blocks">
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#EBD8F0;color:#7C2D8E;">🗄️</div>
              <div>Primary DB</div>
              <div class="arch-block-meta">SQL Server / PostgreSQL</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#EBD8F0;color:#7C2D8E;">📊</div>
              <div>Reports DB</div>
              <div class="arch-block-meta">Read replica</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#EBD8F0;color:#7C2D8E;">🗃️</div>
              <div>Document Store</div>
              <div class="arch-block-meta">Encrypted PDFs</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#EBD8F0;color:#7C2D8E;">📋</div>
              <div>Audit Logs DB</div>
              <div class="arch-block-meta">Immutable</div>
            </div>
          </div>
        </div>

        <!-- External Integrations -->
        <div class="arch-tier" style="background:#FBD6D6;border-color:#E89B9B;">
          <div class="arch-tier-label" style="color:#B82C2C;">🌍 التكاملات الخارجية — External Integrations</div>
          <div class="arch-blocks">
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#FBD6D6;color:#B82C2C;">🇪🇬</div>
              <div>Digital Verification</div>
              <div class="arch-block-meta">منصة التحقق الرقمي</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#FBD6D6;color:#B82C2C;">📚</div>
              <div>Education Ministry</div>
              <div class="arch-block-meta">وزارة التعليم</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#FBD6D6;color:#B82C2C;">🕌</div>
              <div>Al-Azhar API</div>
              <div class="arch-block-meta">الأزهر الشريف</div>
            </div>
            <div class="arch-block">
              <div class="arch-block-icon" style="background:#FBD6D6;color:#B82C2C;">💳</div>
              <div>Payment Gateway</div>
              <div class="arch-block-meta">بوابة الدفع</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function integrationsTable() {
    const integrations = [
      { name: 'منصة التحقق الرقمي للحكومة المصرية', endpoint: 'https://digital-verification.gov.eg/api/v2', auth: 'OAuth 2.0 + mTLS', purpose: 'تسجيل دخول الضباط بالهوية الرقمية', status: 'active' },
      { name: 'وزارة التربية والتعليم', endpoint: 'https://moe.gov.eg/students/api', auth: 'API Key + IP whitelist', purpose: 'استيراد بيانات الثانوية العامة', status: 'active' },
      { name: 'الأزهر الشريف', endpoint: 'https://azhar.eg/students/api', auth: 'API Key + IP whitelist', purpose: 'بيانات الثانوية الأزهرية', status: 'active' },
      { name: 'بوابة الدفع الإلكتروني', endpoint: 'https://payment.gov.eg/v1', auth: 'HMAC SHA256 + Webhook', purpose: 'سداد رسوم التقدم', status: 'active' },
      { name: 'منصة الإشعارات الموحدة', endpoint: 'https://notifications.gov.eg/api', auth: 'JWT', purpose: 'إرسال SMS وبريد للمتقدمين', status: 'pending' },
      { name: 'إدارة التحريات', endpoint: 'Internal API (VPN)', auth: 'Internal SSO', purpose: 'صادر/وارد التحريات', status: 'active' },
    ];

    return `
      <div class="card mb-5">
        <div class="card-header">
          <div class="card-title">جدول نقاط التكامل (Integration Endpoints)</div>
          <span class="badge badge-info">${integrations.filter(i => i.status === 'active').length} متصل من أصل ${integrations.length}</span>
        </div>
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead><tr><th>النظام</th><th>الـ Endpoint</th><th>طريقة المصادقة</th><th>الغرض</th><th>الحالة</th></tr></thead>
            <tbody>
              ${integrations.map(i => `
                <tr>
                  <td style="font-weight:600;">${UI.escape(i.name)}</td>
                  <td><span class="mono text-xs text-secondary">${UI.escape(i.endpoint)}</span></td>
                  <td><span class="text-xs">${UI.escape(i.auth)}</span></td>
                  <td><span class="text-xs">${UI.escape(i.purpose)}</span></td>
                  <td>
                    ${i.status === 'active' ?
                      '<span class="badge badge-success badge-dot">متصل</span>' :
                      '<span class="badge badge-warning badge-dot">قيد الإعداد</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function techStack() {
    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">الـ Tech Stack المقترح</div>
          <div class="card-subtitle">قائم على متطلبات السيادة الرقمية والاستضافة المحلية</div>
        </div>
        <div class="card-body">
          <div class="grid grid-3 gap-4">
            ${[
              { layer: 'Frontend', tech: ['React 18 + TypeScript', 'Vite', 'TanStack Query', 'i18n عربي/إنجليزي', 'Tailwind CSS'], color: '#2D5BA0' },
              { layer: 'Backend', tech: ['ASP.NET Core 8 / Node.js', 'Clean Architecture', 'CQRS + MediatR', 'FluentValidation', 'AutoMapper'], color: '#1A8754' },
              { layer: 'Data', tech: ['SQL Server 2022', 'Entity Framework Core', 'Redis (caching)', 'Elasticsearch (search)', 'MinIO (object storage)'], color: '#7C2D8E' },
              { layer: 'Security', tech: ['IdentityServer / Keycloak', 'JWT + Refresh tokens', 'OWASP compliance', 'Audit logging', 'Data encryption at rest'], color: '#A8893F' },
              { layer: 'DevOps', tech: ['Docker + Kubernetes', 'GitLab CI/CD', 'استضافة محلية', 'Prometheus + Grafana', 'ELK Stack (logging)'], color: '#4A5568' },
              { layer: 'Integration', tech: ['REST APIs', 'gRPC (داخلي)', 'WebHook listeners', 'Message Queue (RabbitMQ)', 'API Gateway (Kong/Yarp)'], color: '#B82C2C' },
            ].map(s => `
              <div style="padding:16px;border:1px solid var(--border-subtle);border-radius:10px;border-right:4px solid ${s.color};">
                <div style="font-weight:700;margin-bottom:10px;color:${s.color};">${UI.escape(s.layer)}</div>
                <ul style="list-style:none;padding:0;margin:0;font-size:13px;line-height:1.9;">
                  ${s.tech.map(t => `<li style="display:flex;gap:6px;align-items:center;"><span style="color:${s.color};">▸</span>${UI.escape(t)}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function attach() { Shell.attachShellEvents(); }

  window.ArchitecturePage = { render, attach };
})();
