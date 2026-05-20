/**
 * Accordion — vertically stacked, expandable sections.
 *
 * Built on `@radix-ui/react-accordion`. For the architecture page sections,
 * FAQ blocks on `/help`, and any progressive-disclosure list of headings.
 *
 * Behaviour
 * ---------
 *  • `single` (default) or `multiple` open mode (controlled via `type` prop)
 *  • arrow keys move focus through triggers (Radix default)
 *  • Home/End jump to first/last trigger
 *  • Enter/Space toggles
 *  • controlled (`value` / `onValueChange`) or uncontrolled (`defaultValue`)
 *  • RTL-safe; chevron rotates on open via group-data-[state=open]
 *
 * Visual
 * ------
 *  • items separated by border-subtle dividers, framed top + bottom
 *  • trigger row: text-ink-900, hover bg-ink-50/60, chevron rotates 180° on open
 *  • content fades + slides via the existing `pageEnter` keyframe (reduced-motion safe)
 *
 * Composition
 * -----------
 *   <Accordion type="single" defaultValue="overview" collapsible>
 *     <Accordion.Item value="overview">
 *       <Accordion.Trigger>نظرة عامة</Accordion.Trigger>
 *       <Accordion.Content>...body...</Accordion.Content>
 *     </Accordion.Item>
 *   </Accordion>
 */

import * as RadixAccordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { forwardRef } from 'react';
import type {
  ComponentProps,
  ComponentPropsWithoutRef,
  ElementRef,
  ReactNode,
} from 'react';
import { cn } from '@/shared/lib/cn';

type AccordionRootProps = ComponentProps<typeof RadixAccordion.Root>;

function AccordionRoot({ className, dir = 'rtl', ...rest }: AccordionRootProps): JSX.Element {
  return (
    <RadixAccordion.Root
      dir={dir}
      className={cn(
        'flex flex-col divide-y divide-border-subtle border-y border-border-subtle',
        className,
      )}
      {...rest}
    />
  );
}

const AccordionItem = forwardRef<
  ElementRef<typeof RadixAccordion.Item>,
  ComponentPropsWithoutRef<typeof RadixAccordion.Item>
>(({ className, ...rest }, ref) => (
  <RadixAccordion.Item ref={ref} className={cn('group', className)} {...rest} />
));
AccordionItem.displayName = 'Accordion.Item';

const AccordionTrigger = forwardRef<
  ElementRef<typeof RadixAccordion.Trigger>,
  ComponentPropsWithoutRef<typeof RadixAccordion.Trigger>
>(({ className, children, ...rest }, ref) => (
  <RadixAccordion.Header className="flex">
    <RadixAccordion.Trigger
      ref={ref}
      className={cn(
        'group flex w-full items-center justify-between gap-3 px-4 py-4 text-start',
        'font-ar text-base font-medium text-ink-900',
        'transition-colors duration-fast ease-standard',
        'hover:bg-ink-50/60',
        'focus-visible:shadow-[var(--ring)] focus-visible:outline-none',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className,
      )}
      {...rest}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronDown
        size={18}
        className={cn(
          'shrink-0 text-ink-500',
          'transition-transform duration-base ease-standard',
          'group-data-[state=open]:rotate-180',
        )}
        aria-hidden
      />
    </RadixAccordion.Trigger>
  </RadixAccordion.Header>
));
AccordionTrigger.displayName = 'Accordion.Trigger';

const AccordionContent = forwardRef<
  ElementRef<typeof RadixAccordion.Content>,
  ComponentPropsWithoutRef<typeof RadixAccordion.Content>
>(({ className, children, ...rest }, ref) => (
  <RadixAccordion.Content
    ref={ref}
    className={cn(
      'overflow-hidden text-sm text-ink-700 font-ar leading-normal',
      'data-[state=open]:py-4 data-[state=closed]:py-0',
      className,
    )}
    style={{ animation: 'pageEnter var(--duration-base) var(--ease-standard)' }}
    {...rest}
  >
    <div className="px-4">{children}</div>
  </RadixAccordion.Content>
));
AccordionContent.displayName = 'Accordion.Content';

/**
 * `Accordion.HeaderRow` — composer for items that need a non-toggling
 * trailing slot next to the trigger (e.g. a per-section DropdownMenu).
 *
 * Use this *instead of* `Accordion.Trigger` directly when the row also
 * carries another interactive control. Nesting a `<button>` inside the
 * Radix trigger button is invalid HTML, so the `actions` slot renders as
 * a sibling inside Radix's `<Header>` element. The slot wraps actions in
 * a `<span>` that swallows pointer-down events so the accordion isn't
 * toggled when the admin interacts with the menu.
 */
interface AccordionHeaderRowProps {
  trigger: ReactNode;
  actions?: ReactNode;
  className?: string;
}

function AccordionHeaderRow({
  trigger,
  actions,
  className,
}: AccordionHeaderRowProps): JSX.Element {
  return (
    <RadixAccordion.Header className={cn('flex items-stretch', className)}>
      <RadixAccordion.Trigger
        className={cn(
          'group flex flex-1 items-center justify-between gap-3 px-4 py-4 text-start',
          'font-ar text-base font-medium text-ink-900',
          'transition-colors duration-fast ease-standard',
          'hover:bg-ink-50/60',
          'focus-visible:shadow-[var(--ring)] focus-visible:outline-none',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{trigger}</span>
        <ChevronDown
          size={18}
          className={cn(
            'shrink-0 text-ink-500',
            'transition-transform duration-base ease-standard',
            'group-data-[state=open]:rotate-180',
          )}
          aria-hidden
        />
      </RadixAccordion.Trigger>
      {actions && (
        <span
          className="flex items-center pe-2"
          /* Stop the pointer event from bubbling to the surrounding
           * Header so clicking the actions slot never toggles the
           * accordion. */
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </span>
      )}
    </RadixAccordion.Header>
  );
}

interface AccordionComponent {
  (props: AccordionRootProps): JSX.Element;
  Root: typeof AccordionRoot;
  Item: typeof AccordionItem;
  Header: typeof RadixAccordion.Header;
  Trigger: typeof AccordionTrigger;
  Content: typeof AccordionContent;
  HeaderRow: typeof AccordionHeaderRow;
}

const Accordion = AccordionRoot as AccordionComponent;
Accordion.Root = AccordionRoot;
Accordion.Item = AccordionItem;
Accordion.Header = RadixAccordion.Header;
Accordion.Trigger = AccordionTrigger;
Accordion.Content = AccordionContent;
Accordion.HeaderRow = AccordionHeaderRow;

export { Accordion };
