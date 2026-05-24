# ABAP Core — ABAP SQL (Open SQL)

> **Đọc file này khi:** user hỏi về SELECT statement, FOR ALL ENTRIES, JOIN, CTE (WITH...AS),
> UNION, GROUP BY, HAVING, OFFSET/FETCH NEXT (pagination), SQL expressions (CASE/COALESCE/CAST),
> database cursor, buffering, AMDP, N+1 query problem, performance của DB access,
> hoặc bất kỳ câu hỏi nào liên quan đến đọc/ghi dữ liệu từ database trong ABAP.

> **Version notes:**
> - **ABAP 7.40+**: `@host_variable`, `INTO @DATA(...)`, inline declarations trong SELECT
> - **ABAP 7.50+**: `UNION`, `UNION ALL`, `UNION DISTINCT`, host expressions `@( expr )`
> - **ABAP 7.51+**: CTE (`WITH +name AS (...)`), cross join, window functions (limited)
> - **ABAP 7.53+**: Renamed "Open SQL" → "ABAP SQL" officially; `FROM ... FIELDS ...` syntax
> - **ABAP Cloud**: `@` escape mandatory, `SELECT *` → ATC warning, direct DB write ngoài RAP = forbidden

---

## Table of Contents

1. [SELECT Cơ Bản — Đúng và Sai](#1-select-cơ-bản--đúng-và-sai)
2. [JOIN Patterns](#2-join-patterns)
3. [FOR ALL ENTRIES (FAE)](#3-for-all-entries-fae)
4. [Common Table Expressions — WITH...AS](#4-common-table-expressions--withas)
5. [UNION và UNION ALL](#5-union-và-union-all)
6. [GROUP BY, HAVING, Aggregate Functions](#6-group-by-having-aggregate-functions)
7. [SQL Expressions — CASE, COALESCE, CAST](#7-sql-expressions--case-coalesce-cast)
8. [Pagination — OFFSET / FETCH NEXT](#8-pagination--offset--fetch-next)
9. [Database Cursor — OPEN CURSOR / FETCH](#9-database-cursor--open-cursor--fetch)
10. [Subqueries](#10-subqueries)
11. [Table Buffering](#11-table-buffering)
12. [AMDP — Khi Nào Dùng](#12-amdp--khi-nào-dùng)
13. [Performance Decision Tree](#13-performance-decision-tree)
14. [Anti-Patterns](#14-anti-patterns)
15. [Sources](#15-sources)

---

## 1. SELECT Cơ Bản — Đúng và Sai

### Chỉ SELECT field cần thiết — không bao giờ `SELECT *`

```abap
" ✅ SELECT field cụ thể
SELECT travel_id,
       agency_id,
       begin_date,
       end_date,
       status,
       total_price
  FROM ztravel
  WHERE status = @lv_status
    AND begin_date >= @lv_date_from
  ORDER BY begin_date
  INTO TABLE @DATA(lt_travels).

" ✅ SELECT SINGLE — đọc 1 row theo full key
SELECT SINGLE travel_id, agency_id, status
  FROM ztravel
  WHERE travel_id = @lv_travel_id
  INTO @DATA(ls_travel).
IF sy-subrc <> 0.
  RAISE EXCEPTION TYPE zcx_not_found.
ENDIF.

" ❌ SELECT * — load tất cả fields dù không dùng
SELECT * FROM ztravel
  WHERE status = @lv_status
  INTO TABLE @DATA(lt_travels).
" → tốn network bandwidth, memory, HANA processing

" ❌ Classic syntax không có @ escape (ECC legacy, nhưng sẽ bị ATC warning trong Cloud)
SELECT travel_id agency_id
  FROM ztravel
  WHERE status = lv_status     " ← thiếu @ prefix
  INTO TABLE lt_travels.
```

### INTO TABLE vs APPENDING TABLE

```abap
" ✅ INTO TABLE — reset target table trước khi đổ data (thường dùng)
SELECT travel_id, status
  FROM ztravel
  WHERE agency_id = @lv_agency
  INTO TABLE @DATA(lt_travels).

" ✅ APPENDING TABLE — giữ data cũ, append thêm (dùng trong LOOP với pagination)
DATA lt_all_travels TYPE TABLE OF zs_travel.
DATA(lv_offset) = 0.
DO.
  SELECT travel_id, status
    FROM ztravel
    ORDER BY travel_id
    OFFSET @lv_offset ROWS
    FETCH NEXT 1000 ROWS ONLY
    APPENDING TABLE @lt_all_travels.   " ← APPENDING, không phải INTO
  IF sy-subrc <> 0 OR lines( lt_all_travels ) = 0. EXIT. ENDIF.
  lv_offset += 1000.
ENDDO.

" ✅ INTO CORRESPONDING FIELDS OF TABLE — khi SELECT field name ≠ structure field name
SELECT travel_id AS id, agency_id AS agency
  FROM ztravel
  INTO CORRESPONDING FIELDS OF TABLE lt_mapped.
```

### Host variables và expressions

```abap
" ✅ Host variable — @variable
DATA lv_status TYPE /dmo/overall_status VALUE 'O'.
SELECT travel_id FROM ztravel WHERE status = @lv_status INTO TABLE @DATA(lt).

" ✅ Host expression — @( expr ) (từ 7.50+)
SELECT travel_id FROM ztravel
  WHERE begin_date >= @( sy-datum - 30 )    " 30 days ago
  INTO TABLE @DATA(lt).

" ✅ Inline host table (join với internal table — FDA feature, HANA only)
" Không dùng cho production ABAP Cloud vì phụ thuộc HANA FDA setting
" Dùng FOR ALL ENTRIES thay thế (xem section 3)
```

---

## 2. JOIN Patterns

JOIN xử lý hoàn toàn trên database → ít roundtrip nhất → **preferred khi có thể**.

```abap
" ✅ INNER JOIN — chỉ lấy rows có match ở cả 2 bảng
SELECT t~travel_id,
       t~agency_id,
       t~begin_date,
       t~total_price,
       a~agency_name,
       a~country_code
  FROM ztravel AS t
  INNER JOIN zagency AS a ON a~agency_id = t~agency_id
  WHERE t~status = @lv_status
    AND t~begin_date >= @lv_date_from
  ORDER BY t~begin_date
  INTO TABLE @DATA(lt_result).

" ✅ LEFT OUTER JOIN — giữ tất cả rows bên trái dù không có match
SELECT t~travel_id,
       t~status,
       b~booking_id,          " NULL nếu không có booking
       b~flight_date
  FROM ztravel AS t
  LEFT OUTER JOIN zbooking AS b ON  b~travel_id = t~travel_id
                                AND b~status <> 'X'
  WHERE t~agency_id = @lv_agency
  INTO TABLE @DATA(lt_with_bookings).

" ✅ JOIN nhiều bảng
SELECT t~travel_id,
       t~begin_date,
       c~customer_name,
       a~agency_name,
       COUNT( b~booking_id ) AS booking_count
  FROM ztravel AS t
  INNER JOIN zcustomer AS c ON c~customer_id = t~customer_id
  INNER JOIN zagency   AS a ON a~agency_id   = t~agency_id
  LEFT OUTER JOIN zbooking AS b ON b~travel_id = t~travel_id
  WHERE t~status = 'O'
  GROUP BY t~travel_id, t~begin_date, c~customer_name, a~agency_name
  INTO TABLE @DATA(lt_summary).
```

### JOIN vs FOR ALL ENTRIES — khi nào dùng cái nào?

```
JOIN:
  ✅ Khi cả 2 tables đều là DB tables/CDS views
  ✅ Khi cần aggregate (COUNT, SUM) từ nhiều tables
  ✅ Khi result set nhỏ đến trung bình
  ✅ ABAP Cloud preferred (1 roundtrip, HANA optimized)
  ⚠️ Không dùng được khi "driving table" là internal table từ ABAP logic

FOR ALL ENTRIES:
  ✅ Khi driving data đã có trong internal table (từ ABAP logic)
  ✅ Khi cần mix ABAP-computed keys với DB lookup
  ⚠️ Yêu cầu IS NOT INITIAL check bắt buộc
  ⚠️ FAE tự deduplicate driving table keys → careful với duplicates
  ❌ Trên HANA với FDA disabled → fallback sang nhiều IN queries → chậm
```

---

## 3. FOR ALL ENTRIES (FAE)

### Pattern chuẩn — IS NOT INITIAL bắt buộc

```abap
" ✅ Chuẩn — kiểm tra IS NOT INITIAL trước FAE
" Step 1: Lấy driving keys từ ABAP logic / EML / FM result
DATA(lt_travel_keys) = get_relevant_travel_ids( ).  " returns SORTED TABLE

" Step 2: Guard — IS NOT INITIAL bắt buộc!
IF lt_travel_keys IS NOT INITIAL.
  SELECT travel_id, agency_id, status, total_price
    FROM ztravel
    FOR ALL ENTRIES IN @lt_travel_keys
    WHERE travel_id = @lt_travel_keys-travel_id
    INTO TABLE @DATA(lt_travels).
ENDIF.

" ❌ FAE không có IS NOT INITIAL check → FULL TABLE SCAN!
" Nếu lt_travel_keys INITIAL (empty) → WHERE clause bị bỏ qua hoàn toàn
" → SELECT TẤT CẢ rows trong table → có thể gây timeout hoặc memory overflow
SELECT travel_id, status FROM ztravel
  FOR ALL ENTRIES IN @lt_travel_keys        " ← DANGEROUS nếu lt_travel_keys rỗng
  WHERE travel_id = @lt_travel_keys-travel_id
  INTO TABLE @DATA(lt_travels).
```

### FAE và duplicate handling

```abap
" ⚠️ FAE tự deduplicate keys trong driving table
" Nếu lt_keys có duplicate travel_id → FAE chỉ query 1 lần
" Nhưng result table sẽ chỉ có 1 row per travel_id (không nhân lên theo duplicates)

DATA lt_keys TYPE TABLE OF zs_travel_key.
APPEND VALUE #( travel_id = '000001' ) TO lt_keys.
APPEND VALUE #( travel_id = '000001' ) TO lt_keys.  " duplicate
APPEND VALUE #( travel_id = '000002' ) TO lt_keys.

" FAE sẽ query với effective keys: '000001', '000002' (dedup tự động)
IF lt_keys IS NOT INITIAL.
  SELECT travel_id, status FROM ztravel
    FOR ALL ENTRIES IN @lt_keys
    WHERE travel_id = @lt_keys-travel_id
    INTO TABLE @DATA(lt_result).
ENDIF.
" lt_result: 2 rows (travel_id 000001 và 000002), không phải 3

" ✅ Nếu cần deduplicate driving table trước (để match count):
SORT lt_keys BY travel_id.
DELETE ADJACENT DUPLICATES FROM lt_keys COMPARING travel_id.
```

### FAE với nhiều key fields

```abap
" ✅ FAE với composite key — tất cả key fields phải map
TYPES: BEGIN OF ty_booking_key,
         travel_id  TYPE /dmo/travel_id,
         booking_id TYPE /dmo/booking_id,
       END OF ty_booking_key.
DATA lt_booking_keys TYPE TABLE OF ty_booking_key.

IF lt_booking_keys IS NOT INITIAL.
  SELECT travel_id, booking_id, flight_date, seat_class
    FROM zbooking
    FOR ALL ENTRIES IN @lt_booking_keys
    WHERE travel_id  = @lt_booking_keys-travel_id
      AND booking_id = @lt_booking_keys-booking_id  " cả 2 key fields
    INTO TABLE @DATA(lt_bookings).
ENDIF.
```

---

## 4. Common Table Expressions — WITH...AS

**Available from: ABAP 7.51**

CTE cho phép định nghĩa "virtual tables" tạm thời trong query → tránh nested subquery phức tạp.

```abap
" ✅ CTE cơ bản — đặt tên CTE phải bắt đầu bằng +
WITH
  +open_travels AS (
    SELECT travel_id,
           agency_id,
           begin_date,
           total_price
      FROM ztravel
     WHERE status = 'O'
  ),
  +booking_counts AS (
    SELECT travel_id,
           COUNT( * )       AS booking_cnt,
           SUM( seat_price ) AS booking_total
      FROM zbooking
     WHERE status <> 'X'
     GROUP BY travel_id
  )
SELECT ot~travel_id,
       ot~agency_id,
       ot~begin_date,
       ot~total_price,
       bc~booking_cnt,
       bc~booking_total
  FROM +open_travels AS ot
  LEFT OUTER JOIN +booking_counts AS bc
    ON bc~travel_id = ot~travel_id
  ORDER BY ot~begin_date
  INTO TABLE @DATA(lt_result).

" ✅ CTE với UNION bên trong
WITH
  +all_locations AS (
    SELECT city_from AS city, country_from AS country FROM zflight
    UNION DISTINCT
    SELECT city_to   AS city, country_to   AS country FROM zflight
  )
SELECT city, country
  FROM +all_locations
  ORDER BY country, city
  INTO TABLE @DATA(lt_cities).

" ✅ CTE với column renaming — ( name1, name2, ... )
WITH
  +travel_summary( tid, cnt, total ) AS (
    SELECT travel_id,
           COUNT( * ),
           SUM( seat_price )
      FROM zbooking
     GROUP BY travel_id
  )
SELECT tid, cnt, total
  FROM +travel_summary
  WHERE cnt > 1
  INTO TABLE @DATA(lt_multi).

" ✅ CTE với loop (SELECT loop → dùng ENDWITH)
WITH
  +open_travels AS (
    SELECT travel_id, agency_id FROM ztravel WHERE status = 'O'
  )
SELECT travel_id, agency_id
  FROM +open_travels
  INTO @DATA(ls_travel).
  " ... process each row
ENDWITH.
```

> **Khi nào dùng CTE thay vì JOIN?**
> - Query phức tạp cần reference cùng 1 subquery nhiều lần → CTE tránh duplicate
> - Phân tích data theo nhiều giai đoạn (aggregation → filter → join) → CTE rõ hơn nested query
> - UNION bên trong subquery → CTE là cách clean nhất trong ABAP SQL

---

## 5. UNION và UNION ALL

**Available from: ABAP 7.50**

```abap
" ✅ UNION DISTINCT — loại bỏ duplicate rows (default khi dùng UNION không có keyword)
SELECT travel_id, agency_id, 'TRAVEL'  AS record_type FROM ztravel  WHERE status = 'O'
UNION DISTINCT
SELECT travel_id, agency_id, 'ARCHIVE' AS record_type FROM ztravel_archive WHERE year = '2024'
ORDER BY travel_id
INTO TABLE @DATA(lt_combined).

" ✅ UNION ALL — giữ tất cả rows kể cả duplicate (nhanh hơn DISTINCT vì không sort/dedup)
SELECT travel_id FROM ztravel   WHERE status = 'O'
UNION ALL
SELECT travel_id FROM ztravel_2 WHERE status = 'O'
INTO TABLE @DATA(lt_all).

" ✅ UNION trong CTE (xem Section 4)

" ⚠️ Constraints quan trọng:
" - Số columns và data types phải match giữa các SELECT
" - Column names lấy từ SELECT đầu tiên (bên trái)
" - CAST dùng để đồng nhất types khi cần
" - OFFSET/UP TO không dùng được cùng UNION trực tiếp → wrap trong CTE

" ✅ UNION + ORDER BY
SELECT carrid, connid, cityfrom, cityto FROM spfli WHERE carrid = 'LH'
UNION ALL
SELECT carrid, connid, cityfrom, cityto FROM spfli WHERE carrid = 'AA'
ORDER BY carrid, connid   " ORDER BY chỉ ở câu SELECT cuối cùng
INTO TABLE @DATA(lt_flights).

" ✅ CAST để sync types khi cần
SELECT FROM scarr
  FIELDS carrname,
         CAST( '-' AS CHAR( 4 ) ) AS connid   " scarr không có connid → fake column
WHERE carrid = 'LH'
UNION ALL
SELECT FROM spfli
  FIELDS '-' AS carrname,
         CAST( connid AS CHAR( 4 ) ) AS connid
WHERE carrid = 'LH'
INTO TABLE @DATA(lt_union_result).
```

---

## 6. GROUP BY, HAVING, Aggregate Functions

```abap
" ✅ GROUP BY với aggregate functions
SELECT agency_id,
       COUNT( * )            AS travel_count,
       SUM( total_price )    AS revenue,
       AVG( total_price )    AS avg_price,
       MAX( begin_date )     AS latest_travel,
       MIN( total_price )    AS min_price
  FROM ztravel
  WHERE status = 'O'
  GROUP BY agency_id
  ORDER BY revenue DESCENDING
  INTO TABLE @DATA(lt_by_agency).

" ✅ HAVING — filter trên aggregate result (không thể dùng WHERE cho aggregate)
SELECT agency_id,
       COUNT( * )         AS travel_count,
       SUM( total_price ) AS revenue
  FROM ztravel
  GROUP BY agency_id
  HAVING COUNT( * ) > 5             " chỉ agencies có > 5 travels
     AND SUM( total_price ) > 10000 " VÀ revenue > 10000
  INTO TABLE @DATA(lt_active_agencies).

" ✅ GROUP BY + JOIN
SELECT t~agency_id,
       a~agency_name,
       COUNT( t~travel_id ) AS travel_count
  FROM ztravel AS t
  INNER JOIN zagency AS a ON a~agency_id = t~agency_id
  WHERE t~begin_date BETWEEN @lv_from AND @lv_to
  GROUP BY t~agency_id, a~agency_name
  HAVING COUNT( t~travel_id ) >= @lv_min_count
  ORDER BY travel_count DESCENDING
  INTO TABLE @DATA(lt_agency_stats).

" ⚠️ Aggregate functions có thể dùng:
"   COUNT( * ), COUNT( DISTINCT field )
"   SUM( field ), AVG( field ), MAX( field ), MIN( field )
"   STRING_AGG ( field, separator ) — HANA specific, 7.54+
```

---

## 7. SQL Expressions — CASE, COALESCE, CAST

Pushdown logic xuống HANA layer — tránh post-processing trong ABAP.

```abap
" ✅ CASE WHEN — conditional trong SELECT
SELECT travel_id,
       total_price,
       CASE status
         WHEN 'O' THEN 'Open'
         WHEN 'A' THEN 'Accepted'
         WHEN 'X' THEN 'Cancelled'
         ELSE          'Unknown'
       END AS status_text,
       CASE
         WHEN total_price > 5000 THEN 'Premium'
         WHEN total_price > 1000 THEN 'Standard'
         ELSE                         'Budget'
       END AS price_tier
  FROM ztravel
  INTO TABLE @DATA(lt_enriched).

" ✅ COALESCE — first non-null value (null-safe)
SELECT travel_id,
       COALESCE( description, memo, 'No description' ) AS display_text,
       COALESCE( confirmed_price, estimated_price, 0 ) AS price
  FROM ztravel
  INTO TABLE @DATA(lt).

" ✅ CAST — explicit type conversion trong SQL
SELECT travel_id,
       CAST( total_price AS CHAR( 15 ) )  AS price_text,
       CAST( begin_date  AS CHAR( 8 ) )   AS date_char,
       CAST( '2024'      AS NUMC( 4 ) )   AS year_num
  FROM ztravel
  INTO TABLE @DATA(lt_cast).

" ✅ Arithmetic expressions trong SELECT
SELECT travel_id,
       base_price,
       surcharge_pct,
       base_price * ( 1 + surcharge_pct / 100 ) AS total_price,
       end_date - begin_date                     AS duration_days
  FROM ztravel
  INTO TABLE @DATA(lt_calculated).

" ✅ String functions (HANA-specific, available via ABAP SQL)
SELECT travel_id,
       UPPER( agency_name )                AS agency_upper,
       LOWER( description )                AS desc_lower,
       LENGTH( description )               AS desc_len,
       SUBSTRING( travel_id, 1, 3 )        AS id_prefix,
       CONCAT( agency_id, '-', travel_id ) AS combined_key
  FROM ztravel AS t
  INNER JOIN zagency AS a ON a~agency_id = t~agency_id
  INTO TABLE @DATA(lt_strings).
```

---

## 8. Pagination — OFFSET / FETCH NEXT

**Available from: ABAP 7.54** (OFFSET với FETCH); `UP TO n ROWS` từ trước đó

```abap
" ✅ OFFSET + FETCH NEXT — proper pagination (từ 7.54)
" ORDER BY bắt buộc khi dùng OFFSET
METHODS get_travels_page
  IMPORTING page_number   TYPE i
            page_size     TYPE i DEFAULT 50
  RETURNING VALUE(result) TYPE ztt_travel.

METHOD get_travels_page.
  DATA(lv_offset) = ( page_number - 1 ) * page_size.

  SELECT travel_id, agency_id, begin_date, total_price, status
    FROM ztravel
    WHERE status <> 'X'
    ORDER BY begin_date DESCENDING, travel_id
    OFFSET @lv_offset ROWS
    FETCH NEXT @page_size ROWS ONLY
    INTO TABLE @result.
ENDMETHOD.

" ✅ UP TO n ROWS — simpler, từ lâu đời hơn (không cần ORDER BY ở versions cũ)
SELECT travel_id, begin_date
  FROM ztravel
  WHERE status = 'O'
  ORDER BY begin_date
  UP TO 100 ROWS          " lấy tối đa 100 rows đầu
  INTO TABLE @DATA(lt_top100).

" ⚠️ Constraints của OFFSET:
" - Phải có ORDER BY trước OFFSET
" - Không dùng được với UNION trực tiếp
" - Không dùng được với FOR ALL ENTRIES
" - Không dùng được với SINGLE
```

---

## 9. Database Cursor — OPEN CURSOR / FETCH

Dùng khi cần xử lý kết quả **theo từng batch** để tránh load toàn bộ vào memory.

```abap
" ✅ Database cursor pattern — xử lý large result set theo packages
DATA: db_cursor TYPE cursor,
      lt_batch  TYPE TABLE OF zs_travel.

OPEN CURSOR @db_cursor FOR
  SELECT travel_id, agency_id, total_price
    FROM ztravel
    WHERE status = 'O'
    ORDER BY travel_id.

DO.
  FETCH NEXT CURSOR @db_cursor
    INTO TABLE @lt_batch
    PACKAGE SIZE 500.     " đọc 500 rows mỗi lần

  IF sy-subrc <> 0.
    EXIT.   " no more data
  ENDIF.

  " Process batch
  process_travel_batch( lt_batch ).
  CLEAR lt_batch.
ENDDO.

CLOSE CURSOR @db_cursor.

" ⚠️ Lưu ý:
" - Max 17 cursors open đồng thời trong 1 program
" - DB COMMIT hoặc ROLLBACK tự đóng cursor!
" - Trong ABAP Cloud (RAP): COMMIT ENTITIES thay COMMIT WORK → cursor bị close
" - Dùng cursor khi: > 100.000 rows, hoặc processing từng batch cần DB roundtrip tránh memory
```

---

## 10. Subqueries

```abap
" ✅ Subquery trong WHERE — IN operator
SELECT travel_id, agency_id
  FROM ztravel
  WHERE agency_id IN (
    SELECT agency_id FROM zagency WHERE country_code = 'DE'
  )
  INTO TABLE @DATA(lt_german).

" ✅ Subquery EXISTS — check existence (không fetch data)
SELECT travel_id, total_price
  FROM ztravel AS t
  WHERE EXISTS (
    SELECT * FROM zbooking AS b
    WHERE b~travel_id = t~travel_id
      AND b~status <> 'X'
  )
  INTO TABLE @DATA(lt_with_bookings).

" ✅ Subquery trong HAVING
SELECT agency_id, COUNT( * ) AS cnt
  FROM ztravel
  GROUP BY agency_id
  HAVING COUNT( * ) > (
    SELECT AVG( cnt ) FROM (
      SELECT agency_id, COUNT( * ) AS cnt
        FROM ztravel GROUP BY agency_id
    )
  )
  INTO TABLE @DATA(lt_above_avg).

" ⚠️ Correlated subquery — execute once per outer row → có thể chậm
" Prefer JOIN hoặc CTE thay correlated subquery khi có thể
SELECT travel_id,
       ( SELECT MAX( flight_date ) FROM zbooking b
         WHERE b~travel_id = t~travel_id ) AS latest_flight  " correlated — chạy per row!
  FROM ztravel AS t
  INTO TABLE @DATA(lt_with_latest).
" → Better: LEFT JOIN với subquery hoặc CTE aggregation
```

---

## 11. Table Buffering

ABAP SQL có thể đọc từ **SAP buffer** (AS ABAP memory) thay vì hit HANA DB. Quan trọng cho performance của customizing tables.

```abap
" Table buffering config trong SE11 (ABAP Dictionary):
"   Buffering Type:
"     Not Buffered   → luôn đọc từ DB (e.g. transactional tables: MARA, EKPO)
"     Full Buffering → toàn bộ table load vào buffer (e.g. T001 — company codes)
"     Generic Area   → buffer theo key prefix (e.g. TSTC theo PGMNA prefix)

" ✅ Đọc từ buffered table — tự động (không cần code đặc biệt)
" T005T (countries), T001 (company codes), NRIV (number ranges) → fully buffered
SELECT land1, landx FROM t005t WHERE spras = @sy_langu
  INTO TABLE @DATA(lt_countries).    " → đọc từ buffer, không hit DB

" ✅ BYPASS BUFFER — force đọc trực tiếp từ DB (bỏ qua buffer)
" Dùng khi cần data realtime, sau khi UPDATE/INSERT trực tiếp
SELECT land1, landx FROM t005t
  BYPASS BUFFER
  WHERE spras = @sy_langu
  INTO TABLE @DATA(lt_fresh).

" ⚠️ Những gì BỎ QUA buffer tự động:
"   - JOIN queries (JOIN bypass buffer cả 2 bảng)
"   - UNION queries
"   - ORDER BY trên non-key field
"   - GROUP BY
"   - SELECT *  (không, SELECT * vẫn dùng buffer nếu có)
"   - Aggregate functions
" → Với buffered config tables: SELECT SINGLE với full key → luôn dùng buffer
```

---

## 12. AMDP — Khi Nào Dùng

AMDP (ABAP Managed Database Procedures) = viết SQLScript chạy trực tiếp trên HANA.

```
Chỉ dùng AMDP khi:
  ✅ Cần HANA-specific function không có trong ABAP SQL (fuzzy search, complex window functions)
  ✅ Logic xử lý lượng data cực lớn — repeated data transfer ABAP↔DB quá tốn kém
  ✅ Complex statistical/ML operations trên DB layer

KHÔNG dùng AMDP khi:
  ❌ ABAP SQL (CTE, JOIN, CASE) có thể giải quyết được → luôn prefer ABAP SQL
  ❌ Logic đơn giản mà dùng AMDP → over-engineering, harder to test
  ❌ Cần portability (AMDP chỉ chạy trên HANA)
  ❌ ABAP Cloud public (restrictions áp dụng — OPTIONS READ-ONLY bắt buộc, client-safe)
```

```abap
" ✅ AMDP class skeleton — HANA only
CLASS zcl_travel_analytics DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_amdp_marker_hana.   " ← mandatory marker interface

    CLASS-METHODS get_revenue_by_month
      IMPORTING iv_year      TYPE c
      EXPORTING et_result    TYPE ztt_revenue_by_month
      RAISING   cx_amdp_error.

ENDCLASS.

CLASS zcl_travel_analytics IMPLEMENTATION.

  METHOD get_revenue_by_month
    BY DATABASE PROCEDURE
    FOR HDB                           " HDB = SAP HANA Database
    LANGUAGE SQLSCRIPT
    OPTIONS READ-ONLY                 " ← bắt buộc trong ABAP Cloud
    USING ztravel zbooking.           " ← declared DB objects

    et_result = SELECT
      MONTH( begin_date ) AS month_num,
      SUM( total_price )  AS revenue
    FROM ztravel
    WHERE YEAR( begin_date ) = :iv_year
      AND status = 'A'
    GROUP BY MONTH( begin_date )
    ORDER BY month_num;

  ENDMETHOD.

ENDCLASS.
" ⚠️ AMDP chỉ edit được trong ADT (Eclipse) — không thể dùng SE24/SE80
```

---

## 13. Performance Decision Tree

```
Cần đọc data từ DB?
│
├─ Có thể biểu diễn bằng 1 SQL statement (JOIN, CTE)?
│  → ✅ Dùng SELECT với JOIN / CTE (1 DB roundtrip, HANA optimized)
│
├─ Driving data đã có trong internal table (từ ABAP logic)?
│  → ✅ Dùng FOR ALL ENTRIES (sau IS NOT INITIAL check)
│  → Nếu HANA + FDA enabled: tốt nhất
│  → Nếu cần join nhiều fields: dùng JOIN với CTE thay FAE
│
├─ Cần xử lý từng batch (> 100k rows, processing cần roundtrip)?
│  → ✅ Dùng Database Cursor (OPEN CURSOR / FETCH PACKAGE SIZE n)
│
├─ Cần phân tích phức tạp, logic multi-step?
│  → ✅ Dùng CTE (WITH +name AS (...))
│
├─ Cần HANA-specific function hoặc ultra-large data processing?
│  → ✅ Dùng AMDP (last resort)
│
└─ TUYỆT ĐỐI TRÁNH:
   ❌ SELECT inside LOOP (N+1 = nhiều roundtrips)
   ❌ SELECT * (tốn bandwidth + memory)
   ❌ FAE mà không check IS NOT INITIAL (full table scan!)
   ❌ ORDER BY non-indexed field trên table lớn
```

---

## 14. Anti-Patterns

### SQL-AP-01 🔴 — SELECT bên trong LOOP (N+1 problem)

```abap
" ❌ WRONG — N+1 queries: 1 SELECT để lấy travels + N SELECT cho mỗi agency
SELECT travel_id, agency_id, total_price FROM ztravel
  WHERE status = 'O'
  INTO TABLE @DATA(lt_travels).

LOOP AT lt_travels INTO DATA(ls_travel).
  SELECT SINGLE agency_name, country_code   " ← N queries!
    FROM zagency
    WHERE agency_id = @ls_travel-agency_id
    INTO @DATA(ls_agency).
  " ...
ENDLOOP.

" ✅ CORRECT — JOIN trong 1 SELECT duy nhất
SELECT t~travel_id, t~total_price,
       a~agency_name, a~country_code
  FROM ztravel AS t
  INNER JOIN zagency AS a ON a~agency_id = t~agency_id
  WHERE t~status = 'O'
  INTO TABLE @DATA(lt_enriched).
```

---

### SQL-AP-02 🔴 — FOR ALL ENTRIES không có IS NOT INITIAL

```abap
" ❌ WRONG — nếu lt_travel_keys empty → FULL TABLE SCAN → timeout / dump
SELECT travel_id, total_price FROM ztravel
  FOR ALL ENTRIES IN @lt_travel_keys
  WHERE travel_id = @lt_travel_keys-travel_id
  INTO TABLE @DATA(lt).

" ✅ CORRECT
IF lt_travel_keys IS NOT INITIAL.
  SELECT travel_id, total_price FROM ztravel
    FOR ALL ENTRIES IN @lt_travel_keys
    WHERE travel_id = @lt_travel_keys-travel_id
    INTO TABLE @DATA(lt).
ENDIF.
```

---

### SQL-AP-03 🔴 — SELECT * trên large table

```abap
" ❌ WRONG — load tất cả 50+ fields dù chỉ cần 4
SELECT * FROM mara WHERE mtart = 'FERT' INTO TABLE @DATA(lt_mara).
" MARA có ~150 fields — tốn network, memory, HANA I/O

" ✅ CORRECT
SELECT matnr, mtart, meins, matkl
  FROM mara WHERE mtart = 'FERT'
  INTO TABLE @DATA(lt_mara).
```

---

### SQL-AP-04 🟠 — ORDER BY non-indexed field trên large data

```abap
" ❌ RISKY — ORDER BY description (không phải index) trên ZTRAVEL lớn
SELECT travel_id, description FROM ztravel
  WHERE status = 'O'
  ORDER BY description      " ← full table sort, no index benefit
  INTO TABLE @DATA(lt).

" ✅ Option A: ORDER BY indexed field
SELECT travel_id, description FROM ztravel
  WHERE status = 'O'
  ORDER BY begin_date, travel_id   " ← primary key fields, indexed
  INTO TABLE @DATA(lt).

" ✅ Option B: Sort trong ABAP sau khi SELECT (nếu result set nhỏ)
SELECT travel_id, description FROM ztravel
  WHERE status = 'O'
  INTO TABLE @DATA(lt).
SORT lt BY description.   " ← sort trong ABAP, không tốn DB
```

---

### SQL-AP-05 🟠 — Correlated subquery thay vì JOIN/CTE

```abap
" ❌ SLOW — correlated subquery chạy 1 lần per outer row
SELECT travel_id,
       ( SELECT agency_name FROM zagency WHERE agency_id = t~agency_id ) AS name
  FROM ztravel AS t
  WHERE status = 'O'
  INTO TABLE @DATA(lt).
" → N subquery executions cho N travel rows

" ✅ CORRECT — JOIN 1 lần
SELECT t~travel_id, a~agency_name
  FROM ztravel AS t
  INNER JOIN zagency AS a ON a~agency_id = t~agency_id
  WHERE t~status = 'O'
  INTO TABLE @DATA(lt).
```

---

### SQL-AP-06 🟠 — Missing WHERE clause trên large table

```abap
" ❌ WRONG — SELECT không có WHERE → full table scan
SELECT travel_id, status FROM ztravel
  INTO TABLE @DATA(lt_all).
" → có thể hàng triệu rows

" ✅ CORRECT — luôn có WHERE, hoặc dùng UP TO nếu cố ý lấy tất cả
SELECT travel_id, status FROM ztravel
  WHERE mandt = @sy-mandt    " ← ít nhất filter theo client
    AND begin_date >= @lv_cutoff_date
  INTO TABLE @DATA(lt).

" Hoặc pagination nếu cần all data
SELECT travel_id, status FROM ztravel
  ORDER BY travel_id
  OFFSET @lv_offset ROWS
  FETCH NEXT 1000 ROWS ONLY
  INTO TABLE @DATA(lt_page).
```

---

### SQL-AP-07 🟡 — Dùng LIKE thay vì CONTAINS (fuzzy search)

```abap
" ⚠️ CAUTION — LIKE '%keyword%' → full scan, không dùng được index
SELECT travel_id, description FROM ztravel
  WHERE description LIKE '%Paris%'    " ← leading wildcard = no index
  INTO TABLE @DATA(lt).

" ✅ HANA Fuzzy Search — nếu cần full-text search (HANA only)
" Note: syntax dưới là HANA native SQL, không phải standard ABAP SQL
" Dùng CDS view với @Search.searchable annotation thay thế trong ABAP Cloud

" ✅ ABAP Cloud preferred: CDS Text Search với @Search annotation
" hoặc dùng ABAP SQL LIKE với leading literal (có thể dùng index):
SELECT travel_id, description FROM ztravel
  WHERE description LIKE 'Paris%'    " ← leading literal → index có thể dùng
  INTO TABLE @DATA(lt).
```

---

### SQL-AP-08 🟡 — MANDT field trong WHERE (redundant trong modern ABAP)

```abap
" ⚠️ Không cần explicit MANDT trong ABAP SQL — tự động thêm
SELECT travel_id FROM ztravel
  WHERE mandt = @sy-mandt    " ← redundant, ABAP SQL tự handle
    AND status = 'O'
  INTO TABLE @DATA(lt).

" ✅ CORRECT — bỏ MANDT, ABAP SQL tự inject
SELECT travel_id FROM ztravel
  WHERE status = 'O'
  INTO TABLE @DATA(lt).

" Exception: khi dùng AMDP / Native SQL → phải explicit filter MANDT
```

---

## 15. Sources

| Topic | URL |
|---|---|
| ABAP SQL Overview (SAP Help) | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenabap_sql.htm |
| SELECT Statement | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abapselect.htm |
| FOR ALL ENTRIES | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abapselect_for_all_entries.htm |
| WITH (CTE) — SAP Help | https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/abapwith.htm |
| UNION — SAP Help | https://help.sap.com/doc/abapdocu_752_index_htm/7.52/en-US/abapunion.htm |
| OFFSET / FETCH NEXT | https://help.sap.com/doc/abapdocu_753_index_htm/7.53/en-US/abapselect_up_to_offset.htm |
| CTE Blog (ABAP 7.51 release) | https://blogs.sap.com/2016/10/18/abap-news-release-7.51-common-table-expressions-cte-open-sql/ |
| Open SQL in 7.50 (UNION, host expr) | https://help.sap.com/doc/abapdocu_751_index_htm/7.51/en-US/abennews-750-open_sql.htm |
| AMDP — SAP Help | https://help.sap.com/doc/abapdocu_751_index_htm/7.51/en-US/abenamdp.htm |
| AMDP — DeepWiki Cheat Sheet | https://deepwiki.com/SAP-samples/abap-cheat-sheets/4.2-abap-managed-database-procedures |
| FAE Performance vs JOIN | https://blogs.sap.com/2019/03/31/compare-performance-between-select-for-all-entries-and-amdp/ |
| ABAP Best Practices — DB | https://ilyakaznacheev.github.io/abap-best-practice/ |
| ABAP SQL Cheat Sheet (SAP GitHub) | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/04_ABAP_Object_Orientation.md |
| Performance Tuning Guide | https://www.s4pedia.com/post/boosting-your-abap-code-performance-a-brief-guide-to-performance-tuning |