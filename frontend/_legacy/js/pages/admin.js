/**
 * Administrator Site (1.1)
 * Main admin dashboard for the entire admissions system.
 * Routes:
 *   /admin              → dashboard
 *   /admin/applicants   → applicants list
 *   /admin/applicants/:id → applicant details
 *   /admin/users        → system users
 *   /admin/audit        → audit trail
 *   /admin/settings     → system settings
 */
(function() {
  'use strict';

  const APP = { key: 'admin', icon: '⚙️', title: 'إدارة منظومة القبول' };

  const NAV = [
    { label: 'الرئيسية', items: [
      { key: 'dashboard',  icon: '🏠', label: 'لوحة التحكم',     path: '/admin' },
      { key: 'applicants', icon: '👥', label: 'المتقدمون',        path: '/admin/applicants', badge: '240' },
    ]},
    { label: 'الإدارة', items: [
      { key: 'users',      icon: '🛡️', label: 'مستخدمو النظام',   path: '/admin/users' },
      { key: 'audit',      icon: '📋', label: 'سجل العمليات',     path: '/admin/audit' },
      { key: 'settings',   icon: '⚙️', label: 'إعدادات المنظومة', path: '/admin/settings' },
    ]},
    { label: 'التقارير', items: [
      { key: 'reports',    icon: '📊', label: 'التقارير والإحصائيات', path: '/admin/reports' },
    ]},
  ];

  function shell(activeKey, body) {
    return `
      <div class="shell shell-with-sidebar" data-app="admin">
        ${Shell.appHeader(APP)}
        ${Shell.sidebar(NAV, activeKey, 'admin')}
        <main class="main">${body}</main>
      </div>
    `;
  }

  // ─── Dashboard ─────────────────────────────────────────
  async function renderDashboard() {
    const k = window.MockData.kpis;
    const recent = window.MockData.applicants.slice(0, 8);
    const audit = window.MockData.audit.slice(0, 6);
    const govDist = await ApplicantsService.getDistribution('governorate');

    const stats = [
      { label: 'إجمالي المتقدمين', value: k.totalApplicants, icon: '👥', tone: '#2D5BA0', bg: '#DDE7F2', trend: '+12%' },
      { label: 'مدفوع الرسوم',      value: k.paidApplicants,  icon: '💳', tone: '#1A8754', bg: '#D7F0E1', trend: `${Math.round(k.paidApplicants/k.totalApplicants*100)}%` },
      { label: 'قيد المراجعة',      value: k.underReview,     icon: '⏳', tone: '#B8770A', bg: '#FBE9CC', trend: '+5%' },
      { label: 'تم القبول',         value: k.approved,        icon: '✓',  tone: '#1A8754', bg: '#D7F0E1', trend: 'مستقر' },
    ];

    const last14 = window.MockData.last14Days;
    const lineData = last14.map(d => ({ label: d.label, value: d.registrations }));
    const certs = Object.entries(k.byCertType).map(([label, value]) => ({ label, value }));

    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">⚙️</span> لوحة تحكم النظام',
        'نظرة عامة شاملة على كل مراحل القبول والاختبارات',
        `
          <button class="btn btn-secondary">${UI.Icons.download} تصدير تقرير</button>
          <button class="btn btn-primary">${UI.Icons.plus} متقدم جديد</button>
        `
      )}

      <section class="grid grid-4 mb-6">
        ${stats.map(s => `
          <div class="stat">
            <div class="stat-header">
              <span class="stat-label">${s.label}</span>
              <span class="stat-icon" style="background:${s.bg};color:${s.tone};">${s.icon}</span>
            </div>
            <div class="stat-value">${UI.num(s.value)}</div>
            <div class="stat-trend up">↑ ${s.trend}</div>
          </div>
        `).join('')}
      </section>

      <section class="grid grid-2 mb-6">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">معدل التسجيلات اليومي</div>
              <div class="card-subtitle">آخر 14 يوماً</div>
            </div>
            <span class="badge badge-info">${UI.Icons.activity} مباشر</span>
          </div>
          <div class="card-body">${Charts.line(lineData, { color: '#2D5BA0' })}</div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">توزيع الشهادات</div>
              <div class="card-subtitle">حسب نوع الثانوية</div>
            </div>
          </div>
          <div class="card-body">${Charts.donut(certs)}</div>
        </div>
      </section>

      <section class="grid grid-2 mb-6">
        <div class="card">
          <div class="card-header">
            <div class="card-title">آخر المتقدمين</div>
            <a href="#/admin/applicants" class="btn btn-ghost btn-sm">عرض الكل ${UI.Icons.arrowLeft}</a>
          </div>
          <div class="table-wrap" style="border:none;border-radius:0;">
            <table class="table">
              <thead><tr><th>الاسم</th><th>المرحلة</th><th>الحالة</th></tr></thead>
              <tbody>
                ${recent.map(a => `
                  <tr style="cursor:pointer;" data-id="${a.id}" class="recent-row">
                    <td>
                      <div style="display:flex;align-items:center;gap:10px;">
                        <div class="avatar avatar-sm">${UI.escape(a.name[0])}</div>
                        <div>
                          <div style="font-weight:600;">${UI.escape(a.name.split(' ').slice(0,2).join(' '))}</div>
                          <div class="text-xs text-tertiary mono">${a.id}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="text-xs">${UI.escape(a.stageLabel)}</span></td>
                    <td>${statusBadge(a.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">سجل العمليات</div>
            <a href="#/admin/audit" class="btn btn-ghost btn-sm">عرض الكل ${UI.Icons.arrowLeft}</a>
          </div>
          <div class="card-body">
            <div class="activity">
              ${audit.map(e => `
                <div class="activity-item">
                  <div class="activity-icon" style="background:var(--${e.actionColor}-bg);color:var(--${e.actionColor});">
                    ${actionIcon(e.action)}
                  </div>
                  <div class="activity-body">
                    <div class="activity-title">${UI.escape(e.details)}</div>
                    <div class="activity-meta">
                      ${UI.escape(e.userName.split(' ').slice(0,3).join(' '))} ·
                      ${UI.date(e.timestamp, 'rel')} ·
                      <span class="mono">${e.ip}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </section>

      <section class="card mb-6">
        <div class="card-header">
          <div class="card-title">التوزيع الجغرافي للمتقدمين</div>
          <div class="card-subtitle">أعلى 10 محافظات</div>
        </div>
        <div class="card-body">
          ${Charts.bar(govDist.slice(0, 10), { color: '#1B3A6B', height: 220 })}
        </div>
      </section>
    `;
    return shell('dashboard', body);
  }

  // ─── Applicants list ──────────────────────────────────
  async function renderApplicants() {
    const list = await ApplicantsService.list({ pageSize: 30 });
    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">👥</span> سجل المتقدمين',
        `إجمالي ${UI.num(list.total)} متقدم`,
        `
          <button class="btn btn-secondary">${UI.Icons.download} تصدير</button>
          <button class="btn btn-secondary">${UI.Icons.filter} تصفية متقدمة</button>
          <button class="btn btn-primary">${UI.Icons.plus} متقدم جديد</button>
        `
      )}

      <div class="filters">
        <div class="search">
          <input type="text" class="input" id="search-applicants" placeholder="بحث بالاسم، الرقم القومي، أو رقم الطلب">
          ${UI.Icons.search}
        </div>
        <select class="select" id="filter-status">
          <option value="">كل الحالات</option>
          <option value="approved">تم القبول</option>
          <option value="under-review">قيد المراجعة</option>
          <option value="rejected">مرفوض</option>
          <option value="pending">جديد</option>
          <option value="on-hold">إيقاف</option>
        </select>
        <select class="select" id="filter-gov">
          <option value="">كل المحافظات</option>
          ${window.MockData.governorates.map(g => `<option value="${g}">${g}</option>`).join('')}
        </select>
        <select class="select" id="filter-cert">
          <option value="">كل الشهادات</option>
          <option value="ثانوية عامة">ثانوية عامة</option>
          <option value="ثانوية أزهرية">ثانوية أزهرية</option>
        </select>
      </div>

      <div class="card">
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>الاسم</th>
                <th>الرقم القومي</th>
                <th>المحافظة</th>
                <th>الشهادة</th>
                <th>المجموع</th>
                <th>المرحلة</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody id="applicants-tbody">
              ${list.data.map(rowApplicant).join('')}
            </tbody>
          </table>
        </div>
        <div class="card-footer">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span>عرض ${list.data.length} من ${UI.num(list.total)}</span>
            <div style="display:flex;gap:4px;">
              <button class="btn btn-secondary btn-sm">السابق</button>
              <button class="btn btn-secondary btn-sm">التالي</button>
            </div>
          </div>
        </div>
      </div>
    `;
    return shell('applicants', body);
  }

  function rowApplicant(a) {
    return `
      <tr style="cursor:pointer;" data-id="${a.id}" class="applicant-row">
        <td><span class="mono text-xs">${a.id}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="avatar avatar-sm">${UI.escape(a.name[0])}</div>
            <span style="font-weight:500;">${UI.escape(a.name.split(' ').slice(0,3).join(' '))}</span>
          </div>
        </td>
        <td><span class="mono text-xs">${a.nationalId}</span></td>
        <td>${UI.escape(a.governorate)}</td>
        <td>
          <div style="font-size:13px;">${UI.escape(a.certType)}</div>
          <div class="text-xs text-tertiary">${UI.escape(a.certSection)}</div>
        </td>
        <td>
          <div style="font-weight:600;" class="num">${a.certScore}</div>
          <div class="text-xs text-tertiary num">${a.certPercent}%</div>
        </td>
        <td><span class="text-xs">${UI.escape(a.stageLabel)}</span></td>
        <td>${statusBadge(a.status)}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-ghost btn-icon btn-sm" title="عرض" onclick="location.hash='#/admin/applicants/${a.id}';event.stopPropagation();">${UI.Icons.eye}</button>
            <button class="btn btn-ghost btn-icon btn-sm" title="تعديل" onclick="event.stopPropagation();">${UI.Icons.edit}</button>
          </div>
        </td>
      </tr>
    `;
  }

  // ─── Applicant detail ────────────────────────────────
  async function renderApplicantDetail(params) {
    const a = await ApplicantsService.getById(params.id);
    if (!a) return shell('applicants', '<div class="empty"><div class="empty-title">المتقدم غير موجود</div></div>');
    const timeline = await ApplicantsService.getTimeline(params.id);

    const body = `
      <div class="breadcrumbs">
        <a href="#/admin">لوحة التحكم</a> ›
        <a href="#/admin/applicants">المتقدمون</a> ›
        <span>${UI.escape(a.name.split(' ').slice(0,2).join(' '))}</span>
      </div>

      ${Shell.pageHead(
        `<div class="avatar avatar-lg">${UI.escape(a.name[0])}</div> ${UI.escape(a.name)}`,
        `<span class="mono">${a.id}</span> · ${UI.escape(a.governorate)} · ${UI.escape(a.certType)}`,
        `
          <button class="btn btn-secondary">${UI.Icons.print} طباعة</button>
          <button class="btn btn-secondary">${UI.Icons.fileText} كارت تردد</button>
          <button class="btn btn-primary">${UI.Icons.edit} تعديل</button>
        `
      )}

      <div class="grid" style="grid-template-columns: 2fr 1fr; gap: 24px;">
        <div>
          <div class="card mb-5">
            <div class="card-header"><div class="card-title">البيانات الأساسية</div></div>
            <div class="card-body">
              <div class="grid grid-2">
                <div>
                  <div class="detail-row"><span class="detail-label">الاسم رباعي</span><span class="detail-value">${UI.escape(a.name)}</span></div>
                  <div class="detail-row"><span class="detail-label">الرقم القومي</span><span class="detail-value mono">${a.nationalId}</span></div>
                  <div class="detail-row"><span class="detail-label">تاريخ الميلاد</span><span class="detail-value">${UI.date(a.birthDate)}</span></div>
                  <div class="detail-row"><span class="detail-label">النوع</span><span class="detail-value">${a.gender === 'male' ? 'ذكر' : 'أنثى'}</span></div>
                </div>
                <div>
                  <div class="detail-row"><span class="detail-label">المحافظة</span><span class="detail-value">${UI.escape(a.governorate)}</span></div>
                  <div class="detail-row"><span class="detail-label">المدينة</span><span class="detail-value">${UI.escape(a.city)}</span></div>
                  <div class="detail-row"><span class="detail-label">عدد الأسرة</span><span class="detail-value num">${a.familySize}</span></div>
                  <div class="detail-row"><span class="detail-label">عدد الأقارب</span><span class="detail-value num">${a.relativesCount}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div class="card mb-5">
            <div class="card-header"><div class="card-title">البيانات الدراسية</div></div>
            <div class="card-body">
              <div class="grid grid-2">
                <div>
                  <div class="detail-row"><span class="detail-label">نوع الشهادة</span><span class="detail-value">${UI.escape(a.certType)}</span></div>
                  <div class="detail-row"><span class="detail-label">الشعبة</span><span class="detail-value">${UI.escape(a.certSection)}</span></div>
                </div>
                <div>
                  <div class="detail-row"><span class="detail-label">المجموع</span><span class="detail-value num">${a.certScore} / 410</span></div>
                  <div class="detail-row"><span class="detail-label">النسبة</span><span class="detail-value num">${a.certPercent}%</span></div>
                </div>
              </div>
            </div>
          </div>

          <div class="card mb-5">
            <div class="card-header"><div class="card-title">نتائج الاختبارات</div></div>
            <div class="card-body">
              <div class="grid grid-2 gap-3">
                ${[
                  { label: 'القومسيون الطبي', value: a.results.medical, icon: '🩺' },
                  { label: 'اختبار اللياقة',  value: a.results.fitness, icon: '🏃' },
                  { label: 'المقابلة الشخصية', value: a.results.interview, icon: '💬' },
                  { label: 'الاختبار النهائي', value: a.results.finalExam, icon: '📝' },
                ].map(r => `
                  <div style="padding:14px;border:1px solid var(--border-subtle);border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                      <div style="font-weight:500;">${r.icon} ${r.label}</div>
                      <div class="text-xs text-tertiary mt-2">
                        ${r.value === 'pass' ? '✓ تم اجتيازه' : r.value === 'fail' ? '✗ لم يتم اجتيازه' : '⏳ في انتظار النتيجة'}
                      </div>
                    </div>
                    ${r.value === 'pass' ? '<span class="badge badge-success">ناجح</span>' :
                       r.value === 'fail' ? '<span class="badge badge-danger">راسب</span>' :
                       '<span class="badge badge-warning">قيد المراجعة</span>'}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">حالة التحريات</div>
              <span class="badge ${a.investigation === 'cleared' ? 'badge-success' : a.investigation === 'flagged' ? 'badge-danger' : 'badge-warning'}">
                ${a.investigation === 'cleared' ? 'تم الانتهاء — موافقة' :
                  a.investigation === 'flagged' ? 'يحتاج مراجعة' : 'قيد التحرّي'}
              </span>
            </div>
            <div class="card-body">
              <p class="text-sm text-secondary">سُلّمت لإدارة التحريات بتاريخ ${UI.date(Date.now() - 7*24*3600*1000)} وفقاً للإجراءات المعتمدة.</p>
            </div>
          </div>
        </div>

        <aside>
          <div class="card mb-5">
            <div class="card-header"><div class="card-title">الحالة الحالية</div></div>
            <div class="card-body">
              <div style="text-align:center;padding:12px 0;">
                ${statusBadge(a.status, true)}
                <div class="mt-3 text-sm text-tertiary">المرحلة الحالية</div>
                <div style="font-weight:600;font-size:16px;margin-top:4px;">${UI.escape(a.stageLabel)}</div>
              </div>
              <div class="progress mt-4"><div class="progress-fill" style="width:${(a.stage/10)*100}%;"></div></div>
              <div class="text-xs text-tertiary text-center mt-2 num">${a.stage} / 10 مراحل</div>
            </div>
          </div>

          <div class="card mb-5">
            <div class="card-header"><div class="card-title">سجل الأنشطة</div></div>
            <div class="card-body" style="padding:8px;">
              ${timeline.map(e => `
                <div style="display:flex;gap:12px;padding:8px;">
                  <div style="font-size:20px;flex-shrink:0;">${e.icon}</div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:600;">${UI.escape(e.title)}</div>
                    <div class="text-xs text-tertiary mt-2">${UI.escape(e.detail)}</div>
                    <div class="text-xs text-tertiary mt-2">${UI.date(e.ts, 'rel')}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">معلومات الدفع</div></div>
            <div class="card-body">
              <div class="detail-row"><span class="detail-label">الرسوم</span><span class="detail-value num">${a.paymentAmount} جنيه</span></div>
              <div class="detail-row">
                <span class="detail-label">الحالة</span>
                ${a.paymentStatus === 'paid' ?
                  '<span class="badge badge-success">مدفوعة</span>' :
                  '<span class="badge badge-warning">لم تُسدد</span>'}
              </div>
              <div class="detail-row"><span class="detail-label">اللجنة</span><span class="detail-value">${UI.escape(a.committee)}</span></div>
            </div>
          </div>
        </aside>
      </div>
    `;
    return shell('applicants', body);
  }

  // ─── Users page ────────────────────────────────────
  async function renderUsers() {
    const users = window.MockData.users;
    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">🛡️</span> مستخدمو النظام',
        'إدارة حسابات الضباط والصلاحيات',
        `<button class="btn btn-primary">${UI.Icons.plus} مستخدم جديد</button>`
      )}

      <div class="card">
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead>
              <tr><th>المستخدم</th><th>الدور</th><th>الوحدة</th><th>الحالة</th><th>آخر دخول</th><th></th></tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div class="avatar avatar-sm">${UI.escape(u.name[0])}</div>
                      <div>
                        <div style="font-weight:600;">${UI.escape(u.name)}</div>
                        <div class="text-xs text-tertiary mono">${u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="badge badge-brand">${UI.escape(AuthService.roles[u.role]?.labelAr || u.role)}</span></td>
                  <td>${UI.escape(u.unit)}</td>
                  <td>
                    <span class="status-dot ${u.active ? 'online' : 'offline'}"></span>
                    ${u.active ? 'نشط' : 'موقوف'}
                  </td>
                  <td><span class="text-sm text-secondary">${UI.date(u.lastLogin, 'rel')}</span></td>
                  <td>
                    <button class="btn btn-ghost btn-icon btn-sm">${UI.Icons.edit}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return shell('users', body);
  }

  // ─── Audit page ────────────────────────────────────
  async function renderAudit() {
    const items = await AuditService.list({ limit: 50 });
    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">📋</span> سجل العمليات',
        'تتبع كامل لكل العمليات المنفذة على النظام',
        `<button class="btn btn-secondary">${UI.Icons.download} تصدير</button>`
      )}

      <div class="filters">
        <div class="search"><input type="text" class="input" placeholder="بحث في السجل">${UI.Icons.search}</div>
        <select class="select"><option>كل العمليات</option><option>إدراج</option><option>تعديل</option><option>حذف</option></select>
        <select class="select"><option>كل المستخدمين</option></select>
      </div>

      <div class="card">
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead><tr><th>التوقيت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th><th>IP</th></tr></thead>
            <tbody>
              ${items.map(e => `
                <tr>
                  <td><span class="text-xs">${UI.date(e.timestamp, 'rel')}</span></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div class="avatar avatar-sm">${UI.escape(e.userName[0])}</div>
                      <span class="text-sm">${UI.escape(e.userName.split(' ').slice(0,3).join(' '))}</span>
                    </div>
                  </td>
                  <td><span class="badge badge-${e.actionColor}">${UI.escape(e.actionLabel)}</span></td>
                  <td><span class="text-sm">${UI.escape(e.details)}</span></td>
                  <td><span class="mono text-xs text-tertiary">${e.ip}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return shell('audit', body);
  }

  // ─── Settings page ─────────────────────────────────
  async function renderSettings() {
    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">⚙️</span> إعدادات المنظومة', 'إعداد شروط القبول والقوائم المرجعية')}

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header"><div class="card-title">شروط التقدم</div></div>
          <div class="card-body">
            <div class="field mb-4">
              <label class="field-label">الحد الأدنى للمجموع</label>
              <input class="input" value="380" type="number">
            </div>
            <div class="field mb-4">
              <label class="field-label">الحد الأقصى للسن</label>
              <input class="input" value="22" type="number">
            </div>
            <div class="field mb-4">
              <label class="field-label">رسوم التقدم (جنيه مصري)</label>
              <input class="input" value="1500" type="number">
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">التكامل مع الأنظمة الخارجية</div></div>
          <div class="card-body">
            ${[
              { name: 'منصة التحقق الرقمي للحكومة المصرية', status: 'connected', desc: 'API لتسجيل دخول الضباط' },
              { name: 'وزارة التربية والتعليم', status: 'connected', desc: 'بيانات الثانوية العامة' },
              { name: 'الأزهر الشريف', status: 'connected', desc: 'بيانات الثانوية الأزهرية' },
              { name: 'بوابة الدفع الإلكتروني', status: 'connected', desc: 'سداد رسوم التقدم' },
              { name: 'منصة البريد الموحد', status: 'pending', desc: 'إرسال إشعارات SMS وبريد' },
            ].map(x => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--border-subtle);">
                <div>
                  <div style="font-weight:600;">${UI.escape(x.name)}</div>
                  <div class="text-xs text-tertiary mt-2">${UI.escape(x.desc)}</div>
                </div>
                ${x.status === 'connected' ?
                  '<span class="badge badge-success badge-dot">متصل</span>' :
                  '<span class="badge badge-warning badge-dot">قيد الإعداد</span>'}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    return shell('settings', body);
  }

  // ─── Reports page ──────────────────────────────────
  async function renderReports() {
    const govDist = await ApplicantsService.getDistribution('governorate');
    const stageDist = await ApplicantsService.getDistribution('stageLabel');
    const last14 = window.MockData.last14Days;

    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">📊</span> التقارير والإحصائيات',
        'تقارير شاملة قابلة للتصدير لـ Excel/Word/PDF',
        `<button class="btn btn-primary">${UI.Icons.download} تصدير الكل</button>`
      )}

      <div class="grid grid-2 mb-5">
        <div class="card">
          <div class="card-header"><div class="card-title">معدل التسجيل والدفع</div></div>
          <div class="card-body">${Charts.line(last14.map(d => ({ label: d.label, value: d.payments })), { color: '#1A8754' })}</div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">توزيع المراحل</div></div>
          <div class="card-body">${Charts.donut(stageDist.slice(0, 6))}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">التوزيع الجغرافي الكامل</div></div>
        <div class="card-body">${Charts.bar(govDist.slice(0, 12), { color: '#1B3A6B', height: 240 })}</div>
      </div>
    `;
    return shell('reports', body);
  }

  // ─── Helpers ──────────────────────────────────────
  function statusBadge(s, large) {
    const map = {
      'approved':           { c: 'success', t: 'تم القبول' },
      'rejected':           { c: 'danger',  t: 'مرفوض' },
      'under-review':       { c: 'info',    t: 'قيد المراجعة' },
      'pending':            { c: 'warning', t: 'جديد' },
      'on-hold':            { c: 'neutral', t: 'إيقاف' },
      'documents-required': { c: 'warning', t: 'مطلوب مستندات' },
    };
    const m = map[s] || { c: 'neutral', t: s };
    return `<span class="badge badge-${m.c} ${large ? 'text-md' : ''}" ${large ? 'style="padding:6px 14px;font-size:14px;"' : ''}>${m.t}</span>`;
  }

  function actionIcon(a) {
    const icons = { create: '+', update: '✎', delete: '✕', view: '👁', login: '→', export: '↓' };
    return icons[a] || '•';
  }

  function attach() {
    Shell.attachShellEvents();
    document.querySelectorAll('.applicant-row, .recent-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        if (id) location.hash = '#/admin/applicants/' + id;
      });
    });
  }

  window.AdminPage = {
    renderDashboard,
    renderApplicants,
    renderApplicantDetail,
    renderUsers,
    renderAudit,
    renderSettings,
    renderReports,
    attach,
  };
})();
