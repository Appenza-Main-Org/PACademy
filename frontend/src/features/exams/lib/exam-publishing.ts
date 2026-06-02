const TOKEN_PREFIX = 'exam';

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
