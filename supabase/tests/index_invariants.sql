-- Structural index checks. These assertions do not depend on usage statistics.
-- Safe to run in any environment; no data or schema changes.

do $$
begin
  if exists (
    with idx as (
      select
        n.nspname as schema_name,
        t.relname as table_name,
        i.relname as index_name,
        ix.indisunique,
        ix.indisprimary,
        ix.indkey::text as indkey,
        coalesce(pg_get_expr(ix.indpred, ix.indrelid), '') as predicate,
        coalesce(pg_get_expr(ix.indexprs, ix.indrelid), '') as expressions
      from pg_index ix
      join pg_class t on t.oid = ix.indrelid
      join pg_class i on i.oid = ix.indexrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname in ('public', 'private')
    )
    select 1
    from idx a
    join idx b
      on a.schema_name = b.schema_name
     and a.table_name = b.table_name
     and a.indkey = b.indkey
     and a.predicate = b.predicate
     and a.expressions = b.expressions
     and a.index_name <> b.index_name
    where not a.indisunique
      and not a.indisprimary
      and (b.indisunique or b.indisprimary)
  ) then
    raise exception 'INDEX_INVARIANT_FAILED: exact non-unique duplicate of a unique/primary index exists';
  end if;
end $$;

do $$
begin
  if exists (
    with fks as (
      select
        n.nspname as schema_name,
        c.relname as table_name,
        con.conname,
        con.conkey as fk_cols,
        c.oid as table_oid
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where con.contype = 'f'
        and n.nspname in ('public', 'private')
    )
    select 1
    from fks f
    where not exists (
      select 1
      from pg_index ix
      where ix.indrelid = f.table_oid
        and ix.indisvalid
        and (ix.indkey::smallint[])[0:array_length(f.fk_cols, 1) - 1] = f.fk_cols
    )
  ) then
    raise exception 'INDEX_INVARIANT_FAILED: at least one foreign key lacks a leading-column index';
  end if;
end $$;

select 'index_invariants_ok' as result;
