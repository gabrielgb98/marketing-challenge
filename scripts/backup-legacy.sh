#!/usr/bin/env bash
set -euo pipefail
# Read-only production export. Connection/password must live in libpq config.
: "${PGSERVICE:?Configure PGSERVICE securely before running}"
out=${1:?Pass an encrypted, private backup directory}
umask 077
mkdir -p "$out"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
export PGOPTIONS='-c default_transaction_read_only=on'
pg_dump --format=custom --schema=public --no-owner --no-privileges --file="$out/public-$stamp.dump"
psql -X -q -v ON_ERROR_STOP=1 --tuples-only --no-align > "$out/inventory-$stamp.json" <<'SQL'
begin transaction isolation level repeatable read read only;
select jsonb_build_object('captured_at',now(),'games',(select count(*) from public.games),'teams',(select count(*) from public.teams),'answers',(select count(*) from public.answers),'game_224062',(select to_jsonb(g) from public.games g where code='224062'),'teams_224062',(select jsonb_agg(to_jsonb(t) order by id) from public.teams t where code='224062'),'answers_224062',(select jsonb_agg(to_jsonb(a) order by team_id,idx) from public.answers a where code='224062'));
commit;
SQL
sha256sum "$out/public-$stamp.dump" "$out/inventory-$stamp.json" > "$out/checksums-$stamp.txt"
printf 'Backup exported. Restore and compare in an independent project before any production change.\n'
