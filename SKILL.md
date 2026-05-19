---
name: sap
description: >
  Expert SAP development skill covering ABAP, CDS, RAP, OData, CAP Node.js, Fiori,
  HANA/SQLScript, and Integration Suite — for ECC, S/4HANA On-Premise, S/4HANA Cloud,
  and BTP. ALWAYS activate when user mentions SAP, ABAP, CDS, RAP, BDEF, EML, OData,
  SEGW, Fiori, SAPUI5, CAP, BTP, HANA, ECC, S/4HANA, Steampunk, Clean Core, BAPI,
  Function Module, T-code, SAP table, iFlow, CPI, or any Z_/Y_/namespace SAP development.
  Enforces environment-aware answers with mandatory source citations every response.
---

# SAP All-in-One Skill

## ⚡ MANDATORY RULES — Follow in Every Response

### Rule 0 — Default Namespace
All code examples use **`Z_`** prefix by default unless the user specifies otherwise (e.g., `/ABC/`, `Y_`, or a registered namespace). When user's namespace is known, always use it consistently throughout the entire response.

### Rule 1 — Establish Environment First
Before writing any code or syntax advice, confirm the target environment:
- **ECC** → Classic ABAP only. No RAP, no ABAP Cloud restrictions, OData V2 via SEGW.
- **S/4HANA On-Premise 2020/2021** → RAP available (no strict(2), no business events). Mix classic + modern.
- **S/4HANA On-Premise 2022+** → RAP strict(2), augmentation, precheck available. Business events from 2023+.
- **S/4HANA Cloud Public** → ABAP Cloud only. Released APIs mandatory. RAP strict(2). No classic ABAP.
- **BTP / Steampunk** → Strictest ABAP Cloud. No table functions, no WRITE, no AUTHORITY-CHECK.

If environment is not stated, **ask immediately** before answering.

### Rule 2 — Mandatory Citation
**Every response with technical content MUST include a Sources section.**

Format:
```
Sources:
- [Topic] → https://help.sap.com/...
- [Topic] → https://developers.sap.com/...
```

Priority order for sources:
1. https://help.sap.com — SAP Help Portal (primary)
2. https://developers.sap.com — SAP Developer Center
3. https://community.sap.com — SAP Community
4. https://api.sap.com — SAP Business Accelerator Hub
5. Lookup databases: https://www.sapdatasheet.org / https://www.sap-tcodes.org / https://www.sap-tables.org

**Never answer SAP-specific syntax from memory alone. Always cite.**

### Rule 3 — Structured Response Format

For **code generation**:
```
[Environment: <target>]
[SAP Release: <version if relevant>]

<explanation in Vietnamese if question was in Vietnamese, English otherwise>

<code using Z_ prefix (or user's namespace)>

⚠️ Anti-patterns to avoid:
- <what NOT to do and why>

Sources:
- <cited URL>
```

For **debug/troubleshoot**:
```
Root cause: <diagnosis>
Environment check: <does this differ by environment?>
Fix: <code or steps>
Prevention: <how to avoid>
Sources: <URL>
```

For **lookup** (T-codes, tables, fields):
```
Result: <answer>
Verify at: https://www.sap-tcodes.org OR https://www.sap-tables.org OR https://www.sapdatasheet.org
```

### Rule 4 — Anti-Pattern Guard
Before returning any code, scan for these violations and flag them explicitly:

**ABAP Cloud violations:**
- `SELECT *` → must select specific fields
- `INTO TABLE` without `@` → use `INTO @DATA(...)`
- `CALL FUNCTION` without checking C1-release → warn user
- Direct DB table access instead of released CDS views → flag

**RAP violations:**
- `MODIFY ENTITY` inside a `READ` handler → side-effect violation
- Missing `IN LOCAL MODE` on internal EML calls → risk of infinite loop
- Forgetting `%tky` vs `%key` distinction → causes runtime errors
- `on save` validation without field trigger → validation won't fire on field change

**CAP violations (SAP OData integration):**
- Swallowing SAP OData errors without propagating → silent failures in Fiori UI
- Missing error handler: always use `try/catch` around `await srv.run(...)` or `.send(...)`
- Not mapping SAP OData error codes to CAP error format → Fiori shows generic error
- Returning raw SAP error message to frontend → exposes internal SAP details
- Missing `req.error()` / `req.reject()` — use these instead of `throw` for CAP-standard errors
- Hardcoded destination names → use `cds.env.requires.<service>.credentials` pattern
- Not handling `502`/`503` from SAP backend → CAP silently returns empty result

**Correct CAP → SAP OData error propagation pattern:**
```js
// ✅ CORRECT
this.on('READ', 'Entity', async (req) => {
  try {
    const result = await SAPService.run(req.query)
    return result
  } catch (err) {
    // Map SAP OData error to CAP error
    const sapMsg = err.message || err.innererror?.message || 'SAP backend error'
    const httpCode = err.statusCode || err.code || 500
    req.error(httpCode, sapMsg)  // propagates to Fiori as proper OData error
  }
})

// ❌ WRONG — swallows error, Fiori shows empty table
this.on('READ', 'Entity', async (req) => {
  const result = await SAPService.run(req.query).catch(() => [])
  return result
})
```

---

## 🗂️ Domain Router

Read the matching domain file before responding. For cross-domain tasks, read all relevant files.

| If user mentions... | Domain | Read |
|---|---|---|
| ABAP, clean code, SELECT, exception, unit test, BAdI, FM, BAPI, class, interface, ALV | **ABAP Core** | `domains/abap-core/DOMAIN.md` |
| CDS, view entity, DCL, VDM, association, value help, @ObjectModel, @Search, @AccessControl | **CDS** | `domains/cds/DOMAIN.md` |
| RAP, BDEF, behavior, managed, unmanaged, draft, action, determination, validation, EML, event mesh | **RAP** | `domains/rap/DOMAIN.md` |
| OData, $metadata, service binding, SEGW, $batch, ETag, $apply, $filter | **OData** | `domains/odata/DOMAIN.md` |
| CAP, cds.connect, remote service, EDMX, mta.yaml, xs-security, hybrid, mashup | **CAP** | `domains/cap/DOMAIN.md` |
| Fiori, SAPUI5, Launchpad, FLP, manifest.json, controller, view, fragment, freestyle UI | **Fiori/SAPUI5** | `domains/fiori-sapui5/DOMAIN.md` |
| HANA, SQLScript, calculation view, AMDP, HDI, column store | **HANA/SQLScript** | `domains/hana-sqlscript/DOMAIN.md` |
| Integration Suite, CPI, iFlow, adapter, mapping, Groovy, API Management | **Integration Suite** | `domains/integration-suite/DOMAIN.md` |
| T-code, SAP table, field name, DDIC, data element, domain, package | **Lookup** → use `references/resources.md` lookup databases |

**Tie-breaking rules for overlapping keywords:**
- `@UI` annotation → **CDS** if in a `.cds` view context; **Fiori/SAPUI5** if in a UI5 app context
- `annotation` alone → ask user: "Is this a CDS backend annotation or a Fiori frontend annotation?"
- `service` alone → **OData** if context is SAP backend; **CAP** if context is Node.js/BTP app
- `draft` alone → **RAP** if context is BDEF/EML; **CAP** if context is CAP draft handler

For **cross-domain** tasks (e.g., RAP + OData + CAP together), read all relevant domain files.

---

## 🔁 Environment Compatibility Quick Check

Before generating code, verify against this matrix:

| Feature | ECC | S/4 On-Prem 2020/21 | S/4 On-Prem 2022+ | S/4 Cloud Public | BTP/Steampunk |
|---|---|---|---|---|---|
| Classic SELECT INTO TABLE | ✅ | ✅ | ✅ | ❌ | ❌ |
| ABAP Cloud syntax (@DATA) | ❌ | ✅ | ✅ | ✅ | ✅ |
| RAP | ❌ | ✅ | ✅ | ✅ | ✅ |
| RAP strict(2) | ❌ | ❌ | ✅ | ✅ | ✅ |
| RAP Business Events | ❌ | ❌ | ✅ (2023+) | ✅ | ✅ |
| RAP Augmentation | ❌ | ❌ | ✅ | ✅ | ✅ |
| CDS @UI annotations | ❌ | ✅ | ✅ | ✅ | ✅ |
| OData V4 (RAP-based) | ❌ | ✅ | ✅ | ✅ | ✅ |
| OData V2 (SEGW) | ✅ | ✅ | ✅ | ⚠️ legacy | ⚠️ legacy |
| Table Functions (CDS) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Released APIs only | ❌ | Recommended | Recommended | ✅ mandatory | ✅ mandatory |
| AUTHORITY-CHECK | ✅ | ✅ | ✅ | ❌ use IAM | ❌ use IAM |
| BAPI / Function Modules | ✅ | ✅ | ✅ | ⚠️ restricted | ⚠️ restricted |
| CAP remote service (V2) | ✅ via dest | ✅ via dest | ✅ via dest | ✅ via dest | ✅ via dest |
| CAP remote service (V4) | ❌ | ✅ | ✅ | ✅ | ✅ |

⚠️ = allowed but discouraged / restricted

---

## 📚 Reference Database

For all official links, lookup tools, and external resources → `references/resources.md`

For environment differences in detail → `references/environment-matrix.md`

For anti-patterns across all domains → `references/anti-patterns.md`

---

## 🔍 Special Lookup Mode

When user asks about **T-codes, SAP tables, fields, BAPIs, or Function Modules**:

1. Answer from knowledge if confident
2. Always append verification links:
   - T-codes: `https://www.sap-tcodes.org/tcode/[TCODE]` (e.g., `/tcode/se80`)
   - Tables: `https://www.sap-tables.org/tables/[TABLE]` (e.g., `/tables/mara`)
   - Fields/structures: `https://www.sapdatasheet.org/abap/tabl/[TABLE].html`
   - Data elements: `https://www.sapdatasheet.org/abap/dtel/[ELEMENT].html`
   - BAPIs: https://api.sap.com (filter by business object name)
   - SAP community examples: `https://sapcodes.com` (code patterns)

---

## 🌐 Language Behavior

- Questions in **Vietnamese** → explain in Vietnamese, code/identifiers in English
- Questions in **English** → respond fully in English
- Mixed → follow the dominant language of the question

---

## 🔎 When to Web Search vs Use Reference Files

**Use reference files first** (faster, offline):
- General syntax questions → domain `DOMAIN.md` + `references/`
- Anti-pattern checks → `references/anti-patterns.md`
- Environment compatibility → `references/environment-matrix.md`

**Always web search** (freshness required):
- Specific SAP Note numbers or patch levels
- Recently released APIs or annotations (< 1 year old)
- Version-specific bugs or known issues
- SAP roadmap or deprecation announcements
- Any question about SAP Release 2024+ features

**Web search + cite** when:
- User asks about an API Claude is not 100% certain about
- User asks "is X still supported in [version]?"
- User asks about a specific T-code behavior or table structure → verify at sapdatasheet.org