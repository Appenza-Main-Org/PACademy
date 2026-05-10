/**
 * useAdmissionSetupCycle — sticky cycle context for the 15 step pages.
 *
 * Defaults to the active cycle (from Gap F's cycle service) and persists
 * the selection in `sessionStorage` under `pa-admission-setup-cycle` so it
 * survives navigation between steps until the session ends. Switching the
 * cycle re-fetches all step status pills automatically (TanStack Query
 * keys include the cycle id where needed).
 */

import { useEffect, useMemo, useState } from 'react';
import { useActiveCycle, useCycles } from '@/features/admin/api/cycles.queries';
import type { AdmissionCycle } from '@/shared/types/domain';
import { ADMISSION_SETUP_CYCLE_STORAGE_KEY } from '../config';

export interface AdmissionSetupCycleContext {
  cycle: AdmissionCycle | null;
  setCycle: (id: string | null) => void;
  availableCycles: AdmissionCycle[];
  isLoading: boolean;
  /** True until both the active-cycle and cycle-list queries have resolved at least once. */
  isInitialised: boolean;
}

function readPersisted(): string | null {
  try {
    return sessionStorage.getItem(ADMISSION_SETUP_CYCLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writePersisted(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(ADMISSION_SETUP_CYCLE_STORAGE_KEY, id);
    else sessionStorage.removeItem(ADMISSION_SETUP_CYCLE_STORAGE_KEY);
  } catch {
    /* sessionStorage not available — fall back to in-memory state. */
  }
}

export function useAdmissionSetupCycle(): AdmissionSetupCycleContext {
  const activeQuery = useActiveCycle();
  const listQuery = useCycles();
  const available = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const [selectedId, setSelectedId] = useState<string | null>(() => readPersisted());

  /* Once the active cycle resolves, prefer it as the default if no
   * persisted choice exists. Avoid clobbering an explicit pick. */
  useEffect(() => {
    if (selectedId !== null) return;
    if (activeQuery.data) {
      setSelectedId(activeQuery.data.id);
      return;
    }
    /* No active cycle — fall back to the most recent draft/active in the list. */
    if (available.length > 0) {
      setSelectedId(available[0].id);
    }
  }, [activeQuery.data, available, selectedId]);

  const setCycle = (id: string | null): void => {
    setSelectedId(id);
    writePersisted(id);
  };

  const cycle = selectedId ? available.find((c) => c.id === selectedId) ?? null : null;

  return {
    cycle,
    setCycle,
    availableCycles: available,
    isLoading: activeQuery.isLoading || listQuery.isLoading,
    isInitialised: !activeQuery.isLoading && !listQuery.isLoading,
  };
}
