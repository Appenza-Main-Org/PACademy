/**
 * Stage345 form snapshot — sessionStorage bridge.
 *
 * The applicant-data form values (bachelor block, thanawi block, address,
 * social, declaration, plus the manual-entry personal fields used on the
 * not_found-in-MOI path) are persisted here on submit so downstream
 * surfaces — chiefly the طلب الالتحاق PDF generated from the print-card
 * step — can render the values the applicant entered.
 *
 * Pattern mirrors `familyData.ts`: scoped to the tab via sessionStorage,
 * stringified JSON, best-effort writes.
 */

import type { Stage345Values } from '../schemas';

export interface ProfileManualPersonal {
  fullName: string;
  gender: '' | 'male' | 'female';
  religion: '' | 'مسلم' | 'مسيحي';
  dateOfBirthAr: string;
  birthGovernorate: string;
  birthDistrict: string;
  mobile: string;
  email: string;
  shuhra: string;
  maritalStatus: '' | 'single' | 'married' | 'divorced' | 'widowed';
  officerApplicantType: '' | 'expat' | 'foreign_certificate';
}

export interface ProfileSnapshot {
  /** Full Stage345 zod-resolved form payload. */
  values: Stage345Values;
  /** Manual-entry personal-data block — only meaningful on the
   *  not_found-in-MOI path; for MOI-verified applicants the canonical
   *  source is the moiSession in the portal store. */
  manualPersonal: ProfileManualPersonal;
  /** Qualification level picked by الضباط المتخصصون — drives whether
   *  postgrad sections render. Empty string for other categories. */
  qualificationLevel: '' | 'license' | 'bachelor' | 'master' | 'doctorate';
  /** ISO timestamp the snapshot was last written (for debugging). */
  savedAt: string;
}

const STORAGE_KEY = 'pa-applicant-profile-data';

export function saveProfileSnapshot(s: Omit<ProfileSnapshot, 'savedAt'>): void {
  try {
    const payload: ProfileSnapshot = { ...s, savedAt: new Date().toISOString() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* best-effort — failure leaves downstream PDFs without applicant
     * form data; they fall back to "—" placeholders. */
  }
}

export function loadProfileSnapshot(): ProfileSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProfileSnapshot;
  } catch {
    return null;
  }
}

export function clearProfileSnapshot(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* best-effort cleanup */
  }
}
