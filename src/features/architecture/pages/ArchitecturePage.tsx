/**
 * ArchitecturePage — System Architecture & Security Posture (technical reference).
 *
 * English-LTR technical reference page. The rest of the application chrome
 * (sidebar, header) stays Arabic-RTL — only this page's content body sets
 * dir="ltr". Used by:
 *   - Technical evaluators reviewing the system in-product (in-screen).
 *   - Printable handout (Cmd+P → clean A4 PDF) — see styles/print.css
 *     (.arch-page section).
 *
 * Sections (anchored, with sticky right-rail TOC):
 *   1. Executive Overview
 *   2. The Four Layers — interactive diagram
 *   3. The Nine Applications
 *   4. Integrations — expandable cards
 *   5. Security Architecture — six tiers (high-level posture only)
 *   6. Hosting & Deployment
 *   7. RBAC Matrix — 11 roles × 9 apps
 *   8. Audit & Compliance
 *   9. Non-Functional Targets
 *
 * RFP Scope Document coverage from this page: §1.1 §1.2 §2.1–§2.7 §3.1 §3.2 §3.4
 * §4.1 §4.2 §4.3 §4.4 §9 (architecture overview).
 */

import { useEffect, useState } from 'react';
import { Check, Minus, Printer, Shield } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  type DataTableColumn,
} from '@/shared/components';
import { ROLES, ROLE_DEFINITIONS, type Role } from '@/features/auth';
import { APP_KEYS, type AppKey } from '@/shared/lib/constants';
import {
  APPLICATIONS,
  EXEC_TILES,
  HOSTING,
  INTEGRATIONS,
  NFRS,
  SCALE_TILES,
  SECTIONS,
  SECURITY_TIERS,
  type AppRow,
  type NfrRow,
} from '../data';
import { IntegrationCard } from '../components/IntegrationCard';
import { SectionTOC } from '../components/SectionTOC';
import { SystemDiagram } from '../components/SystemDiagram';

const GENERATION_DATE_FALLBACK = 'Generated on demand';

export function ArchitecturePage(): JSX.Element {
  // Generation date set once on mount (locale-stable: en-GB → "3 May 2026").
  const [generatedAt, setGeneratedAt] = useState<string>(GENERATION_DATE_FALLBACK);
  useEffect(() => {
    const today = new Date();
    setGeneratedAt(
      new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(today),
    );
  }, []);

  const handlePrint = (): void => {
    if (typeof window !== 'undefined') window.print();
  };

  return (
    <AppShell appLabel="معمارية النظام">
      {/* Print-only ministry header (rendered above page body, hidden on screen). */}
      <PrintHeader generatedAt={generatedAt} />

      <div
        dir="ltr"
        className="arch-page font-en text-ink-900"
        data-arch-page="true"
      >
        {/* Page header — built inline (PageHeader uses Arabic display font). */}
        <header className="arch-page-header mx-auto mb-8 max-w-[1280px] px-6 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
            Police Academy Admissions System
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold leading-tight text-ink-900">
                Architecture &amp; Security Posture
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-700">
                Technical reference for the platform: nine applications, four
                architectural layers, five external integrations, eleven user
                roles, and the security posture binding them together.
                Every section cites the relevant RFP Scope Document pages.
              </p>
            </div>
            <div className="flex items-center gap-2" data-no-print="true">
              <span className="hidden font-mono text-xs text-ink-500 md:inline">
                Generated {generatedAt}
              </span>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
              >
                <Printer size={14} strokeWidth={1.75} />
                Print this page
              </button>
            </div>
          </div>
        </header>

        {/* Body — main column + sticky right-rail TOC */}
        <div className="arch-page-grid mx-auto grid max-w-[1280px] gap-8 px-6 pb-16 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="arch-main flex flex-col gap-12">
            <Section1Diagram />
            <Section2Overview />
            <Section3 />
            <Section4 />
            <Section5 />
            <Section6 />
            <Section7 />
            <Section8 />
            <Section9 />
          </div>
          <aside
            className="arch-toc-rail order-first hidden lg:order-last lg:block"
            data-no-print="true"
          >
            <div className="sticky top-20">
              <SectionTOC sections={SECTIONS} />
            </div>
          </aside>
        </div>

        {/* Tablet/mobile horizontal TOC — collapses sticky bottom nav. */}
        <div
          className="arch-toc-mobile sticky bottom-0 left-0 right-0 z-10 border-t border-border-default bg-surface-card lg:hidden"
          data-no-print="true"
        >
          <ol className="flex gap-1 overflow-x-auto px-4 py-2 text-xs">
            {SECTIONS.map((s) => (
              <li key={s.id} className="flex-none">
                <a
                  href={`#${s.id}`}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border-subtle bg-surface-card px-3 py-1 text-ink-700 hover:bg-ink-50"
                >
                  <span className="font-numeric tnum text-ink-500">{s.num}</span>
                  <span>{s.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </AppShell>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Section 1 — Architecture & Deployment Topology (HERO)       */
/* ─────────────────────────────────────────────────────────── */

function Section1Diagram(): JSX.Element {
  return (
    <SectionShell
      id="layers"
      eyebrow="Section 1 · The page hero"
      title="Architecture & Deployment Topology"
      subtitle="One canvas for the whole system: nine applications across a public DMZ and an air-gapped intranet, brokered by middleware and persisted to a high-availability data tier engineered for very high concurrency. Hover any element for detail; click to jump to its full description."
      citation="RFP Scope Document §9 (Architecture Overview) · §1.1, §1.2, §3.1, §3.2 · §4.1 (Performance acceptance gate)"
    >
      <Card className="arch-hero-card">
        <CardBody>
          <SystemDiagram />
        </CardBody>
      </Card>

      {/* Deployment & Concurrency band — the bold statement attached to the diagram. */}
      <section
        aria-labelledby="arch-scale-heading"
        className="arch-scale-band mt-5 rounded-lg border border-teal-500/30 bg-teal-50/40 p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">
              Engineered for very high concurrency
            </p>
            <h3
              id="arch-scale-heading"
              className="mt-1 text-lg font-bold leading-tight text-ink-900"
            >
              Deployment topology &amp; scale envelope
            </h3>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-ink-700">
            Public-surface apps run as stateless containers behind a load balancer with
            horizontal autoscaling. The data tier is active/standby with a synchronous
            replica plus a read replica for analytics. Targets below are bidder-proposed
            and finalized in Phase 2.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SCALE_TILES.map((tile) => (
            <div
              key={tile.label}
              className="relative overflow-hidden rounded-md border border-teal-500/30 bg-surface-card p-4 shadow-xs"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 start-0 w-1 bg-teal-500"
              />
              <p className="font-numeric tnum text-3xl font-bold leading-none text-teal-700">
                {tile.value}
              </p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-700">
                {tile.label}
              </p>
              <p className="mt-1 text-xs leading-snug text-ink-500">{tile.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid max-w-5xl gap-4 text-sm leading-relaxed text-ink-700 md:grid-cols-3">
        <p>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">
            The bands
          </span>
          Four bands. External systems (top) integrate inward. The application layer (middle)
          splits across a public Internet surface and the academy intranet, separated by a network
          boundary enforced at the infrastructure layer. The middleware band carries cross-app
          coordination. The data layer (bottom) consolidates application data, reporting workloads,
          and the immutable audit trail.
        </p>
        <p>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">
            Deployment shape
          </span>
          The two public apps run horizontally autoscaled behind a load balancer. The seven
          intranet apps run as a fixed-size cluster of stateless containers. The data tier is
          active/standby for OLTP, with a synchronous replica for HA and a read replica
          ring-fenced for reporting and exports. The audit DB is append-only and isolated.
        </p>
        <p>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">
            Connector legend
          </span>
          Teal solid connectors are external integrations. Gold dashed connectors are internal
          cross-app workflows on the middleware service bus. Ink connectors are data persistence.
          Terracotta dotted connectors are audit writes — every state-changing operation across
          all nine applications writes to the audit database.
        </p>
      </div>
    </SectionShell>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Section 2 — Executive Overview                              */
/* ─────────────────────────────────────────────────────────── */

function Section2Overview(): JSX.Element {
  return (
    <SectionShell id="overview" eyebrow="Section 2" title="Executive Overview" citation="Per RFP Scope Document §1.0 (Project Overview, p.4)">
      <p className="max-w-3xl text-sm leading-relaxed text-ink-700">
        The Police Academy Admissions System is a single, ministry-grade
        platform that unifies nine connected applications behind a shared
        identity and audit fabric. Two public surfaces expose the system to
        officers and to citizen applicants; seven private surfaces run on the
        Academy intranet for committees, the board, investigations, the
        medical commission, barcoding, biometrics, and the question bank /
        e-exams. A middleware layer brokers identity, integrations, and
        cross-application events; a hardened database tier holds the system
        of record.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EXEC_TILES.map((tile) => (
          <div
            key={tile.label}
            className="rounded-lg border border-border-subtle bg-surface-card p-5 shadow-xs"
          >
            <p className="font-numeric tnum text-3xl font-bold leading-none text-ink-900">
              {tile.value}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.12em] text-ink-500">
              {tile.label}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Section 3 — The Nine Applications                           */
/* ─────────────────────────────────────────────────────────── */

function Section3(): JSX.Element {
  const columns: DataTableColumn<AppRow>[] = [
    { key: 'num',          label: '#',              accessor: 'num',          width: 64,  numeric: true,  align: 'start' },
    { key: 'app',          label: 'Application',    accessor: 'app',          width: 220 },
    {
      key: 'surface',
      label: 'Surface',
      width: 110,
      render: (row) => (
        <Badge tone={row.surface === 'Public' ? 'info' : 'neutral'}>{row.surface}</Badge>
      ),
    },
    { key: 'primaryUsers', label: 'Primary users',  accessor: 'primaryUsers' },
    { key: 'hostingTier',  label: 'Hosting tier',   accessor: 'hostingTier'  },
    {
      key: 'citation',
      label: 'RFP Scope Document §',
      width: 130,
      render: (row) => (
        <span className="font-mono text-[11px] text-ink-500">{row.citation}</span>
      ),
    },
  ];

  return (
    <SectionShell
      id="applications"
      eyebrow="Section 3"
      title="The Nine Applications"
      citation="RFP Scope Document §1.1, §1.2, §2.1–§2.7"
    >
      <Card>
        <DataTable<AppRow>
          columns={columns}
          data={APPLICATIONS as readonly AppRow[]}
          density="default"
        />
      </Card>
    </SectionShell>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Section 4 — Integrations                                    */
/* ─────────────────────────────────────────────────────────── */

function Section4(): JSX.Element {
  return (
    <SectionShell
      id="integrations"
      eyebrow="Section 4"
      title="Integrations"
      subtitle="Five external integrations plus internal cross-application coordination. Click any card for the full spec."
      citation="RFP Scope Document §3.1 p.7 · §3.2 p.40"
    >
      <div className="grid gap-3">
        {INTEGRATIONS.map((integration, idx) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            defaultOpen={idx === 0}
          />
        ))}
      </div>
    </SectionShell>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Section 5 — Security Architecture                           */
/* ─────────────────────────────────────────────────────────── */

function Section5(): JSX.Element {
  return (
    <SectionShell
      id="security"
      eyebrow="Section 5"
      title="Security Architecture"
      subtitle="Six tiers, top to bottom. High-level posture — concrete configurations are finalised in Phase 2."
      citation="RFP Scope Document §4.1 p.100 · §3.4 pp.9, 14"
    >
      <div className="grid gap-3 md:grid-cols-2">
        {SECURITY_TIERS.map((tier) => (
          <Card key={tier.num}>
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-teal-50 text-teal-700"
              >
                <Shield size={16} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  Tier {tier.num}
                </p>
                <h3 className="mt-0.5 text-md font-bold text-ink-900">{tier.title}</h3>
                <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed text-ink-700">
                  {tier.bullets.map((b) => (
                    <li key={b} className="leading-snug">{b}</li>
                  ))}
                </ul>
                {tier.citations && tier.citations.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {tier.citations.map((c) => (
                      <li
                        key={c}
                        className="rounded-sm border border-border-subtle bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] text-ink-500"
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-6 max-w-3xl rounded-md border border-border-subtle bg-ink-50 p-4 text-sm leading-relaxed text-ink-700">
        Detailed technical configurations (TLS versions, cipher suites,
        hardening benchmarks, key management) will be finalized during
        Phase 2 (Requirements Analysis &amp; Design) and approved with the
        ministry&apos;s information-security function. This page presents the
        posture; specifics follow.
      </p>
    </SectionShell>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Section 6 — Hosting & Deployment                            */
/* ─────────────────────────────────────────────────────────── */

function Section6(): JSX.Element {
  return (
    <SectionShell
      id="hosting"
      eyebrow="Section 6"
      title="Hosting & Deployment"
      citation="RFP Scope Document §1.0 (deployment locale) · §4.1 p.101 (Backup & Recovery)"
    >
      <div className="grid gap-3 md:grid-cols-3">
        {HOSTING.map((block) => (
          <Card key={block.id}>
            <h3 className="text-md font-bold text-ink-900">{block.title}</h3>
            <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed text-ink-700">
              {block.bullets.map((b) => (
                <li key={b} className="leading-snug">{b}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </SectionShell>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Section 7 — RBAC Matrix                                     */
/* ─────────────────────────────────────────────────────────── */

const APP_LABELS_EN: Record<AppKey, string> = {
  admin:          'Admin',
  applicant:      'Applicant',
  committee:      'Committees',
  board:          'Board',
  investigations: 'Investigations',
  medical:        'Medical',
  barcode:        'Barcode',
  biometric:      'Biometric',
  exams:          'Exams',
  architecture:   'Architecture',
};

const ROLE_LABELS_EN: Record<Role, string> = {
  super_admin:     'Super Admin',
  committee_admin: 'Committee Admin',
  committee_user:  'Committee User',
  medical_admin:   'Medical Admin',
  medical_doctor:  'Medical Doctor',
  investigator:    'Investigator',
  board_admin:     'Board Admin / Secretary',
  exams_admin:     'Exams Admin',
  biometric_user:  'Biometric Operator',
  records_clerk:   'Records Clerk',
  applicant:       'Applicant',
};

function Section7(): JSX.Element {
  const apps = APP_KEYS.filter((a): a is Exclude<AppKey, 'architecture'> => a !== 'architecture');

  return (
    <SectionShell
      id="rbac"
      eyebrow="Section 7"
      title="RBAC Matrix"
      subtitle="11 roles × 9 applications. Tick = has access. Detailed permissions (read / write / approve / audit-view) are enforced server-side per operation."
      citation="RFP Scope Document §1.1 p.11 (role scoping) · src/features/auth/rbac.ts"
    >
      <Card>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-ink-50 text-[10px] uppercase tracking-[0.14em] text-ink-500">
                  <th className="sticky left-0 z-10 bg-ink-50 px-3 py-2 text-left">Role</th>
                  {apps.map((a) => (
                    <th key={a} className="px-2 py-2 text-center font-medium">
                      {APP_LABELS_EN[a]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLES.map((role: Role, ri) => {
                  const def = ROLE_DEFINITIONS[role];
                  return (
                    <tr
                      key={role}
                      className={
                        'border-b border-border-subtle last:border-b-0 ' +
                        (ri % 2 === 0 ? 'bg-surface-card' : 'bg-ink-50/40')
                      }
                    >
                      <td className="sticky left-0 z-[1] bg-inherit px-3 py-2">
                        <span className="block font-medium text-ink-900">{ROLE_LABELS_EN[role]}</span>
                        <span className="font-mono text-[10px] text-ink-500" dir="ltr">
                          {role}
                        </span>
                      </td>
                      {apps.map((a) => {
                        const has = def.apps.includes(a);
                        return (
                          <td key={a} className="text-center">
                            {has ? (
                              <span
                                aria-label={`${ROLE_LABELS_EN[role]} has access to ${APP_LABELS_EN[a]}`}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-teal-500 text-white"
                              >
                                <Check size={12} strokeWidth={2.5} aria-hidden />
                              </span>
                            ) : (
                              <span
                                aria-label={`${ROLE_LABELS_EN[role]} does not have access to ${APP_LABELS_EN[a]}`}
                                className="inline-flex h-6 w-6 items-center justify-center text-ink-300"
                              >
                                <Minus size={10} strokeWidth={1.75} aria-hidden />
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-end gap-4 text-[11px] text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-teal-500 text-white">
                <Check size={9} strokeWidth={2.5} aria-hidden />
              </span>
              Has access
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center text-ink-300">
                <Minus size={9} strokeWidth={1.75} aria-hidden />
              </span>
              No access
            </span>
          </div>
        </CardBody>
      </Card>
    </SectionShell>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Section 8 — Audit & Compliance                              */
/* ─────────────────────────────────────────────────────────── */

function Section8(): JSX.Element {
  return (
    <SectionShell
      id="audit"
      eyebrow="Section 8"
      title="Audit & Compliance"
      citation="RFP Scope Document §3.4 pp.9, 14 · §4.1 pp.100–101 · §4.2 pp.103–104"
    >
      <Card>
        <CardHeader title="Audit posture" subtitle="Every change is recoverable; every read on restricted data is accountable." />
        <CardBody>
          <ul className="grid gap-2 text-sm leading-relaxed text-ink-700 md:grid-cols-2">
            <li>· Audit trail on every Create / Update / Delete (RFP Scope Document §3.4).</li>
            <li>· View-level audit on Investigations data (RFP Scope Document §2.3).</li>
            <li>· Audit log retention: per ministry policy, default 7 years.</li>
            <li>· Audit log is append-only and stored separately from the OLTP database.</li>
          </ul>
        </CardBody>
      </Card>

      <Card className="mt-3">
        <CardHeader title="Source-code ownership" subtitle="RFP Scope Document §4.2 pp.103–104." />
        <CardBody>
          <p className="text-sm leading-relaxed text-ink-700">
            Full source-code delivery to the ministry on acceptance — no
            encrypted, obfuscated, or hidden parts. Build pipelines and
            dependency manifests are delivered alongside the source so the
            ministry can independently rebuild the system.
          </p>
        </CardBody>
      </Card>

      <Card className="mt-3">
        <CardHeader title="Regulatory &amp; standards alignment" />
        <CardBody>
          <ul className="grid gap-2 text-sm leading-relaxed text-ink-700 md:grid-cols-2">
            <li>
              <span className="font-medium text-ink-900">ISO/IEC 27001 alignment.</span>{' '}
              Information-security controls mapped during Phase 2; certification,
              if pursued, is a separate process owned by the ministry.
            </li>
            <li>
              <span className="font-medium text-ink-900">
                Egyptian Personal Data Protection Law (Law 151 of 2020).
              </span>{' '}
              Applicant-consent flow, data-subject rights, and breach-notification
              procedures embedded in the system.
            </li>
          </ul>
        </CardBody>
      </Card>

      <Card className="mt-3">
        <CardHeader title="Acceptance criteria" subtitle="RFP Scope Document §4.1 pp.100–101 — the six gates." />
        <CardBody>
          <ul className="grid gap-2 text-sm leading-relaxed text-ink-700 md:grid-cols-3">
            <li>· Fit-to-Requirements</li>
            <li>· Usability</li>
            <li>· Performance</li>
            <li>· Security</li>
            <li>· Code Review</li>
            <li>· Backup &amp; Recovery</li>
          </ul>
        </CardBody>
      </Card>
    </SectionShell>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Section 9 — Non-Functional Targets                          */
/* ─────────────────────────────────────────────────────────── */

function Section9(): JSX.Element {
  const columns: DataTableColumn<NfrRow>[] = [
    { key: 'metric', label: 'Metric', accessor: 'metric', width: 320 },
    {
      key: 'target',
      label: 'Target',
      width: 220,
      render: (row) => (
        <span className="font-numeric tnum font-medium text-ink-900">{row.target}</span>
      ),
    },
    { key: 'notes', label: 'Notes', accessor: 'notes' },
  ];

  return (
    <SectionShell
      id="nfr"
      eyebrow="Section 9"
      title="Non-Functional Targets"
      subtitle="Bidder-proposed baselines. Final SLA values are negotiated and documented during Phase 2 with the ministry's operations function."
      citation="RFP Scope Document §4.1 pp.100–101"
    >
      <Card>
        <DataTable<NfrRow>
          columns={columns}
          data={NFRS as readonly NfrRow[]}
          density="default"
        />
      </Card>
    </SectionShell>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* SectionShell — anchor target + heading + spacing            */
/* ─────────────────────────────────────────────────────────── */

interface SectionShellProps {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  citation?: string;
  children: React.ReactNode;
}

function SectionShell({ id, eyebrow, title, subtitle, citation, children }: SectionShellProps): JSX.Element {
  return (
    <section id={id} className="arch-section scroll-mt-24">
      <header className="mb-5 border-b border-border-subtle pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-bold leading-tight text-ink-900">{title}</h2>
        {subtitle && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-700">{subtitle}</p>
        )}
        {citation && (
          <p className="mt-2 font-mono text-[11px] text-ink-500">{citation}</p>
        )}
      </header>
      {children}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* PrintHeader — visible only when @media print fires          */
/* ─────────────────────────────────────────────────────────── */

function PrintHeader({ generatedAt }: { generatedAt: string }): JSX.Element {
  return (
    <div className="arch-print-header print-only" aria-hidden>
      <div className="arch-print-stripe" />
      <div className="arch-print-headband">
        <div>
          <p className="font-ar-display arch-print-ministry">
            وزارة الداخلية · أكاديمية الشرطة
          </p>
          <p className="arch-print-ministry-en">Ministry of Interior — Police Academy</p>
        </div>
        <div className="arch-print-doc-meta">
          <p>Police Academy Admissions System</p>
          <p>Architecture &amp; Security Posture · Technical Reference</p>
          <p>Generated {generatedAt}</p>
        </div>
      </div>
    </div>
  );
}
