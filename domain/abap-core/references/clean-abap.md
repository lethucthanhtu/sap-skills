# ABAP Core — Clean ABAP Principles

> **Đọc file này khi:** user hỏi về naming convention, cách đặt tên class/method/variable,
> method design, single responsibility, RETURNING vs EXPORTING, boolean best practice,
> comment style, dependency injection, table type selection, constants vs magic numbers,
> code readability, "clean code trong ABAP", hoặc khi review code ABAP cần cải thiện chất lượng.

> **Source gốc:** SAP Clean ABAP Style Guide — https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md
> File này tóm tắt các nguyên tắc quan trọng nhất kèm ví dụ ABAP thực tế.

---

## Table of Contents

1. [Naming — Classes, Interfaces, Methods](#1-naming--classes-interfaces-methods)
2. [Naming — Variables và Constants](#2-naming--variables-và-constants)
3. [Method Design](#3-method-design)
4. [Method Body — Size và Structure](#4-method-body--size-và-structure)
5. [Boolean Best Practices](#5-boolean-best-practices)
6. [Conditions và Control Flow](#6-conditions-và-control-flow)
7. [Object-Oriented Design](#7-object-oriented-design)
8. [Table Type Selection](#8-table-type-selection)
9. [Comments](#9-comments)
10. [Tooling — ATC, code pal, ABAP Cleaner](#10-tooling--atc-code-pal-abap-cleaner)
11. [Anti-Patterns](#11-anti-patterns)
12. [Sources](#12-sources)

---

## 1. Naming — Classes, Interfaces, Methods

### Nguyên tắc cốt lõi: tên phải self-documenting

```abap
" ✅ Classes — NOUN, mô tả thực thể hoặc trách nhiệm
CLASS zcl_travel_validator    DEFINITION ...  " validates travel data
CLASS zcl_booking_factory     DEFINITION ...  " creates booking instances
CLASS zcl_price_calculator    DEFINITION ...  " calculates prices
CLASS zcl_travel_repository   DEFINITION ...  " data access for travel

" ❌ Tên mơ hồ / generic — TUYỆT ĐỐI TRÁNH
CLASS zcl_helper      DEFINITION ...   " helper of WHAT?
CLASS zcl_utility     DEFINITION ...   " utility for WHAT?
CLASS zcl_manager     DEFINITION ...   " manages WHAT?
CLASS zcl_handler     DEFINITION ...   " handles WHAT?
CLASS zcl_travel_impl DEFINITION ...   " impl of WHAT? use interface name
CLASS zcl_utils_cl    DEFINITION ...   " redundant suffix
```

```abap
" ✅ Interfaces — ZIF_ prefix, NOUN hoặc noun phrase
INTERFACE zif_travel_processor  ...  " processes travel
INTERFACE zif_price_provider    ...  " provides prices
INTERFACE zif_travel_repository ...  " repository contract

" ❌ Tên interface không nói lên contract
INTERFACE zif_travel_intf  ...   " 'intf' là suffix vô nghĩa
INTERFACE zif_i_travel     ...   " 'i_' redundant với ZIF_
```

```abap
" ✅ Methods — VERB PHRASE, mô tả hành động
METHODS get_travel_by_id
  IMPORTING travel_id TYPE /dmo/travel_id
  RETURNING VALUE(result) TYPE zs_travel.

METHODS create_booking
  IMPORTING booking TYPE zs_booking_input
  RAISING   zcx_booking_creation_error.

METHODS validate_dates
  IMPORTING travel TYPE zs_travel
  RAISING   zcx_validation_error.

METHODS is_travel_overdue                   " boolean method: IS_ prefix
  IMPORTING travel TYPE zs_travel
  RETURNING VALUE(result) TYPE abap_bool.

METHODS has_open_bookings                   " boolean method: HAS_ prefix
  IMPORTING travel_id TYPE /dmo/travel_id
  RETURNING VALUE(result) TYPE abap_bool.

" ❌ Method tên không rõ hành động
METHODS travel_data( ).    " get? validate? process?
METHODS do_it( ).          " do WHAT?
METHODS process( ).        " process HOW? process WHAT?
METHODS execute( ).        " same problem
```

### snake_case xuyên suốt

```abap
" ✅ ABAP convention: snake_case cho tất cả identifier
DATA travel_id        TYPE /dmo/travel_id.
DATA total_price      TYPE p LENGTH 10 DECIMALS 2.
DATA open_travels     TYPE TABLE OF zs_travel.
CONSTANTS max_retries TYPE i VALUE 3.

" ❌ camelCase hoặc PascalCase — không phải ABAP convention
DATA travelId         TYPE /dmo/travel_id.   " JavaScript style
DATA TotalPrice       TYPE p.                 " Pascal — confusing
CONSTANTS MaxRetries  TYPE i VALUE 3.         " not convention
```

---

## 2. Naming — Variables và Constants

### Không Hungarian notation trong modern ABAP

```abap
" ✅ Clean ABAP — intent-revealing names
DATA travel_id      TYPE /dmo/travel_id.
DATA travels        TYPE TABLE OF zs_travel.
DATA current_travel TYPE zs_travel.
DATA price          TYPE p LENGTH 10 DECIMALS 2.

" ⚠️ Hungarian notation (lv_/lt_/ls_) — vẫn phổ biến và accepted ở ECC/On-Prem
" Nhưng Clean ABAP guideline và ABAP Cloud khuyến nghị không dùng
DATA lv_travel_id   TYPE /dmo/travel_id.   " lv_ = local variable
DATA lt_travels     TYPE TABLE OF zs_travel. " lt_ = local table
DATA ls_travel      TYPE zs_travel.         " ls_ = local structure

" ✅ ABAP Cloud / strict Clean ABAP: drop the prefix
DATA travel_id      TYPE /dmo/travel_id.
DATA travels        TYPE TABLE OF zs_travel.
DATA travel         TYPE zs_travel.
```

> **Lập trường thực tế:** Nếu codebase đang dùng Hungarian notation (lv_/lt_/ls_),
> hãy **nhất quán** trong cả codebase — đừng trộn lẫn. Với ABAP Cloud / new projects:
> không dùng prefix theo Clean ABAP guideline.

### Constants — không magic numbers

```abap
" ✅ Named constants — ALL_CAPS SNAKE_CASE
CONSTANTS:
  status_open      TYPE c LENGTH 1 VALUE 'O',
  status_accepted  TYPE c LENGTH 1 VALUE 'A',
  status_cancelled TYPE c LENGTH 1 VALUE 'X',
  max_booking_qty  TYPE i VALUE 9,
  default_currency TYPE /dmo/currency_code VALUE 'EUR'.

" ✅ Constants class — nhóm related constants
CLASS zcl_travel_status DEFINITION PUBLIC FINAL CREATE PRIVATE.
  PUBLIC SECTION.
    CONSTANTS:
      open      TYPE /dmo/overall_status VALUE 'O',
      accepted  TYPE /dmo/overall_status VALUE 'A',
      cancelled TYPE /dmo/overall_status VALUE 'X'.
ENDCLASS.

" ✅ Sử dụng
IF ls_travel-status = zcl_travel_status=>open.
  ...
ENDIF.

" ❌ Magic literals — không ai biết 'O' nghĩa là gì
IF ls_travel-status = 'O'.   " 'O' = Open? Offline? Other?
IF lv_qty > 9.               " 9 = max booking? random?
IF lv_currency = 'EUR'.      " hardcoded currency
```

### Plural cho tables, singular cho structures

```abap
" ✅ Plural = table, singular = structure/row
DATA travels        TYPE TABLE OF zs_travel.      " table → plural
DATA travel         TYPE zs_travel.               " structure → singular
DATA bookings       TYPE TABLE OF zs_booking.     " table
DATA booking        TYPE zs_booking.              " structure

" ✅ Inline declarations — tên rõ ràng ngay cả khi ngắn
LOOP AT travels INTO DATA(travel).
  DATA(booking_count) = get_booking_count( travel-travel_id ).
ENDLOOP.
```

---

## 3. Method Design

### RETURNING > EXPORTING (với 1 output value)

```abap
" ✅ RETURNING — cleaner, enables method chaining, inline usage
METHODS get_travel
  IMPORTING travel_id     TYPE /dmo/travel_id
  RETURNING VALUE(result) TYPE zs_travel
  RAISING   zcx_not_found.

" Usage: clean inline
DATA(travel) = get_travel( lv_id ).
IF get_travel( lv_id )-status = zcl_travel_status=>open. ...

" ✅ EXPORTING — dùng khi có nhiều output values liên quan nhau
METHODS calculate_price_breakdown
  IMPORTING travel         TYPE zs_travel
  EXPORTING base_price     TYPE p
            surcharge      TYPE p
            tax_amount     TYPE p
            total_price    TYPE p.

" ❌ EXPORTING khi chỉ có 1 output — verbose, không chain được
METHODS get_travel
  IMPORTING travel_id      TYPE /dmo/travel_id
  EXPORTING result         TYPE zs_travel.   " → dùng RETURNING thay
```

### Giới hạn số IMPORTING parameters

```abap
" ✅ Ít hơn 3 parameters — Clean ABAP recommendation
METHODS create_booking
  IMPORTING
    travel_id   TYPE /dmo/travel_id
    flight_date TYPE /dmo/begin_date
  RETURNING VALUE(result) TYPE zs_booking.

" ✅ Nếu cần nhiều params: nhóm vào structure
METHODS create_travel
  IMPORTING
    travel_data TYPE zs_travel_input   " group related params
  RETURNING VALUE(result) TYPE zs_travel.

" ❌ Quá nhiều params — hard to call, easy to mistake order
METHODS create_travel
  IMPORTING
    agency_id   TYPE /dmo/agency_id
    begin_date  TYPE /dmo/begin_date
    end_date    TYPE /dmo/end_date
    currency    TYPE /dmo/currency_code
    description TYPE /dmo/description
    status      TYPE /dmo/overall_status
  RETURNING VALUE(result) TYPE zs_travel.
```

### Tránh OPTIONAL parameters — tách thành method riêng

```abap
" ❌ OPTIONAL parameters che giấu multiple responsibilities
METHODS process_travel
  IMPORTING
    travel        TYPE zs_travel
    send_email    TYPE abap_bool OPTIONAL   " method làm 2 việc!
    notify_agency TYPE abap_bool OPTIONAL.  " + thêm 1 việc nữa

" ✅ Tách thành methods riêng, mỗi method 1 việc
METHODS process_travel
  IMPORTING travel TYPE zs_travel.

METHODS send_confirmation_email
  IMPORTING travel_id TYPE /dmo/travel_id.

METHODS notify_agency
  IMPORTING travel TYPE zs_travel.
```

### Tránh boolean IMPORTING parameters (SRP signal)

```abap
" ❌ Boolean input param = dấu hiệu method đang làm 2 việc
METHODS save_travel
  IMPORTING
    travel   TYPE zs_travel
    validate TYPE abap_bool.   " ← method làm cả validate lẫn save?

" ✅ Tách validate ra riêng
METHODS validate_travel
  IMPORTING travel TYPE zs_travel
  RAISING   zcx_validation_error.

METHODS save_travel
  IMPORTING travel TYPE zs_travel.
```

### CHANGING — dùng cẩn thận, chỉ khi thực sự mutate

```abap
" ✅ CHANGING — khi method thực sự modify input object
METHODS enrich_with_agency_data
  CHANGING travel TYPE zs_travel.   " adds agency_name to existing structure

" ❌ CHANGING khi có thể dùng RETURNING
METHODS get_travel
  CHANGING result TYPE zs_travel.   " → dùng RETURNING VALUE(result)
```

---

## 4. Method Body — Size và Structure

### Keep methods small: < 20 statements (guideline)

```abap
" ❌ Mega method — làm nhiều việc cùng lúc
METHOD process_travel_request.
  " ... 150 lines of mixed validate + calculate + persist + notify ...
ENDMETHOD.

" ✅ Orchestrator method — delegates to focused sub-methods
METHOD process_travel_request.
  validate_travel( travel ).                           " step 1
  DATA(price) = calculate_total_price( travel ).       " step 2
  DATA(saved_travel) = persist_travel(                 " step 3
    VALUE zs_travel( BASE travel total_price = price )
  ).
  notify_parties( saved_travel ).                      " step 4
ENDMETHOD.

METHOD validate_travel.
  validate_dates( travel ).
  validate_agency( travel-agency_id ).
  validate_customer( travel-customer_id ).
ENDMETHOD.
```

### Single entry point — không early RETURN ở giữa (use guard clauses thay)

```abap
" ✅ Guard clauses — xử lý edge cases trước, main logic sạch
METHOD get_travel.
  " Guard clauses first
  IF travel_id IS INITIAL.
    RAISE EXCEPTION TYPE zcx_invalid_parameter
      EXPORTING textid = zcx_invalid_parameter=>travel_id_empty.
  ENDIF.

  IF NOT line_exists( lt_travel_cache[ travel_id = travel_id ] ).
    RAISE EXCEPTION TYPE zcx_not_found.
  ENDIF.

  " Main logic — clean, no nesting
  result = lt_travel_cache[ travel_id = travel_id ].
ENDMETHOD.

" ❌ Deeply nested IF/ELSE — hard to read
METHOD get_travel.
  IF travel_id IS NOT INITIAL.
    IF line_exists( lt_travel_cache[ travel_id = travel_id ] ).
      result = lt_travel_cache[ travel_id = travel_id ].
    ELSE.
      RAISE EXCEPTION TYPE zcx_not_found.
    ENDIF.
  ELSE.
    RAISE EXCEPTION TYPE zcx_invalid_parameter.
  ENDIF.
ENDMETHOD.
```

### Tránh CHECK ngoài initialization section

```abap
" ❌ CHECK trong LOOP — behavior ambiguous: exit loop or method?
LOOP AT travels INTO DATA(travel).
  CHECK travel-status = 'O'.   " ← exits current iteration, NOT the loop!
  " nhiều developer nhầm đây là IF NOT = 'O' THEN RETURN
  process_open_travel( travel ).
ENDLOOP.

" ✅ Explicit và clear
LOOP AT travels INTO DATA(travel).
  IF travel-status <> 'O'.
    CONTINUE.   " explicit: skip this iteration
  ENDIF.
  process_open_travel( travel ).
ENDLOOP.

" ✅ Hoặc dùng WHERE filter (cleaner)
LOOP AT travels INTO DATA(travel) WHERE status = 'O'.
  process_open_travel( travel ).
ENDLOOP.
```

### Nesting depth — tối đa 3 levels

```abap
" ❌ Deep nesting (4+ levels) — impossible to reason about
METHOD deep_nesting_example.
  IF condition_a.
    LOOP AT lt_items INTO DATA(item).
      IF condition_b.
        IF condition_c.
          IF condition_d.        " level 4 — too deep
            do_something( ).
          ENDIF.
        ENDIF.
      ENDIF.
    ENDLOOP.
  ENDIF.
ENDMETHOD.

" ✅ Extract to methods to reduce nesting
METHOD process_if_relevant.
  IF NOT condition_a. RETURN. ENDIF.
  LOOP AT lt_items INTO DATA(item).
    process_item_if_applicable( item ).
  ENDLOOP.
ENDMETHOD.

METHOD process_item_if_applicable.
  IF condition_b AND condition_c AND condition_d.
    do_something( ).
  ENDIF.
ENDMETHOD.
```

---

## 5. Boolean Best Practices

### Dùng abap_bool, abap_true, abap_false

```abap
" ✅ Type abap_bool + constants abap_true/abap_false
DATA is_valid    TYPE abap_bool.
DATA has_entries TYPE abap_bool.

is_valid    = abap_true.
has_entries = abap_false.

IF is_valid = abap_true.
  ...
ENDIF.

" ❌ Hardcoded 'X' và ' '
DATA is_valid    TYPE c LENGTH 1.
is_valid = 'X'.          " 'X' = true? What does ' ' mean here?
IF is_valid = 'X'.       " unclear
IF is_valid = space.     " forces reader to recall 'space' = false
```

### xsdbool — convert condition → boolean inline

```abap
" ✅ xsdbool — best cho inline boolean assignment
DATA(has_entries)   = xsdbool( lt_travels IS NOT INITIAL ).
DATA(is_overdue)    = xsdbool( ls_travel-end_date < sy-datum ).
DATA(prices_differ) = xsdbool( ls_old-price <> ls_new-price ).

" ✅ Secondary option: COND abap_bool
DATA(has_entries) = COND abap_bool(
  WHEN lt_travels IS NOT INITIAL THEN abap_true
).  " abap_false is implicit default

" ❌ Verbose IF/ELSE just to set boolean
IF lt_travels IS NOT INITIAL.
  has_entries = abap_true.
ELSE.
  has_entries = abap_false.
ENDIF.
```

### IS NOT INITIAL > IS NOT = abap_false

```abap
" ✅ Positive condition
IF has_entries = abap_true.  ...
IF travel IS NOT INITIAL.    ...

" ❌ Double negation — hard to parse
IF has_no_entries = abap_false.    " "not (no entries)" = "has entries"?
IF NOT travel IS INITIAL.          " → use: IF travel IS NOT INITIAL.
IF NOT variable CP 'TODO*'.        " → use: IF variable NP 'TODO*'.
IF NOT variable = 42.              " → use: IF variable <> 42.
```

---

## 6. Conditions và Control Flow

### Extract complex conditions thành method

```abap
" ✅ Named predicate method — self-documenting
IF is_eligible_for_discount( ls_travel ).
  apply_discount( CHANGING travel = ls_travel ).
ENDIF.

METHOD is_eligible_for_discount.
  result = xsdbool(
    travel-customer_type = 'VIP'
    AND travel-total_price > 1000
    AND travel-status = zcl_travel_status=>open
  ).
ENDMETHOD.

" ❌ Inline complex condition — hard to read
IF ls_travel-customer_type = 'VIP'
 AND ls_travel-total_price > 1000
 AND ls_travel-status = 'O'
 AND ls_travel-begin_date >= sy-datum.
  apply_discount( CHANGING travel = ls_travel ).
ENDIF.
```

### Không dùng ELSE khi IF đã RETURN/RAISE

```abap
" ✅ No ELSE after early return/raise
METHOD get_status_text.
  IF travel IS INITIAL.
    RAISE EXCEPTION TYPE zcx_invalid_parameter.
  ENDIF.
  " No ELSE needed — code here is implicitly the 'else' branch
  result = SWITCH #( travel-status
    WHEN 'O' THEN 'Open'
    WHEN 'A' THEN 'Accepted'
    ELSE          'Unknown' ).
ENDMETHOD.

" ❌ Unnecessary ELSE after early exit
METHOD get_status_text.
  IF travel IS INITIAL.
    RAISE EXCEPTION TYPE zcx_invalid_parameter.
  ELSE.                              " ← ELSE not needed
    result = SWITCH #( ... ).
  ENDIF.
ENDMETHOD.
```

---

## 7. Object-Oriented Design

### Interface > Abstract Class (dependency injection)

```abap
" ✅ Interface — enables test doubles, multiple implementations
INTERFACE zif_travel_repository.
  METHODS get_by_id
    IMPORTING travel_id     TYPE /dmo/travel_id
    RETURNING VALUE(result) TYPE zs_travel
    RAISING   zcx_not_found.

  METHODS save
    IMPORTING travel        TYPE zs_travel
    RETURNING VALUE(result) TYPE zs_travel.
ENDINTERFACE.

" ✅ Class depends on interface (Dependency Inversion Principle)
CLASS zcl_travel_processor DEFINITION.
  PUBLIC SECTION.
    METHODS constructor
      IMPORTING repository TYPE REF TO zif_travel_repository.
  PRIVATE SECTION.
    DATA repository TYPE REF TO zif_travel_repository.
ENDCLASS.

" Test: inject mock
DATA(cut) = NEW zcl_travel_processor(
  repository = CAST zif_travel_repository( cl_abap_testdouble=>create(
    'ZIF_TRAVEL_REPOSITORY' ) )
).

" Production: inject real impl
DATA(processor) = NEW zcl_travel_processor(
  repository = NEW zcl_db_travel_repository( )
).
```

### Composition > Inheritance

```abap
" ✅ Composition — flexible, testable
CLASS zcl_travel_processor DEFINITION.
  PRIVATE SECTION.
    DATA validator   TYPE REF TO zif_travel_validator.    " composed
    DATA calculator  TYPE REF TO zif_price_calculator.    " composed
    DATA repository  TYPE REF TO zif_travel_repository.   " composed
ENDCLASS.

" ❌ Deep inheritance — brittle, hard to test
CLASS zcl_base_processor    DEFINITION. ...
CLASS zcl_travel_base       DEFINITION INHERITING FROM zcl_base_processor. ...
CLASS zcl_travel_processor  DEFINITION INHERITING FROM zcl_travel_base. ...
CLASS zcl_air_travel        DEFINITION INHERITING FROM zcl_travel_processor. ...
" → changes in zcl_base_processor cascade to all subclasses
```

### CREATE PRIVATE + Factory method pattern

```abap
" ✅ Controlled instantiation via factory method
CLASS zcl_travel_processor DEFINITION PUBLIC FINAL CREATE PRIVATE.
  PUBLIC SECTION.
    CLASS-METHODS create
      IMPORTING repository    TYPE REF TO zif_travel_repository
      RETURNING VALUE(result) TYPE REF TO zcl_travel_processor.
  " ...
ENDCLASS.

CLASS zcl_travel_processor IMPLEMENTATION.
  METHOD create.
    result = NEW zcl_travel_processor( ).
    result->repository = repository.
  ENDMETHOD.
ENDCLASS.

" Usage
DATA(processor) = zcl_travel_processor=>create( lo_repository ).
```

---

## 8. Table Type Selection

```
Chọn table type dựa trên use case — ảnh hưởng đến performance:

STANDARD TABLE  → small tables (< ~1000 rows), sequential access,
                  append-heavy, temporary accumulation
                  READ TABLE: linear search O(n), có thể dùng BINARY SEARCH sau SORT

SORTED TABLE    → cần access theo sort order, range queries,
                  tự maintain sort order khi INSERT (no SORT needed)
                  READ TABLE: binary search O(log n) automatically

HASHED TABLE    → large lookup tables (> ~1000 rows), exact key match only,
                  O(1) access time, no sort order
                  KHÔNG dùng LOOP với sort order expectation
                  KHÔNG INSERT duplicate keys (runtime error!)

RANGE TABLE     → cho SELECT ... WHERE field IN @lt_range
                  TYPE RANGE OF <type> (built-in)
```

```abap
" ✅ Ví dụ chọn đúng table type

" Agency lookup table (large, exact key match) → HASHED
DATA lt_agencies TYPE HASHED TABLE OF zs_agency
  WITH UNIQUE KEY agency_id.

" Travel list sorted by begin_date → SORTED
DATA lt_travels_by_date TYPE SORTED TABLE OF zs_travel
  WITH NON-UNIQUE SORTED KEY date_key COMPONENTS begin_date.

" Temp accumulation buffer → STANDARD
DATA lt_errors TYPE TABLE OF zs_error.    " default = STANDARD

" ✅ Secondary keys trên STANDARD table (7.40+)
TYPES ztt_travel TYPE STANDARD TABLE OF zs_travel
  WITH NON-UNIQUE SORTED KEY   key_agency  COMPONENTS agency_id
  WITH NON-UNIQUE SORTED KEY   key_status  COMPONENTS status
  WITH NON-UNIQUE HASHED  KEY  key_travel  COMPONENTS travel_id.

" Access via secondary key
DATA(ls_travel) = lt_travels[ KEY key_agency agency_id = 'AG001' ].
LOOP AT lt_travels INTO DATA(ls) USING KEY key_status WHERE status = 'O'.
```

---

## 9. Comments

### Comment = "why", không phải "what"

```abap
" ✅ Comment giải thích LÝ DO, không mô tả code đã rõ ràng
METHOD calculate_surcharge.
  " Apply 15% surcharge for last-minute bookings (within 7 days)
  " Business rule agreed in ticket #S4-12345
  IF ls_travel-begin_date - sy-datum < 7.
    result = base_price * '0.15'.
  ENDIF.
ENDMETHOD.

" ❌ Comment mô tả code hiển nhiên — thừa và misleading nếu code thay đổi
METHOD calculate_surcharge.
  " Check if travel begin date minus today is less than 7
  IF ls_travel-begin_date - sy-datum < 7.     " check date diff
    result = base_price * '0.15'.              " multiply by 0.15
  ENDIF.
ENDMETHOD.
```

### ABAP Doc — cho public methods/classes

```abap
" ✅ ABAP Doc cho public API (hiển thị trong ADT hover/F2)
"! <p class="shorttext synchronized" lang="en">Travel Processor — processes travel lifecycle</p>
"! @parameter travel_id | <p class="shorttext synchronized" lang="en">Travel identifier</p>
"! @raising zcx_not_found | <p class="shorttext synchronized" lang="en">Raised when travel does not exist</p>
METHODS get_travel
  IMPORTING travel_id     TYPE /dmo/travel_id
  RETURNING VALUE(result) TYPE zs_travel
  RAISING   zcx_not_found.

" ❌ Không có doc trên public interface methods — poor DX
METHODS get_travel
  IMPORTING travel_id     TYPE /dmo/travel_id
  RETURNING VALUE(result) TYPE zs_travel.
```

### Không commented-out code

```abap
" ❌ Commented-out code — clutter, version history là nhiệm vụ của Git
*  DATA(old_result) = legacy_get_travel( lv_id ).
*  IF old_result IS INITIAL.
*    RAISE EXCEPTION ...
*  ENDIF.
DATA(result) = new_get_travel( lv_id ).   " ← chỉ giữ code mới

" ✅ Nếu cần reference: dùng Git history, ticket link trong comment
" Old logic moved to zcl_legacy_travel (ticket #ARCH-2024-001)
DATA(result) = new_get_travel( lv_id ).
```

---

## 10. Tooling — ATC, code pal, ABAP Cleaner

### ATC (ABAP Test Cockpit)

```
Transaction: ATC
ADT: right-click → Run As → ABAP Test Cockpit

Key checks relevant to Clean ABAP:
- ABAP_CLOUD_READINESS → checks forbidden syntax for ABAP Cloud
- NAMING_CONVENTIONS   → checks naming rules
- PERFORMANCE          → SELECT *, FAE without IS NOT INITIAL, etc.
- CODE_INSPECTOR       → general code quality

Setup: SCI (Code Inspector) → create check variant with relevant checks
```

### code pal for ABAP

```
GitHub: https://github.com/SAP/code-pal-for-abap
→ 100+ Clean ABAP checks integrated into ATC
→ Checks: method length, boolean params, naming, RETURNING preference
→ Install as ABAP package in your system
```

### ABAP Cleaner (SAP open-source tool)

```
GitHub: https://github.com/SAP/abap-cleaner
ADT Plugin: Help → Install New Software → add ABAP Cleaner update site

Tự động fix 100+ cleanup rules với 1 keystroke:
- Formatting và alignment
- Replacing obsolete syntax (MOVE → =, CREATE OBJECT → NEW, etc.)
- Reducing nesting depth
- Cleanup rule examples: empty lines, indentation, upper/lowercase keywords
```

### Pretty Printer — mandatory team setting

```
SE80 / SE24: Utilities → Settings → ABAP Editor → Pretty Printer
Recommended settings (team-wide):
  ✅ Indent
  ✅ Convert Uppercase/Lowercase: keywords UPPER, identifiers lower
  ✅ Run before save (SE38/SE24 check)

ADT: Preferences → ABAP Development → Editors → Source Code Editors → ABAP Formatter
Formatter: ABAP Cleaner (preferred) or Classic Pretty Printer
→ Format on Save: enable
```

---

## 11. Anti-Patterns

### CA-AP-01 🔴 — Generic class names (Helper, Utility, Manager)

```abap
" ❌ WRONG — ZCL_HELPER làm gì? Không ai biết từ tên
CLASS zcl_travel_helper DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS:
      format_date    IMPORTING date TYPE d RETURNING VALUE(result) TYPE string,
      validate_id    IMPORTING id   TYPE i RETURNING VALUE(result) TYPE abap_bool,
      send_email     IMPORTING addr TYPE string,
      calculate_tax  IMPORTING amount TYPE p RETURNING VALUE(result) TYPE p.
ENDCLASS.
" → 4 unrelated methods dumped into 1 "helper"

" ✅ CORRECT — tách thành classes có tên rõ ràng
CLASS zcl_date_formatter   ...  " format_date
CLASS zcl_travel_validator ...  " validate_id
CLASS zcl_email_sender     ...  " send_email
CLASS zcl_tax_calculator   ...  " calculate_tax
```

---

### CA-AP-02 🟠 — EXPORTING thay RETURNING cho single output

```abap
" ❌ WRONG — không chain được, verbose khi gọi
METHODS get_travel
  IMPORTING travel_id TYPE /dmo/travel_id
  EXPORTING result    TYPE zs_travel.

" Gọi phải khai báo biến riêng
DATA ls_travel TYPE zs_travel.
get_travel( EXPORTING travel_id = lv_id IMPORTING result = ls_travel ).

" ✅ CORRECT — RETURNING cho single output
METHODS get_travel
  IMPORTING travel_id     TYPE /dmo/travel_id
  RETURNING VALUE(result) TYPE zs_travel.

" Gọi inline
DATA(travel) = get_travel( lv_id ).
process( get_travel( lv_id )-status ).  " chain
```

---

### CA-AP-03 🟠 — Hardcoded magic literals

```abap
" ❌ WRONG — magic literals scattered across codebase
IF ls_travel-status = 'O'.    " what is 'O'?
IF ls_travel-priority > 3.    " what does 3 mean?
lv_currency = 'EUR'.          " hardcoded business value

" ✅ CORRECT — named constants
IF ls_travel-status = zcl_travel_status=>open.
IF ls_travel-priority > zcl_travel_config=>priority_high_threshold.
lv_currency = zcl_travel_config=>default_currency.
```

---

### CA-AP-04 🟠 — Deep inheritance hierarchy

```abap
" ❌ WRONG — Brittle, hard to test, violates OCP
CLASS zcl_base        DEFINITION. ...
CLASS zcl_travel_base DEFINITION INHERITING FROM zcl_base. ...
CLASS zcl_air_travel  DEFINITION INHERITING FROM zcl_travel_base. ...
CLASS zcl_intl_flight DEFINITION INHERITING FROM zcl_air_travel. ...
" → change in zcl_base can break zcl_intl_flight in unexpected ways

" ✅ CORRECT — composition với interfaces
CLASS zcl_travel_processor DEFINITION.
  PRIVATE SECTION.
    DATA pricing_strategy TYPE REF TO zif_pricing_strategy.
    DATA validator        TYPE REF TO zif_travel_validator.
ENDCLASS.
" → swap implementations without changing zcl_travel_processor
```

---

### CA-AP-05 🟡 — Chaining thừa (DATA:, METHODS:)

```abap
" ❌ WRONG — chaining DATA block = buộc khai báo xa nơi dùng
DATA:
  lv_travel_id    TYPE /dmo/travel_id,
  lt_travels      TYPE TABLE OF zs_travel,
  ls_current      TYPE zs_travel,
  lv_total        TYPE p LENGTH 10 DECIMALS 2,
  lo_processor    TYPE REF TO zcl_travel_processor.

" ✅ CORRECT — inline declarations tại điểm dùng
DATA(travels)    = get_all_travels( ).
DATA(processor)  = NEW zcl_travel_processor( lo_repo ).
LOOP AT travels INTO DATA(travel).
  DATA(total) = processor->calculate_total( travel ).
ENDLOOP.
```

---

### CA-AP-06 🟡 — Không dùng ABAP Doc cho public interface

```abap
" ❌ WRONG — public method không có documentation
INTERFACE zif_travel_repository.
  METHODS get_by_id
    IMPORTING id            TYPE /dmo/travel_id
    RETURNING VALUE(result) TYPE zs_travel
    RAISING   zcx_not_found.
ENDINTERFACE.

" ✅ CORRECT — ABAP Doc trên mỗi public method
INTERFACE zif_travel_repository.
  "! <p class="shorttext synchronized" lang="en">Fetch travel by primary key</p>
  "! @parameter id     | Travel ID (6-digit zero-padded)
  "! @raising zcx_not_found | No travel found for given ID
  METHODS get_by_id
    IMPORTING id            TYPE /dmo/travel_id
    RETURNING VALUE(result) TYPE zs_travel
    RAISING   zcx_not_found.
ENDINTERFACE.
```

---

### CA-AP-07 🟢 — Pretty Printer inconsistency

```abap
" ❌ WRONG — mixed case keywords, no consistent indentation
select TRAVEL_ID, AGENCY_ID from ZTRAVEL into TABLE @data(lt_travels)
WHERE STATUS = 'O'.

" ✅ CORRECT — after ABAP Cleaner / Pretty Printer
SELECT travel_id, agency_id
  FROM ztravel
  INTO TABLE @DATA(lt_travels)
  WHERE status = 'O'.
```

---

## 12. Sources

| Topic | URL |
|---|---|
| Clean ABAP Style Guide (Official) | https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md |
| Clean ABAP — Naming Section | https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md#names |
| Clean ABAP — Methods Section | https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md#methods |
| Clean ABAP — Booleans | https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md#booleans |
| Clean ABAP — Conditions | https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md#conditions |
| Clean ABAP — Avoid Encodings (Hungarian) | https://github.com/SAP/styleguides/blob/main/clean-abap/sub-sections/AvoidEncodings.md |
| Clean ABAP — Interfaces vs Abstract Classes | https://github.com/SAP/styleguides/blob/main/clean-abap/sub-sections/InterfacesVsAbstractClasses.md |
| Clean ABAP — Modern Language Elements | https://github.com/SAP/styleguides/blob/main/clean-abap/sub-sections/ModernABAPLanguageElements.md |
| code pal for ABAP (SAP GitHub) | https://github.com/SAP/code-pal-for-abap |
| ABAP Cleaner (SAP GitHub) | https://github.com/SAP/abap-cleaner |
| DeepWiki — Clean ABAP Overview | https://deepwiki.com/SAP/styleguides/2-clean-abap-style-guide |
| ABAP Best Practices (Community) | https://ilyakaznacheev.github.io/abap-best-practice/ |
| Boolean Input Parameter check (code pal) | https://github.com/SAP/code-pal-for-abap/blob/master/docs/checks/boolean-input-parameter.md |
| Clean ABAP Book (SAP Press sample) | https://s3-eu-west-1.amazonaws.com/gxmedia.galileo-press.de/leseproben/5190/reading_sample_sap_press_clean_abap.pdf |
| METHODS — SAP Keyword Doc | https://help.sap.com/doc/abapdocu_751_index_htm/7.51/en-us/abapmethods_general.htm |