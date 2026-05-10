/**
 * Officer / civilian / contractor directory — admin-create NID lookup pool.
 *
 * Distinct from `MOCK.users`: this is the *candidate* set the NID lookup
 * queries against. Once an admin creates a system account from a candidate,
 * that candidate's data flows into `MOCK.users`. The candidate row itself
 * stays in this directory (a person may exist in HR before being issued
 * a system account; backend keeps these tables separate).
 *
 * INTEGRATION CONTRACT:
 *   GET /v1/officers/lookup?nationalId={nid}  →  OfficerCandidate
 *   The backend reads the live HR / personnel database. The mock matches
 *   from this seed; all NIDs validate via `parseNationalId()` so the
 *   format/checksum branch in the lookup service is exercisable.
 */

import type { UserType } from '@/shared/types/domain';

export interface OfficerDirectoryRow {
  nationalId: string;
  fullArabicName: string;
  officerCode: string;
  mobileNumber: string;
  userType: UserType;
}

/* Each NID validates per `isValidNationalId` (CYYMMDDGGSSSSC).
 * Mix of officers, civilians, and contractors so the create form
 * exercises every branch of the userType discriminator. */
export const OFFICER_DIRECTORY: ReadonlyArray<OfficerDirectoryRow> = [
  {
    nationalId: '29512011500011',
    fullArabicName: 'العميد د. أحمد محمود الفقي محمد',
    officerCode: 'OFF-1001',
    mobileNumber: '01001234521',
    userType: 'officer',
  },
  {
    nationalId: '28804120100022',
    fullArabicName: 'العقيد محمد إبراهيم حسن أحمد',
    officerCode: 'OFF-1002',
    mobileNumber: '01112345678',
    userType: 'officer',
  },
  {
    nationalId: '29006150700033',
    fullArabicName: 'العقيد د. أيمن شريف رمضان فاروق',
    officerCode: 'OFF-1003',
    mobileNumber: '01234567890',
    userType: 'officer',
  },
  {
    nationalId: '29209221400044',
    fullArabicName: 'الرائد محمود الديب البنا فاروق',
    officerCode: 'OFF-1004',
    mobileNumber: '01098765432',
    userType: 'officer',
  },
  {
    nationalId: '29501081100055',
    fullArabicName: 'النقيب كريم زياد فاروق نصر',
    officerCode: 'OFF-1005',
    mobileNumber: '01556677889',
    userType: 'officer',
  },
  {
    nationalId: '29103251200066',
    fullArabicName: 'الرائد طارق علي الخطيب سعد',
    officerCode: 'OFF-1006',
    mobileNumber: '01223344556',
    userType: 'officer',
  },
  {
    nationalId: '29407170300077',
    fullArabicName: 'النقيب يوسف أحمد المصري عبدالله',
    officerCode: 'OFF-1007',
    mobileNumber: '01099887766',
    userType: 'officer',
  },
  {
    nationalId: '29610141900088',
    fullArabicName: 'الرائد ياسر هشام منصور إبراهيم',
    officerCode: 'OFF-1008',
    mobileNumber: '01077665544',
    userType: 'officer',
  },
  {
    nationalId: '28702280500099',
    fullArabicName: 'حسام عبدالرحمن السيد علي',
    officerCode: 'CIV-2001',
    mobileNumber: '01155443322',
    userType: 'civilian',
  },
  {
    nationalId: '29009091100110',
    fullArabicName: 'منى صلاح الدين فؤاد',
    officerCode: 'CIV-2002',
    mobileNumber: '01244332211',
    userType: 'civilian',
  },
  {
    nationalId: '29305051300121',
    fullArabicName: 'سامح محمد رضوان حسين',
    officerCode: 'CTR-3001',
    mobileNumber: '01066778899',
    userType: 'contractor',
  },
  {
    nationalId: '28811240200132',
    fullArabicName: 'كريم نبيل توفيق إبراهيم',
    officerCode: 'CTR-3002',
    mobileNumber: '01533221100',
    userType: 'contractor',
  },
];

export function findOfficerByNid(nationalId: string): OfficerDirectoryRow | undefined {
  return OFFICER_DIRECTORY.find((o) => o.nationalId === nationalId);
}
