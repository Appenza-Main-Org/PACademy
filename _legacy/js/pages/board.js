/**
 * Board & Secretariat (2.2)
 */
(function() {
  'use strict';

  const APP = { key: 'board', icon: '⚖️', title: 'الهيئة وأمانة السر' };

  const NAV = [{ items: [
    { key: 'overview',  icon: '🏛️', label: 'نظرة عامة',         path: '/board' },
    { key: 'sessions',  icon: '📅', label: 'جلسات الهيئة',       path: '/board/sessions' },
    { key: 'decisions', icon: '⚖️', label: 'القرارات',           path: '/board/decisions' },
  ]}];

  function shell(activeKey, body) {
    return `
      <div class="shell shell-with-sidebar" data-app="board">
        ${Shell.appHeader(APP)}
        ${Shell.sidebar(NAV, activeKey, 'board')}
        <main class="main">${body}</main>
      </div>
    `;
  }

  async function renderOverview() {
    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">⚖️</span> الهيئة وأمانة السر',
        'إدارة جلسات الهيئة وقرارات قبول المتقدمين'
      )}

      <div class="grid grid-4 mb-5">
        ${[
          { label: 'إجمالي الجلسات', value: 12, icon: '📅', tone: '#B8770A', bg: '#FBE9CC' },
          { label: 'قرارات صادرة', value: 187, icon: '⚖️', tone: '#1A8754', bg: '#D7F0E1' },
          { label: 'حالات قيد البحث', value: 23, icon: '⏳', tone: '#2D5BA0', bg: '#DDE7F2' },
          { label: 'الجلسة القادمة', value: 'الخميس', icon: '🔔', tone: '#7C2D8E', bg: '#EBD8F0' },
        ].map(s => `
          <div class="stat">
            <div class="stat-header">
              <span class="stat-label">${s.label}</span>
              <span class="stat-icon" style="background:${s.bg};color:${s.tone};">${s.icon}</span>
            </div>
            <div class="stat-value" style="font-size:${typeof s.value === 'string' ? '20px' : '30px'};">${typeof s.value === 'number' ? UI.num(s.value) : s.value}</div>
          </div>
        `).join('')}
      </div>

      <div class="grid grid-2 gap-4">
        <div class="card">
          <div class="card-header">
            <div class="card-title">أعضاء الهيئة</div>
            <span class="badge badge-brand">7 أعضاء</span>
          </div>
          <div class="card-body">
            ${[
              { name: 'اللواء أ.ح. د. محمد سالم', role: 'رئيس الهيئة', branch: 'القيادة العامة' },
              { name: 'اللواء أحمد محمود الفقي', role: 'عضو', branch: 'كلية الشرطة' },
              { name: 'العميد د. طارق الديب', role: 'عضو', branch: 'الأكاديمية' },
              { name: 'العميد محمد إبراهيم حسن', role: 'عضو', branch: 'لجان القبول' },
              { name: 'العقيد أيمن شريف رمضان', role: 'أمين السر', branch: 'الأكاديمية' },
            ].map(m => `
              <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border-subtle);">
                <div class="avatar">${UI.escape(m.name.split(' ')[1][0] || m.name[0])}</div>
                <div style="flex:1;">
                  <div style="font-weight:600;font-size:14px;">${UI.escape(m.name)}</div>
                  <div class="text-xs text-tertiary mt-2">${UI.escape(m.branch)}</div>
                </div>
                <span class="badge ${m.role === 'رئيس الهيئة' ? 'badge-accent' : 'badge-neutral'}">${UI.escape(m.role)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">آخر القرارات</div>
            <button class="btn btn-ghost btn-sm">عرض الكل</button>
          </div>
          <div class="card-body">
            ${[
              { title: 'قبول دفعة المرحلة الثانية', date: Date.now() - 24*3600*1000, type: 'success', count: 47 },
              { title: 'مراجعة حالات استثنائية',     date: Date.now() - 3*24*3600*1000, type: 'warning', count: 12 },
              { title: 'اعتماد قائمة الإيقاف',       date: Date.now() - 5*24*3600*1000, type: 'danger', count: 5 },
              { title: 'تعديل شروط القبول للأزهرية', date: Date.now() - 8*24*3600*1000, type: 'info', count: null },
            ].map(d => `
              <div style="display:flex;align-items:center;gap:12px;padding:14px;border-bottom:1px solid var(--border-subtle);">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--${d.type}-bg);color:var(--${d.type});display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">⚖</div>
                <div style="flex:1;">
                  <div style="font-weight:600;font-size:14px;">${UI.escape(d.title)}</div>
                  <div class="text-xs text-tertiary mt-2">${UI.date(d.date, 'rel')}${d.count ? ` · ${d.count} حالة` : ''}</div>
                </div>
                <button class="btn btn-ghost btn-icon btn-sm">${UI.Icons.eye}</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    return shell('overview', body);
  }

  async function renderSessions() {
    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">📅</span> جلسات الهيئة', 'سجل جلسات الهيئة وقرارتها')}

      <div class="card">
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead>
              <tr><th>رقم الجلسة</th><th>التاريخ</th><th>الموضوع</th><th>الحضور</th><th>القرارات</th><th>الحالة</th></tr>
            </thead>
            <tbody>
              ${Array.from({length: 12}).map((_, i) => `
                <tr style="cursor:pointer;">
                  <td><span class="mono text-xs">SES-2026-${String(12-i).padStart(3,'0')}</span></td>
                  <td>${UI.date(Date.now() - (i+1)*7*24*3600*1000)}</td>
                  <td>الجلسة الأسبوعية رقم ${12-i} لمراجعة طلبات القبول</td>
                  <td><span class="num">7/7</span></td>
                  <td><span class="num">${20 - i}</span> قرار</td>
                  <td>${i < 3 ? '<span class="badge badge-warning">قيد التنفيذ</span>' : '<span class="badge badge-success">مكتملة</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return shell('sessions', body);
  }

  async function renderDecisions() {
    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">⚖️</span> قرارات الهيئة', 'القرارات الصادرة بحق المتقدمين')}

      <div class="filters">
        <div class="search"><input class="input" placeholder="بحث في القرارات">${UI.Icons.search}</div>
        <select class="select"><option>كل الأنواع</option><option>قبول</option><option>رفض</option><option>إيقاف</option></select>
      </div>

      <div class="card">
        <div class="card-body">
          ${window.MockData.applicants.slice(0, 12).map(a => `
            <div style="display:flex;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid var(--border-subtle);">
              <div class="avatar">${UI.escape(a.name[0])}</div>
              <div style="flex:1;">
                <div style="font-weight:600;">${UI.escape(a.name.split(' ').slice(0,3).join(' '))}</div>
                <div class="text-xs text-tertiary mt-2"><span class="mono">${a.id}</span> · ${UI.escape(a.governorate)}</div>
              </div>
              <div style="text-align:left;">
                ${a.status === 'approved' ? '<span class="badge badge-success">قرار قبول</span>' :
                  a.status === 'rejected' ? '<span class="badge badge-danger">قرار رفض</span>' :
                  '<span class="badge badge-warning">قيد البحث</span>'}
                <div class="text-xs text-tertiary mt-2">${UI.date(Date.now() - Math.random()*30*24*3600*1000)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    return shell('decisions', body);
  }

  function attach() { Shell.attachShellEvents(); }

  window.BoardPage = { renderOverview, renderSessions, renderDecisions, attach };
})();
