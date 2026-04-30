/**
 * Medical Commission (2.4)
 */
(function() {
  'use strict';

  const APP = { key: 'medical', icon: '🩺', title: 'القومسيون الطبي' };

  const NAV = [{ items: [
    { key: 'overview', icon: '📊', label: 'نظرة عامة',     path: '/medical' },
    { key: 'queue',    icon: '👥', label: 'قوائم الانتظار', path: '/medical/queue' },
    { key: 'results',  icon: '📋', label: 'النتائج',         path: '/medical/results' },
  ]}];

  function shell(activeKey, body) {
    return `
      <div class="shell shell-with-sidebar" data-app="medical">
        ${Shell.appHeader(APP)}
        ${Shell.sidebar(NAV, activeKey, 'medical')}
        <main class="main">${body}</main>
      </div>
    `;
  }

  async function renderOverview() {
    const stations = await MedicalService.getStations();
    const totalQueue = stations.reduce((s, x) => s + x.queue, 0);
    const totalCompleted = stations.reduce((s, x) => s + x.completed, 0);

    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">🩺</span> القومسيون الطبي',
        'إدارة الاختبارات الطبية للمتقدمين عبر العيادات المتخصصة'
      )}

      <div class="grid grid-4 mb-5">
        ${[
          { label: 'العيادات النشطة', value: stations.length, icon: '🏥', tone: '#0E8E8E', bg: '#C8EBEB' },
          { label: 'في الانتظار',      value: totalQueue, icon: '⏳', tone: '#B8770A', bg: '#FBE9CC' },
          { label: 'تم الفحص اليوم',   value: totalCompleted, icon: '✓',  tone: '#1A8754', bg: '#D7F0E1' },
          { label: 'معدل الإنجاز',     value: Math.round(totalCompleted/(totalQueue+totalCompleted)*100) + '%', icon: '📈', tone: '#2D5BA0', bg: '#DDE7F2' },
        ].map(s => `
          <div class="stat">
            <div class="stat-header">
              <span class="stat-label">${s.label}</span>
              <span class="stat-icon" style="background:${s.bg};color:${s.tone};">${s.icon}</span>
            </div>
            <div class="stat-value">${s.value}</div>
          </div>
        `).join('')}
      </div>

      <div class="grid grid-cols-auto">
        ${stations.map(st => `
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">${UI.escape(st.name)}</div>
                <div class="card-subtitle">${UI.escape(st.doctor)}</div>
              </div>
              <span class="badge badge-info">${st.id}</span>
            </div>
            <div class="card-body">
              <div class="grid grid-2 gap-3 mb-4">
                <div>
                  <div class="text-xs text-tertiary">في الانتظار</div>
                  <div style="font-weight:700;font-size:22px;color:#B8770A;" class="num">${st.queue}</div>
                </div>
                <div>
                  <div class="text-xs text-tertiary">تم الفحص</div>
                  <div style="font-weight:700;font-size:22px;color:#1A8754;" class="num">${st.completed}</div>
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" style="width:100%;">عرض القائمة</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    return shell('overview', body);
  }

  async function renderQueue() {
    const stations = await MedicalService.getStations();
    const station = stations[0];
    const queue = await MedicalService.getQueue(station.id);

    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">👥</span> قائمة انتظار العيادات', 'فحص ومتابعة المرضى في الوقت الحالي')}

      <div class="filters">
        <select class="select" style="min-width:240px;">
          ${stations.map(s => `<option value="${s.id}">${s.name} (${s.queue} بالانتظار)</option>`).join('')}
        </select>
        <button class="btn btn-primary">${UI.Icons.plus} استدعاء التالي</button>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${UI.escape(station.name)} — ${UI.escape(station.doctor)}</div>
            <div class="card-subtitle">قائمة الانتظار الحالية</div>
          </div>
          <span class="badge badge-warning">${queue.length} مريض</span>
        </div>
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead><tr><th>الترتيب</th><th>الاسم</th><th>رقم الطلب</th><th>وقت الانتظار</th><th>الإجراءات</th></tr></thead>
            <tbody>
              ${queue.slice(0, 12).map((a, i) => `
                <tr>
                  <td><div style="width:32px;height:32px;border-radius:50%;background:${i === 0 ? 'var(--brand-primary)' : 'var(--surface-muted)'};color:${i === 0 ? 'white' : 'var(--text-secondary)'};display:flex;align-items:center;justify-content:center;font-weight:700;font-family:Inter;">${i+1}</div></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div class="avatar avatar-sm">${UI.escape(a.name[0])}</div>
                      <span>${UI.escape(a.name.split(' ').slice(0,3).join(' '))}</span>
                    </div>
                  </td>
                  <td><span class="mono text-xs">${a.id}</span></td>
                  <td><span class="text-xs">${5 + i*3} دقيقة</span></td>
                  <td>
                    ${i === 0 ?
                      '<span class="badge badge-success">قيد الفحص</span>' :
                      `<button class="btn btn-ghost btn-sm">استدعاء</button>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return shell('queue', body);
  }

  async function renderResults() {
    const data = window.MockData.applicants.filter(a => a.results.medical).slice(0, 30);
    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">📋</span> نتائج الفحوصات', 'سجل النتائج المُدخلة من الأطباء')}

      <div class="card">
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead><tr><th>المتقدم</th><th>التاريخ</th><th>الباطنة</th><th>العظام</th><th>العيون</th><th>الأسنان</th><th>المحصلة</th></tr></thead>
            <tbody>
              ${data.map(a => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div class="avatar avatar-sm">${UI.escape(a.name[0])}</div>
                      <span>${UI.escape(a.name.split(' ').slice(0,2).join(' '))}</span>
                    </div>
                  </td>
                  <td><span class="text-xs">${UI.date(Date.now() - Math.random()*30*86400000)}</span></td>
                  ${['medical','medical','medical','medical'].map(() => {
                    const ok = Math.random() > 0.15;
                    return `<td>${ok ? '<span style="color:var(--success);font-weight:700;">✓</span>' : '<span style="color:var(--danger);font-weight:700;">✗</span>'}</td>`;
                  }).join('')}
                  <td>${a.results.medical === 'pass' ?
                    '<span class="badge badge-success">صالح طبياً</span>' :
                    '<span class="badge badge-danger">غير صالح</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return shell('results', body);
  }

  function attach() { Shell.attachShellEvents(); }

  window.MedicalPage = { renderOverview, renderQueue, renderResults, attach };
})();
