# CDS (Core Data Services) Reference

> Before answering CDS questions, search SAP Help Portal for the specific annotation or feature.
> Annotations change between releases. Always verify and cite.
> Search: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/630ce9b386b84e80bfade96779fbaeec.html

---

## Table of Contents
1. [CDS View Types by Environment](#1-cds-view-types-by-environment)
2. [Basic CDS View Structure](#2-basic-cds-view-structure)
3. [@AbapCatalog Annotations](#3-abapcatalog-annotations)
4. [@UI Annotations](#4-ui-annotations)
5. [@Search Annotations](#5-search-annotations)
6. [@OData Annotations](#6-odata-annotations)
7. [@ObjectModel Annotations](#7-objectmodel-annotations)
8. [@AccessControl / DCL](#8-accesscontrol--dcl)
9. [Value Help (SearchHelp)](#9-value-help-searchhelp)
10. [VDM Layers (R/I/C)](#10-vdm-layers-ric)
11. [Common Anti-Patterns](#11-common-anti-patterns)
12. [Environment Differences](#12-environment-differences)

---

## 1. CDS View Types by Environment

| View Type | Syntax Keyword | Available In | Notes |
|-----------|---------------|--------------|-------|
| CDS View (V1) | `define view` | ECC, S/4HANA all | Older style, needs `@AbapCatalog.sqlViewName` |
| CDS View Entity (V2) | `define view entity` | ABAP Cloud, S/4HANA ≥2020 | Preferred in ABAP Cloud, no sqlViewName needed |
| CDS Table Function | `define table function` | S/4HANA, ABAP Cloud | For complex logic needing AMDP |
| CDS Hierarchy | `define hierarchy` | S/4HANA ≥2022, ABAP Cloud | For recursive/parent-child structures |
| Abstract Entity | `define abstract entity` | ABAP Cloud | For RAP action parameters/results |
| Custom Entity | `define custom entity` | ABAP Cloud | For data from external sources via AMDP |

**Rule**: In ABAP Cloud / BTP, always use `define view entity`. Never use the old `define view` with `@AbapCatalog.sqlViewName`.

---

## 2. Basic CDS View Structure

### CDS View Entity (ABAP Cloud / S/4HANA ≥2020) — Preferred
```abap
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'My View Description'
define view entity ZI_MyEntity
  as select from zmy_dbtable as MyAlias
  association [0..1] to ZI_OtherEntity as _Other
    on $projection.OtherKey = _Other.Key
{
      -- Key field
  key MyAlias.client,
  key MyAlias.my_key        as MyKey,

      -- Other fields
      MyAlias.some_field    as SomeField,

      -- Association (always expose)
      _Other
}
```

### CDS View (V1) — ECC / older S/4HANA only
```abap
@AbapCatalog.sqlViewName: 'ZV_MYVIEW'
@AbapCatalog.compiler.compareFilter: true
@AbapCatalog.preserveKey: true
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'My View Description'
define view ZI_MyEntity
  as select from zmy_dbtable as MyAlias
{
  key MyAlias.client,
  key MyAlias.my_key as MyKey,
      MyAlias.some_field as SomeField
}
```

---

## 3. @AbapCatalog Annotations

| Annotation | Values | Notes |
|-----------|--------|-------|
| `@AbapCatalog.sqlViewName` | `'ZVIEWNAME'` (max 16 chars) | **V1 only** — not used in View Entity |
| `@AbapCatalog.compiler.compareFilter` | `true` / `false` | V1 only |
| `@AbapCatalog.preserveKey` | `true` / `false` | V1 only |
| `@AbapCatalog.viewEnhancementCategory` | `[#NONE]`, `[#PROJECTION_LIST]` | For extensibility |

---

## 4. @UI Annotations

> Always verify current annotations at: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/b3b02cf03c894498b1f01a303ec81e0e.html

### Line Item (List Report table columns)
```abap
@UI.lineItem: [{ position: 10, importance: #HIGH, label: 'My Field' }]
SomeField,
```
- `position`: determines column order — **always set this**, otherwise order is undefined
- `importance`: `#HIGH` (always shown), `#MEDIUM`, `#LOW` (collapsed on mobile)
- `label`: overrides the field label in the list

### Header Info (Object Page title/subtitle)
```abap
@UI.headerInfo: {
  typeName: 'Order',
  typeNamePlural: 'Orders',
  title: { type: #STANDARD, value: 'OrderId' },
  description: { type: #STANDARD, value: 'Description' }
}
```
Place this annotation at the **view entity level**, not on individual fields.

### Facets (Object Page sections)
```abap
@UI.facet: [
  {
    id: 'GeneralData',
    purpose: #STANDARD,
    type: #COLLECTION,
    label: 'General Data',
    position: 10
  },
  {
    id: 'GeneralDataFields',
    purpose: #STANDARD,
    type: #FIELDGROUP_REFERENCE,
    label: 'General Data',
    targetQualifier: 'GeneralData',
    parentId: 'GeneralData',
    position: 10
  }
]
```

### Field Group (Object Page form fields)
```abap
@UI.fieldGroup: [{ qualifier: 'GeneralData', position: 10 }]
SomeField,
```

### Selection Field (Filter bar in List Report)
```abap
@UI.selectionField: [{ position: 10 }]
SomeField,
```

### Identification (Action button area on Object Page)
```abap
@UI.identification: [{ position: 10 }]
SomeField,
```

### Hidden / Read-Only
```abap
@UI.hidden: true
@UI.fieldControl: { path: '_FieldControlField', qualifier: 'SomeField' }
```

---

## 5. @Search Annotations

> Verify at: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/f38a7477f7b2421fad05002d5b98e5a3.html

### Enable Search on a View
```abap
@Search.searchable: true
define view entity ZI_MyEntity ...
```

### Mark Fields as Searchable / Default Search
```abap
@Search.defaultSearchElement: true
@Search.fuzzinessThreshold: 0.8
SomeTextField,

@Search.ranking: #HIGH
KeyField,
```

| Annotation | Values | Notes |
|-----------|--------|-------|
| `@Search.searchable` | `true` | On view level — enables full-text search |
| `@Search.defaultSearchElement` | `true` | Field included in default search |
| `@Search.fuzzinessThreshold` | `0.0` – `1.0` | Fuzzy matching tolerance |
| `@Search.ranking` | `#HIGH`, `#MEDIUM`, `#LOW` | Relevance ranking |

---

## 6. @OData Annotations

> **Important**: `@OData.publish: true` is **deprecated**. Always use explicit Service Definition + Service Binding.

### Current correct approach (ABAP Cloud / S/4HANA ≥2020)
```abap
-- On the view: just mark it as part of a service (done in Service Definition, not here)
-- No @OData.publish: true needed
```

Service Definition (separate object):
```abap
@EndUserText.label: 'My Service Definition'
define service ZUI_MyService {
  expose ZC_MyEntity as MyEntity;
  expose ZI_OtherEntity as OtherEntity;
}
```

### @OData on field level (still valid)
```abap
@OData.Type: 'Edm.String'
@OData.MaxLength: 40
SomeField,
```

---

## 7. @ObjectModel Annotations

> Verify at: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/45f1db921be04abb89dad8ab9ca6c3de.html

### Usage Type (VDM classification)
```abap
@ObjectModel.usageType: {
  serviceQuality: #A,
  sizeCategory: #S,
  dataClass: #MASTER
}
```

### Foreign Key / Text Association
```abap
@ObjectModel.text.association: '_Text'
StatusCode,

@ObjectModel.foreignKey.association: '_Status'
StatusCode,
```

### Readable / Updatable (RAP integration)
```abap
@ObjectModel.createEnabled: true
@ObjectModel.updateEnabled: true
@ObjectModel.deleteEnabled: true
```

---

## 8. @AccessControl / DCL

> Verify at: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/4f826dad6c034ff0b7dfc82cc79ad5f9.html

### On the view
```abap
-- Enforce authorization check (default in ABAP Cloud)
@AccessControl.authorizationCheck: #CHECK

-- Explicitly disable (use carefully, document why)
@AccessControl.authorizationCheck: #NOT_REQUIRED

-- Not classified (avoid — causes warning in ABAP Cloud)
@AccessControl.authorizationCheck: #NOT_ALLOWED
```

**Rule**: If no DCL file exists for a view with `#CHECK`, **access is denied by default** in ABAP Cloud. Either create a DCL or set `#NOT_REQUIRED`.

### DCL File (Access Control)
```abap
@MappingRole: true
define role ZI_MyEntity {
  grant select on ZI_MyEntity
    where (Client) = aspect pfcg_auth(ZMY_AUTH_OBJ, ACTVT, '03');
}
```

---

## 9. Value Help (SearchHelp)

### Annotating a field to use a value help view
```abap
@Consumption.valueHelpDefinition: [{
  entity: {
    name: 'ZI_StatusValueHelp',
    element: 'StatusCode'
  }
}]
StatusCode,
```

### Defining a value help view
```abap
@Search.searchable: true
@ObjectModel.resultSet.sizeCategory: #XS
define view entity ZI_StatusValueHelp
  as select from zstatus_table
{
  key status_code   as StatusCode,
      @Search.defaultSearchElement: true
      status_text   as StatusText
}
```

---

## 10. VDM Layers (R/I/C)

SAP Virtual Data Model naming convention:

| Prefix | Layer | Purpose |
|--------|-------|---------|
| `ZR_` / `I_` | **R** — Raw / Basic Interface View | Direct table access, no business logic |
| `ZI_` / `I_` | **I** — Interface/Composite View | Joins, enrichment, associations |
| `ZC_` / `C_` | **C** — Consumption View | Optimized for one specific Fiori app / OData service |

**Rule**: Never expose `R_` (Raw) views directly in a service. Always go through `C_` (Consumption) views.

Example naming:
```
ZR_SalesOrder        ← selects from VBAK directly
ZI_SalesOrder        ← joins VBAK + VBAP + texts, builds associations
ZC_SalesOrderTP      ← consumption view for the Fiori transactional app
```

---

## 11. Common Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|-------------|---------|-----------------|
| `@OData.publish: true` | Deprecated shortcut | Use Service Definition + Service Binding |
| Missing `position` on `@UI.lineItem` | Columns render in undefined order | Always set `position: 10/20/30...` |
| `@AbapCatalog.sqlViewName` in View Entity | Not applicable, causes warning | Only use for V1 `define view` |
| No `@AccessControl` annotation | Implicit check — may deny all access in ABAP Cloud | Explicitly set `#CHECK` or `#NOT_REQUIRED` |
| Exposing `R_` view directly in service | Violates VDM layering, fragile | Always expose through `C_` consumption view |
| Hardcoding client in WHERE | Not client-safe | Use `$session.client` or rely on implicit client handling |
| `association [1..1]` when data may be missing | Runtime error if join fails | Use `[0..1]` unless guaranteed |
| Missing `_AssocName` exposure at end of field list | Association not accessible in OData | Always expose all associations at the bottom |

---

## 12. Environment Differences

| Feature | ECC (V1 only) | S/4HANA On-Prem ≥2020 | S/4HANA Cloud / BTP |
|---------|--------------|----------------------|---------------------|
| `define view entity` | ❌ | ✅ | ✅ (preferred) |
| `@AbapCatalog.sqlViewName` | ✅ required | ✅ for V1 / ❌ for V2 | ❌ not used |
| `@OData.publish: true` | ✅ (old way) | ⚠️ deprecated | ❌ not supported |
| DCL / Access Control | Limited | ✅ | ✅ mandatory |
| `@Search.searchable` | ⚠️ limited | ✅ | ✅ |
| CDS Table Function (AMDP) | ❌ | ✅ | ✅ |
| CDS Hierarchy | ❌ | ✅ ≥2022 | ✅ |
| Abstract Entity | ❌ | ✅ ≥2022 | ✅ |

---

## Official Docs — Always Cite These

- CDS Annotations full reference: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/630ce9b386b84e80bfade96779fbaeec.html
- @UI Annotations: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/b3b02cf03c894498b1f01a303ec81e0e.html
- CDS View Entity syntax: https://help.sap.com/doc/abapdocu/latest/en-US/index.htm?file=abencds_v2_view.htm
- DCL: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/4f826dad6c034ff0b7dfc82cc79ad5f9.html
- VDM Guide: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/8a8cee943ef944fe8936f4a60d28e86e.html
