/**
 * Field — shared label / required-asterisk / error-or-helper chrome wrapper.
 *
 * Mirrors the visual chrome of `<Select>` / `<Input>` so that any control
 * which doesn't ship its own label (notably `SearchSelect`) can borrow this
 * envelope and stay visually consistent with the rest of the form.
 *
 * Promoted from four byte-identical-or-strict-subset inline `SearchSelectField`
 * definitions across pilots 1–3 (governorate, cert-type, rank). The
 * canonical shape adopted here is the superset agreed in cert-type pilot
 * REPORT §3.3:
 *
 *  • `label`     — required ReactNode shown above the control
 *  • `required`  — optional; renders the terra-500 asterisk
 *  • `error`     — optional; rendered in terra-700, takes precedence over helper
 *  • `helper`    — optional; rendered in ink-500 when no error is set
 *  • `children`  — the control itself (typically `<SearchSelect>`)
 *
 * Sites that don't pass `helper` see `helperText = error ?? undefined`,
 * which collapses to "render error if present" — i.e. the minimal-shape
 * behaviour the wizard sites used before promotion.
 *
 * Usage
 * -----
 *   <Field label="المحافظة" required error={errors.governorate?.message}>
 *     <Controller
 *       control={control}
 *       name="governorate"
 *       render={({ field }) => (
 *         <SearchSelect
 *           value={field.value || null}
 *           onChange={(v) => field.onChange(v ?? '')}
 *           options={GOV_OPTIONS}
 *           ariaLabel="المحافظة"
 *           placeholder="اختر المحافظة"
 *         />
 *       )}
 *     />
 *   </Field>
 */

import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface FieldProps {
  label: ReactNode;
  required?: boolean;
  error?: ReactNode;
  helper?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  required,
  error,
  helper,
  children,
  className,
}: FieldProps): JSX.Element {
  const helperText = error ?? helper;
  const helperTone = error ? 'text-terra-700' : 'text-ink-500';
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-sm font-medium text-ink-700">
        {label}
        {required && <span aria-hidden className="ms-1 align-middle text-base font-bold leading-none text-terra-500">*</span>}
      </span>
      {children}
      {helperText && <span className={cn('text-xs', helperTone)}>{helperText}</span>}
    </div>
  );
}
