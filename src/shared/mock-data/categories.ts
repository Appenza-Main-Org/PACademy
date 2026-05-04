/**
 * Applicant categories — Post-polish (Bucket B1).
 *
 * Source: stakeholder document كلية_الشرطة_الاقسام_والشروط — 7 faculty
 * departments with verbatim Arabic labels, conditions, and required-test
 * sequences. Departments 4-7 are nomination-only (ترشيح) — they appear in
 * admin config but the public CategorySelectionPage filters them out.
 *
 * IMPORTANT: every Arabic string is copy-pasted from the spec or the
 * project brief. Do not retype — Arabic rendering edge cases bite.
 */

import type {
  ApplicantCategory,
  CategoryCondition,
  RequiredTest,
} from '@/shared/types/domain';

const baseConditions = (overrides: Partial<CategoryCondition>): CategoryCondition => ({
  ageMin: null,
  ageMax: null,
  minScorePercent: null,
  requiredQualification: 'any',
  gender: 'any',
  minHeightCm: null,
  medicalRequired: false,
  maritalStatus: 'any',
  conductCheck: false,
  egyptianNationalityRequired: false,
  employerApprovalRequired: false,
  nominationOnly: false,
  freeText: [],
  ...overrides,
});

const t = (kind: RequiredTest['kind'], order: number, passingCriteria = ''): RequiredTest => ({
  kind,
  order,
  passingCriteria,
});

export const APPLICANT_CATEGORIES: readonly ApplicantCategory[] = [
  {
    key: 'officers_general',
    labelAr: 'قسم الضباط (القسم العام)',
    labelEn: 'General Officers Department',
    description: 'الالتحاق بكلية الشرطة عبر القسم العام لخريجي الثانوية العامة',
    isOpen: true,
    conditions: baseConditions({
      requiredQualification: 'thanaweya_amma',
      gender: 'male',
      minHeightCm: 170,
      medicalRequired: true,
      maritalStatus: 'single',
      conductCheck: true,
      egyptianNationalityRequired: true,
      freeText: ['مجموع مناسب في الثانوية العامة'],
    }),
    requiredTests: [
      t('aptitude', 1),
      t('posture', 2),
      t('medical', 3),
      t('physical', 4),
      t('psychological', 5),
      t('interview', 6),
      t('drug', 7),
    ],
    procedures: [],
  },
  {
    key: 'officers_specialized',
    labelAr: 'قسم الضباط المتخصصين',
    labelEn: 'Specialized Officers Department',
    description: 'الالتحاق لخريجي الجامعات في تخصصات حقوق وطب وهندسة وإعلام وغيرها',
    isOpen: true,
    conditions: baseConditions({
      requiredQualification: 'bachelor',
      ageMax: 28,
      medicalRequired: true,
      conductCheck: true,
      freeText: [
        'مؤهل عالي (حقوق / طب / هندسة / إعلام…)',
        'تقدير مناسب (جيد على الأقل)',
        'حسن السمعة',
      ],
    }),
    requiredTests: [
      t('posture', 1),
      t('medical', 2),
      t('physical', 3),
      t('psychological', 4),
      t('interview', 5),
      t('drug', 6),
    ],
    procedures: [],
  },
  {
    key: 'postgraduate',
    labelAr: 'الدراسات العليا',
    labelEn: 'Postgraduate Studies',
    description: 'برامج الدراسات العليا لخريجي كلية الشرطة والجهات المرتبطة',
    isOpen: true,
    conditions: baseConditions({
      requiredQualification: 'police_academy_grad',
      employerApprovalRequired: true,
      freeText: [
        'خريج كلية الشرطة أو جهة مرتبطة',
        'موافقة جهة العمل',
        'تقدير مناسب',
      ],
    }),
    requiredTests: [],
    procedures: ['تقديم الأوراق', 'مقابلة شخصية (أحياناً)', 'مراجعة أمنية'],
  },
  {
    key: 'institute_officers_training',
    labelAr: 'معهد تدريب الضباط',
    labelEn: 'Officers Training Institute',
    description: 'برامج تدريبية متخصصة لضباط الشرطة (بالترشيح)',
    isOpen: true,
    conditions: baseConditions({
      requiredQualification: 'serving_officer',
      nominationOnly: true,
      freeText: ['أن يكون ضابط شرطة'],
    }),
    requiredTests: [],
    procedures: ['ترشيح', 'برامج تدريبية'],
  },
  {
    key: 'institute_traffic',
    labelAr: 'معهد المرور',
    labelEn: 'Traffic Institute',
    description: 'دورات تخصصية في إدارة المرور (بالترشيح)',
    isOpen: true,
    conditions: baseConditions({
      requiredQualification: 'serving_officer',
      nominationOnly: true,
      freeText: ['ضباط شرطة'],
    }),
    requiredTests: [],
    procedures: ['ترشيح', 'دورات تخصصية'],
  },
  {
    key: 'institute_guarding',
    labelAr: 'معهد الحراسات والتأمين',
    labelEn: 'Guarding & Security Institute',
    description: 'تأهيل ضباط الشرطة في الحراسات والتأمين (بالترشيح)',
    isOpen: true,
    conditions: baseConditions({
      requiredQualification: 'serving_officer',
      nominationOnly: true,
      freeText: ['ضباط شرطة'],
    }),
    requiredTests: [
      t('aptitude', 1, 'اختبارات لياقة'),
      t('security_training', 2, 'تدريب على التأمين'),
    ],
    procedures: [],
  },
  {
    key: 'special_units',
    labelAr: 'الوحدات الخاصة',
    labelEn: 'Special Units',
    description: 'تأهيل ضباط الوحدات الخاصة بمستوى بدني وذهني عالي (بالترشيح)',
    isOpen: true,
    conditions: baseConditions({
      requiredQualification: 'serving_officer',
      nominationOnly: true,
      freeText: ['ضباط بمستوى بدني عالي'],
    }),
    requiredTests: [
      t('physical', 1, 'اختبارات بدنية قوية'),
      t('psychological', 2, 'تحمل نفسي'),
      t('tactical_training', 3, 'تدريب تكتيكي'),
    ],
    procedures: [],
  },
];

/** The cycle that the public applicant flow points at. */
export const ACTIVE_CYCLE_ID = 'CYC-2026-M';
