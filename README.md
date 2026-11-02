# SAP skills for Claude

> One environment-aware **SAP skill** plus three subagents and a research command, usable in
> **Claude Code** (plugin marketplace) and on **claude.ai** (skill zip + Project instructions).
>
> The skill establishes the target environment first (ECC, S/4HANA on-premise, S/4HANA Cloud
> Public Edition, BTP ABAP environment), verifies release-specific facts instead of recalling
> them, and cites its sources.

---

## Table of contents

- [What is included](#what-is-included)
- [Domains](#domains)
- [Folder structure](#folder-structure)
- [Install in Claude Code](#install-in-claude-code)
- [Install on claude.ai](#install-on-claudeai)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## What is included

| Piece | Where | What it does |
|---|---|---|
| Skill `sap` | `SKILL.md` | Router and core rules (namespace, environment, verify-don't-recall, sources, answer format, anti-pattern guard) |
| Domains | `domain/<name>/DOMAIN.md` + `references/` | Per-domain rules, routing and deep references, read on demand |
| Root references | `references/` | Research workflow, environment matrix, anti-patterns, resources |
| Agent `sap-researcher` | `agents/sap-researcher.md` | Verifies release, API and availability questions against official sources |
| Agent `abap-reviewer` | `agents/abap-reviewer.md` | Reviews ABAP / CDS / RAP code for the target environment |
| Agent `sap-architect` | `agents/sap-architect.md` | Chooses extension and integration options under clean-core rules |
| Command `/sap:research` | `commands/research.md` | Runs a sourced research answer for one SAP question |
| claude.ai instructions | `claude-ai/project-instructions.md` | Paste into a claude.ai Project (agents and commands do not exist there) |

## Domains

| Domain | Status | References |
|---|---|---|
| ABAP Core | ✅ | modern syntax, clean ABAP, ABAP SQL, exceptions, ABAP Unit, BAdIs |
| CDS | ✅ | entity types, metadata extensions, parameters/aggregation, table functions/hierarchies, virtual elements, testing |
| RAP | ✅ | managed, unmanaged, draft, actions/validations, EML, authorization, events, performance, testing, BAPI wrappers, extension, environment differences |
| OData | ✅ | `$apply`/`$batch`/delta, deep insert, draft protocol, errors/headers, ETag/actions |
| Clean Core | ✅ | ABAP Cloud rules, extension options, released classes, wrappers/migration |
| MDG | ✅ (compact) | concepts, tasks and design |
| BTP | ✅ (compact) | accounts/runtimes, connectivity/security, deploy/integration |
| Fiori / SAPUI5 | ✅ (compact) | UI annotations, deploy/launchpad, freestyle/tooling |
| CAP | ✅ (compact) | models/handlers, auth/capabilities |
| HANA / SQLScript | ✅ (compact) | SQLScript/AMDP, calculation views/performance |
| Integration Suite | ⚠️ router only | No local references yet; the skill researches official docs |

## Folder structure

```text
sap-skills/
├── SKILL.md                      # skill "sap": router + core rules
├── references/                   # cross-domain references
├── domain/
│   └── <name>/
│       ├── DOMAIN.md             # domain rules + routing
│       └── references/*.md       # deep references
├── agents/                       # Claude Code subagents
├── commands/research.md          # /sap:research
├── claude-ai/project-instructions.md
├── .claude-plugin/               # plugin.json + marketplace.json
├── evals/triggers.json           # trigger eval source → evals/triggers/*/case.yaml
├── scripts/                      # validate, build, gen-evals (Node ≥ 22, no dependencies)
└── tests/
```

---

## Install in Claude Code

```text
/plugin marketplace add lethucthanhtu/sap-skills
/plugin install sap@sap-skills
```

Or in one step (the form `claude plugin validate .` suggests):

```text
/plugin install sap --marketplace lethucthanhtu/sap-skills
```

The skill triggers automatically on SAP prompts, or explicitly with `/sap`. The agents are
available as `sap-researcher`, `abap-reviewer` and `sap-architect`; the command is
`/sap:research <question>`.

## Install on claude.ai

1. Get the zip: download a release (**[stable](https://cdn.lttt.dev/sap/claude-skills@stable)**
   / **[latest](https://cdn.lttt.dev/sap/claude-skills@latest)**), or build it yourself with
   `npm run build` → `dist/claude-ai/sap.zip`.
2. On [claude.ai](https://claude.ai), open **Customize → Skills**, click **+ → Create skill →
   Upload files**, and upload `sap.zip`.
3. Optional, recommended: create a **Project** and paste
   `claude-ai/project-instructions.md` into its instructions.

The skill activates on SAP keywords, or explicitly with `/sap`.

---

## Development

Requires Node.js 22 or later; there are no runtime dependencies.

| Command | What it does |
|---|---|
| `npm run validate` | Lints `SKILL.md`, every `DOMAIN.md` and reference (routing, orphans, dangling paths), agents, commands, manifests, links, secrets and generated eval cases; prints the token budget |
| `npm run validate:online` | Same, plus checks that external URLs respond |
| `npm test` | Unit tests for the tooling |
| `npm run format:check` | Prettier check for scripts, tests and JSON/YAML (`npm run format` to fix) |
| `npm run build` | Builds `dist/claude-ai/sap.zip` and copies the project instructions |
| `npm run evals:gen` | Regenerates `evals/triggers/*/case.yaml` from `evals/triggers.json` |
| `npm run evals:run` | Runs the trigger evals with `claude plugin eval` (uses your Claude credential) |
| `npm run check` | validate + test + format check + build (what CI runs, plus `claude plugin validate .`) |

Rules for content changes:

- Every file in `domain/<name>/references/` must be routed from its `DOMAIN.md`; every
  `DOMAIN.md` must be routed from `SKILL.md`; every root reference must be routed from
  `SKILL.md`. `npm run validate` enforces this.
- Cross-domain links use the full path (`domain/clean-core/references/released-classes.md`).
- Release-specific facts cite the ABAP keyword documentation or SAP Help for that release.
- No customer, employer-internal or system-specific data: this repository is public.

## Contributing

Issues and pull requests are welcome. Before opening a PR, run `npm run check` and add an
entry under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md).

## License

**GPL-3.0** — see [LICENSE](LICENSE). Parts of the topic outlines are adapted from MIT-licensed
projects; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
