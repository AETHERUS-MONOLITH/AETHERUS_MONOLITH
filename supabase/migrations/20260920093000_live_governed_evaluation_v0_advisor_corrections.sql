begin;

drop policy live_governed_evaluation_runs_member_select
  on public.live_governed_evaluation_runs;

create policy live_governed_evaluation_runs_member_select
  on public.live_governed_evaluation_runs
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
  );

drop policy live_governed_evaluation_events_member_select
  on public.live_governed_evaluation_events;

create policy live_governed_evaluation_events_member_select
  on public.live_governed_evaluation_events
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
  );

create index live_governed_evaluation_events_workspace_idx
  on public.live_governed_evaluation_events (workspace_id);

create index live_governed_evaluation_events_user_idx
  on public.live_governed_evaluation_events (user_id);

commit;
