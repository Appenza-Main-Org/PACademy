/**
 * Cell — labeled input/select/textarea row used inside وثيقة تعارف
 * record cards. Renders the PDF-style "label / value" pair: label as a
 * small chip on the start edge, control filling the rest of the cell.
 *
 * Variants:
 *   - <Cell type="text"|"date"|"tel"|"number" .../>
 *   - <Cell type="textarea" rows={N} .../>
 *   - <Cell type="select" options={[...]} .../>
 *   - <Cell type="checkbox" checkboxLabel="..." .../>  → boolean toggle
 *
 * `colSpan` lets a record card lay out a 2-column or 3-column grid by
 * having occasional full-width cells (العنوان) span the row.
 */

import type { ChangeEvent, JSX } from 'react';

interface BaseProps {
  label: string;
  required?: boolean;
  disabled?: boolean;
  colSpan?: 1 | 2 | 3;
  error?: string;
}

type TextProps = BaseProps & {
  type?: 'text' | 'date' | 'tel' | 'number';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: 'ltr' | 'rtl';
};

type TextareaProps = BaseProps & {
  type: 'textarea';
  rows?: number;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

type SelectProps = BaseProps & {
  type: 'select';
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
};

type CheckboxProps = BaseProps & {
  type: 'checkbox';
  checkboxLabel: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

export type CellProps = TextProps | TextareaProps | SelectProps | CheckboxProps;

const colSpanClass: Record<NonNullable<BaseProps['colSpan']>, string> = {
  1: '',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
};

const baseControl =
  'h-10 w-full rounded-md border border-border-default bg-surface-card px-3 text-sm text-ink-900 outline-none transition-colors hover:border-ink-300 focus:border-teal-500 focus:shadow-focus-teal disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500';

export function Cell(props: CellProps): JSX.Element {
  const { label, required, disabled, colSpan = 1, error } = props;
  const cls = `flex flex-col gap-1.5 ${colSpanClass[colSpan]}`;
  const errorId = error ? `${label.replace(/\s+/g, '-')}-err` : undefined;

  return (
    <div className={cls}>
      <label className="text-xs font-medium text-ink-700">
        {label}
        {required && (
          <span aria-hidden className="ms-1 align-middle text-sm font-bold leading-none text-terra-500">*</span>
        )}
      </label>
      {props.type === 'textarea' ? (
        <textarea
          rows={props.rows ?? 3}
          value={props.value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={`${baseControl} h-auto min-h-[80px] py-2 leading-relaxed`}
        />
      ) : props.type === 'select' ? (
        <select
          value={props.value}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => props.onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={baseControl}
        >
          <option value="">— اختر —</option>
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : props.type === 'checkbox' ? (
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border-default bg-surface-card px-3 text-sm text-ink-800 hover:bg-ink-50">
          <input
            type="checkbox"
            checked={props.value}
            onChange={(e: ChangeEvent<HTMLInputElement>) => props.onChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 accent-teal-600"
          />
          <span>{props.checkboxLabel}</span>
        </label>
      ) : (
        <input
          type={props.type ?? 'text'}
          value={props.value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          disabled={disabled}
          dir={props.dir}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={baseControl}
        />
      )}
      {error && (
        <p id={errorId} className="text-2xs text-terra-700">{error}</p>
      )}
    </div>
  );
}
