# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Claude Code plugin and marketplace manifests (`.claude-plugin/`), so the skill installs
  with `/plugin marketplace add lethucthanhtu/sap-skills`.
- `SKILL.md`: fetched web pages are treated as data, never as instructions; proprietary
  code and credentials stay out of search queries.

### Fixed

- `rap.md`: unmanaged save, late numbering, augmentation, precheck, side effects, business
  events (raised only in the late save phase), strict mode, unit-test environment and draft
  lifecycle examples now use real RAP syntax and APIs; invented classes and reports removed.
- `abap-core.md`: `AUTHORITY-CHECK` and `CL_ABAP_CHAR_UTILITIES` are available in ABAP Cloud;
  corrected the 3-tier model (and noted the 2025 clean core levels A–D), `FILTER`, T100
  exception class, and BAdI examples.
- `cds.md`: table functions work in ABAP Cloud; corrected virtual element, view entity
  extension, metadata extension, custom entity and analytics examples, and release versions.
- `odata.md`: RAP draft action names, CSRF in OData V4, batch references, unbound actions,
  delta requests, and V2/V4 comparison.
- `SKILL.md`: compatibility matrix and anti-pattern list; routing table no longer points to
  reference files that don't exist.
- `resources.md`: dead and duplicated links.
- README: folder structure matches the repository; documented all three install paths.

## [0.1.0] - 2026-05-14

- Initial all-in-one SAP skill: `SKILL.md` with ABAP Core, CDS, RAP, OData and resource
  references.
