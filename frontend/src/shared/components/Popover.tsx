/**
 * Popover — anchored floating surface tied to a trigger.
 *
 * Built on `@radix-ui/react-popover`. For filter dropdowns, audit-log
 * "view diff" launchers, inline help, and any anchored surface that
 * isn't a menu (use DropdownMenu) or a select (use Select).
 *
 * Behaviour
 * ---------
 *  • collision-aware positioning (Radix Popper)
 *  • Esc closes; outside-click closes
 *  • focus is trapped while open and returns to the trigger on close
 *  • supports controlled (`open` / `onOpenChange`) and uncontrolled use
 *
 * Visual
 * ------
 *  • surface-elevated card, rounded-lg, shadow-md, border subtle
 *  • align/side props mirror Radix; `align="start"` is the default
 *  • motion via the existing `pageEnter` keyframe (reduced-motion safe)
 *
 * Composition
 * -----------
 *   <Popover>
 *     <Popover.Trigger asChild><Button variant="secondary">فلتر</Button></Popover.Trigger>
 *     <Popover.Content side="bottom">
 *       ...filter form...
 *     </Popover.Content>
 *   </Popover>
 *
 * Or controlled:
 *   <Popover open={open} onOpenChange={setOpen}>...</Popover>
 */

import * as RadixPopover from '@radix-ui/react-popover';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface PopoverRootProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  defaultOpen?: boolean;
  modal?: boolean;
}

function PopoverRoot({ children, ...rest }: PopoverRootProps): JSX.Element {
  return <RadixPopover.Root {...rest}>{children}</RadixPopover.Root>;
}

const PopoverTrigger = RadixPopover.Trigger;
const PopoverAnchor = RadixPopover.Anchor;
const PopoverClose = RadixPopover.Close;

type PopoverContentProps = ComponentPropsWithoutRef<typeof RadixPopover.Content>;

const PopoverContent = forwardRef<ElementRef<typeof RadixPopover.Content>, PopoverContentProps>(
  ({ className, align = 'start', sideOffset = 6, ...rest }, ref) => (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        dir="rtl"
        className={cn(
          'z-dropdown min-w-48 max-w-[min(92vw,360px)]',
          'rounded-lg border border-border-subtle bg-surface-elevated shadow-md',
          'p-3 outline-none font-ar',
          /* tasteful 4px translate + fade on enter via existing pageEnter keyframe */
          className,
        )}
        style={{ animation: 'pageEnter var(--duration-base) var(--ease-standard)' }}
        {...rest}
      />
    </RadixPopover.Portal>
  ),
);
PopoverContent.displayName = 'Popover.Content';

interface PopoverComponent {
  (props: PopoverRootProps): JSX.Element;
  Trigger: typeof PopoverTrigger;
  Anchor: typeof PopoverAnchor;
  Content: typeof PopoverContent;
  Close: typeof PopoverClose;
}

const Popover = PopoverRoot as PopoverComponent;
Popover.Trigger = PopoverTrigger;
Popover.Anchor = PopoverAnchor;
Popover.Content = PopoverContent;
Popover.Close = PopoverClose;

export { Popover };
