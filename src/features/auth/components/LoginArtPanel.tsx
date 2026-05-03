/**
 * LoginArtPanel — left-side branded panel.
 * Source: Tasks/DESIGN_SYSTEM.md §1 + Sprint 0 Part C.
 *
 * Calm, institutional, distinctly Egyptian: gold-foil-style header accent,
 * tessellation watermark behind the form (rendered by PublicShell), three
 * stat cards with Latin tabular figures, ministry attribution.
 */

import { KhayameyaStripe, LogoMark, Pattern } from '@/shared/components';

export function LoginArtPanel(): JSX.Element {
  return (
    <aside
      className="relative flex h-full flex-col justify-between overflow-hidden p-8 text-white lg:min-h-screen lg:p-12"
      style={{
        background:
          'linear-gradient(135deg, var(--teal-700) 0%, var(--teal-500) 60%, var(--teal-600) 100%)',
      }}
    >
      <Pattern variant="tessellation-8" tile={96} opacity={0.08} color="var(--gold-300)" />
      <div className="absolute inset-x-0 top-0">
        <KhayameyaStripe height="md" />
      </div>

      <header className="relative flex items-center gap-3">
        <LogoMark size={56} ariaLabel="شعار أكاديمية الشرطة" />
        <div className="leading-tight">
          <p className="font-ar-display text-md font-bold">منظومة القبول</p>
          <p className="text-2xs text-white/70">أكاديمية الشرطة</p>
        </div>
      </header>

      <div className="relative mt-6 lg:mt-0">
        <p className="mb-3 inline-flex items-center gap-2 rounded-pill bg-white/10 px-3 py-1 text-2xs font-medium text-gold-300">
          وزارة الداخلية · أكاديمية الشرطة
        </p>
        <h1 className="font-ar-display text-2xl font-bold leading-tight lg:text-3xl">
          التحول الرقمي الكامل لإجراءات القبول والاختبارات
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
          منظومة معلوماتية متكاملة تربط تسعة تطبيقات على مستوى الإنترنت والشبكة الداخلية،
          بمستوى أمان وتشفير معتمد، لإدارة كامل دورة المتقدم بدقة وشفافية.
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-4 lg:mt-7">
          <Stat value="9" label="تطبيقات مترابطة" />
          <Stat value="12K+" label="متقدم سنوياً" />
          <Stat value="100%" label="رقمنة الإجراءات" />
        </dl>
      </div>

      <footer className="relative mt-6 text-2xs text-white/55 lg:mt-0">
        © 2026 وزارة الداخلية · أكاديمية الشرطة · جميع الحقوق محفوظة
      </footer>
    </aside>
  );
}

function Stat({ value, label }: { value: string; label: string }): JSX.Element {
  return (
    <div>
      <dt
        className="font-numeric tnum text-2xl font-bold text-gold-300"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        <span dir="ltr">{value}</span>
      </dt>
      <dd className="mt-0.5 text-2xs text-white/65">{label}</dd>
    </div>
  );
}
