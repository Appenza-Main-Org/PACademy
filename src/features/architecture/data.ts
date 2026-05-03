/**
 * data.ts — content for the /architecture technical reference page.
 *
 * Every karasa citation in this file traces to the 108-page Karasa
 * (كرّاسة الشروط والمواصفات الفنية). Page numbers refer to that document
 * unless explicitly noted otherwise.
 *
 * This file is deliberately data-only: the page renders it; it does not
 * depend on React or DOM types so it can be reused in future generation
 * paths (PDF, JSON, etc.).
 */

/* ── §2 — Four Layers ──────────────────────────────────────── */

export type LayerId = 'public' | 'middleware' | 'private' | 'database';

export interface LayerSpec {
  id: LayerId;
  title: string;
  surface: 'Internet' | 'Internet ↔ Intranet' | 'Intranet' | 'Internal';
  whatRuns: readonly string[];
  boundary: string;
  flow: string;
  citation: string;
}

export const LAYERS: readonly LayerSpec[] = [
  {
    id: 'public',
    title: 'Public Portals',
    surface: 'Internet',
    whatRuns: [
      'Administrator Site (Application 1.1)',
      'Applicant Site (Application 1.2)',
      'Public DNS, TLS termination, WAF',
    ],
    boundary: 'Hosted in the Ministry of Interior data-centre DMZ. Direct internet exposure, perimeter-protected by WAF and rate-limiting at the network edge.',
    flow: 'Inbound HTTPS from citizens and officers. Outbound traffic only to the middleware layer over mutually-authenticated channels.',
    citation: 'Karasa §1.1 pp.5–14 · §1.2 pp.15–37 · §9 architecture overview',
  },
  {
    id: 'middleware',
    title: 'Middleware Layer',
    surface: 'Internet ↔ Intranet',
    whatRuns: [
      'API Gateway (authentication, authorization, throttling)',
      'Service Bus (cross-application event distribution)',
      'Identity broker (MOIPASS adapter, NID+OTP issuer, RBAC enforcement)',
      'Integration adapters (MoE, Al-Azhar, Payment Gateway, Hardware SDK)',
    ],
    boundary: 'Sits in a dedicated network segment with strict egress allow-lists. The only path between the public DMZ and the private intranet runs through this layer.',
    flow: 'Receives requests from public portals and external integrations; routes domain operations to private portals; emits events back to subscribers.',
    citation: 'Karasa §3.1 p.7 · §3.2 p.40',
  },
  {
    id: 'private',
    title: 'Private Portals',
    surface: 'Intranet',
    whatRuns: [
      'Admission Committees (Application 2.1)',
      'Board / Secretariat (Application 2.2)',
      'Investigations (Application 2.3) — restricted',
      'Medical Commission (Application 2.4)',
      'Barcode (Application 2.5)',
      'Biometric (Application 2.6)',
      'Question Bank & e-Exams (Application 2.7)',
    ],
    boundary: 'Hosted on the Police Academy intranet, air-gapped from the public internet. Access is reachable only through the authenticated middleware layer.',
    flow: 'Inbound from middleware only. Outbound is limited to the database layer and audit pipeline.',
    citation: 'Karasa §2.1–§2.7 pp.38–99',
  },
  {
    id: 'database',
    title: 'Database Layer',
    surface: 'Internal',
    whatRuns: [
      'Primary OLTP database (applicants, decisions, workflow state)',
      'Reporting database (read-replica for analytics and exports)',
      'Audit database (append-only, separate retention policy)',
      'Object store (uploaded documents, biometric templates)',
    ],
    boundary: 'Reachable only from the middleware and private portal layers. Encryption at rest, no internet egress, replication to a ministry-approved DR site.',
    flow: 'Inbound writes from private portals and middleware. Replicated to the secondary site continuously; backups taken on the ministry retention schedule.',
    citation: 'Karasa §3.4 pp.9, 14 · §4.1 p.101 (Backup & Recovery)',
  },
];

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
    citation: 'Karasa §1.1 p.10 · §3.1 p.7',
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
    citation: 'Karasa §1.2 pp.17–19 · §3.1 p.7',
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
    citation: 'Karasa §1.2 pp.17–19',
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
    citation: 'Karasa §1.2 p.19 · §3.1 p.7',
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
    citation: 'Karasa §2.6 pp.83–87',
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
    citation: 'Karasa §3.2 p.40',
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
    citations: ['Karasa §1.1 p.10 (MOIPASS)', 'Karasa §1.2 p.16 (NID+OTP)', 'Karasa §1.1 p.11 (role scoping)'],
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
    citations: ['Karasa §4.1 p.100 (Code Review acceptance)'],
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
    citations: ['Karasa §2.6 p.83 (templates only)', 'Karasa §3.4 pp.9, 14 (CUD audit)', 'Karasa §4.1 p.101 (Backup & Recovery)'],
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
    citations: ['Karasa §4.1 p.100 (Code Review)'],
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
      'Hosted at the Ministry of Interior main IT data centre per Karasa requirement (non-negotiable).',
      'Application stack containerized for repeatable deployment and hardening per the CIS benchmark family.',
      'Public DNS managed by the ministry; TLS certificates issued from a ministry-approved CA.',
      'DDoS protection at the network edge.',
    ],
  },
  {
    id: 'private',
    title: '6.2 — Private Platform Hosting',
    bullets: [
      'Hosted on the Police Academy intranet per Karasa requirement.',
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

/* ── Section index for the TOC ────────────────────────────── */

export interface SectionMeta {
  id: string;
  num: number;
  label: string;
}

export const SECTIONS: readonly SectionMeta[] = [
  { id: 'overview',       num: 1, label: 'Executive Overview'       },
  { id: 'layers',         num: 2, label: 'The Four Layers'          },
  { id: 'applications',   num: 3, label: 'The Nine Applications'    },
  { id: 'integrations',   num: 4, label: 'Integrations'             },
  { id: 'security',       num: 5, label: 'Security Architecture'    },
  { id: 'hosting',        num: 6, label: 'Hosting & Deployment'     },
  { id: 'rbac',           num: 7, label: 'RBAC Matrix'              },
  { id: 'audit',          num: 8, label: 'Audit & Compliance'       },
  { id: 'nfr',            num: 9, label: 'Non-Functional Targets'   },
];

