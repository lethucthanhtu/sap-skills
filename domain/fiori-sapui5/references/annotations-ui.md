# Annotations That Drive Fiori Elements

Read for: which UI/Common vocabulary term produces which UI element, and how ABAP CDS and CAP annotations map to them.

---

## 2. Annotations drive Fiori elements

Put UI annotations in a **metadata extension** (ABAP: `.ddlx`, see `domain/cds/references/metadata-extensions.md`) or CAP
`annotations.cds`, not in the base view.

| Annotation (term) | Effect |
|---|---|
| `UI.HeaderInfo` | Object type name, title, description in the object page header |
| `UI.LineItem` | Table columns (use `position`/order, `importance`) |
| `UI.SelectionFields` | Filter bar fields |
| `UI.Facets` / `UI.FieldGroup` | Object page sections and field groups |
| `UI.Identification` | Header/identification fields and actions |
| `UI.DataPoint`, `UI.Chart` | KPIs, micro charts, ALP charts |
| `Common.ValueList` (`@Consumption.valueHelpDefinition` in ABAP CDS) | Value help |
| `Common.Text` + `UI.TextArrangement` | Show text next to/instead of an ID |
| `UI.Hidden`, `Core.Computed`, `Common.FieldControl` | Visibility / read-only / mandatory |
| `Common.SideEffects` | Refresh fields after a change (RAP: `side effects` in BDEF) |

ABAP CDS annotations (`@UI.lineItem: [{ position: 10 }]`) are translated into these
OData vocabulary terms. In CAP the vocabulary terms are written directly
(`annotate Books with @(UI.LineItem: [...])`).
