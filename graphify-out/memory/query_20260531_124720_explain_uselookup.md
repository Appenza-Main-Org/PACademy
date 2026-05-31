---
type: "explain"
date: "2026-05-31T12:47:20.476581+00:00"
question: "Explain useLookup"
contributor: "graphify"
source_nodes: ["useLookup()"]
---

# Q: Explain useLookup

## Answer

useLookup() at frontend/src/features/lookups/api/lookups.queries.ts:41 is a TanStack Query hook, the single read path for all 22 typed lookups, re-exported via the lookups barrel. Degree 67, community 33. Connectivity is one-directional: 67 incoming imports, ~0 outgoing — a pure data-access sink. Importers by feature: admin 35, lookups 12, applicant-grades 8, applicant-portal 6, committees 4, dev 2. It bridges the admin configuration surface and the applicant wizard surface through one source of truth (the CategoryConditionBuilder->useLookup and ReviewCard->useLookup surprising edges). Blast-radius hotspot: signature/cache changes ripple to ~67 call sites; the right lever for cross-cutting lookup caching (NO_CACHE_LOOKUPS), error mapping (CONFLICT_MESSAGES), and backend-vs-mock switching.

## Source Nodes

- useLookup()