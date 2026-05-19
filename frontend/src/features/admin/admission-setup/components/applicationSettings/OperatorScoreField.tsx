/**
 * OperatorScoreField — visually unified `[operator dropdown | numeric input]`
 * field used inside the application-settings rule editors.
 *
 * Fuses a `RadixSelect` (comparison operator) with a percentage-score
 * `<input>` under a single border so admins read them as one bound
 * rather than two unrelated controls. Focus-within lights the whole
 * wrapper. Error state colours the wrapper border; the consuming form
 * renders the actual error message below the field row.
 *
 * The inner controls are styled seamless (no border, transparent bg,
 * square corners) — the wrapper provides the chrome.
 */

import { cn } from '@/shared/lib/cn';
import { RadixSelect, type RadixSelectOption } from '@/shared/components';

/** Percentage bound — matches the legacy inputs the wrapper replaces. */
const SCORE_MIN_BOUND = 0;
const SCORE_MAX_BOUND = 100;

interface OperatorScoreFieldProps<V extends string> {
  /** Selected comparison operator. */
  operatorValue: V;
  onOperatorChange: (next: V) => void;
  operatorOptions: ReadonlyArray<RadixSelectOption<V>>;
  /** Screen-reader label for the operator dropdown. */
  operatorAriaLabel: string;
  /** Percentage score, `null` = empty. */
  scoreValue: number | null;
  onScoreChange: (next: number | null) => void;
  /** Screen-reader label for the numeric input. */
  scoreAriaLabel: string;
  /** Render the wrapper in error chrome (terra border + focus ring). */
  invalid?: boolean;
}

export function OperatorScoreField<V extends string>({
  operatorValue,
  onOperatorChange,
  operatorOptions,
  operatorAriaLabel,
  scoreValue,
  onScoreChange,
  scoreAriaLabel,
  invalid,
}: OperatorScoreFieldProps<V>): JSX.Element {
  return (
    <div
      className={cn(
        'flex h-9 items-stretch rounded-md border bg-surface-card transition-colors duration-fast ease-standard',
        invalid
          ? 'border-terra-500 focus-within:border-terra-500 focus-within:shadow-focus-terra'
          : 'border-ink-200 hover:border-ink-300 focus-within:border-teal-500 focus-within:shadow-focus-teal has-[[data-state=open]]:border-teal-500 has-[[data-state=open]]:shadow-focus-teal',
      )}
    >
      <RadixSelect<V>
        ariaLabel={operatorAriaLabel}
        value={operatorValue}
        onChange={onOperatorChange}
        options={operatorOptions}
        className={cn(
          'w-40 shrink-0 rounded-none border-0 bg-transparent',
          'hover:border-0',
          'focus-visible:border-0 focus-visible:shadow-none',
          'data-[state=open]:border-0 data-[state=open]:shadow-none',
        )}
      />
      <div aria-hidden className="w-px self-stretch bg-border-subtle" />
      <input
        type="number"
        min={SCORE_MIN_BOUND}
        max={SCORE_MAX_BOUND}
        step="0.01"
        inputMode="decimal"
        placeholder="٠ – ١٠٠"
        aria-label={scoreAriaLabel}
        aria-invalid={invalid || undefined}
        value={scoreValue ?? ''}
        onChange={(e) =>
          onScoreChange(e.target.value === '' ? null : Number(e.target.value))
        }
        className={cn(
          'min-w-0 flex-1 bg-transparent px-3 text-sm text-ink-900',
          'placeholder:text-ink-400 font-ar',
          'focus-visible:outline-none',
        )}
      />
    </div>
  );
}
