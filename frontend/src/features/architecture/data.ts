/**
 * data.ts — content for the /architecture technical reference page.
 *
 * Every RFP Scope Document citation in this file traces to the 108-page RFP Scope Document
 * (كرّاسة الشروط والمواصفات الفنية). Page numbers refer to that document
 * unless explicitly noted otherwise.
 *
 * This file is deliberately data-only: the page renders it; it does not
 * depend on React or DOM types so it can be reused in future generation
 * paths (PDF, JSON, etc.).
 */

/* ── §2 (System Architecture) is rendered by SystemDiagram.tsx ─
   The legacy LayerSpec data lived here; it was removed when the
   four-layer diagram was replaced by the comprehensive single-canvas
   SystemDiagram. The diagram itself is the data source now. */

/* ── §3 — Nine Applications ────────────────────────────────── */

export interface AppRow {
  num: string;
  app: string;
  surface: 'Public' | 'Private';
  primaryUsers: string;
  hostingTier: string;
  citation: string;
}

export const APPLICATIONS: readonly AppRow[] = [
  { num: '1.1', app: 'Administrator Site',          surface: 'Public',  primaryUsers: 'Officers (MOIPASS auth)',     hostingTier: 'MoI Data Center',                         citation: '§1.1 pp.5–14'  },
  { num: '1.2', app: 'Applicant Site',              surface: 'Public',  primaryUsers: 'Citizens (NID + SMS-OTP)',    hostingTier: 'MoI Data Center',                         citation: '§1.2 pp.15–37' },
  { num: '2.1', app: 'Admission Committees',        surface: 'Private', primaryUsers: 'Committee members',           hostingTier: 'Academy Intranet',                        citation: '§2.1 pp.38–55' },
  { num: '2.2', app: 'Board / Secretariat',         surface: 'Private', primaryUsers: 'Board members',               hostingTier: 'Academy Intranet',                        citation: '§2.2 pp.61–63' },
  { num: '2.3', app: 'Investigations',              surface: 'Private', primaryUsers: 'Investigators',               hostingTier: 'Academy Intranet (restricted segment)',   citation: '§2.3 pp.64–69' },
  { num: '2.4', app: 'Medical Commission',          surface: 'Private', primaryUsers: 'Doctors (8 stations)',        hostingTier: 'Academy Intranet',                        citation: '§2.4 pp.70–77' },
  { num: '2.5', app: 'Barcode',                     surface: 'Private', primaryUsers: 'Front-desk staff',            hostingTier: 'Academy Intranet',                        citation: '§2.5 pp.78–82' },
  { num: '2.6', app: 'Biometric',                   surface: 'Private', primaryUsers: 'Security staff',              hostingTier: 'Academy Intranet',                        citation: '§2.6 pp.83–87' },
  { num: '2.7', app: 'Question Bank & e-Exams',     surface: 'Private', primaryUsers: 'Exam admins, applicants',     hostingTier: 'Academy Intranet + exam-room subnet',     citation: '§2.7 pp.88–99' },
];

/* ── §4 — Integrations ─────────────────────────────────────── */

export interface IntegrationSpec {
  id: string;
  title: string;
  purpose: string;
  direction: string;
  authMethod: string;
  dataExchanged: string;
  frequency: string;
  failureHandling: string;
  citation: string;
}

export const INTEGRATIONS: readonly IntegrationSpec[] = [
  {
    id: 'moipass',
    title: 'MOIPASS — Ministry of Interior Digital Verification Platform',
    purpose: 'Authenticate officers across all staff-facing applications.',
    direction: 'Outbound (we call them).',
    authMethod: 'Bidder-supplied service credentials over TLS; mutual authentication where ministry policy requires.',
    dataExchanged: 'National ID → 4-part name, military rank, department, and assigned role.',
    frequency: 'Per officer login + token refresh.',
    failureHandling: 'If MOIPASS is unreachable, officer login degrades to locally-cached credentials with reduced privileges and an audit-flagged warning. Cache TTL is set during Phase 2.',
    citation: 'RFP Scope Document §1.1 p.10 · §3.1 p.7',
  },
  {
    id: 'moe',
    title: 'Ministry of Education API',
    purpose: 'Verify applicant secondary-school certificates (Thanaweya Amma, technical streams).',
    direction: 'Outbound (we call them).',
    authMethod: 'Bearer token, IP-restricted, rate-limited per ministry policy.',
    dataExchanged: 'National ID + certificate year → full transcript, total score, percentage, school details.',
    frequency: 'One call during the applicant Stage 4 (Educational Data) submission.',
    failureHandling: 'Transient failures retry with exponential backoff. On persistent failure, manual override is allowed with a written reason, fully captured in the audit trail.',
    citation: 'RFP Scope Document §1.2 pp.17–19 · §3.1 p.7',
  },
  {
    id: 'azhar',
    title: 'Al-Azhar Certificates API',
    purpose: 'Verify Azhari secondary-school certificates (parallel of the MoE flow).',
    direction: 'Outbound (we call them).',
    authMethod: 'API key, IP-restricted, rate-limited.',
    dataExchanged: 'National ID + certificate year → transcript, total score, percentage, stream (scientific/literary), school details.',
    frequency: 'One call during the applicant Stage 4 submission for Azhari applicants.',
    failureHandling: 'Same retry + manual-override-with-reason behaviour as the MoE integration. Override is logged.',
    citation: 'RFP Scope Document §1.2 pp.17–19',
  },
  {
    id: 'payment',
    title: 'Payment Gateway (Fawry + Card)',
    purpose: 'Application-fee payment for applicants.',
    direction: 'Outbound to initiate; inbound webhook for callback.',
    authMethod: 'Vendor API keys for outbound calls; signed webhooks (HMAC) for inbound callbacks.',
    dataExchanged: 'Payment intent → reference number / Fawry code; callback with payment status + transaction reference.',
    frequency: 'Per applicant payment + a daily reconciliation batch.',
    failureHandling: 'Idempotent retries on outbound calls; webhook deduplication; manual reconciliation flow for disputed or orphaned payments, with full audit capture.',
    citation: 'RFP Scope Document §1.2 p.19 · §3.1 p.7',
  },
  {
    id: 'hardware',
    title: 'Hardware Vendor SDK Layer',
    purpose: 'Drive the 130 Suprema FaceStation F2 biometric devices and barcode scanners. Hardware is supplied separately by the ministry; this platform integrates only via the vendor SDK.',
    direction: 'Bidirectional — commands out, events in.',
    authMethod: 'Per-device vendor SDK credentials, scoped to the device serial.',
    dataExchanged: 'Enrollment templates, verification queries, liveness-check results, device health events.',
    frequency: 'Real-time during enrollment and verification operations.',
    failureHandling: 'Device offline → graceful UI degradation with a documented manual fallback path; events are queued and replayed on reconnect.',
    citation: 'RFP Scope Document §2.6 pp.83–87',
  },
  {
    id: 'internal',
    title: 'Internal Cross-Application Integration',
    purpose: 'Coordinate workflows across the nine applications (e.g., committee approval triggers investigation; biometric verification gates exam-room entry).',
    direction: 'Internal service-to-service via the middleware service bus.',
    authMethod: 'Mutual TLS service-to-service.',
    dataExchanged: 'Domain events: applicant.approved, exam.completed, investigation.opened, medical.passed, decision.recorded.',
    frequency: 'Real-time, event-driven.',
    failureHandling: 'Event sourcing with replay; transactional outbox pattern on the producer side; idempotent consumers.',
    citation: 'RFP Scope Document §3.2 p.40',
  },
];

/* ── §5 — Security Tiers ───────────────────────────────────── */

export interface SecurityTier {
  num: number;
  title: string;
  bullets: readonly string[];
  citations?: readonly string[];
}

export const SECURITY_TIERS: readonly SecurityTier[] = [
  {
    num: 1,
    title: 'Network Boundary',
    bullets: [
      'Public surface in the MoI data-centre DMZ; private surface on an air-gapped academy intranet with documented integration egress only.',
      'Network segmentation between application zones, database zones, and management zones.',
      'Web Application Firewall protection on every public-facing endpoint.',
    ],
  },
  {
    num: 2,
    title: 'Transport',
    bullets: [
      'Encryption in transit on every connection — public, private, and internal service-to-service.',
      'Mutual authentication for service-to-service traffic.',
      'Strict transport-security headers on browser-facing surfaces.',
    ],
  },
  {
    num: 3,
    title: 'Identity & Access',
    bullets: [
      'MOIPASS for officer authentication.',
      'National ID + SMS-OTP for applicant authentication.',
      '11-role RBAC with scope-by-cycle and scope-by-governorate.',
      'Session timeout and concurrent-session detection.',
      'Two-factor required for high-privilege roles (super_admin, investigator, board_admin).',
    ],
    citations: ['RFP Scope Document §1.1 p.10 (MOIPASS)', 'RFP Scope Document §1.2 p.16 (NID+OTP)', 'RFP Scope Document §1.1 p.11 (role scoping)'],
  },
  {
    num: 4,
    title: 'Application',
    bullets: [
      'OWASP Top 10 mitigations baked into framework defaults and reviewed during the Code Review acceptance gate.',
      'Input validation at every form via centralized schema (zod).',
      'Output encoding for all rendered content.',
      'Server-side authorization checks on every protected operation — no client-side trust.',
    ],
    citations: ['RFP Scope Document §4.1 p.100 (Code Review acceptance)'],
  },
  {
    num: 5,
    title: 'Data',
    bullets: [
      'Encryption at rest for all databases and biometric template storage.',
      'Biometric data stored as templates only, never raw images.',
      'Audit log captures every Create/Update/Delete with user, timestamp, and before/after diff.',
      'Investigations data carries view-level audit (every read logged, not just writes).',
      'Backup and Recovery procedures verified during acceptance testing.',
    ],
    citations: ['RFP Scope Document §2.6 p.83 (templates only)', 'RFP Scope Document §3.4 pp.9, 14 (CUD audit)', 'RFP Scope Document §4.1 p.101 (Backup & Recovery)'],
  },
  {
    num: 6,
    title: 'Operational',
    bullets: [
      'Continuous vulnerability scanning during operation.',
      'Patch-management cadence aligned with vendor advisories.',
      'Incident-response runbook with escalation to the ministry CISO function.',
      'Annual penetration testing.',
      'Code Review acceptance gate before each release.',
    ],
    citations: ['RFP Scope Document §4.1 p.100 (Code Review)'],
  },
];

/* ── §6 — Hosting & Deployment ─────────────────────────────── */

export interface HostingBlock {
  id: 'public' | 'private' | 'dr';
  title: string;
  bullets: readonly string[];
}

export const HOSTING: readonly HostingBlock[] = [
  {
    id: 'public',
    title: '6.1 — Public Platform Hosting',
    bullets: [
      'Hosted at the Ministry of Interior main IT data centre per RFP Scope Document requirement (non-negotiable).',
      'Application stack containerized for repeatable deployment and hardening per the CIS benchmark family.',
      'Public DNS managed by the ministry; TLS certificates issued from a ministry-approved CA.',
      'DDoS protection at the network edge.',
    ],
  },
  {
    id: 'private',
    title: '6.2 — Private Platform Hosting',
    bullets: [
      'Hosted on the Police Academy intranet per RFP Scope Document requirement.',
      'Air-gapped from the public internet except for documented integration egress (MOIPASS, MoE/Al-Azhar APIs, Payment Gateway callbacks).',
      'Identical container stack as the public side for operational consistency.',
      'Separate management plane reserved for academy IT staff.',
    ],
  },
  {
    id: 'dr',
    title: '6.3 — Disaster Recovery & Continuity',
    bullets: [
      'Database replication to a ministry-approved secondary site.',
      'RPO target: 15 minutes (subject to ministry approval during Phase 2).',
      'RTO target: 4 hours for critical services, 24 hours for full system.',
      'Annual DR drill with a documented runbook.',
      'Backup retention per ministry data-retention policy.',
    ],
  },
];

/* ── §9 — Non-Functional Targets ───────────────────────────── */

export interface NfrRow {
  metric: string;
  target: string;
  notes: string;
}

export const NFRS: readonly NfrRow[] = [
  { metric: 'Application uptime (production)',     target: '99.5%',                   notes: 'Per support tier; excludes scheduled maintenance windows.' },
  { metric: 'Page load (academy LAN)',              target: '< 2s',                    notes: '95th percentile, polished routes.' },
  { metric: 'Page load (public internet)',          target: '< 3s',                    notes: '95th percentile, applicant flow.' },
  { metric: 'Concurrent applicant sessions',        target: '5,000',                   notes: 'Peak applicant registration window.' },
  { metric: 'Concurrent staff sessions',            target: '500',                     notes: 'Peak operational hours.' },
  { metric: 'Audit log write latency',              target: '< 100 ms',                notes: 'Synchronous to operation.' },
  { metric: 'Backup recovery point (RPO)',          target: '15 min',                  notes: 'Subject to ministry approval.' },
  { metric: 'Backup recovery time (RTO)',           target: '4 h critical / 24 h full', notes: 'Subject to ministry approval.' },
  { metric: 'API response (p95) — internal',        target: '< 500 ms',                notes: 'Internal endpoints.' },
  { metric: 'API response (p95) — external',        target: '< 1 s',                   notes: 'External integration endpoints.' },
];

/* ── §1 — Executive Overview metric tiles ─────────────────── */

export interface ExecTile {
  value: string;
  label: string;
}

export const EXEC_TILES: readonly ExecTile[] = [
  { value: '9',  label: 'Applications'           },
  { value: '11', label: 'User Roles'             },
  { value: '4',  label: 'Architectural Layers'   },
  { value: '5',  label: 'External Integrations'  },
];

/* ── Deployment & Concurrency stat band (anchored to the diagram) ─ */

export interface ScaleTile {
  value: string;
  label: string;
  detail: string;
}

export const SCALE_TILES: readonly ScaleTile[] = [
  {
    value: '5,000',
    label: 'Peak concurrent applicants',
    detail: 'Registration window — horizontally scaled behind the load balancer.',
  },
  {
    value: '500',
    label: 'Concurrent staff sessions',
    detail: 'Across all 7 intranet apps during peak operational hours.',
  },
  {
    value: '99.5%',
    label: 'Production uptime SLA',
    detail: 'Active/standby DB · 4 h RTO · 15 min RPO.',
  },
  {
    value: '< 2 s',
    label: 'Page load p95 (LAN)',
    detail: '< 3 s public · < 500 ms internal API · < 100 ms audit write.',
  },
];

/* ── Section index for the TOC ────────────────────────────── */

export interface SectionMeta {
  id: string;
  num: number;
  label: string;
}

export const SECTIONS: readonly SectionMeta[] = [
  { id: 'layers',         num: 1, label: 'Architecture & Deployment' },
  { id: 'overview',       num: 2, label: 'Executive Overview'        },
  { id: 'applications',   num: 3, label: 'The Nine Applications'     },
  { id: 'integrations',   num: 4, label: 'Integrations'              },
  { id: 'security',       num: 5, label: 'Security Architecture'     },
  { id: 'hosting',        num: 6, label: 'Hosting & Deployment'      },
  { id: 'rbac',           num: 7, label: 'RBAC Matrix'               },
  { id: 'audit',          num: 8, label: 'Audit & Compliance'        },
  { id: 'nfr',            num: 9, label: 'Non-Functional Targets'    },
];

