/**
 * UnsavedChangesPrompt — beforeunload guard for the application-settings draft.
 *
 * Originally specified to use `useBlocker` from react-router 6.4+ to
 * intercept in-app navigations. The app is mounted via `<BrowserRouter>`
 * + `useRoutes` (not `createBrowserRouter` + `RouterProvider`), so
 * `useBlocker` throws "must be used within a data router". Migrating the
 * routing root is out of scope for this task. V1 therefore only guards
 * browser-level loss (reload / close tab / external link), which is the
 * highest-impact case for accidental data loss. In-app navigations
 * (clicking سابق / التالي in the wizard footer) still discard local
 * edits silently — this is documented in the migration report.
 *
 * When the routing root flips to a data router, swap the beforeunload
 * handler for `useBlocker` and surface the prompt as an `AlertDialog`.
 */

import { useEffect } from 'react';
import { useDraftIsDirty } from '../../store/appSettingsDraft';

export function UnsavedChangesPrompt(): null {
  const isDirty = useDraftIsDirty();

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent): string => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return null;
}
