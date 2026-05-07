/**
 * Hub Page — main landing showing all 9 apps + global KPIs
 */
(function() {
  'use strict';

  const APPS = [
    { key: 'admin',          icon: '⚙️',  num: '1.1', title: 'إدارة منظومة القبول',          desc: 'إعداد شروط التقدم وإدارة الأكواد المرجعية والإحصائيات الشاملة',  path: '/admin',          platform: 'إنترنت',     stat: '240 متقدم' },
    { key: 'applicant',      icon: '🎓',  num: '1.2', title: 'موقع المتقدمين',                desc: 'تسجيل المتقدمين على الإنترنت ومتابعة كل مراحل التقدم والاختبارات', path: '/applicant',      platform: 'إنترنت',     stat: 'دورة 11 مرحلة' },
    { key: 'committee',      icon: '📋',  num: '2.1', title: 'لجان القبول',                   desc: 'تنظيم لجان قبول المتقدمين وإدارة بياناتهم وربط مراحل التقدم',     path: '/committee',      platform: 'شبكة داخلية', stat: '5 لجان' },
    { key: 'board',          icon: '⚖️',  num: '2.2', title: 'الهيئة وأمانة السر',            desc: 'إدارة لجنة الهيئة وتنظيم البيانات والإجراءات المرتبطة بها',         path: '/board',          platform: 'شبكة داخلية', stat: 'هيئة عليا' },
    { key: 'investigations', icon: '🔍',  num: '2.3', title: 'التحريات',                       desc: 'إجراءات صادر/وارد التحريات وإدراج ومتابعة نتائجها بالملف الإلكتروني', path: '/investigations', platform: 'شبكة داخلية', stat: 'سرية تامة' },
    { key: 'medical',        icon: '🩺',  num: '2.4', title: 'القومسيون الطبي',                desc: 'إدارة الاختبارات الطبية لقطاع الخدمات الطبية وإدراج النتائج',       path: '/medical',        platform: 'شبكة داخلية', stat: '8 عيادات' },
    { key: 'barcode',        icon: '🏷️',  num: '2.5', title: 'إنشاء وطباعة الباركود',           desc: 'إنشاء وإدارة وطباعة الباركود الخاص بالمتقدمين للاستعلام والتكامل', path: '/barcode',        platform: 'شبكة داخلية', stat: 'كارت تردد' },
    { key: 'biometric',      icon: '👁️', num: '2.6', title: 'تسجيل واستعلام بيومتري',       desc: 'البصمة الرقمية والتعرف على الوجه والتحقق من الهوية داخل اللجان',    path: '/biometric',      platform: 'شبكة داخلية', stat: 'تحقق فوري' },
    { key: 'exams',          icon: '📝',  num: '2.7', title: 'بنك الأسئلة والاختبارات',        desc: 'إعداد بنك الأسئلة وتنفيذ الاختبارات الإلكترونية واستخراج التقارير', path: '/question-bank',  platform: 'شبكة داخلية', stat: 'نظام MCQ' },
  ];

  function render() {
    const auth = Store.get('auth');
    if (!auth) { Router.navigate('/login'); return ''; }
    const accessibleApps = APPS.filter(a => auth.apps.includes(a.key));

    return `
      <div class="shell">
        ${renderHeader(auth)}
        <main class="main">
          <div style="max-width: 1280px; margin: 0 auto;">
            ${renderHero(auth)}
            ${renderKPIs()}
            ${renderApps(accessibleApps)}
            ${renderFooter()}
          </div>
        </main>
      </div>
    `;
  }

  function renderHeader(auth) {
    return `
      <header class="header">
        <div class="header-left">
          <div class="brand">
            <div class="brand-logo">${UI.Icons.shield}</div>
            <div class="brand-text">
              <span>منظومة القبول</span>
              <span>أكاديمية الشرطة</span>
            </div>
          </div>
        </div>
        <div class="header-right">
          <button class="btn btn-ghost btn-icon" title="الإشعارات">${UI.Icons.bell}</button>
          <a href="#/architecture" class="btn btn-ghost" title="معمارية النظام">
            ${UI.Icons.layers} <span>المعمارية</span>
          </a>
          <div class="user-menu">
            <div class="avatar">${escape(auth.name.split(' ')[0][0])}</div>
            <div class="user-menu-info">
              <span class="user-menu-name">${escape(auth.name.split(' ').slice(0, 3).join(' '))}</span>
              <span class="user-menu-role">${escape(auth.roleLabel)}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-icon" id="logout-btn" title="تسجيل الخروج">${UI.Icons.logout}</button>
        </div>
      </header>
    `;
  }

  function renderHero(auth) {
    // Take first 4 parts of the name (rank + first name + middle + maybe last)
    const displayName = auth.name.split(' ').slice(0, 4).join(' ');
    return `
      <div class="hub-hero">
        <h1>أهلاً بك، ${escape(displayName)}</h1>
        <p>المنظومة الكاملة للتحول الرقمي بإجراءات القبول والاختبارات. تسعة تطبيقات مترابطة على مستوى الإنترنت والشبكة الداخلية تعمل بصورة موحدة.</p>
        <div class="hub-hero-meta">
          <div class="hub-hero-meta-item">${UI.Icons.calendar}<span>${UI.date(Date.now())}</span></div>
          <div class="hub-hero-meta-item">${UI.Icons.shield}<span>منصة التحقق الرقمي ✓</span></div>
          <div class="hub-hero-meta-item"><span class="status-dot online"></span><span>كل الخدمات نشطة</span></div>
        </div>
      </div>
    `;
  }

  function renderKPIs() {
    const k = window.MockData.kpis;
    const items = [
      { label: 'إجمالي المتقدمين', value: k.totalApplicants, icon: '👥', tone: '#2D5BA0', bg: '#DDE7F2', trend: '+12%' },
      { label: 'مدفوع الرسوم', value: k.paidApplicants, icon: '💳', tone: '#1A8754', bg: '#D7F0E1', trend: `${Math.round(k.paidApplicants/k.totalApplicants*100)}%` },
      { label: 'قيد المراجعة', value: k.underReview, icon: '⏳', tone: '#B8770A', bg: '#FBE9CC', trend: '+5%' },
      { label: 'تم القبول', value: k.approved, icon: '✓', tone: '#1A8754', bg: '#D7F0E1', trend: 'مستقر' },
    ];
    return `
      <section class="section">
        <div class="hub-section-title">
          <h2>${UI.Icons.chart} لوحة المؤشرات</h2>
          <span class="text-sm text-tertiary">آخر تحديث: ${UI.date(Date.now(), 'rel')}</span>
        </div>
        <div class="grid grid-4">
          ${items.map(it => `
            <div class="stat">
              <div class="stat-header">
                <span class="stat-label">${it.label}</span>
                <span class="stat-icon" style="background:${it.bg};color:${it.tone};">${it.icon}</span>
              </div>
              <div class="stat-value">${UI.num(it.value)}</div>
              <div class="stat-trend up">↑ ${it.trend}</div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderApps(apps) {
    const internet = apps.filter(a => a.platform === 'إنترنت');
    const internal = apps.filter(a => a.platform === 'شبكة داخلية');
    return `
      <section class="section">
        ${internet.length ? `
          <div class="hub-section-title">
            <h2>🌐 تطبيقات الإنترنت</h2>
            <span class="badge badge-info">${internet.length} تطبيقات</span>
          </div>
          <div class="grid grid-cols-auto mb-6">
            ${internet.map(renderAppCard).join('')}
          </div>
        ` : ''}
        ${internal.length ? `
          <div class="hub-section-title">
            <h2>🏢 تطبيقات الشبكة الداخلية</h2>
            <span class="badge badge-brand">${internal.length} تطبيقات</span>
          </div>
          <div class="grid grid-cols-auto">
            ${internal.map(renderAppCard).join('')}
          </div>
        ` : ''}
      </section>
    `;
  }

  function renderAppCard(a) {
    return `
      <a href="#${a.path}" class="app-card" data-app="${a.key}">
        <div class="app-card-head">
          <div class="app-card-icon">${a.icon}</div>
          <span class="app-card-num">${a.num}</span>
        </div>
        <div class="app-card-title">${escape(a.title)}</div>
        <div class="app-card-desc">${escape(a.desc)}</div>
        <div class="app-card-foot">
          <span>${escape(a.stat)}</span>
          <div class="app-card-arrow">${UI.Icons.arrowLeft}</div>
        </div>
      </a>
    `;
  }

  function renderFooter() {
    return `
      <footer style="margin-top:48px;padding-top:24px;border-top:1px solid var(--border-subtle);text-align:center;color:var(--text-tertiary);font-size:13px;">
        <p>وزارة الداخلية · أكاديمية الشرطة · إدارة تكنولوجيا المعلومات</p>
        <p style="margin-top:4px;">تم الالتزام بكامل متطلبات السيادة الرقمية والأمن المعلوماتي · المنظومة آمنة ومُدققة</p>
      </footer>
    `;
  }

  function attach() {
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      if (await UI.confirmDialog('هل تريد تسجيل الخروج من المنظومة؟')) {
        await AuthService.logout();
        Router.navigate('/login');
      }
    });
  }

  function escape(s) { return UI.escape(s); }

  window.HubPage = { render, attach };
})();
