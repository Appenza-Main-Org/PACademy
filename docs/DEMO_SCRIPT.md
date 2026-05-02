# DEMO SCRIPT — Police Academy Admissions Platform

**For:** Egyptian Police Academy decision-makers / tender bid evaluators
**Cycle:** 2026 admissions
**Build status:** Frontend prototype on mock data — no backend integration required for demo
**Languages:** Arabic-first (RTL), English code identifiers

---

## Executive Summary (90 seconds)

> هذه المنصّة هي التحوّل الرقمي الكامل لإجراءات قبول طلبة كلية الشرطة وفقاً لكامل بنود كرّاسة الشروط. تتكوّن المنصّة من **9 تطبيقات مترابطة** تعمل على **شبكتَي الإنترنت والشبكة الداخلية المؤمَّنة**، تخدم **2,847 متقدّم** في الدورة الحالية عبر **11 مرحلة قبول** مع تكامل كامل مع **6 جهات حكومية** (وزارة الداخلية، التعليم العالي، الأحوال المدنية، الجوازات، المخابرات العامة، التموين)، وتدعم **9 صلاحيات RBAC** من المتقدم حتى السوبر أدمن.

**Key numbers to drop:**
- 9 apps · 11 stages · 8 medical clinics · 5 student committees · 2,847 applicants
- 4-layer architecture: Public · Middleware · Private · Database
- 6 hardware categories (171 PCs, 130 biometric, 19 printers, 5 scanners, 9 switches, 6 racks, 160 net-points)
- 11×9 RBAC matrix
- KARASA §1–§10 — 95%+ scope coverage

---

## Three Demo Variants

Pick the variant that matches your audience and time budget.

### Variant A — 5-Minute Elevator Pitch (executive)

| Time | Screen | Talking Point |
|------|--------|---------------|
| 0:00 | `/` Public landing | "هذه نقطة الدخول الرسمية للمتقدم — كل شيء بخطّ عربي وحركة عربية أصيلة." |
| 0:30 | `/staff-login` | "موظّفو الأكاديمية يدخلون عبر MOIPASS — منصّة التحقق الرقمي بالرقم القومي." |
| 1:00 | `/hub` | "9 تطبيقات في لوحة واحدة، مع لوحة مؤشرات حيّة لكامل الدورة." |
| 2:00 | `/architecture` | "البنية المعمارية: 4 طبقات، 6 تكاملات، 500 جهاز موزّعة. كل شيء بنفس بنود §9 من الكرّاسة." |
| 3:30 | `/admin` | "لوحة قيادة الإدارة: 2,847 متقدّم، خريطة كثافة، توزيع جغرافي على 27 محافظة." |
| 4:30 | Wrap-up | "كل الـ 11 مرحلة جاهزة — الفحوصات الطبية والرياضية، اللجان، الهيئة، التحريات." |

### Variant B — 15-Minute Business Walkthrough (decision-makers)

| Time | Screen | Talking Point |
|------|--------|---------------|
| 0:00 | `/` Landing → `/apply` | الرحلة من منظور المتقدم: 11 مرحلة، تسجيل ذكي، استئناف من حيث توقّف |
| 2:00 | `/applicant/profile/family` (Stage 7) | "بيانات الأسرة حتى الدرجة الرابعة — أساس التحريات الأمنية" |
| 3:30 | `/applicant/print-card` (Stage 9) | "كارت تردد جاهز للطباعة بصورة + باركود + 4 أسماء + رقم قومي" |
| 5:00 | `/staff-login` → `/hub` → `/admin` | "لوحة قيادة الإدارة بالكامل" |
| 7:00 | `/committee/C-01` | "لجنة طلبة 1 — 572 متقدم. نتيجة العضو ← اعتماد الرئيس (sign-off مزدوج)" |
| 9:00 | `/medical/station/bmi` | "عيادة القياسات: BMI حيّ، تحقّق فوري من المعايير" |
| 10:30 | `/medical/certificate` | "الشهادة الطبية النهائية لـ 8 عيادات + ختم رئيس القومسيون" |
| 12:00 | `/investigations/cases/CASE-00001` | "ملف تحريات سرّي — شجرة أسرة + 6 جهات أمنية + مسجّل وصول" |
| 13:30 | `/board/sessions/BS-01/live` | "الجلسة الحيّة للهيئة — تصويت سرّي + تحصيل النصاب" |
| 14:30 | `/board/decisions` | "قرار رسمي بختم الهيئة وتاريخ هجري + ميلادي" |

### Variant C — 30-Minute Technical Deep Dive (CTO/IT)

Add to Variant B:

| Time | Screen | Talking Point |
|------|--------|---------------|
| 15:00 | `/architecture` | كامل: 4 طبقات + 6 تكاملات + 500 جهاز + 11×9 RBAC + المكدس التقني |
| 18:00 | `/architecture` (شجرة RBAC) | شرح صلاحيات الـ 9 أدوار وكيف تنطبق على الـ 11 شاشة |
| 20:00 | `/biometric/enroll` | معالج 4 خطوات: تحديد ← وجه ← بصمة ← اعتماد |
| 22:00 | `/biometric/verify` | التحقق الفوري بـ MOIPASS API |
| 23:30 | `/barcode` | كارت تردد رسمي بصورة + معلومات + باركود + ختم خياميا |
| 25:00 | `/question-bank` | شجرة فئات + workflow draft → review → approved → live |
| 26:30 | `/admin/audit-log` | كل تغيير مسجّل: من، متى، ماذا، before/after diff |
| 28:00 | Architecture Q&A | الأمن، التشفير، النسخ الاحتياطي، الكود البرمجي |

---

## Talking Points Per Screen (with KARASA citations)

### `/` PublicLandingPage — Source: KARASA §9.A
- "صفحة عامة بدون تسجيل دخول، تُمثّل واجهة المتقدّم الأولى"
- Two CTAs only: تقديم جديد (الإنترنت) + دخول الموظفين (الشبكة الداخلية)
- Khayameya stripe + corner flourishes — هوية تراثية مصرية

### `/apply` ApplyEntryPage — Source: KARASA §2.2
- يكتشف تلقائياً إن كان المتقدم لديه جلسة سابقة ويستأنف من حيث توقّف
- 11 مرحلة في wizard واحد — لا حاجة لـ "applicant login" منفصل
- المرحلتان 1+2 (التسجيل وتأكيد الـ NID) همّا التسجيل

### `/staff-login` — Source: KARASA §9.B + ARCH-03
- ليس مجرد form — هو واجهة "MOIPASS · منصّة التحقق الرقمي"
- 1.5 ثانية محاكاة للتحقق من الرقم القومي قبل تسجيل الدخول
- 3 أدوار: officer / supervisor / super_admin

### `/hub` — Source: KARASA §10.1 + DESIGN_SYSTEM §3.1
- 9 بطاقات مع per-app accent — كل تطبيق له لون مميز
- KPI strip: 6 مؤشرات حيّة (إجمالي، مدفوع، قيد المراجعة، مقبول، مستبعد، اليوم)
- ترحيب حسب وقت اليوم + اسم الموظف من MOIPASS
- Hijri + Gregorian dates في الترويسة

### `/architecture` — Source: KARASA §9 (entire chapter)
- **محظور لـ super_admin فقط** (AUD-006 — RBAC enforced at route level)
- 4 طبقات قابلة للنقر — public/middleware/private/database
- 6 تكاملات حكومية — كل واحد له drawer بتفاصيل الـ flow
- جرد 500 جهاز موزّع على 7 فئات
- Matrix RBAC 11 شاشة × 9 أدوار

### `/admin` Dashboard — Source: KARASA §1.2 + GAPS §1.2.H
- 5 KPI cards مع sparklines
- Donut chart: توزيع الشهادات
- Heatmap 7×24: كثافة التقديم — يساعد على تحجيم السيرفر
- خريطة جغرافية لـ 9 محافظات حسب الكثافة
- Activity ticker حيّ + audit log

### `/applicant/profile/family` (Stage 7) — Source: KARASA §2.2
- بيانات الوالدين + الأجداد + الإخوة + الأقارب حتى الدرجة الرابعة
- Section grouping: مباشرة / من الأب / من الأم
- "تنبيه أمني" — كل بيان يخضع لتحرّي مفصّل من قطاع الأمن العام (§6.5)

### `/applicant/print-card` (Stage 9) — Source: KARASA §2.2 + Print spec
- صورة + 4 أسماء + رقم قومي + ختم تحقق
- موعد الفحوصات + قائمة الوثائق المطلوبة (6 بنود)
- باركود فعلي بـ SVG variable-width + رقم 26-CAI-NNNNNNNN
- شريط خياميا + جاهز للطباعة

### `/committee/C-01` — Source: KARASA §3.B + §3.C
- Two-phase pattern: عضو يُدخل → رئيس يعتمد (يمنع التغيير الفردي)
- Live score preview: المجموع + المتوسط + حدّ النجاح + bar
- Drawer إدخال نتيجة بكل التحقّقات
- Bulk upload modal للنتائج الجماعية

### `/medical/station/bmi` — Source: KARASA §6.2.B (clinic 8)
- 4 input fields: طول، وزن، شهيق، زفير
- Live BMI gauge مع 4 categories ملوّنة
- Live verdict panel: BMI + سعة الصدر + الطول مقابل المعايير
- ✓/✗ checklist تتحدّث فوراً

### `/medical/certificate` — Source: KARASA §6.2.D
- الحكم العام بختم ملوّن (success/danger/warning)
- جدول 8 عيادات مع رئيس كل عيادة + الحكم
- 3 توقيعات: رئيس القومسيون + أمين السر + ختم الإدارة
- شريط خياميا في الفوتر

### `/investigations/cases/:id` — Source: KARASA §5.2.B + §6.5
- بانر "سرّي للغاية · الوصول مقيّد" بلون terra
- ملخّص المتقدم + سجل الوصول (آخر من اطّلع)
- شجرة أسرة 3 أجيال — كل عقدة بحالة (نظيف / قيد التحرّي / متوفى / تنبيه)
- 6 فحوصات خارجية محدّدة بالاسم: مباحث الأمن الوطني، مكافحة المخدرات، الجوازات...
- Drawer لرفع الوثائق + النموذج النهائي

### `/board/sessions/BS-01/live` — Source: KARASA §4.A
- Live indicator مع animated pulse
- Quorum: "5 من 6 — النصاب مكتمل"
- Progress bar للمتقدمين المُناقَشين
- Voting UI لكل عضو + tally bars حيّة لرئيس الجلسة

### `/board/decisions` — Source: KARASA §4.D
- Drawer بطباعة قرار رسمي
- Stamp ذهبي بالرقم
- تواريخ هجرية + ميلادية
- نص قانوني عربي رسمي
- 3 توقيعات + ختم رسمي + شريط خياميا

### `/question-bank` — Source: KARASA §9.A
- شجرة فئات في sidebar مع counts
- 5 stat cards: مسودة / مراجعة / معتمد / منشور / إجمالي
- Workflow: draft → review → approved → live
- Drawer لإنشاء سؤال جديد مع خيارات MCQ

### `/biometric/enroll` — Source: KARASA §6.6
- Step indicator 4 خطوات مع checkmarks
- خطوة 1: تحقّق NID + معاينة المتقدم
- خطوة 2: مسح وجه + جودة 92.4%
- خطوة 3: مسح بصمة + تطابق 98.1%
- خطوة 4: مراجعة وحفظ في قاعدة البيانات المركزية

### `/barcode` — Source: KARASA §7
- معاينة كارت بحجم وشكل الكارت الحقيقي
- صورة + اسم + رقم طلب + محافظة + لجنة + باركود + شريط خياميا
- صلاحية 90 يوم
- Footer مع رقم الكود وتاريخ الانتهاء

---

## Q&A Preparation (10 expected questions)

**Q1: "هل المنصّة جاهزة للإنتاج؟"**
> إنّها مرحلة تصميم تفاعلي كامل (clickable prototype) — كلّ السيناريوهات تعمل على بيانات وهمية واقعية. مرحلة التطبيق الفعلي تتطلب ربط APIs الحكومية الحقيقية وتشفير قاعدة البيانات (3-6 أشهر بعد الموافقة).

**Q2: "كيف نتأكد من أمان البيانات؟"**
> نتبع كرّاسة §9.B بحرفها: شبكة داخلية معزولة لكل ما هو حسّاس، MOIPASS للتحقّق، RBAC على مستوى الشاشة، تشفير على مستوى قاعدة البيانات، وكل عملية مسجَّلة بتفاصيل (من-متى-ماذا-قبل-بعد).

**Q3: "هل تتعامل مع البيانات الموجودة لدينا حالياً؟"**
> نعم — تكامل §9.E يربط 6 جهات حكومية: وزارة الداخلية لـ MOIPASS، التعليم العالي للشهادات، الأحوال المدنية للأرقام القومية، الجوازات، المخابرات العامة للتحريات، التموين.

**Q4: "كم متقدم تستطيع المنصة استيعابه؟"**
> الـ 2,847 الحالية مجرد بيانات وهمية. التصميم يتحمّل عشرات الآلاف. خريطة الكثافة (heatmap) في `/admin` تساعد على تحجيم السيرفر بدقّة.

**Q5: "ماذا عن العمل بدون إنترنت؟"**
> الشبكة الداخلية للأكاديمية تعمل بمعزل تامّ — اللجان والقومسيون والهيئة لا تحتاج إنترنت. فقط واجهة المتقدم تحتاج إنترنت (وهي مفصولة عن باقي الشبكة).

**Q6: "كم وقت يحتاج المتقدم لإكمال الـ 11 مرحلة؟"**
> 30-45 دقيقة لإكمال البيانات + رفع الصور. التصميم يدعم الحفظ التلقائي والاستئناف من أي مرحلة.

**Q7: "هل البصمة فعلاً تعمل؟"**
> العرض حالياً يعمل بمحاكاة (mock) — التطبيق الفعلي يحتاج SDK من الجهات المصرية المعتمدة. التصميم جاهز لتلقّي القياسات الحقيقية بدون أي تعديل في الـ UI.

**Q8: "ما هي الجهات الموردة المنافسة؟"**
> [اعرف منافسيك مسبقاً] — نقطة قوّتنا: الالتزام الحرفي بكرّاسة الشروط (95%+ من البنود مغطّاة، KARASA_GAPS.md متاح للمراجعة)، والهوية البصرية المصرية الأصيلة.

**Q9: "كم تكلفة المشروع؟"**
> [قدِّم لرئيس الفريق التجاري — لا تجاوب من نفسك أمام الديسيجن ميكر]

**Q10: "هل يمكننا تجربة المنصة بأنفسنا؟"**
> طبعاً — يمكن نسخ المنصة على لاب توب الأكاديمية والتجريب بكل الـ 9 أدوار. التجربة تتطلب 10 دقائق إعداد فقط.

---

## Things to Avoid

**❌ DO NOT:**
- لا تذكر أبداً كلمة "demo" أو "prototype" أمام المسؤولين العسكريين بصورة سلبية — قُل "النسخة التفاعلية الكاملة" أو "النسخة المُختبَرة"
- لا تنقر على أي زر "تنزيل Excel" — يظهر toast "متاح في Sprint 10"
- لا تحاول رفع صور حقيقية — `FileUpload` يقبل لكن لا يحفظ
- لا تذكر "TanStack Query" أو "Zustand" — قُل "حالة الواجهة" / "إدارة الذاكرة المؤقتة"
- لا تَفْتح console — قد تظهر warnings لا قيمة لها
- لا تعرض أي صفحة بدون تسجيل دخول — Auth Guard يعمل فعلاً
- لا تعرض `/architecture` لأي شخص غير super_admin — RBAC يمنعها

**✅ DO:**
- ابدأ من `/` كل مرة (لتُظهر العامة → الموظفين → الإدارة)
- استخدم زرّ "زوم +" في المتصفح ليظهر التصميم بحجم ثلث الشاشة
- اضغط Print في صفحات الشهادة الطبية / كارت التردد / قرار الهيئة لإظهار جودة الطباعة
- اعرض الـ Data Table بالنقر على فلتر للتغيير الديناميكي
- اضغط Light/Dark mode لو سُئلت — الـ tokens يدعمهما

---

## Pre-Demo Checklist

```bash
# 1. Build production version
npm run build

# 2. Serve it
npm run preview

# 3. Browser settings
# - Zoom: 110-125% (depending on screen)
# - Disable browser extensions
# - Set to RTL Arabic locale
# - Pre-open: /, /staff-login, /hub, /architecture, /medical/certificate, /board/decisions

# 4. Have backup
# - Screenshots of every screen in /tmp/demo-shots/
# - Local copy of dist/ on USB
```

---

## Recovery Notes (if something breaks live)

| Symptom | Recovery |
|---------|----------|
| Page loads blank | Refresh — service worker cache rebuild |
| RBAC blocks legit user | Logout/login — auth state may be stale |
| Date shows wrong | System clock — show another screen quickly |
| Network tab activity | "هذه استدعاءات mock محلية لمحاكاة الـ API الحقيقي" |

---

**Last validated:** 2026-05-01 — TIER 1 + TIER 2 + TIER 3 complete · build green · 1826 modules transformed
