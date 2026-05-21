# RAP — Managed Scenario Reference

Complete guide for managed RAP: greenfield development where the RAP framework
owns the persistence layer.

> **When to use Managed RAP:**
> - New Z table exists or will be created
> - No legacy BAPI/FM involved in main persistence
> - Greenfield S/4HANA On-Prem or Cloud development
> - Start here: switch to unmanaged ONLY if framework genuinely blocks you
>
> Source: https://aixsap.com/abap-restful-application-programming-model-rap-a-senior-architects-practical-guide-to-building-modern-sap-applications/

---

## Table of Contents
1. [Managed vs Managed-with-Unmanaged-Save vs Additional Save](#1-managed-vs-managed-with-unmanaged-save-vs-additional-save)
2. [Complete Step-by-Step: Greenfield Managed BO](#2-complete-step-by-step-greenfield-managed-bo)
3. [Interface BDEF — Full Template](#3-interface-bdef--full-template)
4. [Projection BDEF — Full Template](#4-projection-bdef--full-template)
5. [Behavior Implementation Class Structure](#5-behavior-implementation-class-structure)
6. [Numbering Strategies](#6-numbering-strategies)
7. [Feature Control (Static & Instance)](#7-feature-control-static--instance)
8. [Admin Fields — Correct Pattern](#8-admin-fields--correct-pattern)
9. [Managed with Additional Save](#9-managed-with-additional-save)
10. [Managed with Unmanaged Save (BAPI Wrapper)](#10-managed-with-unmanaged-save-bapi-wrapper)
11. [Service Definition & Service Binding](#11-service-definition--service-binding)
12. [Common Mistakes Specific to Managed RAP](#12-common-mistakes-specific-to-managed-rap)

---

## 1. Managed vs Managed-with-Unmanaged-Save vs Additional Save

This is the most misunderstood distinction in RAP. Always confirm the correct type
before writing a single line of BDEF code.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  KEYWORD           │ BDEF syntax                   │ WHO owns persistence? │
├────────────────────┼───────────────────────────────┼───────────────────────┤
│ Managed            │ managed implementation in ... │ RAP framework (auto)  │
│ Managed +          │ managed with additional save  │ RAP framework (auto)  │
│  Additional Save   │   implementation in ...       │ + developer hooks     │
│ Managed +          │ managed with unmanaged save   │ Developer (fully)     │
│  Unmanaged Save    │   implementation in ...       │ RAP only owns buffer  │
│ Unmanaged          │ unmanaged implementation in...│ Developer (fully)     │
└────────────────────────────────────────────────────────────────────────────┘
```

### Decision flowchart

```
New development, have Z table?
  └─ YES → managed                        (framework saves to DB automatically)

Need to add audit log / change doc on top of framework save?
  └─ YES → managed with additional save   (framework saves first, then your hook)
                                           Use case: write to log table, send notification

Need to call BAPI/FM for the ACTUAL save (main table)?
  └─ YES → managed with unmanaged save    (you own save_modified entirely)
                                           Use case: wrap BAPI_MATERIAL_SAVEDATA etc.

Full legacy scenario, no Z table, complex multi-table?
  └─ YES → unmanaged                      (see references/unmanaged.md)
```

> ⚠️ **Most common mistake**: Using `managed with additional save` for BAPI wrapping.
> `additional save` = your BAPI runs AFTER framework already wrote to DB.
> This means framework writes half-correct data, then BAPI writes correct data → data inconsistency.
> Use `managed with unmanaged save` for BAPI scenarios.
>
> Source: https://community.sap.com/t5/technology-blog-posts-by-members/rap-managed-vs-unmanaged-rap/ba-p/14067526
> Source: https://github.com/attilaberencsi/abaprapunmanagedsave

---

## 2. Complete Step-by-Step: Greenfield Managed BO

Full creation sequence in ADT:

```
1. CREATE DB TABLE (SE11 / New DDIC table in ADT)
   → Include admin fields: created_by, created_at, last_changed_by,
     last_changed_at, local_last_changed_at (all TYPE utclong except syuname)
   → Include client field (mandt) if client-dependent
   → Define primary key

2. CREATE CDS INTERFACE VIEW (root + child if composition needed)
   → Right-click on package → New → Other → CDS View Entity
   → Add @AbapCatalog.viewEnhancementCategory: [#NONE]
   → Add @AccessControl.authorizationCheck: #CHECK (or #NOT_REQUIRED during dev)
   → Map all table fields with meaningful CamelCase aliases

3. CREATE BEHAVIOR DEFINITION (interface BDEF)
   → Right-click on root CDS view → New → Behavior Definition
   → Choose: managed
   → Edit: add strict(2), draft table, etag, lock, admin fields mapping

4. CREATE DRAFT TABLE
   → ADT: right-click BDEF → Generate Draft Table
   → Or: copy from template with DRAFTUUID raw(16) field added

5. CREATE CDS PROJECTION VIEW (root + child)
   → @Metadata.allowExtensions: true
   → provider contract transactional_query

6. CREATE PROJECTION BDEF
   → Right-click on projection CDS view → New → Behavior Definition
   → Keywords: projection; use draft;

7. CREATE SERVICE DEFINITION (SRVD)
   → Right-click on projection CDS view → New → Service Definition

8. CREATE SERVICE BINDING (SRVB)
   → Right-click on SRVD → New → Service Binding
   → Choose: OData V4 - UI (for Fiori) or OData V4 - Web API (for API)
   → Activate → Publish Local Service Endpoint
```

---

## 3. Interface BDEF — Full Template

```abap
managed implementation in class zbp_z_i_travel unique;
strict ( 2 );
with draft;

define behavior for Z_I_Travel alias Travel
  persistent table ztravel
  draft table ztravel_d
  etag master LocalLastChangedAt
  lock master total etag LastChangedAt
  authorization master ( global )
{
  " ── Field control ──────────────────────────────────────
  field ( readonly )          TravelId;
  field ( readonly : update,
          mandatory : create ) AgencyId;
  field ( mandatory : create ) BeginDate, EndDate;
  field ( readonly )           CreatedBy, CreatedAt,
                               LastChangedBy, LastChangedAt,
                               LocalLastChangedAt;

  " ── Standard operations ────────────────────────────────
  create;
  update;
  delete;

  " ── Composition (child entity) ─────────────────────────
  association _Booking { create; with draft; }

  " ── Actions ────────────────────────────────────────────
  action  ( features : instance ) acceptTravel
    result [1] $self;
  action  ( features : instance ) rejectTravel
    parameter Z_D_RejectTravel_Params
    result [1] $self;

  " Static action (no key needed)
  static action copyTemplate
    parameter Z_D_TravelTemplate
    result [1] $self;

  " ── Validations (on save) ──────────────────────────────
  validation validateDates       on save { create; field BeginDate, EndDate; }
  validation validateAgency      on save { create; field AgencyId; }
  validation validateStatus      on save { field OverallStatus; }

  " ── Determinations ─────────────────────────────────────
  determination setStatusOnCreate  on modify { create; }
  determination setAdminFields     on modify { create; update; }
  determination calculateTotalPrice on modify { create;
                                                field BookingFee, CurrencyCode; }

  " ── Side effects ───────────────────────────────────────
  side effects {
    field BookingFee   affects field TotalPrice;
    field CurrencyCode affects field TotalPrice;
    action acceptTravel affects field OverallStatus, field LastChangedAt;
  }

  " ── Mapping ─────────────────────────────────────────────
  " Use 'corresponding' only when CDS field names = DB column names exactly
  " Otherwise always use explicit mapping:
  mapping for ztravel
  {
    TravelId           = travel_id;
    AgencyId           = agency_id;
    BeginDate          = begin_date;
    EndDate            = end_date;
    BookingFee         = booking_fee;
    TotalPrice         = total_price;
    CurrencyCode       = currency_code;
    OverallStatus      = overall_status;
    Description        = description;
    CreatedBy          = created_by;
    CreatedAt          = created_at;
    LastChangedBy      = last_changed_by;
    LastChangedAt      = last_changed_at;
    LocalLastChangedAt = local_last_changed_at;
  }
}

" ── Child entity (composition) ──────────────────────────
define behavior for Z_I_Booking alias Booking
  persistent table zbooking
  draft table zbooking_d
  etag master LocalLastChangedAt
  lock dependent by _Travel
  authorization dependent by _Travel
{
  field ( readonly ) BookingId;
  field ( mandatory : create ) FlightId, FlightDate;

  update;
  delete;

  association _Travel { }

  determination setBookingNumber on modify { create; }

  mapping for zbooking
  {
    BookingId          = booking_id;
    TravelId           = travel_id;
    FlightId           = flight_id;
    FlightDate         = flight_date;
    LocalLastChangedAt = local_last_changed_at;
  }
}
```

> Source: https://help.sap.com/docs/abap-cloud/abap-rap/managed-scenario
> Source: https://github.com/SAP-samples/abap-platform-refscen-flight

---

## 4. Projection BDEF — Full Template

The Projection BDEF is **mandatory** — without it, no OData service can be exposed.
It acts as the service-layer contract on top of the interface BO.

```abap
projection;
strict ( 2 );
use draft;

define behavior for Z_C_Travel alias Travel
{
  use create ( augment );      " augment = enrich draft on create
  use update;
  use delete;

  " Reuse association with draft + create
  use association _Booking { create; with draft; }

  " Expose actions (use exact name from interface BDEF)
  use action acceptTravel;
  use action rejectTravel;
  use action copyTemplate;

  " Expose validations (must match interface BDEF)
  use validation validateDates;
  use validation validateAgency;

  " ── Feature control override (optional) ────────────────
  " use update ( features : instance );

  " ── Action alias for OData (optional) ──────────────────
  " use action acceptTravel as AcceptBooking;
}

define behavior for Z_C_Booking alias Booking
{
  use update;
  use delete;
  use association _Travel { }
}
```

> ⚠️ **Missing `use validation` in projection BDEF** is the #1 reason validations
> don't fire from the Fiori UI. Every validation in the interface BDEF must be
> explicitly re-declared with `use validation <name>` in the projection BDEF.
>
> Source: https://help.sap.com/docs/abap-cloud/abap-rap/validations

---

## 5. Behavior Implementation Class Structure

```abap
CLASS zbp_z_i_travel DEFINITION
  PUBLIC ABSTRACT FINAL
  FOR BEHAVIOR OF z_i_travel.
ENDCLASS.

CLASS zbp_z_i_travel IMPLEMENTATION.
ENDCLASS.
```

The real logic lives in **local handler classes** inside the behavior pool include:

```abap
" ── Local Handler Class (LHC) — Interaction Phase ──────────────────────────
CLASS lhc_travel DEFINITION
  INHERITING FROM cl_abap_behavior_handler.

  PRIVATE SECTION.
    " Actions
    METHODS acceptTravel
      FOR ACTION z_i_travel~acceptTravel
      RESULT et_result.

    METHODS rejectTravel
      FOR ACTION z_i_travel~rejectTravel
      IMPORTING it_action_rqs TYPE TABLE FOR ACTION IMPORT z_i_travel~rejectTravel
      RESULT et_result.

    " Validations
    METHODS validateDates
      FOR VALIDATE ON SAVE
      IMPORTING it_keys TYPE TABLE FOR VALIDATION z_i_travel~validateDates.

    METHODS validateAgency
      FOR VALIDATE ON SAVE
      IMPORTING it_keys TYPE TABLE FOR VALIDATION z_i_travel~validateAgency.

    " Determinations
    METHODS setStatusOnCreate
      FOR DETERMINE ON MODIFY
      IMPORTING it_keys TYPE TABLE FOR DETERMINATION z_i_travel~setStatusOnCreate.

    METHODS setAdminFields
      FOR DETERMINE ON MODIFY
      IMPORTING it_keys TYPE TABLE FOR DETERMINATION z_i_travel~setAdminFields.

    " Feature control (if used)
    METHODS get_instance_features
      FOR INSTANCE FEATURES
      IMPORTING it_keys    TYPE TABLE FOR INSTANCE FEATURES KEY z_i_travel
      RESULT    et_result  TYPE TABLE FOR INSTANCE FEATURES RESULT z_i_travel.

    " Augmentation (if used, projection BDEF: use create(augment))
    METHODS augment_create
      FOR AUGMENT FOR CREATE
      IMPORTING it_intention TYPE if_abap_behv=>tt_intention
                it_draft     TYPE if_abap_behv=>tt_draft_indicator
                entities     STRUCTURE FOR CREATE z_i_travel.

ENDCLASS.
```

---

## 6. Numbering Strategies

### Comparison Table

| Strategy | Key Type | When Assigned | Gap-free? | Use Case |
|---|---|---|---|---|
| **External** | Any | By consumer (UI user) | No | User enters document number manually |
| **Managed Early** | UUID raw(16) only | Interaction phase (auto by framework) | No | UUID-keyed entities, simplest setup |
| **Unmanaged Early** | Any | Interaction phase (by developer in FOR NUMBERING) | No | Semantic keys from number range in interaction phase |
| **Late** | Any | Save sequence (adjust_numbers) | ✅ Yes | Sequential document numbers (FI docs, SAP-style) |

> ⚠️ **Managed RAP does NOT support Late Numbering** — late numbering requires
> `managed with unmanaged save` or `unmanaged` because it runs in save_modified.
> Source: https://discoveringabap.com/2023/03/02/abap-restful-application-programming-24-external-numbering-and-managed-early-numbering/

### Managed Early Numbering (UUID — most common for pure managed)

```abap
" BDEF — key field must be TYPE raw(16)
managed implementation in class zbp_z_i_travel unique;
strict ( 2 );

define behavior for Z_I_Travel alias Travel
  persistent table ztravel
{
  " UUID key: RAP framework assigns automatically on CREATE
  field ( readonly ) TravelId;    " TYPE raw(16) in table

  create;
  update;
  delete;
  ...
}
```

### Unmanaged Early Numbering (Semantic Key from Number Range)

```abap
" BDEF
define behavior for Z_I_Travel alias Travel
  persistent table ztravel
  early numbering
{
  field ( readonly ) TravelId;
  create;
  ...
}

" Implementation
METHODS earlynumbering_create
  FOR NUMBERING
  IMPORTING entities FOR CREATE z_i_travel.

METHOD earlynumbering_create.
  DATA: lt_failed   TYPE TABLE FOR FAILED EARLY z_i_travel,
        lt_reported TYPE TABLE FOR REPORTED EARLY z_i_travel.

  LOOP AT entities ASSIGNING FIELD-SYMBOL(<entity>).
    " Assign number from number range
    TRY.
        DATA(lv_number) = cl_numberrange_runtime=>number_get(
                            nr_range_nr = '01'
                            object      = 'Z_TRAVEL' ).

        <entity>-TravelId = lv_number.

      CATCH cx_number_ranges INTO DATA(lx).
        APPEND VALUE #( %cid = <entity>-%cid
                        %key = <entity>-%key )
          TO failed-travel.
        APPEND VALUE #( %cid = <entity>-%cid
                        %key = <entity>-%key
                        %msg = lx )
          TO reported-travel.
    ENDTRY.
  ENDLOOP.
ENDMETHOD.
```

> ⚠️ **Early numbering gaps**: if validation fails after key assignment, gaps occur.
> Use late numbering if gap-free sequential keys are required.
> Source: https://community.sap.com/t5/technology-blog-posts-by-members/how-to-use-early-numbering-with-semantic-keys-rap-managed-bo/ba-p/13508499

---

## 7. Feature Control (Static & Instance)

Feature control enables/disables actions, create, update, delete dynamically.

### Static Feature Control (field-level, compile-time)

```abap
" BDEF — field readonly after create (cannot be changed once set)
field ( readonly : update ) AgencyId;
field ( mandatory : create ) AgencyId, BeginDate;

" Operation-level static restriction
create ( features : global );    " global feature control method
update ( features : instance );  " instance-level dynamic control
```

### Instance Feature Control (dynamic, per-record logic)

```abap
" BDEF
action ( features : instance ) acceptTravel result [1] $self;
update ( features : instance );

" Implementation — controls visibility per record state
METHOD get_instance_features.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( OverallStatus )
    WITH CORRESPONDING #( it_keys )
    RESULT DATA(lt_travels).

  et_result = VALUE #(
    FOR ls IN lt_travels
    LET lv_accepted = COND #( WHEN ls-OverallStatus = 'A'
                              THEN if_abap_behv=>fc-o-disabled
                              ELSE if_abap_behv=>fc-o-enabled )
    IN
    ( %tky                    = ls-%tky
      %action-acceptTravel    = lv_accepted
      %action-rejectTravel    = COND #( WHEN ls-OverallStatus = 'X'
                                        THEN if_abap_behv=>fc-o-disabled
                                        ELSE if_abap_behv=>fc-o-enabled )
      %update                 = COND #( WHEN ls-OverallStatus = 'A'
                                        THEN if_abap_behv=>fc-o-disabled
                                        ELSE if_abap_behv=>fc-o-enabled )
    ) ).
ENDMETHOD.
```

Feature control constants:
- `if_abap_behv=>fc-o-enabled`  → operation/action is enabled
- `if_abap_behv=>fc-o-disabled` → greyed out in Fiori, not callable via OData
- `if_abap_behv=>fc-f-mandatory` → field is mandatory
- `if_abap_behv=>fc-f-read-only` → field is read-only

> Source: https://help.sap.com/docs/abap-cloud/abap-rap/instance-feature-control

---

## 8. Admin Fields — Correct Pattern

### Issue with `%op-%create` (Previously Documented Wrong)

`%op-%create` is **NOT** available in `READ ENTITIES` result structures.
The correct way to detect create vs update in a determination is via `%is_draft`
and operation context passed to the determination's `it_keys`:

```abap
determination setAdminFields on modify { create; update; }

METHOD setAdminFields.
  DATA(lv_now)  = cl_abap_context_info=>get_system_time_utclong( ).
  DATA(lv_user) = cl_abap_context_info=>get_user_alias( ).

  " Identify which keys are from CREATE (not yet in DB → no created_at set)
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( TravelId CreatedAt )
    WITH CORRESPONDING #( it_keys )
    RESULT DATA(lt_travels).

  DATA lt_update TYPE TABLE FOR UPDATE z_i_travel\\travel.

  LOOP AT lt_travels INTO DATA(ls_travel).
    DATA(lv_is_create) = COND abap_bool(
      WHEN ls_travel-CreatedAt IS INITIAL THEN abap_true
      ELSE abap_false ).

    APPEND VALUE #(
      %tky               = ls_travel-%tky
      LocalLastChangedAt = lv_now
      LastChangedAt      = lv_now
      LastChangedBy      = lv_user
      CreatedBy          = COND #( WHEN lv_is_create = abap_true
                                   THEN lv_user )
      CreatedAt          = COND #( WHEN lv_is_create = abap_true
                                   THEN lv_now )
      %control-LocalLastChangedAt = if_abap_behv=>mk-on
      %control-LastChangedAt      = if_abap_behv=>mk-on
      %control-LastChangedBy      = if_abap_behv=>mk-on
      %control-CreatedBy          = COND #( WHEN lv_is_create = abap_true
                                            THEN if_abap_behv=>mk-on
                                            ELSE if_abap_behv=>mk-off )
      %control-CreatedAt          = COND #( WHEN lv_is_create = abap_true
                                            THEN if_abap_behv=>mk-on
                                            ELSE if_abap_behv=>mk-off )
    ) TO lt_update.
  ENDLOOP.

  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel UPDATE FROM lt_update
    REPORTED DATA(lt_reported).

  reported = CORRESPONDING #( DEEP lt_reported ).
ENDMETHOD.
```

> ⚠️ `%control` flags must be set explicitly — without them, fields are not updated
> even if values are assigned.
> Source: https://help.sap.com/docs/abap-cloud/abap-rap/managed-scenario

---

## 9. Managed with Additional Save

Use when: framework handles main persistence, but you need a **side-effect hook**
(write audit log, send notification, create change document) after the framework save.

```abap
" BDEF
managed with additional save
  implementation in class zbp_z_i_travel unique;
strict ( 2 );

define behavior for Z_I_Travel alias Travel
  persistent table ztravel
  draft table ztravel_d
  etag master LocalLastChangedAt
  lock master total etag LastChangedAt
{
  ...
}
```

```abap
" Local Saver Class — implement save_modified for additional logic
CLASS lsc_z_i_travel DEFINITION
  INHERITING FROM cl_abap_behavior_saver.

  PROTECTED SECTION.
    METHODS save_modified REDEFINITION.

ENDCLASS.

CLASS lsc_z_i_travel IMPLEMENTATION.

  METHOD save_modified.
    " Framework has already saved to DB at this point
    " Only add SIDE-EFFECT logic here (audit log, notification, etc.)

    " ✅ Correct use: write audit log
    IF update-travel IS NOT INITIAL.
      LOOP AT update-travel INTO DATA(ls_update).
        " Log changed fields to audit table
        INSERT ztravel_audit FROM VALUE #(
          travel_id  = ls_update-TravelId
          changed_by = sy-uname
          changed_at = cl_abap_context_info=>get_system_time_utclong( )
          " ... changed fields ...
        ).
      ENDLOOP.
    ENDIF.

    " ❌ WRONG use: do NOT call BAPI here for main entity save
    " Framework already wrote to ztravel → calling BAPI again = duplicate/conflict
  ENDMETHOD.

ENDCLASS.
```

> Source: https://www.scribd.com/document/810280885/Managed-Save-Sequence-Additional-and-Unmanage-Save

---

## 10. Managed with Unmanaged Save (BAPI Wrapper)

Use when: BAPI/FM handles the actual persistence of the main entity.
See `references/bapi-wrapper.md` for full BAPI wrapping patterns.

```abap
" BDEF — key difference: 'with unmanaged save'
managed with unmanaged save
  implementation in class zbp_z_i_travel unique;
strict ( 2 );
with draft;

define behavior for Z_I_Travel alias Travel
  " No 'persistent table' declaration here — BAPI owns the table
  draft table ztravel_d
  etag master LocalLastChangedAt
  lock master total etag LastChangedAt
  authorization master ( global )
{
  field ( readonly ) TravelId;
  create;
  update;
  delete;

  late numbering;    " Usually needed when BAPI assigns the final key

  validation validateDates on save { create; field BeginDate, EndDate; }
  determination setAdminFields on modify { create; update; }
}
```

```abap
" Saver class — developer owns ALL persistence
CLASS lsc_z_i_travel DEFINITION
  INHERITING FROM cl_abap_behavior_saver.

  PROTECTED SECTION.
    METHODS save_modified      REDEFINITION.
    METHODS adjust_numbers     REDEFINITION.   " for late numbering
    METHODS cleanup_finalize   REDEFINITION.

ENDCLASS.

CLASS lsc_z_i_travel IMPLEMENTATION.

  METHOD save_modified.
    " Handle CREATE
    LOOP AT create-travel INTO DATA(ls_create).
      " ── Call BAPI ─────────────────────────────────────────
      DATA(lt_return) = VALUE bapiret2_t( ).
      CALL FUNCTION 'BAPI_TRAVEL_CREATE'
        EXPORTING iv_travel_data = VALUE bapi_travel(
                    agency_id  = ls_create-AgencyId
                    begin_date = ls_create-BeginDate
                    end_date   = ls_create-EndDate )
        IMPORTING ev_travel_id  = ls_create-TravelId
        TABLES    return        = lt_return.

      " ── Always check RETURN table before commit! ──────────
      IF line_exists( lt_return[ type = 'E' ] ) OR
         line_exists( lt_return[ type = 'A' ] ).
        CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
        " Report error back to RAP framework
        APPEND VALUE #( %cid = ls_create-%cid )
          TO failed-travel.
        APPEND VALUE #(
          %cid = ls_create-%cid
          %msg = new_message(
                   id      = lt_return[ type = 'E' ]-id
                   number  = lt_return[ type = 'E' ]-number
                   severity = if_abap_behv_message=>severity-error ) )
          TO reported-travel.
        RETURN.
      ENDIF.
    ENDLOOP.

    " Handle UPDATE
    LOOP AT update-travel INTO DATA(ls_update).
      " Use %control to update only changed fields
      DATA(lt_return_u) = VALUE bapiret2_t( ).
      CALL FUNCTION 'BAPI_TRAVEL_CHANGE'
        EXPORTING
          iv_travel_id  = ls_update-TravelId
          iv_begin_date = COND #( WHEN ls_update-%control-BeginDate = if_abap_behv=>mk-on
                                  THEN ls_update-BeginDate )
        TABLES return = lt_return_u.

      IF line_exists( lt_return_u[ type = 'E' ] ) OR
         line_exists( lt_return_u[ type = 'A' ] ).
        CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
        RETURN.
      ENDIF.
    ENDLOOP.

    " Handle DELETE
    LOOP AT delete-travel INTO DATA(ls_delete).
      CALL FUNCTION 'BAPI_TRAVEL_DELETE'
        EXPORTING iv_travel_id = ls_delete-TravelId
        TABLES    return       = DATA(lt_return_d).

      IF line_exists( lt_return_d[ type = 'E' ] ).
        CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
        RETURN.
      ENDIF.
    ENDLOOP.

    " ── Commit ONCE at the end — not per record! ──────────
    CALL FUNCTION 'BAPI_TRANSACTION_COMMIT' EXPORTING wait = abap_true.
  ENDMETHOD.

  METHOD cleanup_finalize.
    " Called on rollback — always implement!
    CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
  ENDMETHOD.

ENDCLASS.
```

> Source: https://community.sap.com/t5/technology-blog-posts-by-members/rap-managed-vs-unmanaged-rap/ba-p/14067526
> Source: https://sachinartani.com/blog/using-bapis-in-sap-rap
> Source: https://github.com/attilaberencsi/abaprapunmanagedsave

---

## 11. Service Definition & Service Binding

```abap
" Service Definition (SRVD) — exposes projection CDS entities
@EndUserText.label: 'Travel Service'
define service Z_SD_TRAVEL {
  expose Z_C_Travel   as Travel;
  expose Z_C_Booking  as Booking;
}
```

Service Binding types — choose carefully:

| Binding Type | OData Version | Use For |
|---|---|---|
| `OData V4 - UI` | V4 | Fiori Elements apps |
| `OData V4 - Web API` | V4 | REST API consumption (CAP, external) |
| `OData V2 - UI` | V2 | Legacy Fiori apps (avoid for new dev) |
| `OData V2 - Web API` | V2 | Legacy integration |
| `InA - UI` | InA | SAP Analytics Cloud |

> ⚠️ Never use `@OData.publish: true` — deprecated since S/4HANA 1909.
> Always create explicit SRVD + SRVB objects.
>
> Source: https://help.sap.com/docs/abap-cloud/abap-rap/service-binding

---

## 12. Common Mistakes Specific to Managed RAP

| Mistake | Effect | Fix |
|---|---|---|
| `mapping for ztravel corresponding` when field names differ | Silent mapping failure — wrong data saved | Always use explicit field mapping |
| `managed with additional save` for BAPI main entity | Framework writes half-data, BAPI writes correct → conflict | Use `managed with unmanaged save` |
| Managed RAP with late numbering declaration | Syntax error — not supported | Use `managed with unmanaged save` for late numbering |
| Instance factory actions in pure managed | Not supported | Use unmanaged or managed with unmanaged save |
| Missing `use validation` in projection BDEF | Validation never fires from UI | Add `use validation <name>` in projection |
| Missing `use draft` in projection BDEF | Draft actions not exposed | Add `use draft` |
| `persistent table` declaration in `managed with unmanaged save` | Managed framework tries to persist to table — bypasses your BAPI | Remove `persistent table` from BDEF |
| BAPI_TRANSACTION_COMMIT called per record in loop | Multiple commits, breaks atomicity | Single commit AFTER all loop iterations |
| Not checking BAPI RETURN table before COMMIT | Silent data errors committed | Always check for type 'E' or 'A' before commit |

---

## Sources

| Topic | URL |
|---|---|
| RAP Managed Scenario | https://help.sap.com/docs/abap-cloud/abap-rap/managed-scenario |
| RAP Standard Operations | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_standard_operations.htm |
| RAP Late Numbering | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_late_numbering.htm |
| Instance Feature Control | https://help.sap.com/docs/abap-cloud/abap-rap/instance-feature-control |
| RAP Service Binding | https://help.sap.com/docs/abap-cloud/abap-rap/service-binding |
| BDL Cheat Sheet | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/36_RAP_Behavior_Definition_Language.md |
| EML Cheat Sheet | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/08_EML_ABAP_for_RAP.md |
| SFlight Reference App | https://github.com/SAP-samples/abap-platform-refscen-flight |
| RAP Workshops | https://github.com/SAP-samples/abap-platform-rap-workshops |
| Managed vs Unmanaged (Community) | https://community.sap.com/t5/technology-blog-posts-by-members/sap-clean-core-development-managed-vs-unmanaged-rap-business-objects/ba-p/14017960 |
| Managed with Unmanaged Save (GitHub) | https://github.com/attilaberencsi/abaprapunmanagedsave |
| Managed with Unmanaged Save (discoveringabap) | https://discoveringabap.com/2023/02/06/abap-restful-application-programming-model-17-managed-with-unmanaged-save/ |
| Early Numbering (semantic keys) | https://community.sap.com/t5/technology-blog-posts-by-members/how-to-use-early-numbering-with-semantic-keys-rap-managed-bo/ba-p/13508499 |
| Late Numbering blog | https://software-heroes.com/en/blog/abap-rap-numbering-en |
| BAPI in RAP | https://sachinartani.com/blog/using-bapis-in-sap-rap |
| BAPI Wrapper Tutorial (SAP) | https://developers.sap.com/tutorials/abap-s4hanacloud-purchasereq-integrate-wrapper.html |
| Types of BDEFs | https://sachinartani.com/blog/types-of-behavior-definitions-in-sap-rap |
| RAP Business Logic Deep Dive | https://aixsap.com/abap-rap-deep-dive-part-2-implementing-business-logic-validations-and-determinations-in-sap-s-4hana/ |