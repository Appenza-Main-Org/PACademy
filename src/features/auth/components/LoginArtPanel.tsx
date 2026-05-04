/**
 * LoginArtPanel — left-side branded panel.
 * Source: Tasks/DESIGN_SYSTEM.md §1 + Sprint 0 Part C.
 *
 * Calm, institutional, distinctly Egyptian: gold-foil-style header accent,
 * tessellation watermark behind the form (rendered by PublicShell), three
 * stat cards with Latin tabular figures, ministry attribution.
 */

import { KhayameyaStripe, LogoMark, Pattern } from '@/shared/components';
import { IconSeal } from '@/shared/components/icons';

export function LoginArtPanel(): JSX.Element {
  return (
    <aside
      className="relative flex h-full flex-col justify-between overflow-hidden p-8 text-white lg:min-h-screen lg:p-12"
      style={{
        background:
          'linear-gradient(135deg, var(--ink-900) 0%, var(--ink-800) 55%, var(--ink-700) 100%)',
        boxShadow: '0 1px 0 rgba(212, 164, 69, 0.18) inset',
      }}
    >
      {/* Khayameya stripe at the top edge */}
      <div className="absolute inset-x-0 top-0 z-[1]">
        <KhayameyaStripe height="md" />
      </div>
      {/* Gold tessellation watermark — kept faint */}
      <Pattern variant="tessellation-8" tile={108} opacity={0.045} color="var(--gold-400)" />
      {/* Soft gold radial glow at the start-top corner */}
      <span
        aria-hidden
        className="pointer-events-none absolute -start-40 -top-40 h-[420px] w-[420px] rounded-full"
        style={{
          background:
            'radial-gradient(circle at center, rgba(212, 164, 69, 0.13) 0%, rgba(212, 164, 69, 0) 70%)',
        }}
      />
      {/* Subtle inside vignette so content area reads brighter than the edges */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 30% 50%, rgba(0, 0, 0, 0.22) 0%, rgba(0, 0, 0, 0) 100%)',
        }}
      />
      {/* Gold-foil hairline along the inside edge meeting the form */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 inset-inline-end-0 hidden w-px lg:block"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, var(--gold-500) 25%, var(--gold-300) 50%, var(--gold-500) 75%, transparent 100%)',
        }}
      />

      <header className="relative flex items-center gap-3">
        <LogoMark size={56} ariaLabel="شعار أكاديمية الشرطة" />
        <div className="leading-tight">
          <p className="inline-flex items-center gap-1.5 font-ar-display text-md font-bold">
            منظومة القبول
            <IconSeal width={12} height={12} className="text-gold-400/80" aria-hidden />
          </p>
          <p className="text-2xs text-white/65">أكاديمية الشرطة</p>
        </div>
      </header>

      <div className="relative mt-6 lg:mt-0">
        <h1 className="font-ar-display text-2xl font-bold leading-tight tracking-[-0.01em] lg:text-3xl">
          التحول الرقمي الكامل لإجراءات{' '}
          <span className="text-gold-300">القبول والاختبارات</span>
        </h1>
        <dl className="mt-8 grid grid-cols-3 gap-4 lg:mt-10">
          <Stat value="9" label="تطبيقات" />
          <Stat value="12K+" label="متقدم سنوياً" />
          <Stat value="100%" label="رقمنة الإجراءات" />
        </dl>
      </div>

      <footer className="relative mt-6 inline-flex items-center gap-2 text-2xs text-white/55 lg:mt-0">
        <IconSeal width={12} height={12} className="text-gold-400/70" aria-hidden />
        <span>© 2026 · أكاديمية الشرطة</span>
      </footer>
    </aside>
  );
}

function Stat({ value, label }: { value: string; label: string }): JSX.Element {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <dt
        dir="ltr"
        className="font-numeric tnum text-2xl font-bold leading-none text-gold-300"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {value}
      </dt>
      <dd className="text-2xs leading-tight text-white/60">{label}</dd>
    </div>
  );
}
