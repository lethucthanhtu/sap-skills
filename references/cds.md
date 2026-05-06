# ABAP CDS (Core Data Services)

Reference: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/5dde66e57f08440aab94bcfeb2e3e6f6/f7aa9f58a3d34e46bb20e2eb16cb53cf.html
ABAP Keyword Docs (CDS): https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/index.htm?file=abencds.htm

---

## CDS View Types Overview

| Type | Use Case | Annotation | Notes |
|------|----------|------------|-------|
| Basic Interface View | Raw data, no business semantics | `@VDM.viewType: #BASIC` | Reads from DB tables directly |
| Composite Interface View | Joins multiple basic views | `@VDM.viewType: #COMPOSITE` | Business-level joins |
| Consumption View | Exposed to OData/Fiori | `@VDM.viewType: #CONSUMPTION` | UI annotations here |
| Transactional View | Used by RAP business objects | — | Source for RAP |
| Extension View | Custom fields via key user extensibility | `@VDM.viewType: #EXTENSION` | S/4 Cloud only |

**For S/4HANA Cloud Public**: Only use released CDS views (C1 contract). Check via ABAP Development Tools (ADT) → Release State.

---

## Basic CDS View Structure

```cds
@AbapCatalog.viewEnhancementCategory: [#NONE]
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'Sales Order Header'
@Metadata.ignorePropagatedAnnotations: true
@VDM.viewType: #BASIC

define view entity ZI_SalesOrderHeader
  as select from vbak
  association [0..1] to ZI_SalesOrgText as _SalesOrg
    on $projection.SalesOrganization = _SalesOrg.SalesOrganization
{
  key vbeln                    as SalesOrder,
      erdat                    as CreationDate,
      erzet                    as CreationTime,
      vkorg                    as SalesOrganization,
      netwr                    as NetValue,
      waerk                    as DocumentCurrency,

      /* Associations */
      _SalesOrg
}
```

---

## VDM (Virtual Data Model) Layers

```
DB Tables (vbak, vbap...)
       ↓
Basic Interface Views (ZI_*)       ← Direct table read, element semantics
       ↓
Composite Interface Views (ZI_*)   ← Business-level joins
       ↓
Consumption Views (ZC_*)           ← UI/OData annotations, for Fiori
```

Always follow this layering. Do NOT put `@UI` annotations on interface views.

---

## Key Annotations

### Access Control
```cds
@AccessControl.authorizationCheck: #CHECK          " enforce DCL (recommended)
@AccessControl.authorizationCheck: #NOT_REQUIRED   " dev/test only
```

Always pair with a DCL (Data Control Language) object:
```cds
@MappingRole: true
define role ZI_SalesOrderHeader {
  grant select on ZI_SalesOrderHeader
    where ( SalesOrganization ) = aspect pfcg_auth( V_VBKA_VKO, VKORG, ACTVT = '03' );
}
```

### OData Exposure
```cds
@OData.publish: true   " V2 auto-publish (deprecated approach)
" Prefer: expose via Service Definition + Service Binding (ODATA V4)
```

### Search & Filter (Consumption Layer)
```cds
@Search.searchable: true
@Search.defaultSearchElement: true

@Consumption.filter.selectionType: #RANGE
@Consumption.filter.mandatory: false
```

### UI Annotations (Consumption Views only)
```cds
@UI.lineItem: [{ position: 10, label: 'Sales Order' }]
@UI.selectionField: [{ position: 10 }]
@UI.identification: [{ position: 10 }]
@UI.headerInfo.typeName: 'Sales Order'
@UI.headerInfo.typeNamePlural: 'Sales Orders'
@UI.headerInfo.title.value: 'SalesOrder'
```

---

## Associations vs. Joins

```cds
" Association — lazy, only joins if navigated/used in projection
association [0..1] to ZI_CustomerText as _Customer
  on $projection.SoldToParty = _Customer.Customer

" Join — always executed
left outer join ZI_CustomerText as cust
  on vbak.kunnr = cust.Customer

" Rule: prefer associations for optional/navigation data
" Use joins only when field is always needed in output
```

---

## Parameters in CDS

```cds
define view entity ZI_SalesOrderByDate
  with parameters
    P_FromDate : dats,
    P_ToDate   : dats
  as select from vbak
  where erdat between $parameters.P_FromDate and $parameters.P_ToDate
{ ... }
```

Calling with parameters from ABAP:
```abap
SELECT * FROM zi_salesorderbydate( p_fromdate = '20240101', p_todate = '20241231' )
  INTO TABLE @DATA(lt_result).
```

---

## CDS Table Functions (AMDP-backed)

Use when complex logic can't be expressed in CDS syntax:
```cds
define table function ZTF_ComplexCalc
  with parameters
    @Environment.systemField: #CLIENT
    P_Client : abap.clnt
  returns {
    key SalesOrder : vbeln;
        NetValue   : netwr;
  }
  implemented by method zcl_tf_sales_calc=>get_data;
```

---

## Extension (Custom Fields) — S/4HANA

For key user extensions in S/4HANA Cloud:
- Use **Custom Fields and Logic** app (no-code) for simple fields
- For developer extensions: `extend view entity` syntax
```cds
extend view entity I_SalesOrderItem with
{
  _SalesOrderItem.YY1_CustomField_SLI as CustomField
}
```

---

## Common Mistakes to Avoid

1. **Direct table access in Cloud**: Never `select from vbak` in ABAP Cloud — use released CDS views (`I_SalesOrder`)
2. **UI annotations on Interface views**: Only on Consumption views
3. **Missing DCL**: Always create authorization object when `#CHECK`
4. **Cartesian join**: Incomplete ON condition causes full cross join
5. **$projection vs source alias**: Use `$projection` for self-referencing in ON conditions
