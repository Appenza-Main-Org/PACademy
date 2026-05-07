# منظومة القبول بأكاديمية الشرطة — Demo Website

> منظومة معلوماتية متكاملة تربط ٩ تطبيقات على مستوى الإنترنت والشبكة الداخلية،
> تم بناؤها كـ **demo قابل للعرض** + **blueprint جاهز للربط الفعلي** مع الـ backend.

---

## 🚀 التشغيل السريع

```bash
# داخل مجلد المشروع، شغّل أي web server محلي
cd police-academy
python3 -m http.server 8000

# ثم افتح المتصفح على
# http://localhost:8000
```

> ⚠️ **مهم**: الموقع لازم يفتح عبر web server مش عن طريق `file://` (بسبب الـ ES module loading والـ hash router).

---

## 🎯 ما الذي يعرضه هذا الـ Demo

### ١٢ صفحة كاملة قابلة للتصفّح

| # | الصفحة | المسار | الوصف |
|---|---|---|---|
| 1 | تسجيل الدخول | `/login` | اختيار دور وظيفي + RBAC |
| 2 | الـ Hub الرئيسي | `/` | بوابة الـ 9 تطبيقات + KPIs |
| 3 | إدارة المنظومة (1.1) | `/admin` | لوحة تحكم النظام الكاملة |
| 4 | موقع المتقدمين (1.2) | `/applicant` | بورتال المتقدم + 11 مرحلة |
| 5 | لجان القبول (2.1) | `/committee` | إدارة 5 لجان قبول |
| 6 | الهيئة وأمانة السر (2.2) | `/board` | جلسات الهيئة وقراراتها |
| 7 | التحريات (2.3) | `/investigations` | صادر/وارد التحريات |
| 8 | القومسيون الطبي (2.4) | `/medical` | 8 عيادات طبية |
| 9 | الباركود (2.5) | `/barcode` | كروت تردد بالباركود |
| 10 | البيومتري (2.6) | `/biometric` | تحقق بالوجه + البصمة |
| 11 | بنك الأسئلة (2.7) | `/question-bank` | إدارة أسئلة + اختبارات إلكترونية |
| 12 | معمارية النظام | `/architecture` | الـ 6 طبقات المعمارية |

---

## 🏗️ المعمارية الفنية

### الـ Stack المستخدم في الـ Demo

| الطبقة | التقنية | السبب |
|---|---|---|
| **Frontend** | Vanilla JS + HTML5 + CSS3 | صفر build، يفتح فوراً، سهل التحويل لـ React |
| **Routing** | Hash router (custom) | SPA navigation بدون server config |
| **State** | Reactive Store (custom) | Redux-like pattern، sessionStorage persisted |
| **Auth** | Mock JWT + RBAC | 11 دور وظيفي، صلاحيات granular |
| **Charts** | Inline SVG | صفر dependencies، تحكم كامل |
| **Fonts** | Noto Sans Arabic + Inter | عربي احترافي + أرقام إنجليزية |

### الـ Stack المقترح للـ Production

> راجع صفحة **معمارية النظام** (`/architecture`) — تحتوي على جدول كامل لكل الطبقات + التكاملات الخارجية.

---

## 🔌 جاهزية الربط بالـ Backend

كل الـ business logic معزولة في **service layer** منفصل تحت `js/services/`. كل ملف يحتوي على:

1. **API contracts موثّقة** كـ JSDoc comments في أول الملف
2. **Mock implementation** للعرض الحالي
3. **نقطة استبدال واحدة** للتحويل لـ real API

### مثال: الـ Auth Service

```javascript
// js/services/auth.service.js

/**
 * INTEGRATION CONTRACT (replace these methods to wire to real backend):
 *   POST /api/auth/login       → { token, user }
 *   GET  /api/auth/me          → user
 *   POST /api/auth/logout      → { ok }
 *   GET  /api/auth/permissions → string[]
 */
async function login(credentials) {
  // ⬅️ For mock demo:
  await new Promise(r => setTimeout(r, 600));
  // ... mock logic ...

  // ⬅️ For real backend, replace with:
  // const res = await fetch('/api/auth/login', {
  //   method: 'POST',
  //   body: JSON.stringify(credentials),
  //   headers: { 'Content-Type': 'application/json' }
  // });
  // return res.json();
}
```

### قائمة الـ API Endpoints المطلوبة

| Service | Endpoints |
|---|---|
| **Auth** | `POST /api/auth/login`، `GET /api/auth/me`، `POST /api/auth/logout` |
| **Applicants** | `GET /api/applicants`، `GET /api/applicants/:id`، `POST /api/applicants`، `PUT /api/applicants/:id`، `GET /api/applicants/:id/timeline` |
| **Committees** | `GET /api/committees`، `GET /api/committees/:id`، `GET /api/committees/:id/applicants` |
| **Medical** | `GET /api/medical/stations`، `GET /api/medical/queue`، `POST /api/medical/results` |
| **Biometric** | `POST /api/biometric/verify`، `POST /api/biometric/enroll`، `GET /api/biometric/match` |
| **Exams** | `GET /api/questions`، `POST /api/exams`، `GET /api/exams/:id/results` |
| **Investigations** | `GET /api/investigations`، `GET /api/investigations/:id` |
| **Barcode** | `POST /api/barcode/generate/:applicantId`، `GET /api/barcode/lookup` |
| **Audit** | `GET /api/audit` (مع filtering parameters) |

---

## 🎨 الـ Design System

### Color Palette

| Token | Hex | الاستخدام |
|---|---|---|
| `--brand-primary` | `#1B3A6B` | لون الشرطة الأساسي |
| `--brand-accent` | `#C9A961` | تراث مصري — الذهبي |
| `--surface-page` | `#F7F9FC` | خلفية الصفحات |
| `--surface-card` | `#FFFFFF` | البطاقات |

كل تطبيق له **accent color** خاص بيه عشان الـ visual hierarchy:
- Admin → `#2D5BA0` (أزرق)
- Applicant → `#1A8754` (أخضر)
- Committee → `#6B46C1` (بنفسجي)
- Board → `#B8770A` (ذهبي)
- Investigations → `#B82C2C` (أحمر)
- Medical → `#0E8E8E` (تركوازي)
- Barcode → `#4A5568` (رمادي)
- Biometric → `#C9501E` (برتقالي)
- Exams → `#7C2D8E` (أرجواني)

---

## 📁 هيكل الملفات

```
police-academy/
├── index.html              ← Entry point
├── styles/
│   ├── tokens.css          ← Design tokens (colors, spacing, etc.)
│   ├── base.css            ← Reset + typography
│   ├── components.css      ← Buttons, cards, badges, tables, etc.
│   ├── layout.css          ← Header, sidebar, grid utilities
│   └── apps.css            ← App-specific styles (login, hub, etc.)
└── js/
    ├── lib/
    │   ├── router.js       ← Hash router
    │   ├── store.js        ← Reactive state store
    │   ├── ui.js           ← Toast, modal, escape, format
    │   ├── charts.js       ← Inline SVG charts
    │   └── shell.js        ← Header + sidebar helpers
    ├── services/
    │   ├── mock-data.js    ← 240 applicants + users + audit + ...
    │   ├── auth.service.js ← RBAC + 11 roles
    │   ├── applicants.service.js
    │   ├── committees.service.js
    │   ├── medical.service.js
    │   ├── biometric.service.js
    │   ├── exams.service.js
    │   ├── investigations.service.js
    │   ├── barcode.service.js
    │   └── audit.service.js
    ├── pages/
    │   ├── login.js
    │   ├── hub.js
    │   ├── admin.js          ← 7 sub-routes
    │   ├── applicant.js
    │   ├── committee.js      ← 3 sub-routes
    │   ├── board.js          ← 3 sub-routes
    │   ├── investigations.js ← 3 sub-routes
    │   ├── medical.js        ← 3 sub-routes
    │   ├── barcode.js        ← 3 sub-routes
    │   ├── biometric.js      ← 3 sub-routes
    │   ├── question-bank.js  ← 3 sub-routes
    │   └── architecture.js
    └── app.js                ← Bootstrap + route registration
```

---

## 🔐 الأدوار الوظيفية (RBAC)

11 دور موثّق في `auth.service.js`:

| Role | الاسم العربي | الـ Apps المتاحة |
|---|---|---|
| `super_admin` | مدير النظام الرئيسي | جميع التطبيقات |
| `committee_admin` | مدير لجنة قبول | admin، committee، barcode، biometric |
| `committee_user` | موظف لجنة قبول | committee، barcode، biometric |
| `medical_admin` | مدير القومسيون الطبي | medical، barcode، biometric |
| `medical_doctor` | طبيب عيادة | medical |
| `investigator` | محقق | investigations |
| `board_admin` | أمين سر الهيئة | board |
| `exams_admin` | مدير الاختبارات | exams |
| `biometric_user` | مستخدم بوابة الأمن | biometric |
| `records_clerk` | مدخل نتائج | medical، exams |
| `applicant` | متقدم | applicant |

---

## ✅ Checklist للتحويل لـ Production

- [ ] استبدل الـ `services/*.js` بـ real API calls
- [ ] أضف real JWT validation (مش mock)
- [ ] فعّل HTTPS + secure cookies
- [ ] أضف i18n proper layer (عربي + إنجليزي)
- [ ] حوّل الـ HTML rendering لـ React/Vue components
- [ ] أضف unit tests للـ services
- [ ] أضف E2E tests (Playwright)
- [ ] اربط بـ منصة التحقق الرقمي للحكومة
- [ ] اربط ببوابة الدفع الإلكتروني
- [ ] فعّل الـ audit trail على كل API call

---

## 📞 للتواصل

تم إعداد هذا الـ Demo بواسطة فريق Appenza Studio.
لأي استفسار فني، تواصل مع المهندس مرتضى — AI Lead & Engineering Manager.
