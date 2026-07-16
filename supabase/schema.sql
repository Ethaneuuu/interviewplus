create extension if not exists pgcrypto;

create table if not exists public.authorized_users (
  email text primary key,
  full_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.authorized_users enable row level security;

create or replace function public.is_authorized_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.authorized_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and active = true
  );
$$;

revoke all on function public.is_authorized_user() from public;
grant execute on function public.is_authorized_user() to authenticated;

create or replace function public.hook_restrict_signup_to_authorized(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_email text;
begin
  requested_email := lower(coalesce(event -> 'user' ->> 'email', ''));

  if exists (
    select 1
    from public.authorized_users
    where lower(email) = requested_email
      and active = true
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Cette adresse email ne fait pas partie des utilisateurs autorisés.'
    )
  );
end;
$$;

grant execute
  on function public.hook_restrict_signup_to_authorized(jsonb)
  to supabase_auth_admin;

revoke execute
  on function public.hook_restrict_signup_to_authorized(jsonb)
  from authenticated, anon, public;

drop policy if exists "authorized_users_select_own" on public.authorized_users;
create policy "authorized_users_select_own"
on public.authorized_users
for select
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and active = true
);

insert into storage.buckets (id, name, public)
values ('interviewplus-private', 'interviewplus-private', false)
on conflict (id) do update set public = false;

drop policy if exists "authenticated_read_interviewplus_questions" on storage.objects;
create policy "authenticated_read_interviewplus_questions"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'interviewplus-private'
  and name = 'Questions_InterviewPlus_Bilingual.xlsx'
  and public.is_authorized_user()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.session_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  theme text not null,
  question_count integer not null,
  timer_minutes integer not null,
  global_score integer,
  questions_json jsonb not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists session_runs_user_created_idx
  on public.session_runs (user_id, created_at desc);

alter table public.session_runs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() is not null and auth.uid() = id and public.is_authorized_user());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() is not null and auth.uid() = id and public.is_authorized_user())
with check (auth.uid() is not null and auth.uid() = id and public.is_authorized_user());

drop policy if exists "session_runs_select_own" on public.session_runs;
create policy "session_runs_select_own"
on public.session_runs
for select
to authenticated
using (auth.uid() is not null and auth.uid() = user_id and public.is_authorized_user());

drop policy if exists "session_runs_insert_own" on public.session_runs;
create policy "session_runs_insert_own"
on public.session_runs
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = user_id and public.is_authorized_user());

drop policy if exists "session_runs_update_own" on public.session_runs;
create policy "session_runs_update_own"
on public.session_runs
for update
to authenticated
using (auth.uid() is not null and auth.uid() = user_id and public.is_authorized_user())
with check (auth.uid() is not null and auth.uid() = user_id and public.is_authorized_user());

drop policy if exists "session_runs_delete_own" on public.session_runs;
create policy "session_runs_delete_own"
on public.session_runs
for delete
to authenticated
using (auth.uid() is not null and auth.uid() = user_id and public.is_authorized_user());
