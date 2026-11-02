# OData $apply, $batch & Delta Links

Read for: aggregation with `$apply`, V4 JSON and V2 multipart `$batch`, changesets, delta queries and CDS-based extraction.

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

### OData V4 Batch (JSON format)

JSON batch is defined in OData 4.01. SAP UI5 and many SAP Gateway V4 services use
the multipart format; check that the target service accepts JSON batch before
relying on it.

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
      "url": "$req1/_Booking",
      "body": { "FlightId": "LH0001" }
    }
  ]
}
```

`$req1/_Booking` — a request id used at the start of a URL refers to the entity
created by that earlier request in the same batch (here: create a booking below
the new travel). Request ids can't be used as placeholders inside body values.

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
      "status": 201,
      "body": { "TravelId": "00000001", ... }
    }
  ]
}
```

---

## 8. Delta Links & Change Tracking

Delta links allow polling for changes since the last read (CDC pattern).

### OData V4 Delta Query

Change tracking is requested with a `Prefer` header; the token in the returned
`@odata.deltaLink` is opaque. Whether a given SAP service supports delta at all
depends on the service implementation — check before designing around it.

```http
-- Initial full read, request delta link
GET /Travel
Prefer: odata.track-changes
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

### CDS Data Extraction (BW / Datasphere)

Delta extraction from CDS views (e.g. for SAP BW/4HANA or SAP Datasphere) is enabled
by annotations — this is separate from OData delta links:

```abap
// Enable delta on CDS view
@Analytics.dataExtraction.enabled: true
@Analytics.dataExtraction.delta.byElement.name: 'LastChangedAt'
@Analytics.dataExtraction.delta.byElement.maxDelayInSeconds: 3600
```
