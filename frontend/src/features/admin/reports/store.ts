import { create } from 'zustand';
import type { ReportsFilters } from './types';

type ReportsFiltersState = {
  filters: ReportsFilters;
  set: (patch: Partial<ReportsFilters>) => void;
  reset: () => void;
};

export const useReportsFiltersStore = create<ReportsFiltersState>((set) => ({
  filters: { committeeId: 'all' },
  set: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  reset: () => set((state) => ({ filters: { cycleId: state.filters.cycleId, committeeId: 'all' } })),
}));
