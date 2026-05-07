-- Track lifetime uploads so the first three moments can receive launch priority
-- even after old free-tier moments are pruned.

alter table public.profiles
  add column if not exists total_uploads integer not null default 0;

update public.profiles p
set total_uploads = greatest(0, coalesce(m.upload_count, 0))::integer
from (
  select user_id, count(*) as upload_count
  from public.moments
  where user_id is not null
  group by user_id
) m
where p.id = m.user_id
  and p.total_uploads = 0;

comment on column public.profiles.total_uploads is
  'Lifetime successful moment uploads; used for first-three-upload launch priority.';

notify pgrst, 'reload schema';
