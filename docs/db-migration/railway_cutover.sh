#!/usr/bin/env bash
# ============================================================================
# railway_cutover.sh — Phase 5 of the DB environment-separation migration.
# ----------------------------------------------------------------------------
# Repoints all four Railway services from the shared [PACademy] DB (schema-based
# env split) to the new per-environment databases on a single dbo schema:
#
#   pacademy-admin-prod-api      -> DB_PAcademy_Prod
#   pacademy-applicant-prod-api  -> DB_PAcademy_Prod
#   pacademy-admin-staging-api   -> DB_PAcademy_Staging
#   pacademy-applicant-staging-api -> DB_PAcademy_Staging
#
# For each service it sets, ATOMICALLY (single railway call => single redeploy,
# no partial-state window): Database__Schema=dbo, and each connection-string var
# with Database=<old> swapped to Database=<target>. The sa password is read from
# the existing Railway value and preserved (never hardcoded or printed).
#
# Setting Database__Schema=dbo EXPLICITLY (rather than removing it) keeps the
# cutover correct whether or not the dbo code change is deployed: the running
# image queries dbo in the new DB, where the migrated data lives.
#
# PREREQUISITES: RUNBOOK Phases 0-3 complete + sql/05 validation green.
#
# USAGE:
#   ./railway_cutover.sh            # DRY RUN — prints intended changes, sets nothing
#   ./railway_cutover.sh --apply    # APPLY  — sets the variables (one redeploy/service)
#
# Rollback: re-point the same vars to Database=PACademy + Database__Schema=
# admin_v2 / PACademy_staging_db (see sql/06_rollback.sql part (a)).
# ============================================================================
set -euo pipefail

ENV=production
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

echo "================================================================"
echo " Railway cutover — mode: $([ $APPLY -eq 1 ] && echo '*** APPLY ***' || echo 'DRY RUN (nothing changed)')"
echo "================================================================"

# "<service>:<targetDb>:<space-separated connection-string vars to repoint>"
ROWS=(
  "pacademy-admin-prod-api:DB_PAcademy_Prod:ConnectionStrings__AdminDb ConnectionStrings__Default"
  "pacademy-admin-staging-api:DB_PAcademy_Staging:ConnectionStrings__AdminDbUat ConnectionStrings__AdminDb ConnectionStrings__Default"
  "pacademy-applicant-prod-api:DB_PAcademy_Prod:ConnectionStrings__AdminDb ConnectionStrings__Default"
  "pacademy-applicant-staging-api:DB_PAcademy_Staging:ConnectionStrings__AdminDb ConnectionStrings__Default"
)

for row in "${ROWS[@]}"; do
  IFS=: read -r svc tgt keys <<<"$row"
  echo ""
  echo "== ${svc}  ->  ${tgt} =="
  cur_kv=$(railway variables -s "$svc" -e "$ENV" --kv 2>/dev/null || true)

  SETARGS=( --set "Database__Schema=dbo" )
  echo "    Database__Schema=dbo"
  for k in $keys; do
    cur=$(printf '%s\n' "$cur_kv" | sed -n "s/^${k}=//p" | head -1)
    if [ -z "$cur" ]; then echo "    ${k}: not set — skip"; continue; fi
    old_db=$(printf '%s' "$cur" | sed -nE 's/.*Database=([^;]*).*/\1/p')
    new=$(printf '%s' "$cur" | sed -E "s/Database=[^;]*/Database=${tgt}/")
    SETARGS+=( --set "${k}=${new}" )
    echo "    ${k}: Database=${old_db} -> Database=${tgt}  (password preserved)"
  done

  if [ $APPLY -eq 1 ]; then
    railway variables -s "$svc" -e "$ENV" "${SETARGS[@]}" >/dev/null
    echo "    APPLIED (${#SETARGS[@]} vars in one redeploy)"
  fi
done

echo ""
echo "================================================================"
if [ $APPLY -eq 1 ]; then
  echo " Applied. Each service redeploys once; wait for all four live,"
  echo " then run post-validation (/health/db => schema=dbo + new DB)."
else
  echo " DRY RUN complete — nothing changed. Re-run with --apply to execute."
fi
echo "================================================================"
