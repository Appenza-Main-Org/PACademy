import { normalizeArabic } from '@/shared/lib/arabic';
import { parseNationalId } from '@/shared/lib/national-id';
import type { GovernorateRow, PoliceStationRow } from '@/features/lookups';

const NID_GOVERNORATE_NAME_BY_CODE: Record<string, string> = {
  '01': 'محافظة القاهرة',
  '02': 'محافظة الإسكندرية',
  '03': 'محافظة بورسعيد',
  '04': 'محافظة السويس',
  '11': 'محافظة دمياط',
  '12': 'محافظة الدقهلية',
  '13': 'محافظة الشرقية',
  '14': 'محافظة القليوبية',
  '15': 'محافظة كفر الشيخ',
  '16': 'محافظة الغربية',
  '17': 'محافظة المنوفية',
  '18': 'محافظة البحيرة',
  '19': 'محافظة الإسماعيلية',
  '21': 'محافظة الجيزة',
  '22': 'محافظة بني سويف',
  '23': 'محافظة الفيوم',
  '24': 'محافظة المنيا',
  '25': 'محافظة أسيوط',
  '26': 'محافظة سوهاج',
  '27': 'محافظة قنا',
  '28': 'محافظة أسوان',
  '29': 'محافظة الأقصر',
  '31': 'محافظة البحر الأحمر',
  '32': 'محافظة الوادي الجديد',
  '33': 'محافظة مطروح',
  '34': 'محافظة شمال سيناء',
  '35': 'محافظة جنوب سيناء',
  '88': 'خارج الجمهورية',
};

const NID_GOVERNORATE_CODE_BY_NAME = new Map(
  Object.entries(NID_GOVERNORATE_NAME_BY_CODE).map(([code, name]) => [
    normalizeGovText(name),
    code,
  ]),
);

NID_GOVERNORATE_CODE_BY_NAME.set(normalizeGovText('السويس'), '04');
NID_GOVERNORATE_CODE_BY_NAME.set(normalizeGovText('مطروح'), '33');

type GovernoratePayload = GovernorateRow & {
  nationalIdCode?: string;
  nidCode?: string;
  moiCode?: string;
  civilRegistryCode?: string;
};

function normalizeGovText(value: string): string {
  return normalizeArabic(value).replace(/\s+/g, ' ');
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function governorateCivilCode(row: GovernorateRow): string | null {
  const payload = row as GovernoratePayload;
  const direct =
    readString(payload.nationalIdCode) ??
    readString(payload.nidCode) ??
    readString(payload.moiCode) ??
    readString(payload.civilRegistryCode);
  if (direct) return direct.padStart(2, '0');

  const metadata = payload.metadata;
  if (metadata) {
    const fromMetadata =
      readString(metadata.nationalIdCode) ??
      readString(metadata.nidCode) ??
      readString(metadata.moiCode) ??
      readString(metadata.civilRegistryCode);
    if (fromMetadata) return fromMetadata.padStart(2, '0');
  }

  return NID_GOVERNORATE_CODE_BY_NAME.get(normalizeGovText(row.name)) ?? null;
}

function lookupRowByCivilCode(
  rows: readonly GovernorateRow[],
  code: string,
): GovernorateRow | null {
  const normalized = code.padStart(2, '0');
  return rows.find((row) => governorateCivilCode(row) === normalized) ?? null;
}

function lookupRowByValue(
  rows: readonly GovernorateRow[],
  value: string,
): GovernorateRow | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{1,2}$/.test(trimmed)) {
    return lookupRowByCivilCode(rows, trimmed);
  }

  const normalized = normalizeGovText(trimmed);
  return rows.find((row) => row.code === trimmed || normalizeGovText(row.name) === normalized) ?? null;
}

export function resolveBirthGovernorateRow(
  rows: readonly GovernorateRow[],
  value: string | null | undefined,
  nationalId?: string | null,
): GovernorateRow | null {
  const parsed = nationalId ? parseNationalId(nationalId) : null;
  if (parsed?.valid && parsed.governorateCode) {
    const byNid = lookupRowByCivilCode(rows, parsed.governorateCode);
    if (byNid) return byNid;
  }

  return value ? lookupRowByValue(rows, value) : null;
}

export function resolveGovernorateRow(
  rows: readonly GovernorateRow[],
  value: string | null | undefined,
): GovernorateRow | null {
  return value ? lookupRowByValue(rows, value) : null;
}

export function policeStationMatchesGovernorate(
  station: PoliceStationRow,
  governorate: GovernorateRow | null,
): boolean {
  if (!governorate) return false;

  const stationCode = (station.governorateCode ?? '').trim();
  if (!stationCode) return false;
  const civilCode = governorateCivilCode(governorate);
  const candidates = new Set<string>([
    governorate.code,
    governorate.name,
    normalizeGovText(governorate.name),
  ]);

  if (civilCode) {
    candidates.add(civilCode);
    candidates.add(String(Number(civilCode)));
    const civilName = NID_GOVERNORATE_NAME_BY_CODE[civilCode];
    if (civilName) {
      candidates.add(civilName);
      candidates.add(normalizeGovText(civilName));
    }
  }

  return candidates.has(stationCode) || candidates.has(normalizeGovText(stationCode));
}
