/**
 * Seed for the expired-window demo applicant (NID `30501010203456`).
 *
 * Renders a fully-filled قسم-عام document so the client can validate the
 * locked view-and-print path immediately at login. Names mirror the
 * Stage 7 demo pattern (Arabic-natural). No PII — these are fabricated.
 */

import {
  emptyDocument,
  type AdultRelativeRecord,
  type ForeignEmployedRelativeRecord,
  type GrandparentRecord,
  type NaturalizedRelativeRecord,
  type RelativeChildRecord,
  type RelativeList,
  type VothiqaTaarufDocument,
} from './vothiqaTaaruf.types';

function grandparent(
  fullName: string,
  shuhraName: string,
  dob: string,
  alive: 'alive' | 'deceased',
): GrandparentRecord {
  return {
    fullName,
    shuhraName,
    dateOfBirth: dob,
    birthPlace: 'الجيزة',
    governorate: 'الجيزة',
    nationality: 'مصرية',
    religion: 'مسلم',
    alive,
    nationalId: alive === 'alive' ? '25001010103456' : '',
    nidUnavailable: false,
    nidUnavailableReason: '',
    qualification: 'بكالوريوس تجارة',
    profession: 'متقاعد',
    seniorityNumber: '',
    workplace: 'متقاعد',
    workNature: 'متقاعد',
    address: 'الجيزة — المهندسين — 14 شارع البطل أحمد عبد العزيز',
  };
}

function adult(
  name: string,
  dob: string,
  qualification: string,
  profession: string,
  spouseName = '',
  married = true,
): AdultRelativeRecord {
  return {
    name,
    dateOfBirth: dob,
    birthPlace: 'الجيزة',
    qualification,
    profession,
    seniorityNumber: '',
    workplace: 'هيئة قناة السويس',
    nationalId: '29001010103456',
    maritalStatus: married ? 'متزوج' : 'أعزب',
    address: 'الجيزة — المهندسين',
    spouseName,
    deceased: false,
  };
}

function child(
  name: string,
  dob: string,
  qualification = 'طالب',
  profession = 'طالب',
): RelativeChildRecord {
  return {
    name,
    dateOfBirth: dob,
    birthPlace: 'الجيزة',
    qualification,
    profession,
    seniorityNumber: '',
    workplace: '',
    nationalId: '',
    maritalStatus: 'أعزب',
    address: 'الجيزة — المهندسين',
    spouseName: '',
    deceased: false,
  };
}

function listOf<T>(items: T[]): RelativeList<T> {
  return { none: false, items };
}

function noneList<T>(): RelativeList<T> {
  return { none: true, items: [] };
}

const APPLICANT_NID = '30501010203456';
const APPLICANT_DOB = '2005-01-01';

export const EXPIRED_DEMO_DOCUMENT: VothiqaTaarufDocument = (() => {
  const doc = emptyDocument();

  /* Cover + personal */
  doc.personal.cover = {
    fullName: 'سليم أيمن نادر الخطيب',
    fileNumber: '2026-0731',
    admissionYear: '2026',
    committee: 'لجنة قسم عام · رقم 4',
    governorate: 'الجيزة',
  };
  doc.personal.personal = {
    fullName: 'سليم أيمن نادر الخطيب',
    fileNumber: '2026-0731',
    shuhraName: 'سليم الخطيب',
    committee: 'لجنة قسم عام · رقم 4',
    dateOfBirth: APPLICANT_DOB,
    nationality: 'مصرية',
    governorate: 'الجيزة',
    birthPlace: 'الدقي',
    religion: 'مسلم',
    nationalId: APPLICANT_NID,
    qualificationOrTrack: 'ثانوية عامة — علمي علوم',
    qualificationYear: '2024',
    totalGrades: '395',
    gradesPercent: '96.34',
    homePhone: '0233334455',
    mobile: '01098765432',
    maritalStatus: 'single',
    address: 'الجيزة — المهندسين — 14 شارع البطل أحمد عبد العزيز',
  };
  doc.personal.housing = {
    housingType: 'تمليك العائلة',
    roomsCount: '5',
    residentsCount: '6',
  };
  doc.personal.income = {
    incomeDetails: 'دخل ثابت من معاش الوالد بعد التقاعد، بالإضافة إلى دخل تجاري بسيط من ورشة الأسرة بمدينة 6 أكتوبر.',
    totalIncome: '18,000 جنيه شهرياً',
  };

  /* Parents (نموذج 2) */
  doc.parents.father = {
    fullName: 'محمود فؤاد العقّاد عبد الرحمن',
    shuhraName: 'محمود العقّاد',
    dateOfBirth: '1975-04-12',
    birthPlace: 'الجيزة',
    qualification: 'بكالوريوس تجارة — جامعة القاهرة',
    profession: 'موظف حكومي',
    seniorityNumber: '',
    workplace: 'وزارة المالية — الإدارة المركزية',
    workNature: 'محاسب أول',
    address: 'الجيزة — المهندسين — 14 شارع البطل أحمد عبد العزيز',
    homePhone: '0233334455',
    mobile: '01112345678',
    nationalId: '27504120103456',
    deceased: false,
    hasCurrentWife: false,
    currentWifeCount: '0',
    currentWife: {
      fullName: '', dateOfBirth: '', nationalId: '', qualification: '',
      birthPlace: '', profession: '', seniorityNumber: '', workplace: '', workNature: '',
    },
  };
  doc.parents.guardian = {
    fullName: '', shuhraName: '', dateOfBirth: '', birthPlace: '',
    qualification: '', profession: '', seniorityNumber: '', workplace: '', workNature: '',
    address: '', nationality: 'مصرية', governorate: '', religion: '',
    nationalId: '', mobile: '',
  };
  /* Mother (نموذج 4) */
  doc.parents.mother = {
    fullName: 'هدى علي محمد البحيري',
    dateOfBirth: '1978-08-20',
    birthPlace: 'الإسكندرية',
    nationality: 'مصرية',
    qualification: 'ليسانس آداب — جامعة الإسكندرية',
    religion: 'مسلم',
    profession: 'معلّمة',
    seniorityNumber: '',
    workplace: 'مدرسة المهندسين الثانوية بنات',
    workNature: 'معلّمة لغة عربية',
    address: 'الجيزة — المهندسين — 14 شارع البطل أحمد عبد العزيز',
    homePhone: '0233334455',
    mobile: '01223344556',
    nationalId: '27808200203456',
    deceased: false,
    hasCurrentHusband: false,
    currentHusbandCount: '0',
    currentHusband: {
      fullName: '', dateOfBirth: '', nationalId: '', qualification: '',
      birthPlace: '', profession: '', seniorityNumber: '', workplace: '', workNature: '',
    },
  };

  /* Grandparents (نموذج 7-10) */
  doc.grandparents.paternalGrandfather = grandparent('فؤاد العقّاد عبد الرحمن سليم', 'فؤاد العقّاد', '1948-02-10', 'deceased');
  doc.grandparents.paternalGrandmother = grandparent('نجوى سعيد إبراهيم الشاذلي', 'نجوى الشاذلي', '1952-06-25', 'alive');
  doc.grandparents.maternalGrandfather = grandparent('علي محمد البحيري حسن', 'علي البحيري', '1946-11-30', 'deceased');
  doc.grandparents.maternalGrandmother = grandparent('سامية حسن طه عوض', 'سامية عوض', '1955-03-18', 'alive');

  /* Siblings (نموذج 11-16) */
  doc.siblings.fullBrothers = listOf<AdultRelativeRecord>([
    adult('عمر محمود فؤاد العقّاد', '2000-05-05', 'بكالوريوس هندسة', 'مهندس مدني', 'مريم أحمد سامي'),
    adult('يوسف محمود فؤاد العقّاد', '2002-09-12', 'بكالوريوس تجارة', 'محاسب', '', false),
  ]);
  doc.siblings.halfBrothers = noneList();
  doc.siblings.brothersSons = listOf<RelativeChildRecord>([
    child('آدم عمر محمود العقّاد', '2024-11-03'),
  ]);
  doc.siblings.brothersDaughters = noneList();
  doc.siblings.fullSisters = listOf<AdultRelativeRecord>([
    adult('سلمى محمود فؤاد العقّاد', '1998-01-22', 'ليسانس حقوق', 'محامية', 'أحمد خالد سامي'),
  ]);
  doc.siblings.halfSisters = noneList();
  doc.siblings.sistersSons = listOf<RelativeChildRecord>([
    child('عبد الرحمن أحمد خالد', '2022-04-15'),
  ]);
  doc.siblings.sistersDaughters = noneList();

  /* Paternal relatives (نموذج 17-19 + 23-25) */
  doc.paternalRelatives.paternalUncles = listOf<AdultRelativeRecord>([
    adult('عبد الله فؤاد العقّاد عبد الرحمن', '1972-07-04', 'بكالوريوس تجارة', 'تاجر', 'منى أحمد محمود'),
  ]);
  doc.paternalRelatives.paternalUnclesSons = listOf<RelativeChildRecord>([
    child('محمد عبد الله فؤاد', '2003-12-10', 'طالب جامعي', 'طالب'),
  ]);
  doc.paternalRelatives.paternalUnclesDaughters = noneList();
  doc.paternalRelatives.paternalAunts = listOf<AdultRelativeRecord>([
    adult('فاطمة فؤاد العقّاد عبد الرحمن', '1970-03-19', 'ليسانس آداب', 'ربة منزل', 'حسام محمد طه'),
  ]);
  doc.paternalRelatives.paternalAuntsSons = noneList();
  doc.paternalRelatives.paternalAuntsDaughters = listOf<RelativeChildRecord>([
    child('هنا حسام محمد طه', '2005-08-21', 'طالبة جامعية', 'طالبة'),
  ]);

  /* Maternal relatives (نموذج 20-22 + 26-28) */
  doc.maternalRelatives.maternalUncles = listOf<AdultRelativeRecord>([
    adult('عماد علي البحيري', '1975-06-30', 'بكالوريوس طب', 'طبيب', 'دينا سامي إبراهيم'),
  ]);
  doc.maternalRelatives.maternalUnclesSons = noneList();
  doc.maternalRelatives.maternalUnclesDaughters = listOf<RelativeChildRecord>([
    child('ليلى عماد علي البحيري', '2006-02-14', 'طالبة', 'طالبة'),
  ]);
  doc.maternalRelatives.maternalAunts = listOf<AdultRelativeRecord>([
    adult('ميرفت علي البحيري', '1980-09-09', 'ليسانس تربية', 'معلّمة', 'كريم محسن عبد الله'),
  ]);
  doc.maternalRelatives.maternalAuntsSons = noneList();
  doc.maternalRelatives.maternalAuntsDaughters = noneList();

  /* Foreign + naturalized + criminal cases (نموذج 29-31) — all empty
   * but explicitly marked «لا يوجد» so the print pages render the empty
   * table rather than dropping them. */
  doc.foreignAndCases.foreignEmployed = noneList<ForeignEmployedRelativeRecord>();
  doc.foreignAndCases.naturalized = noneList<NaturalizedRelativeRecord>();
  doc.foreignAndCases.criminalCases = noneList();

  return doc;
})();

export const EXPIRED_DEMO_NID = APPLICANT_NID;
