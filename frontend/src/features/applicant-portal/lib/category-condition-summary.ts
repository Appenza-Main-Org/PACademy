import type { CategoryCondition } from '@/shared/types/domain';

export const CATEGORY_QUALIFICATION_LABEL: Record<CategoryCondition['requiredQualification'], string> = {
  thanaweya_amma: 'الثانوية العامة',
  azhar: 'الثانوية الأزهرية',
  bachelor: 'مؤهل عالي',
  bachelor_law: 'بكالوريوس حقوق',
  bachelor_medicine: 'بكالوريوس طب',
  bachelor_engineering: 'بكالوريوس هندسة',
  bachelor_media: 'بكالوريوس إعلام',
  police_academy_grad: 'خريج كلية الشرطة',
  serving_officer: 'ضابط شرطة',
  any: 'أي مؤهل معتمد',
};

export function summariseCategoryConditions(conditions: CategoryCondition): string[] {
  const lines: string[] = [];
  if (conditions.egyptianNationalityRequired) lines.push('مصري الجنسية ومن أب وأم مصريين');
  if (conditions.conductCheck) lines.push('حسن السير والسلوك');
  if (conditions.maritalStatus === 'single') lines.push('غير متزوج');
  if (conditions.medicalRequired) lines.push('لائق طبياً');
  if (conditions.minHeightCm !== null) lines.push(`الطول لا يقل عن ${conditions.minHeightCm} سم`);
  if (conditions.ageMax !== null && conditions.ageMin !== null) {
    lines.push(`السن من ${conditions.ageMin} إلى ${conditions.ageMax} سنة`);
  } else if (conditions.ageMax !== null) {
    lines.push(`السن حتى ${conditions.ageMax} سنة`);
  } else if (conditions.ageMin !== null) {
    lines.push(`السن لا يقل عن ${conditions.ageMin} سنة`);
  }
  if (conditions.requiredQualification !== 'any') {
    lines.push(CATEGORY_QUALIFICATION_LABEL[conditions.requiredQualification]);
  }
  if (conditions.minScorePercent !== null) {
    lines.push(`الحد الأدنى لمجموع المؤهل: ${conditions.minScorePercent}%`);
  }
  if (conditions.employerApprovalRequired) lines.push('موافقة جهة العمل');
  if (conditions.gender === 'female') lines.push('للإناث فقط');
  if (conditions.gender === 'male') lines.push('للذكور فقط');
  return lines;
}
