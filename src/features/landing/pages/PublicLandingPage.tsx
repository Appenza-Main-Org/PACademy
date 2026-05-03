/**
 * PublicLandingPage — the unauthenticated home of the platform.
 * Source: ARCH-01 (public/private split per karasa §9 4-layer architecture).
 *
 * What an Internet visitor sees first. Two CTAs split the public surface
 * cleanly between المتقدم and الموظف paths:
 *   - "تقديم جديد للالتحاق" → /apply (Stage 1 NID + phone)
 *   - "دخول الموظفين" → /staff-login (MOIPASS-styled auth)
 *
 * The hero uses the heritage motif set (Khayameya stripe + tessellation
 * watermark) and the Tajawal display family for the headline. Cycle 2026
 * is announced with a gold "التقديم متاح الآن" badge.
 */

import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Layers,
  ScrollText,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { PublicShell } from '@/app/layouts/PublicShell';
import {
  Badge,
  CornerFlourish,
  KhayameyaStripe,
  LogoMark,
  Pattern,
} from '@/shared/components';
import { IconSeal } from '@/shared/components/icons';
import { ROUTES } from '@/config/routes';

const APPLICATION_OPEN = '15 يناير 2026';
const APPLICATION_CLOSE = '31 مارس 2026';

const HIGHLIGHTS = [
  { icon: CheckCircle2, label: 'تسجيل إلكتروني كامل' },
  { icon: ShieldCheck,  label: 'هويّة موثّقة بالرقم القومي' },
  { icon: ScrollText,   label: 'متابعة لحظية لكل المراحل' },
  { icon: Layers,       label: 'تكامل مع الجهات الحكومية' },
];

export function PublicLandingPage(): JSX.Element {
  return (
    <PublicShell>
      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border-subtle">
        <Pattern variant="tessellation-8" tile={96} opacity={0.06} color="var(--gold-500)" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at top, var(--teal-50) 0%, transparent 70%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-content flex-col items-center gap-6 px-6 py-16 text-center">
          <LogoMark size={96} ariaLabel="شعار أكاديمية الشرطة" className="drop-shadow-md" />

          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-pill bg-gold-50 px-4 py-1.5 text-2xs font-bold uppercase tracking-wide text-gold-700">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold-500" />
              التقديم متاح الآن · دفعة 2026
            </p>
            <h1 className="font-ar-display text-4xl font-bold leading-[1.15] text-ink-900 md:text-5xl">
              منظومة القبول الإلكتروني
              <br />
              <span style={{ color: 'var(--teal-700)' }}>أكاديمية الشرطة</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-md leading-relaxed text-ink-700">
              منصّة موحّدة لاستقبال طلبات الالتحاق بأكاديمية الشرطة، وإدارة كافّة مراحل القبول
              من التسجيل وحتى صدور القرار النهائي للهيئة. خدمة رسمية مقدّمة من
              وزارة الداخلية.
            </p>
          </div>

          <dl className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-2xs text-ink-700">
            <div className="inline-flex items-baseline gap-1.5">
              <CalendarDays size={12} strokeWidth={1.75} className="text-ink-500" aria-hidden />
              <dt className="text-ink-500">فتح الباب</dt>
              <dd className="font-numeric tnum font-medium text-ink-900" dir="rtl">{APPLICATION_OPEN}</dd>
            </div>
            <span aria-hidden className="hidden h-3 w-px bg-border-subtle sm:inline-block" />
            <div className="inline-flex items-baseline gap-1.5">
              <CalendarDays size={12} strokeWidth={1.75} className="text-ink-500" aria-hidden />
              <dt className="text-ink-500">إغلاق الباب</dt>
              <dd className="font-numeric tnum font-medium text-ink-900" dir="rtl">{APPLICATION_CLOSE}</dd>
            </div>
            <span aria-hidden className="hidden h-3 w-px bg-border-subtle sm:inline-block" />
            <Badge tone="success" dot>المتقدّمون حتى الآن: <span className="font-numeric tnum">2,847</span></Badge>
          </dl>
        </div>
      </section>

      {/* ── DUAL CTA ───────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-content px-6 pb-12 pt-9">
        <h2 className="mb-6 text-center font-ar-display text-xl font-bold text-ink-900">
          ابدأ من هنا
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <CtaCard
            to={ROUTES.apply}
            icon={<GraduationCap size={26} strokeWidth={1.75} />}
            badge="للمتقدّمين"
            title="تقديم جديد للالتحاق"
            description="ابدأ ملفّك الإلكتروني خلال خطوات معدودة. سيتم التحقق من رقمك القومي ورقم هاتفك ثم استكمال البيانات والمستندات."
            cta="ابدأ التقديم"
            accent="var(--teal-500)"
            note="يلزم: رقم قومي ساري + رقم هاتف محمول"
          />
          <CtaCard
            to={ROUTES.staffLogin}
            icon={<UserCog size={26} strokeWidth={1.75} />}
            badge="للموظّفين"
            title="دخول الضباط والموظفين"
            description="تسجيل دخول آمن عبر منصّة التحقق الرقمي للحكومة المصرية (MOIPASS) للوصول إلى تطبيقات اللجان والقومسيون والتحريات والهيئة."
            cta="تسجيل الدخول"
            accent="var(--gold-500)"
            note="يلزم: حساب مفعّل على MOIPASS"
          />
        </div>
      </section>

      {/* ── SYSTEM HIGHLIGHTS ─────────────────────────────────── */}
      <section className="relative mx-auto max-w-content px-6 pb-16">
        <h2 className="mb-5 text-center font-ar-display text-xl font-bold text-ink-900">
          ميزات المنظومة
        </h2>
        <ul className="grid gap-4 md:grid-cols-4">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface-card p-5 text-center"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <p className="text-sm font-medium text-ink-900">{label}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── BOTTOM ATTRIBUTION BAR ─────────────────────────────── */}
      <section className="relative border-t border-border-subtle bg-ink-50/50 py-6">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-4 px-6 text-2xs text-ink-500">
          <div className="flex items-center gap-3">
            <span aria-hidden className="text-gold-600">
              <IconSeal width={28} height={28} />
            </span>
            <p>
              هذه خدمة رسمية تُدار بواسطة وزارة الداخلية المصرية. جميع البيانات
              مُشفّرة ومحميّة بمستوى السيادة الرقمية الحكومية.
            </p>
          </div>
          <div className="inline-flex items-center gap-2">
            <KhayameyaStripe height="sm" className="w-32" />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

interface CtaCardProps {
  to: string;
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: string;
  cta: string;
  accent: string;
  note: string;
}

function CtaCard({ to, icon, badge, title, description, cta, accent, note }: CtaCardProps): JSX.Element {
  return (
    <Link
      to={to}
      className="group relative block overflow-hidden rounded-2xl border-2 border-border-subtle bg-surface-card p-7 shadow-xs transition-all duration-base ease-standard hover:-translate-y-1 hover:shadow-md focus-visible:shadow-focus-teal focus-visible:outline-none"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      {/* heritage corner ornaments */}
      <CornerFlourish corner="tl" color={accent} opacity={0.4} size={20} />
      <CornerFlourish corner="tr" color={accent} opacity={0.4} size={20} />
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: accent }}
      />

      <header className="mb-4 flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="inline-flex h-12 w-12 items-center justify-center rounded-md text-white shadow-sm"
          style={{ background: accent }}
        >
          {icon}
        </span>
        <span
          className="inline-flex items-center rounded-pill px-3 py-1 text-2xs font-medium"
          style={{ background: 'var(--ink-50)', color: 'var(--ink-700)' }}
        >
          {badge}
        </span>
      </header>

      <h3 className="font-ar-display text-xl font-bold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">{description}</p>

      <p className="mt-4 text-2xs text-ink-500">{note}</p>

      <div className="mt-5 flex items-center justify-between border-t border-border-subtle pt-4">
        <span className="text-sm font-medium text-ink-900">{cta}</span>
        <span
          aria-hidden
          className="inline-flex h-9 w-9 items-center justify-center rounded-pill text-white transition-transform duration-fast ease-standard group-hover:-translate-x-1"
          style={{ background: accent }}
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
        </span>
      </div>
    </Link>
  );
}
