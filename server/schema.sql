-- Run once in the Supabase SQL editor. Only the server's service-role key may access these tables/functions.
create table if not exists public.olga_site (
  id text primary key check (id = 'main'),
  catalog jsonb not null
);
create table if not exists public.olga_leads (
  id uuid primary key,
  request_id uuid not null unique,
  created_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists olga_leads_created_at on public.olga_leads (created_at desc);
create table if not exists public.olga_rate_limits (
  key text primary key,
  count integer not null,
  expires_at timestamptz not null
);
create table if not exists public.olga_availability (
  id text primary key check (id = 'main'),
  version integer not null default 1 check (version > 0),
  dates jsonb not null default '[]'::jsonb check (jsonb_typeof(dates) = 'array')
);
insert into public.olga_availability(id) values ('main') on conflict (id) do nothing;
create index if not exists olga_rate_expiry on public.olga_rate_limits (expires_at);
alter table public.olga_site enable row level security;
alter table public.olga_leads enable row level security;
alter table public.olga_rate_limits enable row level security;
alter table public.olga_availability enable row level security;
revoke all on public.olga_site, public.olga_leads, public.olga_rate_limits, public.olga_availability from anon, authenticated;
grant all on public.olga_site, public.olga_leads, public.olga_rate_limits, public.olga_availability to service_role;

create or replace function public.olga_initialize(seed jsonb) returns void
language sql set search_path = public as $$
  insert into public.olga_site(id, catalog) values ('main', seed) on conflict (id) do nothing;
$$;

create or replace function public.olga_save_catalog(expected_version integer, new_services jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare current_catalog jsonb;
begin
  select catalog into current_catalog from public.olga_site where id = 'main' for update;
  if (current_catalog->>'version')::integer is distinct from expected_version then
    raise exception 'catalog_changed';
  end if;
  current_catalog := jsonb_set(jsonb_set(current_catalog, '{services}', new_services), '{version}', to_jsonb(expected_version + 1));
  update public.olga_site set catalog = current_catalog where id = 'main';
  return current_catalog;
end;
$$;

create or replace function public.olga_add_lead(entry jsonb, expected_version integer) returns jsonb
language plpgsql set search_path = public as $$
  declare existing jsonb; current_catalog jsonb; busy_dates jsonb;
begin
  -- Repeated requests across different serverless instances create only one lead.
  perform pg_advisory_xact_lock(hashtextextended(entry->>'requestId', 0));
  select data into existing from public.olga_leads where request_id = (entry->>'requestId')::uuid;
  if existing is not null then
    if existing->>'fingerprint' is distinct from entry->>'fingerprint' then raise exception 'request_conflict'; end if;
    return existing;
  end if;
  select catalog into current_catalog from public.olga_site where id = 'main' for share;
  if (current_catalog->>'version')::integer is distinct from expected_version then raise exception 'catalog_changed'; end if;
    -- Share lock serializes the check against concurrent calendar edits.
    select dates into busy_dates from public.olga_availability where id = 'main' for share;
    if nullif(entry->>'eventDate', '') is not null then
      if (entry->>'eventDate')::date < (current_timestamp at time zone 'Europe/Moscow')::date then
        raise exception 'date_past';
      end if;
      if exists (select 1 from jsonb_array_elements(busy_dates) d where d->>'date' = entry->>'eventDate') then
        raise exception 'date_busy';
      end if;
    end if;
    insert into public.olga_leads(id, request_id, data)
    values ((entry->>'id')::uuid, (entry->>'requestId')::uuid, entry);
  return entry;
end;
$$;

create or replace function public.olga_update_lead(lead_id uuid, changes jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare updated jsonb; current_data jsonb;
begin
  select data into current_data from public.olga_leads where id=lead_id for update;
  if current_data is null then raise exception 'not_found'; end if;
  if changes ? '_expectedVersion' and coalesce((current_data->>'version')::integer,1) is distinct from (changes->>'_expectedVersion')::integer then raise exception 'record_changed'; end if;
  changes := (changes-'_expectedVersion') || jsonb_build_object('version',coalesce((current_data->>'version')::integer,1)+case when changes ? 'status' then 1 else 0 end);
  update public.olga_leads set data = data || changes where id = lead_id returning data into updated;
  if updated is null then raise exception 'not_found'; end if;
  return updated;
end;
$$;

create or replace function public.olga_gallery(operation text, photo_id uuid, entry jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare current_catalog jsonb; photos jsonb; photo jsonb; result jsonb; found_photo boolean := false; updated_photos jsonb := '[]'::jsonb;
begin
  select catalog into current_catalog from public.olga_site where id = 'main' for update;
  photos := coalesce(current_catalog->'gallery', '[]'::jsonb);
  if operation = 'add' then
    if jsonb_array_length(photos) >= 200 then raise exception 'gallery_limit'; end if;
    updated_photos := photos || jsonb_build_array(entry);
    result := entry;
  elsif operation = 'update' or operation = 'delete' then
    for photo in select value from jsonb_array_elements(photos) loop
      if photo->>'id' = photo_id::text then
        found_photo := true;
        result := photo;
        if operation = 'update' then
          if entry ? '_expectedVersion' and coalesce((photo->>'version')::integer,1) is distinct from (entry->>'_expectedVersion')::integer then raise exception 'record_changed'; end if;
          result := photo || (entry-'_expectedVersion') || jsonb_build_object('version',coalesce((photo->>'version')::integer,1)+1);
          updated_photos := updated_photos || jsonb_build_array(result);
        end if;
      else
        updated_photos := updated_photos || jsonb_build_array(photo);
      end if;
    end loop;
    if not found_photo then raise exception 'not_found'; end if;
  else
    raise exception 'invalid_operation';
  end if;
  update public.olga_site set catalog = jsonb_set(current_catalog, '{gallery}', updated_photos) where id = 'main';
  return result;
end;
$$;

create or replace function public.olga_rate_limit(bucket_key text, max_count integer, window_seconds integer) returns boolean
language plpgsql set search_path = public as $$
declare current_count integer;
begin
  delete from public.olga_rate_limits where expires_at < now() - interval '1 day';
  insert into public.olga_rate_limits as counters(key, count, expires_at)
    values (bucket_key, 1, now() + make_interval(secs => window_seconds))
  on conflict (key) do update set
    count = case when counters.expires_at <= now() then 1 else counters.count + 1 end,
    expires_at = case when counters.expires_at <= now() then now() + make_interval(secs => window_seconds) else counters.expires_at end
  returning count into current_count;
  return current_count <= max_count;
end;
$$;

create or replace function public.olga_save_availability(expected_version integer, date_changes jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare current_version integer; current_dates jsonb; change jsonb; existing jsonb; updated_date jsonb; stamp text;
begin
  select version, dates into current_version, current_dates from public.olga_availability where id = 'main' for update;
  if current_version is distinct from expected_version then raise exception 'availability_changed'; end if;
  if jsonb_typeof(date_changes) is distinct from 'array' then raise exception 'invalid_changes'; end if;
  if jsonb_array_length(date_changes) < 1 or jsonb_array_length(date_changes) > 366 then raise exception 'invalid_changes'; end if;
  if (select count(distinct value->>'date') from jsonb_array_elements(date_changes)) <> jsonb_array_length(date_changes) then
    raise exception 'invalid_changes';
  end if;
  stamp := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  for change in select value from jsonb_array_elements(date_changes) loop
    if not coalesce(change->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$', false)
      or jsonb_typeof(change->'busy') is distinct from 'boolean' then raise exception 'invalid_changes'; end if;
    if to_char((change->>'date')::date, 'YYYY-MM-DD') <> change->>'date' then raise exception 'invalid_changes'; end if;
    select value into existing from jsonb_array_elements(current_dates) where value->>'date' = change->>'date';
    select coalesce(jsonb_agg(value order by value->>'date'), '[]'::jsonb) into current_dates
      from jsonb_array_elements(current_dates) where value->>'date' <> change->>'date';
    if (change->>'busy')::boolean then
      updated_date := jsonb_build_object(
        'id', coalesce(existing->>'id', gen_random_uuid()::text),
        'date', change->>'date', 'status', 'busy',
        'note', coalesce(change->>'note', existing->>'note', ''),
        'createdAt', coalesce(existing->>'createdAt', stamp), 'updatedAt', stamp
      );
      current_dates := current_dates || jsonb_build_array(updated_date);
    end if;
  end loop;
  select coalesce(jsonb_agg(value order by value->>'date'), '[]'::jsonb) into current_dates from jsonb_array_elements(current_dates);
  update public.olga_availability set version = expected_version + 1, dates = current_dates where id = 'main';
  return jsonb_build_object('version', expected_version + 1, 'dates', current_dates);
end;
$$;

create or replace function public.olga_order_gallery(photo_ids jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare current_catalog jsonb; photos jsonb; ordered_photos jsonb;
begin
  select catalog into current_catalog from public.olga_site where id = 'main' for update;
  photos := coalesce(current_catalog->'gallery', '[]'::jsonb);
  if jsonb_typeof(photo_ids) is distinct from 'array' then raise exception 'gallery_changed'; end if;
  if jsonb_array_length(photo_ids) <> jsonb_array_length(photos)
    or (select count(distinct value) from jsonb_array_elements_text(photo_ids)) <> jsonb_array_length(photo_ids) then
    raise exception 'gallery_changed';
  end if;
  select coalesce(jsonb_agg(photo.value order by requested.ordinality), '[]'::jsonb) into ordered_photos
    from jsonb_array_elements_text(photo_ids) with ordinality as requested(id, ordinality)
    join jsonb_array_elements(photos) as photo(value) on photo.value->>'id' = requested.id;
  if jsonb_array_length(ordered_photos) <> jsonb_array_length(photos) then raise exception 'gallery_changed'; end if;
  update public.olga_site set catalog = jsonb_set(current_catalog, '{gallery}', ordered_photos) where id = 'main';
  return ordered_photos;
end;
$$;

revoke all on function public.olga_initialize(jsonb) from public, anon, authenticated;
revoke all on function public.olga_save_catalog(integer, jsonb) from public, anon, authenticated;
revoke all on function public.olga_add_lead(jsonb, integer) from public, anon, authenticated;
revoke all on function public.olga_update_lead(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.olga_gallery(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.olga_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.olga_save_availability(integer, jsonb) from public, anon, authenticated;
revoke all on function public.olga_order_gallery(jsonb) from public, anon, authenticated;
grant execute on function public.olga_initialize(jsonb) to service_role;
grant execute on function public.olga_save_catalog(integer, jsonb) to service_role;
grant execute on function public.olga_add_lead(jsonb, integer) to service_role;
grant execute on function public.olga_update_lead(uuid, jsonb) to service_role;
grant execute on function public.olga_gallery(text, uuid, jsonb) to service_role;
grant execute on function public.olga_rate_limit(text, integer, integer) to service_role;
grant execute on function public.olga_save_availability(integer, jsonb) to service_role;
grant execute on function public.olga_order_gallery(jsonb) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('olga-gallery', 'olga-gallery', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- No anon/authenticated INSERT/UPDATE/DELETE policy: uploads use the server's service-role key only.

-- Search before pagination. Literal substring search avoids wildcard/query injection.
create or replace function public.olga_search_leads(search_text text, status_filter text, page_offset integer, page_limit integer)
returns jsonb language sql stable set search_path = public as $$
  with matches as materialized (
    select id, created_at, data from public.olga_leads
    where (status_filter = '' or data->>'status' = status_filter)
      and (trim(search_text) = '' or
        strpos(lower(concat_ws(' ', data->>'name', data->>'phone', data->>'eventType',
          case data->>'eventType' when 'wedding' then 'Свадьба' when 'corporate' then 'Корпоратив'
            when 'anniversary' then 'Юбилей' when 'graduation' then 'Выпускной' when 'other' then 'Другое событие' end,
          data->>'eventDate', data->>'comment', data->>'note')), lower(trim(search_text))) > 0
        or (trim(search_text) ~ '^[+0-9[:space:]()-]+$'
          and length(regexp_replace(search_text, '[^0-9]', '', 'g')) > 0
          and strpos(regexp_replace(data->>'phone', '[^0-9]', '', 'g'), regexp_replace(search_text, '[^0-9]', '', 'g')) > 0))
  ), page as (
    select * from matches order by created_at desc, id desc
    offset greatest(0, page_offset) limit greatest(1, least(100, page_limit))
  ) select jsonb_build_object(
    'leads', coalesce((select jsonb_agg(data order by created_at desc, id desc) from page), '[]'::jsonb),
    'total', (select count(*) from matches));
$$;
revoke all on function public.olga_search_leads(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.olga_search_leads(text, text, integer, integer) to service_role;

-- Editorial content is versioned independently from prices.
create or replace function public.olga_save_content(expected_version integer, new_content jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare c jsonb; result jsonb;
begin
 select catalog into c from public.olga_site where id='main' for update;
 if coalesce((c->'content'->>'version')::integer,1) is distinct from expected_version then raise exception 'content_changed'; end if;
 result := jsonb_set(new_content,'{version}',to_jsonb(expected_version+1));
 update public.olga_site set catalog=jsonb_set(c,'{content}',result) where id='main';
 return result;
end;
$$;
revoke all on function public.olga_save_content(integer,jsonb) from public,anon,authenticated;
grant execute on function public.olga_save_content(integer,jsonb) to service_role;
