import type {
  AcademicGradeRow,
  FacultyRow,
  SpecializationRow,
} from '@/features/lookups';
import type { AcademicDegreeValue } from './profile-options';

interface AcademicProgramLike {
  facultyCode: string;
  facultyName: string;
  specializationCode: string;
  specializationName: string;
}

interface UniversityEligibilityLike {
  academicPrograms?: readonly AcademicProgramLike[];
  allowedAcademicGradeCodes?: readonly string[];
}

export interface QualificationSelectOption {
  value: string;
  label: string;
}

export function shouldShowUniversityQualificationFields(
  qualificationLevel: '' | AcademicDegreeValue,
): boolean {
  return qualificationLevel !== '';
}

export function shouldShowPostgraduateQualificationFields(
  qualificationLevel: '' | AcademicDegreeValue,
): boolean {
  return qualificationLevel === 'master' || qualificationLevel === 'doctorate';
}

export function buildCycleFacultyOptions(
  rows: readonly Pick<FacultyRow, 'code' | 'name' | 'isActive'>[],
  eligibility: UniversityEligibilityLike | null | undefined,
): QualificationSelectOption[] {
  const programs = eligibility?.academicPrograms ?? [];
  if (programs.length === 0) {
    return rows
      .filter((row) => row.isActive)
      .map((row) => ({ value: row.name, label: row.name }));
  }

  const activeCodes = new Set(rows.filter((row) => row.isActive).map((row) => row.code));
  return uniqueOptions(
    programs
      .filter((program) => activeCodes.size === 0 || activeCodes.has(program.facultyCode))
      .map((program) => ({ value: program.facultyName, label: program.facultyName })),
  );
}

export function buildCycleSpecializationOptions(
  rows: readonly Pick<SpecializationRow, 'code' | 'name' | 'isActive' | 'facultyCode'>[],
  eligibility: UniversityEligibilityLike | null | undefined,
  selectedFacultyName: string | null | undefined,
  selectedFacultyCode?: string | null,
): QualificationSelectOption[] {
  if (!selectedFacultyName && !selectedFacultyCode) return [];

  const programs = eligibility?.academicPrograms ?? [];
  if (programs.length > 0) {
    return uniqueOptions(
      programs
        .filter(
          (program) =>
            program.facultyName === selectedFacultyName ||
            program.facultyCode === selectedFacultyCode,
        )
        .map((program) => ({
          value: program.specializationName,
          label: program.specializationName,
        })),
    );
  }

  return rows
    .filter((row) => row.isActive && row.facultyCode === selectedFacultyCode)
    .map((row) => ({ value: row.name, label: row.name }));
}

export function buildCycleAcademicGradeOptions(
  rows: readonly Pick<AcademicGradeRow, 'code' | 'name' | 'isActive'>[],
  eligibility: UniversityEligibilityLike | null | undefined,
): QualificationSelectOption[] {
  const allowed = new Set(eligibility?.allowedAcademicGradeCodes ?? []);
  return rows
    .filter((row) => row.isActive)
    .filter((row) => allowed.size === 0 || allowed.has(row.code))
    .map((row) => ({ value: row.name, label: row.name }));
}

function uniqueOptions(
  options: readonly QualificationSelectOption[],
): QualificationSelectOption[] {
  const seen = new Set<string>();
  const out: QualificationSelectOption[] = [];
  for (const option of options) {
    if (seen.has(option.value)) continue;
    seen.add(option.value);
    out.push(option);
  }
  return out;
}
