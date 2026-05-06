# ABAP Core Reference

Modern ABAP development patterns for S/4HANA (on-premise and cloud).
Covers modern syntax, ABAP SQL enhancements, exception handling, unit testing,
Clean ABAP principles, internal tables, ALV, BAdI/Enhancement Framework,
and authorization objects.

---

## Table of Contents

1. [Modern ABAP Syntax](#1-modern-abap-syntax)
2. [ABAP SQL — Modern Patterns](#2-abap-sql--modern-patterns)
3. [Exception Classes](#3-exception-classes)
4. [ABAP Unit Testing](#4-abap-unit-testing)
5. [Clean ABAP Principles](#5-clean-abap-principles)
6. [Internal Tables — Patterns & Performance](#6-internal-tables--patterns--performance)
7. [ALV with CL_SALV_TABLE](#7-alv-with-cl_salv_table)
8. [BAdI & Enhancement Framework](#8-badi--enhancement-framework)
9. [Authorization Objects & SU24](#9-authorization-objects--su24)
10. [ABAP Cloud Restrictions](#10-abap-cloud-restrictions)

---

## 1. Modern ABAP Syntax

### Inline Declarations

```abap
" Old style
DATA: lv_name TYPE string.
lv_name = 'Hello'.

" Modern — inline declaration
DATA(lv_name) = 'Hello'.

" In loops
LOOP AT lt_table INTO DATA(ls_row).
  " ls_row is declared inline
ENDLOOP.

" In SELECT
SELECT * FROM ztable INTO TABLE @DATA(lt_result).

" In function call result
DATA(lv_date) = cl_abap_context_info=>get_system_date( ).
```

### Constructor Expressions — VALUE #

```abap
" Fill structure
DATA(ls_travel) = VALUE ztravel(
  travel_id  = '00000001'
  agency_id  = '000001'
  begin_date = sy-datum ).

" Fill internal table
DATA(lt_travels) = VALUE ztravel_t(
  ( travel_id = '00000001'  agency_id = '000001' )
  ( travel_id = '00000002'  agency_id = '000002' ) ).

" Fill table from another table (FOR expression)
DATA(lt_ids) = VALUE string_table(
  FOR ls IN lt_travels ( ls-travel_id ) ).
```

### CORRESPONDING #

```abap
" Copy matching field names between structures
DATA(ls_target) = CORRESPONDING target_type( ls_source ).

" With field mapping
DATA(ls_out) = CORRESPONDING output_s(
  ls_input
  MAPPING target_field = source_field ).

" Deep CORRESPONDING (copies table components too)
result = CORRESPONDING #( DEEP lt_source ).
```

### COND # — Conditional Expression

```abap
DATA(lv_label) = COND string(
  WHEN ls_travel-overall_status = 'O' THEN 'Open'
  WHEN ls_travel-overall_status = 'A' THEN 'Accepted'
  WHEN ls_travel-overall_status = 'X' THEN 'Cancelled'
  ELSE 'Unknown' ).
```

### SWITCH # — Switch Expression

```abap
DATA(lv_color) = SWITCH string(
  ls_travel-overall_status
  WHEN 'O' THEN 'yellow'
  WHEN 'A' THEN 'green'
  WHEN 'X' THEN 'red'
  ELSE 'grey' ).
```

### REDUCE # — Aggregation Expression

```abap
" Sum
DATA(lv_total) = REDUCE decfloat34(
  INIT sum = CONV decfloat34( 0 )
  FOR  ls IN lt_bookings
  NEXT sum = sum + ls-flight_price ).

" Count matching
DATA(lv_count) = REDUCE i(
  INIT n = 0
  FOR  ls IN lt_travels
  WHERE ( overall_status = 'O' )
  NEXT n = n + 1 ).
```

### FILTER # — Inline Table Filter

```abap
" Filter table inline (requires sorted/hashed table or FREE addition)
DATA(lt_open) = FILTER #(
  lt_travels USING KEY primary_key
  WHERE overall_status = 'O' ).

" Without key (scans all — use for standard tables)
DATA(lt_open) = FILTER #(
  lt_travels
  WHERE overall_status = 'O' ).
```

### String Templates

```abap
DATA(lv_msg) = |Travel { ls_travel-travel_id } accepted by { sy-uname } on { sy-datum DATE = USER }|.

" Number formatting
DATA(lv_price) = |Amount: { lv_amount NUMBER = ENVIRONMENT } { lv_currency }|.

" Align / width
DATA(lv_padded) = |{ lv_id WIDTH = 10 ALIGN = RIGHT PAD = '0' }|.
```

### Mesh — Cross-Join Internal Tables

```abap
" Mesh joins two tables without DB roundtrip
DATA(lt_result) = VALUE output_t(
  FOR ls_header IN lt_headers
  FOR ls_item   IN lt_items
  WHERE ( ls_item-doc_id = ls_header-doc_id )
  ( doc_id    = ls_header-doc_id
    amount    = ls_item-amount
    company   = ls_header-company ) ).
```

---

## 2. ABAP SQL — Modern Patterns

### Common Table Expressions (CTE) — 7.54+

```abap
WITH
  +open_travels AS (
    SELECT travel_id, agency_id, booking_fee
    FROM   ztravel
    WHERE  overall_status = 'O'
  ),
  +bookings_agg AS (
    SELECT travel_id, SUM( flight_price ) AS total_flight
    FROM   zbooking
    GROUP BY travel_id
  )
SELECT t~travel_id,
       t~agency_id,
       t~booking_fee,
       b~total_flight,
       t~booking_fee + b~total_flight AS grand_total
  FROM +open_travels  AS t
  LEFT OUTER JOIN +bookings_agg AS b ON t~travel_id = b~travel_id
  INTO TABLE @DATA(lt_summary).
```

### Window Functions — 7.54+

```abap
SELECT travel_id,
       booking_fee,
       SUM( booking_fee ) OVER ( PARTITION BY agency_id ) AS agency_total,
       RANK( ) OVER ( PARTITION BY agency_id ORDER BY booking_fee DESC ) AS rank_in_agency
  FROM ztravel
  INTO TABLE @DATA(lt_ranked).
```

### CASE in SELECT

```abap
SELECT travel_id,
       CASE overall_status
         WHEN 'O' THEN 'Open'
         WHEN 'A' THEN 'Accepted'
         WHEN 'X' THEN 'Cancelled'
         ELSE 'Unknown'
       END AS status_text
  FROM ztravel
  INTO TABLE @DATA(lt_travels).
```

### COALESCE, NULLIF

```abap
SELECT travel_id,
       COALESCE( description, 'No description' ) AS description,
       NULLIF( cancel_reason, '' )                AS cancel_reason
  FROM ztravel
  INTO TABLE @DATA(lt_result).
```

### Host Variables & Expressions

```abap
DATA(lv_limit) = 100.
DATA(lv_date)  = sy-datum.

SELECT *
  FROM ztravel
  WHERE begin_date >= @lv_date
    AND booking_fee <= @( lv_limit * 2 )  -- inline expression
  ORDER BY begin_date
  INTO TABLE @DATA(lt_result).
```

### FOR ALL ENTRIES (carefully)

```abap
" Always check lt_keys is not empty before FOR ALL ENTRIES
IF lt_keys IS NOT INITIAL.
  SELECT *
    FROM ztravel
    FOR ALL ENTRIES IN @lt_keys
    WHERE travel_id = @lt_keys-travel_id
    INTO TABLE @DATA(lt_result).
ENDIF.
" Note: FOR ALL ENTRIES removes duplicates from result. Use JOIN or CTE instead
" when possible for better control.
```

### UPDATE / INSERT / DELETE with structures

```abap
" Update single record
UPDATE ztravel
  SET overall_status = 'A',
      last_changed_at = @( cl_abap_tstmp=>utclong2tstmp(
                              cl_abap_context_info=>get_system_time_utclong( ) ) )
  WHERE travel_id = @lv_id.

" Insert from internal table
INSERT ztravel FROM TABLE @lt_new_travels.

" Delete
DELETE FROM ztravel WHERE overall_status = 'X'
                    AND   end_date < @( sy-datum - 365 ).
```

---

## 3. Exception Classes

### Define Custom Exception Class

```abap
" In ADT: New → ABAP Class → Superclass: CX_STATIC_CHECK or CX_DYNAMIC_CHECK or CX_NO_CHECK
CLASS zcx_travel_error DEFINITION
  PUBLIC FINAL
  INHERITING FROM cx_static_check.

  PUBLIC SECTION.
    CONSTANTS:
      BEGIN OF travel_not_found,
        msgid TYPE symsgid VALUE 'Z_TRAVEL',
        msgno TYPE symsgno VALUE '001',
        attr1 TYPE scx_attrname VALUE 'TRAVEL_ID',
        attr2 TYPE scx_attrname VALUE '',
        attr3 TYPE scx_attrname VALUE '',
        attr4 TYPE scx_attrname VALUE '',
      END OF travel_not_found.

    DATA travel_id TYPE /dmo/travel_id READ-ONLY.

    METHODS constructor
      IMPORTING
        textid    LIKE if_t100_message=>t100key OPTIONAL
        previous  TYPE REF TO cx_root            OPTIONAL
        travel_id TYPE /dmo/travel_id            OPTIONAL.

ENDCLASS.

CLASS zcx_travel_error IMPLEMENTATION.
  METHOD constructor.
    CALL METHOD super->constructor(
      EXPORTING textid   = COND #( WHEN textid IS INITIAL THEN travel_not_found
                                   ELSE textid )
                previous = previous ).
    me->travel_id = travel_id.
  ENDMETHOD.
ENDCLASS.
```

### Exception Hierarchy

| Class | When to Use |
|---|---|
| `CX_STATIC_CHECK` | Caller MUST handle or re-declare (compile error otherwise) |
| `CX_DYNAMIC_CHECK` | Caller SHOULD handle; no compile error if not |
| `CX_NO_CHECK` | Runtime only — like program crash conditions |

**Rule of thumb**: Use `CX_STATIC_CHECK` for business errors, `CX_DYNAMIC_CHECK` for
programming errors, `CX_NO_CHECK` only for unrecoverable situations.

### Raising and Catching

```abap
" Raise
RAISE EXCEPTION TYPE zcx_travel_error
  EXPORTING
    textid    = zcx_travel_error=>travel_not_found
    travel_id = lv_travel_id.

" Raise with previous (exception chaining)
TRY.
    CALL FUNCTION 'SOME_FM' ... .
  CATCH cx_root INTO DATA(lx_prev).
    RAISE EXCEPTION TYPE zcx_travel_error
      EXPORTING previous = lx_prev.
ENDTRY.

" Catch specific
TRY.
    DATA(ls_travel) = zcl_travel_service=>get_travel( lv_id ).
  CATCH zcx_travel_error INTO DATA(lx_travel).
    MESSAGE lx_travel TYPE 'E'.
  CATCH cx_root INTO DATA(lx_any).
    " Catch-all safety net
    MESSAGE lx_any->get_text( ) TYPE 'E'.
ENDTRY.
```

---

## 4. ABAP Unit Testing

### Test Class Structure

```abap
CLASS zcl_test_travel_service DEFINITION
  PUBLIC FINAL
  FOR TESTING
  RISK LEVEL HARMLESS
  DURATION SHORT.

  PRIVATE SECTION.
    DATA: cut TYPE REF TO zcl_travel_service.   " Class Under Test

    METHODS:
      setup,          " runs before EACH test method
      teardown,       " runs after EACH test method
      test_get_open_travels FOR TESTING,
      test_reject_past_date FOR TESTING.

ENDCLASS.

CLASS zcl_test_travel_service IMPLEMENTATION.

  METHOD setup.
    cut = NEW zcl_travel_service( ).
  ENDMETHOD.

  METHOD teardown.
    ROLLBACK WORK.
  ENDMETHOD.

  METHOD test_get_open_travels.
    " Arrange
    " (use CDS test doubles or inject test data)

    " Act
    DATA(lt_result) = cut->get_open_travels( ).

    " Assert
    cl_abap_unit_assert=>assert_not_initial(
      act = lt_result
      msg = 'Should return at least one open travel' ).
  ENDMETHOD.

  METHOD test_reject_past_date.
    " Act + Assert exception
    TRY.
        cut->create_travel(
          begin_date = '19990101'
          end_date   = '20241231' ).

        cl_abap_unit_assert=>fail(
          msg = 'Should have raised exception for past date' ).

      CATCH zcx_travel_error INTO DATA(lx).
        cl_abap_unit_assert=>assert_equals(
          act = lx->travel_id
          exp = '' ).
    ENDTRY.
  ENDMETHOD.

ENDCLASS.
```

### Test Doubles (ABAP Test Seams)

```abap
" For interfaces: use cl_abap_testdouble
DATA(lo_mock) = CAST zif_travel_repository(
                  cl_abap_testdouble=>create( 'ZIF_TRAVEL_REPOSITORY' ) ).

" Configure mock behavior
cl_abap_testdouble=>configure_call( lo_mock )->returning(
  VALUE ztravel_t( ( travel_id = '00000001' ) ) ).

lo_mock->get_all( ).  " will return the configured data
```

### Assert Methods Reference

```abap
cl_abap_unit_assert=>assert_equals(    act = actual  exp = expected  msg = '...' ).
cl_abap_unit_assert=>assert_not_equals( act = a  exp = b ).
cl_abap_unit_assert=>assert_initial(   act = lv_var  msg = 'Should be empty' ).
cl_abap_unit_assert=>assert_not_initial( act = lv_var ).
cl_abap_unit_assert=>assert_true(      act = lv_bool ).
cl_abap_unit_assert=>assert_false(     act = lv_bool ).
cl_abap_unit_assert=>assert_bound(     act = lo_ref   msg = 'Ref should be bound' ).
cl_abap_unit_assert=>assert_not_bound( act = lo_ref ).
cl_abap_unit_assert=>fail(             msg = 'Should not reach this point' ).
cl_abap_unit_assert=>assert_subrc(     exp = 0 ).
```

---

## 5. Clean ABAP Principles

### Naming

```abap
" Bad: abbreviations, cryptic names
DATA lv_flpr TYPE decfloat34.

" Good: intent-revealing names
DATA flight_price TYPE decfloat34.

" Bad: type encoding in name (Hungarian notation)
DATA lv_str_name TYPE string.

" Good: just the name
DATA customer_name TYPE string.

" Methods: verb + noun
METHODS get_open_travels.
METHODS validate_booking_dates.
METHODS calculate_total_price.
```

### Methods

```abap
" Bad: mega method doing everything
METHOD process_travel.
  " 200 lines of mixed logic...
ENDMETHOD.

" Good: small, single-purpose methods
METHOD create_travel.
  validate_travel_data( is_travel ).
  assign_travel_number( CHANGING cs_travel ).
  persist_travel( is_travel ).
  notify_agency( is_travel-agency_id ).
ENDMETHOD.

" One level of abstraction per method
" Return early — avoid deep nesting
METHOD validate_dates.
  IF begin_date IS INITIAL.
    RAISE EXCEPTION TYPE zcx_travel_error.
  ENDIF.
  IF begin_date > end_date.
    RAISE EXCEPTION TYPE zcx_travel_error.
  ENDIF.
  " happy path — no ELSE needed
ENDMETHOD.
```

### No Global State

```abap
" Bad: class-data used as global state
CLASS-DATA gv_current_travel TYPE /dmo/travel_id.

" Good: pass data as parameters
METHODS process
  IMPORTING travel_id TYPE /dmo/travel_id.
```

### Comments

```abap
" Bad: comment restates code
" Increment counter by 1
counter += 1.

" Good: comment explains WHY (not WHAT)
" Agency fee is waived for premium customers per contract 2024-001
IF ls_customer-tier = 'PREMIUM'.
  booking_fee = 0.
ENDIF.
```

---

## 6. Internal Tables — Patterns & Performance

### Table Types

```abap
" Standard table — good for sequential access, few reads by key
DATA lt_standard TYPE STANDARD TABLE OF ztravel.

" Sorted table — binary search on sort key, no READ TABLE BINARY SEARCH needed
DATA lt_sorted TYPE SORTED TABLE OF ztravel
  WITH UNIQUE KEY travel_id.

" Hashed table — O(1) key access, best for large tables read by key
DATA lt_hashed TYPE HASHED TABLE OF ztravel
  WITH UNIQUE KEY travel_id.

" Secondary key on standard table — can add hash key for specific access patterns
DATA lt_with_secondary TYPE STANDARD TABLE OF ztravel
  WITH NON-UNIQUE KEY primary_key COMPONENTS travel_id
  WITH UNIQUE SORTED KEY by_agency COMPONENTS agency_id travel_id.
```

### READ TABLE Patterns

```abap
" Read with field symbol (no copy — best for large structures)
READ TABLE lt_hashed ASSIGNING FIELD-SYMBOL(<ls_travel>)
  WITH TABLE KEY travel_id = lv_id.

IF sy-subrc = 0.
  <ls_travel>-overall_status = 'A'.  " modifies table directly
ENDIF.

" Read with DATA (copy — use when you need independent copy)
READ TABLE lt_sorted INTO DATA(ls_travel)
  WITH TABLE KEY travel_id = lv_id.

" Read with binary search (standard table, must be sorted first)
SORT lt_standard BY travel_id.
READ TABLE lt_standard INTO DATA(ls_row)
  WITH KEY travel_id = lv_id
  BINARY SEARCH.

" Modern: table expression (raises CX_SY_ITAB_LINE_NOT_FOUND if not found)
TRY.
    DATA(ls_found) = lt_hashed[ travel_id = lv_id ].
  CATCH cx_sy_itab_line_not_found.
    " not found
ENDTRY.
```

### LOOP Performance

```abap
" Bad: modify inside loop (rebuilds table on each modify)
LOOP AT lt_table INTO DATA(ls_row).
  IF ls_row-status = 'O'.
    ls_row-status = 'A'.
    MODIFY lt_table FROM ls_row.  " expensive!
  ENDIF.
ENDLOOP.

" Good: use ASSIGNING to modify in-place
LOOP AT lt_table ASSIGNING FIELD-SYMBOL(<ls_row>).
  IF <ls_row>-status = 'O'.
    <ls_row>-status = 'A'.       " direct modification, no MODIFY needed
  ENDIF.
ENDLOOP.

" WHERE clause in LOOP (avoids processing non-matching rows)
LOOP AT lt_table ASSIGNING FIELD-SYMBOL(<ls>)
  WHERE status = 'O' AND agency_id = lv_agency.
  ...
ENDLOOP.
```

---

## 7. ALV with CL_SALV_TABLE

Modern ALV using CL_SALV_TABLE (no callbacks needed).

```abap
METHOD display_travels.
  DATA: lt_travels TYPE STANDARD TABLE OF ztravel,
        lo_alv     TYPE REF TO cl_salv_table.

  " Read data
  SELECT * FROM ztravel
    WHERE overall_status = 'O'
    INTO TABLE @lt_travels.

  " Create ALV instance
  TRY.
      cl_salv_table=>factory(
        IMPORTING r_salv_table = lo_alv
        CHANGING  t_table      = lt_travels ).
    CATCH cx_salv_msg INTO DATA(lx).
      MESSAGE lx TYPE 'E'.
      RETURN.
  ENDTRY.

  " Configure columns
  DATA(lo_columns) = lo_alv->get_columns( ).
  lo_columns->set_optimize( abap_true ).

  DATA(lo_col_status) = CAST cl_salv_column_table(
                           lo_columns->get_column( 'OVERALL_STATUS' ) ).
  lo_col_status->set_long_text( 'Status' ).
  lo_col_status->set_medium_text( 'Status' ).
  lo_col_status->set_short_text( 'Stat' ).

  " Set column invisible
  DATA(lo_col_client) = lo_columns->get_column( 'CLIENT' ).
  lo_col_client->set_visible( abap_false ).

  " Configure functions (toolbar)
  DATA(lo_functions) = lo_alv->get_functions( ).
  lo_functions->set_all( abap_true ).

  " Configure layout
  DATA(lo_layout) = lo_alv->get_layout( ).
  lo_layout->set_key( VALUE #( report = sy-repid ) ).
  lo_layout->set_save_restriction( if_salv_c_layout=>restrict_none ).

  " Configure display settings
  DATA(lo_display) = lo_alv->get_display_settings( ).
  lo_display->set_list_header( 'Open Travels' ).
  lo_display->set_striped_pattern( abap_true ).

  " Display
  lo_alv->display( ).
ENDMETHOD.
```

---

## 8. BAdI & Enhancement Framework

### Finding and Implementing a BAdI

```abap
" Step 1: Find BAdI in SPRO or SE18
" Step 2: Create Enhancement Implementation via SE19 or in ABAP package

" Step 3: Implement the BAdI interface
CLASS zcl_badi_travel_check DEFINITION
  PUBLIC FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_ex_travel_check.  " BAdI interface

ENDCLASS.

CLASS zcl_badi_travel_check IMPLEMENTATION.

  METHOD if_ex_travel_check~check_travel.
    " Custom validation logic
    IF is_travel-booking_fee > 9999.
      ev_error_message = 'Booking fee exceeds maximum allowed'.
      ev_error         = abap_true.
    ENDIF.
  ENDMETHOD.

ENDCLASS.
```

### Calling a BAdI in Your Code

```abap
METHOD check_travel_badi.
  DATA: lo_badi TYPE REF TO if_ex_travel_check.

  " Get BAdI instance
  TRY.
      GET BADI lo_badi
        FILTERS
          travel_type = is_travel-travel_type.

      " Call BAdI method
      CALL BADI lo_badi->check_travel
        EXPORTING is_travel       = is_travel
        IMPORTING ev_error        = DATA(lv_error)
                  ev_error_message = DATA(lv_msg).

    CATCH cx_badi_not_implemented.
      " No implementation active — normal, continue
  ENDTRY.

  IF lv_error = abap_true.
    RAISE EXCEPTION TYPE zcx_travel_error
      EXPORTING textid = VALUE #( msgid = 'Z_TRAVEL'  msgno = '002' ).
  ENDIF.
ENDMETHOD.
```

### Enhancement Spot Types

| Type | Purpose |
|---|---|
| Classic BAdI (`GET BADI / CALL BADI`) | Object-oriented exit, multi-use |
| Kernel BAdI | Called from kernel / standard code |
| Customer Function (`CALL CUSTOMER-FUNCTION`) | Legacy user exits |
| Source Code Plug-in | Inject code at enhancement spot |
| Pre/Post Enhancement | Before/after method execution |

---

## 9. Authorization Objects & SU24

### Define Custom Authorization Object (SU21)

```
Authorization Object: Z_TRAVEL
Fields:
  ACTVT   (Activity)        — standard, values: 01=Create 02=Change 03=Display 06=Delete
  BUKRS   (Company Code)    — custom range check
  Z_TTYPE (Travel Type)     — custom field
```

### Check Authorization in ABAP

```abap
METHOD check_travel_auth.
  " Check display authorization
  AUTHORITY-CHECK OBJECT 'Z_TRAVEL'
    ID 'ACTVT'   FIELD '03'          " 03 = Display
    ID 'BUKRS'   FIELD lv_company
    ID 'Z_TTYPE' FIELD ls_travel-travel_type.

  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE zcx_travel_error
      EXPORTING textid = zcx_travel_error=>not_authorized.
  ENDIF.
ENDMETHOD.

" Check without raising (returns sy-subrc)
AUTHORITY-CHECK OBJECT 'Z_TRAVEL'
  ID 'ACTVT' FIELD '02'
  ID 'BUKRS' DUMMY.         " DUMMY = field not relevant for this check
```

### SU24 — Assign Auth Objects to Transaction/Service

SU24 maintains the proposal values for authorization objects per transaction/RFC:

1. Call `SU24`
2. Enter program/transaction name or service
3. Add authorization objects with check indicator:
   - `Check` = always check
   - `Do not check (but suggest)` = optional
   - `Do not check` = suppressed

This feeds into role maintenance (PFCG) to auto-propose relevant auth objects.

### Standard Activity Values

| ACTVT | Meaning |
|---|---|
| `01` | Create |
| `02` | Change / Update |
| `03` | Display / Read |
| `06` | Delete |
| `07` | Activate |
| `08` | Display change documents |
| `16` | Execute |
| `23` | Maintain (combined create+change+delete) |

---

## 10. ABAP Cloud Restrictions

ABAP Cloud (BTP Steampunk / S/4HANA Cloud public edition) restricts usage to
released APIs only (Tier-1). Understanding the tiers:

| Tier | Description | Examples |
|---|---|---|
| Tier 1 (Released) | SAP-released, stable API | `CL_ABAP_CONTEXT_INFO`, `IF_OO_ADT_CLASSRUN` |
| Tier 2 (Partner) | Licensed partner use | Selected platform objects |
| Tier 3 (Custom) | Customer-created | Your own Z/Y objects |

### Restricted in ABAP Cloud

```abap
" NOT allowed in ABAP Cloud:
CALL FUNCTION 'RFC_READ_TABLE'.      -- use CDS view instead
WRITE: lv_text.                      -- no classic ABAP reports
SUBMIT report.                       -- no report submission
CALL TRANSACTION 'VA01'.             -- no transaction calls
AUTHORITY-CHECK OBJECT '...'.        -- use IAM instead
OPEN DATASET '...' FOR INPUT.        -- no direct file access
CALL FUNCTION 'ENQUEUE_...' .        -- use lock via RAP instead
SELECT * FROM dd02l.                 -- no DDIC tables (use released CDS)
```

### ABAP Cloud Alternatives

| Restricted | Cloud Alternative |
|---|---|
| `WRITE` / report output | `IF_OO_ADT_CLASSRUN~MAIN` for console |
| `AUTHORITY-CHECK` | RAP authorization / IAM (Identity & Access Management) |
| Direct DB table access | Released CDS views (`I_*`) |
| `CALL FUNCTION` (RFC) | Released classes / BAPIs with `USE IN CLOUD DEVELOPMENT` |
| File access | BTP Object Store / document management |
| `CL_ABAP_CHAR_UTILITIES` | `CL_ABAP_STRING_UTILITIES` |

### Check Released Status in ADT

Right-click on API → "Properties" → "API State" tab → shows `Released`, `Deprecated`, or `Not Released`.

Or in code: hover over the class/interface — ADT shows the release state inline.

---

## Version Compatibility Summary

| Feature | ABAP 7.40 | ABAP 7.50 | ABAP 7.54 | ABAP 7.57+ | ABAP Cloud |
|---|---|---|---|---|---|
| Inline declarations `DATA(x)` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `VALUE #` constructor | ✅ | ✅ | ✅ | ✅ | ✅ |
| `COND #` / `SWITCH #` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `FILTER #` | ✅ | ✅ | ✅ | ✅ | ✅ |
| String templates `\| \|` | ✅ | ✅ | ✅ | ✅ | ✅ |
| CTE (`WITH`) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Window functions | ❌ | ❌ | ✅ | ✅ | ✅ |
| `REDUCE #` | ❌ | ✅ | ✅ | ✅ | ✅ |
| Secondary table keys | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exception classes | ✅ | ✅ | ✅ | ✅ | ✅ |
| ABAP Unit | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CL_ABAP_TESTDOUBLE` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `CL_SALV_TABLE` | ✅ | ✅ | ✅ | ✅ | ❌ (no UI) |
| BAdI (`GET/CALL BADI`) | ✅ | ✅ | ✅ | ✅ | ⚠️ only released |
| `AUTHORITY-CHECK` | ✅ | ✅ | ✅ | ✅ | ❌ use IAM |
