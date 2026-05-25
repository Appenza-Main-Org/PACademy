# Admin API Retry Policy

Generated: 2026-05-22

The frontend API client retries idempotent read requests only:

- Scope: `GET` requests made through `apiClient.get(...)` and `apiClient.blob(...)`.
- Attempts: the initial request plus 2 retries.
- Backoff: 300ms, then 900ms.
- Retry causes: network errors and HTTP `502`, `503`, or `504`.
- Write safety: `POST`, `PUT`, `PATCH`, and `DELETE` are never retried.
- Toast behavior: retries are silent; normal query/mutation error handling shows one final Arabic error after the last failed attempt.

Implementation: `frontend/src/shared/lib/api-client.ts`.
