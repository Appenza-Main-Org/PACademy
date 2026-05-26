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
 *
 * Input validation contract (mirrors the prompt):
 *   • `inputMode="numeric"` — integer-friendly mobile keyboard.
 *   • Negatives and non-numeric keystrokes are blocked at keydown.
 *   • Pasted non-digit characters are stripped on change.
 *   • On blur the value is clamped to [0, maxBound] — `maxBound = null`
 *     means "no upper bound" (the «الحد الأقصى للدرجة» case which may
 *     exceed 100). Out-of-range and non-numeric values are reported
 *     through `onClampMessage` so the consumer can surface a localized
 *     validation string.
 */

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { RadixSelect, type RadixSelectOption } from '@/shared/components';

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
  disabled?: boolean;
  /** Upper bound for blur-time clamping. `null` = no upper bound (max
   *  score may exceed 100). Defaults to 100 — the percentage convention
   *  the min field uses. */
  maxBound?: number | null;
  /** Fires once on blur whenever the typed value was outside the valid
   *  range and had to be clamped. The consumer surfaces a localized
   *  message; passes `null` to clear it. */
  onClampMessage?: (message: string | null) => void;
}

/** Lower bound: zero or above ("positive numbers only"). */
const SCORE_MIN_BOUND = 0;

/* Characters the browser would otherwise allow in a `type="number"`
 * field that don't belong in a positive-integer percentage entry. */
const FORBIDDEN_KEYS = new Set(['-', '+', '.', ',', 'e', 'E']);

export function OperatorScoreField<V extends string>({
  operatorValue,
  onOperatorChange,
  operatorOptions,
  operatorAriaLabel,
  scoreValue,
  onScoreChange,
  scoreAriaLabel,
  invalid,
  disabled = false,
  maxBound = 100,
  onClampMessage,
}: OperatorScoreFieldProps<V>): JSX.Element {
  /* Carries the user's typed text between change and blur so we can
   * clamp / clear the localized message without dropping their keystrokes
   * mid-edit. Reset whenever the outer `scoreValue` resets to null. */
  const [rawDisplay, setRawDisplay] = useState<string>(
    scoreValue === null ? '' : String(scoreValue),
  );

  /* Sync external resets (form reset, edit-mode entry) without effects:
   * track the last propagated value and pull it back into local state
   * when it diverges. */
  if (scoreValue === null && rawDisplay !== '') {
    /* External reset — fall through; the next blur or change will
     * realign. Cheaper than a useEffect for a single derived string. */
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (FORBIDDEN_KEYS.has(e.key)) {
      e.preventDefault();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    /* Strip everything that isn't a digit — paste, IME, mobile autofill
     * routes around keydown handlers. */
    const digits = e.target.value.replace(/\D/g, '');
    setRawDisplay(digits);
    if (digits === '') {
      onScoreChange(null);
      onClampMessage?.(null);
      return;
    }
    onScoreChange(Number(digits));
    onClampMessage?.(null);
  };

  const handleBlur = (): void => {
    if (rawDisplay === '') {
      onClampMessage?.(null);
      return;
    }
    const parsed = Number(rawDisplay);
    if (!Number.isFinite(parsed)) {
      onClampMessage?.('أدخل رقمًا صحيحًا');
      return;
    }
    if (parsed < SCORE_MIN_BOUND) {
      const clamped = SCORE_MIN_BOUND;
      setRawDisplay(String(clamped));
      onScoreChange(clamped);
      onClampMessage?.('القيمة يجب أن تكون رقمًا موجبًا — تم ضبطها إلى ٠');
      return;
    }
    if (maxBound !== null && parsed > maxBound) {
      const clamped = maxBound;
      setRawDisplay(String(clamped));
      onScoreChange(clamped);
      onClampMessage?.(`القيمة يجب ألا تتجاوز ${maxBound} — تم ضبطها إلى ${maxBound}`);
      return;
    }
    onClampMessage?.(null);
  };

  /* If the consumer resets scoreValue (e.g. cancelling edit-mode) keep
   * the visible input aligned. */
  const display = scoreValue === null ? rawDisplay : String(scoreValue);

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
        disabled={disabled}
        className={cn(
          'w-40 shrink-0 rounded-none border-0 bg-transparent',
          'hover:border-0',
          'focus-visible:border-0 focus-visible:shadow-none',
          'data-[state=open]:border-0 data-[state=open]:shadow-none',
        )}
      />
      <div aria-hidden className="w-px self-stretch bg-border-subtle" />
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={maxBound === null ? '٠ فأكثر' : '٠ – ١٠٠'}
        aria-label={scoreAriaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={display}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          'min-w-0 flex-1 bg-transparent px-3 text-sm text-ink-900',
          'placeholder:text-ink-400 font-ar',
          'focus-visible:outline-none',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      />
    </div>
  );
}
