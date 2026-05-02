/**
 * Static list of applicant id+name+governorate triples used by the cross-
 * feature mock data in `sprint3to9.ts`. Kept inline (not from MOCK) to
 * avoid an import cycle: `index.ts → sprint3to9.ts → _applicantsRefs.ts`
 * would re-enter `index.ts` while it's still initialising.
 *
 * Names are deterministic and read like the seeded applicants but live in
 * their own file so the dependency graph stays acyclic.
 */

const FIRST = ['محمد', 'أحمد', 'محمود', 'عمر', 'يوسف', 'علي', 'إبراهيم', 'حسن'];
const LAST  = ['الفقي', 'المصري', 'الأنصاري', 'الجوهري', 'منصور', 'الخطيب', 'البنا', 'الجمل'];
const GOV   = ['القاهرة', 'الجيزة', 'الإسكندرية', 'الشرقية', 'الدقهلية', 'المنوفية', 'القليوبية', 'أسيوط'];

export interface AppRef { id: string; name: string; governorate: string }

export const MOCK_APPLICANTS_FOR_REFS: readonly AppRef[] = Array.from({ length: 240 }, (_, i) => {
  const f = FIRST[i % FIRST.length] ?? FIRST[0]!;
  const l = LAST[(i * 3) % LAST.length] ?? LAST[0]!;
  const g = GOV[i % GOV.length] ?? GOV[0]!;
  return {
    id: `APP-${String(2026000 + i).padStart(7, '0')}`,
    name: `${f} ${l}`,
    governorate: g,
  };
});
