/**
 * RevampComparisonPage — visual before/after companion to DESIGN_REVAMP.md.
 *
 * Renders four side-by-side renders of /hub, /staff-login, /committee/C-01,
 * /investigations/cases/CASE-00001 — each pair shows the current teal-heavy
 * chrome on the left and the proposed "Heritage Modern v2" treatment on the
 * right. A tokens summary panel sits at the bottom.
 *
 * The "after" mocks render with v2 palette values inlined as plain styles —
 * NO global token changes — so this page can ship for stakeholder review
 * without touching the live design system. Source: design bundle handoff
 * (claude.ai/design), DESIGN_REVAMP.md §3 + §2.
 */

import { Link } from 'react-router-dom';
import {
  Activity,
  Bell,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Eye,
  FileText,
  Hourglass,
  Layers,
  ShieldAlert,
  Stethoscope,
  Users,
} from 'lucide-react';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { Card, KhayameyaStripe, PageHeader } from '@/shared/components';
import { ROUTES } from '@/config/routes';

/* ─────────── v2 palette inline (DESIGN_REVAMP §2.1) ─────────── */
const v2 = {
  n0:    '#FFFFFF',
  n25:   '#FAFAF7',
  n50:   '#F4F4F0',
  n100:  '#E9E8E1',
  n200:  '#D4D2C8',
  n400:  '#807E70',
  n500:  '#54524A',
  n700:  '#26251F',
  n900:  '#0A0907',
  p50:   '#E8F2F2',
  p100:  '#C4DEDE',
  p500:  '#1F7575',
  p700:  '#0E3F3F',
  p900:  '#051C1C',
  g50:   '#FBF5E8',
  g300:  '#DDB85A',
  g500:  '#B0822A',
  g700:  '#674916',
  t50:   '#FCEFEA',
  t500:  '#B8412A',
  t700:  '#7B2718',
  cyan:  '#0E8A8A',
  navy:  '#2069A8',
  amber: '#B27500',
};

/* ─────────── Page ─────────── */

export function RevampComparisonPage(): JSX.Element {
  return (
    <CenteredShell>
      <PageHeader
        title="نظام التصميم — مقارنة قبل وبعد"
        subtitle="عرض مرئي للنسخة المقترحة «Heritage Modern v2» على أربع شاشات رئيسية"
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
        index={1}
        route="/hub"
        title="لوحة الوصول الرئيسية"
        beforeNote="الـ hero بلون تيل مطلق يستهلك ٣٨٪ من الشاشة، والمؤشرات تختفي تحت الطية."
        afterNote="شريط ترحيب أبيض مدمج (١٢٪)، والمؤشرات الست تأخذ مكان البطل، وسجل النشاط بجوارها لا تحته."
        before={<HubBefore />}
        after={<HubAfter />}
      />

      <Section
        index={2}
        route="/staff-login"
        title="تسجيل دخول الموظفين"
        beforeNote="تقسيم ٥٠/٥٠ بلون التيل الداكن — تسجيل الدخول يبدو كأنه شاشة لوحة تحكم أخرى."
        afterNote="تقسيم ٦٠/٤٠ يفضّل النموذج، الجزء الأيسر صورة مبنى الأكاديمية مع طبقة شفافة — ظهور الشعار والاسم فقط."
        before={<LoginBefore />}
        after={<LoginAfter />}
      />

      <Section
        index={3}
        route="/committee/C-01"
        title="تفاصيل لجنة القبول"
        beforeNote="التيل في كل مكان؛ زر «اعتماد» نفس لون شريط التنقل والترويسة — لا يبرز."
        afterNote="شريط الهوية الجانبي + زر «اعتماد ٢» باللون الذهبي، وبطاقة التوقيع المزدوج بخلفية ذهبية فاتحة."
        before={<CommitteeBefore />}
        after={<CommitteeAfter />}
      />

      <Section
        index={4}
        route="/investigations/cases/CASE-00001"
        title="ملف التحريات السرّي"
        beforeNote="نفس قشرة التيل مع شارة «سرّي» صغيرة — لا تشعر الشاشة بالحساسية."
        afterNote="شريط هوية بلون terra، وشريط أعلى الصفحة «CLASSIFIED · LEVEL 3» مع رقم جلسة المستخدم؛ بقية القشرة محايدة."
        before={<InvestigationsBefore />}
        after={<InvestigationsAfter />}
      />

      <TokensPanel />

      <div className="mt-6">
        <KhayameyaStripe height="lg" />
      </div>
    </CenteredShell>
  );
}

/* ─────────── Section frame ─────────── */

function Section({
  index,
  route,
  title,
  beforeNote,
  afterNote,
  before,
  after,
}: {
  index: number;
  route: string;
  title: string;
  beforeNote: string;
  afterNote: string;
  before: JSX.Element;
  after: JSX.Element;
}): JSX.Element {
  return (
    <section className="mb-8">
      <header className="mb-4 flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 items-center justify-center rounded-md font-numeric tnum text-sm font-bold text-white"
          style={{ background: v2.p500 }}
        >
          {index}
        </span>
        <div className="flex-1">
          <h2 className="font-ar-display text-xl font-bold text-ink-900">{title}</h2>
          <p className="font-mono text-2xs text-ink-500" dir="ltr">{route}</p>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <header className="flex items-center justify-between border-b border-border-subtle bg-ink-50 px-4 py-2">
            <span className="text-2xs font-bold uppercase tracking-wide text-terra-700">قبل</span>
            <span className="text-2xs text-ink-500">النسخة الحالية</span>
          </header>
          <div className="aspect-[16/9] overflow-hidden bg-ink-50">{before}</div>
          <p className="border-t border-border-subtle px-4 py-3 text-2xs leading-normal text-ink-700">{beforeNote}</p>
        </Card>
        <Card className="overflow-hidden p-0" style={{ borderColor: v2.p500 }}>
          <header className="flex items-center justify-between border-b px-4 py-2" style={{ background: v2.p50, borderColor: v2.p100 }}>
            <span className="text-2xs font-bold uppercase tracking-wide" style={{ color: v2.p700 }}>بعد · v2</span>
            <span className="text-2xs" style={{ color: v2.n500 }}>Heritage Modern v2</span>
          </header>
          <div className="aspect-[16/9] overflow-hidden" style={{ background: v2.n25 }}>{after}</div>
          <p className="border-t px-4 py-3 text-2xs leading-normal" style={{ borderColor: v2.n100, color: v2.n700 }}>{afterNote}</p>
        </Card>
      </div>
    </section>
  );
}

/* ═══════════ MOCKS — BEFORE ═══════════ */

function HubBefore(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <div
        className="relative flex-1 px-5 py-4 text-white"
        style={{ background: 'linear-gradient(135deg, var(--teal-700) 0%, var(--teal-500) 100%)', minHeight: '38%' }}
      >
        <div className="flex items-center justify-between">
          <span className="rounded-pill bg-white/20 px-2 py-0.5 text-[10px]">١ مايو ٢٠٢٦</span>
          <Bell size={12} className="text-white/70" aria-hidden />
        </div>
        <p className="mt-3 font-ar-display text-md font-bold">صباح الخير، العميد د. أحمد</p>
        <p className="mt-1 text-[10px] text-white/70">المنظومة الكاملة للتحول الرقمي بإجراءات القبول</p>
      </div>
      <div className="grid grid-cols-4 gap-2 bg-ink-50 p-3">
        {[2847, 2236, 1892, 1456].map((n) => (
          <div key={n} className="rounded border border-border-subtle bg-surface-card p-2">
            <p className="text-[8px] text-ink-500">إجمالي</p>
            <p className="mt-0.5 font-numeric tnum text-sm font-bold text-ink-900" dir="ltr">{n.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginBefore(): JSX.Element {
  return (
    <div className="grid h-full grid-cols-2">
      <div
        className="flex flex-col justify-center p-5 text-white"
        style={{ background: 'linear-gradient(135deg, var(--teal-700) 0%, var(--teal-500) 100%)' }}
      >
        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded bg-white/15">
          <Layers size={14} className="text-gold-300" aria-hidden />
        </div>
        <p className="font-ar-display text-sm font-bold">منظومة القبول</p>
        <p className="mt-2 text-[10px] text-white/70 leading-relaxed">التحول الرقمي الكامل لإجراءات القبول والاختبارات</p>
        <div className="mt-3 grid grid-cols-3 gap-1 text-center">
          {['9', '12K+', '100%'].map((s) => (
            <p key={s} className="font-numeric tnum text-sm font-bold text-gold-300" dir="ltr">{s}</p>
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-center bg-surface-card p-5">
        <p className="text-2xs font-bold text-ink-900">دخول الموظفين</p>
        <input className="mt-2 rounded border border-border-default bg-surface-card px-2 py-1 text-[10px]" placeholder="الرقم القومي" dir="ltr" />
        <input className="mt-1 rounded border border-border-default bg-surface-card px-2 py-1 text-[10px]" placeholder="كلمة المرور" type="password" />
        <button className="mt-2 rounded bg-teal-500 px-2 py-1 text-[10px] text-white">دخول</button>
      </div>
    </div>
  );
}

function CommitteeBefore(): JSX.Element {
  return (
    <div className="flex h-full">
      <div className="w-16 bg-teal-500 p-2 text-[8px] text-white">
        <p className="font-bold">لجان</p>
        <ul className="mt-2 space-y-1">
          <li className="rounded bg-white/15 px-1 py-0.5">القائمة</li>
          <li className="opacity-70">الجدول</li>
        </ul>
      </div>
      <div className="flex-1 p-3">
        <p className="font-ar-display text-sm font-bold text-ink-900">لجنة طلبة 1</p>
        <p className="text-[10px] text-ink-500">العقيد محمد إبراهيم — ٥ أعضاء</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {['طابور', 'مراجعة', 'معتمد'].map((l) => (
            <div key={l} className="rounded border border-border-subtle p-2">
              <p className="text-[8px] text-ink-500">{l}</p>
              <p className="font-numeric tnum text-md font-bold text-ink-900" dir="ltr">42</p>
            </div>
          ))}
        </div>
        <button className="mt-3 rounded bg-teal-500 px-3 py-1 text-[10px] font-bold text-white">اعتماد ٢</button>
      </div>
    </div>
  );
}

function InvestigationsBefore(): JSX.Element {
  return (
    <div className="flex h-full">
      <div className="w-16 bg-teal-500 p-2 text-[8px] text-white">
        <p className="font-bold">تحريات</p>
        <ul className="mt-2 space-y-1">
          <li className="rounded bg-white/15 px-1 py-0.5">القضايا</li>
          <li className="opacity-70">الوارد</li>
        </ul>
      </div>
      <div className="flex-1 p-3">
        <div className="flex items-center justify-between">
          <p className="font-ar-display text-sm font-bold text-ink-900">قضية CASE-00001</p>
          <span className="rounded-pill bg-terra-50 px-2 py-0.5 text-[8px] font-bold text-terra-700">سرّي</span>
        </div>
        <p className="text-[10px] text-ink-500">المتقدم: حسن الخطيب</p>
        <div className="mt-2 rounded border border-border-subtle bg-ink-50 p-2 text-[8px] text-ink-700">
          ملخص ملف التقدم — للقراءة فقط
        </div>
      </div>
    </div>
  );
}

/* ═══════════ MOCKS — AFTER (v2) ═══════════ */

function HubAfter(): JSX.Element {
  return (
    <div className="flex h-full flex-col" style={{ background: v2.n25 }}>
      {/* Compact greeting bar — 12% */}
      <div className="flex items-center justify-between border-b px-5 py-2.5" style={{ background: v2.n0, borderColor: v2.n100 }}>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2 w-2 rounded-full" style={{ background: '#2E8755' }} aria-hidden />
          <p className="font-ar-display text-xs font-bold" style={{ color: v2.n900 }}>صباح الخير، العميد د. أحمد</p>
        </div>
        <div className="flex items-center gap-2 text-[10px]" style={{ color: v2.n500 }}>
          <span className="font-mono uppercase">CYCLE 2026</span>
          <span style={{ color: v2.n200 }}>·</span>
          <span>١ مايو ٢٠٢٦</span>
        </div>
      </div>

      {/* KPI hero + activity side by side */}
      <div className="grid flex-1 grid-cols-[1.6fr_1fr] gap-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: 'إجمالي المتقدمين', v: '2,847', c: v2.p500, i: <Users size={12} /> },
            { l: 'مدفوع الرسوم', v: '2,236', c: v2.p500, i: <ClipboardCheck size={12} /> },
            { l: 'قيد المراجعة', v: '459', c: v2.amber, i: <Hourglass size={12} /> },
            { l: 'مقبول', v: '432', c: '#2E8755', i: <CheckCircle2 size={12} /> },
            { l: 'مستبعد', v: '375', c: v2.t500, i: <ShieldAlert size={12} /> },
            { l: 'اليوم', v: '218', c: v2.cyan, i: <Activity size={12} /> },
          ].map((k) => (
            <div key={k.l} className="rounded-md border p-2.5" style={{ background: v2.n0, borderColor: v2.n200 }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8px] uppercase" style={{ color: v2.n400 }}>{k.l}</span>
                <span style={{ color: k.c }}>{k.i}</span>
              </div>
              <p className="mt-1 font-numeric tnum text-md font-bold" dir="ltr" style={{ color: v2.n900 }}>{k.v}</p>
            </div>
          ))}
        </div>
        <div className="rounded-md border p-2.5" style={{ background: v2.n0, borderColor: v2.n200 }}>
          <p className="mb-2 font-mono text-[8px] uppercase" style={{ color: v2.n400 }}>ACTIVITY</p>
          <ul className="space-y-1.5 text-[9px]">
            {['اعتماد ٤ نتائج', 'فحص طبي مكتمل', 'قرار هيئة جديد', 'تحرّ مغلق'].map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span style={{ color: v2.n700 }}>{a}</span>
                <span className="font-numeric tnum" style={{ color: v2.n400 }} dir="ltr">{i + 2}m</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function LoginAfter(): JSX.Element {
  return (
    <div className="grid h-full" style={{ gridTemplateColumns: '40% 60%' }}>
      {/* Photographic backdrop placeholder — 40% */}
      <div
        className="relative flex flex-col justify-end p-4 text-white"
        style={{
          background: `linear-gradient(180deg, ${v2.p700}30 0%, ${v2.p700}cc 100%), linear-gradient(135deg, ${v2.n700}, ${v2.p900})`,
        }}
      >
        <div className="absolute inset-0 opacity-10" aria-hidden style={{ background: 'repeating-linear-gradient(45deg, white 0 1px, transparent 1px 8px)' }} />
        <div className="relative">
          <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded" style={{ background: v2.p500 }}>
            <Layers size={12} aria-hidden />
          </div>
          <p className="font-ar-display text-xs font-bold">منظومة القبول</p>
          <p className="text-[9px] opacity-75">أكاديمية الشرطة</p>
        </div>
      </div>
      {/* Form — 60% */}
      <div className="flex flex-col justify-center px-6 py-5" style={{ background: v2.n0 }}>
        <p className="font-mono text-[9px] uppercase" style={{ color: v2.n400 }}>STAFF LOGIN</p>
        <p className="mt-1 font-ar-display text-md font-bold" style={{ color: v2.n900 }}>دخول الموظفين</p>
        <div className="mt-4 space-y-2">
          <div>
            <p className="text-[9px]" style={{ color: v2.n500 }}>الرقم القومي</p>
            <div className="mt-1 rounded px-2 py-1.5 text-[10px]" style={{ background: v2.n50, color: v2.n700 }} dir="ltr">14 رقماً</div>
          </div>
          <div>
            <p className="text-[9px]" style={{ color: v2.n500 }}>كلمة المرور</p>
            <div className="mt-1 rounded px-2 py-1.5 text-[10px]" style={{ background: v2.n50, color: v2.n400 }} dir="ltr">••••••••</div>
          </div>
          <button className="w-full rounded px-3 py-1.5 text-[10px] font-bold text-white" style={{ background: v2.p500 }}>
            متابعة عبر MOIPASS
          </button>
        </div>
      </div>
    </div>
  );
}

function CommitteeAfter(): JSX.Element {
  return (
    <div className="flex h-full" style={{ background: v2.n25 }}>
      {/* Sidebar with gold rail */}
      <div className="relative w-20 px-2 py-3" style={{ background: v2.n0, borderInlineEnd: `1px solid ${v2.n100}` }}>
        <span className="absolute inset-y-0 inset-inline-end-0 w-1" style={{ background: v2.g500 }} aria-hidden />
        <div className="mb-2 flex items-center gap-1.5">
          <Briefcase size={10} style={{ color: v2.g500 }} aria-hidden />
          <p className="text-[9px] font-bold" style={{ color: v2.n900 }}>اللجان</p>
        </div>
        <ul className="space-y-1 text-[8px]">
          <li className="rounded px-1.5 py-1" style={{ background: v2.g50, color: v2.g700 }}>القائمة</li>
          <li className="px-1.5 py-1" style={{ color: v2.n500 }}>الجدول</li>
          <li className="px-1.5 py-1" style={{ color: v2.n500 }}>المتقدمون</li>
        </ul>
      </div>
      {/* Body */}
      <div className="flex-1 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="font-mono text-[8px] uppercase" style={{ color: v2.n400 }}>COMMITTEE C-01</p>
            <p className="font-ar-display text-sm font-bold" style={{ color: v2.n900 }}>لجنة طلبة ١</p>
          </div>
        </div>
        {/* Dual-sig card with gold-50 background */}
        <div className="mb-2 rounded-md border p-2" style={{ background: v2.g50, borderColor: v2.g300 }}>
          <p className="text-[9px] font-bold" style={{ color: v2.g700 }}>سياسة الاعتماد المزدوج · KARASA §3.C</p>
          <p className="mt-0.5 text-[8px]" style={{ color: v2.n700 }}>النتيجة لا تُعتبر معتمدة إلا بتوقيع رئيس اللجنة.</p>
        </div>
        <div className="mb-2 grid grid-cols-3 gap-2">
          {[{ l: 'طابور', v: '42' }, { l: 'مراجعة الرئيس', v: '12' }, { l: 'معتمد', v: '408' }].map((k) => (
            <div key={k.l} className="rounded border p-1.5" style={{ background: v2.n0, borderColor: v2.n200 }}>
              <p className="font-mono text-[7px] uppercase" style={{ color: v2.n400 }}>{k.l}</p>
              <p className="mt-0.5 font-numeric tnum text-sm font-bold" dir="ltr" style={{ color: v2.n900 }}>{k.v}</p>
            </div>
          ))}
        </div>
        {/* The only gold thing on screen */}
        <button className="rounded px-3 py-1.5 text-[10px] font-bold text-white" style={{ background: v2.g500 }}>
          اعتماد ٢ نتائج
        </button>
      </div>
    </div>
  );
}

function InvestigationsAfter(): JSX.Element {
  return (
    <div className="flex h-full flex-col" style={{ background: v2.n25 }}>
      {/* CLASSIFIED strip */}
      <div className="flex items-center justify-between px-3 py-1 text-white" style={{ background: v2.t700 }}>
        <span className="font-mono text-[8px] tracking-widest" dir="ltr">CLASSIFIED · LEVEL 3</span>
        <span className="font-mono text-[8px]" dir="ltr">SESSION U-DEMO · 14:32</span>
      </div>
      <div className="flex flex-1">
        {/* Sidebar with terra rail */}
        <div className="relative w-20 px-2 py-3" style={{ background: v2.n0, borderInlineEnd: `1px solid ${v2.n100}` }}>
          <span className="absolute inset-y-0 inset-inline-end-0 w-1" style={{ background: v2.t500 }} aria-hidden />
          <div className="mb-2 flex items-center gap-1.5">
            <Eye size={10} style={{ color: v2.t500 }} aria-hidden />
            <p className="text-[9px] font-bold" style={{ color: v2.n900 }}>التحريات</p>
          </div>
          <ul className="space-y-1 text-[8px]">
            <li className="rounded px-1.5 py-1" style={{ background: v2.t50, color: v2.t700 }}>القضايا</li>
            <li className="px-1.5 py-1" style={{ color: v2.n500 }}>الوارد</li>
            <li className="px-1.5 py-1" style={{ color: v2.n500 }}>التوزيع</li>
          </ul>
        </div>
        {/* Body — neutral chrome */}
        <div className="flex-1 p-3">
          <div className="mb-2">
            <p className="font-mono text-[8px] uppercase" style={{ color: v2.n400 }}>CASE · CASE-00001</p>
            <p className="font-ar-display text-sm font-bold" style={{ color: v2.n900 }}>قضية حسن الخطيب</p>
          </div>
          {/* Identity card — neutral */}
          <div className="mb-2 grid grid-cols-2 gap-2 rounded-md border p-2" style={{ background: v2.n0, borderColor: v2.n200 }}>
            <div>
              <p className="font-mono text-[7px] uppercase" style={{ color: v2.n400 }}>NID</p>
              <p className="font-mono text-[10px] font-bold" dir="ltr" style={{ color: v2.n900 }}>30506••••••413</p>
            </div>
            <div>
              <p className="font-mono text-[7px] uppercase" style={{ color: v2.n400 }}>STATUS</p>
              <p className="text-[10px] font-bold" style={{ color: v2.t700 }}>قيد التحرّي</p>
            </div>
          </div>
          {/* Mini family tree row */}
          <div className="grid grid-cols-3 gap-1 text-center text-[7px]">
            {['الأب', 'الأم', 'المتقدم'].map((l, i) => (
              <div key={l} className="rounded border px-1 py-1" style={{ background: v2.n0, borderColor: i === 2 ? v2.t500 : v2.n200 }}>
                <p style={{ color: v2.n400 }}>{l}</p>
                <p className="mt-0.5" style={{ color: i === 2 ? v2.t500 : '#2E8755' }}>{i === 2 ? 'تحرّي' : 'نظيف'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ TOKENS PANEL ═══════════ */

function TokensPanel(): JSX.Element {
  const groups: { title: string; subtitle: string; swatches: { name: string; value: string; text?: string }[] }[] = [
    {
      title: 'NEUTRALS',
      subtitle: 'warm slate, lower chroma',
      swatches: [
        { name: 'n-0',   value: v2.n0,   text: v2.n900 },
        { name: 'n-25',  value: v2.n25,  text: v2.n900 },
        { name: 'n-100', value: v2.n100, text: v2.n900 },
        { name: 'n-200', value: v2.n200, text: v2.n900 },
        { name: 'n-500', value: v2.n500, text: v2.n0 },
        { name: 'n-700', value: v2.n700, text: v2.n0 },
        { name: 'n-900', value: v2.n900, text: v2.n0 },
      ],
    },
    {
      title: 'PRIMARY · TEAL',
      subtitle: 'demoted to brand + primary action only',
      swatches: [
        { name: 'p-50',  value: v2.p50,  text: v2.p700 },
        { name: 'p-100', value: v2.p100, text: v2.p700 },
        { name: 'p-500', value: v2.p500, text: v2.n0 },
        { name: 'p-700', value: v2.p700, text: v2.n0 },
      ],
    },
    {
      title: 'ACCENT · GOLD',
      subtitle: 'heritage only — not warning',
      swatches: [
        { name: 'g-50',  value: v2.g50,  text: v2.g700 },
        { name: 'g-300', value: v2.g300, text: v2.g700 },
        { name: 'g-500', value: v2.g500, text: v2.n0 },
        { name: 'g-700', value: v2.g700, text: v2.n0 },
      ],
    },
    {
      title: 'CRITICAL · TERRA',
      subtitle: 'restricted ops only',
      swatches: [
        { name: 't-50',  value: v2.t50,  text: v2.t700 },
        { name: 't-500', value: v2.t500, text: v2.n0 },
        { name: 't-700', value: v2.t700, text: v2.n0 },
      ],
    },
    {
      title: 'SEMANTIC',
      subtitle: 'separated from brand',
      swatches: [
        { name: 'success', value: '#2E8755', text: v2.n0 },
        { name: 'warning', value: v2.amber, text: v2.n0 },
        { name: 'danger',  value: '#C8362A', text: v2.n0 },
        { name: 'info',    value: v2.navy,  text: v2.n0 },
      ],
    },
  ];

  return (
    <section className="mt-10">
      <header className="mb-4 flex items-center gap-3">
        <FileText size={18} strokeWidth={1.75} style={{ color: v2.p500 }} aria-hidden />
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">رموز التصميم — Heritage Modern v2</h2>
          <p className="text-2xs text-ink-500">المرجع الكامل في DESIGN_REVAMP.md §2.1</p>
        </div>
      </header>

      <div className="rounded-lg border bg-surface-card p-5" style={{ borderColor: v2.n200 }}>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="font-mono text-2xs font-bold uppercase tracking-wider" style={{ color: v2.n900 }}>{g.title}</p>
              <p className="mt-0.5 text-2xs" style={{ color: v2.n500 }}>{g.subtitle}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {g.swatches.map((s) => (
                  <div
                    key={s.name}
                    className="flex h-12 w-16 flex-col justify-between rounded-md border p-1.5"
                    style={{ background: s.value, borderColor: v2.n200, color: s.text }}
                    title={s.value}
                  >
                    <span className="font-mono text-[9px] font-bold">{s.name}</span>
                    <span className="font-mono text-[8px] opacity-80" dir="ltr">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Typography ruler */}
        <div className="mt-6 grid gap-4 border-t pt-4 md:grid-cols-2" style={{ borderColor: v2.n100 }}>
          <div>
            <p className="font-mono text-2xs font-bold uppercase tracking-wider" style={{ color: v2.n900 }}>TYPOGRAPHY</p>
            <ul className="mt-2 space-y-1 text-xs" style={{ color: v2.n700 }}>
              <li><span className="font-mono text-2xs" style={{ color: v2.n400 }}>display</span> — Tajawal 700 (≥28px)</li>
              <li><span className="font-mono text-2xs" style={{ color: v2.n400 }}>body</span> — IBM Plex Sans Arabic 400/500</li>
              <li><span className="font-mono text-2xs" style={{ color: v2.n400 }}>numeric</span> — Inter Tight 500 tabular</li>
              <li><span className="font-mono text-2xs" style={{ color: v2.n400 }}>mono</span> — JetBrains Mono — IDs / routes / eyebrows</li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-2xs font-bold uppercase tracking-wider" style={{ color: v2.n900 }}>SPACING</p>
            <p className="mt-2 font-mono text-xs" dir="ltr" style={{ color: v2.n700 }}>
              4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 80 · 120
            </p>
            <p className="mt-1 text-2xs" style={{ color: v2.n500 }}>4-px base, denser middle. Card pad 20/24/32. Page gutters 24/32/48.</p>
          </div>
        </div>

        {/* Per-app rail legend */}
        <div className="mt-6 border-t pt-4" style={{ borderColor: v2.n100 }}>
          <p className="font-mono text-2xs font-bold uppercase tracking-wider" style={{ color: v2.n900 }}>PER-APP IDENTITY RAIL</p>
          <p className="mt-0.5 text-2xs" style={{ color: v2.n500 }}>4-pixel rail down the inside edge of the sidebar</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { app: 'Admin / Hub',          color: v2.p500,  icon: <Layers size={12} /> },
              { app: 'Applicant',            color: '#5FA0A0', icon: <Users size={12} /> },
              { app: 'Committees',           color: v2.g500,  icon: <Briefcase size={12} /> },
              { app: 'Medical',              color: v2.cyan,  icon: <Stethoscope size={12} /> },
              { app: 'Investigations',       color: v2.t500,  icon: <Eye size={12} /> },
              { app: 'Board',                color: v2.g700,  icon: <CheckCircle2 size={12} /> },
              { app: 'Question Bank',        color: '#5A4FCF', icon: <FileText size={12} /> },
              { app: 'Biometric',            color: v2.navy,  icon: <Activity size={12} /> },
              { app: 'Barcode',              color: v2.n700,  icon: <ClipboardCheck size={12} /> },
            ].map((r) => (
              <div key={r.app} className="flex items-center gap-2 rounded-md border p-2" style={{ borderColor: v2.n200, background: v2.n0 }}>
                <span className="h-6 w-1 rounded-sm" style={{ background: r.color }} aria-hidden />
                <span className="inline-flex h-6 w-6 items-center justify-center rounded" style={{ background: `${r.color}15`, color: r.color }}>{r.icon}</span>
                <span className="text-2xs font-medium" style={{ color: v2.n900 }}>{r.app}</span>
                <span className="ms-auto font-mono text-[9px]" dir="ltr" style={{ color: v2.n400 }}>{r.color}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
