# ABAP Core — Modern Syntax

> **Đọc file này khi:** user hỏi về inline declarations, constructor expressions (VALUE, COND, SWITCH,
> REDUCE, FILTER, CORRESPONDING, NEW, CAST, CONV, REF), string templates, table expressions,
> LOOP AT … WHERE, LOOP AT … GROUP BY, ASSIGNING FIELD-SYMBOL, shorthand assignments (`+=`, `&&=`),
> hoặc bất kỳ câu hỏi "làm sao viết X theo kiểu modern ABAP / clean ABAP".

> **Availability:** Hầu hết syntax trong file này available từ **ABAP 7.40+** (S/4HANA 1809+).
> Một số feature (REDUCE, GROUP BY) từ **7.50+**. Xem từng section để biết version cụ thể.
> Classic ABAP (ECC ≤ 7.52) hỗ trợ hầu hết nhưng cần kiểm tra từng feature.

---

## Table of Contents

1. [Inline Declarations](#1-inline-declarations)
2. [Constructor Expressions — VALUE và NEW](#2-constructor-expressions--value-và-new)
3. [Constructor Expressions — COND và SWITCH](#3-constructor-expressions--cond-và-switch)
4. [Constructor Expressions — REDUCE](#4-constructor-expressions--reduce)
5. [Constructor Expressions — FILTER](#5-constructor-expressions--filter)
6. [Constructor Expressions — CORRESPONDING](#6-constructor-expressions--corresponding)
7. [Constructor Expressions — CAST, CONV, REF](#7-constructor-expressions--cast-conv-ref)
8. [String Templates](#8-string-templates)
9. [Table Expressions](#9-table-expressions)
10. [LOOP AT — Modern Variants](#10-loop-at--modern-variants)
11. [Shorthand Assignments](#11-shorthand-assignments)
12. [Predicative Method Calls](#12-predicative-method-calls)
13. [Anti-Patterns](#13-anti-patterns)
14. [Sources](#14-sources)

---

## 1. Inline Declarations

**Available from:** ABAP 7.40

Khai báo biến ngay tại chỗ dùng — không cần `DATA` block ở đầu method.

```abap
" ✅ Inline declaration với DATA(...)
LOOP AT lt_travels INTO DATA(ls_travel).
  " ls_travel được khai báo và typed tự động từ lt_travels
ENDLOOP.

" ✅ Inline với SELECT
SELECT travel_id, agency_id, status
  FROM ztravel
  WHERE status = 'O'
  INTO TABLE @DATA(lt_open_travels).

" ✅ Inline với method call
DATA(lv_user) = cl_abap_context_info=>get_user_alias( ).

" ✅ Inline field symbol
LOOP AT lt_travels ASSIGNING FIELD-SYMBOL(<ls_travel>).
  <ls_travel>-status = 'X'.   " modify in-place, no MODIFY needed
ENDLOOP.

" ✅ Inline với READ TABLE
READ TABLE lt_travels ASSIGNING FIELD-SYMBOL(<ls>)
  WITH KEY travel_id = lv_id.
IF sy-subrc = 0.
  <ls>-status = 'A'.
ENDIF.
```

```abap
" ❌ Classic — verbose, khai báo xa nơi dùng
DATA ls_travel TYPE zs_travel.
DATA lt_open_travels TYPE TABLE OF zs_travel.
DATA lv_user TYPE syuname.

LOOP AT lt_travels INTO ls_travel.
  ...
ENDLOOP.

SELECT travel_id, agency_id, status
  FROM ztravel
  INTO TABLE lt_open_travels.

lv_user = sy-uname.
```

> ⚠️ **Lưu ý:** Biến khai báo inline có scope từ điểm khai báo đến cuối enclosing block (method/loop).
> Không thể tái khai báo cùng tên trong cùng scope.

---

## 2. Constructor Expressions — VALUE và NEW

**Available from:** ABAP 7.40

### VALUE — tạo structure hoặc internal table inline

```abap
" ✅ Tạo structure
DATA(ls_travel) = VALUE zs_travel(
  travel_id  = '000001'
  agency_id  = 'AG001'
  begin_date = '20250101'
  end_date   = '20250110'
  status     = 'O'
).

" ✅ Tạo internal table với nhiều rows
DATA(lt_travels) = VALUE ztt_travel(
  ( travel_id = '000001' agency_id = 'AG001' status = 'O' )
  ( travel_id = '000002' agency_id = 'AG002' status = 'A' )
).

" ✅ Chung factor (factor hoist) — field chung viết 1 lần
DATA(lt_range) = VALUE RANGE OF s_travel_id(
  sign   = 'I'
  option = 'EQ'
  ( low = '000001' )
  ( low = '000002' )
  ( low = '000003' )
).

" ✅ BASE — append vào table/structure hiện có
DATA(lt_more) = VALUE ztt_travel(
  BASE lt_travels                           " giữ nguyên rows cũ
  ( travel_id = '000003' status = 'X' )    " thêm row mới
).

" ✅ BASE cho structure — override chỉ 1 field
DATA(ls_updated) = VALUE zs_travel(
  BASE ls_travel
  status = 'A'             " chỉ đổi status, các field khác giữ nguyên
).

" ✅ VALUE với FOR loop
DATA(lt_ids) = VALUE ztt_travel_id(
  FOR ls IN lt_travels
  ( travel_id = ls-travel_id )
).
```

### NEW — tạo object reference inline

```abap
" ✅ Tạo object không cần helper variable
DATA(lo_processor) = NEW zcl_travel_processor(
  travel_repository = lo_repo
).

" ✅ Chain ngay sau NEW (không cần DATA variable nếu chỉ dùng 1 lần)
NEW zcl_travel_processor( lo_repo )->process( ls_travel ).

" ✅ NEW thay CREATE OBJECT (ABAP Cloud: CREATE OBJECT bị cảnh báo)
" ❌ Classic:
" CREATE OBJECT lo_processor EXPORTING travel_repository = lo_repo.
```

---

## 3. Constructor Expressions — COND và SWITCH

**Available from:** ABAP 7.40

### COND — điều kiện phức tạp (nhiều conditions khác nhau)

```abap
" ✅ COND thay IF/ELSEIF/ENDIF
DATA(lv_priority_text) = COND string(
  WHEN ls_travel-priority > 3 AND ls_travel-due_date <= sy-datum THEN 'Critical'
  WHEN ls_travel-priority > 2                                     THEN 'Medium'
  ELSE                                                                 'Low'
).

" ✅ Trong string template
out->write( |Status: { COND #(
  WHEN ls_travel-status = 'O' THEN 'Open'
  WHEN ls_travel-status = 'A' THEN 'Accepted'
  WHEN ls_travel-status = 'X' THEN 'Cancelled'
  ELSE                              'Unknown'
) }| ).

" ✅ COND với abap_true / abap_false
DATA(lv_is_overdue) = COND abap_bool(
  WHEN ls_travel-end_date < sy-datum
   AND ls_travel-status  <> 'X'  THEN abap_true
  ELSE                                 abap_false
).
```

```abap
" ❌ Classic — verbose
DATA lv_priority_text TYPE string.
IF ls_travel-priority > 3 AND ls_travel-due_date <= sy-datum.
  lv_priority_text = 'Critical'.
ELSEIF ls_travel-priority > 2.
  lv_priority_text = 'Medium'.
ELSE.
  lv_priority_text = 'Low'.
ENDIF.
```

### SWITCH — mapping 1 field sang nhiều giá trị

```abap
" ✅ SWITCH thay CASE/ENDCASE khi map 1 variable → 1 value
DATA(lv_status_text) = SWITCH string( ls_travel-status
  WHEN 'O' THEN 'Open'
  WHEN 'A' THEN 'Accepted'
  WHEN 'X' THEN 'Cancelled'
  ELSE          'Unknown'
).

" ✅ SWITCH trực tiếp trong method call
notify_agency(
  agency_id = ls_travel-agency_id
  message   = SWITCH #( ls_travel-status
                WHEN 'A' THEN 'Your travel was accepted'
                WHEN 'X' THEN 'Your travel was cancelled'
                ELSE          'Travel status changed' )
).
```

> **COND vs SWITCH:**
> - `COND` → nhiều conditions độc lập, mỗi WHEN có thể check field khác nhau
> - `SWITCH` → map 1 field/variable sang nhiều giá trị (cleaner khi source cùng 1 field)

---

## 4. Constructor Expressions — REDUCE

**Available from:** ABAP 7.50

Tính 1 giá trị tổng hợp từ nội dung internal table (aggregation).

```abap
" ✅ Sum — tính tổng
DATA(lv_total_price) = REDUCE p_length_10_dec2(
  INIT total = CONV p( '0.00' )
  FOR ls IN lt_bookings
  NEXT total += ls-flight_price
).

" ✅ String concatenation — nối các giá trị
DATA(lv_agency_list) = REDUCE string(
  INIT result TYPE string
       sep    TYPE string
  FOR ls IN lt_travels
  NEXT result &&= sep && ls-agency_id
       sep     = ', '
).
" Result: 'AG001, AG002, AG003'

" ✅ Count với WHERE filter
DATA(lv_open_count) = REDUCE i(
  INIT count = 0
  FOR ls IN lt_travels WHERE ( status = 'O' )
  NEXT count += 1
).

" ✅ REDUCE tạo internal table (accumulator pattern)
DATA(lt_duplicates) = REDUCE ztt_travel(
  INIT result = VALUE ztt_travel( )
  FOR GROUPS grp OF ls IN lt_travels
    GROUP BY ls-agency_id
  NEXT result = COND #(
    WHEN GROUP SIZE > 1
    THEN VALUE #( BASE result ( agency_id = grp ) )
    ELSE result )
).
```

> ⚠️ **Lưu ý về readability:** REDUCE rất powerful nhưng complex REDUCE nesting làm code
> khó đọc và không thể debug trong ADT. Nếu logic phức tạp hơn 2-3 NEXT statements,
> cân nhắc dùng LOOP AT thay vì REDUCE.

---

## 5. Constructor Expressions — FILTER

**Available from:** ABAP 7.40 (cần sorted/hashed table)

Tạo internal table mới từ table hiện có dựa trên điều kiện.

```abap
" ✅ FILTER với WHERE — requires sorted/hashed table key
TYPES ztt_travel_sorted TYPE SORTED TABLE OF zs_travel
  WITH UNIQUE KEY travel_id
  WITH NON-UNIQUE SORTED KEY key_status COMPONENTS status.

SELECT travel_id, agency_id, status
  FROM ztravel
  INTO TABLE @DATA(lt_sorted_travels)
  ORDER BY travel_id.

" Filter chỉ lấy 'Open' travels
DATA(lt_open) = FILTER ztt_travel_sorted(
  lt_sorted_travels USING KEY key_status WHERE status = 'O'
).

" ✅ FILTER với IN ... WHERE — filter theo lookup table (như INNER JOIN)
DATA(lt_agency_filter) = VALUE RANGE OF zagency_id(
  ( sign = 'I' option = 'EQ' low = 'AG001' )
  ( sign = 'I' option = 'EQ' low = 'AG002' )
).
DATA(lt_filtered) = FILTER #( lt_sorted_travels
  IN lt_agency_filter
  WHERE agency_id = low     " join condition: agency_id = low field in range
).

" ✅ FILTER EXCEPT — lấy rows KHÔNG thỏa điều kiện
DATA(lt_non_open) = FILTER ztt_travel_sorted(
  lt_sorted_travels USING KEY key_status
  EXCEPT WHERE status = 'O'
).
```

```abap
" ❌ Classic — tạo empty table rồi loop/append
DATA lt_open TYPE TABLE OF zs_travel.
LOOP AT lt_travels INTO DATA(ls).
  IF ls-status = 'O'.
    APPEND ls TO lt_open.
  ENDIF.
ENDLOOP.
```

> ⚠️ **Constraint:** `FILTER` **bắt buộc** source table phải có sorted hoặc hashed key
> matching với WHERE condition. Dùng `FILTER` trên standard table mà không có key phù hợp
> → **syntax error** hoặc không thể compile.

---

## 6. Constructor Expressions — CORRESPONDING

**Available from:** ABAP 7.40

Copy fields có cùng tên giữa 2 structures hoặc tables khác nhau.

```abap
" ✅ Basic — copy field cùng tên
DATA(ls_target) = CORRESPONDING zs_travel_display( ls_travel_db ).
" Chỉ copy fields có cùng tên; fields khác giữ nguyên initial value

" ✅ BASE — copy + override với giá trị existing
DATA(ls_merged) = CORRESPONDING zs_travel_display(
  BASE ls_existing_display   " start từ existing values
  ls_travel_db               " override với fields cùng tên từ source
).

" ✅ MAPPING — map field có tên khác nhau
DATA(ls_mapped) = CORRESPONDING zs_travel_display(
  ls_travel_db
  MAPPING display_id   = travel_id    " display_id ← travel_id
          agency_name  = agency_id    " agency_name ← agency_id
).

" ✅ EXCEPT — bỏ qua field cụ thể khi copy
DATA(ls_no_price) = CORRESPONDING zs_travel_display(
  ls_travel_db
  EXCEPT total_price booking_count    " không copy 2 fields này
).

" ✅ MAPPING + EXCEPT kết hợp
DATA(ls_complex) = CORRESPONDING zs_travel_api(
  ls_travel_db
  MAPPING external_id = travel_id
  EXCEPT  internal_note audit_log     " sensitive fields excluded
).

" ✅ CORRESPONDING cho internal table
DATA(lt_display) = CORRESPONDING ztt_travel_display( lt_travels ).

" ✅ CORRESPONDING với lookup table (LEFT OUTER JOIN pattern) — 7.54+
DATA lt_lookup TYPE HASHED TABLE OF zs_agency WITH UNIQUE KEY agency_id.
SELECT agency_id, agency_name FROM zagency INTO TABLE @lt_lookup.

DATA(lt_with_agency) = CORRESPONDING ztt_travel_with_name(
  lt_travels FROM lt_lookup
  USING agency_id = agency_id
  MAPPING agency_name = agency_name
).
```

```abap
" ❌ Classic MOVE-CORRESPONDING
MOVE-CORRESPONDING ls_travel_db TO ls_target.
" Không hỗ trợ MAPPING/EXCEPT — phải gán từng field thủ công
```

---

## 7. Constructor Expressions — CAST, CONV, REF

**Available from:** ABAP 7.40

### CAST — downcast inline (thay `?=`)

```abap
" ✅ CAST — downcast không cần helper variable
DATA(lt_components) = CAST cl_abap_structdescr(
  cl_abap_typedescr=>describe_by_data( ls_travel )
)->get_components( ).

" ✅ CAST trong method chain
DATA(lo_handler) = CAST zif_travel_handler(
  lo_factory->get_handler( ls_travel-status )
).

" ❌ Classic downcast — cần helper variable
DATA lo_struct_descr TYPE REF TO cl_abap_structdescr.
DATA(lo_type_descr) = cl_abap_typedescr=>describe_by_data( ls_travel ).
lo_struct_descr ?= lo_type_descr.   " ?= = downcast operator
DATA(lt_components) = lo_struct_descr->get_components( ).
```

### CONV — type conversion inline

```abap
" ✅ CONV — tránh tạo helper variable chỉ để convert type
my_method( iv_date = CONV d( sy-datum ) ).

" ✅ CONV cho ALPHA conversion (thay CALL FUNCTION 'CONVERSION_EXIT_ALPHA_INPUT')
" Note: Trong ABAP Cloud — xem released-classes.md cho alternative
DATA(lv_matnr_padded) = CONV matnr( lv_matnr_ext ).
" Hoặc dùng string template:
DATA(lv_display) = |{ lv_matnr ALPHA = OUT }|.   " ← preferred in Cloud

" ❌ Classic
DATA lv_date_char TYPE d.
lv_date_char = sy-datum.
my_method( iv_date = lv_date_char ).
```

### REF — tạo data reference

```abap
" ✅ REF — lấy reference đến biến
DATA(lr_travel) = REF #( ls_travel ).
" lr_travel->travel_id = '000001'.  " modify thông qua reference

" ✅ REF thay GET REFERENCE OF
" ❌ Classic: GET REFERENCE OF ls_travel INTO lr_travel.
```

---

## 8. String Templates

**Available from:** ABAP 7.0 (cơ bản), formatting options từ **7.40+**

String templates dùng `|...|` với embedded expressions trong `{ }`.

### Basic Usage

```abap
" ✅ Basic interpolation — thay CONCATENATE
DATA(lv_msg) = |Travel { ls_travel-travel_id } created by { lv_user }|.

" ✅ Số học trong template
DATA(lv_summary) = |Total: { lv_count } bookings, price: { lv_price }|.

" ✅ Method call trong template
DATA(lv_info) = |User: { cl_abap_context_info=>get_user_alias( ) }|.

" ✅ COND/SWITCH trong template
DATA(lv_label) = |Status: { SWITCH #( ls_travel-status
  WHEN 'O' THEN 'Open'
  WHEN 'A' THEN 'Accepted'
  ELSE          'Unknown' ) }|.
```

### Formatting Options

```abap
" ✅ Number formatting
DATA(lv_price_str) = |Price: { lv_price DECIMALS = 2 }|.           " 2 decimal places
DATA(lv_aligned)   = |{ lv_text WIDTH = 20 ALIGN = LEFT PAD = '.' }|. " padding

" ✅ Date/Time formatting
DATA(lv_date_str)  = |Date: { sy-datum DATE = USER }|.     " user locale format
DATA(lv_time_str)  = |Time: { sy-uzeit TIME = USER }|.     " user locale format
DATA(lv_ts_str)    = |TS: { lv_timestamp TIMESTAMP = USER }|.

" ✅ ALPHA conversion trong template (preferred over CALL FUNCTION in Cloud)
DATA(lv_kunnr_ext) = |{ lv_kunnr ALPHA = OUT }|.   " internal → external (remove leading zeros)
DATA(lv_kunnr_int) = |{ lv_kunnr_raw ALPHA = IN }|. " external → internal (add leading zeros)

" ✅ Multiline text (thay CL_ABAP_CHAR_UTILS=>CR_LF)
DATA(lv_multiline) = |Line 1\nLine 2\nLine 3|.     " \n = LF
DATA(lv_windows)   = |Line 1\r\nLine 2|.           " \r\n = CRLF

" ✅ Escape special characters
DATA(lv_escaped) = |Use \{ and \} for curly braces; \| for pipe|.
```

```abap
" ❌ Classic — verbose string building
DATA lv_msg TYPE string.
DATA lv_id_c TYPE c LENGTH 6.
lv_id_c = ls_travel-travel_id.
CONCATENATE 'Travel' lv_id_c 'created by' lv_user INTO lv_msg SEPARATED BY ' '.
```

---

## 9. Table Expressions

**Available from:** ABAP 7.40

Access row trực tiếp bằng key — thay `READ TABLE`.

```abap
" ✅ Table expression — read row bằng key (raises cx_sy_itab_line_not_found nếu không tìm thấy!)
DATA(ls_travel)  = lt_travels[ travel_id = '000001' ].
DATA(lv_status)  = lt_travels[ travel_id = '000001' ]-status.  " read single field
DATA(lv_agency)  = lt_travels[ 1 ]-agency_id.                  " read by index

" ✅ Safe access với optional operator — trả về initial nếu không tìm thấy
DATA(lv_status_safe) = VALUE #( lt_travels[ travel_id = '000001' ]-status OPTIONAL ).
" hoặc với default value:
DATA(lv_status_def) = VALUE #( lt_travels[ travel_id = '000001' ]-status DEFAULT 'U' ).

" ✅ Modify row in-place qua table expression
lt_travels[ travel_id = '000001' ]-status = 'A'.
" (works nếu lt_travels không phải SORTED table với travel_id là key và status không phải key field)

" ✅ Check existence với line_exists( )
IF line_exists( lt_travels[ travel_id = '000001' ] ).
  ...
ENDIF.

" ✅ line_index( ) — lấy index của row
DATA(lv_idx) = line_index( lt_travels[ travel_id = '000001' ] ).
" Returns 0 nếu không tìm thấy (không raise exception)

" ✅ Dùng secondary key
DATA(ls_by_agency) = lt_sorted_travels[ KEY key_agency agency_id = 'AG001' ].
```

```abap
" ❌ Classic READ TABLE
READ TABLE lt_travels INTO DATA(ls_travel) WITH KEY travel_id = '000001'.
IF sy-subrc = 0.
  ...
ENDIF.
```

> ⚠️ **Exception handling:** Table expression `lt_tab[ ... ]` raises `cx_sy_itab_line_not_found`
> nếu row không tồn tại. Luôn dùng `VALUE #( ... OPTIONAL )` hoặc `line_exists( )` guard
> khi không chắc row có tồn tại hay không.

---

## 10. LOOP AT — Modern Variants

### ASSIGNING FIELD-SYMBOL — modify in-place (no copy)

```abap
" ✅ Modify rows in-place — nhanh hơn LOOP INTO vì không copy
LOOP AT lt_travels ASSIGNING FIELD-SYMBOL(<ls_travel>).
  <ls_travel>-status = 'X'.
  <ls_travel>-last_changed = sy-datum.
ENDLOOP.

" ✅ WHERE filter — chỉ process rows thỏa điều kiện (hiệu quả hơn IF bên trong loop)
LOOP AT lt_travels ASSIGNING FIELD-SYMBOL(<ls>)
  WHERE status = 'O' AND begin_date < sy-datum.
  <ls>-status = 'X'.  " close overdue travels
ENDLOOP.

" ✅ Dùng secondary key để iterate in key order
LOOP AT lt_travels INTO DATA(ls) USING KEY key_agency.
  " iterates in key_agency sort order
ENDLOOP.
```

### LOOP AT GROUP BY — grouping

**Available from:** ABAP 7.50

```abap
" ✅ GROUP BY — aggregate theo key
LOOP AT lt_travels INTO DATA(ls_travel)
  GROUP BY ( agency_id = ls_travel-agency_id
             size      = GROUP SIZE          " number of rows in group
             index     = GROUP INDEX )       " group sequential index
  ASSIGNING FIELD-SYMBOL(<grp>).

  DATA(lv_total) = REDUCE p( INIT s = CONV p( '0' )
                              FOR <m> IN GROUP <grp>
                              NEXT s += <m>-total_price ).

  out->write( |Agency { <grp>-agency_id }: { <grp>-size } travels, total { lv_total }| ).
ENDLOOP.

" ✅ LOOP AT GROUP — member loop
LOOP AT lt_bookings INTO DATA(ls_booking)
  GROUP BY ls_booking-travel_id
  INTO DATA(grp_key).

  " Iterate members of this group
  LOOP AT GROUP grp_key ASSIGNING FIELD-SYMBOL(<member>).
    " process each booking in this travel group
  ENDLOOP.
ENDLOOP.
```

```abap
" ❌ Classic grouping — manual tracking
DATA lv_prev_agency TYPE zagency_id.
SORT lt_travels BY agency_id.
LOOP AT lt_travels INTO DATA(ls).
  IF ls-agency_id <> lv_prev_agency.
    " new group — process group header
    lv_prev_agency = ls-agency_id.
  ENDIF.
  " process member
ENDLOOP.
```

---

## 11. Shorthand Assignments

**Available from:** ABAP 7.54 (S/4HANA 1909+)

```abap
" ✅ Arithmetic shorthand
lv_count += 1.          " lv_count = lv_count + 1.
lv_total -= lv_discount." lv_total = lv_total - lv_discount.
lv_price *= 1.1.        " lv_price = lv_price * 1.1.
lv_rate  /= 100.        " lv_rate  = lv_rate  / 100.

" ✅ String concatenation shorthand
lv_html &&= |<br>{ lv_line }|.  " lv_html = lv_html && |<br>{ lv_line }|.

" ✅ Kết hợp với expressions
DATA(lv_total) = CONV p( '0.00' ).
LOOP AT lt_bookings INTO DATA(ls).
  lv_total += ls-price * ls-seats.
ENDLOOP.
```

---

## 12. Predicative Method Calls

**Available from:** ABAP 7.40

Method trả về non-initial value = TRUE trong IF statement.

```abap
" ✅ Predicative call — cleaner boolean check
IF is_valid_travel( ls_travel ).     " TRUE nếu method RETURNING value IS NOT INITIAL
  ...
ENDIF.

IF has_open_bookings( lv_travel_id ).
  ...
ENDIF.

" ✅ Negation
IF NOT is_cancelled( ls_travel ).
  ...
ENDIF.

" ❌ Verbose alternative (equivalently correct, just longer)
IF is_valid_travel( ls_travel ) = abap_true.
  ...
ENDIF.
```

> **Rule:** Method phải có `RETURNING` parameter. Return value IS INITIAL → FALSE; IS NOT INITIAL → TRUE.
> Best practice: return `abap_bool` type cho clarity.

---

## 13. Anti-Patterns

### MS-AP-01 🟠 — Nested constructor expressions quá phức tạp

```abap
" ❌ WRONG — khó đọc, khó debug (không thể debug trong ADT!)
DATA(lt_result) = REDUCE ztt_result(
  INIT r = VALUE ztt_result( )
  FOR GROUPS grp OF ls IN FILTER #( lt_orders WHERE status = 'O' )
    GROUP BY ls-customer_id
  NEXT r = VALUE #( BASE r
    ( customer_id = grp
      total = REDUCE p( INIT s = CONV p( '0' )
                        FOR <m> IN GROUP grp
                        NEXT s += <m>-amount * CONV p( <m>-qty ) ) ) ) ).

" ✅ CORRECT — tách thành nhiều bước rõ ràng
DATA(lt_open_orders) = FILTER #( lt_orders WHERE status = 'O' ).  " step 1

LOOP AT lt_open_orders INTO DATA(ls_order)                         " step 2
  GROUP BY ls_order-customer_id INTO DATA(lv_customer).
  DATA(lv_total) = REDUCE p(                                       " step 3
    INIT s = CONV p( '0' )
    FOR <m> IN GROUP lv_customer
    NEXT s += <m>-amount * CONV p( <m>-qty ) ).
  APPEND VALUE zs_result(                                          " step 4
    customer_id = lv_customer total = lv_total ) TO lt_result.
ENDLOOP.
```

---

### MS-AP-02 🔴 — Table expression không guard exception

```abap
" ❌ WRONG — raises cx_sy_itab_line_not_found nếu không tìm thấy → DUMP
DATA(ls_travel) = lt_travels[ travel_id = lv_id ].
DATA(lv_status) = lt_travels[ travel_id = lv_id ]-status.

" ✅ CORRECT — option A: OPTIONAL/DEFAULT
DATA(lv_status) = VALUE #( lt_travels[ travel_id = lv_id ]-status OPTIONAL ).
                          " → returns '' nếu không tìm thấy

DATA(lv_status) = VALUE #( lt_travels[ travel_id = lv_id ]-status DEFAULT 'U' ).
                          " → returns 'U' nếu không tìm thấy

" ✅ CORRECT — option B: kiểm tra trước
IF line_exists( lt_travels[ travel_id = lv_id ] ).
  DATA(ls) = lt_travels[ travel_id = lv_id ].
ENDIF.

" ✅ CORRECT — option C: TRY/CATCH (khi cần biết rõ lý do không tìm thấy)
TRY.
    DATA(ls_travel) = lt_travels[ travel_id = lv_id ].
  CATCH cx_sy_itab_line_not_found.
    " handle not found
ENDTRY.
```

---

### MS-AP-03 🟠 — FILTER trên standard table không có key

```abap
" ❌ WRONG — FILTER yêu cầu sorted/hashed key → syntax error hoặc không compile
TYPES ztt_standard TYPE STANDARD TABLE OF zs_travel WITH EMPTY KEY.
DATA(lt_open) = FILTER #( lt_standard_table WHERE status = 'O' ).
"                                              ↑ syntax error: key not found for WHERE

" ✅ CORRECT — Option A: dùng sorted/hashed table với matching key
TYPES ztt_sorted TYPE SORTED TABLE OF zs_travel
  WITH NON-UNIQUE SORTED KEY key_status COMPONENTS status.

DATA(lt_open) = FILTER ztt_sorted( lt_sorted WHERE status = 'O' ).

" ✅ CORRECT — Option B: nếu chỉ có standard table, dùng LOOP WHERE thay thế
LOOP AT lt_standard_table INTO DATA(ls) WHERE status = 'O'.
  APPEND ls TO lt_open.
ENDLOOP.
```

---

### MS-AP-04 🟡 — CORRESPONDING không kiểm soát field mapping

```abap
" ❌ RISKY — CORRESPONDING copy TẤT CẢ field cùng tên kể cả field nhạy cảm
DATA(ls_api_output) = CORRESPONDING zs_travel_api( ls_travel_db ).
" → có thể vô tình copy: internal_note, audit_log, system_key ...

" ✅ CORRECT — dùng EXCEPT để loại trừ field nhạy cảm
DATA(ls_api_output) = CORRESPONDING zs_travel_api(
  ls_travel_db
  EXCEPT internal_note audit_log system_key
).
```

---

### MS-AP-05 🟡 — Dùng CONV thay vì string template ALPHA

```abap
" ⚠️ CAUTION (ABAP Cloud) — CONV matnr( ) dùng DDIC domain conversion
" Trong ABAP Cloud, cần dùng released API thay vì domain implicit conversion
DATA(lv_matnr_padded) = CONV matnr( lv_matnr_raw ).

" ✅ PREFERRED in ABAP Cloud — string template ALPHA (available everywhere)
DATA(lv_kunnr_ext) = |{ lv_kunnr ALPHA = OUT }|.   " remove leading zeros
DATA(lv_kunnr_int) = |{ lv_kunnr_raw ALPHA = IN }|. " add leading zeros
```

---

### MS-AP-06 🟢 — Overuse COND/SWITCH làm mất readability

```abap
" ❌ WRONG — quá phức tạp cho 1 expression, nên tách thành method
DATA(lv_result) = COND string(
  WHEN a > 0 AND b < c AND d = e AND strlen( f ) > 3 THEN
    SWITCH #( g WHEN 1 THEN 'X' WHEN 2 THEN 'Y' ELSE 'Z' )
  WHEN h IS NOT INITIAL AND i = abap_true THEN
    COND #( WHEN j > k THEN 'P' ELSE 'Q' )
  ELSE 'N/A'
).

" ✅ CORRECT — tách thành method với tên có ý nghĩa
DATA(lv_result) = determine_result_code(
  a = lv_a b = lv_b status = ls_status
).
```

---

## 14. Sources

| Topic | URL |
|---|---|
| Constructor Expressions (SAP Help) | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenconstructor_expressions.htm |
| VALUE operator | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenconstructor_expression_value.htm |
| COND operator | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenconditional_expression_cond.htm |
| SWITCH operator | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenconditional_expression_switch.htm |
| REDUCE operator | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenconstructor_expression_reduce.htm |
| FILTER operator | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenconstructor_expression_filter.htm |
| CORRESPONDING operator | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenconstructor_expr_corresponding.htm |
| CAST operator | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenconstructor_expression_cast.htm |
| CONV operator | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenconstructor_expression_conv.htm |
| String Templates | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenstring_templates.htm |
| String Template Format Options | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abapcompute_string_format_options.htm |
| Inline Declarations | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abeninline_declarations.htm |
| LOOP AT GROUP BY (SAP Help) | https://help.sap.com/doc/abapdocu_752_index_htm/7.52/en-US/abaploop_at_group.htm |
| LOOP AT GROUP BY (Examples) | https://help.sap.com/doc/abapdocu_752_index_htm/7.52/en-US/abenloop_group_by_method_abexa.htm |
| Predicative Method Calls | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenpredicative_method_calls.htm |
| ABAP Cheat Sheet — Constructor Expressions | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/05_Constructor_Expressions.md |
| ABAP Cheat Sheet — Internal Tables | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/01_Internal_Tables.md |
| Clean ABAP — Modern Language Elements | https://github.com/SAP/styleguides/blob/main/clean-abap/sub-sections/ModernABAPLanguageElements.md |
| Brandeis Modern ABAP Cheat Sheet | https://www.brandeis.de/en/blog/cheat-sheet-modern-abap-en/ |