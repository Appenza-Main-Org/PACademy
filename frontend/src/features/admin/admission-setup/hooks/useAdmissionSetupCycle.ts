/**
 * useAdmissionSetupCycle — sticky cycle context for the 15 step pages.
 *
 * Defaults to the active cycle (from Gap F's cycle service) and persists
 * the selection in `sessionStorage` under `pa-admission-setup-cycle` so it
 * survives navigation between steps until the session ends. Switching the
 * cycle re-fetches all step status pills automatically (TanStack Query
 * keys include the cycle id where needed).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCycleId = searchParams.get('cycleId');
  const initialSelectedRef = useRef<string | null>(urlCycleId ?? readPersisted());
  const [selectedId, setSelectedId] = useState<string | null>(() => initialSelectedRef.current);
  const activeQuery = useActiveCycle(selectedId === null);
  const listQuery = useCycles();
  const available = listQuery.data ?? [];

  const updateSelection = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      writePersisted(id);
      const next = new URLSearchParams(searchParams);
      if (id) next.set('cycleId', id);
      else next.delete('cycleId');
      if (next.toString() === searchParams.toString()) return;
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!urlCycleId || urlCycleId === selectedId) return;
    setSelectedId(urlCycleId);
    writePersisted(urlCycleId);
  }, [selectedId, urlCycleId]);

  useEffect(() => {
    if (!selectedId || urlCycleId) return;
    updateSelection(selectedId);
  }, [selectedId, updateSelection, urlCycleId]);

  /* Once the active cycle resolves, prefer it as the default if no
   * persisted choice exists. Avoid clobbering an explicit pick. */
  useEffect(() => {
    if (selectedId !== null) return;
    if (activeQuery.data) {
      updateSelection(activeQuery.data.id);
      return;
    }
    /* No active cycle — fall back to the most recent draft/active in the list. */
    if (available.length > 0) {
      updateSelection(available[0]!.id);
    }
  }, [activeQuery.data, available, selectedId, updateSelection]);

  const setCycle = (id: string | null): void => {
    updateSelection(id);
  };

  /* Hold the last resolved cycle so a transient list refetch (during which
   * `listQuery.data` is briefly undefined) doesn't flip `cycle` to null and
   * retrigger downstream effects keyed on `cycle?.id`. */
  const lastResolvedRef = useRef<AdmissionCycle | null>(null);
  const resolved = selectedId
    ? available.find((c) => c.id === selectedId) ?? null
    : null;
  if (selectedId && resolved) {
    lastResolvedRef.current = resolved;
  } else if (!selectedId) {
    lastResolvedRef.current = null;
  }
  const cycle = resolved ?? lastResolvedRef.current;

  return {
    cycle,
    setCycle,
    availableCycles: available,
    isLoading: activeQuery.isLoading || listQuery.isLoading,
    isInitialised: !activeQuery.isLoading && !listQuery.isLoading,
  };
}
