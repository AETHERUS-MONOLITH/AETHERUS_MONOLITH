\set ON_ERROR_STOP on

do $$ begin if not exists (select 1 from pg_catalog.pg_roles where rolname='anon') then create role anon noinherit; end if; end $$;
do $$ begin if not exists (select 1 from pg_catalog.pg_roles where rolname='authenticated') then create role authenticated noinherit; end if; end $$;
do $$ begin if not exists (select 1 from pg_catalog.pg_roles where rolname='service_role') then create role service_role noinherit bypassrls; end if; end $$;
do $$ begin if not exists (select 1 from pg_catalog.pg_roles where rolname='postgres') then create role postgres superuser; end if; end $$;

create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;

create table auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
