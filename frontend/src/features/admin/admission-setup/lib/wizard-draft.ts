/**
 * Wizard draft persistence — survives reloads so admins can resume an
 * incomplete admission-setup at the exact step they left.
 *
 * Stored per cycle in localStorage. Pure key/value, no schema versioning;
 * draft entries are advisory hints, not source of truth (the real per-step
 * state lives in TanStack-Query-backed services).
 */

const KEY_PREFIX = 'pa-admission-setup-draft:';

export interface AdmissionSetupDraft {
  cycleId: string;
  /** Last `AdmissionSetupStepKey` (or `'review'`) the admin was on. */
  lastStepKey: string;
  /** ISO timestamp the draft was last written. */
  savedAt: string;
}

function key(cycleId: string): string {
  return `${KEY_PREFIX}${cycleId}`;
}

export function readDraft(cycleId: string): AdmissionSetupDraft | null {
  try {
    const raw = localStorage.getItem(key(cycleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdmissionSetupDraft;
    if (parsed.cycleId !== cycleId || typeof parsed.lastStepKey !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft(cycleId: string, lastStepKey: string): AdmissionSetupDraft {
  const draft: AdmissionSetupDraft = {
    cycleId,
    lastStepKey,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(key(cycleId), JSON.stringify(draft));
  } catch {
    /* localStorage unavailable — caller treats as best-effort. */
  }
  return draft;
}

export function clearDraft(cycleId: string): void {
  try {
    localStorage.removeItem(key(cycleId));
  } catch {
    /* swallow */
  }
}

/**
 * Called when a mutation returns a 409 ROW_VERSION_CONFLICT — ensures the
 * in-flight edits are NOT silently discarded. The draft store keeps a
 * `conflictPending` flag that surfaces the RowVersionConflictDialog.
 * Server-state wins only after the user explicitly confirms "Refresh and re-apply".
 */
export interface ConflictState {
  entityType: string;
  entityId: string;
  currentRowVersion: string;
  messageAr: string;
  messageEn: string;
  inFlightValues?: Record<string, unknown>;
}

const CONFLICT_KEY_PREFIX = 'pa-admission-setup-conflict:';

export function writeConflict(cycleId: string, state: ConflictState): void {
  try {
    localStorage.setItem(
      `${CONFLICT_KEY_PREFIX}${cycleId}`,
      JSON.stringify(state),
    );
  } catch {
    /* swallow */
  }
}

export function readConflict(cycleId: string): ConflictState | null {
  try {
    const raw = localStorage.getItem(`${CONFLICT_KEY_PREFIX}${cycleId}`);
    if (!raw) return null;
    return JSON.parse(raw) as ConflictState;
  } catch {
    return null;
  }
}

export function clearConflict(cycleId: string): void {
  try {
    localStorage.removeItem(`${CONFLICT_KEY_PREFIX}${cycleId}`);
  } catch {
    /* swallow */
  }
}

/** Enumerate all persisted drafts — used by the launcher to list "resume" rows. */
export function listDrafts(): AdmissionSetupDraft[] {
  const out: AdmissionSetupDraft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(KEY_PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as AdmissionSetupDraft;
        if (parsed.cycleId && parsed.lastStepKey) out.push(parsed);
      } catch {
        /* skip */
      }
    }
  } catch {
    /* swallow */
  }
  return out;
}
