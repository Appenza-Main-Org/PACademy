/**
 * StepHeader — title + "الخطوة N من ١٤" badge + cycle indicator.
 * Sits below the breadcrumb and above the step content area inside
 * <AdmissionSetupShell>. Reads its step from the route, never from props,
 * so adding a new step is config-only.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Badge, Button, Combobox } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import type { AdmissionCycle } from '@/shared/types/domain';
import {
  ADMISSION_SETUP_TOTAL_STEPS,
  type AdmissionSetupStep,
} from '../config';

interface StepHeaderProps {
  step: AdmissionSetupStep;
  cycle: AdmissionCycle | null;
  availableCycles: AdmissionCycle[];
  onSelectCycle: (id: string) => void;
  /** Optional right-aligned action slot (e.g. "حفظ" button on composed steps). */
  actions?: ReactNode;
  /** Set true when the consumer is allowed to switch cycles (super_admin). */
  canSwitchCycle: boolean;
}

export function StepHeader({
  step,
  cycle,
  availableCycles,
  onSelectCycle,
  actions,
  canSwitchCycle,
}: StepHeaderProps): JSX.Element {
  const StepIcon = step.icon;
  const stepNumber = toEasternArabicNumerals(step.order);
  const totalSteps = toEasternArabicNumerals(ADMISSION_SETUP_TOTAL_STEPS);

  return (
    <header className="mb-6 flex flex-col gap-3 border-b border-border-subtle pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex h-10 w-10 items-center justify-center rounded-md"
            style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
          >
            <StepIcon size={20} strokeWidth={1.75} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-ar-display text-2xl font-bold text-ink-900">{step.labelAr}</h1>
              <Badge tone="info">
                <span className="font-numeric tnum">
                  الخطوة {stepNumber} من {totalSteps}
                </span>
              </Badge>
            </div>
            <p className="mt-0.5 text-2xs text-ink-500">{step.subtitleAr}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actions}
          <Link to={ROUTES.admin.admissionSetup.index} className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<ArrowRight size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
            >
              لوحة الإعدادات
            </Button>
          </Link>
        </div>
      </div>

      <CycleIndicator
        cycle={cycle}
        availableCycles={availableCycles}
        onSelectCycle={onSelectCycle}
        canSwitchCycle={canSwitchCycle}
      />
    </header>
  );
}

function CycleIndicator({
  cycle,
  availableCycles,
  onSelectCycle,
  canSwitchCycle,
}: {
  cycle: AdmissionCycle | null;
  availableCycles: AdmissionCycle[];
  onSelectCycle: (id: string) => void;
  canSwitchCycle: boolean;
}): JSX.Element {
  if (!cycle) {
    return (
      <p className="text-2xs text-gold-700">
        لم يتم اختيار دورة قبول. اختر دورة من لوحة الإعدادات أو أنشئ دورة جديدة.
      </p>
    );
  }
  if (!canSwitchCycle || availableCycles.length <= 1) {
    return (
      <p className="text-2xs text-ink-500">
        دورة الإعداد:{' '}
        <span className="font-medium text-ink-700">{cycle.nameAr}</span>
      </p>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xs text-ink-500">دورة الإعداد:</span>
      <div className="min-w-[260px]">
        <Combobox
          value={cycle.id}
          onChange={(next) => {
            if (next) onSelectCycle(next);
          }}
          options={availableCycles.map((c) => ({ value: c.id, label: c.nameAr }))}
          placeholder="اختر دورة"
        />
      </div>
    </div>
  );
}
