/**
 * HubPage — landing page after login.
 * Source: Tasks/DESIGN_SYSTEM.md §1, §3.1, §4.3 (feature card),
 *         Sprint 0 Part C, Tasks/KARASA_GAPS.md §10.1.
 *
 * 9 app cards (per-app accent border-top), KPI strip, time-of-day greeting.
 * Locked cards (RBAC-denied) render with the lock affordance and stay visible.
 */

import { Activity, ArrowLeft, BarChart3, Calendar, Check, ClipboardList, CreditCard, Download, Eye, FilePlus2, FileText, Globe, GraduationCap, History, Hourglass, Lock, LogIn, Pencil, Scale, Search, ServerCog, Stethoscope, Trash2, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { AppShell } from '@/app/layouts/AppShell';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import {
  Badge,
  KhayameyaStripe,
  LogoMark,
  Pattern,
  StatCard,
} from '@/shared/components';
import { IconBarcode } from '@/shared/components/icons';
import { useAuthStore } from '@/features/auth';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, num, shortName } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import type { AppKey } from '@/shared/lib/constants';
import type { AuditAction, AuditColor } from '@/shared/types/domain';

const ACTION_ICON: Partial<Record<AuditAction, ElementType>> = {
  create: FilePlus2,
  update: Pencil,
  delete: Trash2,
  view: Search,
  login: LogIn,
  export: Download,
};

const ACTION_TONE: Record<AuditColor, { bg: string; fg: string; ring: string }> = {
  success: { bg: 'var(--success-bg)', fg: 'var(--success)',    ring: 'rgba(46, 125, 50, 0.16)' },
  warning: { bg: 'var(--gold-50)',    fg: 'var(--gold-700)',   ring: 'rgba(212, 164, 69, 0.20)' },
  danger:  { bg: 'var(--terra-50)',   fg: 'var(--terra-700)',  ring: 'rgba(200, 70, 44, 0.18)' },
  info:    { bg: 'var(--teal-50)',    fg: 'var(--teal-700)',   ring: 'rgba(26, 104, 104, 0.18)' },
  neutral: { bg: 'var(--ink-100)',    fg: 'var(--ink-700)',    ring: 'rgba(28, 25, 15, 0.12)' },
};

interface AppDef {
  key: AppKey;
  /* Element type — accepts both lucide icons (which carry their own propTypes)
   * and our custom Egyptian-context icons (which take width/height/color). */
  Icon: ElementType;
  num: string;
  title: string;
  desc: string;
  path: string;
  platform: 'إنترنت' | 'شبكة داخلية';
  stat: string;
}

const APPS: readonly AppDef[] = [
  { key: 'admin',          Icon: ServerCog,      num: '1.1', title: 'إدارة منظومة القبول',         desc: 'إعداد شروط التقدم وإدارة الأكواد المرجعية والإحصائيات الشاملة',         path: '/admin',          platform: 'إنترنت',     stat: '' },
  { key: 'applicant',      Icon: GraduationCap,  num: '1.2', title: 'موقع المتقدمين',                desc: 'تسجيل المتقدمين على الإنترنت ومتابعة كل مراحل التقدم والاختبارات',     path: '/applicant',      platform: 'إنترنت',     stat: 'دورة من 11 مرحلة' },
  { key: 'committee',      Icon: ClipboardList,  num: '2.1', title: 'لجان القبول',                   desc: 'تنظيم لجان قبول المتقدمين وإدارة بياناتهم وربط مراحل التقدم',          path: '/committee',      platform: 'شبكة داخلية', stat: '5 لجان نشطة' },
  { key: 'board',          Icon: Scale,          num: '2.2', title: 'الهيئة وأمانة السر',           desc: 'إدارة لجنة الهيئة وتنظيم البيانات والإجراءات المرتبطة بها',              path: '/board',          platform: 'شبكة داخلية', stat: 'هيئة عليا' },
  { key: 'investigations', Icon: Search,         num: '2.3', title: 'التحريات',                       desc: 'إجراءات صادر/وارد التحريات وإدراج ومتابعة نتائجها بالملف الإلكتروني',    path: '/investigations', platform: 'شبكة داخلية', stat: 'سرية تامة' },
  { key: 'medical',        Icon: Stethoscope,    num: '2.4', title: 'القومسيون الطبي',                desc: 'إدارة الاختبارات الطبية لقطاع الخدمات الطبية وإدراج النتائج',            path: '/medical',        platform: 'شبكة داخلية', stat: '8 عيادات' },
  { key: 'barcode',        Icon: IconBarcode,    num: '2.5', title: 'إنشاء وطباعة الباركود',           desc: 'إنشاء وإدارة وطباعة الباركود الخاص بالمتقدمين للاستعلام والتكامل',     path: '/barcode',        platform: 'شبكة داخلية', stat: 'كارت تردد' },
  { key: 'biometric',      Icon: Eye,            num: '2.6', title: 'تسجيل واستعلام بيومتري',       desc: 'البصمة الرقمية والتعرف على الوجه والتحقق من الهوية داخل اللجان',       path: '/biometric',      platform: 'شبكة داخلية', stat: 'تحقق فوري' },
  { key: 'exams',          Icon: FileText,       num: '2.7', title: 'بنك الأسئلة والاختبارات',        desc: 'إعداد بنك الأسئلة وتنفيذ الاختبارات الإلكترونية واستخراج التقارير',      path: '/question-bank',  platform: 'شبكة داخلية', stat: 'نظام MCQ' },
];

export function HubPage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  if (!user) return <></>;

  const accessible = APPS.map((a) => ({ ...a, locked: !user.apps.includes(a.key) }));
  const internet = accessible.filter((a) => a.platform === 'إنترنت');
  const internal = accessible.filter((a) => a.platform === 'شبكة داخلية');
  const k = MOCK.kpis;
  const paidPercent = Math.round((k.paidApplicants / Math.max(1, k.totalApplicants)) * 100);
  const todayRegs = MOCK.last14Days[MOCK.last14Days.length - 1]?.registrations ?? 0;
  const yesterdayRegs = MOCK.last14Days[MOCK.last14Days.length - 2]?.registrations ?? 0;
  const dayDelta = todayRegs - yesterdayRegs;
  const greeting = greetingForHour(new Date().getHours());
  const hijri = formatHijri(new Date());
  const recentEvents = MOCK.audit.slice(0, 3);

  return (
    <AppShell>
      <CenteredShell>
        {/* Hero — Heritage Ink + Gold-Foil */}
        <section
          className="relative mb-8 overflow-hidden rounded-2xl text-white"
          style={{
            background:
              'linear-gradient(135deg, var(--ink-900) 0%, var(--ink-800) 55%, var(--ink-700) 100%)',
            boxShadow:
              '0 1px 0 rgba(212, 164, 69, 0.18) inset, 0 24px 48px -28px rgba(14, 12, 7, 0.65)',
          }}
        >
          {/* Khayameya stripe at the top edge */}
          <div className="absolute inset-x-0 top-0 z-[1]">
            <KhayameyaStripe height="md" />
          </div>
          {/* Gold tessellation watermark */}
          <Pattern variant="tessellation-8" tile={104} opacity={0.07} color="var(--gold-400)" />
          {/* Soft gold radial glow at the start-top corner — depth */}
          <span
            aria-hidden
            className="pointer-events-none absolute -start-24 -top-24 h-[420px] w-[420px] rounded-full"
            style={{
              background:
                'radial-gradient(circle at center, rgba(212, 164, 69, 0.22) 0%, rgba(212, 164, 69, 0) 70%)',
            }}
          />
          {/* Gold-foil hairline at the bottom edge */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, var(--gold-500) 30%, var(--gold-300) 50%, var(--gold-500) 70%, transparent 100%)',
            }}
          />

          <div className="relative px-9 pb-9 pt-12">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-2 rounded-pill border px-3 py-1 text-2xs font-medium text-gold-300"
                style={{ borderColor: 'rgba(226, 188, 92, 0.30)', background: 'rgba(212, 164, 69, 0.08)' }}
              >
                <Calendar size={12} strokeWidth={1.75} />
                {fmtDate(Date.now())}
              </span>
              <span className="inline-flex items-center gap-2 rounded-pill bg-white/[0.06] px-3 py-1 text-2xs font-medium text-white/70">
                {hijri} هـ
              </span>
              <span className="inline-flex items-center gap-2 rounded-pill bg-white/[0.06] px-3 py-1 font-numeric tnum text-2xs font-medium text-white/70">
                دورة 2026
              </span>
            </div>
            <h1 className="mt-5 font-ar-display text-3xl font-bold leading-tight tracking-[-0.01em] text-white">
              {greeting}، <span className="text-gold-300">{shortName(user.name, 4)}</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
              المنظومة الكاملة للتحول الرقمي بإجراءات القبول والاختبارات. تسعة تطبيقات مترابطة على
              مستوى الإنترنت والشبكة الداخلية تعمل بصورة موحدة.
            </p>
            <dl className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-2xs text-white/70">
              <div className="inline-flex items-center gap-2">
                <span aria-hidden className="relative flex h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                  <span className="relative h-2 w-2 rounded-full bg-success" />
                </span>
                <dt className="sr-only">حالة المنظومة</dt>
                <dd className="text-white/85">كل الخدمات نشطة</dd>
              </div>
              <span aria-hidden className="hidden h-3 w-px bg-white/15 sm:inline-block" />
              <div className="inline-flex items-baseline gap-1.5">
                <dt className="text-white/50">الدور</dt>
                <dd className="font-medium text-white/85">{user.roleLabel}</dd>
              </div>
              <span aria-hidden className="hidden h-3 w-px bg-white/15 sm:inline-block" />
              <div className="inline-flex items-baseline gap-1.5">
                <dt className="text-white/50">تسجيل اليوم</dt>
                <dd className="font-numeric tnum font-medium text-white/85">{num(todayRegs)}</dd>
                <span className={cn('font-numeric tnum text-2xs', dayDelta >= 0 ? 'text-gold-300' : 'text-terra-300')} dir="ltr">
                  {dayDelta >= 0 ? `+${dayDelta}` : dayDelta}
                </span>
              </div>
              <span aria-hidden className="hidden h-3 w-px bg-white/15 sm:inline-block" />
              <div className="inline-flex items-baseline gap-1.5">
                <dt className="text-white/50">منصة التحقق</dt>
                <dd className="font-medium text-white/85">مفعّلة</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* KPI strip */}
        <section className="mb-10">
          <div className="mb-5 flex items-end justify-between">
            <SectionTitle icon={BarChart3}>لوحة المؤشرات</SectionTitle>
            <span className="text-xs text-ink-500">آخر تحديث: {fmtDate(Date.now(), 'rel')}</span>
          </div>
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
          >
            <StatCard
              label="إجمالي المتقدمين"
              value={k.totalApplicants}
              icon={<Users size={16} strokeWidth={1.75} />}
              trend={{ label: '+12% عن دورة 2025', tone: 'success' }}
            />
            <StatCard
              label="مدفوع الرسوم"
              value={k.paidApplicants}
              icon={<CreditCard size={16} strokeWidth={1.75} />}
              trend={{ label: `${paidPercent}% من الإجمالي`, tone: 'success' }}
            />
            <StatCard
              label="قيد المراجعة"
              value={k.underReview}
              icon={<Hourglass size={16} strokeWidth={1.75} />}
              iconBg="var(--gold-50)"
              iconColor="var(--gold-700)"
              trend={{ label: 'بفترة الفحص الطبي', tone: 'neutral' }}
            />
            <StatCard
              label="تم القبول"
              value={k.approved}
              icon={<Check size={16} strokeWidth={1.75} />}
              iconBg="var(--success-bg)"
              iconColor="var(--success)"
              trend={{ label: 'في انتظار قرار الهيئة', tone: 'neutral' }}
            />
            <StatCard
              label="مستبعد طبياً/أمنياً"
              value={k.rejected}
              icon={<X size={16} strokeWidth={1.75} />}
              iconBg="var(--terra-50)"
              iconColor="var(--terra-700)"
              trend={{ label: 'وفقاً لكرّاسة §6.2', tone: 'neutral' }}
            />
            <StatCard
              label="تسجيل اليوم"
              value={todayRegs}
              icon={<Activity size={16} strokeWidth={1.75} />}
              iconBg="var(--teal-50)"
              iconColor="var(--teal-700)"
              trend={{
                label: dayDelta >= 0 ? `+${dayDelta} مقارنة بالأمس` : `${dayDelta} مقارنة بالأمس`,
                tone: dayDelta >= 0 ? 'success' : 'danger',
              }}
            />
          </div>
        </section>

        {/* Recent activity feed */}
        {recentEvents.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-end justify-between">
              <div className="flex items-center gap-3">
                <SectionTitle icon={History} size="md">آخر الأحداث</SectionTitle>
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-ink-50 px-2 py-0.5 text-2xs text-ink-500">
                  <span aria-hidden className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-gold-500 opacity-60 motion-safe:animate-ping" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-gold-500" />
                  </span>
                  مباشر
                </span>
              </div>
              <Link
                to="/admin/audit"
                className="group/link inline-flex items-center gap-1 text-xs text-ink-500 transition-colors duration-fast ease-standard hover:text-[var(--teal-700)]"
              >
                <span>عرض السجل الكامل</span>
                <ArrowLeft
                  size={12}
                  strokeWidth={2}
                  className="transition-transform duration-fast ease-standard group-hover/link:-translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
            <ol className="overflow-hidden rounded-lg border border-border-subtle bg-surface-card shadow-[0_1px_0_rgba(28,25,15,0.02),0_8px_24px_-18px_rgba(28,25,15,0.18)]">
              {recentEvents.map((e, i) => {
                const Icon = ACTION_ICON[e.action] ?? History;
                const tone = ACTION_TONE[e.actionColor];
                return (
                  <li
                    key={e.id}
                    className={cn(
                      'group/row relative flex items-center gap-4 px-4 py-3 motion-safe:animate-page-enter',
                      'transition-colors duration-fast ease-standard hover:bg-ink-50/60',
                      i < recentEvents.length - 1 && 'border-b border-border-subtle',
                    )}
                    style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
                  >
                    {/* Inline-start accent edge — appears on hover */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-2 start-0 w-[2px] origin-center scale-y-0 rounded-pill transition-transform duration-base ease-standard group-hover/row:scale-y-100"
                      style={{ background: tone.fg }}
                    />
                    {/* Action icon — tinted square */}
                    <span
                      aria-hidden
                      className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-md ring-1 transition-transform duration-base ease-standard group-hover/row:scale-[1.04]"
                      style={{ background: tone.bg, color: tone.fg, '--tw-ring-color': tone.ring } as CSSProperties}
                    >
                      <Icon size={15} strokeWidth={1.75} />
                    </span>

                    {/* Primary line: action · entity · entity-id */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-ar-display text-sm font-bold text-ink-900">
                          {e.actionLabel}
                        </span>
                        <span className="text-xs text-ink-700">{e.entity}</span>
                        <span
                          dir="ltr"
                          className="rounded-sm bg-ink-50 px-1.5 py-0.5 font-mono text-2xs font-medium tracking-tight text-ink-700"
                        >
                          {e.entityId}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-2xs text-ink-500">
                        <span className="truncate">{shortName(e.userName, 3)}</span>
                        <span aria-hidden className="h-1 w-1 flex-none rounded-full bg-ink-300" />
                        <time dateTime={new Date(e.timestamp).toISOString()} className="font-numeric tnum">
                          {fmtDate(e.timestamp, 'rel')}
                        </time>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* App grids */}
        {internet.length > 0 && (
          <section className="mb-10">
            <div className="mb-5 flex items-end justify-between">
              <SectionTitle icon={Globe}>تطبيقات الإنترنت</SectionTitle>
              <Badge tone="info">{num(internet.length)} تطبيقات</Badge>
            </div>
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
            >
              {internet.map((app) => (
                <AppCard key={app.key} app={app} />
              ))}
            </div>
          </section>
        )}

        {internal.length > 0 && (
          <section className="mb-10">
            <div className="mb-5 flex items-end justify-between">
              <SectionTitle icon={ServerCog}>تطبيقات الشبكة الداخلية</SectionTitle>
              <Badge tone="brand">{num(internal.length)} تطبيقات</Badge>
            </div>
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
            >
              {internal.map((app) => (
                <AppCard key={app.key} app={app} />
              ))}
            </div>
          </section>
        )}

        <footer className="mt-12 pt-7 text-center text-xs text-ink-500">
          {/* Gold-foil hairline echoing the cover */}
          <span
            aria-hidden
            className="mx-auto mb-5 block h-px w-40"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, var(--gold-400) 50%, transparent 100%)',
            }}
          />
          <p className="inline-flex items-center justify-center gap-2 text-ink-700">
            <LogoMark size={16} />
            وزارة الداخلية · أكاديمية الشرطة · إدارة تكنولوجيا المعلومات
          </p>
          <p className="mt-1.5">
            تم الالتزام بكامل متطلبات السيادة الرقمية والأمن المعلوماتي · المنظومة آمنة ومُدققة
          </p>
        </footer>
      </CenteredShell>
    </AppShell>
  );
}

function AppCard({ app }: { app: AppDef & { locked: boolean } }): JSX.Element {
  const { Icon } = app;
  const className =
    'group relative flex h-full flex-col gap-3 overflow-hidden rounded-lg border border-border-subtle bg-surface-card p-6 ' +
    'transition-all duration-fast ease-standard';

  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 h-[3px] origin-inline-end transition-transform duration-base ease-standard',
          app.locked
            ? 'scale-x-100 opacity-40'
            : 'scale-x-0 group-hover:scale-x-100 group-focus-within:scale-x-100',
        )}
        style={{ background: 'var(--accent-500)' }}
      />
      <header className="flex items-start justify-between gap-3">
        <span
          className="inline-flex h-12 w-12 items-center justify-center rounded-md"
          style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
        >
          <Icon size={22} strokeWidth={1.75} />
        </span>
        <div className="flex items-center gap-2">
          {app.locked && (
            <Badge tone="danger" icon={<Lock size={10} strokeWidth={2.2} aria-hidden />}>
              محظور
            </Badge>
          )}
          <span
            className="rounded-pill bg-ink-100 px-2 py-0.5 text-2xs font-bold font-numeric tnum text-ink-500"
            dir="ltr"
          >
            {app.num}
          </span>
        </div>
      </header>
      <h3 className="font-ar-display text-md font-bold text-ink-900">{app.title}</h3>
      <p className="flex-1 text-sm text-ink-500 leading-normal">{app.desc}</p>
      <footer className="flex items-center justify-between border-t border-border-subtle pt-3 text-xs text-ink-500">
        <span>{app.stat}</span>
        <span
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-pill bg-ink-50 text-ink-700 transition-colors duration-fast ease-standard',
            !app.locked && 'group-hover:bg-[var(--accent-500)] group-hover:text-white',
          )}
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
        </span>
      </footer>
    </>
  );

  if (app.locked) {
    return (
      <div
        data-app={app.key}
        aria-disabled
        className={cn(className, 'cursor-not-allowed opacity-60')}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={app.path}
      data-app={app.key}
      className={cn(
        className,
        'cursor-pointer hover:-translate-y-1 hover:shadow-md focus-visible:shadow-focus-teal focus-visible:outline-none',
      )}
    >
      {inner}
    </Link>
  );
}

function SectionTitle({
  icon: Icon,
  size = 'lg',
  children,
}: {
  icon: ElementType;
  size?: 'md' | 'lg';
  children: ReactNode;
}): JSX.Element {
  const titleSize = size === 'md' ? 'text-md' : 'text-xl';
  const iconSize = size === 'md' ? 16 : 20;
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className={cn('inline-flex items-center gap-2 font-ar-display font-bold text-ink-900', titleSize)}>
        <Icon size={iconSize} strokeWidth={1.75} aria-hidden className="text-gold-600" />
        {children}
      </h2>
      <span
        aria-hidden
        className="block h-[2px] w-10 rounded-pill"
        style={{
          background:
            'linear-gradient(90deg, var(--gold-400) 0%, var(--gold-300) 60%, transparent 100%)',
        }}
      />
    </div>
  );
}

function greetingForHour(hour: number): string {
  if (hour < 5) return 'مساء الخير';
  if (hour < 12) return 'صباح الخير';
  if (hour < 17) return 'طاب نهارك';
  return 'مساء الخير';
}

function formatHijri(d: Date): string {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d).replace('هـ', '').trim();
  } catch {
    return '';
  }
}
