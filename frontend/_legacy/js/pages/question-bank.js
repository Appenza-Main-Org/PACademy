/**
 * Question Bank & Electronic Exams (2.7)
 */
(function() {
  'use strict';

  const APP = { key: 'exams', icon: '📝', title: 'بنك الأسئلة' };

  const NAV = [{ items: [
    { key: 'bank',     icon: '📚', label: 'بنك الأسئلة',         path: '/question-bank' },
    { key: 'exams',    icon: '📝', label: 'الاختبارات',          path: '/question-bank/exams' },
    { key: 'results',  icon: '📊', label: 'النتائج',              path: '/question-bank/results' },
  ]}];

  function shell(activeKey, body) {
    return `
      <div class="shell shell-with-sidebar" data-app="exams">
        ${Shell.appHeader(APP)}
        ${Shell.sidebar(NAV, activeKey, 'exams')}
        <main class="main">${body}</main>
      </div>
    `;
  }

  async function renderBank() {
    const questions = await ExamsService.listQuestions();
    const cats = await ExamsService.getCategories();

    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">📚</span> بنك الأسئلة',
        'إدارة بنك الأسئلة والاختبارات الإلكترونية',
        `<button class="btn btn-primary">${UI.Icons.plus} سؤال جديد</button>`
      )}

      <div class="grid grid-4 mb-5">
        ${[
          { label: 'إجمالي الأسئلة', value: 1247, icon: '📚', tone: '#7C2D8E', bg: '#EBD8F0' },
          { label: 'تصنيفات',          value: cats.length, icon: '📂', tone: '#2D5BA0', bg: '#DDE7F2' },
          { label: 'اختبارات منشورة',  value: 8, icon: '📝', tone: '#1A8754', bg: '#D7F0E1' },
          { label: 'متوسط الدرجات',    value: '78%', icon: '📊', tone: '#B8770A', bg: '#FBE9CC' },
        ].map(s => `
          <div class="stat">
            <div class="stat-header">
              <span class="stat-label">${s.label}</span>
              <span class="stat-icon" style="background:${s.bg};color:${s.tone};">${s.icon}</span>
            </div>
            <div class="stat-value">${typeof s.value === 'number' ? UI.num(s.value) : s.value}</div>
          </div>
        `).join('')}
      </div>

      <div class="grid" style="grid-template-columns: 280px 1fr;gap:24px;">
        <div class="card" style="height:fit-content;">
          <div class="card-header"><div class="card-title">التصنيفات</div></div>
          <div class="card-body" style="padding:8px;">
            ${cats.map(c => `
              <div class="nav-item" style="cursor:pointer;">
                <span class="nav-item-icon">📂</span>
                <span class="nav-item-label">${UI.escape(c.name)}</span>
                <span class="nav-item-badge">${c.count}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div>
          <div class="filters">
            <div class="search"><input class="input" placeholder="بحث في الأسئلة">${UI.Icons.search}</div>
            <select class="select">
              <option>كل المستويات</option>
              <option>سهل</option>
              <option>متوسط</option>
              <option>صعب</option>
            </select>
          </div>

          <div style="display:flex;flex-direction:column;gap:14px;">
            ${questions.map(q => `
              <div class="question-card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:12px;">
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <span class="badge badge-brand">${UI.escape(q.category)}</span>
                    <span class="badge ${q.difficulty === 'سهل' ? 'badge-success' : q.difficulty === 'متوسط' ? 'badge-warning' : 'badge-danger'}">${UI.escape(q.difficulty)}</span>
                    <span class="chip">استُخدم ${q.usedCount} مرة</span>
                  </div>
                  <div style="display:flex;gap:4px;flex-shrink:0;">
                    <button class="btn btn-ghost btn-icon btn-sm">${UI.Icons.edit}</button>
                    <button class="btn btn-ghost btn-icon btn-sm">${UI.Icons.eye}</button>
                  </div>
                </div>
                <div class="question-text">${UI.escape(q.text)}</div>
                <div class="question-options">
                  ${q.options.map((opt, i) => `
                    <div class="question-option ${i === q.correctIndex ? 'correct' : ''}">
                      <div class="question-option-letter">${['أ','ب','ج','د'][i]}</div>
                      <span style="flex:1;">${UI.escape(opt)}</span>
                      ${i === q.correctIndex ? '<span class="text-xs text-success font-bold">✓ الإجابة الصحيحة</span>' : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    return shell('bank', body);
  }

  async function renderExams() {
    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">📝</span> الاختبارات الإلكترونية',
        'إدارة الاختبارات المنشأة من بنك الأسئلة',
        `<button class="btn btn-primary">${UI.Icons.plus} اختبار جديد</button>`
      )}

      <div class="grid grid-2 gap-4">
        ${[
          { name: 'اختبار القبول العام', questions: 60, duration: 90, status: 'active', taken: 187, avg: 76 },
          { name: 'اختبار اللغة العربية', questions: 30, duration: 45, status: 'active', taken: 245, avg: 82 },
          { name: 'اختبار الذكاء واللوجيك', questions: 40, duration: 60, status: 'active', taken: 198, avg: 71 },
          { name: 'اختبار اللغة الإنجليزية', questions: 35, duration: 50, status: 'draft', taken: 0, avg: 0 },
          { name: 'اختبار الرياضيات', questions: 25, duration: 45, status: 'active', taken: 156, avg: 68 },
          { name: 'اختبار الثقافة العامة', questions: 50, duration: 75, status: 'archived', taken: 412, avg: 79 },
        ].map(e => `
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">${UI.escape(e.name)}</div>
                <div class="card-subtitle">${e.questions} سؤال · ${e.duration} دقيقة</div>
              </div>
              ${
                e.status === 'active' ? '<span class="badge badge-success">نشط</span>' :
                e.status === 'draft' ? '<span class="badge badge-warning">مسودة</span>' :
                '<span class="badge badge-neutral">مؤرشف</span>'
              }
            </div>
            <div class="card-body">
              <div class="grid grid-2 gap-3 mb-3">
                <div>
                  <div class="text-xs text-tertiary">عدد المُختبرين</div>
                  <div style="font-weight:700;font-size:18px;" class="num">${UI.num(e.taken)}</div>
                </div>
                <div>
                  <div class="text-xs text-tertiary">متوسط الدرجات</div>
                  <div style="font-weight:700;font-size:18px;color:${e.avg >= 75 ? 'var(--success)' : 'var(--warning)'};" class="num">${e.avg}%</div>
                </div>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-secondary btn-sm" style="flex:1;">عرض</button>
                <button class="btn btn-ghost btn-sm">${UI.Icons.edit}</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    return shell('exams', body);
  }

  async function renderResults() {
    const data = window.MockData.applicants.slice(0, 25);
    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">📊</span> نتائج الاختبارات', 'سجل درجات المتقدمين في الاختبارات الإلكترونية')}

      <div class="card mb-5">
        <div class="card-header"><div class="card-title">توزيع الدرجات</div></div>
        <div class="card-body">${Charts.bar([
          { label: '0-50', value: 18 },
          { label: '50-60', value: 32 },
          { label: '60-70', value: 58 },
          { label: '70-80', value: 76 },
          { label: '80-90', value: 41 },
          { label: '90-100', value: 15 },
        ], { color: '#7C2D8E' })}</div>
      </div>

      <div class="card">
        <div class="table-wrap" style="border:none;border-radius:0;">
          <table class="table">
            <thead><tr><th>المتقدم</th><th>الاختبار</th><th>التاريخ</th><th>الدرجة</th><th>المدة</th><th>الحالة</th></tr></thead>
            <tbody>
              ${data.map(a => {
                const score = 50 + Math.floor(Math.random() * 50);
                const time = 35 + Math.floor(Math.random() * 50);
                const passed = score >= 65;
                return `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <div class="avatar avatar-sm">${UI.escape(a.name[0])}</div>
                        <span>${UI.escape(a.name.split(' ').slice(0,3).join(' '))}</span>
                      </div>
                    </td>
                    <td><span class="text-xs">اختبار القبول العام</span></td>
                    <td><span class="text-xs">${UI.date(Date.now() - Math.random()*30*86400000)}</span></td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <span class="num font-bold" style="font-size:15px;color:${passed ? 'var(--success)' : 'var(--danger)'};">${score}%</span>
                        <div class="progress" style="width:80px;">
                          <div class="progress-fill ${passed ? 'success' : 'danger'}" style="width:${score}%;"></div>
                        </div>
                      </div>
                    </td>
                    <td><span class="text-xs num">${time} د</span></td>
                    <td>${passed ? '<span class="badge badge-success">ناجح</span>' : '<span class="badge badge-danger">راسب</span>'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return shell('results', body);
  }

  function attach() { Shell.attachShellEvents(); }

  window.QuestionBankPage = { renderBank, renderExams, renderResults, attach };
})();
