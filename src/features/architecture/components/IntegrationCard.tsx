/**
 * IntegrationCard — expandable card row for Section 4 (Integrations).
 *
 * Click the header to reveal the full integration spec. In print, the card
 * is forced open via the .arch-print-expanded class so the handout shows
 * every integration's detail.
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { IntegrationSpec } from '../data';

interface Props {
  integration: IntegrationSpec;
  defaultOpen?: boolean;
}

export function IntegrationCard({ integration, defaultOpen = false }: Props): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        'arch-integration rounded-lg border bg-surface-card transition-shadow duration-fast ease-standard',
        open ? 'border-teal-300 shadow-xs' : 'border-border-subtle',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`int-${integration.id}-body`}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-start"
      >
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            Integration · {integration.id}
          </p>
          <h3 className="mt-1 text-md font-bold leading-snug text-ink-900">{integration.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-700">{integration.purpose}</p>
        </div>
        <ChevronDown
          size={18}
          strokeWidth={1.75}
          className={cn(
            'mt-1 flex-none text-ink-500 transition-transform duration-fast ease-standard',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          id={`int-${integration.id}-body`}
          className="grid gap-4 border-t border-border-subtle px-5 py-4 md:grid-cols-2"
        >
          <Field label="Direction" value={integration.direction} />
          <Field label="Authentication" value={integration.authMethod} />
          <Field label="Data exchanged" value={integration.dataExchanged} />
          <Field label="Frequency" value={integration.frequency} />
          <Field
            label="Failure handling"
            value={integration.failureHandling}
            className="md:col-span-2"
          />
          <p className="md:col-span-2 font-mono text-[11px] text-ink-500">{integration.citation}</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }): JSX.Element {
  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
        {label}
      </p>
      <p className="text-sm leading-relaxed text-ink-700">{value}</p>
    </div>
  );
}
