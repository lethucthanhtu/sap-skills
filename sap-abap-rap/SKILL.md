---
name: sap-odata
description: >
  Expert guidance for SAP OData service development. Use this skill whenever the user
  mentions OData, OData V2, OData V4, Service Definition, Service Binding, SEGW,
  Gateway, $metadata, $expand, $filter, $batch, entity set, navigation property,
  function import, action import, or anything related to exposing SAP data via OData.
  Covers both legacy ABAP Gateway (SEGW/MPC) and modern CDS-based OData V4 via
  Service Definitions and Bindings (on-premise and BTP/Steampunk).
  Always activate for: "create OData service", "expose CDS via OData", "OData V4 binding",
  "SEGW project", "function import", "OData filter syntax", "OData batch request".
---

# SAP OData Skill

You are an expert SAP OData developer. Provide production-ready implementations
covering both legacy SEGW/Gateway and modern CDS-based OData V4 approaches.

## Approach Decision Tree

When a user asks for an OData service, first determine:

1. **New development on S/4HANA 2020+ or BTP?** → Use CDS + Service Definition + V4 Binding
2. **Extending existing SEGW project?** → Use SEGW extension/redefinition pattern
3. **Legacy system (ECC / S/4 < 2020)?** → SEGW V2 with MPC/DPC classes
4. **RAP-based BO?** → OData V4 is automatic via Projection View + Service Binding

---

## Modern Approach: CDS-Based OData V4

### Step 1: Projection (Consumption) CDS View
```abap
@EndUserText.label: 'Travel Service Projection'
@AccessControl.authorizationCheck: #NOT_REQUIRED
@Metadata.allowExtensions: true

define root view entity Z_C_Travel
  provider contract transactional_query
  as projection on Z_I_Travel
{
  key TravelId,
      AgencyId,
      BeginDate,
      EndDate,
      BookingFee,
      CurrencyCode,
      OverallStatus,
      Description,
      CreatedBy,
      CreatedAt,
      LastChangedBy,
      LastChangedAt,
      LocalLastChangedAt,
      _Booking : redirected to composition child Z_C_Booking,
      _Agency
}
```

### Step 2: Service Definition (`.srvd`)
```abap
@EndUserText.label: 'Travel Service Definition'
define service Z_SD_TRAVEL {
  expose Z_C_Travel      as Travel;
  expose Z_C_Booking     as Booking;
  expose I_Currency      as Currency;
  expose I_Country       as Country;
}
```

### Step 3: Service Binding (`.srvb`)
Created via ADT UI (New → Service Binding):
- **Binding Type**: `OData V4 - UI` for Fiori, `OData V4 - Web API` for API consumption
- **Service Name**: `Z_SB_TRAVEL_O4`
- Activate and note the Service URL

---

## Legacy Approach: SEGW / SAP Gateway (OData V2)

### Project Structure
```
SEGW Project: Z_TRAVEL_SRV
├── Data Model
│   ├── Entity Types
│   │   └── TravelType (key: TravelId)
│   └── Entity Sets
│       └── TravelSet
├── Service Implementation
│   ├── MPC (Model Provider Class): ZCL_Z_TRAVEL_SRV_MPC
│   ├── MPC_EXT (Extension):        ZCL_Z_TRAVEL_SRV_MPC_EXT
│   ├── DPC (Data Provider Class):  ZCL_Z_TRAVEL_SRV_DPC
│   └── DPC_EXT (Extension):        ZCL_Z_TRAVEL_SRV_DPC_EXT
└── Runtime Objects
    └── Z_TRAVEL_SRV (service registration)
```

### DPC_EXT Method — GET_ENTITY (single read)
```abap
METHOD travelset_get_entity.
  DATA: ls_key   TYPE /iwbep/s_mgw_name_value_pair,
        lv_id    TYPE z_travel_id,
        ls_data  TYPE zt_travel.

  " Read key from request
  READ TABLE it_key_tab INTO ls_key
    WITH KEY name = 'TravelId'.
  lv_id = ls_key-value.

  " Select from DB / CDS
  SELECT SINGLE *
    FROM z_i_travel
    WHERE travel_id = @lv_id
    INTO CORRESPONDING FIELDS OF @ls_data.

  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        textid = /iwbep/cx_mgw_busi_exception=>entity_not_found.
  ENDIF.

  er_entity = ls_data.
ENDMETHOD.
```

### DPC_EXT Method — GET_ENTITYSET (collection read)
```abap
METHOD travelset_get_entityset.
  DATA: lt_filter  TYPE /iwbep/t_mgw_select_option,
        ls_paging  TYPE /iwbep/s_mgw_paging,
        lt_data    TYPE TABLE OF zt_travel.

  " Apply $top / $skip
  ls_paging = io_tech_request_context->get_paging( ).

  " Apply $filter
  lt_filter = io_tech_request_context->get_filter( )->get_filter_select_options( ).

  " Select with filter
  SELECT *
    FROM z_i_travel
    INTO CORRESPONDING FIELDS OF TABLE @lt_data
    UP TO ls_paging-top ROWS
    OFFSET ls_paging-skip.

  et_entityset = lt_data.
ENDMETHOD.
```

### Function Import (SEGW)
```abap
" Registered in SEGW under: Service Implementation > Function Imports
METHOD calculate_total_price.
  " io_tech_request_context contains function import parameters
  DATA(lv_travel_id) = io_tech_request_context->get_parameter( 'TravelId' ).

  " Business logic
  SELECT SINGLE booking_fee + SUM( flight_price )
    FROM z_i_booking
    WHERE travel_id = @lv_travel_id
    INTO @DATA(lv_total).

  " Return via er_data
  er_data = VALUE #( total_price = lv_total ).
ENDMETHOD.
```

---

## OData V4 — Actions & Functions (RAP / CDS)

### Unbound Action (in Behavior Definition)
```abap
-- In BDEF:
action ConfirmTravel result [1] $self;

-- In Behavior Implementation:
METHOD confirmTravel.
  MODIFY ENTITIES OF Z_I_Travel
    ENTITY Travel
    UPDATE FIELDS ( OverallStatus )
    WITH VALUE #( FOR key IN keys
      ( %tky          = key-%tky
        OverallStatus = 'A' ) ).
  READ ENTITIES OF Z_I_Travel ...
  result = ...
ENDMETHOD.
```

---

## OData Query Options — Quick Reference

### $filter
```
# Comparison
$filter=TravelId eq '00000001'
$filter=Amount gt 100.00
$filter=BeginDate ge 2024-01-01T00:00:00Z

# String functions
$filter=contains(Description,'SAP')
$filter=startswith(AgencyName,'Tour')
$filter=endswith(Email,'@sap.com')

# Logical
$filter=Amount gt 100 and CurrencyCode eq 'EUR'
$filter=Status eq 'O' or Status eq 'A'
$filter=not(Status eq 'X')

# In list (V4 only)
$filter=Status in ('O','A','B')
```

### $expand (V4 — nested reads)
```
$expand=_Booking
$expand=_Booking($select=BookingId,FlightDate;$expand=_Flight)
$expand=*    -- expand all navigations (use carefully)
```

### $select
```
$select=TravelId,AgencyId,BeginDate,Amount
```

### $orderby
```
$orderby=BeginDate desc
$orderby=AgencyId asc,BeginDate desc
```

### $top / $skip (pagination)
```
$top=20&$skip=40
```

### $count
```
$count=true          -- include count in response (V4)
/$count              -- return count only
```

### $search (if enabled)
```
$search=Frankfurt
```

---

## Service Registration (on-premise)

### Via SOAMANAGER / /IWFND/MAINT_SERVICE
```
Transaction: /IWFND/MAINT_SERVICE (Gateway hub) or SOAMANAGER
Steps:
1. Add Service → System Alias: LOCAL (or remote system alias)
2. Technical Service Name: Z_TRAVEL_SRV
3. External Service Name: Z_TRAVEL_SRV
4. Activate
```

### Service URL Pattern
```
-- V2
https://<host>:<port>/sap/opu/odata/sap/Z_TRAVEL_SRV/TravelSet

-- V4 (CDS-based)
https://<host>:<port>/sap/opu/odata4/sap/z_sb_travel_o4/srvd/sap/z_sd_travel/0001/Travel
```

---

## Common Errors & Fixes

### "No service found for namespace / service name"
- Fix: Register service in `/IWFND/MAINT_SERVICE`, check system alias.

### "Entity type not found in $metadata"
- Cause: MPC model not regenerated after SEGW change.
- Fix: In SEGW → Generate Runtime Objects, or reactivate.

### "$expand not working / empty"
- Cause: Navigation property defined but `expand_entity` not implemented in DPC_EXT.
- Fix: Implement `<entityset>_expand_entity` / use `$auto` with CDS associations.

### "401 Unauthorized on OData call"
- Fix: Assign role `/IWFND/RT_GW_USER` to user, check auth objects F_SRVB_ADM.

### "CSRF token validation failed (403)"
- Fix: First GET with header `X-CSRF-Token: Fetch`, then use returned token in modifying calls.
  ```http
  GET /sap/opu/odata/sap/Z_SRV/$metadata
  X-CSRF-Token: Fetch
  → Response header: X-CSRF-Token: <token>

  POST /sap/opu/odata/sap/Z_SRV/TravelSet
  X-CSRF-Token: <token>
  ```

### "Deep insert fails"
- Fix: Ensure navigation property has correct multiplicity, implement `create_deep_entity` in DPC_EXT (V2), or use composition + draft in RAP (V4).

---

## Output Format

For each OData task, provide:
1. **Service layer** (V2 SEGW vs. V4 CDS-based) with rationale
2. **Complete implementation code** (DDL / ABAP class methods)
3. **Registration steps** if creating a new service
4. **Sample HTTP request** to test the endpoint
5. **Error handling** within the implementation
