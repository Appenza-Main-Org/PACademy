# Product Guide — Police Academy Admissions Platform

> **Audience:** product team writing user stories, defining scope, and prioritizing.
> **Purpose:** the entry point that connects the **spec** (what the RFP/BRD requires), the **current state** (what's built), and the **gaps** (what's open) — so a story is written against reality, not guesswork. Routes to source docs; does not duplicate them.
> **Last updated:** 2026-06-15.

---

## 1. What the product is

**منظومة القبول · أكاديمية الشرطة** — the Egyptian Police Academy Admissions Platform: a single web app unifying **9 connected applications** behind one shell, across **3 surfaces** (PUBLIC / APPLICANT / STAFF), **11 RBAC roles**, ~110 routes, fully RTL Arabic.

- **Owner:** وزارة الداخلية · أكاديمية الشرطة (Ministry of Interior · Police Academy).
- **Users & personas:** [PRODUCT.md](PRODUCT.md) — three concrete groups (applicants, admin staff, on-prem operational staff), their context, and their jobs.
- **Brand & design constraints:** [PRODUCT.md](PRODUCT.md) (§ anti-references) + [DESIGN.md](DESIGN.md) → [Tasks/DESIGN_SYSTEM.md](../Tasks/DESIGN_SYSTEM.md). A story must respect the visual identity — it is treated as part of the product.

---

## 2. The specification (story source of truth)

| Doc | What it gives you |
|---|---|
| [police_academy_detailed_brd_scope_md.md](police_academy_detailed_brd_scope_md.md) | **The BRD.** Strictly extracted from the official RFP. Sectioned by application + by applicant workflow stage (1→11 + acquaintance doc). Write stories against these requirements. |
| [Tasks/KARASA_GAPS.md](../Tasks/KARASA_GAPS.md) | RFP-scope coverage map (filename retained for git history; the term inside is "RFP Scope Document"). What the RFP asks vs what exists. |
| [PRODUCT.md](PRODUCT.md) | Personas, surfaces, register (brand vs product), the §4 two-phase signature canon. |

BRD structure at a glance (full detail in the BRD doc):
- **1.1 Site Administrator** — permissions, insert screens (admin/role mgmt, admission rules, reference data, advanced control), inquiry screens, reports & statistics, data exchange (import/export).
- **1.2 Applicant System** — first/second authentication, then the staged workflow:
  - Stages 1–5: verify window → verify prior application → educational data → other-category validation → personal & educational data entry.
  - Stages 6–11: payment → basic family data → relatives data → first exam appointment → admission card → exams & results follow-up.
  - Acquaintance document workflow (final stage).
- **2. Internal Network Applications** — committees, board & secretariat, investigations, medical commission, barcode, biometric. These are **on-prem** (separate deployment + RBAC).

---

## 3. Current state (what's actually built)

The running build is the truth; the maintained running log is [CLAUDE.md](../CLAUDE.md) §11 ("What's done · what's next") — read it before scoping a story so you don't re-request shipped work. Surface/route inventory is [CLAUDE.md](../CLAUDE.md) §4; role/permission model is §5.

High-level posture (per [BRD_GAP_ANALYSIS.md](BRD_GAP_ANALYSIS.md), then advanced by later waves):
- **Admin** — most mature. Real backend: cycles, eligibility engine, per-category config, ~25 lookups, admin/role management, audit, reporting, data-exchange center.
- **Exams / Question Bank** — real backend (questions, exams, attempts, auto-scoring, conflict guard), joined the cloud plane 2026-05-24.
- **Applicant portal** — full 11-stage wizard wired to backend; MOI auth + payment run behind simulation seams (`Moi:Mode`, real gateway dormant).
- **Biometric** — gained a real backend module (2026-05-30) + a live ZKBioTime adapter (2026-06-07→09).
- **On-prem operational apps** (committees/board/investigations/medical/barcode) — deployed separately; cloud surfaces present but the operational RBAC plane is on-prem.

---

## 4. The gaps (where new stories come from)

> **Freshness warning.** The gap analyses below are **point-in-time (2026-05-29)**. Several headline gaps have since been closed — MOI SSO simulation, the biometric backend, and the Question Bank backend gap-fill all shipped on/after 2026-05-30 (see [CLAUDE.md](../CLAUDE.md) §11 and [SCOPE_GAP_QB_BIOMETRIC.md](SCOPE_GAP_QB_BIOMETRIC.md)). **Always cross-check a "gap" against CLAUDE.md §11 before writing a story for it.**

| Doc | Scope |
|---|---|
| [BRD_GAP_ANALYSIS.md](BRD_GAP_ANALYSIS.md) | BRD §3–7 (admin, applicant, biometric, exams + global): coverage table, completion %, prioritized risks. |
| [FULL_SCOPE_GAP_ANALYSIS.md](FULL_SCOPE_GAP_ANALYSIS.md) | All 9 apps vs the RFP — the 5 internal apps that are thinnest, phased task list. |
| [SCOPE_GAP_QB_BIOMETRIC.md](SCOPE_GAP_QB_BIOMETRIC.md) | 2026-05-30 closeout mapping every BRD §5/§6 item to before/after status. |
| [SCOPE_AUDIT.md](SCOPE_AUDIT.md) | Earlier scope audit against the RFP. |

The standing risks called out as still-open intent (verify each against current state): real SMS/payment-gateway wiring, National Verification Platform integration, server-generated PDF/Word exports, and the operational depth of the 5 internal apps.

---

## 5. How to write a story for this product

1. **Locate the requirement** in [police_academy_detailed_brd_scope_md.md](police_academy_detailed_brd_scope_md.md) and cite the section.
2. **Check current state** in [CLAUDE.md](../CLAUDE.md) §11 — is it done, partial, or absent?
3. **Pin the surface + role** — which of the 3 surfaces, which RBAC role(s) ([CLAUDE.md](../CLAUDE.md) §4/§5). On-prem app? Note the separate RBAC plane.
4. **Name the invariants** the story touches — [DB_CONSTRAINTS.md](DB_CONSTRAINTS.md) lists the conflict codes the backend enforces; your acceptance criteria should align with them.
5. **Respect config seams** — external systems (MOI, biometric, payment) follow the `<System>:Mode = simulated | real` pattern; a story should state which mode it targets.
6. **Arabic copy is exact** — spec strings are not paraphrased; if a story introduces new copy, source it.

---

## 6. Related references

- Demo narrative (customer-facing): [DEMO_SCRIPT.md](DEMO_SCRIPT.md)
- Testing counterpart to this guide: [TESTING_GUIDE.md](TESTING_GUIDE.md)
- Docs folder index: [INDEX.md](INDEX.md)
