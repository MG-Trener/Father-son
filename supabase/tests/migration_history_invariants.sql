-- Read-only check: the production migration history must match the canonical
-- migration files committed in this repository at this revision.
do $$
declare
  expected_versions text[] := array[
    '20260910153606','20260910154234','20260910154921','20260910155200',
    '20260910160546','20260910160612','20260910162349','20260910162803',
    '20260910170034','20260910170215','20260910171719','20260910172253',
    '20260910174606','20260910174707','20260910175642','20260910180352',
    '20260910180541','20260910182605','20260910192446',
    '20260911155940','20260911160026','20260911161437','20260911162542',
    '20260911163124','20260911164002','20260911164412','20260911164450',
    '20260911164803','20260911170125','20260911173915','20260911174143',
    '20260911175303',
    '20260912210947','20260912211020','20260912211316','20260912212129',
    '20260912214308','20260912214607','20260912214855','20260912215039',
    '20260912215253',
    '20260913013835','20260913014101','20260913014638','20260913015028',
    '20260913015330','20260913015518','20260913022147','20260913105525',
    '20260913115928','20261007111031','20261007151944'
  ];
  actual_versions text[];
  missing_versions text[];
  unexpected_versions text[];
begin
  select array_agg(version order by version)
    into actual_versions
  from supabase_migrations.schema_migrations;

  select array_agg(v order by v)
    into missing_versions
  from unnest(expected_versions) as v
  where not (v = any(coalesce(actual_versions, array[]::text[])));

  select array_agg(v order by v)
    into unexpected_versions
  from unnest(coalesce(actual_versions, array[]::text[])) as v
  where not (v = any(expected_versions));

  if cardinality(coalesce(actual_versions, array[]::text[])) <> cardinality(expected_versions)
     or missing_versions is not null
     or unexpected_versions is not null then
    raise exception 'MIGRATION_HISTORY_FAILED: expected %, actual %, missing %, unexpected %',
      cardinality(expected_versions),
      cardinality(coalesce(actual_versions, array[]::text[])),
      coalesce(missing_versions, array[]::text[]),
      coalesce(unexpected_versions, array[]::text[]);
  end if;
end $$;

select 'migration_history_ok' as result;
