# OData Advanced Reference

Advanced OData patterns for SAP development. Covers Draft OData protocol,
aggregation with $apply, batch requests, ETags, error response format,
bound vs unbound operations, SAP-specific headers, delta/change tracking,
deep insert, and navigation property POST.

---

## Table of Contents

1. [Draft OData Protocol](#1-draft-odata-protocol)
2. [$apply — Aggregation Extension (OData V4)](#2-apply--aggregation-extension-odata-v4)
3. [Batch Requests ($batch)](#3-batch-requests-batch)
4. [ETag & Optimistic Concurrency](#4-etag--optimistic-concurrency)
5. [Bound vs Unbound Actions/Functions](#5-bound-vs-unbound-actionsfunctions)
6. [OData Error Response Format](#6-odata-error-response-format)
7. [SAP-Specific Headers](#7-sap-specific-headers)
8. [Delta Links & Change Tracking](#8-delta-links--change-tracking)
9. [Deep Insert (V2 and V4)](#9-deep-insert-v2-and-v4)
10. [Navigation Property POST](#10-navigation-property-post)

---

## 1. Draft OData Protocol

RAP draft handling introduces additional OData V4 entities and query parameters.
Understanding the draft protocol is essential for consuming Fiori/RAP-based services.

### Draft System Fields

Every draft-enabled entity exposes these virtual fields:

| Field | Type | Meaning |
|---|---|---|
| `IsActiveEntity` | Boolean | `true` = active record, `false` = draft |
| `HasActiveEntity` | Boolean | `true` = active version exists for this draft |
| `HasDraftEntity` | Boolean | `true` = a draft exists for this active record |
| `DraftEntityCreationDateTime` | DateTimeOffset | When draft was created |
| `DraftEntityLastChangedDateTime` | DateTimeOffset | When draft was last saved |
| `InProcessByUser` | String | User who has the draft locked |

### Reading Active Records Only

```http
GET /Travel?$filter=IsActiveEntity eq true
```

### Reading All Drafts for Current User

```http
GET /Travel?$filter=IsActiveEntity eq false and InProcessByUser eq 'MYUSER'
```

### Reading Sibling (Draft ↔ Active)

```http
-- From active, get its draft sibling
GET /Travel(TravelId='00000001',IsActiveEntity=true)/SiblingEntity

-- From draft, get its active sibling
GET /Travel(TravelId='00000001',IsActiveEntity=false)/SiblingEntity
```

### Standard Draft Actions

All draft-enabled entities expose these OData actions automatically:

```http
-- Create new draft (equivalent to clicking "Create" in Fiori)
POST /Travel
Content-Type: application/json
{ "AgencyId": "000001", "IsActiveEntity": false }

-- Edit existing record (creates draft from active)
POST /Travel(TravelId='00000001',IsActiveEntity=true)/draftEdit
Content-Type: application/json
{ "PreserveChanges": false }

-- Activate draft (Save button)
POST /Travel(TravelId='00000001',IsActiveEntity=false)/draftActivate

-- Discard draft (Cancel button)
DELETE /Travel(TravelId='00000001',IsActiveEntity=false)
```

### Full Fiori Save Flow (HTTP sequence)

```
1. POST  /Travel                             → creates new draft, returns IsActiveEntity=false
2. PATCH /Travel(id,IsActiveEntity=false)    → update fields during edit
3. POST  /Travel(id,IsActiveEntity=false)/draftActivate  → save to DB
```

### $expand Draft + Active Together

```http
GET /Travel?$expand=SiblingEntity&$filter=IsActiveEntity eq false
```

---

## 2. $apply — Aggregation Extension (OData V4)

`$apply` enables server-side aggregation, grouping, and transformation.
Supported in SAP OData V4 services backed by CDS Analytical queries.

### Basic Aggregation

```http
-- Sum of BookingFee grouped by AgencyId
GET /Travel?$apply=groupby((AgencyId),aggregate(BookingFee with sum as TotalFee))

-- Count records per status
GET /Travel?$apply=groupby((OverallStatus),aggregate($count as RecordCount))

-- Average with filter
GET /Travel?$apply=filter(BeginDate ge 2024-01-01T00:00:00Z)/
    groupby((CurrencyCode),aggregate(BookingFee with average as AvgFee))
```

### Transformation Sequence

`$apply` transformations execute left to right:

```http
-- filter → groupby → orderby result
GET /Travel?$apply=filter(OverallStatus eq 'A')/
    groupby((AgencyId,CurrencyCode),aggregate(BookingFee with sum as Total))/
    orderby(Total desc)
```

### Aggregate Functions

| Function | Meaning |
|---|---|
| `sum` | Sum of values |
| `min` | Minimum value |
| `max` | Maximum value |
| `average` | Average |
| `countdistinct` | Count distinct values |
| `$count` | Row count |

### topcount / bottomcount

```http
-- Top 5 agencies by total fee
GET /Travel?$apply=groupby((AgencyId),aggregate(BookingFee with sum as Total))/
    topcount(5,Total)
```

### SAP Analytics Cloud uses $apply heavily — always combine with:

```http
$apply=...&$count=true&$select=...
```

---

## 3. Batch Requests ($batch)

`$batch` sends multiple OData requests in a single HTTP call, reducing round trips.

### OData V4 Batch (JSON format — preferred)

```http
POST /sap/opu/odata4/sap/z_sb_travel_o4/srvd/sap/z_sd_travel/0001/$batch
Content-Type: application/json

{
  "requests": [
    {
      "id": "req1",
      "method": "GET",
      "url": "Travel?$filter=OverallStatus eq 'O'&$top=10",
      "headers": {}
    },
    {
      "id": "req2",
      "method": "PATCH",
      "url": "Travel(TravelId='00000001',IsActiveEntity=false)",
      "headers": { "Content-Type": "application/json" },
      "body": { "Description": "Updated description" }
    }
  ]
}
```

### OData V2 Batch (multipart/mixed — legacy)

```http
POST /sap/opu/odata/sap/Z_TRAVEL_SRV/$batch
Content-Type: multipart/mixed; boundary=batch_abc123
X-CSRF-Token: <token>

--batch_abc123
Content-Type: application/http

GET TravelSet?$top=5 HTTP/1.1


--batch_abc123
Content-Type: multipart/mixed; boundary=changeset_xyz

--changeset_xyz
Content-Type: application/http
Content-Transfer-Encoding: binary

POST TravelSet HTTP/1.1
Content-Type: application/json

{"TravelId":"","AgencyId":"000001","BeginDate":"20241201","EndDate":"20241231"}

--changeset_xyz--

--batch_abc123--
```

### Changesets

Requests inside a `changeset` are transactional — all succeed or all fail:

```json
{
  "requests": [
    {
      "id": "req1",
      "atomicityGroup": "changeset1",
      "method": "POST",
      "url": "Travel",
      "body": { "AgencyId": "000001", "BeginDate": "2024-12-01" }
    },
    {
      "id": "req2",
      "atomicityGroup": "changeset1",
      "method": "POST",
      "url": "Booking",
      "body": { "TravelId": "$req1/TravelId", "FlightId": "LH0001" }
    }
  ]
}
```

`$req1/TravelId` — ID reference allows using response from req1 as input to req2.

### Batch Response

```json
{
  "responses": [
    {
      "id": "req1",
      "status": 200,
      "body": { "value": [...] }
    },
    {
      "id": "req2",
      "status": 200,
      "body": { "TravelId": "00000001", ... }
    }
  ]
}
```

---

## 4. ETag & Optimistic Concurrency

ETags prevent "lost update" problems when multiple users edit the same record.

### ETag in OData V4 Response

```http
GET /Travel(TravelId='00000001',IsActiveEntity=true)

Response:
HTTP/1.1 200 OK
ETag: W/"2024-12-01T10:30:00Z"
{
  "TravelId": "00000001",
  "@odata.etag": "W/\"2024-12-01T10:30:00Z\""
}
```

### Using ETag in Update (If-Match)

```http
PATCH /Travel(TravelId='00000001',IsActiveEntity=false)
If-Match: W/"2024-12-01T10:30:00Z"
Content-Type: application/json

{ "Description": "New description" }
```

If the record was modified by another user after you read it, server returns:

```http
HTTP/1.1 412 Precondition Failed
{
  "error": {
    "code": "PRECONDITION_FAILED",
    "message": "Record was modified by another user"
  }
}
```

### Force Update (bypass ETag)

```http
PATCH /Travel(TravelId='00000001',IsActiveEntity=false)
If-Match: *
```

Use `If-Match: *` only when you intentionally want to overwrite regardless of concurrency.

### ETag in RAP BDEF

```abap
define behavior for Z_I_Travel alias Travel
  ...
  etag master LocalLastChangedAt       -- field-level ETag (utclong)
  lock master total etag LastChangedAt -- pessimistic lock ETag
{
  ...
}
```

---

## 5. Bound vs Unbound Actions/Functions

### Bound Action (operates on specific entity instance)

```http
-- Syntax: Entity(key)/ActionName
POST /Travel(TravelId='00000001',IsActiveEntity=false)/com.sap.namespace.acceptTravel
Content-Type: application/json

{
  "Reason": "Approved by manager"
}
```

In OData V4 metadata:
```xml
<Action Name="acceptTravel" IsBound="true">
  <Parameter Name="in" Type="com.sap.namespace.TravelType" Nullable="false"/>
  <Parameter Name="Reason" Type="Edm.String"/>
  <ReturnType Type="com.sap.namespace.TravelType" Nullable="false"/>
</Action>
```

### Unbound Action (no entity key needed)

```http
-- Syntax: /ActionName directly
POST /com.sap.namespace.CalculateGlobalDiscount
Content-Type: application/json

{
  "DiscountRate": 0.1,
  "ValidFrom": "2024-01-01T00:00:00Z"
}
```

### Static Action vs Instance Action

| Type | BDEF Syntax | OData Invocation |
|---|---|---|
| Instance action (default) | `action acceptTravel` | `POST /Travel(key)/acceptTravel` |
| Static factory action | `static factory action createByTemplate` | `POST /Travel/createByTemplate` |
| Static action | `static action purgeExpired` | `POST /Travel/purgeExpired` |

### Function (no side effects, GET-like)

```http
-- Bound function (on instance)
GET /Travel(TravelId='00000001',IsActiveEntity=true)/calculateRemainingDays()

-- Unbound function
GET /checkAgencyStatus(AgencyId='000001')
```

Functions use GET, actions use POST. Functions must not change data.

---

## 6. OData Error Response Format

### OData V4 Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "target": "BeginDate",
    "details": [
      {
        "code": "DATE_IN_PAST",
        "message": "Begin date must not be in the past",
        "target": "BeginDate",
        "@com.sap.vocabularies.Common.v1.numericSeverity": 4
      },
      {
        "code": "DATE_SEQUENCE",
        "message": "End date must be after begin date",
        "target": "EndDate",
        "@com.sap.vocabularies.Common.v1.numericSeverity": 4
      }
    ],
    "innererror": {
      "application": {
        "component_id": "Z_TRAVEL",
        "service_namespace": "/SAP/",
        "service_id": "Z_SD_TRAVEL",
        "service_version": "0001"
      }
    }
  }
}
```

### SAP Severity Values

| `numericSeverity` | Meaning | UI Display |
|---|---|---|
| `1` | Success | Green |
| `2` | Information | Blue |
| `3` | Warning | Yellow |
| `4` | Error | Red |

### OData V2 Error Format (legacy)

```json
{
  "error": {
    "code": "SY/530",
    "message": {
      "lang": "en",
      "value": "Resource not found"
    },
    "innererror": {
      "transactionid": "...",
      "timestamp": "...",
      "Error_Resolution": {
        "SAP_Transaction": "/IWFND/ERROR_LOG",
        "SAP_Note": "1797736"
      }
    }
  }
}
```

### Common HTTP Status Codes in SAP OData

| Code | Scenario |
|---|---|
| `200 OK` | GET success |
| `201 Created` | POST (create) success |
| `204 No Content` | PATCH/DELETE success (no body) |
| `400 Bad Request` | Invalid request body / missing mandatory fields |
| `401 Unauthorized` | Missing/invalid credentials |
| `403 Forbidden` | Valid credentials but no authorization |
| `404 Not Found` | Entity not found |
| `409 Conflict` | Lock conflict / duplicate key |
| `412 Precondition Failed` | ETag mismatch |
| `422 Unprocessable Entity` | Business validation failure (RAP) |
| `500 Internal Server Error` | Unhandled ABAP exception |

---

## 7. SAP-Specific Headers

### Request Headers

| Header | Values | Purpose |
|---|---|---|
| `X-CSRF-Token` | `Fetch` / `<token>` | CSRF protection (required for modifying calls in V2) |
| `sap-client` | `100` / `200` etc. | Override SAP client (if allowed) |
| `sap-language` | `EN` / `DE` / `ZH` | Response language for text fields |
| `Accept-Language` | `en-US` | Standard locale (also accepted) |
| `sap-statistics` | `true` | Request performance statistics in response |
| `odata-maxversion` | `4.0` | Force OData V4 protocol |
| `Prefer` | `return=representation` | Return full entity body after PATCH/POST |
| `Prefer` | `handling=strict` | Fail on unknown query options (V4) |

### CSRF Token Flow (V2)

```http
-- Step 1: Fetch token
GET /sap/opu/odata/sap/Z_TRAVEL_SRV/$metadata
X-CSRF-Token: Fetch
→ Response header: X-CSRF-Token: abc123def456

-- Step 2: Use in modifying request
POST /sap/opu/odata/sap/Z_TRAVEL_SRV/TravelSet
X-CSRF-Token: abc123def456
Content-Type: application/json
{ ... }
```

### Response Headers

| Header | Meaning |
|---|---|
| `X-CSRF-Token` | Token value (on initial fetch) |
| `sap-statistics` | Backend performance data (if requested) |
| `OData-Version` | `4.0` |
| `Location` | URL of newly created entity (on 201) |
| `ETag` | Current ETag value |

### Prefer: return=representation

Without this header, PATCH returns `204 No Content` (empty body).
With this header, server returns the full updated entity — saves a round trip:

```http
PATCH /Travel(TravelId='00000001',IsActiveEntity=false)
Prefer: return=representation

→ HTTP 200 OK with full entity body
```

---

## 8. Delta Links & Change Tracking

Delta links allow polling for changes since the last read (CDC pattern).

### OData V4 Delta Query

```http
-- Initial full read, request delta link
GET /Travel?$deltatoken=initial
→ Response includes @odata.deltaLink
{
  "value": [...],
  "@odata.deltaLink": "/Travel?$deltatoken=eyJlIjoiMjAyNDEyMDFUMTAzMDAwWiJ9"
}

-- Next poll: only changed/deleted records
GET /Travel?$deltatoken=eyJlIjoiMjAyNDEyMDFUMTAzMDAwWiJ9
→ Returns only new/modified/deleted records since last token
```

### Deleted Records in Delta Response

```json
{
  "value": [
    { "TravelId": "00000005", "@removed": { "reason": "deleted" } }
  ],
  "@odata.deltaLink": "..."
}
```

### SAP Analytics Cloud Data Extraction

SAP Analytics Cloud uses delta extraction from CDS views:

```abap
-- Enable delta on CDS view
@Analytics.dataExtraction.enabled: true
@Analytics.dataExtraction.delta.byElement.name: 'LastChangedAt'
@Analytics.dataExtraction.delta.byElement.maxDelayInSeconds: 3600
```

---

## 9. Deep Insert (V2 and V4)

Deep insert creates a parent + child entities in a single request.

### OData V4 Deep Insert

```http
POST /Travel
Content-Type: application/json

{
  "AgencyId": "000001",
  "BeginDate": "2024-12-01",
  "EndDate": "2024-12-31",
  "BookingFee": "100",
  "CurrencyCode": "EUR",
  "_Booking": [
    {
      "FlightId": "LH0001",
      "FlightDate": "2024-12-01",
      "FlightPrice": "500",
      "CurrencyCode": "EUR"
    },
    {
      "FlightId": "LH0002",
      "FlightDate": "2024-12-15",
      "FlightPrice": "350",
      "CurrencyCode": "EUR"
    }
  ]
}
```

### OData V2 Deep Insert (legacy)

```http
POST /TravelSet
Content-Type: application/json

{
  "TravelId": "",
  "AgencyId": "000001",
  "ToBookings": {
    "results": [
      { "FlightId": "LH0001", "FlightDate": "20241201" }
    ]
  }
}
```

### RAP BDEF requirement for Deep Insert

```abap
define behavior for Z_I_Travel alias Travel
{
  create;
  association _Booking { create; }  -- must expose create on association
}
```

---

## 10. Navigation Property POST

Create a child entity via its parent's navigation property.

### Syntax

```http
POST /Travel(TravelId='00000001',IsActiveEntity=false)/_Booking
Content-Type: application/json

{
  "FlightId": "LH0001",
  "FlightDate": "2024-12-01T00:00:00Z",
  "FlightPrice": 500.00,
  "CurrencyCode": "EUR"
}
```

This is equivalent to creating a Booking with `TravelId = '00000001'` directly,
but uses the navigation path — which enforces the parent-child relationship.

### V2 Navigation POST

```http
POST /TravelSet('00000001')/ToBookings
Content-Type: application/json

{ "FlightId": "LH0001", "FlightDate": "20241201", "FlightPrice": "500.00" }
```

### Read Children via Navigation

```http
-- Read all bookings for a travel
GET /Travel(TravelId='00000001',IsActiveEntity=true)/_Booking

-- With $expand (read parent + children in one call)
GET /Travel(TravelId='00000001',IsActiveEntity=true)?$expand=_Booking($select=BookingId,FlightId,FlightDate)
```

---

## Quick Reference: OData V2 vs V4 Comparison

| Feature | OData V2 | OData V4 |
|---|---|---|
| Metadata format | XML only | XML (default), JSON |
| Batch format | multipart/mixed | JSON (preferred) or multipart |
| Actions | Function Imports (POST) | Actions (bound/unbound) |
| Functions | Function Imports (GET) | Functions (bound/unbound) |
| Filter `in` list | ❌ | `$filter=x in ('a','b')` |
| `$apply` aggregation | ❌ | ✅ |
| Delta / change tracking | ❌ (SAP ext.) | ✅ native |
| Deep insert syntax | `results: [...]` | Direct array on nav property |
| Draft protocol | ❌ | ✅ native |
| `Prefer: return=representation` | ❌ | ✅ |
| ETag | ❌ (SAP ext.) | ✅ native |
| CSRF token | Required | Optional (session-based) |
