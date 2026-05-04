/**
 * SystemDiagram — single-canvas architecture diagram for /architecture §2.
 *
 * One SVG showing all four bands of the system on one page:
 *  - External systems (5 integrations)
 *  - Public surface (2 applications)
 *  - Network boundary
 *  - Private surface (7 applications)
 *  - Middleware band
 *  - Data layer (3 databases — Primary, Reporting, Audit)
 *
 * Plus four classes of connector:
 *  - Teal solid    → external integrations entering the apps
 *  - Gold dashed   → internal cross-app workflow signals
 *  - Ink solid     → application persistence into Primary / Reporting DB
 *  - Terra dotted  → audit writes (every app writes to Audit DB)
 *
 * Interactivity:
 *  - Hover any rectangle → ring + dim non-related connectors
 *  - Hover any connector → thicken + show details
 *  - Click any rectangle → smooth-scroll to its detailed section
 *  - All elements keyboard-focusable, Enter triggers click
 *  - Below-diagram info panel reflects hovered/focused element
 *
 * Responsive:
 *  - >=1280px: full diagram, all labels visible
 *  - 1024–1280px: SVG scales, labels stay
 *  - 768–1024px: minor connector labels hidden via CSS
 *  - <768px:  stacked card fallback (FallbackCardView)
 *
 * Print:
 *  - All hover dimming off, all opacity 1, labels visible.
 *  - Static legend below the SVG renders only in print.
 *  - Slightly thicker strokes per DESIGN_SYSTEM §6.4.
 *
 * Inline SVG only — no D3, no Mermaid, no chart libraries.
 * All colors via design-system tokens (var(--token)).
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/shared/lib/cn';

/* ── viewBox ───────────────────────────────────────────────── */
const VB_W = 1600;
const VB_H = 1000;

/* ── Region geometry ──────────────────────────────────────── */
// External row
const EXT_Y = 70;
const EXT_W = 180;
const EXT_H = 60;
const EXT_CX = [192, 496, 800, 1104, 1408] as const;

// Public surface tint
const PUB_TINT = { x: 60, y: 165, w: 1480, h: 215 };
// Public app boxes
const PUB_Y = 215;
const PUB_W = 280;
const PUB_H = 80;
const PUB_CX = [630, 970] as const;

// Network boundary
const BOUNDARY_Y = 395;

// Private surface tint
const PRIV_TINT = { x: 60, y: 410, w: 1480, h: 290 };
// Private app boxes (4-3 grid)
const PRIV_W = 180;
const PRIV_H = 70;
const PRIV_R1_Y = 445;
const PRIV_R1_CX = [470, 690, 910, 1130] as const;
const PRIV_R2_Y = 555;
const PRIV_R2_CX = [580, 800, 1020] as const;

// Middleware pill
const MID = { x: 200, y: 740, w: 1200, h: 50, rx: 25 };

// Data buses — collected rails so connectors don't spaghetti
const DATA_BUS_Y = 820;
const AUDIT_BUS_Y = 832;

// Data layer — three cylinders
const DB_TOP = 870; // top of cylinder body
const DB_W = 220;
const DB_H = 100;
const DB_CX = [500, 800, 1100] as const;

/* ── Deployment / scale annotation per node ────────────────── */
/* Pulled inline so the diagram is self-documenting for evaluators. */
const SCALE_BADGE: Record<string, string> = {
  // public surface — autoscaling stateless containers behind a load balancer
  admin:          'Autoscaled · ×N',
  applicant:      'Autoscaled · ×N',
  // private surface — fixed-size HA cluster (3 nodes)
  committee:      'HA · ×3',
  board:          'HA · ×3',
  investigations: 'HA · ×3',
  medical:        'HA · ×3',
  barcode:        'HA · ×3',
  biometric:      'HA · ×3',
  exams:          'HA · ×3',
  // data tier — three roles
  primary:        'Active · Sync standby',
  reporting:      'Read replica',
  audit:          'Append-only · WORM',
};

/* ── Node model ────────────────────────────────────────────── */
type NodeKind = 'external' | 'public-app' | 'private-app' | 'middleware' | 'database';

interface DiagNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** rect coords (cylinders compute body box) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** per-app accent (CSS var) — undefined for externals/middleware. */
  accent?: string;
  citation: string;
  purpose: string;
  /** Section id to scroll to on click. */
  scrollTarget: string;
}

/* ── Externals ─────────────────────────────────────────────── */
const EXTERNALS: readonly DiagNode[] = [
  { id: 'moipass',  kind: 'external', label: 'MOIPASS',             x: EXT_CX[0] - EXT_W / 2, y: EXT_Y, w: EXT_W, h: EXT_H, citation: '§1.1 p.10',     purpose: 'Authenticate officers across all staff-facing apps.', scrollTarget: 'integrations' },
  { id: 'moe',      kind: 'external', label: 'Min. of Education',   x: EXT_CX[1] - EXT_W / 2, y: EXT_Y, w: EXT_W, h: EXT_H, citation: '§1.2 pp.17–19', purpose: 'Verify applicant secondary-school certificates.',     scrollTarget: 'integrations' },
  { id: 'azhar',    kind: 'external', label: 'Al-Azhar',            x: EXT_CX[2] - EXT_W / 2, y: EXT_Y, w: EXT_W, h: EXT_H, citation: '§1.2 pp.17–19', purpose: 'Verify Azhari secondary-school certificates.',         scrollTarget: 'integrations' },
  { id: 'payment',  kind: 'external', label: 'Payment Gateway',     x: EXT_CX[3] - EXT_W / 2, y: EXT_Y, w: EXT_W, h: EXT_H, citation: '§1.2 p.19',     purpose: 'Application-fee payment (Fawry + card) with webhook.',scrollTarget: 'integrations' },
  { id: 'hardware', kind: 'external', label: 'Hardware SDK',        x: EXT_CX[4] - EXT_W / 2, y: EXT_Y, w: EXT_W, h: EXT_H, citation: '§2.6 pp.83–87', purpose: 'Vendor SDK for Suprema biometric devices and barcode scanners.', scrollTarget: 'integrations' },
];

/* ── Public apps ───────────────────────────────────────────── */
const PUBLIC_APPS: readonly DiagNode[] = [
  { id: 'admin',     kind: 'public-app', label: 'Administrator Site', x: PUB_CX[0] - PUB_W / 2, y: PUB_Y, w: PUB_W, h: PUB_H, accent: 'var(--teal-600)', citation: '§1.1 pp.5–14',  purpose: 'Officer-facing administration of cycles, applicants, and reference data.', scrollTarget: 'applications' },
  { id: 'applicant', kind: 'public-app', label: 'Applicant Site',     x: PUB_CX[1] - PUB_W / 2, y: PUB_Y, w: PUB_W, h: PUB_H, accent: 'var(--teal-500)', citation: '§1.2 pp.15–37', purpose: 'Citizen-facing 11-stage application portal.',                              scrollTarget: 'applications' },
];

/* ── Private apps ──────────────────────────────────────────── */
const PRIVATE_APPS: readonly DiagNode[] = [
  // Row 1
  { id: 'committee',      kind: 'private-app', label: 'Committees',     x: PRIV_R1_CX[0] - PRIV_W / 2, y: PRIV_R1_Y, w: PRIV_W, h: PRIV_H, accent: 'var(--gold-500)',  citation: '§2.1 pp.38–55', purpose: 'Admission committees — dossier review and two-phase signoff.',  scrollTarget: 'applications' },
  { id: 'board',          kind: 'private-app', label: 'Board',          x: PRIV_R1_CX[1] - PRIV_W / 2, y: PRIV_R1_Y, w: PRIV_W, h: PRIV_H, accent: 'var(--gold-700)',  citation: '§2.2 pp.61–63', purpose: 'Board / Secretariat sessions, decisions, members.',              scrollTarget: 'applications' },
  { id: 'investigations', kind: 'private-app', label: 'Investigations', x: PRIV_R1_CX[2] - PRIV_W / 2, y: PRIV_R1_Y, w: PRIV_W, h: PRIV_H, accent: 'var(--terra-500)', citation: '§2.3 pp.64–69', purpose: 'Restricted security investigations.',                              scrollTarget: 'applications' },
  { id: 'medical',        kind: 'private-app', label: 'Medical',        x: PRIV_R1_CX[3] - PRIV_W / 2, y: PRIV_R1_Y, w: PRIV_W, h: PRIV_H, accent: 'var(--teal-400)',  citation: '§2.4 pp.70–77', purpose: 'Medical commission — 8 stations and master certificate.',         scrollTarget: 'applications' },
  // Row 2
  { id: 'barcode',   kind: 'private-app', label: 'Barcode',          x: PRIV_R2_CX[0] - PRIV_W / 2, y: PRIV_R2_Y, w: PRIV_W, h: PRIV_H, accent: 'var(--ink-700)',   citation: '§2.5 pp.78–82', purpose: 'Front-desk barcode print + lookup + batch.',                       scrollTarget: 'applications' },
  { id: 'biometric', kind: 'private-app', label: 'Biometric',        x: PRIV_R2_CX[1] - PRIV_W / 2, y: PRIV_R2_Y, w: PRIV_W, h: PRIV_H, accent: 'var(--terra-400)', citation: '§2.6 pp.83–87', purpose: 'Biometric enrolment + verification (130 Suprema devices).',        scrollTarget: 'applications' },
  { id: 'exams',     kind: 'private-app', label: 'Question Bank',    x: PRIV_R2_CX[2] - PRIV_W / 2, y: PRIV_R2_Y, w: PRIV_W, h: PRIV_H, accent: 'var(--gold-600)',  citation: '§2.7 pp.88–99', purpose: 'Question bank, e-exams, results — proctored in exam-room subnet.', scrollTarget: 'applications' },
];

/* ── Databases ─────────────────────────────────────────────── */
const DATABASES: readonly DiagNode[] = [
  { id: 'primary',   kind: 'database', label: 'Primary DB',   x: DB_CX[0] - DB_W / 2, y: DB_TOP, w: DB_W, h: DB_H, accent: 'var(--ink-700)',   citation: '§3.4 pp.9, 14',     purpose: 'OLTP database — applicants, decisions, workflow state.', scrollTarget: 'audit' },
  { id: 'reporting', kind: 'database', label: 'Reporting DB', x: DB_CX[1] - DB_W / 2, y: DB_TOP, w: DB_W, h: DB_H, accent: 'var(--ink-600)',   citation: '§3.3 pp.9, 14',     purpose: 'Read replica for analytics and exports.',                 scrollTarget: 'audit' },
  { id: 'audit',     kind: 'database', label: 'Audit DB',     x: DB_CX[2] - DB_W / 2, y: DB_TOP, w: DB_W, h: DB_H, accent: 'var(--terra-700)', citation: '§3.4 pp.9, 14',     purpose: 'Append-only audit log — every CUD + investigations reads.', scrollTarget: 'audit' },
];

const ALL_NODES: readonly DiagNode[] = [
  ...EXTERNALS,
  ...PUBLIC_APPS,
  ...PRIVATE_APPS,
  ...DATABASES,
];

const APP_IDS: readonly string[] = [
  ...PUBLIC_APPS.map((n) => n.id),
  ...PRIVATE_APPS.map((n) => n.id),
];

/* ── Connectors ────────────────────────────────────────────── */
type ConnKind = 'external' | 'cross-app' | 'data' | 'audit';

interface DiagConn {
  id: string;
  kind: ConnKind;
  fromId: string;
  toId: string;
  /** Pre-built SVG path. */
  path: string;
  /** Mid-point label coords. */
  labelX?: number;
  labelY?: number;
  label?: string;
  /** Show on bidirectional. */
  bidirectional?: boolean;
  /** Hide label on tablet. */
  minor?: boolean;
  citation?: string;
  data?: string;
  auth?: string;
  purpose?: string;
}

/* External connectors (top → app top) ------------------------ */
// Mid-Y staggered between EXT bottom (y=130) and target top.
const EXT_CONNS: readonly DiagConn[] = [
  // moipass → admin (admin top-left at x=490, top-mid at 630/215)
  buildExternal('ext-moipass-admin', 'moipass', 'admin',     EXT_CX[0], 195, PUB_CX[0], PUB_Y, { label: 'Officer auth',    auth: 'mTLS / OAuth2',           data: 'NID → name, rank, dept', citation: '§1.1 p.10',     purpose: 'Authenticate officers across all staff-facing apps.' }),
  buildExternal('ext-moe-applicant', 'moe',     'applicant', EXT_CX[1], 175, PUB_CX[1], PUB_Y, { label: 'Cert verify',     auth: 'Bearer + IP allowlist',   data: 'NID + year → transcript', citation: '§1.2 pp.17–19', purpose: 'Verify Thanaweya / technical certificates.' }),
  buildExternal('ext-azhar-applicant', 'azhar', 'applicant', EXT_CX[2], 185, PUB_CX[1], PUB_Y, { label: 'Cert verify',     auth: 'API key + IP allowlist',  data: 'NID + year → transcript', citation: '§1.2 pp.17–19', purpose: 'Verify Azhari certificates.' }),
  buildExternal('ext-payment-applicant', 'payment', 'applicant', EXT_CX[3], 200, PUB_CX[1], PUB_Y, { label: 'Fee + callback', auth: 'API key + signed webhook', data: 'Payment intent ↔ ref',    citation: '§1.2 p.19',     purpose: 'Application-fee payment.', bidirectional: true }),
  // hardware → biometric (crosses network boundary visibly)
  buildBoundaryCross('ext-hw-biometric', 'hardware', 'biometric', EXT_CX[4], EXT_Y + EXT_H, PRIV_R2_CX[1], PRIV_R2_Y, { label: 'Device control', auth: 'Vendor SDK', data: 'Templates + verify', citation: '§2.6 pp.83–87', purpose: 'Drive Suprema biometric devices.' }),
  buildBoundaryCross('ext-hw-barcode',   'hardware', 'barcode',   EXT_CX[4], EXT_Y + EXT_H, PRIV_R2_CX[0], PRIV_R2_Y, { label: 'Scanner SDK',    auth: 'Vendor SDK', data: 'Scan events',         citation: '§2.5 pp.78–82', purpose: 'Drive barcode scanners.', minor: true }),
];

/* Cross-app connectors (gold dashed) ------------------------- */
const CROSS_CONNS: readonly DiagConn[] = [
  // committee → investigations (route above row 1)
  buildCrossAround(
    'x-committee-investigations',
    'committee',
    'investigations',
    PRIV_R1_CX[0], PRIV_R1_Y + PRIV_H / 2, // src right-edge mid (using cx for label, edge for path)
    PRIV_R1_CX[2], PRIV_R1_Y + PRIV_H / 2,
    420, // detour above row 1
    'Approval triggers case',
    '§3.2 p.40',
  ),
  // biometric → exams (adjacent, straight horizontal)
  {
    id: 'x-biometric-exams',
    kind: 'cross-app',
    fromId: 'biometric',
    toId: 'exams',
    path: `M ${PRIV_R2_CX[1] + PRIV_W / 2} ${PRIV_R2_Y + PRIV_H / 2} L ${PRIV_R2_CX[2] - PRIV_W / 2} ${PRIV_R2_Y + PRIV_H / 2}`,
    labelX: (PRIV_R2_CX[1] + PRIV_R2_CX[2]) / 2,
    labelY: PRIV_R2_Y + PRIV_H / 2 - 6,
    label: 'Identity gate',
    citation: '§3.2 p.40',
    data: 'Verified-applicant token',
    purpose: 'Biometric verification gates exam-room entry.',
  },
  // barcode → committee (row 2 → row 1)
  buildCrossUp(
    'x-barcode-committee',
    'barcode',
    'committee',
    PRIV_R2_CX[0], PRIV_R2_Y, // barcode top-mid
    PRIV_R1_CX[0], PRIV_R1_Y + PRIV_H, // committee bottom-mid
    PRIV_R2_Y - 15, // detour just above barcode (between rows)
    'Attendance scan',
    '§3.2 p.40',
  ),
  // medical → board (route below row 1)
  buildCrossBelow(
    'x-medical-board',
    'medical',
    'board',
    PRIV_R1_CX[3], PRIV_R1_Y + PRIV_H, // medical bottom-mid
    PRIV_R1_CX[1], PRIV_R1_Y + PRIV_H, // board bottom-mid
    PRIV_R1_Y + PRIV_H + 18,
    'Verdict for review',
    '§3.2 p.40',
  ),
];

/* Data + Audit connectors are computed in the renderer because */
/* they share rails (one ink, one terra). Build helpers below. */

/* ── Builders ──────────────────────────────────────────────── */
function buildExternal(
  id: string,
  fromId: string,
  toId: string,
  fromX: number,
  midY: number,
  toX: number,
  toY: number,
  meta: Pick<DiagConn, 'label' | 'auth' | 'data' | 'citation' | 'purpose' | 'bidirectional' | 'minor'>,
): DiagConn {
  const fromY = EXT_Y + EXT_H;
  // M source-bottom L source-x mid L target-x mid L target-x target-y
  const path = `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`;
  return {
    id,
    kind: 'external',
    fromId,
    toId,
    path,
    labelX: (fromX + toX) / 2,
    labelY: midY - 5,
    ...meta,
  };
}

function buildBoundaryCross(
  id: string,
  fromId: string,
  toId: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  meta: Pick<DiagConn, 'label' | 'auth' | 'data' | 'citation' | 'purpose' | 'minor'>,
): DiagConn {
  // Route down the right side, cross the boundary, traverse private surface, descend into target top.
  const viaY = 425; // just below the boundary, in private-surface tint
  const path = `M ${fromX} ${fromY} L ${fromX} ${viaY} L ${toX} ${viaY} L ${toX} ${toY}`;
  return {
    id,
    kind: 'external',
    fromId,
    toId,
    path,
    labelX: (fromX + toX) / 2,
    labelY: viaY - 5,
    ...meta,
  };
}

function buildCrossAround(
  id: string,
  fromId: string,
  toId: string,
  fromCx: number,
  fromCy: number,
  toCx: number,
  toCy: number,
  detourY: number,
  label: string,
  citation: string,
): DiagConn {
  const stub = 10;
  const fromX = fromCx + PRIV_W / 2; // right edge of source
  const toX = toCx - PRIV_W / 2;     // left edge of target
  const path = `M ${fromX} ${fromCy} L ${fromX + stub} ${fromCy} L ${fromX + stub} ${detourY} L ${toX - stub} ${detourY} L ${toX - stub} ${toCy} L ${toX} ${toCy}`;
  return {
    id,
    kind: 'cross-app',
    fromId,
    toId,
    path,
    labelX: (fromX + toX) / 2,
    labelY: detourY - 6,
    label,
    citation,
  };
}

function buildCrossUp(
  id: string,
  fromId: string,
  toId: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  detourY: number,
  label: string,
  citation: string,
): DiagConn {
  const path = `M ${fromX} ${fromY} L ${fromX} ${detourY} L ${toX} ${detourY} L ${toX} ${toY}`;
  return {
    id,
    kind: 'cross-app',
    fromId,
    toId,
    path,
    labelX: (fromX + toX) / 2,
    labelY: detourY - 6,
    label,
    citation,
  };
}

function buildCrossBelow(
  id: string,
  fromId: string,
  toId: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  detourY: number,
  label: string,
  citation: string,
): DiagConn {
  const path = `M ${fromX} ${fromY} L ${fromX} ${detourY} L ${toX} ${detourY} L ${toX} ${toY}`;
  return {
    id,
    kind: 'cross-app',
    fromId,
    toId,
    path,
    labelX: (fromX + toX) / 2,
    labelY: detourY + 12,
    label,
    citation,
  };
}

/* ── Component ─────────────────────────────────────────────── */

interface SystemDiagramProps {
  className?: string;
}

export function SystemDiagram({ className }: SystemDiagramProps): JSX.Element {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(max-width: 767px)');
    const update = (): void => setIsMobile(mql.matches);
    update();
    if (mql.addEventListener) {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  /* Connector list (memoized — stable across renders). */
  const connectors = useMemo<readonly DiagConn[]>(
    () => [...EXT_CONNS, ...CROSS_CONNS],
    [],
  );

  if (isMobile) {
    return <FallbackCardView className={className} />;
  }

  /* Hover state derivation */
  const hoveredNode = ALL_NODES.find((n) => n.id === hoveredId) ?? null;
  const hoveredConn = connectors.find((c) => c.id === hoveredId) ?? null;
  const isConnRelated = (c: DiagConn): boolean => {
    if (!hoveredId) return true;
    if (hoveredConn && hoveredConn.id === c.id) return true;
    if (hoveredNode && (c.fromId === hoveredNode.id || c.toId === hoveredNode.id)) return true;
    return false;
  };
  const isAuditRelated = (appId: string): boolean => {
    if (!hoveredId) return true;
    if (hoveredId === 'audit') return true;
    if (hoveredId === appId) return true;
    return false;
  };
  const isDataRelated = (appId: string): boolean => {
    if (!hoveredId) return true;
    if (hoveredId === 'primary' || hoveredId === 'reporting') return true;
    if (hoveredId === appId) return true;
    return false;
  };
  const dim = (related: boolean): number => (hoveredId && !related ? 0.18 : 1);

  /* Click handler: smooth-scroll to scrollTarget. */
  const handleNodeClick = (n: DiagNode): void => {
    const target = document.getElementById(n.scrollTarget);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={cn('arch-system-diagram', className)}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-labelledby="arch-system-diagram-title"
        className="block w-full"
        style={{ aspectRatio: `${VB_W} / ${VB_H}`, maxHeight: '780px' }}
      >
        <title id="arch-system-diagram-title">
          Police Academy Admissions System — comprehensive architecture diagram
        </title>

        <defs>
          {/* Arrow markers (one per connector kind for color matching) */}
          <marker id="arr-teal"  viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--teal-500)" />
          </marker>
          <marker id="arr-gold"  viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--gold-500)" />
          </marker>
          <marker id="arr-teal-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M10 0 L0 5 L10 10 z" fill="var(--teal-500)" />
          </marker>
        </defs>

        {/* ── REGION TINTS ─────────────────────────────────────── */}
        <rect x={PUB_TINT.x} y={PUB_TINT.y} width={PUB_TINT.w} height={PUB_TINT.h} rx={8} fill="var(--teal-50)" opacity={0.55} className="arch-region-tint" />
        <rect x={PRIV_TINT.x} y={PRIV_TINT.y} width={PRIV_TINT.w} height={PRIV_TINT.h} rx={8} fill="var(--ink-100)" opacity={0.5} className="arch-region-tint" />

        {/* ── REGION LABELS ────────────────────────────────────── */}
        <RegionLabel x={70}    y={28}  text="EXTERNAL SYSTEMS" />
        <RegionLabel x={70}    y={195} text="PUBLIC SURFACE · DMZ · HORIZONTAL AUTOSCALING" />
        <RegionLabel x={70}    y={440} text="PRIVATE SURFACE · ACADEMY INTRANET · HA CLUSTER" />
        <RegionLabel x={70}    y={730} text="MIDDLEWARE · API GATEWAY · SERVICE BUS · AUTH BROKER" />
        <RegionLabel x={70}    y={862} text="DATA LAYER · ACTIVE/STANDBY + READ REPLICA + AUDIT WORM" />

        {/* ── NETWORK BOUNDARY (the most important visual line) ── */}
        <g className="arch-boundary" data-no-print="false">
          <line
            x1={60}
            y1={BOUNDARY_Y}
            x2={1540}
            y2={BOUNDARY_Y}
            stroke="var(--terra-400)"
            strokeWidth={2}
            strokeDasharray="10 6"
            data-chart-stroke
          />
          <rect x={620} y={BOUNDARY_Y - 11} width={360} height={22} rx={11} fill="var(--ink-50)" stroke="var(--terra-400)" strokeWidth={1} data-chart-stroke />
          <text x={800} y={BOUNDARY_Y + 4} fontSize={11} fontFamily="var(--font-en)" fontWeight={600} fill="var(--terra-700)" textAnchor="middle" letterSpacing={1}>
            NETWORK BOUNDARY · DMZ / INTRANET
          </text>
        </g>

        {/* ── DATA + AUDIT BUSES (drawn beneath nodes) ─────────── */}
        {/* Data bus: ink solid horizontal at y=820, drops to Primary + Reporting */}
        <g className="arch-data-bus" opacity={dim(!hoveredId || hoveredId === 'primary' || hoveredId === 'reporting' || APP_IDS.includes(hoveredId ?? ''))}>
          {/* Each app drops a stub down to the data bus */}
          {[...PUBLIC_APPS, ...PRIVATE_APPS].map((app) => {
            const cx = app.x + app.w / 2;
            const by = app.y + app.h;
            return (
              <line
                key={`databus-${app.id}`}
                x1={cx}
                y1={by}
                x2={cx}
                y2={DATA_BUS_Y}
                stroke="var(--ink-400)"
                strokeWidth={1}
                opacity={isDataRelated(app.id) ? 0.5 : 0.12}
                data-chart-stroke
              />
            );
          })}
          {/* Horizontal ink rail */}
          <line x1={300} y1={DATA_BUS_Y} x2={1100} y2={DATA_BUS_Y} stroke="var(--ink-400)" strokeWidth={1.25} data-chart-stroke opacity={0.6} />
          {/* Drop to Primary DB top */}
          <line x1={DB_CX[0]} y1={DATA_BUS_Y} x2={DB_CX[0]} y2={DB_TOP} stroke="var(--ink-400)" strokeWidth={1.25} data-chart-stroke opacity={0.7} />
          {/* Drop to Reporting DB top */}
          <line x1={DB_CX[1]} y1={DATA_BUS_Y} x2={DB_CX[1]} y2={DB_TOP} stroke="var(--ink-400)" strokeWidth={1.25} data-chart-stroke opacity={0.7} />
        </g>

        {/* Audit bus: terra dotted below data bus, drops to Audit DB */}
        <g className="arch-audit-bus" opacity={dim(!hoveredId || hoveredId === 'audit' || APP_IDS.includes(hoveredId ?? ''))}>
          {/* Per-app faint dotted stubs to the audit bus */}
          {[...PUBLIC_APPS, ...PRIVATE_APPS].map((app) => {
            const cx = app.x + app.w / 2 + 6; // offset 6px so it doesn't sit exactly on the data stub
            const by = app.y + app.h;
            return (
              <line
                key={`auditbus-${app.id}`}
                x1={cx}
                y1={by}
                x2={cx}
                y2={AUDIT_BUS_Y}
                stroke="var(--terra-700)"
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={isAuditRelated(app.id) ? 0.45 : 0.1}
                data-chart-stroke
              />
            );
          })}
          {/* Horizontal terra dotted rail */}
          <line x1={300} y1={AUDIT_BUS_Y} x2={DB_CX[2]} y2={AUDIT_BUS_Y} stroke="var(--terra-700)" strokeWidth={1.25} strokeDasharray="2 4" data-chart-stroke opacity={0.65} />
          {/* Drop to Audit DB top */}
          <line x1={DB_CX[2]} y1={AUDIT_BUS_Y} x2={DB_CX[2]} y2={DB_TOP} stroke="var(--terra-700)" strokeWidth={1.25} strokeDasharray="2 4" data-chart-stroke opacity={0.85} />
          {/* Subtle audit-bus label */}
          <text x={310} y={AUDIT_BUS_Y - 6} fontSize={10} fontFamily="var(--font-en)" fill="var(--terra-700)" letterSpacing={0.6}>
            AUDIT WRITES · EVERY APP
          </text>
        </g>

        {/* ── CONNECTORS (external + cross-app, on top of buses) ─ */}
        <g className="arch-connectors">
          {connectors.map((c) => {
            const related = isConnRelated(c);
            const isHovered = hoveredId === c.id;
            const sw = isHovered ? 2.5 : c.kind === 'external' ? 1.5 : 1.5;
            const stroke = c.kind === 'external' ? 'var(--teal-500)' : 'var(--gold-500)';
            const dashArray = c.kind === 'cross-app' ? '6 5' : undefined;
            const markerEnd = c.kind === 'external' ? 'url(#arr-teal)' : 'url(#arr-gold)';
            const markerStart = c.kind === 'external' && c.bidirectional ? 'url(#arr-teal-start)' : undefined;

            return (
              <g
                key={c.id}
                className="arch-conn"
                opacity={dim(related)}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId((cur) => (cur === c.id ? null : cur))}
                onFocus={() => setHoveredId(c.id)}
                onBlur={() => setHoveredId((cur) => (cur === c.id ? null : cur))}
                tabIndex={0}
                role="button"
                aria-label={`Connector ${nodeLabel(c.fromId)} to ${nodeLabel(c.toId)}${c.label ? ': ' + c.label : ''}`}
              >
                <path
                  d={c.path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={dashArray}
                  markerEnd={markerEnd}
                  markerStart={markerStart}
                  data-chart-stroke
                  data-chart-line
                />
                {/* invisible hit-area for easier hover */}
                <path d={c.path} fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke" />
                {c.label && c.labelX != null && c.labelY != null && (
                  <ConnLabel
                    x={c.labelX}
                    y={c.labelY}
                    text={c.label}
                    minor={c.minor}
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* ── EXTERNALS ───────────────────────────────────────── */}
        <g className="arch-externals">
          {EXTERNALS.map((n) => (
            <NodeBox
              key={n.id}
              node={n}
              hovered={hoveredId === n.id}
              dim={dim(!hoveredId || hoveredId === n.id || isAdjacent(n.id, hoveredId, connectors))}
              onHover={setHoveredId}
              onClick={() => handleNodeClick(n)}
            />
          ))}
        </g>

        {/* ── PUBLIC APPS ─────────────────────────────────────── */}
        <g className="arch-public-apps">
          {PUBLIC_APPS.map((n) => (
            <NodeBox
              key={n.id}
              node={n}
              hovered={hoveredId === n.id}
              dim={dim(!hoveredId || hoveredId === n.id || isAdjacent(n.id, hoveredId, connectors))}
              onHover={setHoveredId}
              onClick={() => handleNodeClick(n)}
            />
          ))}
        </g>

        {/* ── PRIVATE APPS ────────────────────────────────────── */}
        <g className="arch-private-apps">
          {PRIVATE_APPS.map((n) => (
            <NodeBox
              key={n.id}
              node={n}
              hovered={hoveredId === n.id}
              dim={dim(!hoveredId || hoveredId === n.id || isAdjacent(n.id, hoveredId, connectors))}
              onHover={setHoveredId}
              onClick={() => handleNodeClick(n)}
            />
          ))}
        </g>

        {/* ── MIDDLEWARE PILL ─────────────────────────────────── */}
        <g
          className="arch-middleware"
          tabIndex={0}
          role="button"
          aria-label="Middleware — API Gateway, Service Bus, Auth Broker"
          onMouseEnter={() => setHoveredId('middleware')}
          onMouseLeave={() => setHoveredId((cur) => (cur === 'middleware' ? null : cur))}
          onFocus={() => setHoveredId('middleware')}
          onBlur={() => setHoveredId((cur) => (cur === 'middleware' ? null : cur))}
          style={{ cursor: 'default' }}
        >
          <rect
            x={MID.x}
            y={MID.y}
            width={MID.w}
            height={MID.h}
            rx={MID.rx}
            ry={MID.rx}
            fill="var(--ink-50)"
            stroke="var(--ink-300)"
            strokeWidth={1}
            data-chart-stroke
          />
          <text
            x={MID.x + MID.w / 2}
            y={MID.y + MID.h / 2 + 5}
            fontSize={13}
            fontFamily="var(--font-en)"
            fontWeight={500}
            fill="var(--ink-700)"
            textAnchor="middle"
          >
            Middleware · API Gateway · Service Bus · Auth Broker
          </text>
        </g>

        {/* ── DATABASES (cylinders) ───────────────────────────── */}
        <g className="arch-databases">
          {DATABASES.map((n) => (
            <DbCylinder
              key={n.id}
              node={n}
              hovered={hoveredId === n.id}
              dim={dim(!hoveredId || hoveredId === n.id || (hoveredId !== null && APP_IDS.includes(hoveredId)) || hoveredId === 'middleware')}
              onHover={setHoveredId}
              onClick={() => handleNodeClick(n)}
            />
          ))}
        </g>
      </svg>

      {/* Info panel — reflects hovered/focused element */}
      <DiagramInfoPanel hoveredNode={hoveredNode} hoveredConn={hoveredConn} />

      {/* Static legend for print + screen */}
      <DiagramLegend />
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────── */

function RegionLabel({ x, y, text }: { x: number; y: number; text: string }): JSX.Element {
  return (
    <text
      x={x}
      y={y}
      fontSize={11}
      fontFamily="var(--font-en)"
      fontWeight={500}
      fill="var(--ink-400)"
      letterSpacing={1.4}
    >
      {text}
    </text>
  );
}

function ConnLabel({ x, y, text, minor }: { x: number; y: number; text: string; minor?: boolean }): JSX.Element {
  // Approximate label background pill width.
  const padding = 5;
  const charW = 5.6;
  const w = Math.max(text.length * charW + padding * 2, 36);
  const h = 14;
  return (
    <g className={cn('arch-conn-label', minor && 'arch-conn-label-minor')} pointerEvents="none">
      <rect x={x - w / 2} y={y - h + 2} width={w} height={h} rx={3} fill="var(--surface-card)" opacity={0.92} />
      <text
        x={x}
        y={y - 2}
        fontSize={10}
        fontFamily="var(--font-en)"
        fontWeight={500}
        fill="var(--ink-500)"
        textAnchor="middle"
      >
        {text}
      </text>
    </g>
  );
}

function NodeBox({
  node,
  hovered,
  dim,
  onHover,
  onClick,
}: {
  node: DiagNode;
  hovered: boolean;
  dim: number;
  onHover: (id: string | null) => void;
  onClick: () => void;
}): JSX.Element {
  const isExternal = node.kind === 'external';
  const accent = node.accent ?? 'var(--teal-300)';
  const fill = isExternal ? 'var(--ink-50)' : 'var(--surface-card)';
  const stroke = isExternal ? 'var(--teal-300)' : 'var(--border-default)';
  const labelFontSize = isExternal ? 12 : 13;
  const labelColor = isExternal ? 'var(--ink-700)' : 'var(--ink-900)';

  return (
    <g
      className={cn('arch-node', hovered && 'arch-node--hovered')}
      opacity={dim}
      tabIndex={0}
      role="button"
      aria-label={`${node.label} — ${node.purpose}`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {hovered && (
        <rect
          x={node.x - 6}
          y={node.y - 6}
          width={node.w + 12}
          height={node.h + 12}
          rx={10}
          fill="none"
          stroke={accent}
          strokeWidth={3}
          opacity={0.45}
          data-chart-stroke
        />
      )}
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
        data-chart-stroke
      />
      {/* Per-app accent border-top for app boxes (DESIGN_SYSTEM §2.2) */}
      {!isExternal && node.accent && (
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={3}
          fill={node.accent}
        />
      )}
      <text
        x={node.x + node.w / 2}
        y={node.y + node.h / 2 + 5}
        fontSize={labelFontSize}
        fontFamily="var(--font-en)"
        fontWeight={isExternal ? 500 : 600}
        fill={labelColor}
        textAnchor="middle"
      >
        {node.label}
      </text>
      {/* Deployment / scale badge — only on app boxes, not externals. */}
      {!isExternal && SCALE_BADGE[node.id] && (
        <ScalePill
          x={node.x + node.w - 6}
          y={node.y + node.h - 6}
          text={SCALE_BADGE[node.id] as string}
          tone={node.kind === 'public-app' ? 'public' : 'private'}
        />
      )}
    </g>
  );
}

function ScalePill({
  x,
  y,
  text,
  tone,
}: {
  x: number;
  y: number;
  text: string;
  tone: 'public' | 'private' | 'data';
}): JSX.Element {
  const charW = 5.4;
  const padding = 6;
  const w = Math.max(text.length * charW + padding * 2, 36);
  const h = 14;
  const fill =
    tone === 'public' ? 'var(--teal-50)' :
    tone === 'private' ? 'var(--ink-50)' :
    'var(--terra-50)';
  const stroke =
    tone === 'public' ? 'var(--teal-500)' :
    tone === 'private' ? 'var(--ink-400)' :
    'var(--terra-500)';
  const color =
    tone === 'public' ? 'var(--teal-700)' :
    tone === 'private' ? 'var(--ink-700)' :
    'var(--terra-700)';
  return (
    <g pointerEvents="none" className="arch-scale-pill">
      <rect
        x={x - w}
        y={y - h}
        width={w}
        height={h}
        rx={7}
        fill={fill}
        stroke={stroke}
        strokeWidth={0.75}
        opacity={0.95}
        data-chart-stroke
      />
      <text
        x={x - w / 2}
        y={y - 3}
        fontSize={9}
        fontFamily="var(--font-en)"
        fontWeight={600}
        fill={color}
        textAnchor="middle"
      >
        {text}
      </text>
    </g>
  );
}

function DbCylinder({
  node,
  hovered,
  dim,
  onHover,
  onClick,
}: {
  node: DiagNode;
  hovered: boolean;
  dim: number;
  onHover: (id: string | null) => void;
  onClick: () => void;
}): JSX.Element {
  const cx = node.x + node.w / 2;
  const fill = node.accent ?? 'var(--ink-700)';
  const ellipseRy = 12;
  const topY = node.y;
  const bottomY = node.y + node.h;

  return (
    <g
      className={cn('arch-node', 'arch-db-cylinder', hovered && 'arch-node--hovered')}
      opacity={dim}
      tabIndex={0}
      role="button"
      aria-label={`${node.label} — ${node.purpose}`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {hovered && (
        <rect
          x={node.x - 6}
          y={node.y - 6}
          width={node.w + 12}
          height={node.h + 12}
          rx={14}
          fill="none"
          stroke={fill}
          strokeWidth={3}
          opacity={0.45}
          data-chart-stroke
        />
      )}
      {/* body rect */}
      <rect
        x={node.x}
        y={topY + ellipseRy}
        width={node.w}
        height={node.h - ellipseRy * 2}
        fill={fill}
      />
      {/* bottom ellipse (back) */}
      <ellipse cx={cx} cy={bottomY - ellipseRy} rx={node.w / 2} ry={ellipseRy} fill={fill} />
      {/* top ellipse (front) */}
      <ellipse cx={cx} cy={topY + ellipseRy} rx={node.w / 2} ry={ellipseRy} fill={fill} stroke="rgba(255,255,255,0.18)" strokeWidth={1} data-chart-stroke />
      <text
        x={cx}
        y={(topY + bottomY) / 2 + 5}
        fontSize={14}
        fontFamily="var(--font-en)"
        fontWeight={600}
        fill="#FFFFFF"
        textAnchor="middle"
      >
        {node.label}
      </text>
      {/* Deployment role caption beneath each cylinder. */}
      {SCALE_BADGE[node.id] && (
        <text
          x={cx}
          y={bottomY + 14}
          fontSize={10}
          fontFamily="var(--font-en)"
          fontWeight={500}
          fill="var(--ink-500)"
          textAnchor="middle"
        >
          {SCALE_BADGE[node.id]}
        </text>
      )}
    </g>
  );
}

function DiagramInfoPanel({
  hoveredNode,
  hoveredConn,
}: {
  hoveredNode: DiagNode | null;
  hoveredConn: DiagConn | null;
}): JSX.Element {
  if (hoveredConn) {
    const fromLabel = nodeLabel(hoveredConn.fromId);
    const toLabel = nodeLabel(hoveredConn.toId);
    const arrow = hoveredConn.bidirectional ? '↔' : '→';
    return (
      <div className="arch-system-info" role="status" aria-live="polite">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
          Connector · {hoveredConn.kind === 'external' ? 'External' : hoveredConn.kind === 'cross-app' ? 'Cross-app' : hoveredConn.kind === 'data' ? 'Data' : 'Audit'}
        </p>
        <p className="mt-1 text-md font-bold text-ink-900">
          {fromLabel} <span className="text-ink-500">{arrow}</span> {toLabel}
        </p>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-ink-700 sm:grid-cols-2">
          {hoveredConn.purpose && <InfoRow label="Purpose" value={hoveredConn.purpose} />}
          {hoveredConn.data && <InfoRow label="Data exchanged" value={hoveredConn.data} />}
          {hoveredConn.auth && <InfoRow label="Auth" value={hoveredConn.auth} />}
          {hoveredConn.citation && <InfoRow label="RFP Scope Document" value={hoveredConn.citation} mono />}
        </dl>
      </div>
    );
  }
  if (hoveredNode) {
    const kindLabel =
      hoveredNode.kind === 'external'   ? 'External system' :
      hoveredNode.kind === 'public-app' ? 'Public application' :
      hoveredNode.kind === 'private-app'? 'Private application' :
      hoveredNode.kind === 'database'   ? 'Database' : 'Middleware';
    return (
      <div className="arch-system-info" role="status" aria-live="polite">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
          {kindLabel}
        </p>
        <p className="mt-1 text-md font-bold text-ink-900">{hoveredNode.label}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{hoveredNode.purpose}</p>
        <p className="mt-2 font-mono text-[11px] text-ink-500">{hoveredNode.citation}</p>
      </div>
    );
  }
  return (
    <div className="arch-system-info arch-system-info--idle" role="status" aria-live="polite">
      <p className="text-sm leading-relaxed text-ink-500">
        Hover or focus any element on the diagram for details. Click an element to jump to its
        full description further down the page.
      </p>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{label}</dt>
      <dd className={cn('text-sm text-ink-700', mono && 'font-mono text-[12px]')}>{value}</dd>
    </div>
  );
}

function DiagramLegend(): JSX.Element {
  return (
    <ul className="arch-system-legend mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-700">
      <LegendSwatch kind="external" label="External integration" />
      <LegendSwatch kind="cross-app" label="Internal cross-app flow" />
      <LegendSwatch kind="data" label="Data persistence" />
      <LegendSwatch kind="audit" label="Audit write" />
    </ul>
  );
}

function LegendSwatch({ kind, label }: { kind: ConnKind; label: string }): JSX.Element {
  return (
    <li className="inline-flex items-center gap-2">
      <svg width={36} height={10} aria-hidden viewBox="0 0 36 10">
        {kind === 'external' && (
          <line x1={1} y1={5} x2={35} y2={5} stroke="var(--teal-500)" strokeWidth={1.75} strokeLinecap="round" />
        )}
        {kind === 'cross-app' && (
          <line x1={1} y1={5} x2={35} y2={5} stroke="var(--gold-500)" strokeWidth={1.75} strokeDasharray="5 4" strokeLinecap="round" />
        )}
        {kind === 'data' && (
          <line x1={1} y1={5} x2={35} y2={5} stroke="var(--ink-400)" strokeWidth={1.5} strokeLinecap="round" />
        )}
        {kind === 'audit' && (
          <line x1={1} y1={5} x2={35} y2={5} stroke="var(--terra-700)" strokeWidth={1.5} strokeDasharray="2 4" strokeLinecap="round" />
        )}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/* ── Helpers ───────────────────────────────────────────────── */

function nodeLabel(id: string): string {
  if (id === 'middleware') return 'Middleware';
  return ALL_NODES.find((n) => n.id === id)?.label ?? id;
}

function isAdjacent(nodeId: string, hoveredId: string | null, conns: readonly DiagConn[]): boolean {
  if (!hoveredId) return false;
  return conns.some(
    (c) => (c.fromId === hoveredId && c.toId === nodeId) || (c.toId === hoveredId && c.fromId === nodeId),
  );
}

/* ── Mobile fallback ───────────────────────────────────────── */

function FallbackCardView({ className }: { className?: string }): JSX.Element {
  const groups: { title: string; items: readonly DiagNode[]; tone: string }[] = [
    { title: 'External systems',                items: EXTERNALS,    tone: 'border-teal-300 bg-teal-50' },
    { title: 'Public surface — Internet',       items: PUBLIC_APPS,  tone: 'border-teal-200 bg-teal-50' },
    { title: 'Private surface — Intranet',      items: PRIVATE_APPS, tone: 'border-ink-200 bg-ink-50' },
    { title: 'Data layer',                      items: DATABASES,    tone: 'border-ink-300 bg-ink-100' },
  ];
  return (
    <div className={cn('flex flex-col gap-4', className)} role="region" aria-label="System architecture (stacked view)">
      <p className="text-xs leading-relaxed text-ink-500">
        Showing a stacked view because this viewport is too narrow for the full architecture
        diagram. Open this page on a tablet or larger screen for the interactive canvas.
      </p>
      {groups.map((g) => (
        <section key={g.title} className={cn('rounded-lg border p-4', g.tone)}>
          <h4 className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            {g.title}
          </h4>
          <ul className="mt-2 grid gap-2">
            {g.items.map((n) => (
              <li
                key={n.id}
                className="rounded-md border border-border-subtle bg-surface-card p-3"
                style={n.accent ? { borderTop: `3px solid ${n.accent}` } : undefined}
              >
                <p className="text-sm font-bold text-ink-900">{n.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-ink-700">{n.purpose}</p>
                <p className="mt-1 font-mono text-[10px] text-ink-500">{n.citation}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="rounded-md border border-border-subtle bg-ink-50 p-3 text-xs text-ink-700">
        <p className="font-semibold uppercase tracking-[0.14em] text-[10px] text-ink-500">
          Middleware
        </p>
        <p className="mt-0.5">API Gateway · Service Bus · Auth Broker — brokers all
          public ↔ private and external traffic.</p>
      </div>
    </div>
  );
}
