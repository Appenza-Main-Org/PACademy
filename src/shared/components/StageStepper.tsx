/**
 * 11-stage applicant journey stepper.
 * Done | Current | Pending visual states match the demo's `.steps`.
 */

import { Fragment } from 'react';
import { cn } from '@/shared/lib/cn';

interface StageStepperProps {
  stages: readonly string[];
  currentIndex: number;
}

export function StageStepper({ stages, currentIndex }: StageStepperProps): JSX.Element {
  return (
    <div className="steps">
      {stages.map((label, i) => {
        const status = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'pending';
        return (
          <Fragment key={label}>
            <div className={cn('step', status)}>
              <div className="step-dot">{i + 1}</div>
              <span>{label}</span>
            </div>
            {i < stages.length - 1 && <div className="step-line" />}
          </Fragment>
        );
      })}
    </div>
  );
}
