-- Track moment views and expose each signed-in user's total reach/rank.

alter table public.moments
  add column if not exists view_count bigint not null default 0;

create index if not exists moments_user_view_count_idx
  on public.moments (user_id, view_count);

create or replace function public.increment_moment_view(p_moment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.moments
  set view_count = coalesce(view_count, 0) + 1
  where id = p_moment_id;
end;
$$;

revoke all on function public.increment_moment_view(uuid) from public;
grant execute on function public.increment_moment_view(uuid) to anon, authenticated;

create or replace function public.get_my_reach_stats()
returns table(total_views bigint, global_rank bigint)
language sql
stable
security definer
set search_path = public
as $$
  with user_totals as (
    select
      m.user_id,
      coalesce(sum(m.view_count), 0)::bigint as views
    from public.moments m
    where m.user_id is not null
    group by m.user_id
  ),
  my_total as (
    select coalesce((select views from user_totals where user_id = auth.uid()), 0)::bigint as views
  )
  select
    my_total.views as total_views,
    case
      when auth.uid() is null or my_total.views <= 0 then null::bigint
      else (
        select (count(*) + 1)::bigint
        from user_totals
        where views > my_total.views
      )
    end as global_rank
  from my_total;
$$;

revoke all on function public.get_my_reach_stats() from public;
grant execute on function public.get_my_reach_stats() to authenticated;

notify pgrst, 'reload schema';
