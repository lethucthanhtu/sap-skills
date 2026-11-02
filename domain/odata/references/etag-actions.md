# OData ETags & Bound/Unbound Operations

Read for: `If-Match`, 412 Precondition Failed, ETag in the BDEF, bound vs unbound actions and functions.

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
  etag master LocalLastChangedAt       // instance ETag (optimistic concurrency)
  lock master total etag LastChangedAt // draft: detects active-data changes on resume/activate
{
  ...
}
```

---

## 5. Bound vs Unbound Actions/Functions

### Bound Action (operates on specific entity instance)

```http
-- Syntax: Entity(key)/ActionName
POST /Travel(TravelId='00000001',IsActiveEntity=false)/com.sap.gateway.srvd.z_sd_travel.v0001.acceptTravel
Content-Type: application/json

{
  "Reason": "Approved by manager"
}
```

In OData V4 metadata:
```xml
<Action Name="acceptTravel" IsBound="true">
  <Parameter Name="_it" Type="com.sap.gateway.srvd.z_sd_travel.v0001.TravelType" Nullable="false"/>
  <Parameter Name="Reason" Type="Edm.String"/>
  <ReturnType Type="com.sap.gateway.srvd.z_sd_travel.v0001.TravelType" Nullable="false"/>
</Action>
```

### Unbound Action (no entity key needed)

Unbound actions are called through their **action import** name at the service root
(no namespace). RAP does not generate unbound actions — RAP *static* actions are
bound to the entity collection instead (see table below).

```http
-- Syntax: /<ActionImport> directly
POST /CalculateGlobalDiscount
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
