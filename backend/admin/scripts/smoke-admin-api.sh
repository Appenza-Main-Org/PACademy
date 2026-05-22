#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:5101}"

json_get() {
  curl -fsS "$BASE_URL$1"
}

json_post() {
  local body="${2-}"
  if [[ -z "$body" ]]; then body="{}"; fi
  curl -fsS -X POST "$BASE_URL$1" -H 'Content-Type: application/json' -d "$body"
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
expect_node "faculties seed count" "/api/lookups/faculties" "Array.isArray(data) && data.length === 18"
expect_node "cycles seed count" "/api/cycles" "Array.isArray(data) && data.length === 5"
expect_node "categories locked set" "/api/admin/categories" "Array.isArray(data) && data.length === 4"
expect_node "users seed count" "/api/users" "Array.isArray(data) && data.length === 10"
expect_node "roles seed count" "/api/roles" "Array.isArray(data) && data.length === 12"
expect_node "applicants page count" "/api/applicants?page=1&pageSize=1" "data.total === 2847 && Array.isArray(data.data) && data.data.length === 1"
expect_node "payments seed count" "/api/admin/payments" "Array.isArray(data) && data.length === 2847"
expect_node "audit seed count" "/api/audit" "Array.isArray(data) && data.length >= 687"
expect_node "committee instances seed count" "/api/committee-instances" "Array.isArray(data) && data.length === 15"
expect_node "committees seed count" "/api/committees" "Array.isArray(data) && data.length === 18"
expect_node "admission setup app settings endpoint" "/api/admin/app-settings/category-configs" "Array.isArray(data)"
expect_node "exam schedule endpoint" "/api/admin/exam-schedule/cycles/CYC-2026-M" "Array.isArray(data)"
expect_node "committee bindings endpoint" "/api/admin/committee-bindings/cycles/CYC-2026-M" "Array.isArray(data)"
expect_node "exam plan endpoint" "/api/cycles/CYC-2026-M/categories/officers_general/exam-plan" "data.cycleId === 'CYC-2026-M' && data.categoryId === 'officers_general'"
expect_node "grades endpoint" "/api/grades?page=1&pageSize=5" "Array.isArray(data.rows) && Number.isInteger(data.total)"
expect_node "officer lookup endpoint" "/v1/officers/lookup?nationalId=29512011500011" "data.officerCode === 'OFF-1001'"

json_post "/api/auth/login" '{"username":"admin","password":"admin","role":"super_admin"}' | node -e "
  let s = '';
  process.stdin.on('data', d => s += d).on('end', () => {
    const data = JSON.parse(s);
    if (data.role !== 'super_admin' || !data.token || !Array.isArray(data.apps) || !Array.isArray(data.permissions)) {
      console.error('FAIL: auth login endpoint');
      process.exit(1);
    }
    console.log('PASS: auth login endpoint');
  });
"

curl -sS -X POST "$BASE_URL/api/cycles/CYC-2025-M/activate" -H 'Content-Type: application/json' -d '{}' | node -e "
  let s = '';
  process.stdin.on('data', d => s += d).on('end', () => {
    const data = JSON.parse(s);
    if (data.conflictCode !== 'ACTIVE_CYCLE_EXISTS') {
      console.error('FAIL: active-cycle conflict envelope');
      process.exit(1);
    }
    console.log('PASS: active-cycle conflict envelope');
  });
"

echo "Admin API smoke completed against $BASE_URL"
