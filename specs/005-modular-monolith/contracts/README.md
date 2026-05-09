# Phase 1 Contracts: Modular-Monolith Refactor (Phase 5)

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Data model**: [../data-model.md](../data-model.md)

> Phase 5 introduces no new HTTP endpoints — every existing route from spec 003 + 004 keeps its shape. The "contracts" in this folder are instead the **inter-module compile-time interfaces** that each module exposes via its `*.Public` csproj. Other modules consume them via DI; HTTP exposure is forbidden (FR-M05).

---

## File index

| File | Module | Owner |
|---|---|---|
| [identity-api.md](./identity-api.md) | `Modules.Identity.Public` | `IIdentityApi` + `CurrentUserDto` |
| [admissions-api.md](./admissions-api.md) | `Modules.Admissions.Public` | `IAdmissionsApi` + `CycleSummaryDto`, `CategorySummaryDto` |
| [reference-data-api.md](./reference-data-api.md) | `Modules.ReferenceData.Public` | `IReferenceDataApi` + `ReferenceDataItemDto` |
| [workflows-api.md](./workflows-api.md) | `Modules.Workflows.Public` | `IWorkflowsApi` + `WorkflowSummaryDto`, `WorkflowStageSummaryDto` |
| [audit-api.md](./audit-api.md) | `Shared.Audit.Public` | `IAuditApi` + `AuditAction`, `AuditOutcome` enums |
| [error-codes.md](./error-codes.md) | `Shared.Contracts` | The cross-module error-code registry consumed by every controller's exception middleware |

---

## Architectural rules these contracts encode

1. **No types other than the interface and its DTOs** are exposed via `*.Public`. Domain types (e.g. `Applicant`, `Cycle`) stay private to their module.
2. **DTOs are records** (immutable, structural equality). They are never mapped from EF entities directly — each public-API implementation projects the entity onto the DTO.
3. **No write surfaces beyond Audit.** Only `IAuditApi` carries write methods. Every other module exposes read-only public APIs; writes go through the module's own controllers (which are still in `PACademy.Api/Controllers/` for phase 5).
4. **`Shared.Contracts` has zero project references.** It can be consumed by any csproj without pulling in domain types.

---

## How to add a new public-API method

1. Add the method signature + return DTO to `Modules.<X>.Public/I<X>Api.cs`.
2. Implement it in `Modules.<X>.Application/<X>Api.cs` (the impl class — typically projects from the module's domain).
3. Update the corresponding contract file in this folder to document the new method.
4. Add a NetArchTest assertion if the new DTO type lives outside the `Public` namespace (forbidden — it must live in `Public/`).

---

## Versioning policy (phase 5)

`*.Public` interfaces use **semantic source-level versioning** within the monolith — adding a method is a non-breaking change; removing one is breaking and forces every consumer to update before merge. Because all consumers live in the same `.slnx`, any breaking change shows up at compile time. There is no on-the-wire versioning because there is no on-the-wire surface (FR-M05).

When phase 6+ adds new modules, those modules' `*.Public` projects join this scheme automatically.
