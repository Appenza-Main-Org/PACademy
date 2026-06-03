/**
 * Admission-setup wizard gating helpers.
 *
 * Sequential navigation is derived from persisted step completion, not
 * from browser history. Future steps are locked behind the first
 * incomplete step, including the final review checkpoint.
 */

import type { AdmissionSetupStepStatus } from '../types';

export interface WizardGateStep {
  key: string;
  order: number;
}

export type WizardStatusByKey = Record<string, AdmissionSetupStepStatus>;

export interface WizardGateState {
  canGoNext: boolean;
  nextKey: string | null;
  previousKey: string | null;
  redirectKey: string | null;
  lockedKeys: string[];
}

function orderedKeys(steps: readonly WizardGateStep[], reviewKey: string): string[] {
  return [
    ...steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((step) => step.key),
    reviewKey,
  ];
}

function isComplete(key: string, statuses: WizardStatusByKey, reviewKey: string): boolean {
  if (key === reviewKey) return false;
  return statuses[key] === 'complete';
}

export function getFirstIncompleteWizardKey(
  steps: readonly WizardGateStep[],
  statuses: WizardStatusByKey,
): string | null {
  const first = steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .find((step) => statuses[step.key] !== 'complete');
  return first?.key ?? null;
}

export function isWizardStepSelectable(
  key: string,
  steps: readonly WizardGateStep[],
  statuses: WizardStatusByKey,
  reviewKey: string,
): boolean {
  const keys = orderedKeys(steps, reviewKey);
  const targetIndex = keys.indexOf(key);
  if (targetIndex === -1) return false;
  for (let index = 0; index < targetIndex; index += 1) {
    if (!isComplete(keys[index]!, statuses, reviewKey)) return false;
  }
  return true;
}

export function getEarliestAllowedWizardKey(
  steps: readonly WizardGateStep[],
  requestedKey: string,
  statuses: WizardStatusByKey,
  reviewKey: string,
): string {
  if (isWizardStepSelectable(requestedKey, steps, statuses, reviewKey)) {
    return requestedKey;
  }
  return getFirstIncompleteWizardKey(steps, statuses) ?? steps[0]?.key ?? requestedKey;
}

export function getWizardGateState(
  steps: readonly WizardGateStep[],
  activeKey: string,
  statuses: WizardStatusByKey,
  reviewKey: string,
): WizardGateState {
  const keys = orderedKeys(steps, reviewKey);
  const activeIndex = keys.indexOf(activeKey);
  const firstIncomplete = getFirstIncompleteWizardKey(steps, statuses);
  const lockedKeys = keys.filter(
    (key) => !isWizardStepSelectable(key, steps, statuses, reviewKey),
  );
  const nextKey =
    activeIndex >= 0 && activeIndex < keys.length - 1 ? keys[activeIndex + 1]! : null;
  const previousKey = activeIndex > 0 ? keys[activeIndex - 1]! : null;
  const redirectKey =
    activeIndex >= 0 && lockedKeys.includes(activeKey)
      ? firstIncomplete ?? steps[0]?.key ?? null
      : null;

  return {
    canGoNext: Boolean(nextKey) && activeKey !== reviewKey && statuses[activeKey] === 'complete',
    nextKey,
    previousKey,
    redirectKey,
    lockedKeys,
  };
}
