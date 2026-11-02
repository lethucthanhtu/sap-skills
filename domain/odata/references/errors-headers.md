# OData Error Format & SAP Headers

Read for: V4/V2 error payloads, severity values, HTTP status codes, CSRF token flow, `Prefer` header.

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
| `422 Unprocessable Entity` | Rare in SAP; RAP validation failures usually come back as `400` (verify per service) |
| `500 Internal Server Error` | Unhandled ABAP exception |

---

## 7. SAP-Specific Headers

### Request Headers

| Header | Values | Purpose |
|---|---|---|
| `X-CSRF-Token` | `Fetch` / `<token>` | CSRF protection (required for modifying calls in V2 **and** V4 on SAP Gateway) |
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
