alter table private.github_pages_publication_authorizations_v0
  add constraint github_pages_publication_authorizations_v0_permitted_effect_ck
  check (permitted_effect = 'replace the current GitHub Pages deployment for the canonical target with the exact bound uploaded artifact');
