# TODO — Police Academy Admissions Platform (Frontend)

> Durable record of follow-ups that surfaced during the admin gap closure
> verification pass and are intentionally deferred. Each entry names the
> file, the rule it violates, and why it's parked.

---

## Tech debt — pre-existing `: any` violations

Surfaced by the autonomous verification pass on top of
`admin-gaps-verified` ([docs/VERIFICATION_REPORT.md](docs/VERIFICATION_REPORT.md) §2).
Both pre-date `admin-gaps-complete` (originated in commit `69f4689`,
the monorepo split) and are out of admin-gap scope; flagged here so
they don't get lost.

### 1. `src/shared/lib/zod-resolver.ts:25`

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodResolver<T extends Record<string, any>>(schema: z.ZodType<T>): any {
```

- **Rule violated:** CLAUDE.md §2 "Forbidden — `any` — use `unknown` and narrow".
- **Why deferred:** Bridges react-hook-form v7's variance-strict
  `Resolver<T, TContext, TTransformedValues>` to a concrete
  `z.ZodType<T>`. The `eslint-disable-next-line` comment makes the
  exception explicit and intentional.
- **Path forward:** Migrate to `@hookform/resolvers/zod` (the
  upstream package) — drops this shim entirely. Cost: one extra
  dependency in `package.json`. Worth doing before the next major
  RHF upgrade.

### 2. `src/features/admin/components/applicants/ApplicantForm.tsx:831`

```ts
register: any;
```

- **Rule violated:** CLAUDE.md §2 "Forbidden — `any`".
- **Why deferred:** RHF's `UseFormRegister<T>` generic is awkward to
  thread through nested family-member sub-forms with discriminated
  union shapes. Pre-existing pattern in the Sprint-2 admin form
  rewrite.
- **Path forward:** Type as
  `UseFormRegister<ApplicantFormValues>` and accept the readability
  cost; or accept a `setValue`/`getValues` pair instead so the prop
  is a narrower contract.

---

## How to use this file

- Append new deferred items as H2 sections under a topic.
- Each item names the file path, the rule, the reason for deferral,
  and the path forward — so a future session can pick it up cold
  without context-archaeology.
- When an item ships, delete the section (don't comment it out).
