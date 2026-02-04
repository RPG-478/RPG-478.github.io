-- Profiles table for plan/quota management
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free',
  free_quota_remaining integer not null default 20,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by owner" on public.profiles
  for select using (auth.uid() = id);

create policy "Profiles are updatable by owner" on public.profiles
  for update using (auth.uid() = id);

-- Optional: keep profiles in sync on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, plan, free_quota_remaining)
  values (new.id, 'free', 20)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
