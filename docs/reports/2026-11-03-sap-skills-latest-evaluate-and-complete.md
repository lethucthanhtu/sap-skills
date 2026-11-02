# sap-skills `latest`: evaluate and complete

Date: 2026-11-03 · Branch: `lethucthanhtu/sap-skills-latest` (local commits only, nothing pushed)
Base: `b2af4aa` (tip of `latest` before this work) · Port source: `lethucthanhtu/sap-skills-complete`

## Summary

`latest` had a good router skill and two deep domains (ABAP Core, RAP), but no packaging,
tooling, tests or evals, and some release facts that were wrong or contradicted each other.
This work keeps the `SKILL.md` → `domain/<name>/DOMAIN.md` → `references/` layout. It ports
the useful content from `sap-skills-complete` as nine more domains, without duplicating
anything, and fixes the release facts against the RAP BDL feature table in the ABAP keyword
documentation. It also packages the skill as a Claude Code plugin with three read-only agents
and a `/sap:research` command, and adds a claude.ai zip build and zero-dependency validation,
tests, trigger evals and CI.

Commits on top of `b2af4aa`:

| Commit    | Message                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| `622723a` | feat: add nine SAP domains and align release facts with the RAP feature table   |
| `ef3ea34` | feat: package the sap skill as a Claude Code plugin with tooling                |
| `254e507` | docs: rewrite README for plugin and claude.ai installs, add CHANGELOG           |
| `9835cae` | fix: add extensibility trigger terms to the sap skill description               |
| (this)    | docs: add the evaluate-and-complete report                                      |

## Scorecard: before and after

| Area | Before (`b2af4aa`) | After |
| --- | --- | --- |
| Domains | 2 (abap-core: 6 files, rap: 14 files) | 11 (57 files under `domain/`); integration-suite has a router but no references yet |
| Root references | 3 | 4 (adds `research-workflow.md`) |
| Release facts | `SKILL.md` said ABAP Cloud has "no table functions, no AUTHORITY-CHECK" (both wrong). RAP release gates for `strict(2)`, events and augmentation contradicted each other across files | One RAP table checked against the RAP BDL feature table (7.53 → 7.58). AUTHORITY-CHECK and table functions are documented as allowed |
| Routing integrity | Not checked | `npm run validate`: every DOMAIN.md is routed from SKILL.md, every reference from its DOMAIN.md, no orphans and no dangling paths |
| Claude Code packaging | None | `.claude-plugin/plugin.json` + `marketplace.json`; `claude plugin validate .` passes |
| Agents / commands | None | `sap-researcher`, `abap-reviewer`, `sap-architect` (explicit read-only tools); `/sap:research` |
| claude.ai | Manual folder upload | `npm run build` → `dist/claude-ai/sap.zip` (64 files, 293.4 kB, deterministic) + `claude-ai/project-instructions.md` |
| Tests | None | 16 unit tests (frontmatter, zip, lint rules, eval rendering) |
| Trigger evals | None | 31 cases (24 positive, 7 negative), all passing |
| CI | None | `.github/workflows/validate.yml` (validate, test, format, build, plugin validate) |
| Docs | README only | README rewritten; CHANGELOG (Keep a Changelog); THIRD_PARTY_NOTICES (MIT credits) |
| Licence hygiene | GPL-3.0, sources not credited | GPL-3.0 kept; MIT sources credited (efeumutaslan/SAP-SKILLS, likweitan/abap-skills) |
| Public-repo hygiene | Not checked | Validate scans for secrets and forbidden terms; no customer, employer or system data was ported |

## Trigger evals (`claude plugin eval`, Claude Code 2.1.316, `--no-publish`)

| Run | Cases | Result | Cost | Time |
| --- | --- | --- | --- | --- |
| Full suite, 1 run per case | 31 | 30/31 (passRate 0.968, score 0.984) | $6.46 | 387 s |
| All 7 negatives, 3 runs each | 7 | 7/7, 21/21 runs | $1.77 | 96 s |
| `trigger-key-user-vs-side-by-side` after the fix, 3 runs | 1 | 1/1, 3/3 runs | $0.52 | 24 s |

The one failure was the prompt _"Should I build this approval extension as a key user
extension, an on-stack ABAP Cloud app, or side-by-side on BTP?"_: the skill did not fire.
Adding "key user, on-stack or side-by-side extensibility" to the description fixed it in
`9835cae`. The other 30 cases were not rerun after that change, which only adds trigger
terms. Total eval spend was about $8.75. The result files are in `evals/results/`, which is
gitignored.

## Verification (real output, after the last content commit)

There is no TypeScript in this repo, so `node --check` on every `.mjs` file stands in for a
typecheck. Prettier is the lint/format gate: `.prettierrc.json` sets `endOfLine: "auto"`.
`npm run check` = validate + test + format:check + build.

```text
ok node --check scripts/build.mjs
ok node --check scripts/gen-evals.mjs
ok node --check scripts/validate.mjs
ok node --check scripts/lib/evals.mjs
ok node --check scripts/lib/frontmatter.mjs
ok node --check scripts/lib/lint.mjs
ok node --check scripts/lib/repo.mjs
ok node --check scripts/lib/zip.mjs
ok node --check tests/lib.test.mjs

> sap-skills@0.1.0 check
> npm run validate && npm test && npm run format:check && npm run build


> sap-skills@0.1.0 validate
> node scripts/validate.mjs

Token budget (estimated, chars/4):
┌─────────┬──────────────────────────────────────┬──────────┬──────────┬────────────┐
│ (index) │ file                                 │ alwaysOn │ onInvoke │ references │
├─────────┼──────────────────────────────────────┼──────────┼──────────┼────────────┤
│ 0       │ 'SKILL.md'                           │ 207      │ 2563     │ 19172      │
│ 1       │ 'domain/abap-core/DOMAIN.md'         │ 0        │ 4967     │ 38167      │
│ 2       │ 'domain/btp/DOMAIN.md'               │ 0        │ 942      │ 1174       │
│ 3       │ 'domain/cap/DOMAIN.md'               │ 0        │ 1103     │ 907        │
│ 4       │ 'domain/cds/DOMAIN.md'               │ 0        │ 1662     │ 5348       │
│ 5       │ 'domain/clean-core/DOMAIN.md'        │ 0        │ 1237     │ 2859       │
│ 6       │ 'domain/fiori-sapui5/DOMAIN.md'      │ 0        │ 972      │ 912        │
│ 7       │ 'domain/hana-sqlscript/DOMAIN.md'    │ 0        │ 925      │ 987        │
│ 8       │ 'domain/integration-suite/DOMAIN.md' │ 0        │ 1111     │ 0          │
│ 9       │ 'domain/mdg/DOMAIN.md'               │ 0        │ 858      │ 1191       │
│ 10      │ 'domain/odata/DOMAIN.md'             │ 0        │ 1162     │ 4577       │
│ 11      │ 'domain/rap/DOMAIN.md'               │ 0        │ 4577     │ 110418     │
└─────────┴──────────────────────────────────────┴──────────┴──────────┴────────────┘
checked 1 skill, 11 domains, 3 agents, 117 text files, 426 external URLs
✔ validation passed

> sap-skills@0.1.0 test
> node --test "tests/**/*.test.mjs"

✔ frontmatter: folded block, inline list, dash list, booleans, quotes (2.6829ms)
✔ frontmatter: CRLF and BOM are tolerated, missing block returns null (0.2896ms)
✔ frontmatter: duplicate keys and junk lines throw with a line number (0.4121ms)
✔ zip: round-trips names and content, deterministic, rejects traversal (2.1721ms)
✔ lintSkill: accepts a good skill (0.6563ms)
✔ lintSkill: catches name mismatch, missing trigger phrase, long description, bad keys (0.3431ms)
✔ lintSkill: Claude Code-only keys are allowed only when not packaged for claude.ai (1.4975ms)
✔ lintDomainRouting: accepts a fully wired layout (1.8069ms)
✔ lintDomainRouting: missing files, orphans and unrouted domains (1.0988ms)
✔ lintDomainRouting: a cross-link from another domain does not count as a route (0.5572ms)
✔ relativeLinks: ignores URLs, anchors and code (1.0077ms)
✔ lintAgent: requires explicit read-only tools and matching name (1.0546ms)
✔ lintManifests: plugin entry and version must match (0.207ms)
✔ lintTriggerCases: ids, expected skills, positive/negative balance (0.3926ms)
✔ lintContent: secrets and forbidden terms (0.3587ms)
✔ renderCase: positive and negative graders (0.3944ms)
ℹ tests 16
ℹ suites 0
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 118.4269

> sap-skills@0.1.0 format:check
> npx -y prettier@3.3.3 --check .

Checking formatting...
All matched files use Prettier code style!

> sap-skills@0.1.0 build
> node scripts/build.mjs

┌─────────┬──────────────────────────┬───────┬─────────┐
│ (index) │ zip                      │ files │ kB      │
├─────────┼──────────────────────────┼───────┼─────────┤
│ 0       │ 'dist/claude-ai/sap.zip' │ 64    │ '293.4' │
└─────────┴──────────────────────────┴───────┴─────────┘
✔ built 1 claude.ai skill zip(s) in dist/claude-ai/
npm run check exit=0
Validating marketplace manifest: C:\Users\lethu\orca\workspaces\sap-skills\sap-skills-latest\.claude-plugin\marketplace.json

Plugin directory checks for C:\Users\lethu\orca\workspaces\sap-skills\sap-skills-latest. The plugin directory is the catalog that plugins are submitted to; this is a subset of what it runs.

⚠ Found 1 plugin directory warning:

  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). No icon found in the plugin. The validator looked for `icon` in plugin.json and for a file at .claude-plugin/icon.png or .svg, assets/icon.png or .svg, or a similar path.
    Fix: Add a square PNG to the plugin folder at .claude-plugin/icon.png, or set `icon` in plugin.json to the path of a square PNG or JPEG in the plugin: 512 to 2048 px on each side, under 2 MB. SVG and WebP are not accepted. That file may become the listing icon only once: the first time the plugin is saved or submitted in the developer portal. Adding or changing it later does not change the icon.

About these checks:

  ❯ This folder also holds a marketplace manifest. The plugin directory treats such a folder as a plugin, so these checks cover only the plugin in this folder. To check another plugin that the marketplace lists, run validate on that plugin's folder.

These plugin directory checks do not change the result below.

The directory also runs a safety scan and a policy review that this command does not.

✔ Validation passed
claude plugin validate exit=0
```

`ICON_MISSING` is a plugin-directory listing warning and does not fail validation (see owner
decisions).

## Owner decisions needed

1. **`main` vs `latest`.** `main` (`c981ab0`) and this branch differ by 122 files. This branch
   is a superset of `latest`. Decide whether it replaces `main`, or whether `main` stays the
   stable line and `latest` gets merged in later.
2. **Marketplace branch.** `/plugin marketplace add lethucthanhtu/sap-skills` reads the
   default branch (`main`). If `latest` should ship first, either make the manifest live on
   `main` or tell users to add the marketplace with a `#latest` ref.
3. **Plugin icon.** `claude plugin validate .` warns `ICON_MISSING`. A 512–2048 px square PNG
   at `.claude-plugin/icon.png` is needed before submitting to the plugin directory. The
   first saved icon is permanent there.
4. **Version.** `plugin.json`, `marketplace.json` and `package.json` are at `0.1.0`. Pick the
   release version and move `[Unreleased]` in the CHANGELOG under it.
5. **Evals in CI.** CI does not run `evals:run`: it costs money (about $6.50 for one full
   pass) and needs a Claude credential. Options: run it manually before a release, or add a
   scheduled job with a secret and a `--max-cost-usd` cap.
6. **`evals/` inside the skills path.** `plugin.json` declares `"skills": ["./"]`, so
   `claude plugin eval` warns that `evals/` overlaps a component location. Either always pass
   `--output-dir` outside the repo, or move the skill into `skills/sap/` and narrow the
   declaration (a bigger layout change).
7. **Vietnamese text in `domain/abap-core`.** Some reference prose from the original branch is
   still in Vietnamese. The repo rule is English; decide whether to translate it.
8. **MDG and the compact domains.** MDG, BTP, Fiori/SAPUI5, CAP and HANA are compact ports and
   were not verified as deeply as RAP and CDS. They need a domain-expert review, especially
   MDG.
9. **Integration Suite depth.** It has a router only; the skill researches official docs. It
   needs references (iFlow patterns, adapters, Groovy, API Management) if it should match the
   other domains.
10. **Unverified release levels still in content:** `INTO @DATA` at 7.40 SP08, CTEs at 7.51,
    window functions at 7.54, test doubles at 7.40 SP09. They match common knowledge but were
    not checked against the keyword documentation in this pass.
11. **RAP `environment-diff.md` method.** It compares SAP reference-scenario branches instead of
    citing the feature table. Decide whether to rewrite it to cite release documentation only.
12. **Old download links.** The README still points to `cdn.lttt.dev/sap/claude-skills@stable`
    and `@latest`. Confirm they will serve the new `sap.zip`, or remove them.

## Not done (out of scope or forbidden by the brief)

No push, PR, merge, deploy or remote write. The eval reports were not published.
`dist/`, `evals/results/` and `graphify-out/` are not committed.
