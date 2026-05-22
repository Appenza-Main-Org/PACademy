# Admin Mock Residue

Generated: 2026-05-22

## Admin Surface

The required admin-surface grep returns zero hits for:

```bash
rg "MOCK\.|simulateLatency|from ['\"].*shared/mock-data|from ['\"].*lookups/mock" \
  frontend/src/features/admin \
  frontend/src/features/cycles \
  frontend/src/features/categories \
  frontend/src/features/applicant-grades \
  frontend/src/features/applicants \
  frontend/src/features/users \
  frontend/src/features/audit \
  frontend/src/features/workflows
```

The former admission-setup seed files were moved out of `frontend/src/features/admin/**` into `frontend/src/shared/mock-data/admissionSetup.ts`.

## Remaining Mock Files

`frontend/src/shared/mock-data/**` and `frontend/src/features/lookups/mock/**` remain active seed/demo sources for non-admin and seeding workflows. They are not runtime admin service dependencies.
