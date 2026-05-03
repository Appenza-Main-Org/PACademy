/**
 * ArchitecturePage — the scope-comprehension showcase.
 * Source: ARCH-05 (4-layer karasa §9 architecture, expanded for demo).
 *
 * Sections:
 *  1. 4-layer architecture diagram (Public Portals · Middleware · Private Portals · Database)
 *  2. External integrations table (interactive — click for data flow)
 *  3. Hardware inventory (171 PCs, 130 biometric devices, 19 printers, …)
 *  4. RBAC matrix (11 roles × 9 apps)
 *  5. Tech stack with versions
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import {
  Building2,
  Check,
  Cloud,
  Code2,
  Cpu,
  Database,
  Fingerprint,
  Globe,
  HardDrive,
  Layers,
  Lock,
  Minus,
  Monitor,
  Network,
  Printer,
  Router,
  ScanLine,
  ServerCog,
  Shield,
} from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Drawer,
  KhayameyaStripe,
  PageHeader,
} from '@/shared/components';
import { num } from '@/shared/lib/format';
import { ROLE_DEFINITIONS, ROLES, type Role } from '@/features/auth';
import { APP_KEYS, type AppKey } from '@/shared/lib/constants';

/* ── 4-LAYER MODEL (KARASA §9) ────────────────────────────── */

interface Layer {
  id: 'public' | 'middleware' | 'private' | 'database';
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  blocks: { icon: React.ReactNode; title: string; meta: string }[];
}

const LAYERS: readonly Layer[] = [
  {
    id: 'public',
    title: 'البوابات العامة',
    subtitle: 'Public Portals — Internet',
    color: 'var(--teal-500)',
    bg: 'var(--teal-50)',
    blocks: [
      { icon: <Globe size={18} strokeWidth={1.75} />,    title: 'موقع المتقدمين',      meta: 'تطبيق 1.2 · NID + SMS' },
      { icon: <Building2 size={18} strokeWidth={1.75} />, title: 'بوابة موظفي المنظومة', meta: 'تطبيق 1.1 · MOIPASS' },
    ],
  },
  {
    id: 'middleware',
    title: 'الوسيط (Middleware)',
    subtitle: 'API Gateway · ESB · WAF',
    color: 'var(--gold-500)',
    bg: 'var(--gold-50)',
    blocks: [
      { icon: <Shield size={18} strokeWidth={1.75} />,    title: 'WAF + IDS',        meta: 'حماية الطبقة 7' },
      { icon: <Lock size={18} strokeWidth={1.75} />,      title: 'API Gateway',       meta: 'OAuth2 / JWT / mTLS' },
      { icon: <Network size={18} strokeWidth={1.75} />,   title: 'Enterprise Bus',    meta: 'ESB + Event Streaming' },
      { icon: <Cpu size={18} strokeWidth={1.75} />,       title: 'Identity Service',  meta: 'RBAC + 2FA + Audit' },
    ],
  },
  {
    id: 'private',
    title: 'البوابات الخاصة',
    subtitle: 'Private Portals — Intranet (LAN)',
    color: 'var(--terra-500)',
    bg: 'var(--terra-50)',
    blocks: [
      { icon: <Layers size={18} strokeWidth={1.75} />, title: 'لجان القبول',           meta: 'تطبيق 2.1' },
      { icon: <Layers size={18} strokeWidth={1.75} />, title: 'الهيئة وأمانة السر',    meta: 'تطبيق 2.2' },
      { icon: <Layers size={18} strokeWidth={1.75} />, title: 'إدارة التحريات',        meta: 'تطبيق 2.3 · سرّي' },
      { icon: <Layers size={18} strokeWidth={1.75} />, title: 'القومسيون الطبي',       meta: 'تطبيق 2.4' },
      { icon: <Layers size={18} strokeWidth={1.75} />, title: 'الباركود',              meta: 'تطبيق 2.5' },
      { icon: <Layers size={18} strokeWidth={1.75} />, title: 'البيومتري',             meta: 'تطبيق 2.6' },
      { icon: <Layers size={18} strokeWidth={1.75} />, title: 'بنك الأسئلة + الاختبارات', meta: 'تطبيق 2.7' },
    ],
  },
  {
    id: 'database',
    title: 'طبقة البيانات',
    subtitle: 'Database · Object Store · Cache',
    color: 'var(--ink-700)',
    bg: 'var(--ink-100)',
    blocks: [
      { icon: <Database size={18} strokeWidth={1.75} />,   title: 'PostgreSQL 16', meta: 'OLTP — البيانات الرئيسية' },
      { icon: <HardDrive size={18} strokeWidth={1.75} />,  title: 'MinIO',         meta: 'مستندات + صور' },
      { icon: <Database size={18} strokeWidth={1.75} />,   title: 'Elasticsearch', meta: 'بحث + متابعة' },
      { icon: <Database size={18} strokeWidth={1.75} />,   title: 'ClickHouse',    meta: 'تقارير وتحليلات' },
      { icon: <Database size={18} strokeWidth={1.75} />,   title: 'Redis 7',       meta: 'Cache + Sessions' },
    ],
  },
];

/* ── INTEGRATIONS (interactive) ───────────────────────────── */

interface Integration {
  id: string;
  system: string;
  endpoint: string;
  auth: string;
  purpose: string;
  status: 'متصل' | 'تحت التشغيل';
  flow: string[];
}

const INTEGRATIONS: readonly Integration[] = [
  {
    id: 'INT-MOIPASS',
    system: 'منصّة التحقق الرقمي MOIPASS',
    endpoint: 'POST /moipass/verify-officer',
    auth: 'mTLS + OAuth2',
    purpose: 'التحقق من هوية الضباط ودخولهم للمنظومة',
    status: 'متصل',
    flow: [
      'الضابط يدخل رقمه القومي + كلمة المرور في /staff-login.',
      'API Gateway يصادق الـ JWT ويستدعي MOIPASS عبر mTLS.',
      'MOIPASS يردّ بالرتبة والوحدة والاسم رباعي.',
      'يُنشأ session token + يُسجَّل الدخول في الـ Audit.',
    ],
  },
  {
    id: 'INT-NID',
    system: 'الإدارة العامة للأحوال المدنية',
    endpoint: 'POST /civil-records/verify-nid',
    auth: 'mTLS + API Key',
    purpose: 'التحقق من الرقم القومي للمتقدمين وأقاربهم',
    status: 'متصل',
    flow: [
      'المتقدم يُدخل رقمه القومي في Stage 1.',
      'الواجهة ترسل الطلب عبر API Gateway.',
      'خدمة التكامل تستدعي الأحوال المدنية، تستخرج: تاريخ الميلاد، النوع، محل الميلاد.',
      'البيانات المسترجعة تُحفظ في الـ draft، تُقفل الحقول المشتقّة.',
    ],
  },
  {
    id: 'INT-EDU',
    system: 'وزارة التربية والتعليم',
    endpoint: 'POST /education/verify-certificate',
    auth: 'API Key + IP whitelist',
    purpose: 'التحقق من بيانات الثانوية العامة',
    status: 'متصل',
    flow: [
      'المتقدم يُدخل رقم الجلوس في Stage 4.',
      'النظام يستعلم عن الشهادة ودرجاتها.',
      'في حال عدم التطابق: تُعرض رسالة + يُطلب سبب التجاوز.',
      'يُسجَّل سبب التجاوز في الـ Audit وتُعاد المراجعة.',
    ],
  },
  {
    id: 'INT-AZHAR',
    system: 'الأزهر الشريف',
    endpoint: 'POST /azhar/verify-certificate',
    auth: 'API Key',
    purpose: 'التحقق من بيانات الثانوية الأزهرية',
    status: 'متصل',
    flow: [
      'مماثل لتكامل التربية والتعليم لكن لشهادات الأزهر.',
      'يستخرج القسم (علمي/أدبي) إضافةً للدرجات.',
    ],
  },
  {
    id: 'INT-PAY',
    system: 'بوابة الدفع الإلكتروني الحكومية',
    endpoint: 'POST /e-pay/initiate · GET /e-pay/verify/:ref',
    auth: 'OAuth2 Client Credentials',
    purpose: 'سداد رسوم التقديم (فوري + بطاقة)',
    status: 'متصل',
    flow: [
      'المتقدم يختار طريقة الدفع في Stage 6.',
      'الطلب يُرسل لبوابة الدفع، تُرجع كود فوري أو URL للبطاقة.',
      'بعد السداد، البوابة تُرسل callback، يُحدَّث الـ draft.',
      'إيصال السداد يُولَّد ويُتاح للطباعة.',
    ],
  },
  {
    id: 'INT-SECURITY',
    system: 'قطاع الأمن العام',
    endpoint: 'POST /general-security/inquiry',
    auth: 'mTLS + Token',
    purpose: 'استعلامات التحريات الأمنية',
    status: 'تحت التشغيل',
    flow: [
      'المحقّق يفتح قضية في تطبيق التحريات.',
      'يُرسَل استعلام إلى قطاع الأمن العام، يُرفَق ملف الأسرة.',
      'القطاع يردّ خلال 2-7 أيام عمل بنتيجة + ملاحظات.',
      'النتيجة تُسجَّل في الـ Audit وتُعرض للهيئة.',
    ],
  },
];

/* ── HARDWARE INVENTORY (KARASA) ──────────────────────────── */

const HARDWARE: { icon: React.ReactNode; label: string; count: number; note?: string }[] = [
  { icon: <Monitor size={18} strokeWidth={1.75} />,     label: 'أجهزة كمبيوتر مكتبية',   count: 171, note: 'لجان القبول، القومسيون، الإدارة' },
  { icon: <Fingerprint size={18} strokeWidth={1.75} />, label: 'أجهزة بصمة وجه',          count: 130, note: 'بوابات + قاعات اختبار' },
  { icon: <Printer size={18} strokeWidth={1.75} />,     label: 'طابعات ليزر',             count: 19,  note: 'A4 + A6 لكروت التردد' },
  { icon: <ScanLine size={18} strokeWidth={1.75} />,    label: 'ماسحات ضوئية',           count: 5,   note: 'لرفع المستندات الورقية' },
  { icon: <Network size={18} strokeWidth={1.75} />,     label: 'Switches',                count: 9,   note: '24-port managed' },
  { icon: <Router size={18} strokeWidth={1.75} />,      label: 'خزائن (Racks)',           count: 6,   note: '42U' },
  { icon: <Globe size={18} strokeWidth={1.75} />,       label: 'نقاط شبكة',                count: 160, note: 'CAT6 منظَّمة' },
];

/* ── TECH STACK ───────────────────────────────────────────── */

const STACK = [
  { icon: <Code2 size={18} strokeWidth={1.75} />,     title: 'Frontend',    items: ['React 18.3', 'TypeScript 5.6', 'Vite 5.4', 'Tailwind 3.4', 'TanStack Query 5', 'Zustand 4.5', 'react-hook-form + zod'] },
  { icon: <ServerCog size={18} strokeWidth={1.75} />, title: 'Backend',     items: ['Node.js 22 / .NET 8', 'REST + GraphQL', 'BPMN Workflow', 'CQRS + Event Sourcing'] },
  { icon: <Database size={18} strokeWidth={1.75} />,  title: 'Data',        items: ['PostgreSQL 16', 'Elasticsearch 8', 'ClickHouse 24', 'Redis 7', 'MinIO Object Store'] },
  { icon: <Lock size={18} strokeWidth={1.75} />,      title: 'Security',    items: ['OAuth2 + JWT', 'mTLS داخلي', 'WAF + IDS', 'Encryption at-rest + in-transit', 'Audit Trail شامل'] },
  { icon: <Cloud size={18} strokeWidth={1.75} />,     title: 'DevOps',      items: ['Kubernetes 1.30', 'GitOps (ArgoCD)', 'Prometheus + Grafana', 'OpenTelemetry'] },
  { icon: <Globe size={18} strokeWidth={1.75} />,     title: 'Integration', items: ['ESB ESCo', 'منصّات حكومية', 'EAI Gateway', 'Kafka Event Streaming'] },
];

/* ── PAGE ─────────────────────────────────────────────────── */

export function ArchitecturePage(): JSX.Element {
  const [openInt, setOpenInt] = useState<Integration | null>(null);
  const totalHw = HARDWARE.reduce((s, h) => s + h.count, 0);

  return (
    <AppShell appLabel="معمارية النظام">
      <CenteredShell>
        <PageHeader
          title="معمارية المنظومة"
          subtitle="نموذج 4 طبقات بحسب الكرّاسة §9 — يربط 9 تطبيقات بـ 6 تكاملات حكومية على بنية تحتية مُؤمَّنة"
          actions={
            <div className="flex items-center gap-2">
              <Link
                to={ROUTES.designRevamp}
                className="inline-flex items-center gap-1.5 rounded-md border border-gold-300 bg-gold-50 px-3 py-1.5 text-2xs font-medium text-gold-700 hover:bg-gold-100"
                title="نظام التصميم — Heritage Modern v2"
              >
                نظام التصميم · v2
              </Link>
              <Badge tone="brand">دفعة 2026</Badge>
            </div>
          }
        />

        {/* SECTION 1 — 4-LAYER DIAGRAM */}
        <Card className="mb-6">
          <CardHeader title="الطبقات الأربع · 4-Layer Architecture" subtitle="من الأعلى للأسفل: ما يراه المستخدم → ما تراه قاعدة البيانات" />
          <CardBody>
            <div className="flex flex-col gap-3">
              {LAYERS.map((layer, idx) => (
                <div key={layer.id} className="relative">
                  <div
                    className="rounded-lg border-s-4 border border-border-subtle p-4 shadow-sm"
                    style={{ borderInlineStartColor: layer.color, background: layer.bg }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-ar-display text-md font-bold" style={{ color: layer.color }}>{layer.title}</h3>
                        <p className="text-2xs text-ink-500" dir="ltr">{layer.subtitle}</p>
                      </div>
                      <Badge tone="neutral">{layer.blocks.length} مكوّن</Badge>
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                      {layer.blocks.map((b) => (
                        <div key={b.title} className="flex items-start gap-2 rounded-md border border-border-subtle bg-surface-card p-2.5 transition-colors duration-fast ease-standard hover:border-ink-300">
                          <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md text-white" style={{ background: layer.color }}>
                            {b.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink-900">{b.title}</p>
                            <p className="truncate text-2xs text-ink-500">{b.meta}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {idx < LAYERS.length - 1 && (
                    <div aria-hidden className="flex justify-center" style={{ height: 14 }}>
                      <span className="block w-px" style={{ background: 'linear-gradient(to bottom, var(--border-subtle), var(--ink-300))' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-border-subtle bg-ink-50 p-3 text-2xs text-ink-700">
              <span className="font-medium">الحدود:</span>
              <Badge tone="info">طبقات 1+2 على الإنترنت — DMZ</Badge>
              <Badge tone="warning">طبقتا 3+4 على الشبكة الداخلية فقط</Badge>
              <Badge tone="danger">جميع الاتصالات الداخلية بـ mTLS</Badge>
            </div>
          </CardBody>
        </Card>

        {/* SECTION 2 — INTEGRATIONS */}
        <Card className="mb-6">
          <CardHeader title="التكاملات الخارجية" subtitle="6 تكاملات مع جهات حكومية · انقر لعرض تدفّق البيانات" actions={<Network size={16} strokeWidth={1.75} />} />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-2xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-3 py-2 text-start">المنظومة</th>
                    <th className="px-3 py-2 text-start">Endpoint</th>
                    <th className="px-3 py-2 text-start">المصادقة</th>
                    <th className="px-3 py-2 text-start">الغرض</th>
                    <th className="px-3 py-2 text-start">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {INTEGRATIONS.map((i) => (
                    <tr
                      key={i.id}
                      className="cursor-pointer border-b border-border-subtle transition-colors duration-fast ease-standard last:border-b-0 hover:bg-teal-50"
                      onClick={() => setOpenInt(i)}
                    >
                      <td className="px-3 py-3 font-medium">{i.system}</td>
                      <td className="px-3 py-3 font-mono text-2xs text-ink-700" dir="ltr">{i.endpoint}</td>
                      <td className="px-3 py-3 text-2xs text-ink-500">{i.auth}</td>
                      <td className="px-3 py-3 text-2xs text-ink-700">{i.purpose}</td>
                      <td className="px-3 py-3">
                        {i.status === 'متصل' ? <Badge tone="success" dot>{i.status}</Badge> : <Badge tone="warning" dot>{i.status}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        {/* SECTION 3 — HARDWARE INVENTORY */}
        <Card className="mb-6">
          <CardHeader
            title="جرد الأجهزة والبنية التحتية"
            subtitle={`إجمالي ${num(totalHw)} وحدة · بحسب جدول الكرّاسة`}
            actions={<HardDrive size={16} strokeWidth={1.75} />}
          />
          <CardBody>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {HARDWARE.map((h) => (
                <div key={h.label} className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-card p-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">{h.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-ink-900">{h.label}</p>
                      <p className="font-numeric tnum text-lg font-bold text-ink-900">{num(h.count)}</p>
                    </div>
                    {h.note && <p className="mt-0.5 text-2xs text-ink-500">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* SECTION 4 — RBAC MATRIX */}
        <Card className="mb-6">
          <CardHeader title="مصفوفة الصلاحيات (RBAC)" subtitle="11 دور وظيفي × 9 تطبيقات" actions={<Shield size={16} strokeWidth={1.75} />} />
          <CardBody>
            <RbacMatrix />
          </CardBody>
        </Card>

        {/* SECTION 5 — TECH STACK */}
        <h2 className="mt-8 mb-4 inline-flex items-center gap-2 font-ar-display text-xl font-bold text-ink-900">
          <Cpu size={18} strokeWidth={1.75} /> Stack المنظومة
        </h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {STACK.map((s) => (
            <Card key={s.title}>
              <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">{s.icon}</span>
              <p className="text-md font-bold text-ink-900">{s.title}</p>
              <ul className="mt-2 flex flex-col gap-1 text-2xs text-ink-700">
                {s.items.map((it) => <li key={it}>· {it}</li>)}
              </ul>
            </Card>
          ))}
        </div>

        {/* SOVEREIGNTY NOTE + STRIPE */}
        <Card className="mt-6 border-teal-300 bg-teal-50">
          <div className="flex items-start gap-3">
            <Building2 size={18} strokeWidth={1.75} className="mt-0.5 text-teal-700" />
            <div>
              <p className="font-medium text-teal-700">السيادة الرقمية</p>
              <p className="mt-1 text-2xs text-teal-700/85 leading-normal">
                كل البيانات تُستضاف داخل البنية التحتية الحكومية المعتمدة، مع تشفير at-rest +
                in-transit وaudit log لكل API call. لا تنتقل أيّ بيانات شخصيّة خارج حدود الجمهورية.
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-6"><KhayameyaStripe height="md" /></div>

        {/* INTEGRATION DRAWER */}
        <Drawer open={Boolean(openInt)} onClose={() => setOpenInt(null)} title={openInt?.system ?? ''} size="md">
          {openInt && (
            <Drawer.Body>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <Field label="Endpoint" mono>{openInt.endpoint}</Field>
                <Field label="المصادقة">{openInt.auth}</Field>
                <Field label="الحالة">{openInt.status === 'متصل' ? <Badge tone="success">{openInt.status}</Badge> : <Badge tone="warning">{openInt.status}</Badge>}</Field>
              </dl>
              <p className="mt-4 mb-2 text-sm font-medium text-ink-900">الغرض</p>
              <p className="rounded-md bg-ink-50 px-3 py-2 text-sm text-ink-700">{openInt.purpose}</p>
              <h3 className="mt-4 mb-2 text-sm font-medium text-ink-900">تدفّق البيانات</h3>
              <ol className="flex flex-col gap-2 text-sm">
                {openInt.flow.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-2">
                    <span aria-hidden className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-pill bg-teal-500 font-numeric tnum text-2xs font-bold text-white">{i + 1}</span>
                    <span className="text-ink-700">{step}</span>
                  </li>
                ))}
              </ol>
            </Drawer.Body>
          )}
        </Drawer>
      </CenteredShell>
    </AppShell>
  );
}

function Field({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-ink-50 px-3 py-2">
      <dt className="text-2xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className={mono ? 'mt-0.5 font-mono text-sm text-ink-900' : 'mt-0.5 text-sm text-ink-900'} {...(mono ? { dir: 'ltr' } : {})}>{children}</dd>
    </div>
  );
}

/* ── RBAC MATRIX ─────────────────────────────────────────── */

const APP_LABELS: Record<AppKey, string> = {
  admin: 'الإدارة',
  applicant: 'المتقدمين',
  committee: 'اللجان',
  board: 'الهيئة',
  investigations: 'التحريات',
  medical: 'القومسيون',
  barcode: 'الباركود',
  biometric: 'البيومتري',
  exams: 'الاختبارات',
  architecture: 'المعمارية',
};

function RbacMatrix(): JSX.Element {
  const apps = APP_KEYS.filter((a): a is Exclude<AppKey, 'architecture'> => a !== 'architecture');
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-ink-50 text-2xs uppercase tracking-wide text-ink-500">
              <th className="sticky inset-inline-start-0 bg-ink-50 px-3 py-2 text-start">الدور</th>
              {apps.map((a) => (
                <th key={a} className="px-2 py-2 text-center">{APP_LABELS[a]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role: Role, ri) => {
              const def = ROLE_DEFINITIONS[role];
              return (
                <tr key={role} className={'border-b border-border-subtle last:border-b-0 ' + (ri % 2 === 0 ? 'bg-surface-card' : 'bg-ink-50/40')}>
                  <td className="sticky inset-inline-start-0 bg-inherit px-3 py-2 text-2xs text-ink-900">
                    <span className="font-medium">{def.labelAr}</span>
                    <br />
                    <span className="text-ink-500 font-mono" dir="ltr">{role}</span>
                  </td>
                  {apps.map((a) => {
                    const has = def.apps.includes(a);
                    return (
                      <td key={a} className="text-center">
                        {has ? (
                          <span aria-label="مسموح" className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-teal-500 text-white">
                            <Check size={14} strokeWidth={2.5} aria-hidden />
                          </span>
                        ) : (
                          <span aria-label="غير مسموح" className="inline-flex h-6 w-6 items-center justify-center text-ink-300">
                            <Minus size={12} strokeWidth={1.75} aria-hidden />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-4 text-2xs text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-teal-500 text-white">
            <Check size={10} strokeWidth={2.5} aria-hidden />
          </span>
          مسموح
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center text-ink-300">
            <Minus size={10} strokeWidth={1.75} aria-hidden />
          </span>
          غير مسموح
        </span>
      </div>
    </div>
  );
}
