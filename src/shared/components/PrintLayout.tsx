/**
 * PrintLayout — wraps content for printing.
 * Source: Tasks/DESIGN_SYSTEM.md §4.16 + §6.4.
 *
 * Renders: ministry crest + academy name + report title + date + (optional)
 * "سرّي للغاية" stamp; footer with page-number/timestamp/report-id; Khayameya
 * stripe at bottom.
 *
 * Trigger printing from the consumer with `useReactToPrint()` (sprint 1+).
 *
 * Usage:
 *   <PrintLayout title="تقرير المتقدمين" reportId="RPT-2026-001" restricted>
 *     <ContentSections />
 *   </PrintLayout>
 */

import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { CornerFlourish } from './CornerFlourish';
import { KhayameyaStripe } from './KhayameyaStripe';

interface PrintLayoutProps {
  title: string;
  subtitle?: string;
  reportId?: string;
  /** Hijri + Gregorian date string. Caller formats. */
  generatedAt?: string;
  /** Add the "سرّي للغاية" watermark and red header rule. */
  restricted?: boolean;
  /** A4 orientation. Defaults to 'portrait'. */
  orientation?: 'portrait' | 'landscape';
  /** Optional crest / seal element rendered at top-start corner. */
  crest?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PrintLayout({
  title,
  subtitle,
  reportId,
  generatedAt,
  restricted,
  orientation = 'portrait',
  crest,
  children,
  className,
}: PrintLayoutProps): JSX.Element {
  return (
    <article
      data-print-orientation={orientation}
      className={cn(
        'relative bg-white text-ink-900',
        restricted && 'print-stamp-restricted',
        className,
      )}
      style={{
        // On-screen preview gets approximate A4 sizing; @media print honours @page.
        width: '210mm',
        minHeight: orientation === 'portrait' ? '297mm' : '210mm',
        padding: '16mm 14mm',
        fontFamily: 'var(--font-ar)',
        margin: '0 auto',
      }}
    >
      {/* Heritage corners */}
      <CornerFlourish corner="tl" color="var(--gold-500)" opacity={1} size={20} />
      <CornerFlourish corner="tr" color="var(--gold-500)" opacity={1} size={20} />

      {/* Ministry header band */}
      <header
        className={cn(
          'mb-6 flex items-start justify-between gap-6 border-b pb-5',
          restricted ? 'border-terra-500' : 'border-ink-700',
        )}
      >
        <div className="flex items-start gap-4">
          {crest ?? <DefaultCrest />}
          <div>
            <h1 className="font-ar-display text-xl font-bold leading-tight">
              وزارة الداخلية · أكاديمية الشرطة
            </h1>
            <p className="mt-1 text-sm text-ink-500">منظومة القبول الإلكتروني</p>
          </div>
        </div>
        <div className="text-end text-xs text-ink-500">
          {reportId && (
            <p className="font-numeric tnum">
              رقم الوثيقة: <span dir="ltr">{reportId}</span>
            </p>
          )}
          {generatedAt && (
            <p>
              تاريخ الإصدار: <span dir="ltr">{generatedAt}</span>
            </p>
          )}
          {restricted && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-sm border border-terra-500 px-2 py-1 text-2xs font-bold text-terra-700">
              سرّي للغاية
            </p>
          )}
        </div>
      </header>

      {/* Title block */}
      <section className="mb-6">
        <h2 className="font-ar-display text-2xl font-bold leading-snug">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </section>

      {/* Body */}
      <main className="leading-normal text-sm text-ink-900">{children}</main>

      {/* Bottom Khayameya stripe (12mm of breathing room above) */}
      <footer className="mt-9">
        <KhayameyaStripe height="lg" />
        <div className="mt-3 flex items-center justify-between text-2xs text-ink-500">
          <span>هذه الوثيقة مُولَّدة إلكترونياً من منظومة قبول أكاديمية الشرطة.</span>
          {reportId && (
            <span className="font-numeric tnum" dir="ltr">
              {reportId}
            </span>
          )}
        </div>
      </footer>
    </article>
  );
}

function DefaultCrest(): JSX.Element {
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" aria-hidden role="presentation">
      <circle cx={24} cy={24} r={22} fill="none" stroke="var(--ink-700)" strokeWidth={1.25} />
      <path
        d="M24 8 L34 14 V24 C34 30 30 34 24 38 C18 34 14 30 14 24 V14 Z"
        fill="var(--gold-100)"
        stroke="var(--gold-500)"
        strokeWidth={1}
      />
      <path d="M20 22 L24 26 L30 18" fill="none" stroke="var(--ink-700)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
