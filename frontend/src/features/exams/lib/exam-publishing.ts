const TOKEN_PREFIX = 'exam';
const BIOMETRIC_REQUIRED_CHECKS = ['applicant', 'today', 'assignment', 'suspension', 'duplicate'] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

export function createPublishToken(seed: string): string {
  const slug = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug ? `${TOKEN_PREFIX}-${slug}` : 'exam-room';
}

export function deriveExamIdFromPublishToken(token: string): string | null {
  const normalized = token.trim().toLowerCase();
  const prefix = `${TOKEN_PREFIX}-exam-`;
  if (!normalized.startsWith(prefix)) return null;

  const idPart = normalized.slice(TOKEN_PREFIX.length + 1);
  if (!/^exam-[a-z0-9-]+$/.test(idPart)) return null;
  return idPart.toUpperCase();
}

export function buildExamRoomUrl(token: string, baseHref = typeof window !== 'undefined' ? window.location.href : ''): string {
  const path = `/exam-room/${encodeURIComponent(token)}`;
  if (!baseHref) return path;

  try {
    const url = new URL(baseHref);
    return `${url.origin}${path}`;
  } catch {
    return path;
  }
}

export function getPublishedExamRoomUrl(
  exam: { id: string; publishToken?: string; publishedUrl?: string },
  baseHref = typeof window !== 'undefined' ? window.location.href : '',
): string {
  if (exam.publishedUrl?.trim()) return exam.publishedUrl;
  return buildExamRoomUrl(exam.publishToken ?? createPublishToken(exam.id), baseHref);
}

export function normaliseIpAllowlist(value: string | readonly string[] | undefined): string[] {
  const raw = typeof value === 'string' ? value.split(/[\s,]+/) : value ?? [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    const ip = item.trim();
    if (!ip || seen.has(ip)) continue;
    seen.add(ip);
    out.push(ip);
  }

  return out;
}

export function isIpAllowed(ipAddress: string, allowlist: readonly string[]): boolean {
  const ip = ipAddress.trim();
  if (!ip || allowlist.length === 0) return false;

  return allowlist.some((entry) => {
    const pattern = entry.trim();
    if (!pattern) return false;
    if (pattern === ip) return true;
    if (!pattern.includes('*')) return false;

    const regex = new RegExp(`^${escapeRegExp(pattern).replace(/\*/g, '[0-9]{1,3}')}$`);
    return regex.test(ip);
  });
}

export function canSubmitExamLogin(input: {
  nationalId: string;
  applicantCode?: string;
  isExamRoom: boolean;
}): boolean {
  const hasNationalId = input.nationalId.trim().length > 0;
  if (input.isExamRoom) return hasNationalId;
  return hasNationalId && (input.applicantCode ?? '').trim().length > 0;
}

export function canStartWithBiometricGate(checks: ReadonlyArray<{ key: string; ok: boolean }>): boolean {
  const byKey = new Map(checks.map((check) => [check.key, check.ok]));
  return BIOMETRIC_REQUIRED_CHECKS.every((key) => byKey.get(key) === true);
}
