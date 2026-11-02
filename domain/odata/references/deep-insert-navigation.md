# OData Deep Insert, Navigation POST & V2 vs V4

Read for: deep create (V2/V4), the BDEF prerequisites, POST via navigation property, and a V2 vs V4 comparison table.

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
      { "FlightId": "LH0001", "FlightDate": "2024-12-01T00:00:00" }
    ]
  }
}
```

### RAP BDEF requirement for Deep Insert

```abap
define behavior for Z_I_Travel alias Travel
{
  create;
  association _Booking { create; }  // must expose create on association
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

{ "FlightId": "LH0001", "FlightDate": "2024-12-01T00:00:00", "FlightPrice": "500.00" }
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
| ETag / `If-Match` | ✅ | ✅ |
| CSRF token (SAP Gateway) | Required for modifying requests | Required for modifying requests |
