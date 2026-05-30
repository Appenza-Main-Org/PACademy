/**
 * Convert the backend eligible academic-program verdict into the exact
 * faculty/specialization rows the applicant may choose from.
 *
 * Example:
 * ```ts
 * const pickerOptions = toSpecializedProgramPickerOptions(verdict.academicPrograms);
 * ```
 */

import type { FacultyRow, SpecializationRow } from '@/features/lookups';
import type { ApplicantCategoryEligibility } from '../api/categories.service';

type AcademicProgram = ApplicantCategoryEligibility['academicPrograms'][number];

export interface SpecializedProgramPickerOptions {
  faculties: FacultyRow[];
  specializations: SpecializationRow[];
}

export function toSpecializedProgramPickerOptions(
  programs: readonly AcademicProgram[],
): SpecializedProgramPickerOptions {
  const facultyByCode = new Map<string, FacultyRow>();
  const specializationByCode = new Map<string, SpecializationRow>();

  for (const program of programs) {
    if (!facultyByCode.has(program.facultyCode)) {
      facultyByCode.set(program.facultyCode, {
        code: program.facultyCode,
        name: program.facultyName,
        isActive: true,
      });
    }

    if (!specializationByCode.has(program.specializationCode)) {
      specializationByCode.set(program.specializationCode, {
        code: program.specializationCode,
        name: program.specializationName,
        isActive: true,
        facultyCode: program.facultyCode,
      });
    }
  }

  return {
    faculties: [...facultyByCode.values()],
    specializations: [...specializationByCode.values()],
  };
}
