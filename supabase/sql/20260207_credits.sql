-- Daily credits + account cap support

alter table public.profiles
  add column if not exists daily_claimed_at date;

-- Optional: store last grant size (future use)
alter table public.profiles
  add column if not exists daily_claimed_count int;
