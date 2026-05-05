-- Harden moment view counting:
-- - do not count signed-in owners watching their own moments
-- - dedupe repeated views from the same signed-in user/device in a short window

create table if not exists public.moment_view_events (
  id bigserial primary key,
  moment_id uuid not null references public.moments (id) on delete cascade,
  viewer_user_id uuid references auth.users (id) on delete set null,
  viewer_key text,
  view_bucket timestamptz not null,
  viewed_at timestamptz not null default now(),
  constraint moment_view_events_has_viewer
    check (viewer_user_id is not null or nullif(viewer_key, '') is not null)
);

create unique index if not exists moment_view_events_user_bucket_uidx
  on public.moment_view_events (moment_id, viewer_user_id, view_bucket)
  where viewer_user_id is not null;

create unique index if not exists moment_view_events_device_bucket_uidx
  on public.moment_view_events (moment_id, viewer_key, view_bucket)
  where viewer_user_id is null and viewer_key is not null;

create index if not exists moment_view_events_moment_viewed_at_idx
  on public.moment_view_events (moment_id, viewed_at desc);

alter table public.moment_view_events enable row level security;

drop policy if exists "Moment owners read view events for their moments" on public.moment_view_events;
create policy "Moment owners read view events for their moments"
  on public.moment_view_events for select
  using (
    exists (
      select 1
      from public.moments m
      where m.id = moment_view_events.moment_id
        and m.user_id = auth.uid()
    )
  );

drop function if exists public.increment_moment_view(uuid);
drop function if exists public.increment_moment_view(uuid, text);

create or replace function public.increment_moment_view(
  p_moment_id uuid,
  p_viewer_key text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_viewer_id uuid := auth.uid();
  v_viewer_key text := nullif(left(coalesce(p_viewer_key, ''), 128), '');
  v_bucket timestamptz := date_trunc('hour', now());
  v_inserted_count integer := 0;
begin
  select m.user_id
  into v_owner_id
  from public.moments m
  where m.id = p_moment_id;

  if v_owner_id is null then
    return false;
  end if;

  if v_viewer_id is not null and v_viewer_id = v_owner_id then
    return false;
  end if;

  if v_viewer_id is null and v_viewer_key is null then
    return false;
  end if;

  insert into public.moment_view_events (
    moment_id,
    viewer_user_id,
    viewer_key,
    view_bucket
  )
  values (
    p_moment_id,
    v_viewer_id,
    case when v_viewer_id is null then v_viewer_key else null end,
    v_bucket
  )
  on conflict do nothing;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count > 0 then
    update public.moments
    set view_count = coalesce(view_count, 0) + 1
    where id = p_moment_id;
  end if;

  return v_inserted_count > 0;
end;
$$;

revoke all on function public.increment_moment_view(uuid, text) from public;
grant execute on function public.increment_moment_view(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
