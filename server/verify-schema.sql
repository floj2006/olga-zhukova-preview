-- Read-only diagnostics. Run after schema.sql in the Supabase SQL editor.
-- Reports configuration only: no lead contents, writes or secret values.
with required_tables(name) as (values
  ('olga_site'), ('olga_leads'), ('olga_rate_limits'), ('olga_availability')
), table_checks as (
  select 'table.' || required_tables.name as check_name,
    case when c.oid is null then false else
      c.relrowsecurity
      and not has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and has_table_privilege('service_role', c.oid, 'SELECT')
      and has_table_privilege('service_role', c.oid, 'INSERT')
      and has_table_privilege('service_role', c.oid, 'UPDATE')
      and has_table_privilege('service_role', c.oid, 'DELETE')
    end as ok
  from required_tables left join pg_class c on c.oid = to_regclass('public.' || required_tables.name)
), required_functions(signature) as (values
  ('olga_initialize(jsonb)'),
  ('olga_save_catalog(integer,jsonb)'),
  ('olga_add_lead(jsonb,integer)'),
  ('olga_update_lead(uuid,jsonb)'),
  ('olga_gallery(text,uuid,jsonb)'),
  ('olga_rate_limit(text,integer,integer)'),
  ('olga_save_availability(integer,jsonb)'),
  ('olga_order_gallery(jsonb)'),
  ('olga_search_leads(text,text,integer,integer)'),
  ('olga_save_content(integer,jsonb)')
), function_checks as (
  select 'function.' || signature as check_name,
    case when p.oid is null then false else
      not p.prosecdef
      and coalesce(p.proconfig @> array['search_path=public'], false)
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
    end as ok
  from required_functions left join pg_proc p on p.oid = to_regprocedure('public.' || signature)
), bucket_check as (
  select 'storage.olga-gallery' as check_name, exists(
    select 1 from storage.buckets where id = 'olga-gallery' and public
      and file_size_limit = 3145728
      and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']
      and allowed_mime_types <@ array['image/jpeg', 'image/png', 'image/webp']
  ) as ok
)
select * from table_checks union all select * from function_checks union all select * from bucket_check order by check_name;
-- All rows must be true. This does not prove transactional writes or delivery
-- of VK notifications; those require a separate test project and actual access.
