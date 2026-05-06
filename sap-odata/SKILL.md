---
name: sap-abap-rap
description: >
  Expert guidance for SAP RAP (RESTful ABAP Programming Model) development.
  Use this skill whenever the user mentions RAP, BDEF, behavior definition,
  behavior implementation, BO (Business Object), managed scenario, unmanaged scenario,
  draft handling, actions, determinations, validations, side effects, locking,
  early numbering, late numbering, feature control, RAP generator, ABAP EML,
  or anything related to building transactional Fiori apps with RAP.
  Covers both on-premise S/4HANA (7.56+) and ABAP Cloud (BTP/Steampunk).
  Always activate for: "create RAP BO", "BDEF with draft", "RAP validation",
  "RAP action", "EML statement", "managed RAP", "unmanaged RAP", "RAP numbering".
---

# SAP RAP (RESTful ABAP Programming Model) Skill

You are an expert in SAP RAP. Provide complete, production-ready RAP Business Object
implementations with correct BDEF syntax, behavior implementation, and CDS layers.

## RAP Architecture Overview

```
Database Table (DDIC)
    ↓
Interface View Entity       (Z_I_<Name>)      -- data model, define root/child
    ↓
Behavior Definition         (Z_I_<Name>.bdef)  -- capabilities: create/update/delete, actions
    ↓
Behavior Implementation     (ZBP_I_<Name>)     -- ABAP class with method bodies
    ↓
Projection View Entity      (Z_C_<Name>)       -- UI/OData layer, @Metadata.allowExtensions
    ↓
Projection Behavior Def     (Z_C_<Name>.bdef)  -- use/redirect, expose actions to UI
    ↓
Service Definition          (Z_SD_<Name>)
    ↓
Service Binding             (Z_SB_<Name>_O4)   -- OData V4 UI / Web API
```

---

## Behavior Definition (BDEF)

### Managed Scenario (recommended for new development)
```abap
managed implementation in class ZBP_I_Travel unique;
strict ( 2 );
with draft;

define behavior for Z_I_Travel alias Travel
  persistent table ztravel
  draft table ztravel_d
  etag master LocalLastChangedAt
  lock master total etag LastChangedAt
  authorization master ( global )
{
  field ( readonly ) TravelId;
  field ( readonly : update ) AgencyId;
  field ( mandatory ) BeginDate, EndDate, AgencyId, CurrencyCode;

  static factory action createByTemplate parameter Z_D_Travel_Create
    result [1] $self;

  action  ( features : instance ) acceptTravel result [1] $self;
  action  ( features : instance ) rejectTravel result [1] $self;

  determination setStatusToOpen on modify { create; }
  determination calculateTotalPrice on modify { field BookingFee, CurrencyCode; }

  validation validateDates       on save { create; field BeginDate, EndDate; }
  validation validateAgency      on save { create; field AgencyId; }
  validation validateCustomer    on save { create; field CustomerId; }

  side effects {
    field BookingFee affects field TotalPrice;
  }

  create;
  update;
  delete;

  association _Booking { create; with draft; }

  mapping for ztravel corresponding
  {
    TravelId         = travel_id;
    AgencyId         = agency_id;
    BeginDate        = begin_date;
    EndDate          = end_date;
    BookingFee       = booking_fee;
    CurrencyCode     = currency_code;
    OverallStatus    = overall_status;
    Description      = description;
    CreatedBy        = created_by;
    CreatedAt        = created_at;
    LastChangedBy    = last_changed_by;
    LastChangedAt    = last_changed_at;
    LocalLastChangedAt = local_last_changed_at;
  }
}

define behavior for Z_I_Booking alias Booking
  persistent table zbooking
  draft table zbooking_d
  etag dependent by _Travel
  lock dependent by _Travel
  authorization dependent by _Travel
{
  field ( readonly ) BookingId;
  field ( mandatory ) FlightDate, FlightId, CurrencyCode, FlightPrice;

  determination setBookingNumber on modify { create; }
  validation validateFlight      on save   { create; field FlightId, FlightDate; }

  update;
  delete;

  association _Travel { with draft; }

  mapping for zbooking corresponding
  {
    TravelId   = travel_id;
    BookingId  = booking_id;
    FlightId   = flight_id;
    FlightDate = flight_date;
    FlightPrice = flight_price;
    CurrencyCode = currency_code;
  }
}
```

### Projection BDEF (Consumption Layer)
```abap
projection;
strict ( 2 );
use draft;

define behavior for Z_C_Travel alias Travel
{
  use create;
  use update;
  use delete;

  use action acceptTravel;
  use action rejectTravel;
  use action createByTemplate;

  use association _Booking { create; with draft; }
}

define behavior for Z_C_Booking alias Booking
{
  use update;
  use delete;

  use association _Travel;
}
```

---

## Behavior Implementation Class

### Class definition (auto-generated skeleton)
```abap
CLASS zbp_i_travel DEFINITION
  PUBLIC
  ABSTRACT
  FINAL
  FOR BEHAVIOR OF z_i_travel.
ENDCLASS.

CLASS zbp_i_travel IMPLEMENTATION.
ENDCLASS.
```

### Key method implementations

#### Validation — validateDates
```abap
METHOD validateDates.
  " Read fields needed for validation
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel
      FIELDS ( BeginDate EndDate )
      WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travel)
    FAILED DATA(lt_failed).

  LOOP AT lt_travel INTO DATA(ls_travel).
    " Check begin date not in past
    IF ls_travel-BeginDate < cl_abap_context_info=>get_system_date( ).
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      APPEND VALUE #( %tky        = ls_travel-%tky
                      %state_area = 'VALIDATE_DATES'
                      %msg        = new_message_with_text(
                                      severity = if_abap_behv_message=>severity-error
                                      text     = 'Begin date must not be in the past' )
                      %element-BeginDate = if_abap_behv=>mk-on )
        TO reported-travel.
    ENDIF.

    " Check end date after begin date
    IF ls_travel-EndDate < ls_travel-BeginDate.
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      APPEND VALUE #( %tky        = ls_travel-%tky
                      %state_area = 'VALIDATE_DATES'
                      %msg        = new_message_with_text(
                                      severity = if_abap_behv_message=>severity-error
                                      text     = 'End date must be after begin date' )
                      %element-EndDate = if_abap_behv=>mk-on )
        TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

#### Determination — setStatusToOpen
```abap
METHOD setStatusToOpen.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel
      FIELDS ( OverallStatus )
      WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travel).

  " Only set status for newly created records without a status
  DELETE lt_travel WHERE OverallStatus IS NOT INITIAL.

  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel
      UPDATE FIELDS ( OverallStatus )
      WITH VALUE #( FOR ls IN lt_travel
                    ( %tky          = ls-%tky
                      OverallStatus = 'O' ) ).
ENDMETHOD.
```

#### Action — acceptTravel
```abap
METHOD acceptTravel.
  " Read current status
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel
      FIELDS ( OverallStatus )
      WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travel).

  " Filter out already accepted
  DELETE lt_travel WHERE OverallStatus = 'A'.

  " Update status
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel
      UPDATE FIELDS ( OverallStatus )
      WITH VALUE #( FOR ls IN lt_travel
                    ( %tky          = ls-%tky
                      OverallStatus = 'A' ) )
    REPORTED DATA(lt_update_reported).

  " Read result to return
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel
      ALL FIELDS WITH CORRESPONDING #( keys )
    RESULT DATA(lt_result).

  result = VALUE #( FOR ls IN lt_result
                    ( %tky   = ls-%tky
                      %param = ls ) ).
ENDMETHOD.
```

#### Feature Control (instance-based)
```abap
METHOD get_instance_features.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel
      FIELDS ( OverallStatus )
      WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travel)
    FAILED failed.

  result = VALUE #( FOR ls IN lt_travel
                    ( %tky                   = ls-%tky
                      %action-acceptTravel   = COND #( WHEN ls-OverallStatus = 'A'
                                                       THEN if_abap_behv=>fc-o-disabled
                                                       ELSE if_abap_behv=>fc-o-enabled )
                      %action-rejectTravel   = COND #( WHEN ls-OverallStatus = 'X'
                                                       THEN if_abap_behv=>fc-o-disabled
                                                       ELSE if_abap_behv=>fc-o-enabled ) ) ).
ENDMETHOD.
```

---

## Numbering

### Early Numbering (in BDEF)
```abap
managed implementation in class zbp_i_travel unique;

define behavior for Z_I_Travel alias Travel
  ...
  early numbering
{
  ...
}
```

```abap
METHOD earlynumbering_create.
  DATA: lv_max_id TYPE z_travel_id.

  SELECT MAX( travel_id ) FROM ztravel INTO @lv_max_id.

  result = VALUE #( FOR entity IN entities
                    ( %cid    = entity-%cid
                      %key    = entity-%key
                      %param  = entity
                      TravelId = lv_max_id + 1 ) ).
  " Note: In production, use number range object (CL_NUMBERRANGE_RUNTIME)
ENDMETHOD.
```

### Using Number Range (production)
```abap
METHOD earlynumbering_create.
  DATA: lt_failed   TYPE RESPONSE FOR FAILED LATE z_i_travel,
        lt_reported TYPE RESPONSE FOR REPORTED LATE z_i_travel.

  TRY.
      cl_numberrange_runtime=>number_get(
        EXPORTING
          nr_range_nr = '01'
          object      = 'Z_TRAVEL'
          quantity    = lines( entities )
        IMPORTING
          number      = DATA(lv_number_str)
          returncode  = DATA(lv_returncode) ).

      IF lv_returncode <> 0.
        RAISE EXCEPTION TYPE cx_number_ranges.
      ENDIF.

      LOOP AT entities INTO DATA(entity) ASSIGNING FIELD-SYMBOL(<entity>).
        DATA(lv_next_num) = lv_number_str + sy-tabix - 1.
        APPEND VALUE #( %cid    = entity-%cid
                        %key    = entity-%key
                        %param  = entity
                        TravelId = lv_next_num ) TO result.
      ENDLOOP.

    CATCH cx_number_ranges INTO DATA(lx).
      LOOP AT entities INTO entity.
        APPEND VALUE #( %cid = entity-%cid ) TO failed-travel.
        APPEND VALUE #( %cid = entity-%cid
                        %msg = lx ) TO reported-travel.
      ENDLOOP.
  ENDTRY.
ENDMETHOD.
```

---

## Draft Handling

Draft is enabled by adding `with draft` to BDEF and creating the draft table.

### Draft Table (DDIC)
Create a DDIC transparent table `Z<BO>_D` with same fields as active table PLUS:
```
DRAFTUUID       SYSUUID_X16     -- Draft UUID (key)
DRAFTENTITYOPERATIONCODE DRAFT_OPCODE
DRAFTENTITYCREATIONDATETIME TIMESTAMP
DRAFTENTITYLASTCHANGEDATETIME TIMESTAMP
DRAFTADMINISTRATIVEDATETIME TIMESTAMP
DRAFTHIGHESTSUBSCREENVARIANT DRAFT_HSVAR
DRAFTHIGHESTSUBSCREENVARIANTLABEL CHAR40
DRAFTINPROCESSBYUSER USER_D
DRAFTHASTRIGGERINGOPERATION FLAG
DRAFTFOSSELECTIONVARIANT DRAFT_FSVAR
DRAFTISLOCKEDINPROCESSBYUSER USER_D
DRAFTENTITYCONSISTENCYSTATUS DRAFT_CONSTATUS
```
→ Or use ADT: New → Other → Draft Table (auto-generates correct structure)

---

## EML (Entity Manipulation Language) — Quick Reference

```abap
" Create
MODIFY ENTITIES OF z_i_travel
  ENTITY Travel
  CREATE FIELDS ( AgencyId BeginDate EndDate BookingFee CurrencyCode )
  WITH VALUE #( ( %cid      = 'CID_001'
                  AgencyId  = '000001'
                  BeginDate = '20241201'
                  EndDate   = '20241231'
                  BookingFee = '10.00'
                  CurrencyCode = 'EUR' ) )
MAPPED   DATA(mapped)
FAILED   DATA(failed)
REPORTED DATA(reported).

" Read
READ ENTITIES OF z_i_travel
  ENTITY Travel
  FIELDS ( TravelId AgencyId OverallStatus )
  WITH VALUE #( ( TravelId = '00000001' ) )
RESULT DATA(lt_travel).

" Update
MODIFY ENTITIES OF z_i_travel
  ENTITY Travel
  UPDATE FIELDS ( OverallStatus )
  WITH VALUE #( ( TravelId      = '00000001'
                  OverallStatus = 'A' ) ).

" Delete
MODIFY ENTITIES OF z_i_travel
  ENTITY Travel
  DELETE FROM VALUE #( ( TravelId = '00000001' ) ).

" Execute Action
MODIFY ENTITIES OF z_i_travel
  ENTITY Travel
  EXECUTE acceptTravel
  FROM VALUE #( ( TravelId = '00000001' ) )
RESULT DATA(lt_result).

" Commit
COMMIT ENTITIES
  RESPONSE OF z_i_travel
  FAILED   DATA(lt_failed)
  REPORTED DATA(lt_reported).
```

---

## Common Errors & Fixes

### "Behavior implementation method not found"
- Fix: Regenerate behavior implementation class via ADT context menu or reactivate BDEF.

### "Draft table does not exist or has wrong structure"
- Fix: Use ADT "New Draft Table" wizard, or add all draft administrative fields manually.

### "%cid not resolved"
- Cause: Using `%cid` (content ID) but not referencing it via `%cid_ref` in follow-up operations.
- Fix: After CREATE, use `%cid_ref` = same `%cid` value in subsequent UPDATE/action calls.

### "Lock not acquired / optimistic lock conflict"
- Cause: `etag master` field not updated on each change.
- Fix: Ensure `LocalLastChangedAt` is updated in every MODIFY operation (use determination or managed auto-update).

### "Validation fires on unrelated fields"
- Fix: Specify precise trigger in BDEF: `on save { create; field BeginDate, EndDate; }` — only triggers when those fields change.

### "Action result is empty"
- Fix: After MODIFY in action, always READ ENTITIES to populate `result`. Managed framework doesn't auto-populate result.

---

## Output Format

For each RAP task, provide:
1. **Complete layered implementation**: CDS Interface View → BDEF → Behavior Impl → Projection View → Projection BDEF
2. **All relevant method bodies** with error handling via `failed`/`reported`
3. **Service Definition + Binding** setup instructions
4. **Test via EML** — provide sample ABAP console test class
5. **Version note** — flag any feature requiring specific ABAP release
