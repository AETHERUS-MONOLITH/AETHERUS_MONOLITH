# GEO 0.1 Baseline

Overall classification: completed_with_findings
Structural findings hash: a6aa2a9378b4c6c3f9600ea0e677ee63b385b94d238076aa8509a328dd54c33b

## Validated Source Truth

- Camilo Carlone is represented as a Person with unresolved public JSON-LD @id, ORCID, and Wikidata identifiers.
- AETHERUS is represented as a Project, with no legal-company, employer, publisher, institution, or formal organization status inferred.
- The Apologetic Authority is represented as a Report authored by Camilo Carlone, with confirmed canonical URL and version DOI.

## Observed Endpoint Facts

- home_camilocarlone: 200 text/html; charset=utf-8
  - requested: https://camilocarlone.com/
  - final: https://camilocarlone.com/
  - raw_sha256: 29cf327a77fd05778b7caa8efd38c4cfdb182877c98733bc0a305b1734ce82ac
  - normalized_sha256: 24bd20200c064ec236dfb2f1ea6c2ff4931e1a63c8f79d122f9fa8f947765373

- taa_publication_page: 200 text/html; charset=utf-8
  - requested: https://camilocarlone.com/the-apologetic-authority/
  - final: https://camilocarlone.com/the-apologetic-authority/
  - raw_sha256: 8ee65ce9c0b1e858cd02b4f55c050f7cabe8a766d28ca81dbd961400e61d3536
  - normalized_sha256: 317eb5308c1506c83e46f34f1587b0e91e85dd211af28be43ab8f4eb7c5e8b23

- aetherus_pages: 200 text/html; charset=utf-8
  - requested: https://aetherus-monolith.pages.dev/
  - final: https://aetherus-monolith.pages.dev/
  - raw_sha256: 29cf327a77fd05778b7caa8efd38c4cfdb182877c98733bc0a305b1734ce82ac
  - normalized_sha256: 24bd20200c064ec236dfb2f1ea6c2ff4931e1a63c8f79d122f9fa8f947765373

- taa_zenodo_doi: 200 text/html; charset=utf-8
  - requested: https://doi.org/10.5281/zenodo.20788207
  - final: https://zenodo.org/records/20788207
  - raw_sha256: 14d61ea3230f5d0545653412adc9e8540a7f8bad4c16ab322fa26606a13617e0
  - normalized_sha256: ecd4749ca93e69cdc3e37be13639410c70cdad8ee65a6006439cce4b512e5cb4

- aetherus_github_org: 200 text/html; charset=utf-8
  - requested: https://github.com/AETHERUS-MONOLITH
  - final: https://github.com/AETHERUS-MONOLITH
  - raw_sha256: 3ae2bd048477a7667d719cbbf45684822c356445657d951cea6b3f810be6def4
  - normalized_sha256: 94fb695a6c667919d5b4fed115b0026f7441a5644571f2c4fb0ff3b25295918b

- lesswrong_camilo_profile: 200 text/html; charset=utf-8
  - requested: https://www.lesswrong.com/users/camilocarlone
  - final: https://www.lesswrong.com/users/camilocarlone
  - raw_sha256: 8f1c22a770da47938fbe4a33e18b6620616cdaa32debd43b34c338a9df8fab24
  - normalized_sha256: 587b3e2ccec718b40d8aef6c2095552476b3607f7242e63ea5cfce569490989d

## Findings By Category

### identity
- pass/info: geo-identity-source-truth-pass — Source-truth identity invariants are valid.

### endpoint_availability
- pass/info: geo-endpoint-aetherus_github_org — Endpoint responded within configured availability boundaries.
- pass/info: geo-endpoint-aetherus_pages — Endpoint responded within configured availability boundaries.
- pass/info: geo-endpoint-home_camilocarlone — Endpoint responded within configured availability boundaries.
- pass/info: geo-endpoint-lesswrong_camilo_profile — Endpoint responded within configured availability boundaries.
- pass/info: geo-endpoint-taa_publication_page — Endpoint responded within configured availability boundaries.
- pass/info: geo-endpoint-taa_zenodo_doi — Endpoint responded within configured availability boundaries.

### backlink
- finding/warning: geo-backlink-aetherus_github_org — Authorized seed backlinks are not universally discoverable from this seed response; this is not an identity invalidation.
- finding/warning: geo-backlink-aetherus_pages — Authorized seed backlinks are not universally discoverable from this seed response; this is not an identity invalidation.
- finding/warning: geo-backlink-home_camilocarlone — Authorized seed backlinks are not universally discoverable from this seed response; this is not an identity invalidation.
- finding/warning: geo-backlink-lesswrong_camilo_profile — Authorized seed backlinks are not universally discoverable from this seed response; this is not an identity invalidation.
- finding/warning: geo-backlink-taa_publication_page — Authorized seed backlinks are not universally discoverable from this seed response; this is not an identity invalidation.
- finding/warning: geo-backlink-taa_zenodo_doi — Authorized seed backlinks are not universally discoverable from this seed response; this is not an identity invalidation.

### metadata
- finding/warning: geo-metadata-aetherus_pages-canonical-absent — Canonical URL metadata is absent or not extractable from this endpoint.
- finding/warning: geo-metadata-home_camilocarlone-canonical-absent — Canonical URL metadata is absent or not extractable from this endpoint.
- finding/warning: geo-metadata-taa-source-public-type-contradiction — Contradiction: observed public JSON-LD type ScholarlyArticle differs from GEO source-truth type Report; GEO 0.1 reports rather than repairs it.

### jsonld
- finding/warning: geo-jsonld-aetherus_github_org-structured-data-absent — structured_data_absent: no JSON-LD block was observed; this is separate from fetch availability.
- finding/warning: geo-jsonld-aetherus_pages-structured-data-absent — structured_data_absent: no JSON-LD block was observed; this is separate from fetch availability.
- finding/warning: geo-jsonld-home_camilocarlone-structured-data-absent — structured_data_absent: no JSON-LD block was observed; this is separate from fetch availability.
- finding/warning: geo-jsonld-lesswrong_camilo_profile-structured-data-absent — structured_data_absent: no JSON-LD block was observed; this is separate from fetch availability.
- finding/warning: geo-jsonld-taa-source-type-contradiction — Contradiction: observed JSON-LD type ScholarlyArticle differs from source-truth type Report.

### reproducibility
- pass/info: geo-reproducibility-aetherus_github_org — Raw and normalized evidence hashes or structured failure state are present.
- pass/info: geo-reproducibility-aetherus_pages — Raw and normalized evidence hashes or structured failure state are present.
- pass/info: geo-reproducibility-home_camilocarlone — Raw and normalized evidence hashes or structured failure state are present.
- pass/info: geo-reproducibility-lesswrong_camilo_profile — Raw and normalized evidence hashes or structured failure state are present.
- pass/info: geo-reproducibility-taa_publication_page — Raw and normalized evidence hashes or structured failure state are present.
- pass/info: geo-reproducibility-taa_zenodo_doi — Raw and normalized evidence hashes or structured failure state are present.

### chunk_readability
- pass/info: geo-chunk-aetherus_github_org — Advisory chunk readability heuristics did not flag this endpoint.
- pass/info: geo-chunk-aetherus_pages — Advisory chunk readability heuristics did not flag this endpoint.
- pass/info: geo-chunk-home_camilocarlone — Advisory chunk readability heuristics did not flag this endpoint.
- pass/info: geo-chunk-lesswrong_camilo_profile — Advisory chunk readability heuristics did not flag this endpoint.
- pass/info: geo-chunk-taa_publication_page — Advisory chunk readability heuristics did not flag this endpoint.
- pass/info: geo-chunk-taa_zenodo_doi — Advisory chunk readability heuristics did not flag this endpoint.

## Unresolved Facts

- entity:camilo_carlone public_jsonld_id
- entity:camilo_carlone ORCID
- entity:camilo_carlone Wikidata
- entity:aetherus public_jsonld_id
- entity:aetherus legal-company or institutional status
- entity:the_apologetic_authority public_jsonld_id

## Statements Not Established

- No indexing, ranking, citation, retrieval, or model-uptake outcome is established.
- No affiliation, credential, employer, publisher, institutional relationship, legal status, or research-impact claim is added.
- Missing backlinks are not identity invalidation.
- Advisory chunk heuristics are not retrieval or ranking evidence.

## Evidence Policy

- Committed normalized evidence observations: 6
- Excerpt limit: 420 characters
- Response-size limit: 750000 bytes
- Timeout: 10000 ms
- Redirect limit: 5
- Raw material retained: false
