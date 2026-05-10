/**
 * WizardModeContext — flag passed down by AdmissionSetupWizardPage so
 * the existing per-step pages can suppress their own breadcrumb +
 * StepHeader chrome (the wizard owns the top-stepper + cycle context
 * already). Default `false` keeps direct-route renders backwards-compat.
 */

import { createContext, useContext, type ReactNode } from 'react';

const WizardModeContext = createContext<boolean>(false);

export function WizardModeProvider({ children }: { children: ReactNode }): JSX.Element {
  return <WizardModeContext.Provider value={true}>{children}</WizardModeContext.Provider>;
}

export function useIsInWizardMode(): boolean {
  return useContext(WizardModeContext);
}
