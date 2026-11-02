# CDS Metadata Extensions (DDLX)

Read for: `annotate entity ... with`, `@Metadata.layer`, `@Metadata.allowExtensions`, UI annotations kept out of the base view.

---

## 9. Metadata Extensions (DDLX)

Metadata Extensions separate UI annotations from data model annotations.
This enables the Metadata-Driven UI pattern and supports layered extensions.

### Create Metadata Extension (`.ddlx` file in ADT)

```abap
@Metadata.layer: #CUSTOMER
-- Entity-level annotations go BEFORE "annotate entity"
@UI.headerInfo: {
  typeName: 'Travel',
  typeNamePlural: 'Travels',
  title: {
    type: #STANDARD,
    value: 'TravelId'
  },
  description: {
    value: 'Description'
  },
  imageUrl: 'PictureUrl'
}
@UI.presentationVariant: [{
  sortOrder: [{ by: 'BeginDate', direction: #DESC }],
  visualizations: [{ type: #AS_LINEITEM }]
}]
annotate entity Z_C_Travel with
{
  @UI.selectionField: [{ position: 10 }]
  @UI.lineItem: [{ position: 10, importance: #HIGH }]
  @UI.identification: [{ position: 10 }]
  TravelId;

  @UI.selectionField: [{ position: 20 }]
  @UI.lineItem: [{ position: 20 }]
  AgencyId;

  @UI.lineItem: [{ position: 30, importance: #MEDIUM }]
  @UI.identification: [{ position: 30 }]
  BeginDate;

  @UI.lineItem: [{ position: 40 }]
  EndDate;

  @UI.lineItem: [{
    position: 50,
    criticality: 'StatusCriticality',
    criticalityRepresentation: #WITH_ICON,
    label: 'Status'
  }]
  @UI.identification: [{ position: 50 }]
  @UI.selectionField: [{ position: 50 }]
  OverallStatus;

  @UI.facet: [{
    id:       'GeneralInfo',
    purpose:  #STANDARD,
    type:     #IDENTIFICATION_REFERENCE,
    label:    'General Information',
    position: 10
  }, {
    id:           'Bookings',
    purpose:      #STANDARD,
    type:         #LINEITEM_REFERENCE,
    label:        'Bookings',
    position:     20,
    targetElement: '_Booking'
  }]
  @UI.hidden: true
  LocalLastChangedAt;
}
```

### Metadata Layers (priority order, highest first)

| Layer | Used By | Priority |
|---|---|---|
| `#CUSTOMER` | Customer-specific annotations | Highest |
| `#PARTNER` | Partner add-ons | High |
| `#INDUSTRY` | Industry solutions | Medium |
| `#LOCALIZATION` | Country-specific | Low |
| `#CORE` | SAP standard / app developer | Lowest |

### Prerequisites on Consumption View

```abap
-- Consumption view MUST have:
@Metadata.allowExtensions: true
```
