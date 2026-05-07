/**
 * RevampComparisonPage — visual before/after companion to DESIGN_REVAMP.md.
 *
 * Renders four 1920×1080 side-by-side renders of /hub, /staff-login,
 * /committee/C-01, /investigations/cases/CASE-00001 — each pair shows
 * the current teal-heavy chrome on the right and the proposed
 * "Heritage Modern v2 · Ministerial Navy" treatment on the left.
 *
 * Each mock canvas renders at fixed 1920×1080 then scales down via
 * `transform: scale()` to fit the responsive container (matches the
 * source design's pattern). A tokens summary panel sits at the bottom.
 *
 * Source: handoff bundle (claude.ai/design) — DESIGN_REVAMP.md +
 * revamp-comparison.html. Direction B "Ministerial Navy #143764"
 * is the brand-defining decision; gold = heritage accent only;
 * terra = restricted ops only; teal = medical-app accent only.
 */

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { PageHeader } from '@/shared/components';
import { ROUTES } from '@/config/routes';

/* ─── v2 palette inline (DESIGN_REVAMP §2.1, Direction B) ─── */
const v2 = {
  /* neutrals — warm slate */
  n0: '#FFFFFF', n25: '#FAFAF7', n50: '#F4F2ED', n100: '#ECE7DC',
  n200: '#D8CFB8', n300: '#B5A88A', n400: '#8C7E5E', n500: '#5C5238',
  n600: '#3D3624', n700: '#2A2517', n800: '#1C190F', n900: '#0E0C07',
  /* primary — Ministerial Navy */
  p50: '#EAF0F8', p100: '#C9D7EC', p300: '#5478A8', p500: '#2C5489',
  p600: '#1E4373', p700: '#143764', p800: '#0A2548', p900: '#04152D',
  /* heritage accent — gold */
  g50: '#FBF5E8', g100: '#F4E5BD', g300: '#DDB85A', g500: '#B0822A',
  g600: '#8E6620', g700: '#674916',
  /* restricted — terra */
  t50: '#FCEFEA', t100: '#F8D6CC', t500: '#B8412A', t700: '#7B2718',
  /* medical accent — cyan-teal */
  c50: '#E6F2F2', c500: '#0E8A8A', c700: '#0A5A5A',
  /* semantic */
  success500: '#2E8755', success50: '#E6F1EB',
  warning500: '#B27500', warning50: '#FFF4DC',
  danger500: '#C8362A', danger50: '#FCEAE7',
  info500: '#2C5489', info50: '#EAF0F8',
};

/* ─── old palette (BEFORE mocks render with these to surface the contrast) ─── */
const v1 = {
  teal500: '#1A6868', teal600: '#155454', teal700: '#0E3F3F', teal900: '#051C1C',
  gold500: '#B8862C', gold700: '#7A5A1A', terra500: '#C44A30',
  cream: '#F4F2ED', cream2: '#F7F4EB', ink500: '#5A574E', ink700: '#2A2820',
};

/* ─────────── Page ─────────── */

export function RevampComparisonPage(): JSX.Element {
  return (
    <CenteredShell>
      <PageHeader
        title="نظام التصميم — مقارنة قبل وبعد"
        subtitle="مقارنة جنباً إلى جنب لأربع شاشات أساسية بين النظام الحالي والنسخة المقترحة «Heritage Modern v2 · Ministerial Navy». كل إطار بمقاس 1920×1080."
        breadcrumbs={[
          { label: 'المعمارية', href: ROUTES.architecture },
          { label: 'مقارنة التصميم' },
        ]}
        actions={
          <Link
            to={ROUTES.architecture}
            className="inline-flex items-center gap-1 rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50"
          >
            <ChevronLeft size={12} strokeWidth={1.75} />
            رجوع للمعمارية
          </Link>
        }
      />

      <Section
        index="01"
        route="/hub"
        title="لوحة الإدارة الرئيسية"
        beforeNote={[
          '«صباح الخير» يستهلك ثلث الشاشة دون معلومات حقيقية.',
          'كل سطح بنفس درجة التيركواز — لا توجد طبقات.',
          'الـ KPIs مضغوطة في شريط واحد أسفل الـ hero.',
          'سجل النشاط مفقود تحت الطيّ.',
        ]}
        afterNote={[
          'الـ hero أصبح شريطاً مدمجاً بسطر ترحيب + معلومات الدورة (12% من الشاشة بدل 38%).',
          'الـ KPIs أصبحت بطل الشاشة — شبكة 3×2 مع sparklines وأرقام Tabular.',
          'سجل النشاط ظاهر مباشرة بجانب الـ KPIs.',
          'السايد بار بخلفية بيضاء + قضيب هوية navy 4px على الحافة.',
          '«المنظومة تعمل» شارة خضراء مستقلة دلالياً — ليست تيركواز.',
        ]}
        before={<HubBefore />}
        after={<HubAfter />}
      />

      <Section
        index="02"
        route="/staff-login"
        title="شاشة الدخول"
        beforeNote={[
          'تقسيم 50/50 يجعل النموذج (سبب الزيارة) مساوياً للمحتوى التسويقي.',
          'اللوحة اليسرى مجرد سطح تيركواز آخر.',
          'إحصائيات (9 / 11 / 2,847) لا معنى لها قبل تسجيل الدخول.',
          'الزر بظلّ ثقيل وحركة تيركواز كثيفة.',
        ]}
        afterNote={[
          'تقسيم 60/40 لصالح النموذج — هو الغرض من الشاشة.',
          'اللوحة اليسرى مساحة لصورة فوتوغرافية حقيقية (مبنى الأكاديمية) خلف طبقة navy شفافة.',
          'إزالة إحصائيات ما قبل الدخول — استُبدلت بـ status strip حقيقي.',
          'الحقل المُركَّز عليه يُظهر ring navy 2px فقط.',
          'زر مسطّح بدون ظل — حركة هادئة تليق ببوابة وزارية.',
        ]}
        before={<LoginBefore />}
        after={<LoginAfter />}
      />

      <Section
        index="03"
        route="/committee/C-01"
        title="لجنة القبول — اعتماد مزدوج"
        beforeNote={[
          'زر «اعتماد الملف» تيركواز — نفس لون كل شيء. لا يميَّز كحدث حرج.',
          'التطبيق لا يبدو مختلفاً عن الـ Hub أو القومسيون.',
          'كرت التواقيع بنفس درجة باقي الكروت — لا يأخذ أهميته.',
        ]}
        afterNote={[
          'قضيب هوية ذهبي 4px على السايد بار — اللجنة لها لون.',
          'زر «اعتماد الملف» الذهبي هو الشيء الذهبي الوحيد في الشاشة.',
          'كرت التواقيع بخلفية ذهبية فاتحة + إطار، يأخذ أهميته دون صراخ.',
          'إشارة RFP Scope Document §3.C صريحة — تتبع كل ميزة لمصدرها في الكرّاسة.',
          'الأرقام بخط Tabular يضمن تراصّ الأعمدة.',
        ]}
        before={<CommitteeBefore />}
        after={<CommitteeAfter />}
      />

      <Section
        index="04"
        route="/investigations/cases/CASE-00001"
        title="التحريات — قضية مُصنَّفة"
        beforeNote={[
          '«CLASSIFIED» مجرد شارة صغيرة في العنوان — لا تنبيه بصري كافٍ.',
          'السايد بار بنفس التيركواز — لا يوجد تحذير من حساسية البيانات.',
          'شجرة الأسرة قائمة نصية — لا هرمية درجات.',
          '«يحتاج مراجعة» بلون التيراكوتا — نفس لون «CLASSIFIED» — تصادم دلالي.',
        ]}
        afterNote={[
          'شريط CLASSIFIED · LEVEL 3 ثابت بأعلى الشاشة + رقم الجلسة والمستخدم.',
          'قضيب هوية تيراكوتا 4px — التطبيق نفسه يحمل هويته البصرية.',
          'شجرة الأسرة منظَّمة في 4 درجات صريحة، مع 3 حالات ملوّنة.',
          '«درجة المخاطرة» Tabular numeric — يُقرأ ويُقارن.',
          'إحالة RFP Scope Document §6.5 صريحة لشجرة الأسرة.',
        ]}
        before={<InvestigationsBefore />}
        after={<InvestigationsAfter />}
      />

      <TokensSection />
    </CenteredShell>
  );
}

/* ─────────── Section frame ─────────── */

function Section({
  index, route, title, beforeNote, afterNote, before, after,
}: {
  index: string;
  route: string;
  title: string;
  beforeNote: string[];
  afterNote: string[];
  before: JSX.Element;
  after: JSX.Element;
}): JSX.Element {
  return (
    <section className="mb-12">
      <header className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-xs font-bold tracking-widest" style={{ color: v2.g500 }} dir="ltr">
          {index}
        </span>
        <h2 className="font-ar-display text-xl font-bold text-ink-900">{title}</h2>
        <span className="ms-auto font-mono text-2xs" style={{ color: v2.n400 }} dir="ltr">{route}</span>
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <MockFrame label="BEFORE" labelBg={v1.ink700} labelFg={v1.gold500}>
            {before}
          </MockFrame>
          <NotePanel kind="before" items={beforeNote} title="ما المشكلة؟" />
        </div>
        <div>
          <MockFrame label="AFTER · v2" labelBg={v2.p700} labelFg="#fff">
            {after}
          </MockFrame>
          <NotePanel kind="after" items={afterNote} title="ما الذي تغيّر؟" />
        </div>
      </div>
    </section>
  );
}

function NotePanel({
  title, items, kind,
}: { title: string; items: string[]; kind: 'before' | 'after' }): JSX.Element {
  const accent = kind === 'after' ? v2.g500 : v1.gold500;
  return (
    <div
      className="mt-3 rounded-md border p-4 text-2xs leading-loose"
      style={{ borderColor: v2.n100, background: v2.n0, color: v2.n700 }}
    >
      <p className="mb-1 font-bold" style={{ color: accent }}>{title}</p>
      <ul className="list-disc space-y-1 pe-4">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

/* ─── 1920×1080 mock canvas with auto-scaler ─── */

function MockFrame({
  label, labelBg, labelFg, children,
}: {
  label: string;
  labelBg: string;
  labelFg: string;
  children: JSX.Element;
}): JSX.Element {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scalerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function rescale(): void {
      const c = canvasRef.current, s = scalerRef.current;
      if (!c || !s) return;
      s.style.transform = `scale(${c.clientWidth / 1920})`;
    }
    rescale();
    const ro = new ResizeObserver(rescale);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return (): void => ro.disconnect();
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-lg shadow-md"
      style={{ background: '#fff', aspectRatio: '16 / 9' }}
    >
      <span
        className="absolute z-10 font-mono text-[9px] font-bold tracking-widest"
        style={{
          insetInlineStart: '12px', top: '12px',
          padding: '5px 9px', borderRadius: '4px', letterSpacing: '0.18em',
          background: labelBg, color: labelFg, direction: 'ltr',
        }}
      >
        {label}
      </span>
      <div ref={canvasRef} className="absolute inset-0 overflow-hidden">
        <div
          ref={scalerRef}
          className="absolute"
          style={{
            insetInlineStart: 0, top: 0,
            width: 1920, height: 1080,
            transformOrigin: 'top right',
            direction: 'rtl',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
                          BEFORE — HUB
   ════════════════════════════════════════════════════════════════ */

function HubBefore(): JSX.Element {
  const NAV = ['اللوحة الرئيسية', 'المتقدمون', 'اللجان', 'القومسيون الطبي', 'الهيئة العليا', 'التحريات', 'بنك الأسئلة', 'التقارير'];
  return (
    <div style={{ display: 'flex', flexDirection: 'row-reverse', height: '100%', background: v1.cream, fontFamily: 'IBM Plex Sans Arabic, sans-serif' }}>
      <aside style={{ width: 280, background: v1.teal700, color: v1.cream, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 28, borderBottom: '1px solid rgba(221,184,90,0.2)', marginBottom: 24 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'radial-gradient(circle at 30% 30%, #DDB85A, #7A5A1A)', display: 'grid', placeItems: 'center', color: v1.teal900, fontWeight: 800, fontSize: 18, fontFamily: 'Tajawal' }}>أ.ش</div>
          <div style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>أكاديمية الشرطة<small style={{ display: 'block', fontWeight: 400, fontSize: 12, opacity: 0.7, marginTop: 2 }}>منظومة القبول</small></div>
        </div>
        {NAV.map((n, i) => (
          <div key={n} style={{ padding: '12px 16px', borderRadius: 8, fontSize: 15, display: 'flex', gap: 12, alignItems: 'center', color: i === 0 ? v1.teal900 : '#C9DDDD', background: i === 0 ? v1.gold500 : 'transparent', fontWeight: i === 0 ? 600 : 400 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? v1.teal900 : 'rgba(255,255,255,.25)' }} />
            {n}
          </div>
        ))}
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 72, background: v1.teal600, color: v1.cream2, display: 'flex', alignItems: 'center', padding: '0 40px', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, opacity: 0.85 }}>الرئيسية / لوحة الإدارة</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {['دورة القبول 2026', 'المهندس · أحمد عبدالعزيز'].map((c) => (
              <span key={c} style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(221,184,90,.4)', padding: '6px 14px', borderRadius: 999, fontSize: 13, color: '#DDB85A' }}>{c}</span>
            ))}
          </div>
        </div>
        <div style={{ background: `linear-gradient(135deg, ${v1.teal700}, ${v1.teal600} 60%, ${v1.teal500})`, color: v1.cream2, padding: '56px 56px 48px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, rgba(221,184,90,.08) 0 2px, transparent 2px 14px)' }} />
          <div style={{ position: 'relative' }}>
            <h1 style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: 56, margin: '0 0 16px', lineHeight: 1.15 }}>صباح الخير، أحمد</h1>
            <p style={{ fontSize: 20, opacity: 0.85, margin: '0 0 28px', maxWidth: 720, lineHeight: 1.6 }}>لوحة الإدارة الموحَّدة لمنظومة القبول الإلكتروني — أكاديمية الشرطة، دورة 2026</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[['المتقدمون النشطون', '2,847'], ['قيد المراجعة', '318'], ['جلسات الهيئة اليوم', '2']].map(([l, vl]) => (
                <div key={l} style={{ padding: '10px 18px', borderRadius: 999, background: 'rgba(247,244,235,.1)', border: '1px solid rgba(221,184,90,.4)', color: '#FBF5E8', fontSize: 14 }}>
                  {l} <b style={{ color: '#DDB85A', fontWeight: 600, marginInlineStart: 8 }}>{vl}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ height: 18, background: `repeating-linear-gradient(90deg, ${v1.gold500} 0 14px, ${v1.teal500} 14px 28px, ${v1.terra500} 28px 42px, ${v1.teal600} 42px 56px)` }} />
        <div style={{ padding: '32px 40px', flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, alignContent: 'start' }}>
          {[['إجمالي الطلبات', '2,847', '+ 4.2% week'], ['قيد التحريات', '412', 'stage 7'], ['القومسيون الطبي', '186', 'today'], ['قرارات الهيئة', '94', 'cycle']].map(([l, val, d]) => (
            <div key={l} style={{ background: '#fff', border: '1px solid rgba(15,14,8,.08)', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 13, color: v1.ink500, marginBottom: 8 }}>{l}</div>
              <div style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 32, color: '#0F0E08' }}>{val}</div>
              <div style={{ fontSize: 12, color: v1.teal500, marginTop: 6, fontFamily: 'JetBrains Mono', direction: 'ltr', textAlign: 'left' }}>{d}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
                         AFTER — HUB (v2 · Navy)
   ════════════════════════════════════════════════════════════════ */

function HubAfter(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'row-reverse', height: '100%', background: v2.n25, fontFamily: 'IBM Plex Sans Arabic, sans-serif' }}>
      <aside style={{ width: 264, background: '#fff', borderInlineStart: `1px solid ${v2.n100}`, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <span style={{ position: 'absolute', top: 0, bottom: 0, insetInlineEnd: 0, width: 4, background: v2.p700 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '28px 24px 20px', borderBottom: `1px solid ${v2.n100}` }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: v2.p50, border: `1px solid ${v2.p100}`, display: 'grid', placeItems: 'center', color: v2.p700, fontWeight: 700, fontSize: 16, fontFamily: 'Tajawal' }}>أ.ش</div>
          <div style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 16, color: v2.n800, lineHeight: 1.2 }}>
            أكاديمية الشرطة
            <small style={{ display: 'block', fontWeight: 400, fontSize: 11, color: v2.n400, marginTop: 3, fontFamily: 'JetBrains Mono', letterSpacing: '0.06em', direction: 'ltr', textAlign: 'right' }}>ADMIN HUB</small>
          </div>
        </div>
        <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <NavGroup label="OVERVIEW" items={[['اللوحة الرئيسية', true], ['المتقدمون'], ['التقارير']]} />
          <NavGroup label="APPLICATIONS" items={[['اللجان'], ['القومسيون الطبي'], ['الهيئة العليا'], ['التحريات'], ['بنك الأسئلة']]} />
          <NavGroup label="SYSTEM" items={[['الإعدادات']]} />
        </nav>
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: v2.n25 }}>
        <div style={{ height: 64, background: '#fff', borderBottom: `1px solid ${v2.n100}`, display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: v2.n400, letterSpacing: '0.06em', direction: 'ltr' }}>
            <span>HUB</span> / <span style={{ color: v2.n700 }}>DASHBOARD</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '5px 12px', background: v2.success50, color: v2.success500, borderRadius: 999, fontSize: 13 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: v2.success500, boxShadow: 'rgba(46,135,85,.18) 0 0 0 3px' }} />
              المنظومة تعمل
            </span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, color: v2.n600 }}>
              <span>المهندس أحمد عبدالعزيز</span>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: v2.n100, display: 'grid', placeItems: 'center', fontFamily: 'Tajawal', color: v2.n600, fontWeight: 600, fontSize: 13 }}>أع</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${v2.n100}`, background: '#fff' }}>
          <div>
            <h1 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 26, margin: '0 0 4px', color: v2.n800 }}>صباح الخير، أحمد</h1>
            <p style={{ margin: 0, fontSize: 14, color: v2.n500 }}>دورة القبول 2026 — اليوم الـ 38 من 90</p>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {[['CYCLE', '2026 / Q2', false], ['STAGE', 'المرحلة 6', true], ['UPDATED', '14:32', false]].map(([k, val, ar]) => (
              <div key={k as string} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: v2.n400, fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', direction: 'ltr' }}>{k}</div>
                <div style={{ fontFamily: ar ? 'Tajawal' : 'Inter Tight', fontWeight: 600, fontSize: 18, color: v2.n800, fontFeatureSettings: '"tnum"', direction: 'ltr' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '24px 32px', flex: 1, display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignContent: 'start' }}>
            <Kpi label="TOTAL APPLICANTS" value="2,847" delta="+118 this week" />
            <Kpi label="UNDER INVESTIGATION" value="412" delta="+12 today" />
            <Kpi label="MEDICAL TODAY" value="186" delta="94% capacity" />
            <Kpi label="BOARD DECISIONS" value="94" delta="2 sessions today" />
            <Kpi label="PENDING REVIEW" value="318" delta="−12 since 12:00" deltaDown />
            <Kpi label="EXAM SLOTS" value="1,240" delta="71% booked" />
          </div>
          <aside style={{ background: '#fff', border: `1px solid ${v2.n100}`, borderRadius: 10, padding: 20 }}>
            <h3 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 15, margin: '0 0 14px', color: v2.n800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              سجل النشاط <a style={{ fontSize: 11.5, color: v2.p500, fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', direction: 'ltr' }}>VIEW ALL</a>
            </h3>
            {[
              ['س.ع', 'سامي عمر', 'اعتمد جلسة C-01 — 17 ملف', '14:32', 'COMMITTEE'],
              ['د.م', 'د. محمود', 'أنهى فحص BMI لـ 24 متقدم', '14:18', 'MEDICAL'],
              ['ع.ر', 'عمر رشاد', 'فتح قضية CASE-00318', '14:02', 'INVESTIGATIONS'],
              ['ل.ا', 'د. ليلى أحمد', 'رفعت قرار الهيئة SES-0007', '13:45', 'BOARD'],
              ['ن.ك', 'نادر كمال', 'أضاف 12 سؤال للبنك', '13:21', 'QUESTION BANK'],
            ].map(([av, name, body, t, src], i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${v2.n50}`, fontSize: 13.5 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: v2.p50, color: v2.p700, display: 'grid', placeItems: 'center', fontFamily: 'Tajawal', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{av}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div><b style={{ color: v2.n800, fontWeight: 600 }}>{name}</b> <span style={{ color: v2.n600 }}>{body}</span></div>
                  <div style={{ color: v2.n400, fontSize: 11.5, marginTop: 2, fontFamily: 'JetBrains Mono', direction: 'ltr', textAlign: 'right' }}>{t} · {src}</div>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </main>
    </div>
  );
}

function NavGroup({ label, items }: { label: string; items: [string, boolean?][] }): JSX.Element {
  return (
    <>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.16em', color: v2.n400, padding: '12px 12px 6px', direction: 'ltr', textAlign: 'right' }}>{label}</div>
      {items.map(([n, active]) => (
        <div key={n} style={{ padding: '10px 12px', borderRadius: 6, fontSize: 14.5, display: 'flex', gap: 10, alignItems: 'center', color: active ? v2.p700 : v2.n600, background: active ? v2.p50 : 'transparent', fontWeight: active ? 600 : 400 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? v2.p500 : v2.n300 }} />
          {n}
        </div>
      ))}
    </>
  );
}

function Kpi({ label, value, delta, deltaDown }: { label: string; value: string; delta: string; deltaDown?: boolean }): JSX.Element {
  const stroke = deltaDown ? v2.danger500 : v2.p500;
  const points = deltaDown ? '0,8 10,10 20,9 30,12 40,14 50,13 60,16 70,18' : '0,18 10,15 20,16 30,12 40,10 50,8 60,6 70,4';
  return (
    <div style={{ background: '#fff', border: `1px solid ${v2.n100}`, borderRadius: 10, padding: 20, position: 'relative' }}>
      <div style={{ fontSize: 12, color: v2.n500, marginBottom: 12, fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', direction: 'ltr', textAlign: 'right', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: 'Inter Tight', fontWeight: 600, fontSize: 38, color: v2.n800, fontFeatureSettings: '"tnum"', lineHeight: 1, direction: 'ltr', textAlign: 'right' }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <div style={{ fontSize: 12, color: deltaDown ? v2.danger500 : v2.success500, fontFamily: 'Inter Tight', fontWeight: 500, direction: 'ltr' }}>{delta}</div>
        <svg width={70} height={24} viewBox="0 0 70 24"><polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} /></svg>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
                          BEFORE — LOGIN
   ════════════════════════════════════════════════════════════════ */

function LoginBefore(): JSX.Element {
  return (
    <div style={{ display: 'flex', height: '100%', background: v1.cream2, fontFamily: 'IBM Plex Sans Arabic, sans-serif' }}>
      <div style={{ flex: 1, background: `linear-gradient(135deg, ${v1.teal900}, ${v1.teal700}, ${v1.teal600})`, color: v1.cream2, padding: 80, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, rgba(221,184,90,.08) 0 2px, transparent 2px 14px)', opacity: 0.6 }} />
        <div style={{ position: 'relative', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: 14, background: 'radial-gradient(circle at 30% 30%, #DDB85A, #7A5A1A)', display: 'grid', placeItems: 'center', color: v1.teal900, fontWeight: 800, fontSize: 32, fontFamily: 'Tajawal' }}>أ.ش</div>
          <div>
            <h1 style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: 30, margin: '0 0 6px' }}>أكاديمية الشرطة</h1>
            <p style={{ margin: 0, fontSize: 16, opacity: 0.75 }}>منظومة القبول الإلكتروني · 2026</p>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <h2 style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: 60, lineHeight: 1.15, margin: '0 0 20px' }}>منظومة القبول الإلكتروني الموحّدة</h2>
          <p style={{ fontSize: 18, lineHeight: 1.7, opacity: 0.8, maxWidth: 540, margin: 0 }}>منظومة متكاملة تربط 9 تطبيقات و11 مرحلة قبول و6 جهات حكومية في واجهة واحدة آمنة وخاضعة للرقابة الكاملة.</p>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: 48, paddingTop: 24, borderTop: '1px solid rgba(221,184,90,.2)' }}>
          {[['9', 'تطبيقات'], ['11', 'مراحل'], ['2,847', 'متقدم']].map(([val, l]) => (
            <div key={l}>
              <div style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: 36, color: '#DDB85A' }}>{val}</div>
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, padding: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 720 }}>
        <h2 style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: 36, margin: '0 0 12px', color: '#0F0E08' }}>تسجيل الدخول</h2>
        <p style={{ fontSize: 16, color: v1.ink500, margin: '0 0 36px' }}>أدخل بياناتك للوصول إلى لوحة التحكم</p>
        {[['اسم المستخدم', 'ahmed.abdelaziz'], ['كلمة المرور', '••••••••••']].map(([l, val]) => (
          <div key={l} style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: v1.ink700, marginBottom: 8 }}>{l}</label>
            <div style={{ width: '100%', height: 52, borderRadius: 8, border: '1.5px solid rgba(15,14,8,.12)', background: '#fff', padding: '0 16px', fontSize: 15, color: '#0F0E08', display: 'flex', alignItems: 'center' }}>{val}</div>
          </div>
        ))}
        <button style={{ width: '100%', height: 56, borderRadius: 8, border: 'none', background: v1.teal600, color: '#fff', fontFamily: 'Tajawal', fontWeight: 700, fontSize: 17, marginTop: 12, boxShadow: '0 8px 20px -8px rgba(26,104,104,.5)' }}>تسجيل الدخول</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
                       AFTER — LOGIN (v2 · Navy)
   ════════════════════════════════════════════════════════════════ */

function LoginAfter(): JSX.Element {
  return (
    <div style={{ display: 'flex', height: '100%', background: v2.n25, fontFamily: 'IBM Plex Sans Arabic, sans-serif' }}>
      <div style={{ flex: '0 0 40%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 56, color: '#fff' }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, rgba(20,55,100,.85), rgba(30,67,115,.6)), repeating-linear-gradient(45deg, rgba(255,255,255,.04) 0 1px, transparent 1px 8px), linear-gradient(180deg, ${v2.p500}, ${v2.p800})` }} />
        <div style={{ position: 'absolute', bottom: 16, insetInlineEnd: 16, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'rgba(255,255,255,.4)', letterSpacing: '0.16em', direction: 'ltr' }}>PLACEHOLDER · ACADEMY BUILDING PHOTO</div>
        <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(221,184,90,.3)', display: 'grid', placeItems: 'center', color: v2.g300, fontWeight: 700, fontSize: 22, fontFamily: 'Tajawal' }}>أ.ش</div>
          <div>
            <h1 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 20, margin: '0 0 2px' }}>أكاديمية الشرطة</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,.7)', fontFamily: 'JetBrains Mono', letterSpacing: '0.06em', direction: 'ltr', textAlign: 'right' }}>POLICE ACADEMY · ADMISSIONS</p>
          </div>
        </div>
        <div style={{ position: 'relative', marginTop: 'auto' }}>
          <h2 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 36, lineHeight: 1.3, margin: '0 0 12px', maxWidth: 520 }}>منظومة القبول الإلكتروني الموحّدة لدورة 2026.</h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,.65)', maxWidth: 520 }}>وصول مُؤمَّن وخاضع للرقابة الكاملة، مرتبط مباشرة بأنظمة وزارة الداخلية والجهات الحكومية المعنية.</p>
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'rgba(255,255,255,.5)', letterSpacing: '0.12em', direction: 'ltr' }}>
            <span>SYSTEM v2.0.4</span>
            <span>● ALL SYSTEMS OPERATIONAL</span>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: '80px 96px', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 760 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11.5, letterSpacing: '0.18em', color: v2.p500, marginBottom: 16, direction: 'ltr', textAlign: 'right', textTransform: 'uppercase' }}>/ STAFF SIGN-IN</div>
        <h2 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 32, margin: '0 0 10px', color: v2.n800 }}>أهلاً بعودتك</h2>
        <p style={{ fontSize: 15, color: v2.n500, margin: '0 0 40px', lineHeight: 1.6 }}>أدخل بيانات الدخول الموحَّدة (MOIPASS) للوصول إلى لوحات التطبيقات.</p>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: v2.n700, marginBottom: 8 }}>اسم المستخدم<span /></label>
          <div style={{ width: '100%', height: 52, borderRadius: 8, background: v2.n50, padding: '0 16px', fontSize: 15, color: v2.n800, display: 'flex', alignItems: 'center' }}>ahmed.abdelaziz</div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: v2.n700, marginBottom: 8 }}>
            كلمة المرور<span style={{ color: v2.p500, fontSize: 12, fontWeight: 500 }}>نسيت كلمة المرور؟</span>
          </label>
          <div style={{ width: '100%', height: 52, borderRadius: 8, background: '#fff', padding: '0 16px', fontSize: 15, color: v2.n800, display: 'flex', alignItems: 'center', outline: `2px solid ${v2.p500}`, outlineOffset: 0 }}>••••••••••</div>
        </div>
        <button style={{ width: '100%', height: 52, borderRadius: 8, border: 'none', background: v2.p500, color: '#fff', fontFamily: 'Tajawal', fontWeight: 700, fontSize: 16, marginTop: 8 }}>الدخول إلى المنظومة</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: v2.n500, marginTop: 24, paddingTop: 24, borderTop: `1px solid ${v2.n100}` }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: v2.n400, letterSpacing: '0.08em', direction: 'ltr' }}>ENTER ↵ to submit</span>
          <span>تواصل مع <a style={{ color: v2.p500, fontWeight: 500 }}>الدعم الفني</a></span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
                       BEFORE — COMMITTEE
   ════════════════════════════════════════════════════════════════ */

function CommitteeBefore(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'row-reverse', height: '100%', background: v1.cream, fontFamily: 'IBM Plex Sans Arabic, sans-serif' }}>
      <aside style={{ width: 240, background: v1.teal700, color: v1.cream, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[['COMMITTEE C-01', null], ['الاعتماد المزدوج', true], ['الملفات (570)', false], ['السجل', false], ['الأعضاء', false], ['SHORTCUTS', null], ['الرئيسية', false], ['التقارير', false]].map(([label, active], i) => (
          active === null
            ? <div key={i} style={{ fontSize: 11, fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', opacity: 0.5, padding: '12px 12px 6px', direction: 'ltr', textAlign: 'right' }}>{label}</div>
            : <div key={i} style={{ padding: '10px 14px', fontSize: 14, borderRadius: 6, opacity: active ? 1 : 0.8, background: active ? v1.gold500 : 'transparent', color: active ? v1.teal900 : 'inherit', fontWeight: active ? 600 : 400 }}>{label}</div>
        ))}
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: v1.teal600, color: v1.cream2, padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontFamily: 'Tajawal', fontWeight: 800, fontSize: 24 }}>لجنة القبول C-01 — جلسة الاعتماد</h1>
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={{ background: 'rgba(255,255,255,.08)', color: v1.cream, padding: '10px 18px', borderRadius: 6, fontSize: 14, border: 'none' }}>رفض</button>
            <button style={{ background: v1.teal500, color: '#fff', padding: '10px 22px', borderRadius: 6, fontSize: 14, fontWeight: 600, border: '1px solid rgba(221,184,90,.3)' }}>اعتماد الملف</button>
          </div>
        </div>
        <div style={{ flex: 1, padding: 32, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div style={{ background: '#fff', border: '1px solid rgba(15,14,8,.08)', borderRadius: 8, padding: 24 }}>
            <h3 style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: 18, margin: '0 0 16px', color: v1.teal600 }}>بيانات المتقدم — APP-2026-00318</h3>
            {[['الاسم', 'محمد أحمد عبدالرحمن السيد'], ['الرقم القومي', '29812150100918'], ['المحافظة', 'القاهرة'], ['المؤهل', 'الثانوية العامة 2024'], ['المجموع', '395 / 410 (96.3%)'], ['القومسيون الطبي', 'مكتمل · لائق'], ['التحريات', 'مكتمل · مقبول']].map(([l, val]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(15,14,8,.06)', fontSize: 14 }}>
                <span style={{ color: v1.ink500 }}>{l}</span><span style={{ color: '#0F0E08', fontWeight: 500, fontFamily: 'Tajawal' }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', border: '1px solid rgba(15,14,8,.08)', borderRadius: 8, padding: 24 }}>
            <h3 style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: 18, margin: '0 0 16px', color: v1.teal600 }}>التواقيع المطلوبة</h3>
            <div style={{ background: '#E6EFEF', border: '1px solid #C9DDDD', padding: '14px 18px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: v1.teal600, fontWeight: 600, fontFamily: 'Tajawal' }}>رئيس اللجنة</span>
              <span style={{ fontSize: 13, color: v1.teal500, fontFamily: 'JetBrains Mono', direction: 'ltr' }}>SIGNED · 14:18</span>
            </div>
            <div style={{ background: '#fff', border: '1px solid #DDB85A', padding: '14px 18px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: v1.gold700, fontWeight: 600, fontFamily: 'Tajawal' }}>عضو اللجنة الثاني</span>
              <span style={{ fontSize: 13, color: v1.gold500, fontFamily: 'JetBrains Mono', direction: 'ltr' }}>PENDING</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
                  AFTER — COMMITTEE (v2 · Gold rail)
   ════════════════════════════════════════════════════════════════ */

function CommitteeAfter(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'row-reverse', height: '100%', background: v2.n25, fontFamily: 'IBM Plex Sans Arabic, sans-serif' }}>
      <aside style={{ width: 240, background: '#fff', borderInlineStart: `1px solid ${v2.n100}`, position: 'relative', display: 'flex', flexDirection: 'column', padding: '16px 12px' }}>
        <span style={{ position: 'absolute', insetInlineEnd: 0, top: 0, bottom: 0, width: 4, background: v2.g500 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 14px', marginBottom: 8, borderBottom: `1px solid ${v2.n100}` }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, background: v2.g50, color: v2.g700, display: 'grid', placeItems: 'center', fontFamily: 'Tajawal', fontWeight: 700, fontSize: 14 }}>L1</div>
          <div style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 14, color: v2.n800 }}>
            لجنة القبول
            <small style={{ display: 'block', fontSize: 10.5, fontWeight: 400, color: v2.n400, fontFamily: 'JetBrains Mono', letterSpacing: '0.06em', direction: 'ltr', textAlign: 'right', marginTop: 1 }}>COMMITTEE · C-01</small>
          </div>
        </div>
        <NavGroupGold label="SESSION" items={[['الاعتماد المزدوج', true], ['الملفات النشطة'], ['سجل القرارات']]} />
        <NavGroupGold label="COMMITTEE" items={[['الأعضاء'], ['الإحصائيات']]} />
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', borderBottom: `1px solid ${v2.n100}`, padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: v2.n400, letterSpacing: '0.06em', direction: 'ltr' }}>
            COMMITTEES / <span style={{ color: v2.n800 }}>C-01</span> / SESSION
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {['حفظ كمسودّة', 'رفض'].map((b) => (
              <button key={b} style={{ background: '#fff', border: `1px solid ${v2.n200}`, color: v2.n700, padding: '8px 16px', borderRadius: 6, fontSize: 13.5 }}>{b}</button>
            ))}
            <button style={{ background: v2.g500, color: '#fff', padding: '8px 18px', borderRadius: 6, fontSize: 13.5, fontWeight: 600, border: 'none', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
              اعتماد الملف
            </button>
          </div>
        </div>
        <div style={{ padding: '28px 32px 20px', background: '#fff', borderBottom: `1px solid ${v2.n100}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 26, margin: '0 0 4px', color: v2.n800 }}>جلسة الاعتماد · APP-2026-00318</h1>
            <p style={{ margin: 0, fontSize: 14, color: v2.n500 }}>محمد أحمد عبدالرحمن السيد — القاهرة — جميع المراحل السابقة مكتملة</p>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            {[['17 / 24', 'PROGRESS'], ['1 / 2', 'SIGNATURES'], ['14:32', 'UPDATED']].map(([val, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Inter Tight', fontWeight: 600, fontSize: 24, color: v2.n800, fontFeatureSettings: '"tnum"', direction: 'ltr' }}>{val}</div>
                <div style={{ fontSize: 11, color: v2.n400, fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', direction: 'ltr', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, padding: '24px 32px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div style={{ background: '#fff', border: `1px solid ${v2.n100}`, borderRadius: 10, padding: '20px 24px' }}>
            <h3 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 15, margin: '0 0 16px', color: v2.n800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              بيانات المتقدم
              <span style={{ background: v2.n50, color: v2.n500, fontSize: 11, padding: '3px 10px', borderRadius: 999, fontFamily: 'JetBrains Mono', letterSpacing: '0.06em', fontWeight: 400, direction: 'ltr' }}>FROM STAGE 1–6</span>
            </h3>
            {[
              ['الاسم الرباعي', 'محمد أحمد عبدالرحمن السيد', false],
              ['الرقم القومي', '2 9812 15 010 0918', true],
              ['المحافظة', 'القاهرة', false],
              ['المؤهل الدراسي', 'الثانوية العامة — 2024', false],
              ['المجموع', '395 / 410 · 96.3%', true],
              ['القومسيون الطبي', 'مكتمل · لائق طبياً', false],
              ['التحريات الأمنية', 'مكتمل · مقبول (مستوى 2)', false],
              ['قرار الهيئة', 'في انتظار اعتماد اللجنة', false],
            ].map(([l, val, mono], i, arr) => (
              <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${v2.n50}`, fontSize: 13.5 }}>
                <span style={{ color: v2.n500 }}>{l}</span>
                <span style={{ color: v2.n800, fontWeight: 500, fontFamily: mono ? 'JetBrains Mono' : 'Tajawal', fontSize: mono ? 12.5 : undefined, direction: mono ? 'ltr' : undefined }}>{val}</span>
              </div>
            ))}
          </div>
          <aside style={{ background: v2.g50, border: '1px solid #EBD79B', borderRadius: 10, padding: '20px 24px' }}>
            <h3 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 15, margin: '0 0 14px', color: v2.g700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              التواقيع المطلوبة
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: v2.g700, opacity: 0.7, fontWeight: 400, letterSpacing: '0.06em', direction: 'ltr' }}>RFP Scope Document §3.C</span>
            </h3>
            {[
              { name: 'رئيس اللجنة', who: 'العقيد سامي عمر', t: '14:18', signed: true },
              { name: 'العضو الثاني', who: 'المقدّم خالد منصور', t: 'PENDING', signed: false },
            ].map((s) => (
              <div key={s.name} style={{ background: '#fff', border: '1px solid #EBD79B', padding: '14px 16px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, color: v2.n800, fontFamily: 'Tajawal', fontWeight: 600 }}>
                  {s.name}<small style={{ display: 'block', fontSize: 11.5, color: v2.n500, fontWeight: 400, marginTop: 2 }}>{s.who}</small>
                </div>
                <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: s.signed ? v2.success500 : v2.g700, fontFamily: 'Inter Tight', fontWeight: 500 }}>
                  <span>{s.signed ? '✓' : '○'}</span>{s.t}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed #EBD79B', fontSize: 12, color: v2.g700, fontFamily: 'Tajawal', lineHeight: 1.6 }}>
              لا يصبح القرار نافذاً إلا بعد اكتمال التوقيعين. سيتم إخطار الهيئة العليا تلقائياً عند الاعتماد.
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function NavGroupGold({ label, items }: { label: string; items: [string, boolean?][] }): JSX.Element {
  return (
    <>
      <div style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono', letterSpacing: '0.16em', color: v2.n400, padding: '14px 12px 6px', direction: 'ltr', textAlign: 'right', textTransform: 'uppercase' }}>{label}</div>
      {items.map(([n, active]) => (
        <div key={n} style={{ padding: '9px 12px', fontSize: 14, borderRadius: 6, color: active ? v2.g700 : v2.n600, background: active ? v2.g50 : 'transparent', fontWeight: active ? 600 : 400, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? v2.g500 : v2.n300 }} />
          {n}
        </div>
      ))}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
                     BEFORE — INVESTIGATIONS
   ════════════════════════════════════════════════════════════════ */

function InvestigationsBefore(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'row-reverse', height: '100%', background: v1.cream, fontFamily: 'IBM Plex Sans Arabic, sans-serif' }}>
      <aside style={{ width: 240, background: v1.teal700, color: v1.cream, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[['INVESTIGATIONS', null], ['صندوق القضايا', false], ['CASE-00001', true], ['CASE-00002', false], ['CASE-00003', false], ['REFERENCES', null], ['قاعدة الأسماء', false], ['السجل التاريخي', false]].map(([label, active], i) => (
          active === null
            ? <div key={i} style={{ fontSize: 11, fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', opacity: 0.5, padding: '12px 12px 6px', direction: 'ltr', textAlign: 'right' }}>{label}</div>
            : <div key={i} style={{ padding: '10px 14px', fontSize: 14, borderRadius: 6, opacity: active ? 1 : 0.8, background: active ? v1.gold500 : 'transparent', color: active ? v1.teal900 : 'inherit', fontWeight: active ? 600 : 400 }}>{label}</div>
        ))}
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: v1.teal600, color: v1.cream2, padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontFamily: 'Tajawal', fontSize: 22, fontWeight: 800 }}>
            <span style={{ display: 'inline-block', background: v1.terra500, color: '#fff', fontSize: 11, padding: '3px 10px', borderRadius: 4, marginInlineStart: 12, fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', verticalAlign: 'middle' }}>CLASSIFIED</span>
            قضية تحريات — CASE-00001
          </h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ background: 'rgba(255,255,255,.08)', color: v1.cream, padding: '10px 18px', borderRadius: 6, border: 'none', fontSize: 14 }}>إغلاق</button>
            <button style={{ background: v1.teal500, color: '#fff', padding: '10px 22px', borderRadius: 6, border: '1px solid rgba(221,184,90,.3)', fontWeight: 600, fontSize: 14 }}>رفع للهيئة</button>
          </div>
        </div>
        <div style={{ flex: 1, padding: 32, display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 }}>
          <div style={{ background: '#fff', border: '1px solid rgba(15,14,8,.08)', padding: 24, borderRadius: 8 }}>
            <h3 style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: 16, margin: '0 0 16px', color: v1.teal600 }}>بيانات المتقدم</h3>
            <div style={{ fontSize: 14, lineHeight: 1.9, color: v1.ink700 }}>
              <div>الاسم: عمر سامي محمد فؤاد</div>
              <div>الرقم القومي: 30005120103847</div>
              <div>الجنسية: مصري</div>
              <div>درجة المخاطرة: متوسطة</div>
              <div>تاريخ الفتح: 2026-04-12</div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid rgba(15,14,8,.08)', padding: 24, borderRadius: 8 }}>
            <h3 style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: 16, margin: '0 0 16px', color: v1.teal600 }}>شجرة الأسرة (حتى الدرجة الرابعة)</h3>
            <div style={{ fontSize: 13.5, lineHeight: 1.9, color: v1.ink700 }}>
              <div>الأب: سامي محمد · مقبول</div>
              <div>الأم: فاطمة عبدالله · مقبول</div>
              <div>الجد لأب: محمد علي · مقبول</div>
              <div>الجدة لأب: زينب أحمد · مقبول</div>
              <div>عم: حسام محمد · <span style={{ color: v1.terra500, fontWeight: 600 }}>يحتاج مراجعة</span></div>
              <div>ابن عم: طارق حسام · مقبول</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
                AFTER — INVESTIGATIONS (v2 · Terra rail)
   ════════════════════════════════════════════════════════════════ */

function InvestigationsAfter(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'row-reverse', height: '100%', background: v2.n25, fontFamily: 'IBM Plex Sans Arabic, sans-serif', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, insetInlineStart: 0, insetInlineEnd: 0, height: 28, background: v2.t700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', zIndex: 5, fontFamily: 'JetBrains Mono', fontSize: 11, letterSpacing: '0.18em', direction: 'ltr' }}>
        <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: v2.t500, boxShadow: 'rgba(255,255,255,.18) 0 0 0 3px' }} />
          CLASSIFIED · LEVEL 3 · INVESTIGATIONS
        </span>
        <span>SESSION SES-44712 · 14:32 · O.RASHAD</span>
      </div>
      <aside style={{ width: 240, background: '#fff', borderInlineStart: `1px solid ${v2.n100}`, position: 'relative', display: 'flex', flexDirection: 'column', padding: '40px 12px 16px' }}>
        <span style={{ position: 'absolute', insetInlineEnd: 0, top: 28, bottom: 0, width: 4, background: v2.t500 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 14px', marginBottom: 8, borderBottom: `1px solid ${v2.n100}` }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, background: v2.t50, color: v2.t700, display: 'grid', placeItems: 'center', fontFamily: 'Tajawal', fontWeight: 700, fontSize: 14 }}>L3</div>
          <div style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 14, color: v2.n800 }}>
            التحريات
            <small style={{ display: 'block', fontSize: 10.5, fontWeight: 400, color: v2.n400, fontFamily: 'JetBrains Mono', letterSpacing: '0.06em', direction: 'ltr', textAlign: 'right', marginTop: 1 }}>INVESTIGATIONS</small>
          </div>
        </div>
        <NavGroupTerra label="CASES" items={[['صندوق الوارد'], ['CASE-00001', true], ['CASE-00002'], ['CASE-00003']]} />
        <NavGroupTerra label="REFERENCES" items={[['قاعدة الأسماء'], ['السجل التاريخي']]} />
      </aside>
      <main style={{ flex: 1, paddingTop: 28, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 32px', background: '#fff', borderBottom: `1px solid ${v2.n100}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 22, margin: 0, color: v2.n800 }}>
            قضية تحريات
            <small style={{ display: 'block', fontSize: 11.5, color: v2.n400, fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', direction: 'ltr', textAlign: 'right', marginTop: 3, fontWeight: 400 }}>CASE-00001 · OPENED 2026-04-12 · MEDIUM RISK</small>
          </h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '6px 12px', background: v2.t50, color: v2.t700, borderRadius: 4, fontFamily: 'JetBrains Mono', fontSize: 11.5, letterSpacing: '0.1em', fontWeight: 600, direction: 'ltr' }}>● LEVEL 3</span>
            <button style={{ background: '#fff', border: `1px solid ${v2.n200}`, color: v2.n700, padding: '8px 16px', borderRadius: 6, fontSize: 13.5 }}>حفظ</button>
            <button style={{ background: v2.t500, color: '#fff', padding: '8px 18px', borderRadius: 6, fontSize: 13.5, fontWeight: 600, border: 'none' }}>رفع للهيئة</button>
          </div>
        </div>
        <div style={{ flex: 1, padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 }}>
          <div style={{ background: '#fff', border: `1px solid ${v2.n100}`, borderRadius: 10, padding: '20px 24px', borderInlineStart: `3px solid ${v2.t500}` }}>
            <h3 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 14.5, margin: '0 0 14px', color: v2.n800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              بيانات المتقدم
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: v2.n400, fontWeight: 400, letterSpacing: '0.06em', direction: 'ltr' }}>APP-2026-00417</span>
            </h3>
            {([
              ['الاسم الرباعي', 'عمر سامي محمد فؤاد', null],
              ['الرقم القومي', '3 0005 12 010 3847', 'mono'],
              ['الجنسية', 'مصري', null],
              ['المحافظة', 'الإسكندرية', null],
              ['درجة المخاطرة', 'MEDIUM · 0.42', 'terra'],
              ['تاريخ الفتح', '2026-04-12', 'mono'],
              ['المسؤول', 'العقيد عمر رشاد', null],
            ] as [string, string, null | 'mono' | 'terra'][]).map(([l, val, kind], i, arr) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${v2.n50}`, fontSize: 13.5 }}>
                <span style={{ color: v2.n500 }}>{l}</span>
                <span style={{
                  color: kind === 'terra' ? v2.t700 : v2.n800,
                  fontWeight: 500,
                  fontFamily: kind === 'mono' ? 'JetBrains Mono' : kind === 'terra' ? 'Inter Tight' : 'Tajawal',
                  fontSize: kind === 'mono' || kind === 'terra' ? 12.5 : undefined,
                  fontFeatureSettings: kind === 'terra' ? '"tnum"' : undefined,
                  direction: kind ? 'ltr' : undefined,
                }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', border: `1px solid ${v2.n100}`, borderRadius: 10, padding: '20px 24px' }}>
            <h3 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 14.5, margin: '0 0 14px', color: v2.n800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              شجرة الأسرة — حتى الدرجة الرابعة
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: v2.n400, fontWeight: 400, letterSpacing: '0.06em', direction: 'ltr' }}>RFP Scope Document §6.5</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
              <FamilyDeg deg="DEG · 1" nodes={[['الأب · سامي م.'], ['الأم · فاطمة ع.']]} />
              <FamilyDeg deg="DEG · 2" nodes={[['جد لأب'], ['جدة لأب'], ['جد لأم'], ['جدة لأم']]} />
              <FamilyDeg deg="DEG · 3" nodes={[
                ['عمّ · أحمد م.'],
                ['عمّ · حسام م. · مراجعة', 'flag'],
                ['عمّة · سعاد م.'],
                ['خال · يوسف ع.'],
                ['خالة · هند ع. · بانتظار', 'pend'],
              ]} />
              <FamilyDeg deg="DEG · 4" nodes={[
                ['ابن عمّ · طارق ح.'],
                ['ابن عمّ · أيمن أ.'],
                ['بنت عمّة · ريم س.'],
                ['ابن خال · مازن ي.'],
                ['+8 آخرون'],
              ]} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavGroupTerra({ label, items }: { label: string; items: [string, boolean?][] }): JSX.Element {
  return (
    <>
      <div style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono', letterSpacing: '0.16em', color: v2.n400, padding: '14px 12px 6px', direction: 'ltr', textAlign: 'right', textTransform: 'uppercase' }}>{label}</div>
      {items.map(([n, active]) => (
        <div key={n} style={{ padding: '9px 12px', fontSize: 14, borderRadius: 6, color: active ? v2.t700 : v2.n600, background: active ? v2.t50 : 'transparent', fontWeight: active ? 600 : 400, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? v2.t500 : v2.n300 }} />
          {n}
        </div>
      ))}
    </>
  );
}

function FamilyDeg({ deg, nodes }: { deg: string; nodes: ([string] | [string, 'flag' | 'pend'])[] }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px dashed ${v2.n100}` }}>
      <div style={{ width: 64, flexShrink: 0, fontFamily: 'JetBrains Mono', fontSize: 11, color: v2.n400, letterSpacing: '0.08em', direction: 'ltr', textAlign: 'right' }}>{deg}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
        {nodes.map(([label, kind], i) => {
          const palette = kind === 'flag'
            ? { bg: v2.t50, fg: v2.t700, dot: v2.t500, weight: 500 }
            : kind === 'pend'
              ? { bg: v2.warning50, fg: v2.warning500, dot: v2.warning500, weight: 400 }
              : { bg: v2.n50, fg: v2.n700, dot: v2.success500, weight: 400 };
          return (
            <span key={i} style={{ background: palette.bg, color: palette.fg, padding: '5px 10px', borderRadius: 4, fontSize: 12.5, display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: palette.weight }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: palette.dot }} />
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
                 TOKENS SECTION (before vs after panels)
   ════════════════════════════════════════════════════════════════ */

function TokensSection(): JSX.Element {
  return (
    <section className="mb-10">
      <header className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-xs font-bold tracking-widest" style={{ color: v2.g500 }} dir="ltr">05</span>
        <h2 className="font-ar-display text-xl font-bold text-ink-900">خلاصة التوكنز · ما الذي يتغيَّر فعلاً</h2>
        <span className="ms-auto font-mono text-2xs" style={{ color: v2.n400 }} dir="ltr">tokens.css → tokens-v2.css</span>
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg p-6" style={{ background: '#fff', border: `1px solid ${v2.n100}` }}>
          <h3 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 18, margin: '0 0 16px', color: v2.n800 }}>قبل · النظام الحالي</h3>
          <div className="flex flex-col gap-3.5">
            <SwatchRow swatches={[v1.teal500]} title="teal-500" desc="#1A6868 · everywhere" />
            <SwatchRow swatches={[v1.gold500]} title="gold-500" desc="#B8862C · brand + warning (collision)" />
            <SwatchRow swatches={[v1.terra500]} title="terra-500" desc="#C44A30 · used decoratively" />
            <SwatchRow swatches={[v1.cream]} title="cream" desc="#F4F2ED · single neutral" border />
            <div className="border-t pt-3" style={{ borderColor: v2.n100 }}>
              <SwatchRow swatches={[]} customSwatch={
                <div style={{ width: 80, height: 48, background: `repeating-linear-gradient(45deg, ${v1.gold500} 0 8px, ${v1.teal500} 8px 16px, ${v1.terra500} 16px 24px, ${v1.teal600} 24px 32px)`, borderRadius: 6 }} />
              } title="khayameya" desc="decorative · everywhere" />
            </div>
          </div>
        </div>
        <div className="rounded-lg p-6" style={{ background: '#fff', border: `1px solid ${v2.n100}` }}>
          <h3 style={{ fontFamily: 'Tajawal', fontWeight: 700, fontSize: 18, margin: '0 0 16px', color: v2.n800 }}>بعد · Heritage Modern v2 · Ministerial Navy</h3>
          <div className="flex flex-col gap-3.5">
            <SwatchRow swatches={[v2.p50, v2.p300, v2.p500, v2.p700]} title="primary · navy scale" desc="brand surface + primary action · #143764 hero" />
            <SwatchRow swatches={[v2.g50, v2.g300, v2.g500, v2.g700]} title="accent · gold" desc="heritage · committee app · NOT warning" />
            <SwatchRow swatches={[v2.t50, v2.t500, v2.t700]} title="restricted · terra" desc="classified surfaces only" wide />
            <SwatchRow swatches={[v2.c50, v2.c500, v2.c700]} title="medical · cyan-teal" desc="medical app accent only" wide />
            <SwatchRow swatches={[v2.n25, v2.n100, v2.n300, v2.n500, v2.n700, v2.n900]} title="neutrals · warm slate" desc="9 stops · proper UI ramp" border />
            <div className="border-t pt-3" style={{ borderColor: v2.n100 }}>
              <SwatchRow swatches={[v2.success500, v2.warning500, v2.danger500, v2.info500]} title="semantic · separate" desc="success · warning · danger · info" wide />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SwatchRow({
  swatches, title, desc, border, wide, customSwatch,
}: {
  swatches: string[];
  title: string;
  desc: string;
  border?: boolean;
  wide?: boolean;
  customSwatch?: JSX.Element;
}): JSX.Element {
  const stripeWidth = wide ? 30 : swatches.length >= 6 ? 14 : 20;
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      {customSwatch ?? (
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: border ? `1px solid ${v2.n100}` : 'none' }}>
          {swatches.map((c, i) => (
            <span key={i} style={{ width: stripeWidth, height: 48, background: c }} />
          ))}
        </div>
      )}
      <div>
        <b style={{ fontFamily: 'Tajawal', color: v2.n800 }}>{title}</b>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: v2.n400, direction: 'ltr' }}>{desc}</div>
      </div>
    </div>
  );
}
