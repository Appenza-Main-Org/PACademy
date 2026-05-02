/**
 * Reference data mock — Sprint 1 (Tasks/KARASA_GAPS.md §1.2.B).
 *
 * Eight reference dictionaries used across the platform. All entries are
 * deterministic (no rng() — fixed lists) so the admin can demonstrate the
 * CRUD + bulk-import flows without flaky data.
 */

import type {
  RefCaseType,
  RefCollege,
  RefGovernorate,
  RefNationality,
  RefQualification,
  RefRank,
  RefRelationship,
  RefSpecialization,
  ReferenceRowMap,
  ReferenceTab,
} from '@/shared/types/domain';

export const REF_GOVERNORATES: readonly RefGovernorate[] = [
  { id: 'GOV-01', nameAr: 'القاهرة',          nameEn: 'Cairo',         region: 'cairo',    active: true },
  { id: 'GOV-02', nameAr: 'الجيزة',           nameEn: 'Giza',          region: 'cairo',    active: true },
  { id: 'GOV-03', nameAr: 'الإسكندرية',       nameEn: 'Alexandria',    region: 'delta',    active: true },
  { id: 'GOV-04', nameAr: 'الدقهلية',          nameEn: 'Dakahlia',      region: 'delta',    active: true },
  { id: 'GOV-05', nameAr: 'الشرقية',          nameEn: 'Sharqia',       region: 'delta',    active: true },
  { id: 'GOV-06', nameAr: 'المنوفية',         nameEn: 'Monufia',       region: 'delta',    active: true },
  { id: 'GOV-07', nameAr: 'القليوبية',         nameEn: 'Qaliubiya',     region: 'cairo',    active: true },
  { id: 'GOV-08', nameAr: 'بني سويف',         nameEn: 'Beni Suef',     region: 'upper',    active: true },
  { id: 'GOV-09', nameAr: 'الفيوم',            nameEn: 'Fayoum',        region: 'upper',    active: true },
  { id: 'GOV-10', nameAr: 'المنيا',            nameEn: 'Minya',         region: 'upper',    active: true },
  { id: 'GOV-11', nameAr: 'أسيوط',            nameEn: 'Asyut',         region: 'upper',    active: true },
  { id: 'GOV-12', nameAr: 'سوهاج',            nameEn: 'Sohag',         region: 'upper',    active: true },
  { id: 'GOV-13', nameAr: 'قنا',               nameEn: 'Qena',          region: 'upper',    active: true },
  { id: 'GOV-14', nameAr: 'أسوان',             nameEn: 'Aswan',         region: 'upper',    active: true },
  { id: 'GOV-15', nameAr: 'البحر الأحمر',     nameEn: 'Red Sea',       region: 'frontier', active: true },
  { id: 'GOV-16', nameAr: 'الوادي الجديد',    nameEn: 'New Valley',    region: 'frontier', active: true },
  { id: 'GOV-17', nameAr: 'مرسى مطروح',       nameEn: 'Matrouh',       region: 'frontier', active: true },
  { id: 'GOV-18', nameAr: 'شمال سيناء',       nameEn: 'North Sinai',   region: 'frontier', active: true },
  { id: 'GOV-19', nameAr: 'جنوب سيناء',       nameEn: 'South Sinai',   region: 'frontier', active: true },
  { id: 'GOV-20', nameAr: 'بورسعيد',          nameEn: 'Port Said',     region: 'canal',    active: true },
  { id: 'GOV-21', nameAr: 'دمياط',             nameEn: 'Damietta',      region: 'delta',    active: true },
  { id: 'GOV-22', nameAr: 'كفر الشيخ',         nameEn: 'Kafr El Sheikh', region: 'delta',   active: true },
  { id: 'GOV-23', nameAr: 'الغربية',          nameEn: 'Gharbia',       region: 'delta',    active: true },
  { id: 'GOV-24', nameAr: 'الإسماعيلية',      nameEn: 'Ismailia',      region: 'canal',    active: true },
  { id: 'GOV-25', nameAr: 'السويس',           nameEn: 'Suez',          region: 'canal',    active: true },
  { id: 'GOV-26', nameAr: 'الأقصر',            nameEn: 'Luxor',         region: 'upper',    active: true },
  { id: 'GOV-27', nameAr: 'البحيرة',           nameEn: 'Beheira',       region: 'delta',    active: true },
];

export const REF_SPECIALIZATIONS: readonly RefSpecialization[] = [
  { id: 'SPC-01', nameAr: 'علوم شرطة',        code: 'POL-SCI', facultyType: 'military', active: true },
  { id: 'SPC-02', nameAr: 'الأمن العام',       code: 'PUB-SEC', facultyType: 'military', active: true },
  { id: 'SPC-03', nameAr: 'الأمن المركزي',    code: 'CEN-SEC', facultyType: 'military', active: true },
  { id: 'SPC-04', nameAr: 'الأمن الإلكتروني',  code: 'CYB-SEC', facultyType: 'sciences', active: true },
  { id: 'SPC-05', nameAr: 'مكافحة المخدرات',   code: 'NARC',    facultyType: 'military', active: true },
  { id: 'SPC-06', nameAr: 'حماية الآداب',      code: 'MORALS',  facultyType: 'military', active: true },
  { id: 'SPC-07', nameAr: 'المرور',           code: 'TRAFFIC', facultyType: 'military', active: true },
  { id: 'SPC-08', nameAr: 'الجوازات والهجرة',  code: 'PASSPORT', facultyType: 'civil', active: true },
  { id: 'SPC-09', nameAr: 'الأحوال المدنية',   code: 'CIVIL',   facultyType: 'civil',    active: true },
  { id: 'SPC-10', nameAr: 'الإدارة العامة',    code: 'ADMIN',   facultyType: 'civil',    active: true },
  { id: 'SPC-11', nameAr: 'القانون',          code: 'LAW',     facultyType: 'sciences', active: true },
  { id: 'SPC-12', nameAr: 'علم النفس الجنائي', code: 'CRIM-PSY', facultyType: 'sciences', active: true },
];

export const REF_RANKS: readonly RefRank[] = [
  { id: 'RNK-01', nameAr: 'مساعد',          level: 1,  applicableTo: 'enlisted' },
  { id: 'RNK-02', nameAr: 'ملازم',           level: 2,  applicableTo: 'officer' },
  { id: 'RNK-03', nameAr: 'ملازم أول',       level: 3,  applicableTo: 'officer' },
  { id: 'RNK-04', nameAr: 'نقيب',           level: 4,  applicableTo: 'officer' },
  { id: 'RNK-05', nameAr: 'رائد',           level: 5,  applicableTo: 'officer' },
  { id: 'RNK-06', nameAr: 'مقدم',            level: 6,  applicableTo: 'officer' },
  { id: 'RNK-07', nameAr: 'عقيد',           level: 7,  applicableTo: 'officer' },
  { id: 'RNK-08', nameAr: 'عميد',           level: 8,  applicableTo: 'officer' },
  { id: 'RNK-09', nameAr: 'لواء',           level: 9,  applicableTo: 'officer' },
  { id: 'RNK-10', nameAr: 'مدني',           level: 0,  applicableTo: 'civilian' },
];

export const REF_COLLEGES: readonly RefCollege[] = [
  { id: 'COL-01', nameAr: 'كلية الشرطة',                    governorateId: 'GOV-02', type: 'public', active: true },
  { id: 'COL-02', nameAr: 'جامعة القاهرة',                  governorateId: 'GOV-01', type: 'public', active: true },
  { id: 'COL-03', nameAr: 'جامعة الإسكندرية',               governorateId: 'GOV-03', type: 'public', active: true },
  { id: 'COL-04', nameAr: 'جامعة عين شمس',                 governorateId: 'GOV-01', type: 'public', active: true },
  { id: 'COL-05', nameAr: 'جامعة الأزهر',                   governorateId: 'GOV-01', type: 'azhar',  active: true },
  { id: 'COL-06', nameAr: 'جامعة المنصورة',                 governorateId: 'GOV-04', type: 'public', active: true },
  { id: 'COL-07', nameAr: 'جامعة الزقازيق',                 governorateId: 'GOV-05', type: 'public', active: true },
  { id: 'COL-08', nameAr: 'جامعة المنيا',                   governorateId: 'GOV-10', type: 'public', active: true },
  { id: 'COL-09', nameAr: 'جامعة أسيوط',                    governorateId: 'GOV-11', type: 'public', active: true },
  { id: 'COL-10', nameAr: 'الجامعة الأمريكية بالقاهرة',     governorateId: 'GOV-01', type: 'private', active: true },
];

export const REF_QUALIFICATIONS: readonly RefQualification[] = [
  { id: 'QLF-01', nameAr: 'ثانوية عامة (علمي)',    level: 'diploma',  facultyRequired: false },
  { id: 'QLF-02', nameAr: 'ثانوية عامة (أدبي)',     level: 'diploma',  facultyRequired: false },
  { id: 'QLF-03', nameAr: 'ثانوية أزهرية',          level: 'diploma',  facultyRequired: false },
  { id: 'QLF-04', nameAr: 'دبلوم فني',              level: 'diploma',  facultyRequired: false },
  { id: 'QLF-05', nameAr: 'بكالوريوس',              level: 'bachelor', facultyRequired: true },
  { id: 'QLF-06', nameAr: 'ليسانس',                level: 'bachelor', facultyRequired: true },
  { id: 'QLF-07', nameAr: 'ماجستير',               level: 'master',   facultyRequired: true },
  { id: 'QLF-08', nameAr: 'دكتوراه',                level: 'phd',      facultyRequired: true },
];

export const REF_NATIONALITIES: readonly RefNationality[] = [
  { id: 'NAT-EG',  nameAr: 'مصري',         nameEn: 'Egyptian',     isoCode: 'EG' },
  { id: 'NAT-SA',  nameAr: 'سعودي',        nameEn: 'Saudi',        isoCode: 'SA' },
  { id: 'NAT-AE',  nameAr: 'إماراتي',      nameEn: 'Emirati',      isoCode: 'AE' },
  { id: 'NAT-KW',  nameAr: 'كويتي',        nameEn: 'Kuwaiti',      isoCode: 'KW' },
  { id: 'NAT-QA',  nameAr: 'قطري',          nameEn: 'Qatari',       isoCode: 'QA' },
  { id: 'NAT-BH',  nameAr: 'بحريني',       nameEn: 'Bahraini',     isoCode: 'BH' },
  { id: 'NAT-OM',  nameAr: 'عماني',        nameEn: 'Omani',        isoCode: 'OM' },
  { id: 'NAT-JO',  nameAr: 'أردني',        nameEn: 'Jordanian',    isoCode: 'JO' },
  { id: 'NAT-PS',  nameAr: 'فلسطيني',      nameEn: 'Palestinian',  isoCode: 'PS' },
  { id: 'NAT-SY',  nameAr: 'سوري',          nameEn: 'Syrian',       isoCode: 'SY' },
  { id: 'NAT-LB',  nameAr: 'لبناني',       nameEn: 'Lebanese',     isoCode: 'LB' },
  { id: 'NAT-IQ',  nameAr: 'عراقي',        nameEn: 'Iraqi',        isoCode: 'IQ' },
  { id: 'NAT-LY',  nameAr: 'ليبي',          nameEn: 'Libyan',       isoCode: 'LY' },
  { id: 'NAT-SD',  nameAr: 'سوداني',       nameEn: 'Sudanese',     isoCode: 'SD' },
];

export const REF_RELATIONSHIPS: readonly RefRelationship[] = [
  { id: 'REL-01', nameAr: 'الأب',                     degree: 1, side: 'paternal' },
  { id: 'REL-02', nameAr: 'الأم',                     degree: 1, side: 'maternal' },
  { id: 'REL-03', nameAr: 'الأخ الشقيق',              degree: 1, side: 'self' },
  { id: 'REL-04', nameAr: 'الأخت الشقيقة',           degree: 1, side: 'self' },
  { id: 'REL-05', nameAr: 'الجد لأب',                  degree: 2, side: 'paternal' },
  { id: 'REL-06', nameAr: 'الجدة لأب',                 degree: 2, side: 'paternal' },
  { id: 'REL-07', nameAr: 'الجد لأم',                  degree: 2, side: 'maternal' },
  { id: 'REL-08', nameAr: 'الجدة لأم',                 degree: 2, side: 'maternal' },
  { id: 'REL-09', nameAr: 'العم',                     degree: 3, side: 'paternal' },
  { id: 'REL-10', nameAr: 'العمة',                     degree: 3, side: 'paternal' },
  { id: 'REL-11', nameAr: 'الخال',                     degree: 3, side: 'maternal' },
  { id: 'REL-12', nameAr: 'الخالة',                    degree: 3, side: 'maternal' },
  { id: 'REL-13', nameAr: 'الزوج/الزوجة',             degree: 1, side: 'spouse' },
  { id: 'REL-14', nameAr: 'ابن الأخ/الأخت',          degree: 4, side: 'self' },
];

export const REF_CASE_TYPES: readonly RefCaseType[] = [
  { id: 'CSE-01', nameAr: 'قضية جنحة',                  severity: 'low',    blocksApplication: false },
  { id: 'CSE-02', nameAr: 'قضية مدنية',                 severity: 'low',    blocksApplication: false },
  { id: 'CSE-03', nameAr: 'قضية أحوال شخصية',           severity: 'low',    blocksApplication: false },
  { id: 'CSE-04', nameAr: 'قضية مالية',                 severity: 'medium', blocksApplication: false },
  { id: 'CSE-05', nameAr: 'قضية مخدرات (متهم)',         severity: 'high',   blocksApplication: true },
  { id: 'CSE-06', nameAr: 'قضية أمن دولة',               severity: 'high',   blocksApplication: true },
  { id: 'CSE-07', nameAr: 'قضية إرهاب',                 severity: 'high',   blocksApplication: true },
  { id: 'CSE-08', nameAr: 'قضية فساد إداري',           severity: 'high',   blocksApplication: true },
  { id: 'CSE-09', nameAr: 'مخالفة مرورية',              severity: 'low',    blocksApplication: false },
  { id: 'CSE-10', nameAr: 'قضية عمالية',                 severity: 'medium', blocksApplication: false },
];

export const REFERENCE_DATA: { [K in ReferenceTab]: readonly ReferenceRowMap[K][] } = {
  governorates: REF_GOVERNORATES,
  specializations: REF_SPECIALIZATIONS,
  ranks: REF_RANKS,
  colleges: REF_COLLEGES,
  qualifications: REF_QUALIFICATIONS,
  nationalities: REF_NATIONALITIES,
  relationships: REF_RELATIONSHIPS,
  'case-types': REF_CASE_TYPES,
};

export const REFERENCE_TAB_LABELS: Record<ReferenceTab, string> = {
  governorates: 'المحافظات',
  specializations: 'التخصصات',
  ranks: 'الرتب العسكرية',
  colleges: 'الكليات',
  qualifications: 'المؤهلات الدراسية',
  nationalities: 'الجنسيات',
  relationships: 'درجات القرابة',
  'case-types': 'أنواع القضايا',
};
