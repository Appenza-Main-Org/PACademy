/**
 * Biometric Registration & Verification (2.6)
 */
(function() {
  'use strict';

  const APP = { key: 'biometric', icon: '👁️', title: 'البيومتري' };

  const NAV = [{ items: [
    { key: 'verify',  icon: '👁️', label: 'التحقق',           path: '/biometric' },
    { key: 'enroll',  icon: '➕', label: 'تسجيل بيومتري',     path: '/biometric/enroll' },
    { key: 'history', icon: '📋', label: 'سجل العمليات',      path: '/biometric/history' },
  ]}];

  function shell(activeKey, body) {
    return `
      <div class="shell shell-with-sidebar" data-app="biometric">
        ${Shell.appHeader(APP)}
        ${Shell.sidebar(NAV, activeKey, 'biometric')}
        <main class="main">${body}</main>
      </div>
    `;
  }

  async function renderVerify() {
    const sample = window.MockData.applicants[0];
    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">👁️</span> التحقق البيومتري',
        'التحقق من هوية المتقدمين قبل الدخول للجان أو الاختبارات'
      )}

      <div class="grid grid-2 gap-5">
        <div class="card">
          <div class="card-header">
            <div class="card-title">التعرف على الوجه</div>
            <span class="badge badge-success badge-dot">الكاميرا متصلة</span>
          </div>
          <div class="card-body">
            <div class="biometric-scan">
              <div class="biometric-frame">👤</div>
              <div class="biometric-status">جارٍ المسح...</div>
              <div class="biometric-match">تطابق 96.4%</div>
              <div style="margin-top:12px;font-size:12px;opacity:0.7;">
                ${UI.escape(sample.name)} · <span class="mono">${sample.id}</span>
              </div>
            </div>

            <div style="display:flex;gap:8px;margin-top:16px;">
              <button class="btn btn-secondary" style="flex:1;">إعادة المسح</button>
              <button class="btn btn-primary" id="verify-face-btn" style="flex:1;">${UI.Icons.check} اعتماد الهوية</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">بصمة الإصبع</div>
            <span class="badge badge-success badge-dot">الجهاز متصل</span>
          </div>
          <div class="card-body">
            <div class="biometric-scan" style="background:linear-gradient(135deg,#142C50,#0F1A2E);">
              <div class="biometric-frame" style="font-size:90px;">👆</div>
              <div class="biometric-status">ضع إصبعك على القارئ</div>
              <div style="display:flex;gap:6px;justify-content:center;margin-top:14px;">
                ${[0,1,2,3,4].map(i => `
                  <div style="width:20px;height:24px;border:2px solid ${i < 3 ? '#C9A961' : 'rgba(255,255,255,0.3)'};border-radius:4px;background:${i < 3 ? 'rgba(201,169,97,0.3)' : 'transparent'};"></div>
                `).join('')}
              </div>
              <div style="margin-top:10px;font-size:12px;opacity:0.7;">جودة البصمة: 78%</div>
            </div>

            <div style="display:flex;gap:8px;margin-top:16px;">
              <button class="btn btn-secondary" style="flex:1;">إلغاء</button>
              <button class="btn btn-primary" style="flex:1;">${UI.Icons.fingerprint} مسح البصمة</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-5">
        <div class="card-header">
          <div class="card-title">آخر عمليات التحقق</div>
        </div>
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead><tr><th>التوقيت</th><th>المتقدم</th><th>النوع</th><th>التطابق</th><th>المنفذ</th><th>الحالة</th></tr></thead>
            <tbody>
              ${window.MockData.applicants.slice(0, 8).map((a, i) => {
                const score = (88 + Math.random()*11).toFixed(1);
                const ok = score > 90;
                return `
                  <tr>
                    <td><span class="text-xs">${UI.date(Date.now() - i*180000, 'time')}</span></td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <div class="avatar avatar-sm">${UI.escape(a.name[0])}</div>
                        <span>${UI.escape(a.name.split(' ').slice(0,3).join(' '))}</span>
                      </div>
                    </td>
                    <td>${i % 2 === 0 ? '👤 وجه' : '👆 بصمة'}</td>
                    <td><span class="num font-bold">${score}%</span></td>
                    <td>بوابة ${(i % 3) + 1}</td>
                    <td>${ok ? '<span class="badge badge-success">معتمد</span>' : '<span class="badge badge-danger">يحتاج تحقق</span>'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return shell('verify', body);
  }

  async function renderEnroll() {
    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">➕</span> تسجيل بيومتري جديد', 'إضافة بصمة ومسح وجه لمتقدم جديد')}

      <div class="card" style="max-width:680px;margin:0 auto;">
        <div class="card-body">
          <div class="steps mb-5">
            <div class="step done"><div class="step-dot">✓</div><span>اختيار المتقدم</span></div>
            <div class="step-line"></div>
            <div class="step current"><div class="step-dot">2</div><span>مسح الوجه</span></div>
            <div class="step-line"></div>
            <div class="step"><div class="step-dot">3</div><span>بصمة الأصابع</span></div>
            <div class="step-line"></div>
            <div class="step"><div class="step-dot">4</div><span>تأكيد</span></div>
          </div>

          <div class="biometric-scan">
            <div class="biometric-frame">📷</div>
            <div class="biometric-status">انظر مباشرة للكاميرا...</div>
            <div style="margin-top:16px;display:flex;justify-content:center;gap:16px;">
              <div>
                <div style="font-size:11px;opacity:0.6;">الإضاءة</div>
                <div style="color:#1A8754;">جيدة ✓</div>
              </div>
              <div>
                <div style="font-size:11px;opacity:0.6;">التوازن</div>
                <div style="color:#1A8754;">مقبول ✓</div>
              </div>
              <div>
                <div style="font-size:11px;opacity:0.6;">جودة الصورة</div>
                <div style="color:#C9A961;">94%</div>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end;">
            <button class="btn btn-secondary">السابق</button>
            <button class="btn btn-primary">التقاط واكمال ${UI.Icons.arrowLeft}</button>
          </div>
        </div>
      </div>
    `;
    return shell('enroll', body);
  }

  async function renderHistory() {
    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">📋</span> سجل العمليات', 'كل عمليات التحقق البيومتري')}

      <div class="card">
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead><tr><th>التوقيت</th><th>المتقدم</th><th>النوع</th><th>التطابق</th><th>الموقع</th><th>المُنفّذ</th></tr></thead>
            <tbody>
              ${window.MockData.applicants.slice(0, 25).map((a, i) => {
                const isFace = i % 2 === 0;
                const score = (87 + Math.random()*12).toFixed(1);
                return `
                  <tr>
                    <td><span class="text-xs">${UI.date(Date.now() - i*420000, 'rel')}</span></td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <div class="avatar avatar-sm">${UI.escape(a.name[0])}</div>
                        <span>${UI.escape(a.name.split(' ').slice(0,3).join(' '))}</span>
                      </div>
                    </td>
                    <td>${isFace ? '<span class="badge badge-info">وجه</span>' : '<span class="badge badge-brand">بصمة</span>'}</td>
                    <td><span class="num font-bold">${score}%</span></td>
                    <td>بوابة ${(i % 4) + 1}</td>
                    <td><span class="text-xs">الملازم أول عمر حازم</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return shell('history', body);
  }

  function attach() { Shell.attachShellEvents(); }

  window.BiometricPage = { renderVerify, renderEnroll, renderHistory, attach };
})();
