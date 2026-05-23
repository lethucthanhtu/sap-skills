# RAP — Performance Guide

Hướng dẫn tối ưu hiệu năng cho RAP Business Objects: từ behavior pool,
CDS pushdown, đến bgPF cho long-running tasks.

> **Đọc file này khi:** RAP app chạy chậm, validation/determination timeout,
> Fiori list page load lâu, action xử lý nhiều records bị lag,
> hỏi về N+1, FAE, pushdown, bgPF, side effects.

---

## Table of Contents

1. [Performance Layers — Tổng quan](#1-performance-layers--tổng-quan)
2. [Layer 1 — Behavior Pool: Bulk EML thay vì LOOP](#2-layer-1--behavior-pool-bulk-eml-thay-vì-loop)
3. [Layer 2 — DB Access: FAE và SELECT tối ưu](#3-layer-2--db-access-fae-và-select-tối-ưu)
4. [Layer 3 — CDS Pushdown: Logic trên HANA](#4-layer-3--cds-pushdown-logic-trên-hana)
5. [Layer 4 — Virtual Elements: Chi phí ẩn](#5-layer-4--virtual-elements-chi-phí-ẩn)
6. [Layer 5 — OData Payload: $select và $top](#6-layer-5--odata-payload-select-và-top)
7. [Layer 6 — bgPF: Long-running tasks async](#7-layer-6--bgpf-long-running-tasks-async)
8. [Layer 7 — Side Effects: Giảm UI round-trips](#8-layer-7--side-effects-giảm-ui-round-trips)
9. [Layer 8 — Draft Activate optimized](#9-layer-8--draft-activate-optimized)
10. [Layer 9 — Entity Buffer cho config data](#10-layer-9--entity-buffer-cho-config-data)
11. [Profiling Tools — SAT, ST05, ATC](#11-profiling-tools--sat-st05-atc)
12. [Anti-Patterns](#12-anti-patterns)
13. [Performance Checklist](#13-performance-checklist)
14. [Sources](#14-sources)

---

## 1. Performance Layers — Tổng quan

RAP performance vấn đề thường đến từ một trong các layer sau — check theo thứ tự:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Behavior Pool — EML bulk vs loop                      │
│  Nguyên nhân: MODIFY/READ ENTITIES trong LOOP                   │
│  Impact: ★★★★★ Rất cao                                         │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: DB Access — SELECT/FAE patterns                       │
│  Nguyên nhân: SELECT inside loop, SELECT *, cross-buffer read   │
│  Impact: ★★★★★ Rất cao                                         │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: CDS Pushdown — logic ở AS ABAP thay vì HANA          │
│  Nguyên nhân: calculation trong ABAP mà CDS có thể làm         │
│  Impact: ★★★★☆ Cao                                             │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: Virtual Elements — mỗi row gọi ABAP method           │
│  Nguyên nhân: Virtual element dùng cho list với nhiều rows      │
│  Impact: ★★★★☆ Cao với large list                              │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5: OData Payload — $select thiếu, $top không dùng        │
│  Nguyên nhân: load all fields, load all rows                    │
│  Impact: ★★★☆☆ Trung bình                                      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 6: bgPF — blocking tasks chạy sync trong save           │
│  Nguyên nhân: heavy processing trong save_modified              │
│  Impact: ★★★☆☆ Trung bình — UX impact cao                     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 7: Side Effects — UI reload toàn bộ thay vì selective    │
│  Nguyên nhân: side effects không được khai báo                  │
│  Impact: ★★☆☆☆ Thấp-trung bình                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer 1 — Behavior Pool: Bulk EML thay vì LOOP

**Vấn đề phổ biến nhất và dễ fix nhất.**

### Anti-pattern: EML trong LOOP

```abap
" ❌ WRONG — N+1 problem: mỗi key = 1 EML call = 1 DB roundtrip
METHOD setStatusOnCreate.
  LOOP AT keys INTO DATA(ls_key).
    " EML trong LOOP → N lần roundtrip tới transactional buffer
    READ ENTITIES OF z_i_travel IN LOCAL MODE
      ENTITY Travel FIELDS ( TravelId OverallStatus )
      WITH VALUE #( ( %tky = ls_key-%tky ) )   " ← chỉ 1 record/call
      RESULT DATA(lt_result).

    IF lt_result[ 1 ]-OverallStatus IS INITIAL.
      MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
        ENTITY Travel UPDATE FIELDS ( OverallStatus )
        WITH VALUE #( ( %tky = ls_key-%tky OverallStatus = 'O' ) ).
    ENDIF.
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — 1 bulk EML call cho tất cả keys
METHOD setStatusOnCreate.
  " Step 1: Read tất cả keys trong 1 call
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( TravelId OverallStatus )
    WITH CORRESPONDING #( keys )   " ← tất cả keys cùng lúc
    RESULT DATA(lt_travels).

  " Step 2: Filter trong ABAP (không cần EML thêm)
  DATA lt_update TYPE TABLE FOR UPDATE z_i_travel\\Travel.
  lt_update = VALUE #(
    FOR lt IN lt_travels
    WHERE OverallStatus IS INITIAL
    ( %tky         = lt-%tky
      OverallStatus = 'O' ) ).

  " Step 3: Modify tất cả cùng lúc
  CHECK lt_update IS NOT INITIAL.
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH lt_update
    REPORTED DATA(reported).
  reported = CORRESPONDING #( DEEP reported ).
ENDMETHOD.
```

### Anti-pattern: Bulk MODIFY nhưng RESULT xử lý từng record

```abap
" ❌ WRONG — action result được populate trong LOOP thay vì bulk READ
METHOD acceptTravel.
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH VALUE #( FOR key IN keys ( %tky = key-%tky OverallStatus = 'A' ) )
    REPORTED DATA(reported).

  " READ trong LOOP để build result — N lần roundtrip
  LOOP AT keys INTO DATA(ls_key).
    READ ENTITIES OF z_i_travel IN LOCAL MODE
      ENTITY Travel ALL FIELDS
      WITH VALUE #( ( %tky = ls_key-%tky ) )
      RESULT DATA(lt_one).
    APPEND VALUE #( %tky = ls_key-%tky %param = lt_one[ 1 ] ) TO result.
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — 1 bulk READ sau MODIFY
METHOD acceptTravel.
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH VALUE #( FOR key IN keys ( %tky = key-%tky OverallStatus = 'A' ) )
    REPORTED DATA(reported).
  reported = CORRESPONDING #( DEEP reported ).

  " 1 bulk READ cho tất cả
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel ALL FIELDS
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_result).

  result = VALUE #( FOR r IN lt_result
                    ( %tky = r-%tky %param = r ) ).
ENDMETHOD.
```

---

## 3. Layer 2 — DB Access: FAE và SELECT tối ưu

### Pattern: Cross-entity validation với FAE

Khi validation cần check existence trong DB table (không phải buffer):

```abap
" ❌ WRONG — SELECT inside loop: N queries cho N records
METHOD validateCustomer.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( TravelId CustomerNumber )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).

  LOOP AT lt_travels INTO DATA(ls_travel).
    SELECT SINGLE customer_id FROM zcustomer
      WHERE customer_id = @ls_travel-CustomerNumber
      INTO @DATA(lv_cust).
    IF sy-subrc <> 0.
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      " ...
    ENDIF.
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — 1 FAE query cho tất cả distinct customer IDs
METHOD validateCustomer.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( TravelId CustomerNumber )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).

  " Step 1: Build distinct customer list
  DATA lt_customers TYPE SORTED TABLE OF zcustomer
    WITH UNIQUE KEY customer_id.
  lt_customers = CORRESPONDING #(
    lt_travels DISCARDING DUPLICATES
    MAPPING customer_id = CustomerNumber EXCEPT * ).
  DELETE lt_customers WHERE customer_id IS INITIAL.

  " Step 2: 1 FAE query
  IF lt_customers IS NOT INITIAL.
    SELECT FROM zcustomer FIELDS customer_id
      FOR ALL ENTRIES IN @lt_customers
      WHERE customer_id = @lt_customers-customer_id
      INTO TABLE @DATA(lt_valid_customers).
  ENDIF.

  " Step 3: Check trong ABAP
  LOOP AT lt_travels INTO DATA(ls_travel).
    APPEND VALUE #( %tky = ls_travel-%tky %state_area = 'VALIDATE_CUSTOMER' )
      TO reported-travel.

    IF ls_travel-CustomerNumber IS INITIAL
    OR NOT line_exists( lt_valid_customers[ customer_id = ls_travel-CustomerNumber ] ).
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky               = ls_travel-%tky
        %state_area        = 'VALIDATE_CUSTOMER'
        %element-CustomerNumber = if_abap_behv=>mk-on
        %msg = new_message_with_text(
          severity = if_abap_behv_message=>severity-error
          text     = 'Customer does not exist' )
      ) TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

### SELECT best practices trong RAP context

```abap
" ✅ Chỉ select fields cần thiết (không SELECT *)
SELECT FROM zcustomer
  FIELDS customer_id, customer_name   " ← chỉ fields cần dùng
  FOR ALL ENTRIES IN @lt_customers
  WHERE customer_id = @lt_customers-customer_id
  INTO TABLE @DATA(lt_result).

" ✅ Dùng SORTED TABLE cho lookup để binary search
DATA lt_lookup TYPE SORTED TABLE OF zcustomer
  WITH UNIQUE KEY customer_id.

" ✅ line_exists() thay vì READ TABLE + sy-subrc
IF line_exists( lt_lookup[ customer_id = lv_id ] ).

" ✅ CORRESPONDING #( ... DISCARDING DUPLICATES ) để build FAE table
DATA lt_fae_input TYPE SORTED TABLE OF ty_key WITH UNIQUE KEY id.
lt_fae_input = CORRESPONDING #(
  lt_source DISCARDING DUPLICATES
  MAPPING id = SourceId EXCEPT * ).
DELETE lt_fae_input WHERE id IS INITIAL.  " FAE không dùng được với empty check values
```

---

## 4. Layer 3 — CDS Pushdown: Logic trên HANA

**Nguyên tắc:** Mọi aggregation, join, filter, calculation → làm trong CDS, không làm trong ABAP.

```abap
" ❌ WRONG — aggregate trong ABAP sau khi load tất cả records
SELECT FROM zbooking FIELDS travel_id, flight_price
  INTO TABLE @DATA(lt_bookings).

DATA lv_total TYPE decfloat34.
LOOP AT lt_bookings INTO DATA(ls_b) WHERE travel_id = lv_travel_id.
  lv_total += ls_b-flight_price.
ENDLOOP.
```

```cds
// ✅ CORRECT — aggregate trong CDS (executed on HANA)
define view entity Z_I_TravelTotal
  as select from ztravel as t
    inner join zbooking as b on b.travel_id = t.travel_id
{
  key t.travel_id         as TravelId,
      sum(b.flight_price) as TotalBookingPrice,
      count(*)            as NumberOfBookings
}
group by t.travel_id
```

### Các phép tính nên pushdown xuống CDS/HANA

| Thay vì ABAP | Dùng CDS/SQL |
|---|---|
| LOOP + conditional sum | `SUM( CASE WHEN ... THEN ... END )` |
| LOOP + count | `COUNT(*)` hoặc `COUNT( DISTINCT field )` |
| Multi-table lookup | `INNER/LEFT OUTER JOIN` trong CDS |
| String concat | `CONCAT( field1, field2 )` trong CDS |
| Date arithmetic | `DATS_ADD_DAYS()`, `DATS_DAYS_BETWEEN()` |
| Null handling | `COALESCE( field, default_value )` |
| Conditional field | `CASE WHEN ... THEN ... ELSE ... END` |

---

## 5. Layer 4 — Virtual Elements: Chi phí ẩn

Virtual elements trong CDS gọi ABAP method cho **mỗi row** trong result set.
Với list page 100+ rows → 100+ ABAP method calls.

```cds
// ⚠️ Virtual element — gọi ABAP cho mỗi row
define view entity Z_I_Travel
  as select from ztravel
{
  key travel_id          as TravelId,
      overall_status     as OverallStatus,
      // Virtual element: DaysUntilFlight gọi ABAP method per row
      @ObjectModel.virtualElement: true
      @ObjectModel.virtualElementCalculatedBy: 'ABAP:ZCL_TRAVEL_VE'
      cast( 0 as abap.int4 ) as DaysUntilFlight
}
```

```abap
CLASS zcl_travel_ve DEFINITION PUBLIC FINAL.
  PUBLIC SECTION.
    INTERFACES if_sadl_exit_calc_element_read.
ENDCLASS.

CLASS zcl_travel_ve IMPLEMENTATION.
  METHOD if_sadl_exit_calc_element_read~calculate.
    " ⚠️ Được gọi N lần cho N rows — avoid heavy logic!
    LOOP AT in_business_data ASSIGNING FIELD-SYMBOL(<row>).
      DATA(lr_travel) = CAST ztravel( <row>-data ).
      <row>-data->( zcl_travel_ve_result )->DaysUntilFlight =
        cl_abap_context_info=>get_system_date( ) - lr_travel->begin_date.
    ENDLOOP.
  ENDMETHOD.
ENDCLASS.
```

**Rules cho virtual elements:**

```
✅ Dùng virtual element khi:
  - Calculation đơn giản (date diff, string concat)
  - Kết quả KHÔNG cần làm filter hoặc sort trong OData
  - Chỉ hiển thị trên object page (1 record), không trên list

❌ Tránh virtual element khi:
  - Logic gọi DB hoặc EML
  - Field dùng để sort/filter list page
  - List có thể có hàng trăm rows
  - Calculation có thể làm trong CDS SQL

→ Nếu logic có thể express trong CDS SQL → luôn prefer CDS thay vì virtual element
```

Source: https://community.sap.com/t5/application-development-and-automation-blog-posts/enhancing-rap-performance-the-impact-of-virtual-elements-on-key-metrics/ba-p/14005353

---

## 6. Layer 5 — OData Payload: $select và $top

Fiori Elements tự động tối ưu nhưng custom OData calls cần chú ý:

```
// ✅ Dùng $select để giới hạn fields
GET /sap/opu/odata4/.../Travel?$select=TravelId,OverallStatus,AgencyId

// ✅ Dùng $top và $skip cho pagination
GET /sap/opu/odata4/.../Travel?$top=50&$skip=0

// ✅ Server-side filter thay vì load all rồi filter client-side
GET /sap/opu/odata4/.../Travel?$filter=OverallStatus eq 'O'

// ❌ AVOID — load tất cả fields, tất cả records
GET /sap/opu/odata4/.../Travel
```

### CDS annotation để control OData behavior

```cds
// Giới hạn page size mặc định
@Capabilities.TopSupported: true
@Capabilities.SkipSupported: true
@Capabilities.SearchRestrictions.Searchable: true

define view entity Z_C_Travel as projection on Z_I_Travel {
  // Đánh dấu field không cần load ở list page
  @UI.hidden: true    // ← không xuất hiện trong list, chỉ trong detail
  LongDescription,

  // Annotate searchable fields để HANA có thể optimize
  @Search.defaultSearchElement: true
  @Search.fuzzinessThreshold: 0.8
  AgencyName
}
```

---

## 7. Layer 6 — bgPF: Long-running tasks async

Dùng **Background Processing Framework (bgPF)** khi action/save cần xử lý nặng (>2 giây),
tránh block UI và timeout.

**Prerequisites:**
- S/4HANA 2023 On-Premise hoặc BTP ABAP Environment
- Class phải implement `IF_SERIALIZABLE_OBJECT`

### Pattern: Action triggers bgPF, save_modified starts it

```abap
" BDEF:
action calculateInventory result [1] $self;
" (No bgPF keyword in BDEF — bgPF is started programmatically in save_modified)

" Step 1: Action handler — set flag trong buffer
METHOD calculateInventory.
  MODIFY ENTITIES OF z_i_inventory IN LOCAL MODE
    ENTITY Inventory UPDATE FIELDS ( BgpfStatus )
    WITH VALUE #( FOR key IN keys
                  ( %tky      = key-%tky
                    BgpfStatus = 'P' ) )  " P = Pending
    REPORTED DATA(reported).
  reported = CORRESPONDING #( DEEP reported ).

  READ ENTITIES OF z_i_inventory IN LOCAL MODE
    ENTITY Inventory ALL FIELDS
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_result).

  result = VALUE #( FOR r IN lt_result ( %tky = r-%tky %param = r ) ).
ENDMETHOD.

" Step 2: save_modified — check flag, start bgPF
METHOD save_modified.
  " Only start bgPF for records with BgpfStatus = 'P'
  LOOP AT update-inventory INTO DATA(ls_update).
    CHECK ls_update-%control-BgpfStatus = if_abap_behv=>mk-on
      AND ls_update-BgpfStatus = 'P'.

    " Start bgPF — executes AFTER COMMIT WORK
    DATA(lo_bgpf) = zcl_bgpf_calc_inventory=>run_via_bgpf(
      i_inventory_id = ls_update-InventoryId ).
    " lo_bgpf is registered → executes after framework COMMIT
  ENDLOOP.
ENDMETHOD.
```

```abap
" bgPF worker class
CLASS zcl_bgpf_calc_inventory DEFINITION PUBLIC FINAL
  CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_serializable_object.   " ← required!

    CLASS-METHODS run_via_bgpf
      IMPORTING i_inventory_id TYPE z_inventory_id
      RETURNING VALUE(result) TYPE REF TO zcl_bgpf_calc_inventory.

    METHODS execute
      FOR BACKGROUND PROCESSING.

  PRIVATE SECTION.
    DATA mv_inventory_id TYPE z_inventory_id.
ENDCLASS.

CLASS zcl_bgpf_calc_inventory IMPLEMENTATION.
  METHOD run_via_bgpf.
    DATA(lo_worker) = NEW zcl_bgpf_calc_inventory( ).
    lo_worker->mv_inventory_id = i_inventory_id.

    " Register with bgPF framework
    DATA(lo_factory) = cl_bgmc_process_factory=>create( ).
    DATA(lo_process) = lo_factory->create_process(
      io_operation = lo_worker ).
    lo_process->zal_start( ).  " starts after COMMIT
    result = lo_worker.
  ENDMETHOD.

  METHOD execute.
    " ✅ Heavy processing here — separate ABAP session
    " Has its own LUW — can COMMIT WORK
    DATA(lv_total) = zcl_inventory_calc=>calculate_total(
      iv_inventory_id = mv_inventory_id ).

    " Update result via EML (external consumer pattern)
    MODIFY ENTITIES OF z_i_inventory
      ENTITY Inventory UPDATE FIELDS ( TotalQuantity BgpfStatus )
      WITH VALUE #( ( InventoryId = mv_inventory_id
                      TotalQuantity = lv_total
                      BgpfStatus   = 'D' ) )  " D = Done
      MAPPED DATA(mapped) FAILED DATA(failed) REPORTED DATA(reported).

    COMMIT ENTITIES
      RESPONSE OF z_i_inventory
      FAILED DATA(commit_failed)
      REPORTED DATA(commit_reported).
  ENDMETHOD.
ENDCLASS.
```

Source: https://community.sap.com/t5/technology-blog-posts-by-sap/introducing-the-background-processing-framework/ba-p/13579056
Source: https://github.com/SAP-samples/abap-platform-bgpf-appl-log-events-side-effects

---

## 8. Layer 7 — Side Effects: Giảm UI round-trips

**Không có side effects** → Fiori reload **toàn bộ** entity sau mỗi field change.
**Có side effects** → Fiori chỉ reload **fields liên quan** → ít requests hơn.

```abap
" BDEF — khai báo side effects
define behavior for Z_I_Travel alias Travel ... {

  side effects {
    " Khi BeginDate thay đổi → refresh TotalPrice (do calculation phụ thuộc)
    field BeginDate  affects field TotalPrice, field DurationDays;

    " Khi EndDate thay đổi → refresh TotalPrice
    field EndDate    affects field TotalPrice, field DurationDays;

    " Khi action acceptTravel chạy → refresh OverallStatus và buttons
    action acceptTravel affects field OverallStatus,
                                field LocalLastChangedAt;

    " Khi child Booking thay đổi → refresh parent TotalBookings
    entity _Booking   affects field TotalBookings;
  }
}
```

**Side effects quan trọng nhất cần khai báo:**

| Trigger | Affects | Lý do |
|---|---|---|
| Determination field | Field bị derive | Fiori sẽ tự reload field mới |
| Action | Các fields thay đổi sau action | Tránh reload toàn bộ entity |
| Child entity change | Parent aggregate fields | e.g. TotalItems, TotalPrice |
| `_association` | Entity liên quan | Khi association data thay đổi |

Source: https://abapeur.fr/en/side-effects-what-is-this-spell/

---

## 9. Layer 8 — Draft Activate optimized

```abap
" ❌ draft action Activate — re-validates và re-saves TẤT CẢ entities dù không changed
draft action Activate;

" ✅ draft action Activate optimized — skip unchanged entities
draft action Activate optimized;
```

**`Activate optimized` trade-off:**

| | `Activate` | `Activate optimized` |
|---|---|---|
| **Performance** | Chậm hơn với large BOs | ✅ Nhanh hơn — skip unchanged |
| **Validation coverage** | Tất cả entities | Chỉ changed entities |
| **Khi dùng** | Cần validate mọi thứ mỗi save | Large BO với nhiều entities |
| **Kết hợp** | N/A | Dùng `(always)` trong Prepare để force critical validations |

```abap
" ✅ Best practice: Activate optimized + (always) cho critical validations
draft action Activate optimized;
draft determine action Prepare {
  validation ( always ) validateMandatory;    " ← luôn check mandatory
  determination ( always ) setAdminFields;   " ← luôn update timestamps
  validation validateDates;                  " ← chỉ fire khi dates thay đổi (OK)
}
```

---

## 10. Layer 9 — Entity Buffer cho config data

Config/customizing data đọc nhiều lần trong handler methods → enable entity buffer.

```cds
// CDS view với entity buffer
@AbapCatalog.entityBuffer.definitionAllowed: true
define view entity Z_I_AgencyConfig
  as select from zagency_config
{
  key agency_id   as AgencyId,
      max_booking as MaxBooking,
      is_active   as IsActive
}
```

```abap
" Tạo buffer definition trong ADT:
" Right-click CDS view → New → Other ABAP Repository Object → Entity Buffer

" Sau khi enable buffer: SELECT từ Z_I_AgencyConfig sẽ đọc từ ABAP Shared Memory
" Không cần thay đổi code — buffer transparent với SELECT

" ⚠️ Buffer phù hợp cho:
"   - Config/customizing tables (ít thay đổi)
"   - Reference data (currencies, country codes)
"   - NOT cho transactional data (orders, inventory)
```

Source: https://community.sap.com/t5/technology-blog-posts-by-sap/sap-hana-and-abap-performance-tuning-a-guide-to-caches-and-buffers/ba-p/14318925

---

## 11. Profiling Tools — SAT, ST05, ATC

### ST05 — SQL Trace (quan trọng nhất)

```
Transaction: ST05
1. Turn on SQL trace: "Activate Trace" button
2. Thực hiện action cần measure trên Fiori
3. ST05 → "Deactivate Trace"
4. "Display Trace" → filter by program = behavior pool class name

Tìm:
  - Số lần execute cùng 1 SELECT → N+1 problem
  - SELECT * (tất cả fields) → cần thu hẹp
  - SELECT không có WHERE index fields → full table scan
  - Execution time > 100ms → bottleneck
```

### SAT — Runtime Analysis

```
Transaction: SAT
1. "New Trace" → chọn program = Z_*_BP (behavior pool class)
   hoặc trace theo user
2. "Activate" → thực hiện action → "Deactivate"
3. Analyze:
   - Hit list: sorted by gross time → top 10 most expensive methods
   - Call hierarchy: xem nested calls
   - ABAP statements: xem LOOP, SELECT hot spots
```

### ATC — ABAP Test Cockpit (automatic checks)

```
Transaction: ATC
Check variants cho RAP:
  - "ABAP_CLOUD_READINESS" → kiểm tra clean core compliance
  - "PERFORMANCE" → tìm SELECT *, FAE issues, nested loops
  
ADT: Right-click behavior pool → Run As → ABAP Test Cockpit
```

### Quick diagnostic pattern

```abap
" Add GET_RUN_TIME logging trong handler để measure
DATA: lv_start TYPE i,
      lv_end   TYPE i.

GET RUN TIME FIELD lv_start.

" ... your logic ...

GET RUN TIME FIELD lv_end.
DATA(lv_ms) = ( lv_end - lv_start ) / 1000.

" Log if slow (> 200ms)
IF lv_ms > 200.
  MESSAGE |validateDates took { lv_ms } ms for { lines( keys ) } keys|
    TYPE 'W'.
ENDIF.
```

---

## 12. Anti-Patterns

### ❌ AP-PERF-01: EML trong LOOP

```abap
" ❌ WRONG — N calls thay vì 1
LOOP AT keys INTO DATA(ls_key).
  READ ENTITIES OF z_i_travel IN LOCAL MODE ...
    WITH VALUE #( ( %tky = ls_key-%tky ) )  " ← 1 key/call
    RESULT DATA(lt_one).
ENDLOOP.

" ✅ CORRECT — 1 bulk call
READ ENTITIES OF z_i_travel IN LOCAL MODE ...
  WITH CORRESPONDING #( keys )   " ← tất cả keys
  RESULT DATA(lt_all).
```

---

### ❌ AP-PERF-02: SELECT inside LOOP

```abap
" ❌ WRONG — N queries
LOOP AT lt_travels INTO DATA(ls_travel).
  SELECT SINGLE * FROM zcustomer
    WHERE customer_id = @ls_travel-CustomerNumber
    INTO @DATA(ls_cust).
ENDLOOP.

" ✅ CORRECT — 1 FAE query
SELECT FROM zcustomer FIELDS customer_id, customer_name
  FOR ALL ENTRIES IN @lt_customers_fae
  WHERE customer_id = @lt_customers_fae-customer_id
  INTO TABLE @DATA(lt_customers).
```

---

### ❌ AP-PERF-03: Virtual element với DB call

```abap
" ❌ WRONG — DB call trong virtual element = N queries cho N rows
METHOD if_sadl_exit_calc_element_read~calculate.
  LOOP AT in_business_data ASSIGNING FIELD-SYMBOL(<row>).
    SELECT SINGLE price FROM zrates    " ← DB call per row!
      WHERE currency = @<row>-currency
      INTO @DATA(lv_rate).
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — pre-load tất cả rates trước LOOP
METHOD if_sadl_exit_calc_element_read~calculate.
  " Extract all currencies first
  DATA lt_currencies TYPE SORTED TABLE OF zrates WITH UNIQUE KEY currency.
  LOOP AT in_business_data ASSIGNING FIELD-SYMBOL(<pre>).
    INSERT VALUE #( currency = CAST ztravel( <pre>-data )->currency )
      INTO TABLE lt_currencies.
  ENDLOOP.

  " 1 FAE query for all currencies
  SELECT FROM zrates FIELDS currency, rate
    FOR ALL ENTRIES IN @lt_currencies
    WHERE currency = @lt_currencies-currency
    INTO TABLE @DATA(lt_rates).

  " Apply in LOOP (no DB)
  LOOP AT in_business_data ASSIGNING FIELD-SYMBOL(<row>).
    DATA(lr) = CAST ztravel( <row>-data ).
    DATA(ls_rate) = lt_rates[ currency = lr->currency ].
    " calculate...
  ENDLOOP.
ENDMETHOD.
```

---

### ❌ AP-PERF-04: Heavy sync processing trong save_modified

```abap
" ❌ WRONG — blocking logic trong save_modified, user waits
METHOD save_modified.
  LOOP AT update-inventory INTO DATA(ls_update).
    " Complex calculation: 5-30 seconds
    DATA(lv_result) = zcl_heavy_calc=>run_complex_report(
      iv_id = ls_update-InventoryId ).   " ← user blocked!
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — async via bgPF
METHOD save_modified.
  LOOP AT update-inventory INTO DATA(ls_update).
    CHECK ls_update-TriggerCalc = 'X'.
    zcl_bgpf_calc=>run_via_bgpf(
      i_id = ls_update-InventoryId ).   " ← non-blocking, runs after commit
  ENDLOOP.
ENDMETHOD.
```

---

### ❌ AP-PERF-05: Side effects thiếu → Fiori reload toàn entity

```abap
" ❌ WRONG — không khai báo side effects
define behavior for Z_I_Travel ... {
  determination setTotalPrice on modify { field BookingFee; }
  " Side effects không khai báo → Fiori không biết TotalPrice thay đổi
  " → Fiori reload toàn bộ entity sau mỗi change → nhiều round-trips
}

" ✅ CORRECT
define behavior for Z_I_Travel ... {
  determination setTotalPrice on modify { field BookingFee; }

  side effects {
    field BookingFee affects field TotalPrice;   " ← Fiori chỉ reload TotalPrice
  }
}
```

---

### ❌ AP-PERF-06: SELECT ALL FIELDS trong validation với large tables

```abap
" ❌ WRONG — load tất cả fields, chỉ cần 1
SELECT FROM zcustomer
  FIELDS *              " ← load tất cả columns
  FOR ALL ENTRIES IN @lt_fae
  WHERE customer_id = @lt_fae-customer_id
  INTO TABLE @DATA(lt_custs).

" ✅ CORRECT
SELECT FROM zcustomer
  FIELDS customer_id    " ← chỉ field cần check existence
  FOR ALL ENTRIES IN @lt_fae
  WHERE customer_id = @lt_fae-customer_id
  INTO TABLE @DATA(lt_custs).
```

---

## 13. Performance Checklist

```
BEHAVIOR POOL:
[ ] Không có EML (READ/MODIFY ENTITIES) bên trong LOOP
[ ] Action result: 1 bulk READ sau MODIFY, không READ trong LOOP
[ ] Validation DB check: dùng FAE pattern, không SELECT in LOOP
[ ] FAE input: DISCARDING DUPLICATES + DELETE IS INITIAL trước FAE
[ ] Lookup tables: dùng SORTED TABLE với binary search key
[ ] field_symbols hoặc DATA(...) thay vì work area copy trong large LOOP

CDS:
[ ] Aggregation (SUM, COUNT) → trong CDS, không trong ABAP LOOP
[ ] Multi-table join → CDS join, không ABAP nested loop
[ ] Virtual elements chỉ dùng cho simple calc, không DB call bên trong
[ ] List page fields: không có heavy virtual elements

DRAFT:
[ ] Activate optimized dùng thay vì Activate (large BOs)
[ ] Side effects khai báo cho tất cả determination outputs
[ ] (always) trong Prepare chỉ cho critical validations

BACKGROUND:
[ ] Long-running tasks (>2s) → bgPF trong save_modified
[ ] bgPF class implement IF_SERIALIZABLE_OBJECT
[ ] bgPF result được update qua EML (external consumer) sau commit

TOOLS:
[ ] ST05 trace chạy để verify không có N+1 queries
[ ] SAT run để identify top time-consuming methods
[ ] ATC PERFORMANCE checks pass
```

---

## 14. Sources

| Source | URL | Nội dung |
|---|---|---|
| SAP Help — bgPF | https://help.sap.com/docs/abap-cloud/abap-concepts/background-processing-framework | bgPF API, IF_SERIALIZABLE_OBJECT |
| SAP Community — bgPF intro | https://community.sap.com/t5/technology-blog-posts-by-sap/introducing-the-background-processing-framework/ba-p/13579056 | bgPF concepts, use cases |
| GitHub — bgPF + Side Effects sample | https://github.com/SAP-samples/abap-platform-bgpf-appl-log-events-side-effects | Full code sample với bgPF |
| SAP Community — Virtual Elements performance | https://community.sap.com/t5/application-development-and-automation-blog-posts/enhancing-rap-performance-the-impact-of-virtual-elements-on-key-metrics/ba-p/14005353 | Virtual element impact analysis |
| SAP Community — HANA tuning & Entity Buffer | https://community.sap.com/t5/technology-blog-posts-by-sap/sap-hana-and-abap-performance-tuning-a-guide-to-caches-and-buffers/ba-p/14318925 | Entity buffer, propagated buffer (S/4 2025) |
| SAP Community — Entity Buffer for config | https://community.sap.com/t5/technology-blog-posts-by-sap/how-to-enable-buffering-for-the-rap-bo-of-a-customizing-table/ba-p/14121303 | How to enable entity buffer |
| abapeur.fr — Side Effects | https://abapeur.fr/en/side-effects-what-is-this-spell/ | Side effects, UI round-trip reduction |
| abapeur.fr — bgPF guide | https://abapeur.fr/en/background-process-framework-bgpf-whats-it-all-about/ | bgPF practical guide |
| SAP Tutorial — FAE in validation | https://developers.sap.com/tutorials/abap-environment-rap100-validation.html | FAE pattern in validateCustomer |
| elearningsolutions.co.in — RAP perf tips | https://www.elearningsolutions.co.in/performance-optimization-tips-for-rap/ | General RAP performance overview |