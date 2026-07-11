-- Kör hela filen i Supabase SQL Editor en gång.
-- Frontendens första anslutning skapar sedan familjekoden och startuppgifterna.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.todo_settings (
  singleton boolean primary key default true check (singleton),
  access_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.todo_tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  next_step text not null default '' check (char_length(next_step) <= 500),
  urgency smallint not null default 3 check (urgency between 1 and 5),
  value_creation smallint not null default 3 check (value_creation between 1 and 5),
  calm smallint not null default 3 check (calm between 1 and 5),
  energy smallint not null default 3 check (energy between 1 and 5),
  tags text[] not null default '{}',
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority integer not null check (priority > 0),
  updated_by text not null check (updated_by in ('Erik', 'Annika')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists todo_tasks_priority_key on public.todo_tasks(priority);

alter table public.todo_settings enable row level security;
alter table public.todo_tasks enable row level security;

revoke all on public.todo_settings from public, anon, authenticated;
revoke all on public.todo_tasks from public, anon, authenticated;

create or replace function public.todo_has_access(p_access_code text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.todo_settings
    where singleton = true
      and access_hash = extensions.crypt(p_access_code, access_hash)
  );
$$;

create or replace function public.todo_require_access(p_access_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from public.todo_settings) then
    raise exception 'TODO_NOT_INITIALIZED' using errcode = 'P0001';
  end if;

  if not public.todo_has_access(p_access_code) then
    raise exception 'TODO_ACCESS_DENIED' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.todo_initialize(
  p_access_code text,
  p_actor text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if exists (select 1 from public.todo_settings) then
    raise exception 'TODO_ALREADY_INITIALIZED' using errcode = 'P0001';
  end if;

  if char_length(p_access_code) < 12 then
    raise exception 'TODO_CODE_TOO_SHORT' using errcode = '22023';
  end if;

  if p_actor not in ('Erik', 'Annika') then
    raise exception 'TODO_INVALID_ACTOR' using errcode = '22023';
  end if;

  insert into public.todo_settings(singleton, access_hash)
  values (true, extensions.crypt(p_access_code, extensions.gen_salt('bf', 12)));

  insert into public.todo_tasks
    (priority, title, next_step, urgency, value_creation, calm, energy, tags, status, updated_by)
  values
    (1, 'Grovgräva klart för poolen', 'Fortsätt grovgrävningen och få bort de stora nivåskillnaderna.', 5, 5, 5, 5, array['Trädgård', 'Pool'], 'todo', p_actor),
    (2, 'Göra en plan för poolprojektet', 'Skriv ned återstående moment, material och ordning.', 5, 4, 4, 1, array['Planering', 'Pool'], 'todo', p_actor),
    (3, 'Förbereda marken för poolen', 'Finjustera, packa och kontrollera att hela ytan är i nivå.', 5, 5, 5, 4, array['Trädgård', 'Pool'], 'todo', p_actor),
    (4, 'Bygga och ställa upp poolen', 'Montera poolen när marken är helt klar.', 5, 5, 5, 5, array['Pool', 'Familj'], 'todo', p_actor),
    (5, 'Följa upp Toyota om service och AC', 'Ring Toyota om de inte svarar på meddelandet.', 3, 3, 3, 1, array['Fordon', 'Samtal'], 'doing', p_actor),
    (6, 'Boka service för gräsklippare och grästrimmer', 'Ring den första serviceverkstaden i Birsta.', 4, 4, 4, 1, array['Trädgård', 'Samtal', 'Service'], 'todo', p_actor),
    (7, 'Hantera ekonomin efter bilförsäljningen', 'När betalningen kommit: amortera lån och betala Amex och andra krediter.', 5, 5, 5, 2, array['Ekonomi'], 'todo', p_actor),
    (8, 'Hämta nya bilen onsdag 15 juli', 'Kontrollera tid och vad som behöver tas med.', 5, 5, 4, 2, array['Fordon', 'Positivt'], 'todo', p_actor),
    (9, 'Följa upp jobbet', 'Ring chefen och hör om teamet behöver något från dig.', 4, 4, 4, 2, array['Arbete', 'Samtal'], 'todo', p_actor),
    (10, 'Prata med chefen om semester efter sjukskrivningen', 'Ta upp möjligheten att lägga ersättningssemestern direkt efter nästa vecka.', 5, 5, 5, 1, array['Arbete', 'Återhämtning'], 'todo', p_actor),
    (11, 'Boka besiktningsman till sommarstugan', 'Ta fram kontaktuppgifter och boka en tid.', 3, 3, 3, 1, array['Sommarstuga'], 'todo', p_actor),
    (12, 'Boka hjälp för stopp i avloppet', 'Kontakta en rörfirma och beskriv stoppet.', 4, 4, 4, 1, array['Hus', 'Underhåll'], 'todo', p_actor),
    (13, 'Grovstäda köket', 'Dammsug och skura golvet.', 3, 4, 3, 2, array['Hem', 'Städning'], 'todo', p_actor),
    (14, 'Tömma och organisera garaget', 'Skapa tydliga ytor för släng, spara och sälja.', 2, 4, 4, 4, array['Hus', 'Organisation'], 'todo', p_actor),
    (15, 'Gå igenom pappas Rover', 'Bedöm skicket och bestäm om nästa steg är försäljning.', 2, 3, 4, 3, array['Fordon', 'Projekt'], 'todo', p_actor),
    (16, 'Röja ur de två förrådsrummen', 'Börja med ett rum när garaget har fått plats.', 2, 4, 4, 4, array['Hus', 'Organisation'], 'todo', p_actor),
    (17, 'Trädgårdsarbete efter maskinservicen', 'Röj, täck mot återväxt och klipp gräset.', 3, 4, 3, 4, array['Trädgård'], 'todo', p_actor);
end;
$$;

create or replace function public.todo_list(p_access_code text)
returns table (
  id uuid,
  title text,
  next_step text,
  urgency smallint,
  value_creation smallint,
  calm smallint,
  energy smallint,
  tags text[],
  status text,
  priority integer,
  updated_by text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  perform public.todo_require_access(p_access_code);

  return query
  select
    t.id, t.title, t.next_step, t.urgency, t.value_creation, t.calm,
    t.energy, t.tags, t.status, t.priority, t.updated_by, t.created_at, t.updated_at
  from public.todo_tasks t
  order by t.priority;
end;
$$;

create or replace function public.todo_create(
  p_access_code text,
  p_actor text,
  p_title text,
  p_next_step text,
  p_urgency smallint,
  p_value_creation smallint,
  p_calm smallint,
  p_energy smallint,
  p_tags text[],
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  perform public.todo_require_access(p_access_code);

  insert into public.todo_tasks
    (title, next_step, urgency, value_creation, calm, energy, tags, status, priority, updated_by)
  values
    (trim(p_title), coalesce(trim(p_next_step), ''), p_urgency, p_value_creation,
     p_calm, p_energy, coalesce(p_tags, '{}'), p_status,
     coalesce((select max(priority) from public.todo_tasks), 0) + 1, p_actor)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.todo_update(
  p_access_code text,
  p_id uuid,
  p_actor text,
  p_title text,
  p_next_step text,
  p_urgency smallint,
  p_value_creation smallint,
  p_calm smallint,
  p_energy smallint,
  p_tags text[],
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.todo_require_access(p_access_code);

  update public.todo_tasks
  set title = trim(p_title),
      next_step = coalesce(trim(p_next_step), ''),
      urgency = p_urgency,
      value_creation = p_value_creation,
      calm = p_calm,
      energy = p_energy,
      tags = coalesce(p_tags, '{}'),
      status = p_status,
      updated_by = p_actor,
      updated_at = now()
  where id = p_id;

  if not found then
    raise exception 'TODO_TASK_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.todo_delete(
  p_access_code text,
  p_id uuid,
  p_actor text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.todo_require_access(p_access_code);

  delete from public.todo_tasks where id = p_id;

  if not found then
    raise exception 'TODO_TASK_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.todo_tasks set priority = priority + 100000;

  with ranked as (
    select id, row_number() over (order by priority)::integer as new_priority
    from public.todo_tasks
  )
  update public.todo_tasks t
  set priority = ranked.new_priority,
      updated_by = p_actor,
      updated_at = now()
  from ranked
  where t.id = ranked.id;
end;
$$;

create or replace function public.todo_reorder(
  p_access_code text,
  p_ids uuid[],
  p_actor text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  item_count integer;
  unique_count integer;
begin
  perform public.todo_require_access(p_access_code);

  select count(*) into item_count from public.todo_tasks;
  select count(distinct item) into unique_count from unnest(p_ids) as u(item);

  if cardinality(p_ids) <> item_count or unique_count <> item_count then
    raise exception 'TODO_INVALID_ORDER' using errcode = '22023';
  end if;

  -- Tvåstegsuppdatering undviker krock med det unika prioritetsindexet.
  update public.todo_tasks set priority = priority + 100000;

  update public.todo_tasks t
  set priority = ordered.position,
      updated_by = p_actor,
      updated_at = now()
  from unnest(p_ids) with ordinality as ordered(id, position)
  where t.id = ordered.id;
end;
$$;

revoke all on function public.todo_has_access(text) from public;
revoke all on function public.todo_require_access(text) from public;
revoke all on function public.todo_initialize(text, text) from public;
revoke all on function public.todo_list(text) from public;
revoke all on function public.todo_create(text, text, text, text, smallint, smallint, smallint, smallint, text[], text) from public;
revoke all on function public.todo_update(text, uuid, text, text, text, smallint, smallint, smallint, smallint, text[], text) from public;
revoke all on function public.todo_delete(text, uuid, text) from public;
revoke all on function public.todo_reorder(text, uuid[], text) from public;

grant execute on function public.todo_initialize(text, text) to anon, authenticated;
grant execute on function public.todo_list(text) to anon, authenticated;
grant execute on function public.todo_create(text, text, text, text, smallint, smallint, smallint, smallint, text[], text) to anon, authenticated;
grant execute on function public.todo_update(text, uuid, text, text, text, smallint, smallint, smallint, smallint, text[], text) to anon, authenticated;
grant execute on function public.todo_delete(text, uuid, text) to anon, authenticated;
grant execute on function public.todo_reorder(text, uuid[], text) to anon, authenticated;
