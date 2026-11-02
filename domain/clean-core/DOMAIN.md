# Clean Core & ABAP Cloud Domain — Router & Rules

## When to Read This File

Activate when the user mentions: `clean core`, `ABAP Cloud`, `ABAP for Cloud Development`,
`language version`, `released API`, `release contract`, `C0`, `C1`, `C2`, `C3`, `C4`,
`API state`, `Cloudification Repository`, `successor`, `wrapper`, `tier 1/2/3`,
`clean core level A/B/C/D`, `key user extensibility`, `developer extensibility`,
`side-by-side`, `embedded Steampunk`, `Custom Fields`, `Custom Logic`, `cloud BAdI`,
`ATC`, `ABAP_CLOUD_READINESS`, `custom code migration`, `SCMON`, `SUSG`, `released class`,
`XCO`, `cl_abap_context_info`, `cl_system_uuid`, `cl_bali_log`.

---

## MANDATORY Rules for ALL Clean Core Responses

### Rule R1 — Know Which Extension Styles the Edition Allows

```
S/4HANA Cloud Public Edition → key user + developer (ABAP Cloud) + side-by-side. No classic ABAP, no wrappers.
BTP ABAP Environment         → ABAP Cloud only. No classic ABAP, no wrappers.
S/4HANA Private / On-Prem    → all styles; ABAP Cloud language version from 2022;
                               Tier-2 / level-B wrappers allowed
ECC                          → classic ABAP + side-by-side via remote APIs
```

Order of preference: configuration → key user → developer on-stack (ABAP Cloud) →
side-by-side → classic. State why a lower option was ruled out.

### Rule R2 — "Released" Means a Specific Contract

Check the object's API state before calling it released: C1 (use system-internally) is what
ABAP Cloud code needs; C2 is remote use; C0 is extension points; C3 configuration content;
C4 AMDP reuse. Sources of truth: ADT *Properties → API State*, the Cloudification
Repository (`github.com/SAP/abap-atc-cr-cv-s4hc`), or the ABAP MCP tools
`sap_search_objects` / `sap_get_object_details`. Never guess.

### Rule R3 — Common Myths (verified against the ABAP Cloud keyword docs)

- `AUTHORITY-CHECK OBJECT` **is** available in ABAP Cloud (own or released auth objects; RAP
  authorization handlers are implemented with it).
- CDS table functions / AMDP **are** available (only released or own objects in `USING`).
- Not available: `WRITE`/lists, dynpros, `SUBMIT`, `CALL TRANSACTION`, unreleased SAP tables
  and APIs, native SQL, `COMMIT WORK` inside RAP (use `COMMIT ENTITIES` outside RAP handlers).

### Rule R4 — Two Vocabularies

The older 3-tier model and the clean core levels A–D (ABAP Extensibility Guide) are both in
use. Ask which one the team uses; map between them with `references/abap-cloud-rules.md`.

---

## Domain File Routing

| User asks about... | Read file |
|---|---|
| Which extension style, on-stack vs side-by-side, extending standard fields/logic/BOs | `references/extension-options.md` |
| ABAP Cloud allowed/forbidden, release contracts, 3-tier vs levels A–D | `references/abap-cloud-rules.md` |
| Wrapping an unreleased BAPI/FM, ATC cloud readiness, custom-code migration | `references/wrappers-migration.md` |
| Which released class to use (UUID, time, logs, JSON, HTTP, jobs, numbers) | `references/released-classes.md` |

**Cross-domain routing:**
- ABAP syntax in ABAP Cloud → `domain/abap-core/DOMAIN.md`
- Behavior extensions of SAP RAP BOs → `domain/rap/references/standard-bo-extension.md`
- Side-by-side on BTP → `domain/btp/DOMAIN.md` and `domain/cap/DOMAIN.md`
- Feature availability per release → `references/environment-matrix.md` (root)

---

## Quick Anti-Pattern Guard

| Pattern found | Problem | Fix |
|---|---|---|
| Classic BAdI, user exit or modification proposed for public cloud | Not possible there | Cloud BAdI (Custom Logic) or side-by-side |
| "Create a wrapper" for public cloud / BTP ABAP Env | No classic ABAP there | Released successor or side-by-side |
| Object called "released" without checking the contract | C2 ≠ C1, unreleased → syntax error | Check API state |
| 1:1 wrapper around a whole BAPI | New technical debt | Minimal interface with own types |
| `Z` copy of an SAP standard program | Upgrade and support risk | Extend through released extension points |
| `SELECT` from SAP tables in ABAP Cloud | Not released | Released `I_*` CDS view |

---

## Sources

| Topic | URL |
|---|---|
| ABAP Cloud overview | https://help.sap.com/docs/abap-cloud/abap-cloud/what-is-abap-cloud |
| ABAP versions and released APIs | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/ABENABAP_VERSIONS_AND_APIS.html |
| Release contracts C0–C4 | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/ABENRELEASE_CONTRACT_GLOSRY.html |
| `AUTHORITY-CHECK` in ABAP Cloud | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/ABAPAUTHORITY-CHECK.html |
| CDS table functions in ABAP Cloud | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/ABENCDS_TABLE_FUNCTIONS.html |
| Cloudification Repository | https://github.com/SAP/abap-atc-cr-cv-s4hc |
| Released ABAP classes (cheat sheet) | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/22_Released_ABAP_Classes.md |
