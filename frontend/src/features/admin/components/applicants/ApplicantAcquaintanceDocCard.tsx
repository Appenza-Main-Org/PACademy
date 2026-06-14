/**
 * Admin read-only mirror of an applicant's submitted acquaintance document
 * (وثيقة التعارف). Rendered inside the applicant-detail page so the admin sees
 * the same data the applicant entered in the portal and the data-exchange
 * export emits — one source of truth across the three planes.
 *
 * The document is fetched through `useApplicantAcquaintanceDoc`; its `sections`
 * map carries the portal section payloads (personal / parents / siblings / …).
 * Rendering is data-driven off the field-label maps in `acquaintanceDoc/labels`
 * so every populated نموذج field surfaces without a per-field component.
 *
 * @example
 * <ApplicantAcquaintanceDocCard applicantId={id} />
 */

import { Badge, Card, CardBody, CardHeader, ErrorState, LoadingState } from '@/shared/components';
import {
  ACQUAINTANCE_GROUP_KEYS,
  ACQUAINTANCE_GROUP_LABELS,
  type AcquaintanceGroupKey,
} from '@/features/applicant-portal';
import { useApplicantAcquaintanceDoc, type AdminAcquaintanceDoc } from '@/features/applicants';
import { date as fmtDate } from '@/shared/lib/format';
import {
  ACQUAINTANCE_STATUS_LABELS,
  ADULT_RELATIVE_COLUMNS,
  APPLICANT_SPOUSE_FIELDS,
  CRIMINAL_CASE_COLUMNS,
  FATHER_FIELDS,
  FOREIGN_EMPLOYED_COLUMNS,
  GRANDPARENT_FIELDS,
  GRANDPARENT_LABELS,
  GUARDIAN_FIELDS,
  HOUSING_FIELDS,
  INCOME_FIELDS,
  MOTHER_FIELDS,
  NATURALIZED_COLUMNS,
  RELATIVE_LIST_LABELS,
  STUDENT_FIELDS,
  type FieldSpec,
} from './acquaintanceDoc/labels';

interface RelativeList {
  none: boolean;
  items: Array<Record<string, unknown>>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asList(value: unknown): RelativeList | null {
  const record = asRecord(value);
  if (!record) return null;
  const items = Array.isArray(record.items) ? (record.items.filter(asRecord) as Array<Record<string, unknown>>) : [];
  return { none: record.none === true, items };
}

function displayCell(record: Record<string, unknown>, spec: FieldSpec): string | null {
  const raw = record[spec.key];
  if (raw === undefined || raw === null || raw === '') return null;
  const text = spec.format ? spec.format(raw) : String(raw);
  return text.trim() === '' ? null : text;
}

function hasAnyValue(record: Record<string, unknown> | null, specs: FieldSpec[]): boolean {
  if (!record) return false;
  return specs.some((spec) => displayCell(record, spec) !== null);
}

/** Labelled grid of a single record's populated fields. */
function RecordGrid({ record, specs }: { record: Record<string, unknown> | null; specs: FieldSpec[] }): JSX.Element | null {
  if (!hasAnyValue(record, specs)) return null;
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {specs.map((spec) => {
        const value = record ? displayCell(record, spec) : null;
        if (value === null) return null;
        return (
          <div key={spec.key} className="flex flex-col gap-0.5">
            <dt className="text-2xs font-medium uppercase tracking-wide text-ink-500">{spec.label}</dt>
            <dd className="break-words text-sm text-ink-900">{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** A sub-block with a heading inside a section (e.g. الأب / الأم). */
function SubBlock({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-2xs font-bold uppercase tracking-wide text-ink-500">{title}</div>
      {children}
    </div>
  );
}

/** A relative list rendered as a wide table, or a «لا يوجد» note when the
 *  applicant explicitly asserted no such relatives exist. */
function RelativeTable({ title, list, columns }: { title: string; list: RelativeList | null; columns: FieldSpec[] }): JSX.Element | null {
  if (!list) return null;
  if (list.items.length === 0) {
    return list.none ? <SubBlock title={title}><span className="text-sm text-ink-500">لا يوجد</span></SubBlock> : null;
  }
  return (
    <SubBlock title={title}>
      <div className="min-w-0 overflow-x-auto rounded-md border border-border-subtle">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-surface-page">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap border-b border-border-subtle px-3 py-2 text-start text-2xs font-bold uppercase tracking-wide text-ink-500"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.items.map((item, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border-subtle align-top last:border-b-0">
                {columns.map((col) => (
                  <td key={col.key} className="break-words px-3 py-2 text-ink-900">
                    {displayCell(item, col) ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SubBlock>
  );
}

/** Renders all sub-lists of a relatives-style section (siblings / paternal /
 *  maternal), in the schema's key order, using the shared adult-relative
 *  columns. Returns null when nothing in the section was filled. */
function RelativesSection({ section }: { section: Record<string, unknown> | null }): JSX.Element | null {
  if (!section) return null;
  const blocks = Object.keys(RELATIVE_LIST_LABELS)
    .filter((key) => key in section)
    .map((key) => (
      <RelativeTable key={key} title={RELATIVE_LIST_LABELS[key]} list={asList(section[key])} columns={ADULT_RELATIVE_COLUMNS} />
    ))
    .filter(Boolean);
  return blocks.length > 0 ? <div className="flex flex-col gap-4">{blocks}</div> : null;
}

function renderSection(key: AcquaintanceGroupKey, section: Record<string, unknown> | null): React.ReactNode {
  if (!section) return null;
  switch (key) {
    case 'personal': {
      const student = asRecord(section.personal);
      const housing = asRecord(section.housing);
      const income = asRecord(section.income);
      return (
        <div className="flex flex-col gap-4">
          <RecordGrid record={student} specs={STUDENT_FIELDS} />
          {hasAnyValue(housing, HOUSING_FIELDS) && <SubBlock title="بيانات المسكن"><RecordGrid record={housing} specs={HOUSING_FIELDS} /></SubBlock>}
          {hasAnyValue(income, INCOME_FIELDS) && <SubBlock title="بيانات الدخل"><RecordGrid record={income} specs={INCOME_FIELDS} /></SubBlock>}
        </div>
      );
    }
    case 'applicantFamily': {
      const spouse = asRecord(section.spouse);
      const secondSpouse = asRecord(section.secondSpouse);
      return (
        <div className="flex flex-col gap-4">
          {hasAnyValue(spouse, APPLICANT_SPOUSE_FIELDS) && <SubBlock title="الزوج/الزوجة"><RecordGrid record={spouse} specs={APPLICANT_SPOUSE_FIELDS} /></SubBlock>}
          {section.hasSecondSpouse === true && hasAnyValue(secondSpouse, APPLICANT_SPOUSE_FIELDS) && (
            <SubBlock title="الزوجة الثانية"><RecordGrid record={secondSpouse} specs={APPLICANT_SPOUSE_FIELDS} /></SubBlock>
          )}
          <RelativeTable title="الأبناء" list={asList(section.sons)} columns={ADULT_RELATIVE_COLUMNS} />
          <RelativeTable title="البنات" list={asList(section.daughters)} columns={ADULT_RELATIVE_COLUMNS} />
        </div>
      );
    }
    case 'parents': {
      const father = asRecord(section.father);
      const mother = asRecord(section.mother);
      const guardian = asRecord(section.guardian);
      return (
        <div className="flex flex-col gap-4">
          {hasAnyValue(father, FATHER_FIELDS) && <SubBlock title="الأب"><RecordGrid record={father} specs={FATHER_FIELDS} /></SubBlock>}
          {hasAnyValue(mother, MOTHER_FIELDS) && <SubBlock title="الأم"><RecordGrid record={mother} specs={MOTHER_FIELDS} /></SubBlock>}
          {hasAnyValue(guardian, GUARDIAN_FIELDS) && <SubBlock title="ولي الأمر"><RecordGrid record={guardian} specs={GUARDIAN_FIELDS} /></SubBlock>}
        </div>
      );
    }
    case 'grandparents': {
      const blocks = Object.keys(GRANDPARENT_LABELS)
        .map((gpKey) => {
          const record = asRecord(section[gpKey]);
          if (!hasAnyValue(record, GRANDPARENT_FIELDS)) return null;
          return <SubBlock key={gpKey} title={GRANDPARENT_LABELS[gpKey]}><RecordGrid record={record} specs={GRANDPARENT_FIELDS} /></SubBlock>;
        })
        .filter(Boolean);
      return blocks.length > 0 ? <div className="flex flex-col gap-4">{blocks}</div> : null;
    }
    case 'siblings':
    case 'paternalRelatives':
    case 'maternalRelatives':
      return <RelativesSection section={section} />;
    case 'foreignAndCases':
      return (
        <div className="flex flex-col gap-4">
          <RelativeTable title="أقارب يعملون بجهات أجنبية" list={asList(section.foreignEmployed)} columns={FOREIGN_EMPLOYED_COLUMNS} />
          <RelativeTable title="أقارب يحملون جنسية غير مصرية" list={asList(section.naturalized)} columns={NATURALIZED_COLUMNS} />
          <RelativeTable title="قضايا جنائية" list={asList(section.criminalCases)} columns={CRIMINAL_CASE_COLUMNS} />
        </div>
      );
    default:
      return null;
  }
}

function LifecycleHeader({ doc }: { doc: AdminAcquaintanceDoc }): JSX.Element {
  const status = ACQUAINTANCE_STATUS_LABELS[doc.status] ?? { label: doc.status, tone: 'neutral' as const };
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-500">
      <span className="flex items-center gap-2">
        الحالة:
        <Badge tone={status.tone}>{status.label}</Badge>
      </span>
      {doc.lastAutosavedAt && <span>آخر حفظ: {fmtDate(doc.lastAutosavedAt, 'short')}</span>}
      {doc.closedAt && <span>أُغلقت: {fmtDate(doc.closedAt, 'short')}</span>}
      {typeof doc.revisionCount === 'number' && doc.revisionCount > 0 && <span>عدد التعديلات: {doc.revisionCount}</span>}
    </div>
  );
}

export function ApplicantAcquaintanceDocCard({ applicantId }: { applicantId: string }): JSX.Element {
  const { data: doc, isLoading, error, refetch } = useApplicantAcquaintanceDoc(applicantId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="وثيقة التعارف" />
        <LoadingState variant="list" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardHeader title="وثيقة التعارف" />
        <ErrorState error={error as Error} onRetry={() => refetch()} />
      </Card>
    );
  }
  if (!doc || !doc.hasDocument) {
    return (
      <Card>
        <CardHeader title="وثيقة التعارف" />
        <CardBody>
          <p className="text-sm text-ink-500">لم يبدأ المتقدم وثيقة التعارف بعد.</p>
        </CardBody>
      </Card>
    );
  }

  const sections = ACQUAINTANCE_GROUP_KEYS
    .map((key) => ({ key, content: renderSection(key, asRecord(doc.sections[key])) }))
    .filter((entry): entry is { key: AcquaintanceGroupKey; content: React.ReactNode } => entry.content !== null);

  return (
    <Card>
      <CardHeader title="وثيقة التعارف" subtitle="البيانات التي أدخلها المتقدم في وثيقة التعارف" />
      <CardBody>
        <div className="flex flex-col gap-5">
          <LifecycleHeader doc={doc} />
          {sections.length === 0 ? (
            <p className="text-sm text-ink-500">فُتحت الوثيقة ولم يُدخل المتقدم أي بيانات بعد.</p>
          ) : (
            sections.map(({ key, content }) => (
              <section key={key} className="flex flex-col gap-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
                <h3 className="text-sm font-bold text-ink-900">{ACQUAINTANCE_GROUP_LABELS[key]}</h3>
                {content}
              </section>
            ))
          )}
        </div>
      </CardBody>
    </Card>
  );
}
