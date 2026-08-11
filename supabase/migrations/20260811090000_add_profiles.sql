-- 002_add_profiles.sql
-- Online Garage: user profile model (username, first name, last name).
-- Authentication stays email + password; this table only adds application
-- identity data. This migration is not executed automatically; review before
-- running.

-- ============================================================================
-- 1. public.profiles
-- One row per auth.users row. All profile fields are nullable so existing
-- users (who predate this migration) remain valid until they complete
-- onboarding; completeness is enforced at the application layer, not here.
-- ============================================================================
create table public.profiles (
    id            uuid primary key references auth.users(id) on delete cascade,
    username      text,
    first_name    text,
    last_name     text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),

    -- Usernames are always normalized (trimmed + lowercased) before being
    -- written, both in the application and in the auth.users trigger below,
    -- so this check only needs to confirm the stored value is already in
    -- that normalized form. Because no uppercase variant can ever pass this
    -- check, a plain UNIQUE constraint on the column (not on lower(username))
    -- is already sufficient for case-insensitive uniqueness: "horace" and
    -- "HORACE" cannot both satisfy this check while remaining distinct
    -- strings, since the only way "HORACE" could be stored is if it were
    -- first lowercased to "horace" -- at which point it collides directly.
    constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_]{3,30}$'),
    constraint profiles_username_unique unique (username),
    constraint profiles_first_name_not_blank check (first_name is null or length(trim(first_name)) > 0),
    constraint profiles_last_name_not_blank check (last_name is null or length(trim(last_name)) > 0)
);

comment on table public.profiles is 'Application identity data (username, first/last name) for an auth.users row. Authentication itself remains email + password.';

-- ============================================================================
-- updated_at bookkeeping
-- This trigger, not application code, is the source of truth for
-- updated_at: it unconditionally overwrites new.updated_at on every update
-- to the row, regardless of whether the client's UPDATE/upsert payload
-- included that column. created_at is never referenced here, so it always
-- keeps the value set by its own column default at insert time.
-- Runs as the invoking user (no SECURITY DEFINER needed): RLS's UPDATE
-- policy already establishes that the caller may modify this row, and the
-- trigger only ever touches the row already being written, so it needs no
-- elevated privilege.
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row
    execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;

create policy "Users can select their own profile"
    on public.profiles
    for select
    to authenticated
    using (auth.uid() = id);

create policy "Users can insert their own profile"
    on public.profiles
    for insert
    to authenticated
    with check (auth.uid() = id);

create policy "Users can update their own profile"
    on public.profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated;

-- ============================================================================
-- 2. New-user profile creation
-- Fires on every auth.users insert (i.e. every signup, regardless of whether
-- email confirmation is enabled) and best-effort populates a profiles row
-- from the metadata passed to supabase.auth.signUp({ options: { data } }).
-- Malformed or missing metadata never blocks account creation: invalid
-- fields are simply left null, to be completed later via /profile/setup.
-- SECURITY DEFINER + a fixed search_path is required because this runs
-- during the auth.users insert itself, before the new user has a session,
-- and must be able to write to public.profiles regardless of RLS.
--
-- search_path hardening: `set search_path = ''` below prevents this
-- SECURITY DEFINER function from resolving unqualified object names against
-- a schema an attacker could control (the classic SECURITY DEFINER
-- search_path hijack). Every non-built-in reference in the function body is
-- explicitly schema-qualified (public.profiles); the remaining unqualified
-- names (lower, trim, nullif, the `text`/`trigger` types) are all
-- pg_catalog built-ins, which Postgres always resolves regardless of
-- search_path -- pg_catalog is implicitly searched first no matter what
-- search_path is set to, even ''. So this function has no unsafe
-- name-resolution surface.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    candidate_username text;
    candidate_first_name text;
    candidate_last_name text;
begin
    candidate_username := nullif(lower(trim(new.raw_user_meta_data->>'username')), '');
    candidate_first_name := nullif(trim(new.raw_user_meta_data->>'first_name'), '');
    candidate_last_name := nullif(trim(new.raw_user_meta_data->>'last_name'), '');

    if candidate_username is not null and candidate_username !~ '^[a-z0-9_]{3,30}$' then
        candidate_username := null;
    end if;

    begin
        insert into public.profiles (id, username, first_name, last_name)
        values (new.id, candidate_username, candidate_first_name, candidate_last_name);
    exception
        -- Intentional safe fallback for the username race: if two signups
        -- concurrently request the same available username, both pass the
        -- application's is_username_available() pre-check (neither row
        -- exists yet), both proceed to create an auth.users row, and both
        -- triggers attempt this insert. Whichever commits first wins
        -- profiles_username_unique; the second hits unique_violation here.
        -- That losing signup still gets a valid profiles row -- just with
        -- username left null instead of failing account creation outright.
        -- isProfileComplete() then treats that row as incomplete, so
        -- ProtectedRoute routes that user to /profile/setup to choose a
        -- different (now-verified-available) username. The unique
        -- constraint is the sole source of truth for uniqueness: no branch
        -- of this function can ever cause two rows to share a username.
        when unique_violation then
            insert into public.profiles (id, username, first_name, last_name)
            values (new.id, null, candidate_first_name, candidate_last_name);
    end;

    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- ============================================================================
-- 3. Backfill for existing users
-- Users created before this migration have no profiles row yet. Give them an
-- empty one so they are not locked out; onboarding prompts them to fill it
-- in. Their historical metadata never contained username/first_name/
-- last_name (that concept did not exist yet), so there is nothing valid to
-- backfill from -- and per the design goal, no placeholder values are
-- invented here. Users choose their own username during onboarding.
-- ============================================================================
insert into public.profiles (id, username, first_name, last_name)
select u.id, null, null, null
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ============================================================================
-- 4. Username availability check
-- Lets the (possibly signed-out) signup form show "That username is already
-- taken" before attempting signup, without granting any read access to
-- profiles rows themselves -- only a boolean existence check is exposed.
--
-- SECURITY DEFINER is required here because anon/authenticated have no
-- SELECT grant or RLS access to other users' rows in public.profiles (by
-- design -- see the RLS policies above); this function briefly bypasses
-- that to check existence, but its return type is a single boolean, so no
-- row data (username text, names, timestamps) is ever exposed through it.
-- Same search_path hardening as handle_new_user() above: `set search_path
-- = ''` plus a fully schema-qualified public.profiles reference means this
-- function has no unsafe unqualified-name resolution surface either.
-- ============================================================================
create or replace function public.is_username_available(check_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select not exists (
        select 1
        from public.profiles
        where username = lower(trim(check_username))
    );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;
