/**
 * Deterministic payment-code generators — applicant-flow MOI-alignment.
 *
 * Mock determinism (CLAUDE.md §6 + §architectural-guardrails): every
 * generated number used by the demo must be reproducible across renders so
 * screenshots, prints, and the printed reference card all stay in sync.
 *
 * Both helpers seed an isolated LCG from the applicant id — the global
 * `shared/mock-data/seed.ts` LCG is mutated by hundreds of mock generators
 * at boot, so re-using it here would entangle the wizard with unrelated
 * mock data ordering. Keeping the LCG local sidesteps that.
 */

function lcg(seed: number): () => number {
  let s = seed & 0x7fffffff;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function seedFromApplicant(applicantId: string): number {
  /* Simple deterministic hash (DJB2-ish). 42 stays in the mix so this
   * remains anchored to the seed-42 convention even though the LCG itself
   * is isolated. */
  let h = 42;
  for (let i = 0; i < applicantId.length; i++) {
    h = ((h << 5) + h + applicantId.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

function digits(rand: () => number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += Math.floor(rand() * 10).toString();
  }
  return out;
}

/** 10-digit payment reference (printed on the attendance card). */
export function deterministicPaymentReference(applicantId: string): string {
  const rand = lcg(seedFromApplicant(applicantId) ^ 0xd061);
  return digits(rand, 10);
}

/** 8-digit Fawry code (shown on the inline code-payment receipt). */
export function deterministicFawryCode(applicantId: string): string {
  const rand = lcg(seedFromApplicant(applicantId) ^ 0xfa07);
  return digits(rand, 8);
}

/** 4-digit file number (printed on the attendance card). */
export function deterministicFileNumber(applicantId: string): string {
  const rand = lcg(seedFromApplicant(applicantId) ^ 0xf11e);
  return digits(rand, 4);
}
