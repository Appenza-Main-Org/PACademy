/**
 * sessionStorage bridge for the وثيقة تعارف document.
 *
 * Mirrors the [familyData.ts](familyData.ts) snapshot pattern — the
 * Stage 11 page (and the post-submission tab) snapshot the in-progress
 * document on every group save, and re-hydrate on remount. The key is
 * scoped per-NID so two demo applicants in the same tab don't collide.
 */

import type { VothiqaTaarufDocument } from './vothiqaTaaruf.types';

const STORAGE_KEY_PREFIX = 'pa-vothiqa-taaruf';

function keyFor(nid: string | null): string {
  return `${STORAGE_KEY_PREFIX}-${nid ?? 'anon'}`;
}

export function saveVothiqaTaarufSnapshot(
  nid: string | null,
  doc: VothiqaTaarufDocument,
): void {
  try {
    sessionStorage.setItem(keyFor(nid), JSON.stringify(doc));
  } catch {
    /* sessionStorage can fail in private-browsing or quota-exceeded
     * scenarios — swallow so the wizard stays navigable; next reload
     * just shows the derived defaults. */
  }
}

export function loadVothiqaTaarufSnapshot(
  nid: string | null,
): VothiqaTaarufDocument | null {
  try {
    const raw = sessionStorage.getItem(keyFor(nid));
    if (!raw) return null;
    return JSON.parse(raw) as VothiqaTaarufDocument;
  } catch {
    return null;
  }
}

export function clearVothiqaTaarufSnapshot(nid: string | null): void {
  try {
    sessionStorage.removeItem(keyFor(nid));
  } catch {
    /* best-effort cleanup */
  }
}
