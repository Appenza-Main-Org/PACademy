/**
 * HubPage — landing page after login.
 * Source: Tasks/DESIGN_SYSTEM.md §1, §3.1, §4.3 (feature card),
 *         Sprint 0 Part C, Tasks/KARASA_GAPS.md §10.1.
 *
 * 9 app cards (per-app accent border-top), KPI strip, time-of-day greeting.
 * Locked cards (RBAC-denied) render with the lock affordance and stay visible.
 */

import { Activity, ArrowLeft, BarChart3, Calendar, Check, ClipboardList, CreditCard, Eye, FileText, Globe, GraduationCap, Hourglass, Layers, Lock, Scale, Search, ServerCog, Stethoscope, UserCog, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ElementType } from 'react';
import { AppShell } from '@/app/layouts/AppShell';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import {
  Badge,
  KhayameyaStripe,
  Pattern,
  StatCard,
} from '@/shared/components';
import { IconBarcode } from '@/shared/components/icons';
import { useAuthStore } from '@/features/auth';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, num, shortName } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import type { AppKey } from '@/shared/lib/constants';

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

  return (
    <AppShell>
      <CenteredShell>
        {/* Hero */}
        <section
          className="relative mb-8 overflow-hidden rounded-2xl p-9 text-white"
          style={{
            background:
              'linear-gradient(135deg, var(--teal-700) 0%, var(--teal-500) 60%, var(--teal-600) 100%)',
          }}
        >
          <Pattern variant="tessellation-8" tile={96} opacity={0.08} color="var(--gold-300)" />
          <div className="absolute inset-x-0 top-0">
            <KhayameyaStripe height="md" />
          </div>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-3 py-1 text-2xs font-medium text-gold-300">
                <Calendar size={12} strokeWidth={1.75} />
                {fmtDate(Date.now())}
              </span>
              <span className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-3 py-1 text-2xs font-medium text-white/75">
                {hijri} هـ
              </span>
              <span className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-3 py-1 font-numeric tnum text-2xs font-medium text-white/75">
                دورة 2026
              </span>
            </div>
            <h1 className="mt-4 font-ar-display text-3xl font-bold leading-tight">
              {greeting}، {shortName(user.name, 4)}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">
              المنظومة الكاملة للتحول الرقمي بإجراءات القبول والاختبارات. تسعة تطبيقات مترابطة على
              مستوى الإنترنت والشبكة الداخلية تعمل بصورة موحدة.
            </p>
            <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-2xs text-white/75">
              <li className="inline-flex items-center gap-2">
                <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
                كل الخدمات نشطة
              </li>
              <li className="inline-flex items-center gap-2">
                <Layers size={12} strokeWidth={1.75} aria-hidden />
                <span>منصة التحقق الرقمي · مفعّلة</span>
              </li>
              <li className="inline-flex items-center gap-2">
                <UserCog size={12} strokeWidth={1.75} aria-hidden />
                <span>{user.roleLabel}</span>
              </li>
              <li className="inline-flex items-center gap-2">
                <Activity size={12} strokeWidth={1.75} aria-hidden />
                <span>اليوم: <span className="font-numeric tnum">{num(todayRegs)}</span> تسجيل جديد</span>
              </li>
            </ul>
          </div>
        </section>

        {/* KPI strip */}
        <section className="mb-9">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 font-ar-display text-xl font-bold text-ink-900">
              <BarChart3 size={20} strokeWidth={1.75} aria-hidden />
              لوحة المؤشرات
            </h2>
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

        {/* App grids */}
        {internet.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 font-ar-display text-xl font-bold text-ink-900">
                <Globe size={18} strokeWidth={1.75} aria-hidden />
                تطبيقات الإنترنت
              </h2>
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
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 font-ar-display text-xl font-bold text-ink-900">
                <ServerCog size={18} strokeWidth={1.75} aria-hidden />
                تطبيقات الشبكة الداخلية
              </h2>
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

        <footer className="mt-12 border-t border-border-subtle pt-6 text-center text-xs text-ink-500">
          <p>وزارة الداخلية · أكاديمية الشرطة · إدارة تكنولوجيا المعلومات</p>
          <p className="mt-1">
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
