/**
 * Committees (2.1) — admission committees management
 */
(function() {
  'use strict';

  const APP = { key: 'committee', icon: '📋', title: 'لجان القبول' };

  const NAV = [{ items: [
    { key: 'overview',  icon: '📊', label: 'نظرة عامة',         path: '/committee' },
    { key: 'list',      icon: '📋', label: 'كل اللجان',          path: '/committee/list' },
    { key: 'schedule',  icon: '📅', label: 'الجدول الزمني',     path: '/committee/schedule' },
  ]}];

  function shell(activeKey, body) {
    return `
      <div class="shell shell-with-sidebar" data-app="committee">
        ${Shell.appHeader(APP)}
        ${Shell.sidebar(NAV, activeKey, 'committee')}
        <main class="main">${body}</main>
      </div>
    `;
  }

  async function renderOverview() {
    const committees = await CommitteesService.list();
    const total = committees.reduce((s, c) => s + c.applicants, 0);
    const completed = committees.reduce((s, c) => s + c.completed, 0);

    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">📋</span> لجان القبول',
        'إدارة وتنسيق أعمال لجان قبول المتقدمين',
        `<button class="btn btn-primary">${UI.Icons.plus} لجنة جديدة</button>`
      )}

      <div class="grid grid-4 mb-5">
        <div class="stat">
          <div class="stat-header">
            <span class="stat-label">عدد اللجان</span>
            <span class="stat-icon" style="background:#E5DEF5;color:#6B46C1;">📋</span>
          </div>
          <div class="stat-value">${committees.length}</div>
        </div>
        <div class="stat">
          <div class="stat-header">
            <span class="stat-label">إجمالي المتقدمين</span>
            <span class="stat-icon" style="background:#DDE7F2;color:#2D5BA0;">👥</span>
          </div>
          <div class="stat-value">${UI.num(total)}</div>
        </div>
        <div class="stat">
          <div class="stat-header">
            <span class="stat-label">تم الفحص</span>
            <span class="stat-icon" style="background:#D7F0E1;color:#1A8754;">✓</span>
          </div>
          <div class="stat-value">${UI.num(completed)}</div>
        </div>
        <div class="stat">
          <div class="stat-header">
            <span class="stat-label">معدل الإنجاز</span>
            <span class="stat-icon" style="background:#FBE9CC;color:#B8770A;">📈</span>
          </div>
          <div class="stat-value">${Math.round(completed/total*100)}%</div>
        </div>
      </div>

      <div class="grid grid-cols-auto">
        ${committees.map(c => `
          <div class="card" style="cursor:pointer;" data-id="${c.id}">
            <div class="card-header">
              <div>
                <div class="card-title">${UI.escape(c.name)}</div>
                <div class="card-subtitle">${UI.escape(c.head)}</div>
              </div>
              <span class="badge badge-brand">${c.id}</span>
            </div>
            <div class="card-body">
              <div class="grid grid-2 gap-3 mb-4">
                <div>
                  <div class="text-xs text-tertiary">الأعضاء</div>
                  <div style="font-weight:700;font-size:18px;" class="num">${c.members}</div>
                </div>
                <div>
                  <div class="text-xs text-tertiary">المتقدمون</div>
                  <div style="font-weight:700;font-size:18px;" class="num">${c.applicants}</div>
                </div>
              </div>
              <div class="text-xs text-tertiary mb-2">معدل الإنجاز</div>
              <div class="progress mb-2">
                <div class="progress-fill success" style="width:${(c.completed/c.applicants)*100}%;"></div>
              </div>
              <div class="text-xs text-tertiary num">${c.completed} / ${c.applicants}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    return shell('overview', body);
  }

  async function renderList() {
    const all = window.MockData.applicants.slice(0, 60);
    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">👥</span> المتقدمون عبر اللجان', `${all.length} متقدم`)}

      <div class="filters">
        <div class="search"><input class="input" placeholder="بحث">${UI.Icons.search}</div>
        <select class="select">
          <option>كل اللجان</option>
          ${window.MockData.committees.map(c => `<option>${c.name}</option>`).join('')}
        </select>
      </div>

      <div class="card">
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead><tr><th>رقم الطلب</th><th>الاسم</th><th>اللجنة</th><th>المرحلة</th><th>الحالة</th></tr></thead>
            <tbody>
              ${all.map(a => `
                <tr>
                  <td><span class="mono text-xs">${a.id}</span></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div class="avatar avatar-sm">${UI.escape(a.name[0])}</div>
                      <span>${UI.escape(a.name.split(' ').slice(0,3).join(' '))}</span>
                    </div>
                  </td>
                  <td>${UI.escape(a.committee)}</td>
                  <td><span class="text-xs">${UI.escape(a.stageLabel)}</span></td>
                  <td>${
                    a.status === 'approved' ? '<span class="badge badge-success">قُبل</span>' :
                    a.status === 'rejected' ? '<span class="badge badge-danger">رُفض</span>' :
                    '<span class="badge badge-warning">قيد المراجعة</span>'
                  }</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return shell('list', body);
  }

  async function renderSchedule() {
    const days = window.MockData.last14Days.slice(-7);
    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">📅</span> الجدول الزمني', 'مواعيد عمل اللجان للأسبوع الحالي')}

      <div class="card">
        <div class="card-body">
          ${days.map((d, i) => `
            <div style="display:flex;align-items:center;gap:16px;padding:16px;border-bottom:1px solid var(--border-subtle);">
              <div style="width:60px;text-align:center;flex-shrink:0;">
                <div style="font-size:22px;font-weight:700;color:var(--brand-primary);">${new Date(d.date).getDate()}</div>
                <div class="text-xs text-tertiary">${['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][new Date(d.date).getDay()]}</div>
              </div>
              <div style="flex:1;">
                <div style="font-weight:600;">دورة اختبار يومية</div>
                <div class="text-xs text-tertiary mt-2">8:00 ص - 4:00 م · ${d.tests} متقدم</div>
              </div>
              <div style="display:flex;gap:6px;">
                ${window.MockData.committees.slice(0, 3).map(c => `<span class="chip">${c.name}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    return shell('schedule', body);
  }

  function attach() { Shell.attachShellEvents(); }

  window.CommitteePage = { renderOverview, renderList, renderSchedule, attach };
})();
