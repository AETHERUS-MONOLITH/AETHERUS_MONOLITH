-- Section 1.2 Positive Construction 0.1: tenant workspace persistence substrate.
--
-- This migration is authored repository material only.
-- It has not been applied to the external Supabase project.
-- It has not been executed by this pass.
-- It has not been verified against live Supabase.
-- It does not prove backend, database, application-data persistence, RLS
-- implementation, tenant isolation, customer workspace, customer data handling,
-- audit ledger implementation, or production SaaS capability.
-- RLS policy SQL in this file is authored but not implemented until a later
-- authorized application and verification pass.

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null,
  invited_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_memberships_role_check
    check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint workspace_memberships_status_check
    check (status in ('active', 'invited', 'suspended'))
);

create table public.workspace_state_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  record_type text not null,
  record_key text not null,
  state_payload jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id),
  updated_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, record_type, record_key)
);

create table public.workspace_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  target_table text,
  target_id uuid,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workspaces_owner_user_id_idx
  on public.workspaces (owner_user_id);

create index workspaces_archived_at_idx
  on public.workspaces (archived_at)
  where archived_at is not null;

create index workspace_memberships_user_id_idx
  on public.workspace_memberships (user_id);

create index workspace_memberships_workspace_role_status_idx
  on public.workspace_memberships (workspace_id, role, status);

create index workspace_state_records_workspace_id_idx
  on public.workspace_state_records (workspace_id);

create index workspace_state_records_lookup_idx
  on public.workspace_state_records (workspace_id, record_type, record_key);

create index workspace_state_records_updated_at_idx
  on public.workspace_state_records (workspace_id, updated_at desc);

create index workspace_events_workspace_id_idx
  on public.workspace_events (workspace_id);

create index workspace_events_ordering_idx
  on public.workspace_events (workspace_id, created_at desc, id desc);

create index workspace_events_actor_user_id_idx
  on public.workspace_events (actor_user_id)
  where actor_user_id is not null;

create or replace function public.is_workspace_member(
  target_workspace_id uuid,
  allowed_roles text[] default array['owner', 'admin', 'member', 'viewer']
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role = any(allowed_roles)
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.workspace_state_records enable row level security;
alter table public.workspace_events enable row level security;

create policy "Workspace members can read workspaces"
  on public.workspaces
  for select
  using (
    owner_user_id = auth.uid()
    or public.is_workspace_member(id)
  );

create policy "Authenticated users can create owned workspaces"
  on public.workspaces
  for insert
  with check (owner_user_id = auth.uid());

create policy "Workspace owners and admins can update workspaces"
  on public.workspaces
  for update
  using (
    owner_user_id = auth.uid()
    or public.is_workspace_member(id, array['owner', 'admin'])
  )
  with check (
    owner_user_id = auth.uid()
    or public.is_workspace_member(id, array['owner', 'admin'])
  );

create policy "Workspace members can read memberships"
  on public.workspace_memberships
  for select
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
  );

create policy "Workspace owners and admins can invite memberships"
  on public.workspace_memberships
  for insert
  with check (
    exists (
      select 1
      from public.workspaces w
      where w.id = workspace_id
        and w.owner_user_id = auth.uid()
    )
    or public.is_workspace_member(workspace_id, array['owner', 'admin'])
  );

create policy "Workspace owners and admins can update memberships"
  on public.workspace_memberships
  for update
  using (
    exists (
      select 1
      from public.workspaces w
      where w.id = workspace_id
        and w.owner_user_id = auth.uid()
    )
    or public.is_workspace_member(workspace_id, array['owner', 'admin'])
  )
  with check (
    exists (
      select 1
      from public.workspaces w
      where w.id = workspace_id
        and w.owner_user_id = auth.uid()
    )
    or public.is_workspace_member(workspace_id, array['owner', 'admin'])
  );

create policy "Workspace members can read state records"
  on public.workspace_state_records
  for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace contributors can insert state records"
  on public.workspace_state_records
  for insert
  with check (
    public.is_workspace_member(workspace_id, array['owner', 'admin', 'member'])
  );

create policy "Workspace contributors can update state records"
  on public.workspace_state_records
  for update
  using (
    public.is_workspace_member(workspace_id, array['owner', 'admin', 'member'])
  )
  with check (
    public.is_workspace_member(workspace_id, array['owner', 'admin', 'member'])
  );

create policy "Workspace owners and admins can delete state records"
  on public.workspace_state_records
  for delete
  using (public.is_workspace_member(workspace_id, array['owner', 'admin']));

create policy "Workspace members can read events"
  on public.workspace_events
  for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can append events"
  on public.workspace_events
  for insert
  with check (
    public.is_workspace_member(workspace_id)
    and (actor_user_id is null or actor_user_id = auth.uid())
  );
