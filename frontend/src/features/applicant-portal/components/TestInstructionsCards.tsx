/**
 * TestInstructionsCards — per-test-kind instructions rendered as a
 * grid of cards, each with a coloured icon header and a clean
 * checklist. Replaces the prior plain stacked text that read as a
 * single corrupted block.
 */

import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { RequiredTestKind, TestSchedule } from '@/shared/types/domain';
import { TEST_KIND_ICON, TEST_KIND_LABEL_AR } from '../lib/category-test-labels';
import { TEST_INSTRUCTIONS } from '../lib/test-instructions';

interface TestInstructionsCardsProps {
  tests: readonly TestSchedule[];
}

const KIND_TONE: Partial<Record<RequiredTestKind, { ring: string; bg: string; iconBg: string; iconColor: string }>> = {
  aptitude: {
    ring: 'border-teal-200',
    bg: 'bg-surface-card',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-700',
  },
  posture: {
    ring: 'border-gold-200',
    bg: 'bg-surface-card',
    iconBg: 'bg-gold-50',
    iconColor: 'text-gold-700',
  },
  medical: {
    ring: 'border-teal-200',
    bg: 'bg-surface-card',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-700',
  },
  physical: {
    ring: 'border-terra-200',
    bg: 'bg-surface-card',
    iconBg: 'bg-terra-50',
    iconColor: 'text-terra-700',
  },
  psychological: {
    ring: 'border-teal-200',
    bg: 'bg-surface-card',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-700',
  },
  interview: {
    ring: 'border-gold-200',
    bg: 'bg-surface-card',
    iconBg: 'bg-gold-50',
    iconColor: 'text-gold-700',
  },
  drug: {
    ring: 'border-terra-200',
    bg: 'bg-surface-card',
    iconBg: 'bg-terra-50',
    iconColor: 'text-terra-700',
  },
};

const DEFAULT_TONE = {
  ring: 'border-border-subtle',
  bg: 'bg-surface-card',
  iconBg: 'bg-ink-100',
  iconColor: 'text-ink-700',
};

export function TestInstructionsCards({ tests }: TestInstructionsCardsProps): JSX.Element | null {
  const kinds = Array.from(new Set(tests.map((t) => t.kind)));
  if (kinds.length === 0) return null;

  return (
    <section>
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-ar-display text-md font-bold text-ink-900">إرشادات الاختبارات</h3>
          <p className="mt-0.5 text-2xs text-ink-500">
            تعليمات مهمة لكل نوع اختبار قبل الحضور
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kinds.map((kind) => {
          const tone = KIND_TONE[kind] ?? DEFAULT_TONE;
          const Icon = TEST_KIND_ICON[kind];
          const lines = TEST_INSTRUCTIONS[kind];
          return (
            <article
              key={kind}
              className={`flex flex-col rounded-lg border ${tone.ring} ${tone.bg} p-4 shadow-xs transition-shadow duration-fast ease-standard hover:shadow-sm`}
            >
              <header className="mb-3 flex items-center gap-3">
                <span
                  aria-hidden
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone.iconBg} ${tone.iconColor}`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h4 className="truncate font-ar-display text-sm font-bold text-ink-900">
                    {TEST_KIND_LABEL_AR[kind]}
                  </h4>
                  <p className="text-2xs text-ink-500">{lines.length} تعليمة قبل الحضور</p>
                </div>
              </header>
              <ul className="flex flex-col gap-2">
                {lines.map((line, i) => (
                  <Item key={i}>{line}</Item>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Item({ children }: { children: ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-2 text-sm text-ink-700">
      <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-teal-500" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
