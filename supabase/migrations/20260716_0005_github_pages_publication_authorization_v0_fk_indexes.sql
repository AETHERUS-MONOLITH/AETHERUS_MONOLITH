-- Cover action-specific authorization foreign keys used for lifecycle checks.
create index github_pages_publication_authorizations_v0_workspace_idx
  on private.github_pages_publication_authorizations_v0 (workspace_id);
create index github_pages_publication_authorizations_v0_authorizer_user_idx
  on private.github_pages_publication_authorizations_v0 (authorizer_user_id);
