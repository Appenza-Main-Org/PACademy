#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:5101}"
AUTH_TOKEN=""

json_post_public() {
  local body="${2-}"
  if [[ -z "$body" ]]; then body="{}"; fi
  curl -fsS -X POST "$BASE_URL$1" -H 'Content-Type: application/json' -d "$body"
}

login() {
  AUTH_TOKEN="$(json_post_public "/api/auth/login" '{"nationalId":"28705260103619","mobile":"01119441198","role":"super_admin"}' | node -e "
    let s = '';
    process.stdin.on('data', d => s += d).on('end', () => {
      const data = JSON.parse(s);
      if (data.role !== 'super_admin' || !data.token || !Array.isArray(data.apps) || !Array.isArray(data.permissions)) {
        console.error('FAIL: auth login endpoint');
        process.exit(1);
      }
      process.stdout.write(data.token);
    });
  ")"
  echo "PASS: auth login endpoint"
}

json_get() {
  curl -fsS "$BASE_URL$1" -H "Authorization: Bearer $AUTH_TOKEN"
}

json_post() {
  local body="${2-}"
  if [[ -z "$body" ]]; then body="{}"; fi
  curl -fsS -X POST "$BASE_URL$1" -H 'Content-Type: application/json' -H "Authorization: Bearer $AUTH_TOKEN" -d "$body"
}

expect_node() {
  local label="$1"
  local path="$2"
  local expr="$3"
  json_get "$path" | node -e "
    let s = '';
    process.stdin.on('data', d => s += d).on('end', () => {
      const data = JSON.parse(s);
      if (!($expr)) {
        console.error('FAIL: $label');
        process.exit(1);
      }
      console.log('PASS: $label');
    });
  "
}

expect_node "openapi has no catchall fallback" "/openapi/v1.json" "!Object.keys(data.paths).some((p) => p.includes('{**path}'))"
login
expect_node "faculties include canonical seed rows" "/api/lookups/faculties" "Array.isArray(data) && data.length >= 18 && data.some((row) => row.code === 'FAC-01')"
expect_node "cycles include canonical seed rows" "/api/cycles" "Array.isArray(data) && data.length >= 5 && data.some((row) => row.id === 'CYC-2026-M')"
expect_node "categories include locked set" "/api/admin/categories" "Array.isArray(data) && data.length >= 4 && data.some((row) => row.key === 'officers_general')"
expect_node "users include seeded admin" "/api/users" "Array.isArray(data) && data.some((row) => row.nationalId === '28705260103619')"
expect_node "roles include super admin" "/api/roles" "Array.isArray(data) && data.length >= 8 && data.some((row) => row.key === 'super_admin')"
expect_node "applicants page shape" "/api/applicants?page=1&pageSize=1" "Number.isInteger(data.total) && Array.isArray(data.data)"
expect_node "payments endpoint shape" "/api/admin/payments" "Array.isArray(data)"
expect_node "audit endpoint reads durable entries" "/api/audit" "Array.isArray(data)"
expect_node "committee instances endpoint shape" "/api/committee-instances" "Array.isArray(data)"
expect_node "committees endpoint shape" "/api/committees" "Array.isArray(data)"
expect_node "admission setup app settings endpoint" "/api/admin/app-settings/category-configs" "Array.isArray(data)"
expect_node "exam schedule endpoint" "/api/admin/exam-schedule/cycles/CYC-2026-M" "Array.isArray(data)"
expect_node "committee bindings endpoint" "/api/admin/committee-bindings/cycles/CYC-2026-M" "Array.isArray(data)"
expect_node "exam plan endpoint" "/api/cycles/CYC-2026-M/categories/officers_general/exam-plan" "data.cycleId === 'CYC-2026-M' && data.categoryId === 'officers_general'"
expect_node "grades endpoint" "/api/grades?page=1&pageSize=5" "Array.isArray(data.rows) && Number.isInteger(data.total)"
expect_node "officer lookup endpoint" "/v1/officers/lookup?nationalId=28705260103619" "data.officerCode === 'OFF-1001'"
expect_node "question bank seeded" "/api/questions" "Array.isArray(data) && data.length >= 52"
expect_node "exams seeded" "/api/exams" "Array.isArray(data) && data.length >= 2"
expect_node "exam categories grouped" "/api/exams/categories" "Array.isArray(data) && data.length >= 5"

echo "Admin API smoke completed against $BASE_URL"
