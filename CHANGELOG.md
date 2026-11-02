# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Claude Code plugin packaging: `.claude-plugin/plugin.json` (skill `sap` loaded from the
  repository root) and `.claude-plugin/marketplace.json` (marketplace `sap-skills`).
- Subagents `sap-researcher`, `abap-reviewer` and `sap-architect` (read-only tool allowlists).
- Command `/sap:research` for a sourced answer to one SAP question.
- `claude-ai/project-instructions.md` for claude.ai Projects.
- Domains CDS, OData, Clean Core, MDG, BTP, Fiori / SAPUI5, CAP, HANA / SQLScript and
  Integration Suite (router only), alongside ABAP Core and RAP — 11 domains in total.
- Zero-dependency tooling (Node.js ≥ 22): `npm run validate` (frontmatter, routing and
  orphan checks for `SKILL.md` → `DOMAIN.md` → `references/`, agents, manifests, links,
  secrets, token budget), `npm run build` (deterministic `dist/claude-ai/sap.zip`),
  `npm run evals:gen` / `evals:run` (31 trigger cases for `claude plugin eval`), unit tests.
- Prettier configuration and `npm run format:check`; `npm run check` runs the full gate.
- GitHub Actions workflow running validate, tests, format check, build and
  `claude plugin validate .` on `main` and `latest`.
- `THIRD_PARTY_NOTICES.md` crediting the MIT-licensed projects that topic outlines were
  adapted from.

### Changed

- `SKILL.md` is now a single router skill named `sap` that routes to
  `domain/<name>/DOMAIN.md`; the RAP release table follows the RAP BDL feature table in the
  ABAP keyword documentation (unmanaged 7.53, managed 7.54, draft 7.55, `strict` 7.56,
  `strict(2)` and business events 7.57, side effects 7.58).
- Cross-domain links use full `domain/<name>/references/…` paths.
- README rewritten for the plugin and claude.ai install paths and the new layout.

### Fixed

- `AUTHORITY-CHECK OBJECT` and CDS table functions are documented as allowed in ABAP Cloud
  (they were listed as forbidden).
- BAdI reference links pointed to clean-core files under an outdated path.
- The skill did not trigger on key user, on-stack or side-by-side extensibility questions
  (found by the trigger evals); the description now names those terms.
