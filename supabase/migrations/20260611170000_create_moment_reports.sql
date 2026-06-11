-- Minimum moderation foundation: authenticated users can report public moments for admin review.

create table if not exists public.moment_reports (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in (
      'unsafe_or_inappropriate',
      'private_information',
      'spam_or_fake',
      'harassment_or_hate',
      'other'
    )
  ),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (moment_id, reporter_user_id)
);

create index if not exists moment_reports_status_created_at_idx
  on public.moment_reports (status, created_at desc);

create index if not exists moment_reports_moment_id_idx
  on public.moment_reports (moment_id);

alter table public.moment_reports enable row level security;

revoke all on public.moment_reports from anon;
grant insert, select on public.moment_reports to authenticated;

-- Users may create a report tied to their own auth uid.
drop policy if exists "users can create own reports" on public.moment_reports;
create policy "users can create own reports"
  on public.moment_reports
  for insert
  to authenticated
  with check (reporter_user_id = auth.uid());

-- Users may see only their own submitted reports. Admin review can use the service role.
drop policy if exists "users can read own reports" on public.moment_reports;
create policy "users can read own reports"
  on public.moment_reports
  for select
  to authenticated
  using (reporter_user_id = auth.uid());
