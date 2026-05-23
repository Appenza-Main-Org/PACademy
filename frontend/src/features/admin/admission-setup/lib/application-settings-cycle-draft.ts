/**
 * Per-cycle draft persistence for the existing application-settings
 * authoring store. This keeps the current UX intact while allowing an
 * admin to return to a selected cycle/category and see rows that were
 * authored earlier.
 */

import {
  useAdmissionSetupWizardStore,
  type ApprovedGeneralRuleRow,
  type GeneralRulesHeader,
  type LocalGeneralRuleRow,
} from '../store/wizardSharedState';

const KEY_PREFIX = 'pa-admission-setup-application-settings:';
const VERSION = 1;

interface ApplicationSettingsCycleDraft {
  version: typeof VERSION;
  cycleId: string;
  updatedAt: string;
  headers: Record<string, GeneralRulesHeader>;
  local: LocalGeneralRuleRow[];
  approved: ApprovedGeneralRuleRow[];
}

function storageKey(cycleId: string): string {
  return `${KEY_PREFIX}${cycleId}`;
}

function isDraft(value: unknown, cycleId: string): value is ApplicationSettingsCycleDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<ApplicationSettingsCycleDraft>;
  return (
    draft.version === VERSION &&
    draft.cycleId === cycleId &&
    typeof draft.headers === 'object' &&
    Array.isArray(draft.local) &&
    Array.isArray(draft.approved)
  );
}

export function readApplicationSettingsCycleDraft(
  cycleId: string,
): ApplicationSettingsCycleDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(cycleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isDraft(parsed, cycleId) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeApplicationSettingsCycleDraft(cycleId: string): void {
  try {
    const state = useAdmissionSetupWizardStore.getState();
    const draft: ApplicationSettingsCycleDraft = {
      version: VERSION,
      cycleId,
      updatedAt: new Date().toISOString(),
      headers: state.headers,
      local: state.local,
      approved: state.approved,
    };
    localStorage.setItem(storageKey(cycleId), JSON.stringify(draft));
  } catch {
    /* localStorage unavailable; the in-memory store still works. */
  }
}

export function hydrateApplicationSettingsCycleDraft(cycleId: string): void {
  const draft = readApplicationSettingsCycleDraft(cycleId);
  useAdmissionSetupWizardStore.setState({
    headers: draft?.headers ?? {},
    local: draft?.local ?? [],
    approved: draft?.approved ?? [],
    editingRowId: null,
  });
}
