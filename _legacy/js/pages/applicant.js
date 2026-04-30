/**
 * Applicant Site (1.2)
 * Public-facing application portal for student applicants.
 */
(function() {
  'use strict';

  const APP = { key: 'applicant', icon: '🎓', title: 'موقع المتقدمين' };

  const STAGES = [
    { key: 'register',     icon: '📝', label: 'تسجيل أولي',          desc: 'بيانات أساسية + رقم قومي' },
    { key: 'payment',      icon: '💳', label: 'سداد رسوم',           desc: '1,500 جنيه إلكترونياً' },
    { key: 'family',       icon: '👨‍👩‍👧', label: 'بيانات الأسرة',     desc: 'الوالدين والإخوة' },
    { key: 'relatives',    icon: '👥', label: 'بيانات الأقارب',       desc: 'وثيقة التعارف' },
    { key: 'documents',    icon: '📎', label: 'رفع المستندات',       desc: 'صور الشهادات والبطاقة' },
    { key: 'appointment',  icon: '📅', label: 'موعد الاختبار',       desc: 'تحديد ميعاد القومسيون' },
    { key: 'card',         icon: '🎫', label: 'كارت تردد',          desc: 'طباعة الكارت بالباركود' },
    { key: 'medical',      icon: '🩺', label: 'القومسيون الطبي',    desc: '8 عيادات طبية' },
    { key: 'fitness',      icon: '🏃', label: 'اختبار اللياقة',      desc: 'الجري والقوة العامة' },
    { key: 'interview',    icon: '💬', label: 'المقابلة الشخصية',     desc: 'لجنة الهيئة' },
    { key: 'final-exam',   icon: '📝', label: 'الاختبار النهائي',     desc: 'اختبار إلكتروني MCQ' },
  ];

  function render() {
    // For demo: pretend currentStage = 4 (rfp/documents stage)
    const currentStageIdx = 4;

    return `
      <div style="background:linear-gradient(180deg,#F0F5FB 0%,#F7F9FC 100%);min-height:100vh;">
        ${headerBar()}

        <main class="main" style="max-width:1100px;margin:0 auto;">
          ${heroSection()}
          ${progressSection(currentStageIdx)}
          ${currentStageContent(currentStageIdx)}
          ${supportSection()}
        </main>
      </div>
    `;
  }

  function headerBar() {
    const auth = Store.get('auth');
    return `
      <header class="header" style="background:white;">
        <div class="header-left">
          <a href="#/" class="brand" style="text-decoration:none;">
            <div class="brand-logo">${UI.Icons.shield}</div>
            <div class="brand-text">
              <span>منظومة القبول</span>
              <span>أكاديمية الشرطة</span>
            </div>
          </a>
        </div>
        <div class="header-right">
          <div class="chip">${UI.Icons.lock} اتصال آمن</div>
          ${auth ? `
            <div class="user-menu">
              <div class="avatar">${UI.escape(auth.name?.[0] || 'م')}</div>
              <div class="user-menu-info">
                <span class="user-menu-name">${UI.escape(auth.name?.split(' ').slice(0,2).join(' ') || 'متقدم')}</span>
                <span class="user-menu-role">رقم الطلب: 2026000142</span>
              </div>
            </div>
          ` : ''}
          <button class="btn btn-ghost btn-icon" id="logout-btn">${UI.Icons.logout}</button>
        </div>
      </header>
    `;
  }

  function heroSection() {
    return `
      <div style="background:linear-gradient(135deg,#1B3A6B 0%,#2D5BA0 100%);border-radius:14px;padding:32px;color:white;margin-bottom:24px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-50px;right:-50px;width:250px;height:250px;background:radial-gradient(circle,rgba(201,169,97,0.2),transparent 70%);border-radius:50%;"></div>
        <h1 style="color:white;font-size:26px;margin-bottom:12px;position:relative;">أهلاً بك في منظومة القبول الإلكتروني</h1>
        <p style="opacity:0.92;line-height:1.9;max-width:700px;position:relative;">تابع حالة طلبك خطوة بخطوة. كل المراحل تتم إلكترونياً بصورة آمنة، ويمكنك حفظ بياناتك واستئناف التقدم في أي وقت.</p>
        <div style="display:flex;gap:24px;margin-top:20px;position:relative;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;opacity:0.92;">
            <span>📋</span><span>رقم الطلب: <span class="mono">APP-2026000142</span></span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;opacity:0.92;">
            <span>📅</span><span>تم البدء: ${UI.date(Date.now() - 5*24*3600*1000)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;opacity:0.92;">
            <span class="status-dot online"></span><span>الحالة: نشط</span>
          </div>
        </div>
      </div>
    `;
  }

  function progressSection(currentIdx) {
    return `
      <div class="card mb-5">
        <div class="card-header">
          <div class="card-title">مراحل التقدم</div>
          <span class="badge badge-info">المرحلة ${currentIdx + 1} من ${STAGES.length}</span>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
            ${STAGES.map((s, i) => {
              const state = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'pending';
              return `
                <div class="stage-item ${state}" style="
                  text-align:center;padding:14px 10px;border-radius:10px;
                  background:${state === 'done' ? '#D7F0E1' : state === 'current' ? '#DDE7F2' : '#F7F9FC'};
                  border:1px solid ${state === 'done' ? '#1A8754' : state === 'current' ? '#2D5BA0' : '#E2E8F0'};
                  ${state === 'current' ? 'box-shadow: 0 0 0 3px #DDE7F2;' : ''}
                ">
                  <div style="font-size:24px;margin-bottom:4px;">${state === 'done' ? '✓' : s.icon}</div>
                  <div style="font-size:11px;font-weight:600;color:${state === 'done' ? '#1A8754' : state === 'current' ? '#2D5BA0' : '#8B95A5'};">${UI.escape(s.label)}</div>
                  <div style="font-size:10px;color:#8B95A5;margin-top:2px;">${UI.escape(s.desc)}</div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="progress mt-5">
            <div class="progress-fill" style="width:${((currentIdx)/(STAGES.length-1))*100}%;"></div>
          </div>
        </div>
      </div>
    `;
  }

  function currentStageContent(currentIdx) {
    const stage = STAGES[currentIdx];
    return `
      <div class="card mb-5">
        <div class="card-header">
          <div>
            <div class="card-title">${stage.icon} ${UI.escape(stage.label)}</div>
            <div class="card-subtitle">${UI.escape(stage.desc)}</div>
          </div>
          <span class="badge badge-warning">قيد الإكمال</span>
        </div>
        <div class="card-body">
          <div class="alert alert-info mb-4">
            <span class="alert-icon">ℹ️</span>
            <div class="alert-body">
              <div class="alert-title">المرحلة الحالية: رفع المستندات</div>
              <div>يرجى رفع المستندات التالية بصيغة PDF أو JPG، ولا يزيد حجم كل ملف عن 5 ميجا.</div>
            </div>
          </div>

          <div class="grid grid-2 gap-4">
            ${[
              { name: 'صورة شهادة الميلاد', required: true, uploaded: true, file: 'birth_cert.pdf' },
              { name: 'صورة بطاقة الرقم القومي', required: true, uploaded: true, file: 'national_id.pdf' },
              { name: 'بيان درجات الثانوية العامة', required: true, uploaded: true, file: 'cert.pdf' },
              { name: 'صورة شخصية حديثة', required: true, uploaded: false, file: null },
              { name: 'صحيفة الحالة الجنائية', required: false, uploaded: false, file: null },
              { name: 'موافقة ولي الأمر', required: true, uploaded: false, file: null },
            ].map(d => `
              <div style="
                padding:16px;
                border:1px dashed ${d.uploaded ? 'var(--success)' : 'var(--border-default)'};
                background:${d.uploaded ? 'var(--success-bg)' : 'white'};
                border-radius:10px;
                display:flex;
                gap:12px;
                align-items:center;
              ">
                <div style="
                  width:44px;height:44px;border-radius:8px;
                  background:${d.uploaded ? 'var(--success)' : 'var(--surface-muted)'};
                  color:${d.uploaded ? 'white' : 'var(--text-tertiary)'};
                  display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;
                ">${d.uploaded ? '✓' : '📎'}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;font-size:13px;">${UI.escape(d.name)} ${d.required ? '<span style="color:var(--danger);">*</span>' : ''}</div>
                  <div class="text-xs text-tertiary mt-2">
                    ${d.uploaded ? `<span class="mono">${d.file}</span> · تم الرفع ✓` : 'لم يتم رفع المستند بعد'}
                  </div>
                </div>
                ${d.uploaded ?
                  `<button class="btn btn-ghost btn-icon btn-sm">${UI.Icons.eye}</button>` :
                  `<button class="btn btn-primary btn-sm">${UI.Icons.upload} رفع</button>`}
              </div>
            `).join('')}
          </div>

          <div style="display:flex;justify-content:space-between;margin-top:24px;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-secondary">${UI.Icons.arrowRight} المرحلة السابقة</button>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-ghost">حفظ كمسودة</button>
              <button class="btn btn-primary">إكمال والمرحلة التالية ${UI.Icons.arrowLeft}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function supportSection() {
    return `
      <div class="grid grid-3 mb-6">
        <div class="card" style="text-align:center;padding:24px;">
          <div style="font-size:32px;margin-bottom:8px;">📞</div>
          <div style="font-weight:600;margin-bottom:4px;">خط الدعم الفني</div>
          <div class="text-sm text-tertiary mb-3">من الأحد للخميس، 9 ص - 5 م</div>
          <div class="mono" style="font-weight:600;color:var(--brand-primary);">19999</div>
        </div>
        <div class="card" style="text-align:center;padding:24px;">
          <div style="font-size:32px;margin-bottom:8px;">📧</div>
          <div style="font-weight:600;margin-bottom:4px;">البريد الإلكتروني</div>
          <div class="text-sm text-tertiary mb-3">رد خلال 48 ساعة</div>
          <div class="mono text-sm" style="color:var(--brand-primary);">support@academy.gov.eg</div>
        </div>
        <div class="card" style="text-align:center;padding:24px;">
          <div style="font-size:32px;margin-bottom:8px;">❓</div>
          <div style="font-weight:600;margin-bottom:4px;">الأسئلة الشائعة</div>
          <div class="text-sm text-tertiary mb-3">إجابات لأكثر الأسئلة شيوعاً</div>
          <button class="btn btn-secondary btn-sm">عرض الأسئلة</button>
        </div>
      </div>
    `;
  }

  function attach() {
    Shell.attachShellEvents();
  }

  window.ApplicantPage = { render, attach };
})();
