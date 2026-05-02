/**
 * NotificationCenter — bell icon → drawer with notifications list.
 * Source: Tasks/KARASA_GAPS.md §10.4.B.
 */

import { useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { Drawer } from './Drawer';
import { Button } from './Button';
import { Badge } from './Badge';
import { MOCK } from '@/shared/mock-data';
import type { NotificationItem } from '@/shared/types/domain';
import { date as fmtDate } from '@/shared/lib/format';

export function NotificationCenter(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([...MOCK.notifications]);
  const unread = items.filter((n) => !n.read).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="الإشعارات"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-700 hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
      >
        <Bell size={18} strokeWidth={1.75} />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute top-1 inset-inline-end-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-terra-500 px-1 text-2xs font-bold text-white"
          >
            {unread}
          </span>
        )}
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} title="مركز الإشعارات" subtitle={`${unread} إشعار غير مقروء`} size="sm" transparentBackdrop>
        <Drawer.Body>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-2xs text-ink-500">{items.length} إشعار</span>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Check size={12} strokeWidth={1.75} />}
              onClick={() => setItems(items.map((n) => ({ ...n, read: true })))}
            >
              وضع كل العناصر كمقروءة
            </Button>
          </div>
          <ul className="flex flex-col gap-2">
            {items.map((n) => (
              <li
                key={n.id}
                className={
                  'flex flex-col gap-1 rounded-md border px-3 py-2 ' +
                  (n.read ? 'border-border-subtle bg-surface-card' : 'border-teal-300 bg-teal-50')
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-ink-900">{n.title}</p>
                  {!n.read && <Badge tone="info" dot>جديد</Badge>}
                </div>
                <p className="text-xs text-ink-700">{n.body}</p>
                <p className="text-2xs text-ink-500">{fmtDate(n.ts, 'rel')}</p>
              </li>
            ))}
          </ul>
        </Drawer.Body>
      </Drawer>
    </>
  );
}
