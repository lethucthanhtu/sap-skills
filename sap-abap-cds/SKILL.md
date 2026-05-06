---
name: sap-abap-cds
description: >
  Expert guidance for SAP ABAP Core Data Services (CDS) development. Use this skill
  whenever the user mentions CDS views, ABAP CDS, DDL source, annotations, associations,
  access controls (DCL), CDS entities, virtual elements, parameters, aggregations,
  or anything related to defining data models in SAP ABAP using CDS syntax.
  Covers both classic ABAP CDS (on-premise S/4HANA) and ABAP Cloud CDS (BTP/Steampunk).
  Always activate for prompts like "create a CDS view", "write a CDS entity",
  "CDS association", "CDS annotation", "CDS access control", "@Semantics", "@OData.publish".
---

# SAP ABAP CDS Skill

You are an expert SAP ABAP CDS developer. Provide production-ready CDS code with
correct syntax, appropriate annotations, and best-practice patterns.

## Platform Awareness

Always clarify or infer which platform applies:
- **Classic ABAP CDS** (on-premise / S/4HANA ≤ 2023): DDIC-based, `@AbapCatalog.sqlViewName` required for older releases, full DDL/DCL support
- **ABAP Cloud CDS** (BTP Steampunk / S/4HANA Cloud): Restricted ABAP, no `@AbapCatalog.sqlViewName`, uses `define root view entity` / `define view entity`, mandatory released APIs only

If the user doesn't specify, ask. If context implies cloud (mentions BTP, tier-1/2/3, ADT for cloud), default to ABAP Cloud patterns.

---

## CDS View Types — When to Use Each

| View Type | Syntax | Use Case |
|---|---|---|
| Basic View | `define view` | Simple projection, on-premise |
| View Entity | `define view entity` | Modern on-premise (7.50+), recommended |
| Root View Entity | `define root view entity` | RAP root node |
| Projection View | `define transactional query` / `define root view entity ... as projection on` | Fiori UI layer, OData exposure |
| Abstract Entity | `define abstract entity` | Input/output parameters for actions |
| Custom Entity | `define custom entity` | BOPF / custom data sources |

---

## Code Templates

### Basic View Entity (on-premise, modern syntax)
```abap
@AbapCatalog.viewEnhancementCategory: [#NONE]
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'Description of the view'
@Metadata.ignorePropagatedAnnotations: true

define view entity Z_I_<Name>
  as select from <db_table_or_view> as _Source
  association [0..1] to I_CompanyCode as _CompanyCode
    on $projection.CompanyCode = _CompanyCode.CompanyCode
{
  key _Source.client          as Client,
  key _Source.document_number as DocumentNumber,
      _Source.company_code    as CompanyCode,
      _Source.amount          as Amount,
      @Semantics.currencyCode: true
      _Source.currency        as Currency,

      /* Associations */
      _CompanyCode
}
```

### Root View Entity for RAP
```abap
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'Travel Root View Entity'

define root view entity Z_I_Travel
  as select from ztravel as Travel
  composition [0..*] of Z_I_Booking as _Booking
  association [1..1] to I_Agency as _Agency
    on $projection.AgencyId = _Agency.AgencyId
{
  key Travel.travel_id    as TravelId,
      Travel.agency_id    as AgencyId,
      Travel.begin_date   as BeginDate,
      Travel.end_date     as EndDate,
      @Semantics.amount.currencyCode: 'CurrencyCode'
      Travel.booking_fee  as BookingFee,
      @Semantics.currencyCode: true
      Travel.currency_code as CurrencyCode,
      Travel.overall_status as OverallStatus,
      Travel.description  as Description,

      @Semantics.user.createdBy: true
      Travel.created_by   as CreatedBy,
      @Semantics.systemDate.createdAt: true
      Travel.created_at   as CreatedAt,
      @Semantics.user.lastChangedBy: true
      Travel.last_changed_by as LastChangedBy,
      @Semantics.systemDate.lastChangedAt: true
      Travel.last_changed_at as LastChangedAt,
      @Semantics.systemDate.localInstanceLastChangedAt: true
      Travel.local_last_changed_at as LocalLastChangedAt,

      _Booking,
      _Agency
}
```

### Projection (Consumption) View
```abap
@EndUserText.label: 'Travel Projection View'
@AccessControl.authorizationCheck: #NOT_REQUIRED
@Metadata.allowExtensions: true

@UI.headerInfo: {
  typeName: 'Travel',
  typeNamePlural: 'Travels',
  title.value: 'TravelId'
}

define root view entity Z_C_Travel
  provider contract transactional_query
  as projection on Z_I_Travel
{
  @UI.facet: [{
    id:       'Travel',
    purpose:  #STANDARD,
    type:     #IDENTIFICATION_REFERENCE,
    label:    'Travel',
    position: 10
  }]

  @UI.lineItem: [{ position: 10 }]
  @UI.identification: [{ position: 10 }]
  key TravelId,

  @UI.lineItem: [{ position: 20 }]
  AgencyId,

  @UI.lineItem: [{ position: 30 }]
  BeginDate,

  @UI.lineItem: [{ position: 40 }]
  EndDate,

  @UI.lineItem: [{ position: 50 }]
  BookingFee,

  CurrencyCode,
  OverallStatus,
  Description,
  CreatedBy,
  CreatedAt,
  LastChangedBy,
  LastChangedAt,
  LocalLastChangedAt,

  /* Associations */
  _Booking : redirected to composition child Z_C_Booking,
  _Agency
}
```

---

## Key Annotations Reference

Read `references/cds-annotations.md` for the full annotation catalog.
Below are the most frequently needed:

### Data Semantics
```abap
@Semantics.amount.currencyCode: 'CurrencyCode'   -- amount field, ref to currency
@Semantics.currencyCode: true                     -- marks currency code field
@Semantics.quantity.unitOfMeasure: 'Unit'         -- quantity field
@Semantics.unitOfMeasure: true                    -- marks unit field
@Semantics.user.createdBy: true
@Semantics.systemDate.createdAt: true
@Semantics.systemDate.lastChangedAt: true
@Semantics.systemDate.localInstanceLastChangedAt: true
```

### OData Exposure (on-premise)
```abap
@OData.entityType.name: 'TravelType'
@OData.publish: true   -- auto-generate OData service (older approach)
```
For modern exposure, use Service Definition + Service Binding instead.

### Search & Analytics
```abap
@Search.searchable: true
@Search.defaultSearchElement: true
@Search.fuzzinessThreshold: 0.7
@Analytics.dataCategory: #FACT
@Analytics.dataExtraction.enabled: true
```

### Access Control Reference
```abap
@AccessControl.authorizationCheck: #CHECK          -- enforce DCL
@AccessControl.authorizationCheck: #NOT_REQUIRED   -- disable (use carefully)
@AccessControl.authorizationCheck: #PRIVILEGED_ONLY
```

---

## Access Control (DCL)

```abap
@EndUserText.label: 'Access Control for Z_I_Travel'
define role Z_I_Travel {
  grant select on Z_I_Travel
    where ( CompanyCode ) = aspect pfcg_auth( F_BKPF_BUK, BUKRS, ACTVT = '03' );
}
```

For inheriting from parent:
```abap
define role Z_I_Booking {
  grant select on Z_I_Booking
    where _Travel = aspect role Z_I_Travel;
}
```

---

## Associations vs. Joins

- Use **associations** (lazy evaluation) when the target is optionally needed — they're only resolved when accessed in a query or exposed to OData.
- Use **joins** when you always need the data from the target and want it in the same projection.
- Expose associations in the field list `_AssocName` to make them navigable from consumers.

```abap
-- Association (preferred for optional data)
association [0..1] to I_BusinessPartner as _BP
  on $projection.PartnerId = _BP.BusinessPartner

-- Inner join equivalent (always resolved)
inner join I_BusinessPartner as bp
  on source.partner_id = bp.BusinessPartner
```

---

## Naming Conventions (SAP Standard / Clean Core)

| Layer | Prefix | Example |
|---|---|---|
| Interface (BO) view | `Z_I_` | `Z_I_Travel` |
| Consumption (Projection) view | `Z_C_` | `Z_C_Travel` |
| Helper / reuse view | `Z_R_` | `Z_R_TravelHelper` |
| Extension view | `Z_E_` | `Z_E_Travel` |
| Access control | same as view | `Z_I_Travel` (DCL role) |

---

## Common Errors & Fixes

### Error: "sqlViewName already exists"
- Cause: Duplicate `@AbapCatalog.sqlViewName` value across CDS views.
- Fix: Use unique SQL view names. Convention: `Z<6chars>` max 16 chars for older systems.

### Error: "Field X is ambiguous"
- Cause: Same field name in multiple joined sources.
- Fix: Use aliases — `source.field as FieldAlias`.

### Error: "Association _X cannot be used in WHERE"
- Cause: Associations are lazy; they can't filter at the current view level without a join.
- Fix: Replace association with explicit join if filtering is required.

### Error: "Authorization check failed"  
- Cause: `@AccessControl.authorizationCheck: #CHECK` but no DCL role defined.
- Fix: Create a DCL access control object, or temporarily use `#NOT_REQUIRED` for dev.

### Error: "The CDS view entity does not support ABAP SQL view"
- Cause: Using `@AbapCatalog.sqlViewName` on ABAP Cloud.
- Fix: Remove annotation — not needed/supported in ABAP Cloud environments.

---

## Version-Specific Notes

| Feature | ABAP 7.40 | ABAP 7.50+ | ABAP Cloud |
|---|---|---|---|
| `define view` | ✅ | ✅ | ⚠️ deprecated |
| `define view entity` | ❌ | ✅ | ✅ |
| `define root view entity` | ❌ | ✅ (7.56+) | ✅ |
| `@AbapCatalog.sqlViewName` | required | optional | ❌ not supported |
| `provider contract` | ❌ | ✅ (7.57+) | ✅ |
| Parameters in CDS | ✅ | ✅ | ✅ |
| Table functions | ✅ | ✅ | ❌ restricted |

---

## Output Format

When generating CDS code, always provide:
1. **Complete DDL source** — ready to paste into ADT
2. **Platform note** — clarify if on-premise vs. cloud syntax
3. **Required DB table/view** — state assumptions about underlying tables
4. **Related objects needed** — DCL role, Service Definition if applicable
5. **Key design decisions** — briefly explain associations, annotation choices

For troubleshooting, structure response as: **Root Cause → Fix → Prevention**.
