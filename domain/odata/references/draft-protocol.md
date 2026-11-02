# OData V4 Draft Protocol

Read for: `IsActiveEntity`, `HasDraftEntity`, `SiblingEntity`, draft actions (Edit/Activate/Prepare/Discard) and the Fiori save sequence over HTTP.

---

## 1. Draft OData Protocol

RAP draft handling introduces additional OData V4 entities and query parameters.
Understanding the draft protocol is essential for consuming Fiori/RAP-based services.

### Draft System Fields

Every draft-enabled entity exposes these properties:

| Field | Type | Meaning |
|---|---|---|
| `IsActiveEntity` | Boolean | `true` = active record, `false` = draft (part of the key) |
| `HasActiveEntity` | Boolean | `true` = active version exists for this draft |
| `HasDraftEntity` | Boolean | `true` = a draft exists for this active record |
| `DraftAdministrativeData` | Navigation | Draft admin entity (see below) |

Draft metadata such as `CreationDateTime`, `LastChangeDateTime`, `InProcessByUser`
lives on the `DraftAdministrativeData` navigation target, not on the entity itself.

### Reading Active Records Only

```http
GET /Travel?$filter=IsActiveEntity eq true
```

### Reading All Drafts for Current User

```http
GET /Travel?$filter=IsActiveEntity eq false&$expand=DraftAdministrativeData
```

### Reading Sibling (Draft ↔ Active)

```http
-- From active, get its draft sibling
GET /Travel(TravelId='00000001',IsActiveEntity=true)/SiblingEntity

-- From draft, get its active sibling
GET /Travel(TravelId='00000001',IsActiveEntity=false)/SiblingEntity
```

### Standard Draft Actions

RAP draft BOs expose the draft actions `Edit`, `Activate`, `Prepare`, `Resume`
(and `Discard`) as **bound actions**, qualified with the service namespace
(`com.sap.gateway.srvd.<service_definition>.v0001` — check `$metadata`). The
names `draftEdit` / `draftActivate` are the CAP conventions, not RAP's.

```http
-- Create new draft (equivalent to clicking "Create" in Fiori)
POST /Travel
Content-Type: application/json
{ "AgencyId": "000001" }

-- Edit existing record (creates draft from active)
POST /Travel(TravelId='00000001',IsActiveEntity=true)/com.sap.gateway.srvd.z_sd_travel.v0001.Edit
Content-Type: application/json
{ "PreserveChanges": true }

-- Run draft validations/determinations (Fiori sends this before Activate)
POST /Travel(TravelId='00000001',IsActiveEntity=false)/com.sap.gateway.srvd.z_sd_travel.v0001.Prepare

-- Activate draft (Save button)
POST /Travel(TravelId='00000001',IsActiveEntity=false)/com.sap.gateway.srvd.z_sd_travel.v0001.Activate

-- Discard draft (Cancel button)
DELETE /Travel(TravelId='00000001',IsActiveEntity=false)
```

### Full Fiori Save Flow (HTTP sequence)

```
1. POST  /Travel                             → creates new draft, returns IsActiveEntity=false
2. PATCH /Travel(id,IsActiveEntity=false)    → update fields during edit
3. POST  .../Prepare then .../Activate       → validate, then save to DB (one $batch)
```

### $expand Draft + Active Together

```http
GET /Travel?$expand=SiblingEntity&$filter=IsActiveEntity eq false
```
