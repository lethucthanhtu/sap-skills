# CDS Domain — Router & Rules

## When to Read This File

Activate when the user mentions: `CDS`, `view entity`, `define view entity`, `define root view entity`,
`projection view`, `as projection on`, `association`, `composition`, `$parameters`,
`with parameters`, `table function`, `define hierarchy`, `abstract entity`, `custom entity`,
`virtual element`, `metadata extension`, `DDLX`, `@UI`, `@ObjectModel`, `@Search`,
`@Consumption.valueHelpDefinition`, `@AccessControl`, `DCL`, `define role`, `VDM`,
`I_*` / `C_*` / `R_*` views, `@Analytics`, `cl_cds_test_environment`.

ABAP CDS only. CAP CDS (`.cds` files in a Node.js/Java project) → `domain/cap/DOMAIN.md`.

---

## MANDATORY Rules for ALL CDS Responses

### Rule R1 — Use the Right Entity Type

```
S/4HANA 2020+ / ABAP Cloud   → define view entity (no SQL view, no @AbapCatalog.sqlViewName)
Before 7.55 / ECC 7.40-7.50  → classic DDIC-based view (define view + @AbapCatalog.sqlViewName)
                                 — obsolete now; view entities exist from 7.55 (2020), migrate when possible
Top of a RAP BO              → define root view entity (+ composition to children)
Service-specific layer       → define view entity ... as projection on ... (transactional query)
Data not from a table        → custom entity + query provider class
Action/function parameters   → abstract entity
```

### Rule R2 — VDM Layering and Naming

```
R_*  restricted reuse / BO interface layer (RAP base views, SAP naming)
I_*  interface (reusable, released views from SAP are I_*)
C_*  consumption / projection (UI or API specific)
Z… / Y… / /NAMESPACE/… for customer objects — keep the same prefix logic: ZR_, ZI_, ZC_
```

In ABAP Cloud, select only from **released** SAP views (`I_*` with C1 contract) — never from SAP
tables. Check the release state in ADT (*Properties → API State*) or the Cloudification Repository.

### Rule R3 — Access Control Is a Deliberate Decision

- Every view entity states `@AccessControl.authorizationCheck:` explicitly.
- `#CHECK` + a DCL role (`define role … grant select on … where …`) for business data.
- `#NOT_REQUIRED` only for technical/master data that is not sensitive; `#MANDATORY` when a role must exist.
- Projection views inherit with `inheriting conditions from entity`.

### Rule R4 — Keep UI Annotations Out of the Base View

Put `@UI.*` in a metadata extension (`annotate entity … with`) on the projection view, with
`@Metadata.allowExtensions: true` on the view. Base views carry only semantic annotations
(`@Semantics`, `@ObjectModel.text.element`, `@EndUserText`).

### Rule R5 — Push Logic Down, but Know the Limits

Calculations, CASE, CAST, aggregation and joins belong in CDS. Virtual elements are computed in
ABAP after the SQL read: they cannot be filtered or sorted in the database. Table functions
(AMDP) only when CDS SQL cannot express the logic.

---

## Domain File Routing

| User asks about... | Read file |
|---|---|
| Parameters, `$parameters`, defaults, GROUP BY / HAVING, analytics cube/dimension | `references/parameters-aggregation.md` |
| Table functions, AMDP implementation, hierarchies | `references/table-functions-hierarchies.md` |
| View extensions, abstract entities, custom entities / query provider | `references/entity-types-extensions.md` |
| Virtual elements, calculated fields in ABAP | `references/virtual-elements.md` |
| Metadata extensions, `@UI` layout, layers | `references/metadata-extensions.md` |
| CDS unit tests, test doubles, which release has which CDS feature | `references/cds-testing.md` |

**Cross-domain routing:**
- CDS as RAP data model (root, composition, BDEF) → also `domain/rap/DOMAIN.md`
- Service definition / binding, OData behavior → also `domain/odata/DOMAIN.md`
- UI annotations rendering in Fiori elements → also `domain/fiori-sapui5/DOMAIN.md`
- Released `I_*` views, clean core → also `domain/clean-core/DOMAIN.md`
- AMDP / SQLScript details → also `domain/hana-sqlscript/DOMAIN.md`

---

## Quick Anti-Pattern Guard

| Pattern found | Problem | Fix |
|---|---|---|
| `@AbapCatalog.sqlViewName` on 2020+ / ABAP Cloud | Obsolete DDIC-based view | `define view entity` |
| `@OData.publish: true` | Legacy SEGW-generated service, not RAP | Service definition + service binding |
| `@UI.lineItem` etc. in the base/interface view | Mixes layers, blocks extension | Metadata extension on the projection |
| No `@AccessControl.authorizationCheck` | Implicit default, unclear intent | State `#CHECK` / `#NOT_REQUIRED` explicitly |
| `#NOT_REQUIRED` on business data | Data leak through OData | DCL role + `#CHECK` |
| Selecting SAP tables (`mara`, `vbak`) in ABAP Cloud | Not released → syntax error | Released `I_*` view |
| Filtering/sorting on a virtual element | Not possible in SQL | Real CDS calculation or custom entity |
| Association path in WHERE without cardinality | Unexpected row multiplication | Declare cardinality (`[0..1]`, `of exact one to many`) |

---

## Skeleton — Root View Entity + Projection + Metadata Extension

```abap
" [Environment: S/4HANA 2022+ / BTP ABAP Environment]
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'Travel'
define root view entity ZR_Travel
  as select from ztravel
  composition [0..*] of ZR_Booking as _Booking
  association [0..1] to I_Currency  as _Currency on $projection.CurrencyCode = _Currency.Currency
{
  key travel_uuid           as TravelUUID,
      travel_id             as TravelID,
      @Semantics.amount.currencyCode: 'CurrencyCode'
      total_price           as TotalPrice,
      currency_code         as CurrencyCode,
      @Semantics.systemDateTime.localInstanceLastChangedAt: true
      local_last_changed_at as LocalLastChangedAt,
      _Booking,
      _Currency
}

@AccessControl.authorizationCheck: #CHECK
@Metadata.allowExtensions: true
define root view entity ZC_Travel
  provider contract transactional_query
  as projection on ZR_Travel
{
  key TravelUUID,
      TravelID,
      TotalPrice,
      CurrencyCode,
      LocalLastChangedAt,
      _Booking : redirected to composition child ZC_Booking
}
```

---

## Sources

| Topic | URL |
|---|---|
| ABAP CDS — view entities | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_V2_VIEWS.html |
| ABAP CDS — access control | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_ACCESS_CONTROL.html |
| CDS cheat sheet | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/15_CDS_View_Entities.md |
| Fiori elements feature showcase (annotations) | https://github.com/SAP-samples/abap-platform-fiori-feature-showcase |
| Environment matrix | `references/environment-matrix.md` (root, local) |
