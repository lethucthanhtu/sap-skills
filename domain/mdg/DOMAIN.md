# MDG Domain — Router & Rules

## When to Read This File

Activate when the user mentions: `MDG`, `Master Data Governance`, `change request`, `CR type`,
`rule-based workflow`, `RBWF`, `USMD`, `MDGIMG`, `BRF+` in a master-data context,
`data model BP / MM / 0G`, `reuse mode`, `flex mode`, `staging area`, `active area`,
`entity type`, `edition`, `DRF`, `DRFIMG`, `DRFOUT`, `replication model`, `key mapping`,
`value mapping`, `consolidation`, `mass processing`, `MDC`, `governance API`,
`MDG cloud edition`, `cloud-ready mode`.

---

## MANDATORY Rules for ALL MDG Responses

### Rule R1 — Establish the MDG Context Before Giving Paths

Ask, if not stated — each one changes the answer:

| Question | Why it matters |
|---|---|
| MDG on S/4HANA, MDG on ECC (MDG 9.x), or SAP MDG, cloud edition? | Data models, apps and Customizing differ; the cloud edition has no classic Customizing or ABAP enhancements |
| S/4HANA release (2022, 2023, 2025 …) and classic vs cloud-ready mode | Feature availability and Customizing structure |
| Domain: business partner, product/material, financials, custom object | Own data model and UI per domain |
| Central governance, consolidation, or mass processing | Different processes |
| Hub or co-deployed | Replication and key mapping matter only for a hub |

### Rule R2 — Names Are Search Hints, Not Facts

Transactions, BAdIs, BRF+ objects and classes in the references are starting points. Tell the
user to confirm them in the system (SE93, SE18/ADT, BRF+) or on help.sap.com for their release.
Never invent a BAdI, class or SAP Note.

### Rule R3 — Data Changes Go Through Change Requests

No direct writes to active-area tables, no "quick fix" reports outside a CR. Corrections of
existing data use consolidation or mass processing.

---

## Domain File Routing

| User asks about... | Read file |
|---|---|
| Data model, reuse/flex mode, CR, workflow, editions, validations, DRF, consolidation concepts | `references/concepts.md` |
| How to add a field, create a CR type, configure workflow or replication, programmatic CRs, design advice | `references/tasks-design.md` |

**Cross-domain routing:**
- ABAP for BAdI implementations → `domain/abap-core/DOMAIN.md`
- Fiori apps / UI adaptation for MDG → `domain/fiori-sapui5/DOMAIN.md`
- MDG cloud edition and integration on BTP → `domain/btp/DOMAIN.md`

---

## Quick Anti-Pattern Guard

| Pattern found | Problem | Fix |
|---|---|---|
| `MDGIMG` path given for MDG cloud edition | No classic Customizing there | Use the cloud edition apps and docs |
| Direct `UPDATE` on `BUT000`, `MARA` … to fix data | Bypasses governance, audit, replication | CR, consolidation or mass processing |
| One CR type with conditional logic for every scenario | Unmaintainable workflow | One CR type per business event |
| Hard-coded approver user IDs | Breaks on org changes | Rule-based agent determination + fallback agent |
| Reading active tables while a CR is open | Shows old data | Read the staging area / CR data |
| Assuming MDG on ECC behaves like MDG on S/4HANA | Different data models for BP/material | Confirm the deployment first |

---

## Sources

| Topic | URL |
|---|---|
| SAP S/4HANA product docs (search "Master Data Governance", pick your release) | https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE |
| SAP MDG, cloud edition | https://help.sap.com/docs/master-data-governance-cloud-edition |
| SAP Community | https://community.sap.com |
