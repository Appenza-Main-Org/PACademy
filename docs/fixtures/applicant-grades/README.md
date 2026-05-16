# Applicant Grades — Local Fixtures

Drop test files here to exercise the import wizard end-to-end without
spinning up a backend.

| File | Format | Notes |
|---|---|---|
| `sample-general.csv` | CSV | General secondary grade sheet — matches the auto-mapping synonym list so Step 3 maps every column without manual picks. |
| `sample-azhar.csv` | CSV | Azhar grade sheet using the legacy `StSeatNo`/`StudenName` column names — exercises Step 3's source-column picker. |
| `sample-general.xlsx` | XLSX | (not committed) — produced by downloading the wizard's Excel template from `/admin/applicant-grades`, filling 2 rows, and re-uploading. |
| `sample.accdb` | ACCDB | (not committed) — drop a Ministry of Education `.accdb` export here to reproduce the original bug report. |

Binary `.xlsx` / `.accdb` fixtures are intentionally not checked in to keep
the repo lean — they're produced on demand from the template download
button in Step 1 of the wizard, and from the Ministry export tooling.
