/**
 * Login Page
 */
(function() {
  'use strict';

  const ROLES = [
    { key: 'super_admin',     icon: '👤', label: 'مدير النظام' },
    { key: 'committee_admin', icon: '📋', label: 'مدير لجنة' },
    { key: 'medical_admin',   icon: '🩺', label: 'القومسيون الطبي' },
    { key: 'investigator',    icon: '🔍', label: 'إدارة التحريات' },
    { key: 'board_admin',     icon: '⚖️', label: 'الهيئة' },
    { key: 'exams_admin',     icon: '📝', label: 'الاختبارات' },
    { key: 'biometric_user',  icon: '🛡️', label: 'بوابة الأمن' },
    { key: 'applicant',       icon: '🎓', label: 'متقدم' },
  ];

  function render() {
    return `
      <div class="login-shell">
        <div class="login-art">
          <div class="login-art-brand">
            <div class="brand-logo">${UI.Icons.shield}</div>
            <div class="brand-text">
              <span>منظومة القبول</span>
              <span>أكاديمية الشرطة</span>
            </div>
          </div>

          <div class="login-art-content">
            <h1>التحول الرقمي الكامل لإجراءات القبول والاختبارات</h1>
            <p>منظومة معلوماتية متكاملة تربط ٩ تطبيقات على مستوى الإنترنت والشبكة الداخلية،
            بمستوى أمان وتشفير معتمد، لإدارة كامل دورة المتقدم بدقة وشفافية.</p>

            <div class="login-art-stats">
              <div>
                <div class="login-art-stat-value">9</div>
                <div class="login-art-stat-label">تطبيقات مترابطة</div>
              </div>
              <div>
                <div class="login-art-stat-value">12K+</div>
                <div class="login-art-stat-label">متقدم سنوياً</div>
              </div>
              <div>
                <div class="login-art-stat-value">100%</div>
                <div class="login-art-stat-label">رقمنة الإجراءات</div>
              </div>
            </div>
          </div>

          <div class="login-art-foot">
            © 2026 وزارة الداخلية · أكاديمية الشرطة · جميع الحقوق محفوظة
          </div>
        </div>

        <div class="login-form-side">
          <div class="login-form">
            <h2>تسجيل الدخول</h2>
            <p>اختر دورك الوظيفي وأدخل بيانات الدخول للوصول إلى المنظومة.</p>

            <div class="field mb-4">
              <label class="field-label">الدور الوظيفي</label>
              <div class="login-roles">
                ${ROLES.map((r, i) => `
                  <div class="login-role ${i === 0 ? 'selected' : ''}" data-role="${r.key}">
                    <div class="login-role-icon">${r.icon}</div>
                    <div class="login-role-label">${r.label}</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="field mb-4">
              <label class="field-label">اسم المستخدم أو الرقم القومي</label>
              <input type="text" class="input" id="username" value="ahmed.fakhry" placeholder="أدخل اسم المستخدم">
            </div>

            <div class="field mb-5">
              <label class="field-label">كلمة المرور</label>
              <input type="password" class="input" id="password" value="********" placeholder="••••••••">
              <span class="field-help">للعرض التجريبي، يمكنك الضغط على "تسجيل الدخول" مباشرة.</span>
            </div>

            <button class="btn btn-primary w-full btn-lg" id="login-btn" style="width:100%;">
              تسجيل الدخول
              ${UI.Icons.arrowLeft}
            </button>

            <div class="alert alert-info mt-5">
              <span class="alert-icon">${UI.Icons.lock}</span>
              <div class="alert-body">
                <div class="alert-title">دخول آمن عبر منصة التحقق الرقمي</div>
                <div>يتم التحقق من هوية الضباط عبر API منصة التحقق الرقمي للحكومة المصرية.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function attach() {
    let selectedRole = 'super_admin';

    document.querySelectorAll('.login-role').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.login-role').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        selectedRole = el.dataset.role;
      });
    });

    document.getElementById('login-btn').addEventListener('click', async () => {
      const btn = document.getElementById('login-btn');
      const oldText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'جارٍ التحقق...';
      try {
        await AuthService.login({
          username: document.getElementById('username').value || 'demo',
          password: document.getElementById('password').value || 'demo',
          role: selectedRole,
        });
        UI.toast('مرحباً بك في المنظومة', 'success');
        Router.navigate(selectedRole === 'applicant' ? '/applicant' : '/');
      } catch (err) {
        UI.toast(err.message, 'danger');
        btn.disabled = false;
        btn.innerHTML = oldText;
      }
    });
  }

  window.LoginPage = { render, attach };
})();
