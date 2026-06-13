/**
 * TanStack Query hooks over educationFields.service — see the service's
 * INTEGRATION CONTRACT header.
 */

import { useQuery } from '@tanstack/react-query';
import { educationFieldsService } from './educationFields.service';

export const educationFieldKeys = {
  all: ['category-education-fields'] as const,
  byCategory: (categoryKey: string) => [...educationFieldKeys.all, categoryKey] as const,
};

/** Education score-field config for one applicant category. */
export function useCategoryEducationFields(categoryKey: string | null) {
  return useQuery({
    queryKey: educationFieldKeys.byCategory(categoryKey ?? ''),
    queryFn: () => educationFieldsService.listByCategory(categoryKey ?? ''),
    enabled: Boolean(categoryKey),
  });
}
