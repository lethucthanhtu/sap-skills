# Fiori / SAPUI5 Domain — Router & Rules

## When to Read This File

Activate when the user mentions: `Fiori`, `Fiori elements`, `List Report`, `Object Page`,
`LROP`, `ALP`, `OVP`, `worklist`, `flexible programming model`, `building block`,
`SAPUI5`, `OpenUI5`, `UI5`, `manifest.json`, `Component.js`, `XML view`, `controller`,
`fragment`, `sap.m`, `sap.ui.define`, `jQuery.sap`, `sap.ui.getCore`, `UI5 2.x`,
`ui5.yaml`, `ui5 serve`, `Fiori tools`, `Page Map`, `Business Application Studio`,
`Fiori launchpad`, `FLP`, `target mapping`, `semantic object`, `Work Zone`,
`OPA5`, `QUnit`, `wdi5`, `UI.LineItem`, `UI.Facets`, `Common.ValueList`.

---

## MANDATORY Rules for ALL Fiori / UI5 Responses

### Rule R1 — Decide the App Type First

| Need | Choose |
|---|---|
| CRUD list + detail on an OData V4 service (RAP or CAP) | Fiori elements List Report & Object Page |
| Worklist, analytical list page, overview page, form entry | Matching Fiori elements floorplan |
| Mostly standard with a few custom parts | Fiori elements + flexible programming model extensions |
| Highly custom interaction | Freestyle SAPUI5 (still Fiori design guidelines) |
| Citizen / low-code | SAP Build Apps (separate product) |

Default to Fiori elements on OData V4. Freestyle costs much more to build and maintain.

### Rule R2 — Check the UI5 Version Before Quoting APIs

UI5 deprecates steadily and UI5 2.x removes many legacy APIs. Ask for the UI5 version (or read
`manifest.json` → `sap.ui5.dependencies.minUI5Version` / `ui5.yaml`) and check the UI5 SDK
API reference and deprecation list for it.

### Rule R3 — The Back End Enforces, the UI Displays

Validations, authorizations, field control and side effects belong in RAP/CAP and reach the UI
through annotations. Never rely on UI-only checks.

---

## Domain File Routing

| User asks about... | Read file |
|---|---|
| Which annotation produces which UI element (HeaderInfo, LineItem, Facets, ValueList …) | `references/annotations-ui.md` |
| Freestyle UI5 structure, async loading, TypeScript, deprecated APIs, Fiori tools, UI5 Tooling, tests | `references/freestyle-tooling.md` |
| Deploying to ABAP / public cloud / BTP and launchpad configuration | `references/deploy-launchpad.md` |

**Cross-domain routing:**
- ABAP CDS UI annotations and metadata extensions → `domain/cds/references/metadata-extensions.md`
- RAP side effects, feature control, draft → `domain/rap/DOMAIN.md`
- CAP annotations and draft → `domain/cap/DOMAIN.md`
- OData behaviour seen by the UI (ETag, `$batch`, errors) → `domain/odata/DOMAIN.md`

---

## Quick Anti-Pattern Guard

| Pattern found | Problem | Fix |
|---|---|---|
| Freestyle app for a standard list/detail | High build and maintenance cost | Fiori elements + extensions |
| UI annotations in the base CDS view | Layer mixing | Metadata extension on the projection |
| OData V2 for a new RAP app | Missing V4 features (draft, side effects) | OData V4 unless a consumer needs V2 |
| `jQuery.sap.*`, sync loading, global names (`sap.m.Button` without import) | Deprecated, removed in UI5 2.x | `sap.ui.define` modules, async everywhere |
| `sap.ui.getCore()` in new code | Deprecated direction in UI5 2.x | Module APIs (`sap/ui/core/Element`, `sap/ui/core/Theming`, …) — check the SDK |
| Direct DOM manipulation in controllers | Breaks rendering and a11y | Bindings, formatters, controls |
| Hard-coded texts | No i18n | `i18n.properties` + `{i18n>key}` |

---

## Sources

| Topic | URL |
|---|---|
| SAPUI5 SDK (API, samples, deprecations) | https://ui5.sap.com/ |
| SAP Fiori design guidelines | https://experience.sap.com/fiori-design-web/ |
| SAP Fiori tools | https://help.sap.com/docs/SAP_FIORI_tools |
| Fiori elements feature showcase (RAP) | https://github.com/SAP-samples/abap-platform-fiori-feature-showcase |
| SAP Fiori apps reference library | https://fioriappslibrary.hana.ondemand.com/ |
