/**
 * ScopeBanner — clarifies that Application Settings is global master data.
 *
 * Dashed gold border on the inline-start edge, gold-50 surface, single
 * paragraph of body copy plus a deep link to the lookup catalogue so an
 * admin can adjust the underlying category roster.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, BookMarked } from 'lucide-react';

const LOOKUP_URL = '/admin/lookups/applicant-categories';

export function ScopeBanner(): JSX.Element {
  return (
    <aside
      role="note"
      className="rounded-md border border-gold-300 bg-gold-50 px-4 py-3"
      style={{ borderInlineStartWidth: 4, borderStyle: 'dashed' }}
    >
      <div className="flex items-start gap-3">
        <BookMarked
          size={16}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0 text-gold-700"
          aria-hidden
        />
        <div className="flex flex-col gap-1">
          <p className="font-ar text-sm leading-normal text-gold-900">
            هذه الإعدادات بيانات مرجعية عامة. التعديلات تطبق على كل دورات
            القبول التي تستخدم هذه الفئات.
          </p>
          <Link
            to={LOOKUP_URL}
            className="inline-flex items-center gap-1 text-2xs font-medium text-gold-700 underline-offset-2 hover:underline"
          >
            إدارة فئات المتقدمين في الأكواد المرجعية
            <ArrowLeft
              size={12}
              strokeWidth={1.75}
              className="rtl:scale-x-[-1]"
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </aside>
  );
}
