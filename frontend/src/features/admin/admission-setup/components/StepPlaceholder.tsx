/**
 * StepPlaceholder — "قيد التطوير" shell.
 * Rendered by any step whose `isImplemented: false` flag has not yet
 * flipped. Kept inside the standard <AdmissionSetupShell> so the user
 * still sees breadcrumb + step header + cycle context.
 */

import { Link } from 'react-router-dom';
import { Wrench, ArrowRight } from 'lucide-react';
import { Button, Card } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import type { AdmissionSetupStep } from '../config';

interface StepPlaceholderProps {
  step: AdmissionSetupStep;
}

export function StepPlaceholder({ step }: StepPlaceholderProps): JSX.Element {
  const StepIcon = step.icon;
  return (
    <Card variant="elevated">
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span
          aria-hidden
          className="inline-flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
        >
          <StepIcon size={28} strokeWidth={1.5} />
        </span>
        <h2 className="font-ar-display text-xl font-bold text-ink-900">{step.labelAr}</h2>
        <p className="max-w-md text-sm text-ink-700 leading-relaxed">
          هذه الخطوة قيد التطوير حالياً. ستتوفر قريباً ضمن نفس مسار الإعدادات.
        </p>
        <p className="text-2xs text-ink-500">
          <Wrench size={12} strokeWidth={1.75} className="me-1 inline-block" />
          الخطوة <span className="font-numeric tnum">{step.order}</span> من
          منظومة إعداد التقديم
        </p>
        <Link to={ROUTES.admin.admissionSetup.index} className="inline-flex">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<ArrowRight size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
          >
            العودة إلى لوحة الإعدادات
          </Button>
        </Link>
      </div>
    </Card>
  );
}
