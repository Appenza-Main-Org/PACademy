/**
 * Investigations (2.3)
 */
(function() {
  'use strict';

  const APP = { key: 'investigations', icon: '🔍', title: 'التحريات' };

  const NAV = [{ items: [
    { key: 'cases',     icon: '📁', label: 'الحالات',           path: '/investigations' },
    { key: 'incoming',  icon: '⬇️', label: 'الوارد',           path: '/investigations/incoming' },
    { key: 'outgoing',  icon: '⬆️', label: 'الصادر',            path: '/investigations/outgoing' },
  ]}];

  function shell(activeKey, body) {
    return `
      <div class="shell shell-with-sidebar" data-app="investigations">
        ${Shell.appHeader(APP)}
        ${Shell.sidebar(NAV, activeKey, 'investigations')}
        <main class="main">${body}</main>
      </div>
    `;
  }

  async function renderCases() {
    const stats = await InvestigationsService.getStats();
    const cases = await InvestigationsService.getCases();

    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">🔍</span> ملفات التحريات',
        'متابعة سرّية لإجراءات التحريات على المتقدمين',
        `<button class="btn btn-primary">${UI.Icons.plus} ملف جديد</button>`
      )}

      <div class="alert alert-warning mb-5">
        <span class="alert-icon">🔒</span>
        <div class="alert-body">
          <div class="alert-title">معلومات سرية للغاية</div>
          <div>كل العمليات على هذه الشاشة مسجّلة في سجل العمليات. يُمنع تصدير بيانات إلا بإذن مكتوب.</div>
        </div>
      </div>

      <div class="grid grid-4 mb-5">
        ${[
          { label: 'إجمالي الحالات', value: stats.total, icon: '📁', tone: '#B82C2C', bg: '#FBD6D6' },
          { label: 'قيد التحرّي',    value: stats.pending, icon: '⏳', tone: '#B8770A', bg: '#FBE9CC' },
          { label: 'تمت الموافقة',   value: stats.cleared, icon: '✓',  tone: '#1A8754', bg: '#D7F0E1' },
          { label: 'تحتاج مراجعة',   value: stats.flagged, icon: '⚠️', tone: '#B82C2C', bg: '#FBD6D6' },
        ].map(s => `
          <div class="stat">
            <div class="stat-header">
              <span class="stat-label">${s.label}</span>
              <span class="stat-icon" style="background:${s.bg};color:${s.tone};">${s.icon}</span>
            </div>
            <div class="stat-value">${UI.num(s.value)}</div>
          </div>
        `).join('')}
      </div>

      <div class="filters">
        <div class="search"><input class="input" placeholder="بحث بالاسم أو الرقم القومي">${UI.Icons.search}</div>
        <select class="select" id="filter-inv-status">
          <option value="">كل الحالات</option>
          <option value="pending">قيد التحرّي</option>
          <option value="cleared">تمت الموافقة</option>
          <option value="flagged">تحتاج مراجعة</option>
        </select>
      </div>

      <div class="card">
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead>
              <tr><th>رقم الطلب</th><th>الاسم</th><th>المحافظة</th><th>المحقق</th><th>الإرسال</th><th>الاستلام</th><th>الحالة</th><th></th></tr>
            </thead>
            <tbody>
              ${cases.slice(0, 30).map(c => `
                <tr>
                  <td><span class="mono text-xs">${c.applicantId}</span></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div class="avatar avatar-sm">${UI.escape(c.applicantName[0])}</div>
                      <span>${UI.escape(c.applicantName.split(' ').slice(0,3).join(' '))}</span>
                    </div>
                  </td>
                  <td>${UI.escape(c.governorate)}</td>
                  <td><span class="text-sm">${UI.escape(c.officer.split(' ').slice(0,3).join(' '))}</span></td>
                  <td><span class="text-xs">${UI.date(c.sentAt, 'short')}</span></td>
                  <td><span class="text-xs">${c.receivedAt ? UI.date(c.receivedAt, 'short') : '—'}</span></td>
                  <td>${
                    c.status === 'cleared' ? '<span class="badge badge-success">موافقة</span>' :
                    c.status === 'flagged' ? '<span class="badge badge-danger">يحتاج مراجعة</span>' :
                    '<span class="badge badge-warning">قيد التحرّي</span>'
                  }</td>
                  <td><button class="btn btn-ghost btn-icon btn-sm">${UI.Icons.eye}</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return shell('cases', body);
  }

  async function renderIncoming() {
    return shell('incoming', `
      ${Shell.pageHead('<span style="font-size:24px;">⬇️</span> الوارد', 'سجل الردود الواردة من إدارة التحريات')}

      <div class="card">
        <div class="card-body">
          ${Array.from({length: 10}).map((_, i) => `
            <div style="display:flex;gap:16px;padding:14px 0;border-bottom:1px solid var(--border-subtle);">
              <div style="width:40px;height:40px;border-radius:8px;background:#FBD6D6;color:#B82C2C;display:flex;align-items:center;justify-content:center;flex-shrink:0;">⬇️</div>
              <div style="flex:1;">
                <div style="font-weight:600;">رد التحرّي رقم INV-2026-${String(i+1).padStart(4,'0')}</div>
                <div class="text-xs text-tertiary mt-2">من إدارة التحريات بمحافظة ${UI.escape(window.MockData.governorates[i % window.MockData.governorates.length])} · ${UI.date(Date.now() - i*86400000, 'rel')}</div>
              </div>
              <span class="badge badge-success">${i % 3 === 0 ? 'موافقة' : 'تحقّق'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  async function renderOutgoing() {
    return shell('outgoing', `
      ${Shell.pageHead('<span style="font-size:24px;">⬆️</span> الصادر', 'الطلبات المُرسلة لإدارة التحريات')}

      <div class="card">
        <div class="card-body">
          ${Array.from({length: 12}).map((_, i) => `
            <div style="display:flex;gap:16px;padding:14px 0;border-bottom:1px solid var(--border-subtle);">
              <div style="width:40px;height:40px;border-radius:8px;background:#FBE9CC;color:#B8770A;display:flex;align-items:center;justify-content:center;flex-shrink:0;">⬆️</div>
              <div style="flex:1;">
                <div style="font-weight:600;">طلب تحرّي #SND-${String(i+1).padStart(4,'0')}</div>
                <div class="text-xs text-tertiary mt-2">إلى إدارة التحريات بمحافظة ${UI.escape(window.MockData.governorates[i % 12])} · ${UI.date(Date.now() - i*43200000, 'rel')}</div>
              </div>
              <span class="badge ${i % 4 === 0 ? 'badge-success' : 'badge-warning'}">${i % 4 === 0 ? 'وصل' : 'منتظر'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  function attach() { Shell.attachShellEvents(); }

  window.InvestigationsPage = { renderCases, renderIncoming, renderOutgoing, attach };
})();
