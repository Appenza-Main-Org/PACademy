/**
 * Deterministic Egyptian full-name synthesizer for mock/derived identities.
 *
 * Composes a four-part name — first + father + grandfather + family — where
 * each part is drawn independently from a dedicated dataset, so the
 * combination space exceeds 400 million male and 300 million female full
 * names. Selection is weighted three ways per dataset (common 45% /
 * standard 35% / rare 20%) to mimic real-world Egyptian name frequency
 * without letting the handful of very common names dominate.
 *
 * Two entry points:
 * - `arabicFullNameForNid(nid, gender)` — keyed off the NID through 32-bit
 *   FNV-1a; the same NID always resolves to the same full name. MIRROR of
 *   the backend `ArabicNameGenerator`
 *   (backend/applicant/.../Moi/ArabicNameGenerator.cs) — same datasets,
 *   same hash, same tier arithmetic. Keep the two in sync.
 * - `randomArabicFullName(gender, rng)` — same datasets + weights but driven
 *   by a caller-supplied RNG, for bulk mock-data generation.
 */

interface NamePool {
  common: readonly string[];
  standard: readonly string[];
  rare: readonly string[];
}

/** Builds the deterministic four-part full name for a NID. */
export function arabicFullNameForNid(nid: string, gender: 'male' | 'female'): string {
  const first = pickSeeded(gender === 'female' ? FEMALE_FIRST : MALE_FIRST, fnv1a(`${nid}#first`));
  const father = pickSeeded(PATERNAL, fnv1a(`${nid}#father`));
  let grandfather = pickSeeded(PATERNAL, fnv1a(`${nid}#grandfather`));
  if (grandfather === father) grandfather = pickSeeded(PATERNAL, fnv1a(`${nid}#grandfather2`));
  const family = pickSeeded(FAMILY, fnv1a(`${nid}#family`));
  return `${first} ${father} ${grandfather} ${family}`;
}

/** RNG-driven variant for bulk mock datasets (e.g. the seeded applicant list). */
export function randomArabicFullName(gender: 'male' | 'female', rng: () => number): string {
  const first = pickRandom(gender === 'female' ? FEMALE_FIRST : MALE_FIRST, rng);
  const father = pickRandom(PATERNAL, rng);
  let grandfather = pickRandom(PATERNAL, rng);
  if (grandfather === father) grandfather = pickRandom(PATERNAL, rng);
  return `${first} ${father} ${grandfather} ${pickRandom(FAMILY, rng)}`;
}

/**
 * Weighted tier pick: low two digits of the seed choose the tier (0-44
 * common, 45-79 standard, 80-99 rare), the remaining bits index uniformly
 * inside the tier. Single-seed, fully deterministic.
 */
function pickSeeded(pool: NamePool, seed: number): string {
  const tierRoll = seed % 100;
  const tier = tierRoll < 45 ? pool.common : tierRoll < 80 ? pool.standard : pool.rare;
  return tier[Math.floor(seed / 100) % tier.length]!;
}

function pickRandom(pool: NamePool, rng: () => number): string {
  const tierRoll = rng();
  const tier = tierRoll < 0.45 ? pool.common : tierRoll < 0.8 ? pool.standard : pool.rare;
  return tier[Math.floor(rng() * tier.length)]!;
}

/** 32-bit FNV-1a over UTF-16 code units — bit-identical to the C# mirror. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ── Datasets ──────────────────────────────────────────────────────────────
// Curated from the QA enhancement request (2026-06) — common / standard /
// rare tiers reflect contemporary Egyptian naming frequency. Applicant
// first names skew young (birth cohort ≈ 2004-2008); the paternal pool
// deliberately includes older-generation names that are no longer given to
// newborns but are everywhere as fathers/grandfathers.

const MALE_FIRST: NamePool = {
  common: [
    'محمد', 'أحمد', 'محمود', 'مصطفى', 'يوسف', 'عمر', 'علي', 'عبد الرحمن',
    'عبد الله', 'إبراهيم', 'خالد', 'كريم', 'حسن', 'حسين', 'عمرو', 'طارق',
    'أشرف', 'وليد', 'أيمن', 'هشام', 'عبد العزيز', 'زياد',
  ],
  standard: [
    'إسماعيل', 'ياسين', 'عبد المنعم', 'عبد الحميد', 'شريف', 'سامح', 'سامي',
    'وائل', 'مروان', 'معاذ', 'معتز', 'تامر', 'يحيى', 'حمزة', 'بلال', 'أنس',
    'أدهم', 'سيف', 'سيف الدين', 'رامي', 'حازم', 'هيثم', 'شادي', 'نادر',
    'مؤمن', 'باسم', 'فادي', 'فؤاد', 'حسام', 'جمال', 'كمال', 'علاء', 'محسن',
    'ماهر', 'مازن', 'زكريا', 'صلاح', 'أسامة', 'سعد', 'عادل', 'عمار', 'نبيل',
    'ناصر', 'حمدي', 'سليمان', 'سمير', 'هاني', 'موسى',
  ],
  rare: [
    'معتصم', 'إياد', 'بهاء', 'جلال', 'صبحي', 'مدحت', 'منير', 'زين',
    'زين العابدين', 'رجب', 'سامر', 'مصعب', 'عاصم', 'عوض', 'ناجي', 'نصر',
    'فايز', 'فيصل', 'صابر', 'شوقي', 'رشاد', 'رفعت', 'رمضان', 'ربيع', 'سيد',
    'صهيب', 'شهاب', 'قاسم', 'يونس', 'داوود', 'رائد', 'رفيق', 'رأفت', 'نواف',
    'جابر', 'ثابت', 'خليل', 'عبد الوهاب', 'عبد الستار', 'عبد الباسط',
    'عبد الحكيم', 'عبد الجليل', 'عبد الرؤوف', 'عبد الفتاح', 'عبد القادر',
    'عبد المولى', 'عبد الهادي', 'عبد الناصر', 'عبد السلام', 'مهند', 'لؤي',
  ],
};

const FEMALE_FIRST: NamePool = {
  common: [
    'مريم', 'فاطمة', 'سارة', 'ياسمين', 'نورهان', 'آية', 'ملك', 'جنى',
    'سلمى', 'حبيبة', 'ندى', 'منة الله', 'إسراء', 'أسماء', 'شيماء', 'هاجر',
    'ريم', 'زينب', 'شهد', 'نور',
  ],
  standard: [
    'رحمة', 'نادين', 'منة', 'دعاء', 'بسمة', 'هبة', 'رنا', 'ريهام', 'رشا',
    'رضوى', 'خديجة', 'عائشة', 'سمر', 'نهى', 'إيمان', 'أميرة', 'أماني',
    'عبير', 'داليا', 'دنيا', 'دينا', 'نرمين', 'نسرين', 'مي', 'ميار', 'مروة',
    'مها', 'يارا', 'فرح', 'فريدة', 'رقية', 'شذى', 'شروق', 'نورا', 'تقى',
    'تسنيم', 'لوجين', 'لين', 'لمياء', 'ريتاج', 'أروى', 'أمل',
  ],
  rare: [
    'صفاء', 'سناء', 'سوسن', 'نجلاء', 'إلهام', 'جيهان', 'سلوى', 'ميادة',
    'ميارا', 'مرام', 'ميس', 'ميساء', 'يمنى', 'يسر', 'جودي', 'جومانا',
    'جنى الله', 'سجى', 'سندس', 'ليان', 'لمار', 'لميس', 'ريتال', 'كارما',
    'جوري', 'تالا', 'تالين', 'دانا', 'ديما', 'أفنان', 'أريج', 'ولاء',
    'وفاء', 'حنان', 'ابتسام', 'إيناس', 'إكرام', 'نوال', 'نجوى', 'كوثر',
    'فردوس',
  ],
};

/** Father + grandfather dataset — male names only, weighted toward the generations above the applicants. */
const PATERNAL: NamePool = {
  common: [
    'محمد', 'أحمد', 'محمود', 'إبراهيم', 'علي', 'حسن', 'حسين', 'مصطفى',
    'السيد', 'خالد', 'سعيد', 'صلاح', 'جمال', 'كمال', 'فتحي', 'رمضان',
    'سمير', 'سامي', 'فؤاد', 'أنور', 'ماهر', 'مجدي', 'أيمن', 'أشرف',
    'عادل', 'عاطف', 'صبري', 'حمدي',
  ],
  standard: [
    'عبد الله', 'عبد الرحمن', 'عبد العزيز', 'عبد الحميد', 'عبد المنعم',
    'عبد الفتاح', 'عبد السلام', 'عبد اللطيف', 'عبد الحليم', 'عبد الغني',
    'عبد العال', 'عبد التواب', 'عبد الرازق', 'عبد الجواد', 'عبد المقصود',
    'عبد الستار', 'عبد الوهاب', 'عبد القادر', 'عبد الهادي', 'عبد الناصر',
    'طارق', 'شريف', 'وليد', 'هشام', 'ياسر', 'عماد', 'عصام', 'إيهاب',
    'أكرم', 'أسامة', 'سامح', 'تامر', 'وائل', 'حازم', 'حاتم', 'هيثم',
    'نادر', 'باسم', 'حسام', 'علاء', 'محسن', 'منير', 'مازن', 'زكريا',
    'رجب', 'شعبان', 'عاشور', 'جمعة', 'خميس', 'عيد', 'رزق', 'بخيت',
    'توفيق', 'نجيب', 'حلمي', 'فهمي', 'لطفي', 'شفيق', 'حسني', 'فوزي',
    'فاروق', 'ممدوح', 'صفوت', 'عزت', 'رفعت', 'مدحت', 'طلعت', 'نشأت',
    'شوقي', 'رشاد', 'صابر', 'سليمان', 'سيد', 'يونس', 'موسى', 'داوود',
    'يحيى', 'خليل', 'سالم', 'سلامة',
  ],
  rare: [
    'عثمان', 'عمران', 'غانم', 'غنيم', 'حماد', 'حمدان', 'مرسي', 'عوض',
    'عوض الله', 'عبد ربه', 'جابر', 'ثابت', 'قاسم', 'شهاب', 'نصر', 'ناجي',
    'نبيل', 'فايز', 'فيصل', 'ربيع', 'جلال', 'بهاء', 'صبحي', 'هلال',
    'نوفل', 'عبده', 'عفيفي', 'سرحان', 'شلبي', 'خاطر', 'عامر', 'بدوي',
    'زغلول', 'أبو بكر', 'أبو الفتوح', 'أبو المجد', 'أبو اليزيد',
    'سيد أحمد', 'محمد علي', 'أمين', 'رؤوف', 'رأفت', 'رفيق', 'رائد',
    'منصور', 'مرزوق', 'شاكر', 'كرم', 'مكرم', 'نعيم', 'فكري', 'صدقي',
    'وهبة', 'زاهر', 'زكي', 'غريب', 'سعفان', 'دسوقي', 'قطب', 'هريدي',
    'عبد العاطي', 'عبد الغفار', 'عبد الظاهر', 'عبد الصمد', 'عبد الدايم',
    'عبد الشافي', 'عبد الحفيظ', 'عبد العليم', 'عبد المعطي', 'عبد النبي',
    'عبد الحي',
  ],
};

const FAMILY: NamePool = {
  common: [
    'السيد', 'علي', 'حسن', 'إبراهيم', 'عبد الله', 'عبد الرحمن',
    'عبد العزيز', 'المصري', 'الشافعي', 'الدسوقي', 'الشرقاوي', 'الشريف',
    'النجار', 'الحداد', 'منصور', 'سلامة', 'مراد', 'كامل', 'خليل', 'غانم',
    'فهمي', 'يونس', 'موسى', 'عوض', 'درويش', 'زكي',
  ],
  standard: [
    'فؤاد', 'عبد المنعم', 'الشاذلي', 'البحيري', 'المنوفي', 'الجيزاوي',
    'البحراوي', 'البدري', 'القاضي', 'الزيات', 'صبري', 'رضوان',
    'أبو النصر', 'أبو زيد', 'عبد الغني', 'عبد المطلب', 'عبد العال',
    'عبد الستار', 'عبد الوهاب', 'الجندي', 'الأنصاري', 'الشناوي', 'البرعي',
    'الفقي', 'السقا', 'العطار', 'حجازي', 'حماد', 'أبو العزم', 'زهران',
    'أبو طالب', 'الطحاوي', 'بهجت', 'البنا', 'فرج', 'لطفي', 'عبد السلام',
    'شحاتة', 'عبد المقصود', 'عبد الجواد', 'المليجي', 'البسيوني',
    'الشربيني', 'البكري', 'القناوي', 'الجمال', 'عبد الحميد', 'السعيد',
    'قنديل', 'رشاد', 'علام', 'خفاجي',
  ],
  rare: [
    'البهي', 'الحسيني', 'العدوي', 'الصاوي', 'الهواري', 'الغمراوي',
    'أبو سريع', 'السمان', 'الخميسي', 'الطوخي', 'البلتاجي', 'الدمرداش',
    'السنهوري', 'العقاد', 'الباز', 'عفيفي', 'الغريب', 'سرحان', 'شلبي',
    'خاطر', 'عامر', 'بدوي', 'هلال', 'نوفل', 'عبده', 'السباعي', 'الديب',
    'الخولي', 'العشماوي', 'مرزوق', 'الكفراوي', 'النحاس', 'الطنطاوي',
    'النواوي', 'الخواجة', 'الجوهري', 'الرفاعي', 'أبو حطب', 'الششتاوي',
  ],
};
