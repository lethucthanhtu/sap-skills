---
name: sap
description: >
  Expert SAP development skill covering CDS, RAP, OData, ABAP Core, BTP, Fiori, CAP, and HANA.
  Use this skill for ANY SAP-related task: writing ABAP/CDS/RAP code from scratch, debugging errors,
  understanding SAP Help documentation, reviewing code for best practices, designing solutions and
  architecture, or identifying deprecated APIs. Always activate when the user mentions SAP, ABAP,
  CDS views, RAP, OData, BTP, Fiori, CAP, HANA, S/4HANA, ECC, Steampunk, Clean Core, BDEF,
  behavior implementation, CDS annotations, or any SAP-specific technology. This skill enforces
  environment-aware, verified, up-to-date SAP guidance — never guesses from outdated memory.
---

# SAP Development Skill

## Core Behavior Rules (ALWAYS follow these)

### Rule 1 — Establish Environment First
Before writing any code or giving syntax advice, know the target environment.
If not stated, ask immediately:
- **ABAP Cloud / Steampunk** → S/4HANA Cloud Public Edition or BTP ABAP Environment (strictest Clean Core)
- **S/4HANA Cloud Private Edition** → ABAP Cloud with some classic ABAP allowed in certain extensibility scenarios
- **S/4HANA On-Premise** → Mix of classic + ABAP Cloud depending on release (ask for release version: 2020, 2021, 2022, 2023, 2024)
- **ECC** → Classic ABAP, no RAP, no ABAP Cloud restrictions

Environment determines: allowed syntax, available APIs, CDS annotation support, OData version, RAP availability.

### Rule 2 — Web Search Before Answering
For ANY of the following, **always search SAP documentation before responding**:
- CDS annotations (`@UI`, `@Search`, `@OData`, `@ObjectModel`, `@AccessControl`, etc.)
- RAP BDEF keywords, behavior implementation methods
- Released ABAP APIs (especially `CL_*`, `IF_*` classes)
- OData service binding types and versions
- BTP service APIs, CAP CDS syntax

Search priority order:
1. `https://help.sap.com` — SAP Help Portal (official reference)
2. `https://developers.sap.com` — SAP Developer Center (tutorials, mission guides)
3. `https://community.sap.com` — SAP Community (real-world patterns, confirmed workarounds)
4. `https://api.sap.com` — SAP Business Accelerator Hub (API specs)

**Never answer SAP-specific syntax from memory alone. Always verify and cite the source.**

### Rule 3 — Environment-Aware Code Generation
When generating code, always:
- Label which environment the code targets at the top
- Flag any syntax that differs between environments
- Call out deprecated statements explicitly (see `references/abap-core.md` for full list)

### Rule 4 — Structured Response Format
For code generation tasks, always respond with:
```
[Environment: <target>]
[SAP Release: <version if relevant>]

<explanation of approach>

<code>

Anti-patterns to avoid:
- <what NOT to do and why>

Sources:
- <cited SAP documentation URL>
```

For debug/review tasks:
```
Root cause: <concise diagnosis>
Environment check: <does this error differ by environment?>
Fix: <code>
Prevention: <how to avoid this in the future>
Sources: <cited URL>
```

---

## Domain Routing

When the user's request involves one of the following domains, read the corresponding reference file before responding:

| Domain | Triggers | Reference File |
|--------|----------|----------------|
| **CDS** | CDS views, annotations, DCL, VDM, value help, search | `references/cds.md` |
| **RAP** | BDEF, behavior implementation, managed/unmanaged, BO, actions, determinations | `references/rap.md` |
| **OData** | OData V2/V4, service definition, service binding, EDMX | `references/odata.md` |
| **ABAP Core** | ABAP syntax, clean core, deprecated statements, classes, interfaces, ALV, SELECT | `references/abap-core.md` |
| **BTP** | BTP services, Cloud Foundry, Kyma, destinations, connectivity | `references/btp.md` *(coming soon)* |
| **Fiori** | Fiori Elements, SAPUI5, Launchpad, page types | `references/fiori.md` *(coming soon)* |
| **CAP** | CAP Node.js/Java, CDS-CAP, service handlers, multitenancy | `references/cap.md` *(coming soon)* |
| **HANA** | HANA Cloud, SQLScript, calculation views, HDI | `references/hana.md` *(coming soon)* |

For cross-domain tasks (e.g., RAP + CDS + OData together), read all relevant reference files.

For a full list of external SAP documentation sources, always check `references/resources.md`.

---

## Quick Environment Compatibility Matrix

Use this to immediately catch environment mismatches before generating code:

| Feature | ECC | S/4HANA On-Prem | S/4HANA Cloud | BTP ABAP Env |
|---------|-----|-----------------|---------------|--------------|
| Classic SELECT INTO TABLE | ✅ | ✅ | ❌ | ❌ |
| ABAP Cloud syntax (INTO @DATA) | ❌ | ✅ (≥2020) | ✅ | ✅ |
| RAP | ❌ | ✅ (≥1909) | ✅ | ✅ |
| CDS with @UI annotations | ❌ | ✅ | ✅ | ✅ |
| OData V4 | ❌ | ✅ (≥2020) | ✅ | ✅ |
| Released APIs only (Tier 1) | ❌ | Recommended | ✅ mandatory | ✅ mandatory |
| BOPF (classic BO) | ✅ | ✅ | ❌ | ❌ |
| Function Modules (classic) | ✅ | ✅ | ⚠️ restricted | ⚠️ restricted |

⚠️ = allowed but discouraged / restricted in ABAP Cloud context

---

## Common Anti-Patterns (Catch These Immediately)

These are the most frequent mistakes Claude must catch and correct:

### ABAP Cloud / Clean Core violations
- `SELECT * FROM <table>` → must select specific fields
- `INTO TABLE` without `@` → use `INTO @DATA(lt_result)`
- Direct DB table access instead of released CDS views
- Usage of unreleased Function Modules
- `CALL FUNCTION` without checking C1-release status
- `MODIFY <dbtable>` directly instead of through RAP/EML

### CDS Annotation mistakes
- Missing `@AbapCatalog.sqlViewName` on older ABAP systems (not needed in ABAP Cloud)
- `@UI.lineItem` without `position` → items render in undefined order
- Using `@OData.publish: true` (deprecated shortcut) instead of explicit Service Definition + Service Binding
- Missing `@AccessControl.authorizationCheck: #NOT_REQUIRED` when no DCL file exists (causes implicit check failure)

### RAP mistakes
- Using `MODIFY ENTITY` in a `READ` handler (side-effect violation)
- Missing `MAPPED`, `FAILED`, `REPORTED` parameters in all handler methods
- Forgetting `preliminary` on draft-enabled BOs
- Using classic BOPF patterns in new RAP development

---

## Skill Maintenance Note

When SAP releases new versions or annotations are updated, the reference files in `references/` should be updated. Always cross-check with:
- SAP Help Portal: https://help.sap.com
- SAP Release Notes: https://help.sap.com/whats-new
- ABAP Platform What's New: https://help.sap.com/doc/abapdocu/latest/en-US/index.htm
