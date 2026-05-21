# RAP — Unmanaged Scenario Reference

Complete guide for unmanaged RAP: developer owns ALL CRUD operations,
transactional buffer management, and save sequence.

> **When to use Unmanaged RAP:**
> - Wrapping legacy BAPIs / FMs where RAP buffer alone is insufficient
> - Full multi-table complex persistence (no single Z table)
> - Calling external APIs as primary persistence layer
> - Consuming SAP standard RAP BO Interfaces (I_BankTP, etc.) via EML
> - Custom Entities exposing non-DB data (RFC, REST) — see `references/bapi-wrapper.md`
>
> ⚠️ **Do NOT default to unmanaged out of BOPF familiarity.**
> Start managed, switch only when framework genuinely blocks you.
> Source: https://aixsap.com/abap-restful-application-programming-model-rap-a-senior-architects-practical-guide-to-building-modern-sap-applications/

---

## Table of Contents
1. [Unmanaged vs Managed — Key Differences](#1-unmanaged-vs-managed--key-differences)
2. [BDEF — Full Unmanaged Template](#2-bdef--full-unmanaged-template)
3. [Save Sequence — All Methods Explained](#3-save-sequence--all-methods-explained)
4. [Handler Class (LHC) — All Methods](#4-handler-class-lhc--all-methods)
5. [Saver Class (LSC) — All Methods](#5-saver-class-lsc--all-methods)
6. [Transactional Buffer — Static Class Pattern](#6-transactional-buffer--static-class-pattern)
7. [FOR MODIFY — CREATE, UPDATE, DELETE](#7-for-modify--create-update-delete)
8. [FOR READ — Correct Pattern](#8-for-read--correct-pattern)
9. [FOR LOCK — Custom Lock Logic](#9-for-lock--custom-lock-logic)
10. [%control — Selective Field Update Pattern](#10-control--selective-field-update-pattern)
11. [Late Numbering in Unmanaged](#11-late-numbering-in-unmanaged)
12. [Consuming SAP Standard BO via EML (Modern BAPI replacement)](#12-consuming-sap-standard-bo-via-eml-modern-bapi-replacement)
13. [Common Mistakes Specific to Unmanaged RAP](#13-common-mistakes-specific-to-unmanaged-rap)

---

## 1. Unmanaged vs Managed — Key Differences

```
┌─────────────────────────────┬─────────────────────────────────────────────┐
│ Aspect                      │ Managed          │ Unmanaged                 │
├─────────────────────────────┼──────────────────┼───────────────────────────┤
│ CRUD persistence            │ Framework (auto) │ Developer (save_modified) │
│ Transactional buffer        │ Framework        │ Developer (static class)  │
│ READ handler                │ Not needed       │ Required (FOR READ)       │
│ LOCK handler                │ Not needed       │ Required (FOR LOCK)       │
│ MODIFY handler              │ Not needed       │ Required (FOR MODIFY)     │
│ finalize / check_before_save│ Optional         │ Implement all             │
│ save_modified               │ Not needed       │ Required                  │
│ cleanup / cleanup_finalize  │ Optional         │ Required (always!)        │
│ Late numbering              │ ❌ Not supported │ ✅ adjust_numbers         │
│ Instance factory actions    │ ❌              │ ✅                         │
│ Code volume                 │ Low              │ High (~3x more code)      │
└─────────────────────────────┴──────────────────┴───────────────────────────┘
```

> Source: https://community.sap.com/t5/technology-blog-posts-by-members/sap-clean-core-development-managed-vs-unmanaged-rap-business-objects/ba-p/14017960

---

## 2. BDEF — Full Unmanaged Template

```abap
unmanaged implementation in class zbp_z_i_travel unique;
strict ( 2 );
with draft;

define behavior for Z_I_Travel alias Travel
  draft table ztravel_d
  " No 'persistent table' — developer owns persistence in save_modified
  lock master unmanaged         " unmanaged lock = implement FOR LOCK yourself
  etag master LocalLastChangedAt
  " total etag required for strict(2) with draft:
  " lock master total etag LastChangedAt   ← use this if not unmanaged lock
  authorization master ( global )
  late numbering                " optional — assign key in adjust_numbers
{
  " ── Field control ─────────────────────────────────────
  field ( readonly )           TravelId;
  field ( mandatory : create ) AgencyId, BeginDate, EndDate;
  field ( readonly )           CreatedBy, CreatedAt,
                               LastChangedBy, LastChangedAt,
                               LocalLastChangedAt;

  " ── Standard operations ───────────────────────────────
  create;
  update;
  delete;

  " ── Composition ───────────────────────────────────────
  association _Booking { create; with draft; }

  " ── Actions ───────────────────────────────────────────
  action ( features : instance ) acceptTravel result [1] $self;

  " ── Validations ───────────────────────────────────────
  validation validateDates  on save { create; field BeginDate, EndDate; }
  validation validateAgency on save { create; field AgencyId; }

  " ── Determinations ────────────────────────────────────
  determination setStatusOnCreate on modify { create; }
  determination setAdminFields    on modify { create; update; }

  " ── Mapping ───────────────────────────────────────────
  " ALWAYS use explicit mapping in unmanaged — never 'corresponding'
  mapping for ztravel
  {
    TravelId           = travel_id;
    AgencyId           = agency_id;
    BeginDate          = begin_date;
    EndDate            = end_date;
    OverallStatus      = overall_status;
    CreatedBy          = created_by;
    CreatedAt          = created_at;
    LastChangedBy      = last_changed_by;
    LastChangedAt      = last_changed_at;
    LocalLastChangedAt = local_last_changed_at;
  }
}
```

---

## 3. Save Sequence — All Methods Explained

The complete save sequence for unmanaged RAP has 6 methods, each with a distinct responsibility:

```
COMMIT ENTITIES triggered (or user presses Save in Fiori)
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. FINALIZE                                                         │
│     Purpose: Final data derivations BEFORE validations              │
│     Use for: calculate totals, set default values, derive fields     │
│     Can write to transactional buffer via static class              │
│     ⚠️ Can be called multiple times in cross-BO scenarios           │
│     Source: help.sap.com → finalize RAP Saver Method                │
├─────────────────────────────────────────────────────────────────────┤
│  2. CHECK_BEFORE_SAVE                                                │
│     Purpose: Final business validations with full context           │
│     Use for: cross-entity checks, external system checks            │
│     Populate failed + reported to abort save                        │
│     ⚠️ If fails → cleanup_finalize called, save aborted            │
│     Source: help.sap.com → check_before_save RAP Saver Method       │
├─────────────────────────────────────────────────────────────────────┤
│  3. ADJUST_NUMBERS  (only if late numbering declared in BDEF)       │
│     Purpose: Assign final key values from number range              │
│     Called AFTER finalize and check_before_save                     │
│     Called BEFORE save_modified                                     │
│     Source: help.sap.com → late numbering                           │
├─────────────────────────────────────────────────────────────────────┤
│  4. SAVE_MODIFIED  (= save in pure unmanaged)                       │
│     Purpose: Actual persistence — DB INSERT/UPDATE/DELETE or BAPI   │
│     READ from static buffer here (buffer → DB)                     │
│     COMMIT handled by RAP framework — DO NOT call COMMIT WORK!      │
│     ⚠️ For BAPI: use BAPI_TRANSACTION_COMMIT here (exception below) │
├─────────────────────────────────────────────────────────────────────┤
│  5. CLEANUP                                                          │
│     Purpose: Clear static transactional buffer after successful save│
│     Always implement — memory leak without it!                      │
├─────────────────────────────────────────────────────────────────────┤
│  6. CLEANUP_FINALIZE                                                 │
│     Purpose: Clear buffer when FINALIZE or CHECK_BEFORE_SAVE fails  │
│     Called instead of save_modified on validation failure           │
│     Always implement — same cleanup logic as CLEANUP                │
└─────────────────────────────────────────────────────────────────────┘
```

> `cleanup_finalize` is called only if errors occur during `check_before_save` or `finalize`.
> `cleanup_finalize` clears the transactional buffer if the phase `finalize` or `check_before_save` fails.

> Source: https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abensaver_finalize.htm
> Source: https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abensaver_check_before_save.htm
> Source: https://discoveringabap.com/2023/04/02/abap-restful-application-programming-model-behavior-implementation-class/

---

## 4. Handler Class (LHC) — All Methods

```abap
" ── Behavior Pool global class (abstract, generated) ─────────────────────
CLASS zbp_z_i_travel DEFINITION
  PUBLIC ABSTRACT FINAL
  FOR BEHAVIOR OF z_i_travel.
ENDCLASS.
CLASS zbp_z_i_travel IMPLEMENTATION.
ENDCLASS.

" ── Local Handler Class (lhc_*) — Interaction Phase ──────────────────────
CLASS lhc_travel DEFINITION
  INHERITING FROM cl_abap_behavior_handler.

  PRIVATE SECTION.
    " Standard CRUD (FOR MODIFY — all in ONE method or separate)
    METHODS create
      FOR MODIFY
      IMPORTING entities FOR CREATE z_i_travel.

    METHODS update
      FOR MODIFY
      IMPORTING entities FOR UPDATE z_i_travel.

    METHODS delete
      FOR MODIFY
      IMPORTING keys FOR DELETE z_i_travel.

    " Read (mandatory in unmanaged — managed does not need this)
    METHODS read
      FOR READ
      IMPORTING keys FOR READ z_i_travel
      RESULT    result.

    " Lock (mandatory if 'lock master unmanaged' in BDEF)
    METHODS lock
      FOR LOCK
      IMPORTING keys FOR LOCK z_i_travel.

    " Create by Association (if composition with create)
    METHODS create_by_assoc_booking
      FOR MODIFY
      IMPORTING entities FOR CREATE z_i_travel\_Booking.

    " Read by Association
    METHODS rba_booking
      FOR READ
      IMPORTING keys_rba FOR READ z_i_travel\_Booking FULL result_requested
      RESULT    result
      LINK      association_links.

    " Actions
    METHODS accept_travel
      FOR ACTION z_i_travel~acceptTravel
      RESULT result.

    " Validations
    METHODS validate_dates
      FOR VALIDATE ON SAVE
      IMPORTING it_keys TYPE TABLE FOR VALIDATION z_i_travel~validateDates.

    " Determinations
    METHODS set_status_on_create
      FOR DETERMINE ON MODIFY
      IMPORTING it_keys TYPE TABLE FOR DETERMINATION z_i_travel~setStatusOnCreate.

    " Authorization
    METHODS get_global_authorizations
      FOR GLOBAL AUTHORIZATION
      IMPORTING REQUEST requested_authorizations FOR z_i_travel
      RESULT    result.

ENDCLASS.
```

---

## 5. Saver Class (LSC) — All Methods

```abap
" ── Local Saver Class (lsc_*) — Save Sequence ────────────────────────────
CLASS lsc_z_i_travel DEFINITION
  INHERITING FROM cl_abap_behavior_saver.

  PROTECTED SECTION.
    METHODS finalize          REDEFINITION.
    METHODS check_before_save REDEFINITION.
    METHODS adjust_numbers    REDEFINITION.  " only if late numbering in BDEF
    METHODS save_modified     REDEFINITION.  " = 'save' in pure unmanaged
    METHODS cleanup           REDEFINITION.
    METHODS cleanup_finalize  REDEFINITION.

ENDCLASS.

CLASS lsc_z_i_travel IMPLEMENTATION.

  METHOD finalize.
    " Final data derivation before validations
    " Example: calculate TotalPrice from all bookings
    DATA(lt_buffer) = lcl_travel_buffer=>get_buffer( ).

    LOOP AT lt_buffer-create ASSIGNING FIELD-SYMBOL(<ls_create>).
      " Derive fields using data already in static buffer
      <ls_create>-LocalLastChangedAt =
        cl_abap_context_info=>get_system_time_utclong( ).
    ENDLOOP.
  ENDMETHOD.

  METHOD check_before_save.
    " Final cross-entity or external validations
    " Example: check if agency is still active in external system
    DATA(lt_buffer) = lcl_travel_buffer=>get_buffer( ).

    LOOP AT lt_buffer-create INTO DATA(ls_create).
      " External validation
      IF zcl_agency_check=>is_active( ls_create-AgencyId ) = abap_false.
        APPEND VALUE #( %key-TravelId = ls_create-TravelId )
          TO failed-travel.
        APPEND VALUE #(
          %key-TravelId = ls_create-TravelId
          %msg = new_message_with_text(
                   severity = if_abap_behv_message=>severity-error
                   text     = 'Agency is no longer active' ) )
          TO reported-travel.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

  METHOD adjust_numbers.
    " Assign final key from number range (late numbering only)
    " Called AFTER finalize/check_before_save, BEFORE save_modified
    LOOP AT mapped-travel ASSIGNING FIELD-SYMBOL(<mapped>)
      WHERE TravelId IS INITIAL.

      TRY.
          DATA(lv_num) =
            cl_numberrange_runtime=>number_get(
              nr_range_nr = '01'
              object      = 'Z_TRAVEL'
              quantity    = 1 ).

          <mapped>-TravelId = lv_num.

        CATCH cx_number_ranges INTO DATA(lx).
          APPEND VALUE #( %cid      = <mapped>-%cid
                          %key      = <mapped>-%key
                          %is_draft = <mapped>-%is_draft )
            TO failed-travel.
          APPEND VALUE #(
            %cid = <mapped>-%cid
            %msg = lx )
            TO reported-travel.
      ENDTRY.
    ENDLOOP.
  ENDMETHOD.

  METHOD save_modified.
    " Actual DB persistence — read from static buffer
    DATA(ls_buffer) = lcl_travel_buffer=>get_buffer( ).

    " ── CREATE ──────────────────────────────────────────
    LOOP AT ls_buffer-create INTO DATA(ls_create).
      INSERT ztravel FROM VALUE #(
        client             = sy-mandt
        travel_id          = ls_create-TravelId
        agency_id          = ls_create-AgencyId
        begin_date         = ls_create-BeginDate
        end_date           = ls_create-EndDate
        overall_status     = ls_create-OverallStatus
        created_by         = ls_create-CreatedBy
        created_at         = ls_create-CreatedAt
        last_changed_by    = ls_create-LastChangedBy
        last_changed_at    = ls_create-LastChangedAt
        local_last_changed_at = ls_create-LocalLastChangedAt ).

      IF sy-subrc <> 0.
        APPEND VALUE #( %key-TravelId = ls_create-TravelId )
          TO failed-travel.
      ENDIF.
    ENDLOOP.

    " ── UPDATE (use %control to write only changed fields!) ──
    LOOP AT ls_buffer-update INTO DATA(ls_update).
      " Read existing record to preserve unchanged fields
      SELECT SINGLE * FROM ztravel
        WHERE client    = @sy-mandt
          AND travel_id = @ls_update-TravelId
        INTO @DATA(ls_existing).

      IF sy-subrc <> 0.
        APPEND VALUE #( %key-TravelId = ls_update-TravelId )
          TO failed-travel.
        CONTINUE.
      ENDIF.

      " Apply only changed fields via %control
      IF ls_update-%control-BeginDate = if_abap_behv=>mk-on.
        ls_existing-begin_date = ls_update-BeginDate.
      ENDIF.
      IF ls_update-%control-EndDate = if_abap_behv=>mk-on.
        ls_existing-end_date = ls_update-EndDate.
      ENDIF.
      IF ls_update-%control-OverallStatus = if_abap_behv=>mk-on.
        ls_existing-overall_status = ls_update-OverallStatus.
      ENDIF.
      ls_existing-last_changed_at       = ls_update-LastChangedAt.
      ls_existing-local_last_changed_at = ls_update-LocalLastChangedAt.
      ls_existing-last_changed_by       = ls_update-LastChangedBy.

      UPDATE ztravel FROM @ls_existing.
    ENDLOOP.

    " ── DELETE ──────────────────────────────────────────
    LOOP AT ls_buffer-delete INTO DATA(ls_delete).
      DELETE FROM ztravel
        WHERE client    = @sy-mandt
          AND travel_id = @ls_delete-TravelId.
    ENDLOOP.
  ENDMETHOD.

  METHOD cleanup.
    " Always implement — clear static buffer after successful save
    lcl_travel_buffer=>clear( ).
  ENDMETHOD.

  METHOD cleanup_finalize.
    " Always implement — clear buffer if finalize/check_before_save fails
    " Same cleanup logic as cleanup
    lcl_travel_buffer=>clear( ).
  ENDMETHOD.

ENDCLASS.
```

> The RAP framework automatically handles transaction commits in unmanaged RAP. Static classes are preferred over ABAP memory or SAP memory for sharing data between handler and saver.
> Source: https://www.indexit.org/sap-rap-unmanaged-implementation-sap-btp-abap-guide/

---

## 6. Transactional Buffer — Static Class Pattern

One of the most confusing topics for beginners is data transfer between the Behavior Handler class and Saver class. Since both are separate classes, local variables cannot directly pass from one class to another. Therefore, developers commonly use a static helper class.

```abap
" ── Static Buffer Class — in behavior pool include ───────────────────────
" Pattern: lcl_<entity>_buffer with static attributes and methods

CLASS lcl_travel_buffer DEFINITION.
  PUBLIC SECTION.
    " Buffer structure holds changes from interaction phase
    TYPES:
      BEGIN OF ty_buffer,
        create TYPE TABLE OF z_i_travel WITH EMPTY KEY,
        update TYPE TABLE OF z_i_travel WITH EMPTY KEY,
        delete TYPE TABLE OF z_i_travel WITH EMPTY KEY,
      END OF ty_buffer.

    " Static attribute — persists between handler and saver calls
    CLASS-DATA: ms_buffer TYPE ty_buffer.

    CLASS-METHODS:
      " Add records to buffer
      add_create IMPORTING is_travel TYPE z_i_travel,
      add_update IMPORTING is_travel TYPE z_i_travel,
      add_delete IMPORTING is_travel TYPE z_i_travel,

      " Read complete buffer (called from saver)
      get_buffer RETURNING VALUE(rs_buffer) TYPE ty_buffer,

      " Clear buffer (called from cleanup / cleanup_finalize)
      clear.

ENDCLASS.

CLASS lcl_travel_buffer IMPLEMENTATION.
  METHOD add_create.
    " Remove any existing entry for same key (idempotent)
    DELETE ms_buffer-create WHERE TravelId = is_travel-TravelId.
    APPEND is_travel TO ms_buffer-create.
  ENDMETHOD.

  METHOD add_update.
    " For updates: merge %control flags if same key updated twice
    READ TABLE ms_buffer-update
      ASSIGNING FIELD-SYMBOL(<existing>)
      WITH KEY TravelId = is_travel-TravelId.
    IF sy-subrc = 0.
      " Merge: later update wins per field
      IF is_travel-%control-BeginDate = if_abap_behv=>mk-on.
        <existing>-BeginDate           = is_travel-BeginDate.
        <existing>-%control-BeginDate  = if_abap_behv=>mk-on.
      ENDIF.
      " ... merge other fields ...
    ELSE.
      APPEND is_travel TO ms_buffer-update.
    ENDIF.
  ENDMETHOD.

  METHOD add_delete.
    " Delete supersedes any pending create/update
    DELETE ms_buffer-create WHERE TravelId = is_travel-TravelId.
    DELETE ms_buffer-update WHERE TravelId = is_travel-TravelId.
    APPEND is_travel TO ms_buffer-delete.
  ENDMETHOD.

  METHOD get_buffer.
    rs_buffer = ms_buffer.
  ENDMETHOD.

  METHOD clear.
    CLEAR ms_buffer.
  ENDMETHOD.
ENDCLASS.
```

> ⚠️ **Why static class and NOT ABAP memory (`EXPORT TO MEMORY`)?**
> Static class attributes live in the same program context — faster, type-safe,
> and cleared automatically when the program ends. ABAP memory crosses program
> boundaries and is harder to debug.
>
> Source: https://software-heroes.com/en/blog/abap-rap-unmanaged-local
> Source: https://community.sap.com/t5/technology-q-a/how-to-pass-data-from-handler-class-to-saver-class-abap-rap/qaq-p/12691671

---

## 7. FOR MODIFY — CREATE, UPDATE, DELETE

```abap
METHOD create.
  LOOP AT entities ASSIGNING FIELD-SYMBOL(<entity>).
    " Map incoming RAP entity to internal structure
    DATA(ls_travel) = VALUE z_i_travel(
      " %cid must be preserved for mapped response
      %cid           = <entity>-%cid
      TravelId       = <entity>-TravelId
      AgencyId       = <entity>-AgencyId
      BeginDate      = <entity>-BeginDate
      EndDate        = <entity>-EndDate
      OverallStatus  = 'O'                   " default
      CreatedBy      = cl_abap_context_info=>get_user_alias( )
      CreatedAt      = cl_abap_context_info=>get_system_time_utclong( )
      LastChangedBy  = cl_abap_context_info=>get_user_alias( )
      LastChangedAt  = cl_abap_context_info=>get_system_time_utclong( )
      LocalLastChangedAt = cl_abap_context_info=>get_system_time_utclong( ) ).

    " Add to static buffer (NOT to DB yet!)
    lcl_travel_buffer=>add_create( ls_travel ).

    " Report back the preliminary key mapping
    APPEND VALUE #(
      %cid      = <entity>-%cid
      TravelId  = ls_travel-TravelId
      %is_draft = <entity>-%is_draft
    ) TO mapped-travel.
  ENDLOOP.
ENDMETHOD.

METHOD update.
  LOOP AT entities ASSIGNING FIELD-SYMBOL(<entity>).
    " Pass %control along so save_modified knows what changed
    lcl_travel_buffer=>add_update( VALUE #(
      BASE <entity>
      TravelId        = <entity>-TravelId
      " %control is automatically part of the structure
    ) ).
  ENDLOOP.
ENDMETHOD.

METHOD delete.
  LOOP AT keys ASSIGNING FIELD-SYMBOL(<key>).
    lcl_travel_buffer=>add_delete( VALUE #(
      TravelId  = <key>-TravelId
      %is_draft = <key>-%is_draft ) ).
  ENDLOOP.
ENDMETHOD.
```

---

## 8. FOR READ — Correct Pattern

In unmanaged RAP, `FOR READ` is mandatory — the framework does NOT automatically
read from the DB in the interaction phase.

```abap
METHOD read.
  " Step 1: Try to read from static buffer first (in-flight changes)
  DATA(ls_buffer) = lcl_travel_buffer=>get_buffer( ).

  LOOP AT keys INTO DATA(ls_key).
    " Check if instance is in create buffer (not yet persisted)
    READ TABLE ls_buffer-create INTO DATA(ls_buffered)
      WITH KEY TravelId = ls_key-TravelId.

    IF sy-subrc = 0.
      " Return from buffer (has latest in-flight values)
      APPEND VALUE #(
        %tky      = ls_key-%tky
        TravelId  = ls_buffered-TravelId
        AgencyId  = ls_buffered-AgencyId
        BeginDate = ls_buffered-BeginDate
        EndDate   = ls_buffered-EndDate
        OverallStatus = ls_buffered-OverallStatus
      ) TO result.
    ELSE.
      " Read from DB for already-persisted records
      SELECT SINGLE *
        FROM ztravel
        WHERE travel_id = @ls_key-TravelId
        INTO @DATA(ls_db).

      IF sy-subrc = 0.
        APPEND VALUE #(
          %tky      = ls_key-%tky
          TravelId  = ls_db-travel_id
          AgencyId  = ls_db-agency_id
          BeginDate = ls_db-begin_date
          EndDate   = ls_db-end_date
          OverallStatus = ls_db-overall_status
        ) TO result.
      ELSE.
        APPEND VALUE #( %tky = ls_key-%tky ) TO failed-travel.
        APPEND VALUE #(
          %tky = ls_key-%tky
          %msg = new_message_with_text(
                   severity = if_abap_behv_message=>severity-error
                   text     = 'Travel record not found' ) )
          TO reported-travel.
      ENDIF.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

> ⚠️ **Most common READ mistake**: Only reading from DB, ignoring the static buffer.
> If user creates a record and immediately reads it (before save), the DB read returns nothing.
> Always check buffer first, then fall back to DB.

---

## 9. FOR LOCK — Custom Lock Logic

```abap
" BDEF: lock master unmanaged
METHOD lock.
  LOOP AT keys INTO DATA(ls_key).
    " Call SAP enqueue function for your table
    CALL FUNCTION 'ENQUEUE_EZ_TRAVEL'  " replace with your actual enqueue FM
      EXPORTING
        mode_ztravel = 'E'              " E = exclusive lock
        travel_id    = ls_key-TravelId
        _scope       = '2'              " scope: 2 = local (same program)
        _wait        = abap_false       " don't wait if locked
      EXCEPTIONS
        foreign_lock  = 1
        system_failure = 2
        OTHERS        = 3.

    IF sy-subrc <> 0.
      APPEND VALUE #( %tky = ls_key-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky = ls_key-%tky
        %msg = new_message_with_text(
                 severity = if_abap_behv_message=>severity-error
                 text     = |Travel { ls_key-TravelId } is locked by another user| )
      ) TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

> ⚠️ **Unmanaged lock dequeue issue**: The RAP framework does NOT automatically
> dequeue your custom locks. You must call `DEQUEUE_EZ_<OBJECT>` explicitly in
> `cleanup` and `cleanup_finalize`.
>
> Source: https://community.sap.com/t5/technology-q-a/abap-rap-lock-myself-issue-in-managed-with-unmanaged-save/qaq-p/13609449

---

## 10. %control — Selective Field Update Pattern

`%control` is a field-by-field indicator — only set fields should be updated.
**Critical for UPDATE in unmanaged save_modified** to avoid overwriting unchanged fields.

```abap
" In save_modified UPDATE — always read existing record, apply only changed fields
METHOD save_modified.
  LOOP AT ls_buffer-update INTO DATA(ls_upd).

    SELECT SINGLE * FROM ztravel
      WHERE travel_id = @ls_upd-TravelId
      INTO @DATA(ls_db).

    IF sy-subrc <> 0.
      APPEND VALUE #( %key-TravelId = ls_upd-TravelId ) TO failed-travel.
      CONTINUE.
    ENDIF.

    " Only write fields with mk-on flag
    " ✅ Safe: preserves unchanged fields
    IF ls_upd-%control-AgencyId       = if_abap_behv=>mk-on.
      ls_db-agency_id    = ls_upd-AgencyId.
    ENDIF.
    IF ls_upd-%control-BeginDate      = if_abap_behv=>mk-on.
      ls_db-begin_date   = ls_upd-BeginDate.
    ENDIF.
    IF ls_upd-%control-EndDate        = if_abap_behv=>mk-on.
      ls_db-end_date     = ls_upd-EndDate.
    ENDIF.
    IF ls_upd-%control-OverallStatus  = if_abap_behv=>mk-on.
      ls_db-overall_status = ls_upd-OverallStatus.
    ENDIF.

    " Admin fields always update on modify
    ls_db-last_changed_at       = ls_upd-LastChangedAt.
    ls_db-last_changed_by       = ls_upd-LastChangedBy.
    ls_db-local_last_changed_at = ls_upd-LocalLastChangedAt.

    UPDATE ztravel FROM @ls_db.

  ENDLOOP.
ENDMETHOD.
```

> By default, only the values of the key fields and changed fields are handed over to the `save_modified` method. The addition `with full data` can be used to hand over the full instance data — this spares an additional READ operation but increases payload size.
>
> `with full data` in BDEF:
> ```abap
> managed with unmanaged save with full data
>   implementation in class zbp_z_i_travel unique;
> ```
> Source: https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abenbdl_saving.htm

---

## 11. Late Numbering in Unmanaged

```abap
" BDEF — declare late numbering
unmanaged implementation in class zbp_z_i_travel unique;
strict ( 2 );

define behavior for Z_I_Travel alias Travel
  late numbering
{
  field ( readonly ) TravelId;
  create;
  ...
}

" Implementation in saver class
METHOD adjust_numbers.
  " Called after finalize/check_before_save, before save_modified
  " mapped-travel contains all instances that need a final key
  LOOP AT mapped-travel ASSIGNING FIELD-SYMBOL(<mapped>)
    WHERE TravelId IS INITIAL.

    TRY.
        DATA(lv_num) =
          cl_numberrange_runtime=>number_get(
            nr_range_nr = '01'
            object      = 'Z_TRAVEL'
            quantity    = 1 ).

        " Assign final key
        <mapped>-TravelId = lv_num.

        " Also update static buffer with final key
        " so that save_modified uses the correct key
        DATA(lv_cid) = <mapped>-%cid.
        MODIFY lcl_travel_buffer=>ms_buffer-create
          TRANSPORTING TravelId
          WHERE %cid = lv_cid.
        lcl_travel_buffer=>ms_buffer-create[ %cid = lv_cid ]-TravelId = lv_num.

      CATCH cx_number_ranges INTO DATA(lx).
        APPEND VALUE #( %cid = <mapped>-%cid ) TO failed-travel.
        APPEND VALUE #( %cid = <mapped>-%cid  %msg = lx ) TO reported-travel.
    ENDTRY.
  ENDLOOP.
ENDMETHOD.
```

> ⚠️ For draft-enabled late numbering: draft table MUST have `DRAFTUUID TYPE raw(16)` field.
> Source: https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_late_numbering.htm

---

## 12. Consuming SAP Standard BO via EML (Modern BAPI replacement)

To see a real example of how SAP implements unmanaged scenarios, explore the behavior definition `/DMO/I_TRAVEL_U`. It provides a complete unmanaged implementation of the Travel BO.

When your unmanaged RAP needs to call SAP standard data (banks, business partners, etc.),
use RAP BO Interfaces (released `I_*TP` objects) via EML instead of classic BAPIs:

```abap
" ✅ Modern approach — EML on released RAP BO Interface
" Example: create a bank entry via I_BankTP (replaces BAPI_BANK_CREATE)
METHOD create.
  LOOP AT entities ASSIGNING FIELD-SYMBOL(<entity>).

    " Call standard RAP BO interface via MODIFY ENTITIES
    MODIFY ENTITIES OF i_banktp
      ENTITY Bank
      CREATE FIELDS ( BankCountry BankInternalID BankName )
      WITH VALUE #( (
        %cid        = <entity>-%cid
        BankCountry = <entity>-BankCountry
        BankInternalID = <entity>-BankId
        BankName    = <entity>-BankName ) )
      MAPPED   DATA(lt_mapped)
      FAILED   DATA(lt_failed)
      REPORTED DATA(lt_reported).

    " Propagate failures to caller
    IF lt_failed IS NOT INITIAL.
      APPEND VALUE #( %cid = <entity>-%cid ) TO failed-travel.
      reported = CORRESPONDING #( DEEP lt_reported ).
    ELSE.
      " Map preliminary key from standard BO response
      APPEND VALUE #(
        %cid     = <entity>-%cid
        BankId   = lt_mapped-bank[ 1 ]-BankInternalID
      ) TO mapped-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

> ⚠️ When using EML on standard BO (`MODIFY ENTITIES OF i_banktp`):
> The standard BO handles its own save sequence — do NOT call
> `COMMIT ENTITIES` explicitly. The RAP LUW manages this automatically.
>
> Source: https://sachinartani.com/blog/sap-rap-unmanaged-scenario-with-eml
> Source: https://sachinartani.com/blog/how-rap-bo-interfaces-replace-bapis

---

## 13. Common Mistakes Specific to Unmanaged RAP

| Mistake | Effect | Fix |
|---|---|---|
| Not implementing `FOR READ` | OData GET returns empty — no data visible | Always implement read from buffer + DB fallback |
| Ignoring static buffer in `FOR READ` | Newly created records invisible before save | Read buffer first, then DB |
| `COMMIT WORK` in save_modified for direct DB ops | LUW conflict — framework owns commit | Remove COMMIT WORK; framework commits after save_modified |
| `BAPI_TRANSACTION_COMMIT` when calling standard RAP BO via EML | Double-commit | EML on I_*TP manages its own LUW; never add manual COMMIT |
| Not implementing `cleanup` + `cleanup_finalize` | Memory leak — static buffer never cleared | Always implement both, call `lcl_buffer=>clear( )` |
| Not clearing buffer in `cleanup_finalize` | Next request sees stale data from failed save | Same logic as `cleanup` |
| Forgetting to dequeue custom locks | Fiori record stays locked after session end | Call `DEQUEUE_EZ_<OBJ>` in `cleanup` and `cleanup_finalize` |
| `UPDATE ztravel` without reading existing record first | Overwrites unchanged fields with initial values | Always SELECT first, then apply %control flags |
| Not updating static buffer key after `adjust_numbers` | save_modified uses preliminary key → DB insert fails | Update static buffer with final key in adjust_numbers |
| Using `ABAP MEMORY` for buffer | Hard to debug, not type-safe, crosses program context | Use static class attribute |
| Not handling `%cid` in `mapped` response | Client loses track of preliminary → final key mapping | Always append %cid to mapped response |
| Missing `with full data` when BAPI needs all fields | save_modified gets only changed fields; BAPI needs all | Add `with full data` to BDEF or re-read from DB |

---

## Sources

| Topic | URL |
|---|---|
| RAP Unmanaged Scenario | https://help.sap.com/docs/abap-cloud/abap-rap/unmanaged-scenario |
| save_modified Method | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abaprap_saver_meth_save_modified.htm |
| finalize Method | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abensaver_finalize.htm |
| check_before_save Method | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abensaver_check_before_save.htm |
| BDL Saving Options (with full data) | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abenbdl_saving.htm |
| Late Numbering | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_late_numbering.htm |
| RAP Handler Methods Example | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenrap_handler_methods_abexa.htm |
| Behavior Implementation Class | https://discoveringabap.com/2023/04/02/abap-restful-application-programming-model-behavior-implementation-class/ |
| Managed with Unmanaged Save | https://discoveringabap.com/2023/02/06/abap-restful-application-programming-model-17-managed-with-unmanaged-save/ |
| Unmanaged Scenario (software-heroes) | https://software-heroes.com/en/blog/abap-rap-unmanaged-scenario |
| Static Buffer Pattern (software-heroes) | https://software-heroes.com/en/blog/abap-rap-unmanaged-local |
| Handler–Saver data transfer (SAP Community) | https://community.sap.com/t5/technology-q-a/how-to-pass-data-from-handler-class-to-saver-class-abap-rap/qaq-p/12691671 |
| Unmanaged RAP BTP guide | https://www.indexit.org/sap-rap-unmanaged-implementation-sap-btp-abap-guide/ |
| Unmanaged with EML (Sachin Artani) | https://sachinartani.com/blog/sap-rap-unmanaged-scenario-with-eml |
| RAP BO Interfaces replace BAPIs | https://sachinartani.com/blog/how-rap-bo-interfaces-replace-bapis |
| Unmanaged Lock issue | https://community.sap.com/t5/technology-q-a/abap-rap-lock-myself-issue-in-managed-with-unmanaged-save/qaq-p/13609449 |
| /DMO/I_TRAVEL_U reference | https://github.com/SAP-samples/abap-platform-refscen-flight |
| Managed vs Unmanaged comparison | https://community.sap.com/t5/technology-blog-posts-by-members/sap-clean-core-development-managed-vs-unmanaged-rap-business-objects/ba-p/14017960 |