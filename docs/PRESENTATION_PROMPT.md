# Presentation Builder Prompt

> Drop the entire **`Prompt`** section below into Claude / ChatGPT / Gemini / Gamma to generate a presentation deck. The AI will produce slide-by-slide content (Arabic-first, ready to paste into PowerPoint, Keynote, Gamma, Beautiful.ai, or Canva).

---

## Prompt

```
You are a senior pre-sales architect at "Appenza Studio" — an Egyptian software studio that builds enterprise government platforms. You are preparing the executive presentation that will be shown to the decision-making committee of وزارة الداخلية · أكاديمية الشرطة (Ministry of Interior · Egyptian Police Academy) before the live demo of our digital admissions platform.

# Audience
- Senior officers and civilian decision-makers at the Police Academy.
- Mostly Arabic speakers; comfortable with technical Arabic but not deep-tech jargon.
- They have read كرّاسة الشروط (the published "KARASA" specification document) and will mentally compare every slide against its requirements.
- Some are evaluating competing bids; others are sponsoring the digitisation initiative internally.

# Tone
- Formal, calm, institutional Arabic — first person plural ("نقدّم", "تتيح المنظومة").
- Heritage + modernity: gold/navy palette, RTL layout, Arabic numerals where natural, Latin tabular figures only inside code blocks.
- No hype words. No "world-class" / "cutting-edge". Use precise, ministry-grade language.
- Every claim must trace back to a KARASA section number where applicable.

# What the platform is
"منظومة القبول الإلكتروني · أكاديمية الشرطة" — a unified frontend that digitises the entire 11-stage admissions cycle (register → verify NID → personal & education data → marital → payment → family up to 4th degree → exam scheduling → attendance card → follow-up → acquaintance document) and binds it to 9 staff applications (admin, committee, board, investigations, medical, barcode, biometric, exams + architecture console).

Key facts (use as-is, do not invent numbers):
- 9 connected applications, 11 admission stages, 11 RBAC roles, 12 top-level routes, 71 routes total
- 4-layer architecture per KARASA §9 (public · middleware · private · database)
- 8 medical clinics (الجراحة العامة، الأعصاب، الاتزان النفسي، القياسات BMI، …) per KARASA §6.2.B
- 5 student committees, ~570 applicants per committee, ~2,847 applicants in cycle 2026
- 6 government integrations (وزارة الداخلية · MOIPASS، التعليم العالي، الأحوال المدنية، الجوازات، المخابرات العامة، التموين) per KARASA §9.E
- 500 hardware units distributed: 171 PCs, 130 biometric devices, 19 printers, 5 scanners, 9 switches, 6 racks, 160 net-points
- Stack: React 18 + TypeScript 5.6 strict + Vite + Tailwind + TanStack Query + Zustand + react-hook-form + zod
- Three-shell architecture: PublicShell (citizens) · AppShell (staff) · ApplicantPortalLayout (applicants)
- Egyptian Heritage Modern design system: teal "navy of the Nile" + gold + terra-cotta + cream surface + Khayameya stripe motif

# What I need from you
Produce a **20-slide deck**, in this exact order, formatted as the structured output below.

For each slide, give me:
1. **رقم وعنوان** (slide number + Arabic title) — short, no emojis
2. **هدف الشريحة** (one-sentence goal — what should the audience think after seeing this slide?)
3. **المحتوى المرئي** (3-6 Arabic bullet lines, each ≤ 14 words, with KARASA citation in parentheses where relevant)
4. **توصية بصرية** (1-line layout suggestion: "صورة شاشة الـ Hub", "مخطط الـ4 طبقات", "جدول المؤشرات الست", etc.)
5. **ملاحظات المتحدّث** (3-5 lines in Arabic — what the speaker actually says out loud while this slide is up)

# Slide order (do NOT change)

1. **الغلاف** — اسم المنظومة + شعار أكاديمية الشرطة + تاريخ + شعار Appenza Studio
2. **لماذا التحوّل الرقمي الآن؟** — 3 محرّكات: الحجم، الشفافية، التكامل بين الجهات
3. **نظرة شاملة في 30 ثانية** — الأرقام الكبرى (9/11/12/2,847/6 جهات/500 جهاز)
4. **رحلة المتقدّم في 11 مرحلة** — diagram horizontal من «التسجيل» إلى «شهادة التعارف»
5. **البنية المعمارية: 4 طبقات** — KARASA §9 — Public · Middleware · Private · Database
6. **التكامل الحكومي** — 6 جهات مع flow لكل تكامل (KARASA §9.E)
7. **منظومة الصلاحيات (RBAC) 11×9** — جدول الأدوار × التطبيقات
8. **التطبيق ١ — لوحة الإدارة** (لقطة شاشة `/admin`) — KPIs + خريطة كثافة + سجل النشاط
9. **التطبيق ٢ — رحلة المتقدّم** (لقطة شاشة `/applicant/profile/family`) — نموذج الأسرة حتى الدرجة 4
10. **التطبيق ٣ — لجان القبول** (لقطة شاشة `/committee/C-01`) — الاعتماد المزدوج (KARASA §3.C)
11. **التطبيق ٤ — القومسيون الطبي** (لقطة شاشة `/medical/station/bmi`) — معاينة BMI الفورية
12. **التطبيق ٥ — التحريات** (لقطة شاشة `/investigations/cases/CASE-00001`) — السرّية + شجرة الأسرة
13. **التطبيق ٦ — الهيئة العليا** (لقطة شاشة `/board/sessions/SES-0001/live`) — التصويت السرّي + النصاب
14. **التطبيق ٧ — بنك الأسئلة والاختبارات** (لقطة شاشة `/question-bank`) — الـ workflow من draft إلى live
15. **التطبيق ٨ + ٩ — البيومتري والباركود** — التعريف الموحَّد للمتقدّم داخل كلّ المراحل
16. **الوثائق الرسمية** — 3 لقطات جنباً إلى جنب: كارت التردد + الشهادة الطبية + قرار الهيئة
17. **الأمن والامتثال** — RBAC على مستوى الشاشة، MOIPASS، تسجيل كامل لكل تغيير، شبكة داخلية معزولة
18. **الجدول الزمني للنشر** — مرحلة 1 (3 شهور) ربط APIs · مرحلة 2 (3 شهور) اختبارات تشغيل · مرحلة 3 (شهر) تشغيل تجريبي
19. **الفريق وضمان الاستمرارية** — Appenza Studio + الإدارة العامة لتكنولوجيا المعلومات، خطة التدريب، خطة الصيانة
20. **شكر + الانتقال إلى العرض الحيّ** — ندعو الحضور إلى التجربة المباشرة

# Output format
Use the following Markdown structure exactly so I can paste each slide block straight into PowerPoint or Gamma:

---

## شريحة [N] — [العنوان]

**الهدف:** [...]

**المحتوى:**
- [نقطة 1]
- [نقطة 2]
- [نقطة 3]
- [...]

**توصية بصرية:** [وصف موجز]

**ملاحظات المتحدّث:**
> [3-5 سطور بالعربية يقولها المتحدّث وهو يعرض الشريحة]

---

# Constraints
- Do NOT invent KARASA section numbers; only cite §1.2.H، §2.2، §3.B، §3.C، §4، §5.2.B، §6.2.B، §6.2.D، §6.5، §6.6، §7، §9، §9.A، §9.B، §9.E، §10.1.
- Do NOT translate Arabic terms to English needlessly — keep "كرّاسة الشروط"، "القومسيون الطبي"، "الهيئة العليا" verbatim.
- Do NOT promise features that aren't in the platform: no real-time chat, no mobile app, no AI proctoring, no blockchain.
- Do NOT mention React, TanStack, Zustand, or any frontend library by name in slide content (technical-stack slide is the only exception, and even there speak to "إطار عمل حديث" not the brand names).
- Keep every Arabic line ≤ 14 words. Speaker notes can be longer.

Begin with slide 1.
```

---

## How to use it

1. **Pick a tool** that gives you slides:
   - **Gamma.app** (gamma.app) — paste the prompt, click "Generate", get a designed deck instantly
   - **ChatGPT / Claude / Gemini** — paste the prompt, get the structured Markdown, then build slides manually in PowerPoint or Keynote
   - **Beautiful.ai / Canva Magic Studio / Tome.app** — same flow

2. **After the AI produces the deck**, ask one follow-up:
   ```
   Now produce a 5-minute version (only 8 slides) for the 5-minute elevator variant of the demo.
   ```

3. **Drop in the screenshots** I generated when capturing the demo (you can grab fresh ones by running `npm run dev` then visiting each route — `DEMO_SCRIPT.md` has the full route list with talking points per screen).

4. **Brand it** with the Appenza Studio logo + the academy crest already in `public/police-academy-logo.png`.

## Sister deliverables already in the repo

| File | Purpose |
|---|---|
| `DEMO_SCRIPT.md` | The 3-variant live-demo script (5 / 15 / 30 minutes) with per-screen talking points and Q&A prep — pair it with the deck |
| `AUDIT_REPORT.md` | The architecture/audit document — useful as a leave-behind PDF |
| `Tasks/KARASA_GAPS.md` | Coverage table proving 95%+ of the karasa is implemented — useful as an annex slide |
