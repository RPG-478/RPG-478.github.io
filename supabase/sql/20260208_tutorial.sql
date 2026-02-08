-- Add tutorial_completed flag to profiles
alter table public.profiles
  add column if not exists tutorial_completed boolean not null default false;
