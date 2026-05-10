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
