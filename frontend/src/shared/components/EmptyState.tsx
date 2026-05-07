/**
 * EmptyState — first-class no-data state.
 * Source: Tasks/DESIGN_SYSTEM.md §4.10.
 *
 * Layout: centered, padding 48px, max-width 400px, optional 120px illustration,
 * Arabic title (text-md medium ink-900), description (text-sm ink-500, max 2 lines),
 * single CTA.
 *
 * Variants — pre-canned illustrations + Arabic copy that the consumer can
 * extend by passing `title`/`description`/`action` to override.
 *
 * Usage:
 *   <EmptyState variant="no-results-search" />
 *   <EmptyState variant="no-applicants-yet" action={<Button>إضافة متقدم</Button>} />
 */

import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export type EmptyVariant =
  | 'no-results-search'
  | 'no-applicants-yet'
  | 'no-cases'
  | 'no-results-medical'
  | 'no-questions'
  | 'app-not-accessible'
  | 'generic';

interface EmptyStateProps {
  variant?: EmptyVariant;
  /** Custom title — overrides the variant default. */
  title?: string;
  /** Custom description — overrides the variant default. */
  description?: string;
  action?: ReactNode;
  /** Custom illustration — overrides the variant default. */
  icon?: ReactNode;
  className?: string;
}

const VARIANT_COPY: Record<EmptyVariant, { title: string; description: string }> = {
  'no-results-search': {
    title: 'لا توجد نتائج مطابقة',
    description: 'جرّب تعديل معايير البحث أو إزالة بعض المرشحات.',
  },
  'no-applicants-yet': {
    title: 'لم يُسجَّل متقدمون بعد',
    description: 'سيظهر هنا أول متقدم بمجرد فتح باب التقديم في هذه الدورة.',
  },
  'no-cases': {
    title: 'لا توجد قضايا حالياً',
    description: 'سيتم إخطارك فور إسناد قضية جديدة.',
  },
  'no-results-medical': {
    title: 'لم تُدخَل نتائج طبية بعد',
    description: 'تظهر النتائج هنا بعد فحص أول متقدم في هذه العيادة.',
  },
  'no-questions': {
    title: 'بنك الأسئلة فارغ',
    description: 'ابدأ بإضافة أول سؤال أو رفع ملف أسئلة جاهز.',
  },
  'app-not-accessible': {
    title: 'لا تملك صلاحية الوصول لهذا التطبيق',
    description: 'تواصَل مع مدير المنظومة إن كنت تظن أن هذا خطأ.',
  },
  generic: {
    title: 'لا توجد بيانات لعرضها',
    description: '',
  },
};

export function EmptyState({
  variant = 'generic',
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps): JSX.Element {
  const copy = VARIANT_COPY[variant];
  const finalTitle = title ?? copy.title;
  const finalDesc = description ?? copy.description;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'mx-auto max-w-[400px] px-6 py-9',
        className,
      )}
    >
      <div className="mb-5">{icon ?? <DefaultIllustration variant={variant} />}</div>
      <h3 className="mb-2 font-medium text-md text-ink-900">{finalTitle}</h3>
      {finalDesc && <p className="text-sm text-ink-500 leading-normal">{finalDesc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function DefaultIllustration({ variant }: { variant: EmptyVariant }): JSX.Element {
  /* Spec: 120px SVG, gold linework on cream bg, bespoke per context.
     We render small geometric vignettes that match each variant's mood —
     all use the same gold-500 stroke / cream fill so the family reads as one set. */
  const stroke = 'var(--gold-500)';
  const fill = 'var(--ink-50)';
  return (
    <svg width={120} height={120} viewBox="0 0 120 120" aria-hidden role="presentation">
      <circle cx={60} cy={60} r={54} fill={fill} stroke={stroke} strokeWidth={1} />
      {variant === 'no-results-search' && (
        <g fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round">
          <circle cx={52} cy={52} r={18} />
          <line x1={66} y1={66} x2={80} y2={80} />
        </g>
      )}
      {variant === 'no-applicants-yet' && (
        <g fill="none" stroke={stroke} strokeWidth={1.5}>
          <circle cx={60} cy={48} r={12} />
          <path d="M38 84c0-12 9.85-20 22-20s22 8 22 20" />
        </g>
      )}
      {variant === 'no-cases' && (
        <g fill="none" stroke={stroke} strokeWidth={1.5}>
          <rect x={38} y={42} width={44} height={40} rx={3} />
          <path d="M38 54h44 M52 42v-6h16v6" />
        </g>
      )}
      {variant === 'no-results-medical' && (
        <g fill="none" stroke={stroke} strokeWidth={1.5}>
          <rect x={42} y={42} width={36} height={36} rx={4} />
          <path d="M60 50v20 M50 60h20" />
        </g>
      )}
      {variant === 'no-questions' && (
        <g fill="none" stroke={stroke} strokeWidth={1.5}>
          <circle cx={60} cy={56} r={16} />
          <path d="M54 52a6 6 0 1 1 8 6v4 M60 70v.5" strokeLinecap="round" />
        </g>
      )}
      {variant === 'app-not-accessible' && (
        <g fill="none" stroke={stroke} strokeWidth={1.5}>
          <rect x={46} y={56} width={28} height={22} rx={2} />
          <path d="M52 56v-6a8 8 0 0 1 16 0v6" />
        </g>
      )}
      {variant === 'generic' && (
        <g fill="none" stroke={stroke} strokeWidth={1.5}>
          <path d="M40 70h40 M44 60h32 M48 50h24" strokeLinecap="round" />
        </g>
      )}
      {/* Heritage corner marks */}
      <g stroke={stroke} strokeWidth={0.5} fill="none">
        <path d="M14 14h6 M14 14v6" />
        <path d="M106 14h-6 M106 14v6" />
        <path d="M14 106h6 M14 106v-6" />
        <path d="M106 106h-6 M106 106v-6" />
      </g>
    </svg>
  );
}
