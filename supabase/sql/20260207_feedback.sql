-- Feedback tables for beta

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  rating int not null check (rating between 1 and 5),
  message text null,
  context jsonb null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  summary text not null,
  steps text null,
  expected text null,
  actual text null,
  context jsonb null,
  user_agent text null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
alter table public.bug_reports enable row level security;

-- Service role inserts only (edge function uses service role)
create policy "service_insert_feedback" on public.feedback
  for insert
  with check (true);

create policy "service_insert_bug_reports" on public.bug_reports
  for insert
  with check (true);
