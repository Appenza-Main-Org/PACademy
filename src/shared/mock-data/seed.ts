/**
 * Deterministic seeded RNG — same input → same data on every render.
 * Ported 1:1 from the legacy mock-data.js LCG.
 */

let seed = 42;

export function reseed(value = 42): void {
  seed = value;
}

export function rng(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

export function pick<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick: empty array');
  return arr[Math.floor(rng() * arr.length)] as T;
}
