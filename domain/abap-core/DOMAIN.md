# ABAP Core Domain — Router & Rules

## When to Read This File

Kích hoạt khi user đề cập đến bất kỳ từ khóa nào sau:

**Language & Syntax:** `ABAP`, `class`, `interface`, `method`, `DATA`, `TYPES`, `CONSTANTS`,
`FIELD-SYMBOL`, `ASSIGN`, `CAST`, `inline declaration`, `VALUE #`, `COND #`, `SWITCH #`,
`REDUCE #`, `FILTER #`, `CORRESPONDING #`, `LOOP AT`, `READ TABLE`, `SORT`, `COLLECT`,
`string template`, `constructor expression`, `NEW`, `REF #`, `table expression`

**SQL:** `SELECT`, `Open SQL`, `ABAP SQL`, `FOR ALL ENTRIES`, `CTE`, `WITH ... AS`,
`UNION`, `JOIN`, `GROUP BY`, `HAVING`, `OFFSET`, `FETCH NEXT`, `INTO @DATA`

**Error Handling:** `exception`, `cx_`, `cx_root`, `cx_static_check`, `cx_dynamic_check`,
`cx_no_check`, `RAISE EXCEPTION`, `TRY CATCH`, `CLEANUP`, `RESUMABLE`, `RAISE SHORTDUMP`

**Code Quality:** `clean ABAP`, `Clean Core`, `Hungarian notation`, `naming convention`,
`single responsibility`, `method length`, `ABAP Unit`, `test double`, `CUT`, `FOR TESTING`,
`RISK LEVEL`, `DURATION SHORT`, `cl_abap_unit_assert`

**Enhancement:** `BAdI`, `enhancement spot`, `enhancement point`, `GET BADI`, `CALL BADI`,
`SE18`, `SE19`, `kernel BAdI`, `filter BAdI`, `implicit enhancement`, `explicit enhancement`

**Released APIs & Cloud:** `released class`, `cl_abap_context_info`, `cl_system_uuid`,
`xco_cp`, `cl_bali_log`, `ABAP Cloud`, `ABAP for Cloud Development`, `forbidden keyword`,
`C1 release`, `C0 release`, `ATC`, `ABAP_CLOUD_READINESS`, `tier-1`, `tier-2`,
`COMMIT WORK forbidden`, `WRITE forbidden`, `released API`, `Steampunk`

---

## MANDATORY Rules cho Tất Cả ABAP Core Responses

### Rule R1 — Environment Check Bắt Buộc

Trước khi viết bất kỳ code nào, xác định môi trường:

```
ECC (≤ ABAP 7.52):
  ✅ Classic ABAP syntax đầy đủ
  ✅ WRITE, SUBMIT, CALL TRANSACTION, AUTHORITY-CHECK
  ✅ Unreleased Function Modules
  ❌ INTO @DATA(...), inline host expressions
  ❌ CTE (WITH...AS), Window functions
  ❌ cl_abap_testdouble (available từ 7.50 nhưng limited)

S/4HANA On-Premise 2020/21 (ABAP 7.54/7.56):
  ✅ Modern ABAP syntax đầy đủ (inline, VALUE, COND, REDUCE, FILTER)
  ✅ CTE, Window functions, INTO @DATA
  ✅ cl_abap_testdouble, EML Test Doubles (từ 7.56)
  ✅ Classic + Cloud syntax đều được
  ⚠️ ABAP Cloud restrictions chưa bắt buộc nhưng recommended

S/4HANA Cloud Public / BTP Steampunk:
  ✅ Modern ABAP syntax
  ✅ Released APIs (C1 contract) chỉ
  ✅ ABAP SQL với @host variables bắt buộc
  ❌ COMMIT WORK, ROLLBACK WORK → dùng COMMIT ENTITIES
  ❌ WRITE, SUBMIT, CALL TRANSACTION, CALL SCREEN
  ❌ AUTHORITY-CHECK → dùng IAM/RAP authorization
  ❌ SELECT * → ATC warning/error
  ❌ Unreleased FM/class
  ❌ Classic BAdI (SE18/SE19) → dùng Kernel BAdI với C1 release
  ❌ Direct DB INSERT/UPDATE/DELETE (ngoài RAP save sequence)
  ❌ OPEN DATASET (file I/O)
```

Nếu user không nói rõ môi trường → **hỏi ngay** trước khi trả lời.

---

### Rule R2 — Clean ABAP First

Áp dụng Clean ABAP principles mặc định trong mọi code example:

```
Naming (không phụ thuộc môi trường):
  ✅ Classes:   ZCL_ORDER_PROCESSOR (not ZCL_HELPER, ZCL_UTIL, ZCL_MANAGER)
  ✅ Methods:   get_travel( ), create_booking( ), validate_dates( )
  ✅ Variables: travel_id, travels, booking (not lv_travel_id, lt_tab, ls_struct)
  ⚠️ Exception: prefix lv_/lt_/ls_ vẫn phổ biến ở ECC/On-Prem — chấp nhận nếu codebase đang dùng
  ✅ Constants: MAX_TRAVEL_COUNT, STATUS_OPEN (ALL_CAPS SNAKE_CASE)
  ✅ Interfaces: ZIF_TRAVEL_PROCESSOR (not ZIF_INTF)

Methods:
  ✅ Single responsibility — 1 method làm 1 việc
  ✅ Max ~20 ABAP statements per method (guideline từ Clean ABAP)
  ✅ RETURNING cho 1 output thay EXPORTING khi có thể
  ✅ Tránh CHANGING nếu không thực sự cần mutate

Booleans:
  ✅ abap_true / abap_false (not 'X' / ' ')
  ✅ IF lv_flag = abap_true (not IF lv_flag = 'X')
  ✅ XSDBOOL( condition ) để convert condition → boolean

Comments:
  ✅ Comment = "tại sao" (why), không phải "cái gì" (what)
  ❌ Tránh commented-out code
  ❌ Tránh comment giải thích code rõ ràng (self-documenting code)
```

---

### Rule R3 — ABAP SQL Pushdown

Trước khi viết bất kỳ SELECT nào, kiểm tra:

```
1. SELECT * có không? → Thay bằng SELECT field1, field2, ...
2. SELECT nằm trong LOOP không? → N+1 problem → dùng FAE hoặc JOIN
3. FOR ALL ENTRIES IN có kiểm tra IS NOT INITIAL không? → Bắt buộc!
4. Có thể dùng CTE (WITH...AS) để đơn giản hóa subquery phức tạp không?
5. ORDER BY trên non-indexed field với data lớn không? → Thêm secondary index
6. Có thể đẩy logic xuống HANA bằng CASE/COALESCE trong SELECT không?
```

Pattern ưu tiên (từ tốt → kém):
```
1. JOIN trực tiếp trong SELECT (tốt nhất — 1 roundtrip)
2. FOR ALL ENTRIES IN (tốt cho lookup table lớn)
3. CTE WITH...AS (tốt cho phân tích dữ liệu phức tạp)
4. Subquery (cẩn thận với correlated subquery)
5. LOOP AT + SELECT SINGLE (tránh — N+1 problem)
```

---

### Rule R4 — Exception Handling Standards

```
Hierarchy rule:
  cx_static_check  → recoverable error, caller BẮT BUỘC handle (declare RAISING)
  cx_dynamic_check → programming error, RAISING optional (caller nên handle)
  cx_no_check      → fatal system error, KHÔNG declare trong RAISING

Custom exception rule (Z_ prefix):
  ZCX_BUSINESS_ERROR  → business rule violation (inherits cx_static_check)
  ZCX_VALIDATION_ERROR → input validation fail (inherits cx_static_check)
  ZCX_TECHNICAL_ERROR  → technical/system error (inherits cx_dynamic_check)

Pattern bắt buộc:
  ✅ RAISE EXCEPTION TYPE zcx_my_error (không bao giờ dùng cx_root trực tiếp)
  ✅ TRY...CATCH cx_specific (catch specific trước, parent sau)
  ✅ CATCH cx_root chỉ dùng ở boundary (top-level handler)
  ❌ CATCH cx_root rồi bỏ qua (empty CATCH block)
  ❌ RAISE EXCEPTION TYPE cx_root trực tiếp
```

---

### Rule R5 — Released API Check cho ABAP Cloud

Trước khi dùng bất kỳ class/FM/table nào trong ABAP Cloud context:

```
Checklist:
  1. Kiểm tra trong ADT: phải thấy "Released" contract C1 hoặc C2
  2. Không thấy release info → KHÔNG DÙNG, tìm alternative
  3. Dùng XCO library (xco_cp_*) khi có thể — đây là recommended Cloud API
  4. Kiểm tra ABAP Cheat Sheet 22: Released ABAP Classes
     https://github.com/SAP-samples/abap-cheat-sheets/blob/main/22_Released_ABAP_Classes.md

Tier concept:
  Tier-1 (ABAP Cloud): chỉ released APIs → release contract C1/C2
  Tier-2 (Standard ABAP): classic APIs OK, nhưng KHÔNG được gọi trực tiếp từ Tier-1
  Pattern: Tier-1 class → gọi Tier-2 wrapper class (C1 released interface) → Tier-2 logic
```

---

## Domain File Routing

| User hỏi về... | Đọc file |
|---|---|
| Modern syntax, inline decl, VALUE #, COND #, REDUCE, FILTER, CORRESPONDING | `references/modern-syntax.md` |
| Clean ABAP, naming, method design, boolean, comments, SOLID | `references/clean-abap.md` |
| SELECT, Open SQL, CTE, FAE, JOIN, GROUP BY, pagination, HANA functions | `references/abap-sql.md` |
| Exception class, cx_*, RAISE EXCEPTION, TRY/CATCH, resume | `references/exception-classes.md` |
| BAdI, enhancement spot, GET BADI, CALL BADI, implicit/explicit enhancement | `references/badi-enhancement.md` |
| Released class, cl_abap_context_info, cl_system_uuid, xco_cp, XCO library | `references/released-classes.md` |
| ABAP Cloud restriction, forbidden keyword, COMMIT WORK, WRITE, tier-1/2 | `references/cloud-restrictions.md` |
| ABAP Unit test, FOR TESTING, cl_abap_unit_assert, test double, CUT | `references/unit-testing.md` |

**Cross-domain routing:**
- ABAP + RAP → đọc `domain/rap/DOMAIN.md` thêm (EML, behavior implementation)
- ABAP + CDS → đọc `domain/cds/DOMAIN.md` thêm (annotation, VDM)
- Released classes trong RAP handler → đọc cả `references/released-classes.md` lẫn RAP domain

---

## Quick Anti-Pattern Guard

Scan trước khi trả lời code ABAP — flag ngay nếu phát hiện:

| Pattern Phát Hiện | Vi Phạm | Fix |
|---|---|---|
| `SELECT * FROM` | AP-ABAP-01 🔴 | Liệt kê field cần thiết |
| `FOR ALL ENTRIES` không có `IS NOT INITIAL` check | AP-ABAP-02 🔴 | Thêm `IF lt_keys IS NOT INITIAL` guard |
| `MODIFY lt_table FROM ls_row` trong LOOP | AP-ABAP-03 🟠 | Dùng `ASSIGNING FIELD-SYMBOL(<fs>)` |
| `COMMIT WORK` trong ABAP Cloud context | AP-CLOUD/RAP 🔴 | `COMMIT ENTITIES` (RAP) hoặc sai phase |
| `AUTHORITY-CHECK` trong ABAP Cloud | AP-CLOUD-02 🔴 | Dùng IAM / RAP authorization |
| `CALL FUNCTION` chưa verify C1 release | AP-CLOUD-03 🟠 | Kiểm tra release contract trong ADT |
| `WRITE:` statement trong Cloud context | AP-CLOUD-04 🟠 | `if_oo_adt_classrun~main` / `out->write` |
| `INSERT/UPDATE/DELETE` trực tiếp vào table trong Cloud | AP-CLOUD-05 🟠 | Dùng EML (MODIFY ENTITIES) |
| Hungarian notation `lv_`, `lt_`, `ls_` trong ABAP Cloud | AP-ABAP-05 🟡 | Intent-revealing names |
| Method dài >50 statements | AP-ABAP-06 🟡 | Tách thành single-responsibility methods |
| `IF lv_flag = 'X'` | Clean ABAP 🟡 | `IF lv_flag = abap_true` |
| `RAISE EXCEPTION TYPE cx_root` | R4 🟠 | Dùng cx_static_check/cx_dynamic_check subclass |
| `CATCH cx_root.` (empty / catch all) | R4 🟠 | Catch specific exception, log, re-raise |
| Classic BAdI `SE18/SE19` trong Cloud | R1 🔴 | Kernel BAdI với C1 release |
| `READ TABLE lt_tab WITH KEY` (linear search trên sorted table) | Perf 🟡 | Dùng table expression `lt_tab[ key = val ]` hoặc BINARY SEARCH |

---

## ABAP Core Lifecycle Visual

```
┌───────────────────────────────────────────────────────────────┐
│                    ABAP DEVELOPMENT FLOW                      │
│                                                               │
│  1. DESIGN                                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Define Interface (ZIF_*)                               │  │
│  │  → Declare methods with IMPORTING/RETURNING/RAISING     │  │
│  │  → Keep methods focused (single responsibility)         │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           ▼                                   │
│  2. IMPLEMENT                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ZCL_* implements ZIF_*                                 │  │
│  │  → Inline declarations (DATA(x) = ...)                  │  │
│  │  → Constructor expressions (VALUE #, COND #, REDUCE #)  │  │
│  │  → ABAP SQL pushdown (no SELECT inside LOOP)            │  │
│  │  → Exception classes (TRY / CATCH cx_* / ENDTRY)        │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           ▼                                   │
│  3. EXTEND (Enhancement Framework)                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Kernel BAdI (C1 released) ← ABAP Cloud                 │  │
│  │  Classic BAdI (SE18/SE19)  ← ECC/On-Prem only           │  │
│  │  Enhancement Spot          ← implicit/explicit points   │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           ▼                                   │
│  4. TEST                                                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ABAP Unit (FOR TESTING)                                │  │
│  │  → ltc_* test class (RISK LEVEL HARMLESS)               │  │
│  │  → GIVEN / WHEN / THEN pattern                          │  │
│  │  → Test doubles (CL_ABAP_TESTDOUBLE)                    │  │
│  │  → cl_abap_unit_assert=>assert_equals / assert_true     │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘

Exception Class Hierarchy:
  cx_root
    ├── cx_static_check   ← recoverable; RAISING bắt buộc
    │     └── ZCX_BUSINESS_ERROR, ZCX_VALIDATION_ERROR
    ├── cx_dynamic_check  ← programming error; RAISING optional
    │     └── ZCX_INVALID_PARAMETER
    └── cx_no_check       ← fatal; KHÔNG declare trong RAISING
          └── cx_sy_* (system exceptions)

ABAP SQL Pushdown Priority:
  HANA DB Layer  ←── Best: JOIN, CTE, CASE/COALESCE trong SELECT
       │
       ▼
  ABAP Buffer   ←── Internal table ops (VALUE, FILTER, REDUCE)
       │
       ▼
  ABAP Loop     ←── AVOID: SELECT inside LOOP = N+1 queries
```

---

## Code Skeleton Templates

### Template 1 — Clean ABAP Class với Interface

```abap
"! <p class="shorttext synchronized" lang="en">Travel Processor — processes travel requests</p>
CLASS zcl_travel_processor DEFINITION
  PUBLIC FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES zif_travel_processor.

  PRIVATE SECTION.
    DATA travel_repository TYPE REF TO zif_travel_repository.

    METHODS validate_travel
      IMPORTING travel        TYPE zs_travel_data
      RAISING   zcx_validation_error.

    METHODS calculate_price
      IMPORTING travel        TYPE zs_travel_data
      RETURNING VALUE(result) TYPE p LENGTH 10 DECIMALS 2.

ENDCLASS.

CLASS zcl_travel_processor IMPLEMENTATION.

  METHOD zif_travel_processor~create_travel.
    " Validate input
    validate_travel( travel ).

    " Calculate derived fields
    DATA(price) = calculate_price( travel ).

    " Persist via repository (not direct DB)
    result = travel_repository->save(
      VALUE zs_travel_data( BASE travel
        total_price = price
        status      = zcl_travel_constants=>status_open
      )
    ).
  ENDMETHOD.

  METHOD validate_travel.
    IF travel-begin_date IS INITIAL.
      RAISE EXCEPTION TYPE zcx_validation_error
        EXPORTING textid = zcx_validation_error=>begin_date_required.
    ENDIF.

    IF travel-end_date < travel-begin_date.
      RAISE EXCEPTION TYPE zcx_validation_error
        EXPORTING textid = zcx_validation_error=>end_date_before_begin.
    ENDIF.
  ENDMETHOD.

  METHOD calculate_price.
    " Single-responsibility: only price logic here
    result = travel-base_price * ( 1 + travel-surcharge_pct / 100 ).
  ENDMETHOD.

ENDCLASS.
```

---

### Template 2 — Modern ABAP SQL Patterns

```abap
" ✅ CTE với JOIN — complex query trong 1 roundtrip
WITH
  +bookings_summary AS (
    SELECT booking~travel_id,
           COUNT( * )          AS booking_count,
           SUM( booking~price ) AS total_price
      FROM zbooking AS booking
     GROUP BY booking~travel_id
  )
SELECT travel~travel_id,
       travel~agency_id,
       travel~begin_date,
       travel~end_date,
       bs~booking_count,
       bs~total_price
  FROM ztravel AS travel
  LEFT OUTER JOIN +bookings_summary AS bs
    ON bs~travel_id = travel~travel_id
 WHERE travel~status   = @status
   AND travel~begin_date >= @date_from
 ORDER BY travel~begin_date
  INTO TABLE @DATA(lt_result).

" ✅ FOR ALL ENTRIES — với mandatory IS NOT INITIAL guard
IF lt_travel_keys IS NOT INITIAL.
  SELECT travel_id, agency_id, status
    FROM ztravel
    FOR ALL ENTRIES IN @lt_travel_keys
    WHERE travel_id = @lt_travel_keys-travel_id
    INTO TABLE @DATA(lt_travels).
ENDIF.

" ✅ Pagination với OFFSET/FETCH
SELECT travel_id, agency_id, begin_date
  FROM ztravel
 ORDER BY begin_date DESCENDING
 OFFSET @lv_offset ROWS
 FETCH NEXT @lv_page_size ROWS ONLY
  INTO TABLE @DATA(lt_page).
```

---

### Template 3 — ABAP Unit Test (GIVEN / WHEN / THEN)

```abap
CLASS ltc_travel_processor DEFINITION FINAL FOR TESTING
  RISK LEVEL HARMLESS
  DURATION SHORT.

  PRIVATE SECTION.
    DATA cut TYPE REF TO zcl_travel_processor.  " Class Under Test
    DATA mock_repository TYPE REF TO cl_abap_testdouble.

    METHODS setup.         " runs before EACH test
    METHODS teardown.      " runs after EACH test

    METHODS valid_travel_creates_record     FOR TESTING.
    METHODS missing_begin_date_raises_error FOR TESTING.

ENDCLASS.

CLASS ltc_travel_processor IMPLEMENTATION.

  METHOD setup.
    " Create mock for repository dependency
    mock_repository = cl_abap_testdouble=>create(
                        'ZIF_TRAVEL_REPOSITORY' ).

    " Inject mock into CUT
    cut = NEW zcl_travel_processor(
      travel_repository = CAST zif_travel_repository( mock_repository )
    ).
  ENDMETHOD.

  METHOD teardown.
    CLEAR: cut, mock_repository.
  ENDMETHOD.

  METHOD valid_travel_creates_record.
    " GIVEN — valid travel data
    DATA(travel) = VALUE zs_travel_data(
      begin_date  = '20250101'
      end_date    = '20250110'
      agency_id   = 'AG001'
      base_price  = '1000.00'
    ).

    " Set up mock expectation
    cl_abap_testdouble=>configure_call( mock_repository
      )->returning( VALUE zs_travel_data( BASE travel travel_id = '000001' ) ).
    mock_repository->save( travel ).

    " WHEN — call method under test
    TRY.
        DATA(result) = cut->zif_travel_processor~create_travel( travel ).

        " THEN — verify result
        cl_abap_unit_assert=>assert_not_initial(
          act  = result-travel_id
          msg  = 'Travel ID should be assigned after creation' ).

      CATCH zcx_validation_error INTO DATA(lx_err).
        cl_abap_unit_assert=>fail(
          msg = |Unexpected error: { lx_err->get_text( ) }| ).
    ENDTRY.
  ENDMETHOD.

  METHOD missing_begin_date_raises_error.
    " GIVEN — travel with missing begin_date
    DATA(travel) = VALUE zs_travel_data(
      end_date   = '20250110'
      agency_id  = 'AG001'
      " begin_date intentionally left empty
    ).

    " WHEN / THEN — expect exception
    TRY.
        cut->zif_travel_processor~create_travel( travel ).
        cl_abap_unit_assert=>fail(
          msg = 'Expected zcx_validation_error to be raised' ).

      CATCH zcx_validation_error.
        " ✅ Expected — test passes
    ENDTRY.
  ENDMETHOD.

ENDCLASS.
```

---

## Sources

| Topic | URL |
|---|---|
| ABAP Keyword Documentation | https://help.sap.com/doc/abapdocu/latest/en-US/index.htm |
| ABAP Cheat Sheets (GitHub) | https://github.com/SAP-samples/abap-cheat-sheets |
| Clean ABAP Style Guide | https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md |
| Released ABAP Classes (Cheat Sheet 22) | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/22_Released_ABAP_Classes.md |
| ABAP for Cloud Development | https://help.sap.com/docs/abap-cloud/abap-concepts/abap-for-cloud-development |
| ABAP SQL (Open SQL) | https://help.sap.com/doc/abapdocu/latest/en-US/index.htm?file=abenabap_sql.htm |
| Exception Classes | https://help.sap.com/doc/abapdocu/latest/en-US/index.htm?file=abenexception_classes.htm |
| ABAP Unit Testing | https://help.sap.com/doc/abapdocu/latest/en-US/index.htm?file=abenabap_unit.htm |
| BAdI Concept | https://help.sap.com/docs/ABAP_PLATFORM_NEW/b5670aaaa2364a29935f40b16499972d/5cd7d1a6a4ad1b78e10000000a174cb4.html |
| Environment Matrix | `references/environment-matrix.md` (local) |
| Anti-Patterns Reference | `references/anti-patterns.md` (local) |