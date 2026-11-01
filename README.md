# SAP Skills

An agent skill that makes Claude (and other agents that read `SKILL.md`) give
**environment-aware** SAP development help: it asks which system you target (ECC,
S/4HANA on-premise / private cloud, S/4HANA Cloud Public Edition, BTP ABAP
Environment), checks SAP documentation instead of answering from memory, and flags
syntax or APIs that don't exist in that environment.

## What's inside

```
sap-skills/
├── SKILL.md                 # entry point: rules, routing table, compatibility matrix
├── references/
│   ├── abap-core.md         # modern ABAP, ABAP SQL, exceptions, unit tests, BAdIs, ABAP Cloud
│   ├── cds.md               # parameters, analytics, table functions, hierarchies, DDLX, test doubles
│   ├── rap.md               # unmanaged, late numbering, auth, augmentation, precheck, events, tests
│   ├── odata.md             # draft protocol, $apply, $batch, ETags, errors, headers, deep insert
│   └── resources.md         # official SAP documentation links
├── .claude-plugin/          # Claude Code plugin + marketplace manifests
├── CHANGELOG.md
└── LICENSE
```

The agent reads `SKILL.md` first and opens a reference file only when the question
touches that domain. BTP, Fiori, CAP and HANA have no reference file yet; for those
the skill relies on the documentation sources in `references/resources.md`.

## Install

### Claude Code (plugin marketplace)

```
/plugin marketplace add lethucthanhtu/sap-skills
/plugin install sap@sap-skills
```

### Any agent supported by the `skills` CLI (Claude Code, Codex, Cursor, …)

```bash
npx skills add lethucthanhtu/sap-skills
```

### Claude.ai

1. Download the skill as a ZIP:
   **[cdn.lttt.dev/sap/claude-skills@latest](https://cdn.lttt.dev/sap/claude-skills@latest)**
   (serves the `latest` branch), or GitHub → **Code** → **Download ZIP** for `main`.
2. In Claude.ai open **Customize → Skills** (or a Project), click **+** →
   **Create skill** → **Upload files**, and upload the ZIP.

To update, re-upload the newer ZIP.

## Usage

The skill activates on its own when you mention SAP topics (ABAP, CDS, RAP, OData,
S/4HANA, BTP, …). You can also call it directly with `/sap` (`/sap:sap` when installed
as a Claude Code plugin). Examples:

- "Write a managed RAP BO with draft for a travel table — target is BTP ABAP Environment."
- "Is `CALL FUNCTION 'RFC_READ_TABLE'` allowed in S/4HANA Cloud Public Edition? What's the alternative?"
- "Review this CDS view entity for missing annotations: …"
- "Why does my OData V4 PATCH return 412?"

Answers state the target environment, list anti-patterns, and cite the SAP
documentation they relied on.

## Scope and limits

- Reference content covers ABAP, CDS, RAP and OData. Other areas are answered from
  live documentation lookups only.
- Version statements in the references were last reviewed on 2026-11-01. SAP ships
  changes every release; when a reference disagrees with current SAP documentation,
  the documentation wins.
- The skill tells the agent to search the web (help.sap.com, developers.sap.com,
  SAP Community). It instructs the agent to treat fetched pages as data and not to
  put proprietary code or credentials into search queries.
- Not affiliated with or endorsed by SAP SE. SAP, ABAP, S/4HANA and Fiori are
  trademarks of SAP SE.

## Adding a reference document

1. Create `references/<topic>.md` with: applicable versions/environments, key
   concepts, code examples labelled with their target environment, limitations,
   and the SAP sources you used.
2. Add a row for it to the **Domain Routing** table in `SKILL.md` — the agent only
   opens files that are listed there.
3. Add an entry to `CHANGELOG.md`.

## Contributing

Issues and pull requests are welcome. Please:

- cite SAP Help Portal, SAP Developer Center or SAP Community for every technical
  claim, and say which release/environment it applies to;
- keep `SKILL.md` short — detail belongs in `references/`;
- keep commits small, with the `feature:` / `fix:` / `chore:` prefixes used in the history.

## License

[GPL-3.0](LICENSE)
