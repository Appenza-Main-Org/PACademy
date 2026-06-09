/**
 * Format helpers — numbers, dates, escape, relative time.
 * Locale-aware (ar-EG primary).
 */

export function num(n: number | string | null | undefined, opts?: Intl.NumberFormatOptions): string {
  if (n === null || n === undefined || n === '') return '—';
  const value = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(value)) return String(n);
  return new Intl.NumberFormat('en-US', opts).format(value);
}

export function year(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '—';
  if (typeof n === 'number') return String(Math.trunc(n));
  const text = String(n).trim();
  const ungrouped = text.replace(/[,\s]/g, '');
  return /^\d{4}$/.test(ungrouped) ? ungrouped : text;
}

export function date(d: Date | string | number | null | undefined, fmt: 'full' | 'short' | 'time' | 'rel' = 'full'): string {
  if (d === null || d === undefined) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';

  if (fmt === 'rel') return relativeTime(dt);

  if (fmt === 'time') {
    return dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }
  if (fmt === 'short') {
    return dt.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return dt.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function relativeTime(d: Date | number): string {
  const dt = typeof d === 'number' ? d : d.getTime();
  const diffMs = Date.now() - dt;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'منذ لحظات';
  const min = Math.floor(sec / 60);
  if (min < 60) return `منذ ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `منذ ${hr} ساعة`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `منذ ${day} يوم`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `منذ ${mo} شهر`;
  return `منذ ${Math.floor(mo / 12)} سنة`;
}

export function maskNationalId(id: string): string {
  if (!id || id.length < 14) return id;
  return `${id.slice(0, 3)}••••••${id.slice(11)}`;
}

export function shortName(name: string, parts = 3): string {
  if (!name) return '';
  return name.split(' ').slice(0, parts).join(' ');
}

export function initials(name: string): string {
  if (!name) return '؟';
  const tokens = name.split(' ').filter(Boolean);
  // Skip rank/title, take first letter of given name
  for (const t of tokens) {
    if (t.length > 1 && !['د.', 'العميد', 'العقيد', 'الرائد', 'النقيب', 'الملازم', 'أول'].includes(t)) {
      return t[0] ?? '؟';
    }
  }
  return tokens[0]?.[0] ?? '؟';
}
