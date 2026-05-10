# Contract — Officers API (`/v1/officers/*`)

Endpoint owned by `OfficersController` in `PACademy.Api`. Restricted to admin permission (e.g. `users:create`); other roles get 403 PERMISSION_DENIED.

The implementation is the `IOfficerLookup` abstraction selected by config:
- `Configuration:OfficerLookup:Source = "MOIPASS"` → `MoipassOfficerLookup` with Polly resilience (per `research.md` R0.3).
- `Configuration:OfficerLookup:Source = "Stub"` → `StubOfficerLookup` returning seeded `system_users` rows. Permitted in Development/Staging only.

## GET `/v1/officers/lookup?nid={nid}&code={officerCode}`

Look up an officer by National ID and Officer Code.

### Query parameters

| Param | Required | Notes |
|---|---|---|
| `nid` | yes | Egyptian NID `\d{14}` |
| `code` | yes | Officer code as stored in MOIPASS |

### Response — 200 OK

```json
{
  "nationalId": "27001010150010",
  "officerCode": "OC01000",
  "fullName": "الإدارة العليا للنظام",
  "mobile": "01010000000",
  "email": "super.admin@pac.demo",
  "issueDate": "2020-01-01",
  "cardFactoryNumber": "CF000100",
  "unit": "قيادة الأكاديمية"
}
```

Field shapes match the `OfficerRecord` DTO from `data-model.md §4`. The frontend pre-fills the create-user form with this payload (per `INTEGRATION_HANDOFF.md §2 authService.lookupOfficer`).

### Response — 404 OFFICER_NOT_FOUND

Either MOIPASS or the stub returned no record for this `(nid, code)` pair.

```json
{
  "code": "OFFICER_NOT_FOUND",
  "message": "لم يتم العثور على ضابط بهذا الرقم القومي ورمز الضابط"
}
```

### Response — 503 OFFICER_LOOKUP_UNAVAILABLE

MOIPASS is unreachable, timed out, or the circuit breaker is open. The frontend's User Story 3 acceptance scenario 3 catches this code and surfaces "service temporarily unavailable" without losing the in-progress form data.

```json
{
  "code": "OFFICER_LOOKUP_UNAVAILABLE",
  "message": "خدمة البحث عن الضباط غير متاحة حالياً. حاول مرة أخرى."
}
```

### Validation — 400 VALIDATION_FAILED

Invalid NID format or missing `code`.

```json
{
  "code": "VALIDATION_FAILED",
  "message": "Invalid request",
  "payload": {
    "errors": [
      { "field": "nid", "constraint": "must be 14 digits", "value": "270010" }
    ]
  }
}
```

### Audit

- Action `officer_looked_up`, outcome `success` on 200, `not_found` on 404, `upstream_unavailable` on 503. The lookup query (`nid`, `code`) is captured in the audit row's `target_label` so admins can correlate failed lookups with downstream user-create attempts.

### Performance

- p95 ≤ 2s under normal MOIPASS latency (per SC-005).
- p99 ≤ 5s under p99 MOIPASS latency.
- Hard ceiling: 5 s total per `research.md` R0.3.
