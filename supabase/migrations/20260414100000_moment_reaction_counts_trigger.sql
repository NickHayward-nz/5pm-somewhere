-- Keep moments.*_count in sync with user_reactions (logged-in) and allow anon bumps via RPC.
-- Client-side UPDATE on moments was blocked by RLS for non-owners; triggers run as definer.

create or replace function public.moment_reaction_apply_delta(
  p_moment_id uuid,
  p_reaction_type text,
  p_delta int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_delta is distinct from 1 and p_delta is distinct from -1 then
    raise exception 'invalid reaction delta';
  end if;
  if p_reaction_type = 'pretty' then
    update public.moments
    set pretty_count = greatest(0, coalesce(pretty_count, 0) + p_delta)
    where id = p_moment_id;
  elsif p_reaction_type = 'funny' then
    update public.moments
    set funny_count = greatest(0, coalesce(funny_count, 0) + p_delta)
    where id = p_moment_id;
  elsif p_reaction_type = 'cheers' then
    update public.moments
    set cheers_count = greatest(0, coalesce(cheers_count, 0) + p_delta)
    where id = p_moment_id;
  else
    raise exception 'invalid reaction type';
  end if;
end;
$$;

-- Logged-in users: counts follow user_reactions rows (no client UPDATE on moments).
create or replace function public.user_reactions_sync_moment_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.moment_reaction_apply_delta(new.moment_id, new.reaction_type, 1);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.moment_reaction_apply_delta(old.moment_id, old.reaction_type, -1);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists user_reactions_sync_moment_counts_trigger on public.user_reactions;
create trigger user_reactions_sync_moment_counts_trigger
  after insert or delete on public.user_reactions
  for each row execute function public.user_reactions_sync_moment_counts();

-- Anonymous live-stream viewers: bump totals without a user_reactions row.
create or replace function public.bump_moment_reaction_for_anon(
  p_moment_id uuid,
  p_reaction_type text,
  p_delta int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.moment_reaction_apply_delta(p_moment_id, p_reaction_type, p_delta);
end;
$$;

revoke all on function public.bump_moment_reaction_for_anon(uuid, text, int) from public;
grant execute on function public.bump_moment_reaction_for_anon(uuid, text, int) to anon;
