# CDS Annotations Reference

Complete catalog of commonly used CDS annotations for SAP ABAP development.

## Table of Contents
1. [AbapCatalog](#abapcatalog)
2. [AccessControl](#accesscontrol)
3. [Analytics](#analytics)
4. [Consumption](#consumption)
5. [EndUserText](#endusertext)
6. [Metadata](#metadata)
7. [ObjectModel](#objectmodel)
8. [OData](#odata)
9. [Search](#search)
10. [Semantics](#semantics)
11. [UI](#ui)
12. [VDM](#vdm)

---

## AbapCatalog

```abap
@AbapCatalog.sqlViewName: 'ZSQLVIEWNAME'        -- required for on-premise < 7.56
@AbapCatalog.compiler.compareFilter: true
@AbapCatalog.preserveKey: true
@AbapCatalog.viewEnhancementCategory: [#NONE]   -- or #PROJECTION_LIST, #UNION
@AbapCatalog.buffering.status: #ACTIVE          -- table buffering
@AbapCatalog.buffering.type: #FULL              -- #FULL, #SINGLE, #GENERIC
```

---

## AccessControl

```abap
@AccessControl.authorizationCheck: #CHECK            -- enforce DCL (default)
@AccessControl.authorizationCheck: #NOT_REQUIRED     -- no auth check
@AccessControl.authorizationCheck: #PRIVILEGED_ONLY  -- only privileged access
@AccessControl.personalData.isPotentiallySensitive: true
```

---

## Analytics

```abap
@Analytics.dataCategory: #FACT        -- fact table (measures)
@Analytics.dataCategory: #DIMENSION   -- dimension table
@Analytics.dataCategory: #TEXT        -- text table
@Analytics.dataCategory: #HIERARCHY   -- hierarchy

@Analytics.dataExtraction.enabled: true
@Analytics.dataExtraction.delta.byElement.name: 'LastChangedAt'
@Analytics.dataExtraction.delta.byElement.maxDelayInSeconds: 3600

@Analytics.internalName: #LOCAL
@Analytics.technicalName: 'Z_CUBE_NAME'
```

---

## Consumption

```abap
@Consumption.valueHelpDefinition: [{
  entity: {
    name: 'I_Currency',
    element: 'Currency'
  }
}]

@Consumption.filter.selectionType: #SINGLE    -- #SINGLE, #MULTIPLE, #INTERVAL
@Consumption.filter.mandatory: true
@Consumption.hidden: true                     -- hide from UI consumption
@Consumption.dbHints: 'NO_MERGE'
```

---

## EndUserText

```abap
@EndUserText.label: 'Field Label'          -- max 60 chars, shown in UI
@EndUserText.quickInfo: 'Tooltip text'     -- shown as tooltip
@EndUserText.heading: 'Col'               -- short column header
```

---

## Metadata

```abap
@Metadata.allowExtensions: true            -- allow MDE extensions
@Metadata.ignorePropagatedAnnotations: true
@Metadata.layer: #CORE                     -- #CORE, #LOCALIZATION, #INDUSTRY, #CUSTOMER, #PARTNER
```

For Metadata Extensions (separate `.ddlx` file):
```abap
@Metadata.layer: #CUSTOMER
annotate view Z_C_Travel with {
  @UI.lineItem: [{ position: 5, label: 'ID' }]
  TravelId;
}
```

---

## ObjectModel

```abap
@ObjectModel.usageType: {
  serviceQuality: #A,             -- #A (real-time), #B (near real-time), #C (batch)
  sizeCategory: #S,               -- #S, #M, #L, #XL
  dataClass: #MASTER              -- #MASTER, #TRANSACTIONAL, #CUSTOMIZING, #ORGANIZATIONAL
}

@ObjectModel.representativeKey: 'TravelId'
@ObjectModel.compositionRoot: true
@ObjectModel.transactionalProcessingEnabled: true
@ObjectModel.writeActivePersistence: 'ZTRAVEL'
@ObjectModel.createEnabled: true
@ObjectModel.deleteEnabled: true
@ObjectModel.updateEnabled: true

-- Entity buffer (ETag / optimistic lock)
@ObjectModel.entityChangeStateIdentifier: 'LocalLastChangedAt'

-- Text association
@ObjectModel.dataPoint.valueQualifier: 'Amount'
```

---

## OData

```abap
-- Classic (on-premise, SEGW-based)
@OData.publish: true
@OData.entityType.name: 'TravelType'
@OData.entitySet.name: 'TravelSet'

-- V4 (modern, via Service Binding)
-- Prefer Service Definition + Service Binding approach instead
```

---

## Search

```abap
@Search.searchable: true                          -- make entity searchable
@Search.defaultSearchElement: true               -- include in default search
@Search.fuzzinessThreshold: 0.7                  -- 0.0 - 1.0
@Search.ranking: #HIGH                           -- #HIGH, #MEDIUM, #LOW
@Search.highlighted.enabled: true
```

---

## Semantics

### Administrative fields
```abap
@Semantics.user.createdBy: true
@Semantics.user.createdAt: true
@Semantics.user.lastChangedBy: true
@Semantics.systemDate.createdAt: true
@Semantics.systemDate.lastChangedAt: true
@Semantics.systemDate.localInstanceLastChangedAt: true
```

### Amount / Currency / Quantity
```abap
@Semantics.amount.currencyCode: 'CurrencyCode'   -- on amount field, references currency field
@Semantics.currencyCode: true                    -- marks the currency code field
@Semantics.quantity.unitOfMeasure: 'Unit'        -- on quantity field
@Semantics.unitOfMeasure: true                   -- marks unit field
```

### Business fields
```abap
@Semantics.businessDate.from: true
@Semantics.businessDate.to: true
@Semantics.fiscalYear.period: true
@Semantics.fiscalYear.year: true
@Semantics.language: true
@Semantics.text: true
@Semantics.name.fullName: true
@Semantics.email.address: true
@Semantics.telephone.type: [#WORK]
@Semantics.url: true
@Semantics.uuid: true
@Semantics.mimeType: true
@Semantics.imageUrl: true
```

---

## UI

### List Report / Object Page layout
```abap
@UI.headerInfo: {
  typeName: 'Travel',
  typeNamePlural: 'Travels',
  title: { type: #STANDARD, value: 'TravelId' },
  description: { value: 'Description' }
}

@UI.presentationVariant: [{
  sortOrder: [{ by: 'BeginDate', direction: #DESC }],
  visualizations: [{ type: #AS_LINEITEM }]
}]

@UI.selectionVariant: [{
  id: 'OpenTravel',
  filter: 'OverallStatus EQ ''O'''
}]
```

### Field-level UI
```abap
-- Line item (table column)
@UI.lineItem: [{
  position: 10,
  label: 'Travel ID',
  importance: #HIGH,
  type: #STANDARD
}]

-- Object page form field
@UI.identification: [{ position: 10 }]

-- Selection filter
@UI.selectionField: [{ position: 10 }]

-- Header field (object page header)
@UI.fieldGroup: [{
  qualifier: 'TravelData',
  position: 10,
  label: 'Travel'
}]

-- Facets (sections on object page)
@UI.facet: [{
  id: 'GeneralInfo',
  purpose: #STANDARD,
  type: #IDENTIFICATION_REFERENCE,
  label: 'General Information',
  position: 10
}, {
  id: 'Bookings',
  purpose: #STANDARD,
  type: #LINEITEM_REFERENCE,
  label: 'Bookings',
  position: 20,
  targetQualifier: 'booking'
}]

-- Hidden from UI
@UI.hidden: true

-- Read-only in UI
@UI.fieldGroup: [{ qualifier: 'Admin', position: 10 }]
```

### Criticality / Status
```abap
@UI.lineItem: [{ criticality: 'StatusCriticality', criticalityRepresentation: #WITH_ICON }]
-- StatusCriticality field must return: 0=Neutral, 1=Red, 2=Yellow, 3=Green
```

---

## VDM (Virtual Data Model)

```abap
@VDM.viewType: #BASIC             -- lowest layer, close to DB tables
@VDM.viewType: #COMPOSITE         -- joins multiple basic views
@VDM.viewType: #CONSUMPTION       -- top layer, UI/OData facing
@VDM.viewType: #EXTENSION         -- customer extension view

@VDM.lifecycle.contract.type: #PUBLIC_LOCAL_API   -- for released APIs
@VDM.private: true                                -- internal use only
```
