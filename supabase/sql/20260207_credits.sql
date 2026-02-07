-- Daily credits + account cap support

alter table public.profiles
  add column if not exists daily_claimed_at date;

-- Optional: store last grant size (future use)
alter table public.profiles
  add column if not exists daily_claimed_count int;

-- Enforce beta account cap (500)
create or replace function public.enforce_beta_account_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count int;
begin
  select count(*) into total_count from public.profiles;
  if total_count >= 500 then
    raise exception 'Account limit reached';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_beta_account_cap on public.profiles;
create trigger enforce_beta_account_cap
before insert on public.profiles
for each row
execute function public.enforce_beta_account_cap();
