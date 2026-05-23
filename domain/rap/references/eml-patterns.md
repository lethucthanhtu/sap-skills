# RAP — EML Patterns

Hướng dẫn đầy đủ về Entity Manipulation Language (EML): mọi cú pháp MODIFY/READ/COMMIT,
component groups (%tky, %cid, %pid, %control), và patterns phổ biến trong behavior implementation.

> **Đọc file này khi:** có bất kỳ câu hỏi nào về EML syntax, %tky vs %key,
> `IN LOCAL MODE`, `MODIFY ENTITIES`, `READ ENTITIES`, `COMMIT ENTITIES`,
> `%cid`/`%cid_ref`, `%pid`, `%control`, mapped/failed/reported response.

---

## Table of Contents

1. [EML Overview — Hai loại consumer](#1-eml-overview--hai-loại-consumer)
2. [Component Groups — Bảng tra nhanh](#2-component-groups--bảng-tra-nhanh)
3. [%tky vs %key — Khi nào dùng gì](#3-tky-vs-key--khi-nào-dùng-gì)
4. [%cid và %cid_ref — Content ID](#4-cid-và-cid_ref--content-id)
5. [%pid — Preliminary ID (Late Numbering)](#5-pid--preliminary-id-late-numbering)
6. [%control — Selective Field Update](#6-control--selective-field-update)
7. [MODIFY ENTITIES — Tất cả variants](#7-modify-entities--tất-cả-variants)
8. [READ ENTITIES — Tất cả variants](#8-read-entities--tất-cả-variants)
9. [COMMIT ENTITIES — Patterns](#9-commit-entities--patterns)
10. [IN LOCAL MODE — Khi nào bắt buộc](#10-in-local-mode--khi-nào-bắt-buộc)
11. [Response Parameters — mapped / failed / reported](#11-response-parameters--mapped--failed--reported)
12. [EML trong handler methods — Patterns thực tế](#12-eml-trong-handler-methods--patterns-thực-tế)
13. [EML bên ngoài RAP (Consumer pattern)](#13-eml-bên-ngoài-rap-consumer-pattern)
14. [CONVERT KEY — Late numbering từ external consumer](#14-convert-key--late-numbering-từ-external-consumer)
15. [Anti-Patterns](#15-anti-patterns)
16. [Sources](#16-sources)

---

## 1. EML Overview — Hai loại consumer

EML được dùng ở **hai ngữ cảnh khác nhau** với quy tắc khác nhau:

```
┌─────────────────────────────────────────────────────────────────┐
│  CONTEXT A: Bên trong RAP (behavior implementation)             │
│  → Dùng IN LOCAL MODE                                           │
│  → Truy cập transactional buffer trực tiếp                      │
│  → COMMIT ENTITIES KHÔNG dùng (framework tự commit)             │
│  → Dùng trong: action, determination, validation handlers       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CONTEXT B: Bên ngoài RAP (external consumer)                   │
│  → KHÔNG có IN LOCAL MODE                                       │
│  → Giao tiếp qua service layer                                  │
│  → PHẢI dùng COMMIT ENTITIES để trigger save sequence           │
│  → Dùng trong: report, job, test class, CAP, another class      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Groups — Bảng tra nhanh

| Component | Type | Ý nghĩa | Có trong |
|---|---|---|---|
| `%key` | Component group | Primary key fields của entity | Mọi BDEF |
| `%tky` | Component group | `%key` + `%is_draft` (transactional key) | Mọi BDEF (khuyến nghị dùng thay `%key`) |
| `%is_draft` | `ABP_BEHV_FLAG` | Draft instance = `mk-on`; Active = `mk-off` | Draft-enabled BOs |
| `%cid` | `ABP_BEHV_CID` | Content ID — temporary ID trong 1 EML request | CREATE, CREATE BY |
| `%cid_ref` | `ABP_BEHV_CID` | Reference tới `%cid` trong cùng EML request | UPDATE, DELETE, EXECUTE |
| `%pid` | `ABP_BEHV_PID` | Preliminary ID — tồn tại đến khi save | Late numbering only |
| `%tmp` | Component group | Temporary key fields (late numbering) | Late numbering only |
| `%pky` | Component group | `%pid` + `%tmp` (preliminary transactional key) | Late numbering only |
| `%control` | Structure | Bitmask field nào được set (mk-on/mk-off) | MODIFY, READ |
| `%op` | Structure | Operation type: `%op-%create`, `%op-%update` | Determination handlers |
| `%param` | Structure | Action parameters | Action handlers |
| `%target` | Table | Child entity records (CREATE BY association) | Association operations |
| `%element` | Structure | Field highlight (mark field gây lỗi) | reported structure |
| `%state_area` | String | Validation message namespace | reported structure |
| `%msg` | `IF_ABAP_BEHV_MESSAGE` | Message instance | reported structure |

---

## 3. %tky vs %key — Khi nào dùng gì

```
Luôn dùng %tky thay vì %key → chuẩn bị cho draft sau này.
Ngoại lệ duy nhất: khi BO chắc chắn không bao giờ có draft.
```

```abap
" ✅ CORRECT — %tky: safe cho cả draft và non-draft
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel FIELDS ( OverallStatus )
  WITH CORRESPONDING #( keys )   " keys chứa %tky
  RESULT DATA(lt_result).

MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel UPDATE FIELDS ( OverallStatus )
  WITH VALUE #( FOR lt IN lt_result
                ( %tky         = lt-%tky   " ← dùng %tky
                  OverallStatus = 'A' ) ).

" ❌ WRONG — %key: thiếu %is_draft, sẽ lỗi khi enable draft sau
WITH VALUE #( ( TravelId = lv_id   " ← hardcode key, missing %is_draft
               OverallStatus = 'A' ) )
```

### %tky trong draft: tại sao quan trọng

```abap
" Cùng business key TravelId = '0001' có thể tồn tại HAI instances:
" → Draft:  %tky = ( TravelId = '0001', %is_draft = mk-on  )
" → Active: %tky = ( TravelId = '0001', %is_draft = mk-off )

" %key = '0001' → AMBIGUOUS: không biết draft hay active
" %tky với %is_draft → UNAMBIGUOUS: xác định đúng instance
```

Source: https://sachinartani.com/blog/understanding-tky-in-sap-rap
Source: https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abapderived_types_cid.htm

---

## 4. %cid và %cid_ref — Content ID

**`%cid`** = temporary ID trong **1 EML request** (interaction phase). Dùng để:
1. Identify newly created instance khi chưa có final key
2. Reference instance đó trong operations tiếp theo của **cùng** EML statement

**`%cid_ref`** = reference đến `%cid` đã khai báo trước đó trong cùng statement.

```abap
" Pattern: CREATE + UPDATE trong cùng một MODIFY statement
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  " Step 1: Create với %cid
  ENTITY Travel
    CREATE FIELDS ( AgencyId BeginDate EndDate )
    WITH VALUE #(
      ( %cid      = 'CID_TRAVEL_001'   " ← đặt CID
        AgencyId  = '000001'
        BeginDate = '20250101'
        EndDate   = '20250131' ) )

  " Step 2: Create child, reference parent bằng %cid_ref
  ENTITY Travel
    CREATE BY \_Booking
    WITH VALUE #(
      ( %cid_ref        = 'CID_TRAVEL_001'   " ← reference parent %cid
        %target = VALUE #(
          ( %cid          = 'CID_BOOKING_001'
            BookingId     = '001'
            FlightDate    = '20250115'
            FlightPrice   = '500' ) ) ) )

  MAPPED   DATA(mapped)
  FAILED   DATA(failed)
  REPORTED DATA(reported).

" ⚠️ %cid scope: chỉ valid trong EML statement này
" ⚠️ Sau khi MODIFY kết thúc: dùng mapped-travel để lấy key thực
```

### strict(2) và %cid

```abap
" strict(2) bắt buộc %cid phải được fill trong CREATE
" ✅ CORRECT — strict(2): %cid mandatory
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel CREATE FIELDS ( AgencyId )
  WITH VALUE #( ( %cid     = 'CID_001'   " ← bắt buộc
                  AgencyId = '000001' ) )
  MAPPED DATA(mapped) FAILED DATA(failed) REPORTED DATA(reported).

" ✅ ALTERNATIVE — dùng AUTO FILL CID (khi không cần reference sau)
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel CREATE AUTO FILL CID
  FIELDS ( AgencyId )
  WITH VALUE #( ( AgencyId = '000001' ) )  " ← không cần fill %cid thủ công
  MAPPED DATA(mapped) FAILED DATA(failed) REPORTED DATA(reported).
" ⚠️ AUTO FILL CID: KHÔNG thể dùng %cid_ref sau đó
```

Source: https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abapmodify_entity_entities_fields.htm
Source: https://github.com/SAP-samples/abap-cheat-sheets/blob/main/08_EML_ABAP_for_RAP.md

---

## 5. %pid — Preliminary ID (Late Numbering)

`%pid` khác `%cid`: tồn tại **qua save sequence** cho đến khi `adjust_numbers` gán final key.

```
%cid  → valid chỉ trong 1 EML MODIFY request (interaction phase)
%pid  → valid từ CREATE đến save_modified / adjust_numbers
%tky  → bao gồm cả %pid khi late numbering: %tky = %pid + %tmp + %key
```

### %pid trong behavior handler (provider side)

```abap
" Trong CREATE handler của unmanaged BO với late numbering:
METHOD create.
  LOOP AT entities INTO DATA(ls_entity).
    " Chưa có final key → assign %pid làm temporary identifier
    INSERT VALUE #(
      %cid  = ls_entity-%cid
      %pid  = cl_abap_behv=>mk-fresh_pid( )  " generate unique %pid
    ) INTO TABLE mapped-travel.

    " Lưu vào buffer (chưa có TravelId thật)
    INSERT VALUE #(
      %pid       = mapped-travel[ %cid = ls_entity-%cid ]-%pid
      AgencyId   = ls_entity-AgencyId
      BeginDate  = ls_entity-BeginDate
    ) INTO TABLE lcl_buffer=>new_entries.
  ENDLOOP.
ENDMETHOD.

" Trong adjust_numbers (save sequence):
METHOD adjust_numbers.
  " Đổi %pid → final key (TravelId từ number range)
  LOOP AT mapped-travel INTO DATA(ls_mapped)
    WHERE TravelId IS INITIAL.   " chỉ xử lý chưa có key

    " Lấy number range
    cl_numberrange_runtime=>number_get(
      EXPORTING nr_range_nr = '01' object = 'Z_TRAVEL' quantity = 1
      IMPORTING number = DATA(lv_num) ).

    " Gán final key cho instance
    ls_mapped-TravelId = lv_num.
    MODIFY TABLE mapped-travel FROM ls_mapped.
  ENDLOOP.
ENDMETHOD.
```

Source: https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abapderived_types_pid.htm
Source: https://community.sap.com/t5/technology-q-a/abap-rap-late-numbering-how-to-convert-pid-to-draft-uuid/qaq-p/12623310

---

## 6. %control — Selective Field Update

`%control` là bitmask xác định field nào được consumer set trong request.
**Luôn check `%control` trong UPDATE** để tránh overwrite field không được thay đổi.

```abap
" %control values:
" if_abap_behv=>mk-on  (= 'X') → field được consumer set (hãy xử lý)
" if_abap_behv=>mk-off (= ' ') → field KHÔNG được set (bỏ qua)

" ✅ CORRECT — check %control trong determination/action
METHOD recalculatePrice.
  LOOP AT keys INTO DATA(ls_key).

    " Chỉ đọc fields cần thiết
    READ ENTITIES OF z_i_travel IN LOCAL MODE
      ENTITY Travel FIELDS ( BookingFee CurrencyCode Discount )
      WITH CORRESPONDING #( keys )
      RESULT DATA(lt_travels).

    LOOP AT lt_travels INTO DATA(ls_travel).
      DATA(lv_new_price) = ls_travel-BookingFee * ( 1 - ls_travel-Discount / 100 ).

      " Update chỉ field TotalPrice — explicit FIELDS list
      MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
        ENTITY Travel
        UPDATE FIELDS ( TotalPrice )   " ← chỉ update field này
        WITH VALUE #( ( %tky       = ls_travel-%tky
                        TotalPrice = lv_new_price ) ).
    ENDLOOP.
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — check %control khi nhận UPDATE entities (unmanaged)
METHOD save_modified.
  LOOP AT update-travel INTO DATA(ls_update).
    " Chỉ gọi BAPI update nếu field thực sự được thay đổi
    IF ls_update-%control-OverallStatus = if_abap_behv=>mk-on.
      " OverallStatus đã thay đổi → update BAPI
      CALL FUNCTION 'BAPI_TRAVEL_UPDATE'
        EXPORTING status = ls_update-OverallStatus.
    ENDIF.
    IF ls_update-%control-EndDate = if_abap_behv=>mk-on.
      " EndDate đã thay đổi → update BAPI
      CALL FUNCTION 'BAPI_TRAVEL_CHANGE_DATE'
        EXPORTING end_date = ls_update-EndDate.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

### %control trong READ — Request specific fields

```abap
" Consumer dùng %control để chỉ định field muốn đọc:
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel
  FIELDS ( TravelId AgencyId BeginDate )  " ← chỉ đọc 3 fields này
  WITH CORRESPONDING #( keys )
  RESULT DATA(lt_result).

" Provider nhận %control với mk-on cho 3 fields, mk-off cho phần còn lại
" Provider CHỈ cần populate 3 fields đó trong RESULT
```

---

## 7. MODIFY ENTITIES — Tất cả variants

### 7.1 CREATE

```abap
" Variant 1: FIELDS ... WITH (khuyến nghị — explicit field list)
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel
  CREATE FIELDS ( AgencyId BeginDate EndDate BookingFee CurrencyCode )
  WITH VALUE #(
    ( %cid        = 'CID_001'
      AgencyId    = '000001'
      BeginDate   = '20250101'
      EndDate     = '20250131'
      BookingFee  = '150'
      CurrencyCode = 'VND' ) )
  MAPPED   DATA(mapped)
  FAILED   DATA(failed)
  REPORTED DATA(reported).

" Variant 2: FROM (toàn bộ fields + %control)
DATA lt_create TYPE TABLE FOR CREATE z_i_travel\\Travel.
lt_create = VALUE #(
  ( %cid                      = 'CID_002'
    AgencyId                  = '000002'
    %control-AgencyId         = if_abap_behv=>mk-on
    BeginDate                 = '20250201'
    %control-BeginDate        = if_abap_behv=>mk-on ) ).

MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel CREATE FROM lt_create
  MAPPED DATA(mapped) FAILED DATA(failed) REPORTED DATA(reported).
```

### 7.2 UPDATE

```abap
" ✅ CORRECT — FIELDS: chỉ update fields được khai báo
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel
  UPDATE FIELDS ( OverallStatus )
  WITH VALUE #( FOR key IN keys
                ( %tky         = key-%tky
                  OverallStatus = 'A' ) )
  REPORTED DATA(reported).

" ✅ CORRECT — FROM: dùng %control để chỉ định field nào được update
DATA lt_update TYPE TABLE FOR UPDATE z_i_travel\\Travel.
lt_update = VALUE #(
  ( %tky                        = ls_travel-%tky
    OverallStatus                = 'R'
    %control-OverallStatus       = if_abap_behv=>mk-on
    " Các field không có mk-on sẽ KHÔNG bị overwrite
  ) ).
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel UPDATE FROM lt_update
  REPORTED DATA(reported).
```

### 7.3 DELETE

```abap
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel
  DELETE FROM VALUE #( FOR key IN keys ( %tky = key-%tky ) )
  REPORTED DATA(reported).
```

### 7.4 EXECUTE (Action)

```abap
" Non-parameter action
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel
  EXECUTE acceptTravel
  FROM VALUE #( FOR key IN keys ( %tky = key-%tky ) )
  FAILED   DATA(action_failed)
  REPORTED DATA(action_reported).

" Parameterized action
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel
  EXECUTE changeStatus
  FROM VALUE #( FOR key IN keys
                ( %tky              = key-%tky
                  %param-NewStatus  = 'C' ) )
  RESULT   DATA(result)
  FAILED   DATA(failed)
  REPORTED DATA(reported).
```

### 7.5 CREATE BY association (header + item together)

```abap
" Tạo header + item cùng lúc bằng CREATE BY \_association
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  " 1. Create Travel header
  ENTITY Travel
  CREATE FIELDS ( AgencyId BeginDate EndDate )
  WITH VALUE #(
    ( %cid      = 'CID_TRAVEL_1'
      AgencyId  = '000001'
      BeginDate = '20250101'
      EndDate   = '20250131' ) )

  " 2. Create Booking items — reference header bằng %cid_ref
  ENTITY Travel
  CREATE BY \_Booking
  WITH VALUE #(
    ( %cid_ref = 'CID_TRAVEL_1'   " ← link tới header
      %target  = VALUE #(
        ( %cid        = 'CID_BOOK_1'
          BookingId   = '001'
          FlightDate  = '20250115' )
        ( %cid        = 'CID_BOOK_2'
          BookingId   = '002'
          FlightDate  = '20250125' ) ) ) )

  MAPPED   DATA(mapped)
  FAILED   DATA(failed)
  REPORTED DATA(reported).
```

---

## 8. READ ENTITIES — Tất cả variants

### 8.1 FIELDS ... WITH CORRESPONDING (phổ biến nhất)

```abap
" ✅ Pattern chuẩn — dùng trong hầu hết handler methods
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel
  FIELDS ( TravelId AgencyId BeginDate EndDate OverallStatus )
  WITH CORRESPONDING #( keys )   " ← keys từ method parameter
  RESULT DATA(lt_travels)
  FAILED DATA(failed).

" Duyệt kết quả
LOOP AT lt_travels INTO DATA(ls_travel).
  " xử lý...
ENDLOOP.
```

### 8.2 ALL FIELDS

```abap
" Đọc toàn bộ fields — dùng khi cần nhiều fields hoặc không biết trước
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel ALL FIELDS
  WITH CORRESPONDING #( keys )
  RESULT DATA(lt_travels).
```

### 8.3 BY Association (đọc child từ parent key)

```abap
" Đọc Booking items từ Travel key
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel
  BY \_Booking
  ALL FIELDS
  WITH CORRESPONDING #( keys )
  RESULT DATA(lt_bookings)
  FAILED DATA(failed).
```

### 8.4 Đọc nhiều entities cùng lúc

```abap
" Đọc Travel + Booking trong 1 READ statement
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel
  FIELDS ( TravelId OverallStatus )
  WITH CORRESPONDING #( keys )
  RESULT DATA(lt_travels)

  ENTITY Travel
  BY \_Booking
  FIELDS ( BookingId FlightDate )
  WITH CORRESPONDING #( keys )
  RESULT DATA(lt_bookings)

  FAILED DATA(failed).
```

### 8.5 READ với explicit key (không dùng corresponding)

```abap
" Khi cần đọc specific instance theo key cố định
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel FIELDS ( OverallStatus )
  WITH VALUE #( ( %tky-%key-TravelId = lv_travel_id
                  %is_draft          = if_abap_behv=>mk-off ) )
  RESULT DATA(lt_result).
```

> ⚠️ **Không dùng SELECT từ DB trong validation/determination**:
> SELECT đọc data cũ từ DB, không phản ánh changes trong transactional buffer.
> Luôn dùng `READ ENTITIES IN LOCAL MODE` để đọc current buffer state.

---

## 9. COMMIT ENTITIES — Patterns

`COMMIT ENTITIES` chỉ dùng ở **Context B** (external consumer, ngoài RAP provider).

### 9.1 Basic COMMIT

```abap
" Sau khi MODIFY xong → trigger save sequence
COMMIT ENTITIES
  RESPONSE OF z_i_travel
  FAILED   DATA(commit_failed)
  REPORTED DATA(commit_reported).

" Luôn check sy-subrc và failed sau commit
IF sy-subrc <> 0 OR commit_failed IS NOT INITIAL.
  " Handle commit failure
  LOOP AT commit_reported-travel INTO DATA(ls_msg).
    " Hiển thị error messages
  ENDLOOP.
ENDIF.
```

### 9.2 COMMIT ENTITIES BEGIN/END — Late Numbering (lấy final key)

```abap
" Dùng khi cần lấy final key sau khi save (late numbering BOs)
COMMIT ENTITIES BEGIN
  RESPONSE OF z_i_travel
  FAILED   DATA(commit_failed)
  REPORTED DATA(commit_reported).

IF sy-subrc = 0 AND commit_failed IS INITIAL.
  " Trong scope BEGIN/END: convert %pid → final key
  LOOP AT mapped-travel ASSIGNING FIELD-SYMBOL(<mapped>).
    CONVERT KEY OF z_i_travel
      FROM <mapped>-%pid     " preliminary ID
      TO DATA(ls_final_key). " final key structure

    " ls_final_key-TravelId = document number được assign bởi backend
    DATA(lv_travel_id) = ls_final_key-TravelId.
  ENDLOOP.
ENDIF.

COMMIT ENTITIES END.
```

### 9.3 COMMIT ENTITIES IN SIMULATION MODE

```abap
" Validate toàn bộ save sequence mà không thực sự persist
COMMIT ENTITIES IN SIMULATION MODE
  RESPONSE OF z_i_travel
  FAILED   DATA(sim_failed)
  REPORTED DATA(sim_reported).

IF sim_failed IS INITIAL.
  " Không có lỗi → safe to commit for real
  COMMIT ENTITIES
    RESPONSE OF z_i_travel
    FAILED   DATA(failed)
    REPORTED DATA(reported).
ELSE.
  " Có lỗi → hiển thị cho user, không commit
  ROLLBACK ENTITIES.
ENDIF.
```

### 9.4 ROLLBACK ENTITIES

```abap
" Hủy toàn bộ changes trong transactional buffer
ROLLBACK ENTITIES.
" (chỉ dùng trong external consumer — Context B)
```

---

## 10. IN LOCAL MODE — Khi nào bắt buộc

```
IN LOCAL MODE:
  → Bypass service layer (projection, authorization check)
  → Truy cập transactional buffer trực tiếp
  → PHẢI dùng trong behavior implementation (handler/saver)
  → Tránh infinite loop khi BO gọi lại chính nó

WITHOUT IN LOCAL MODE:
  → Đi qua full service stack (authorization, validation, etc.)
  → Dùng khi gọi BO khác từ bên ngoài hoặc khi muốn full stack
  → ĐẶC BIỆT: KHÔNG dùng trong handler method của chính BO đó
```

```abap
" ✅ CORRECT — IN LOCAL MODE trong handler
METHOD setStatusOnCreate.
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE   " ← bắt buộc
    ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH VALUE #( FOR key IN keys
                  ( %tky         = key-%tky
                    OverallStatus = 'O' ) )
    REPORTED DATA(reported).
  reported = CORRESPONDING #( DEEP reported ).
ENDMETHOD.

" ❌ WRONG — thiếu IN LOCAL MODE → infinite loop hoặc authorization fail
METHOD setStatusOnCreate.
  MODIFY ENTITIES OF z_i_travel   " ← thiếu IN LOCAL MODE → LOOP hoặc DUMP
    ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH VALUE #( ... ).
ENDMETHOD.

" ❌ WRONG — IN LOCAL MODE trong READ của saver class
" (save sequence không có buffer access qua IN LOCAL MODE)
METHOD save_modified.
  READ ENTITIES OF z_i_travel IN LOCAL MODE   " ← DUMP in save_modified!
    ENTITY Travel ALL FIELDS WITH CORRESPONDING #( create-travel )
    RESULT DATA(lt_data).
ENDMETHOD.
```

> 🔴 **Critical**: `READ ENTITIES IN LOCAL MODE` trong `save_modified` → DUMP.
> Nếu cần data trong `save_modified` → đọc từ DB (`SELECT`) hoặc
> dùng `finalize` (trước save) để chuẩn bị data.

---

## 11. Response Parameters — mapped / failed / reported

### 11.1 Ý nghĩa

| Parameter | Ý nghĩa | Khi nào có |
|---|---|---|
| `mapped` | Mapping %cid → key thực; hoặc instances được xử lý thành công | Sau MODIFY CREATE |
| `failed` | Instances bị lỗi — framework/OData sẽ không persist chúng | Khi operation fail |
| `reported` | Messages gắn với instances — hiển thị trên Fiori UI | Khi cần thông báo cho user |

### 11.2 Cách đọc mapped sau CREATE

```abap
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel CREATE FIELDS ( AgencyId )
  WITH VALUE #( ( %cid = 'CID_001' AgencyId = '000001' ) )
  MAPPED DATA(mapped) FAILED DATA(failed) REPORTED DATA(reported).

" Lấy key thực từ mapped (nếu early numbering — key đã có)
DATA(lv_new_key) = mapped-travel[ %cid = 'CID_001' ]-TravelId.

" Lấy %pid từ mapped (nếu late numbering — chưa có final key)
DATA(lv_pid) = mapped-travel[ %cid = 'CID_001' ]-%pid.
```

### 11.3 Cách build failed + reported đúng

```abap
" Pattern chuẩn: failed + reported phải ĐỒNG BỘ
" Mỗi entry trong failed phải có entry tương ứng trong reported

LOOP AT lt_travels INTO DATA(ls_travel).
  IF ls_travel-BeginDate IS INITIAL.

    " 1. Add to failed (instance bị lỗi)
    APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.

    " 2. Add to reported (message cho user)
    APPEND VALUE #(
      %tky               = ls_travel-%tky
      %state_area        = 'VALIDATE_DATES'        " unique per validation
      %element-BeginDate = if_abap_behv=>mk-on      " highlight field
      %msg               = new_message_with_text(
                             severity = if_abap_behv_message=>severity-error
                             text     = 'Begin date must be filled' )
    ) TO reported-travel.
  ENDIF.
ENDLOOP.
```

### 11.4 Propagate reported từ sub-operation

```abap
" Khi gọi EML sub-operation và muốn propagate errors lên
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel UPDATE FIELDS ( OverallStatus )
  WITH VALUE #( ... )
  REPORTED DATA(update_reported).

" Propagate với DEEP corresponding (giữ nguyên structure nested)
reported = CORRESPONDING #( DEEP update_reported ).
```

### 11.5 new_message vs new_message_with_text

```abap
" new_message: dùng khi có message class trong SE91
APPEND VALUE #(
  %tky = ls_travel-%tky
  %msg = new_message(
    id       = 'Z_TRAVEL_MSG'        " message class
    number   = '001'                  " message number
    severity = if_abap_behv_message=>severity-error
    v1       = ls_travel-TravelId    " placeholder &1
    v2       = ''                    " placeholder &2
    v3       = ''                    " placeholder &3
    v4       = '' )                  " placeholder &4
) TO reported-travel.

" new_message_with_text: dùng khi chưa có message class (prototyping)
APPEND VALUE #(
  %tky = ls_travel-%tky
  %msg = new_message_with_text(
    severity = if_abap_behv_message=>severity-warning
    text     = 'Travel dates overlap with existing booking' )
) TO reported-travel.
```

---

## 12. EML trong handler methods — Patterns thực tế

### 12.1 Action — standard pattern

```abap
METHOD acceptTravel.
  " Step 1: READ current state từ buffer
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( TravelId OverallStatus )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels)
    FAILED DATA(read_failed).

  " Step 2: Validate
  LOOP AT lt_travels INTO DATA(ls_travel).
    IF ls_travel-OverallStatus = 'A'.
      " Already accepted — report warning, don't fail
      APPEND VALUE #(
        %tky = ls_travel-%tky
        %msg = new_message_with_text(
          severity = if_abap_behv_message=>severity-warning
          text     = 'Travel already accepted' )
      ) TO reported-travel.
    ENDIF.
  ENDLOOP.

  " Step 3: MODIFY only non-failing instances
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH VALUE #(
      FOR lt IN lt_travels
      WHERE OverallStatus <> 'A'   " skip already-accepted
      ( %tky         = lt-%tky
        OverallStatus = 'A' ) )
    REPORTED DATA(update_reported).
  reported = CORRESPONDING #( DEEP update_reported ).

  " Step 4: Build result (read updated state back)
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel ALL FIELDS
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_result).

  result = VALUE #( FOR r IN lt_result
                    ( %tky   = r-%tky
                      %param = r ) ).
ENDMETHOD.
```

### 12.2 Determination — on modify pattern

```abap
METHOD setStatusOnCreate.
  " Determination: on modify { create; }
  " → keys chứa chỉ những instances vừa được CREATE

  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH VALUE #( FOR key IN keys
                  ( %tky         = key-%tky
                    OverallStatus = 'O' ) )   " O = Open
    REPORTED DATA(reported).
  reported = CORRESPONDING #( DEEP reported ).
ENDMETHOD.

METHOD setAdminFields.
  " Determination: on modify { create; update; }
  DATA(lv_now)  = cl_abap_context_info=>get_system_time_utclong( ).
  DATA(lv_user) = cl_abap_context_info=>get_user_alias( ).

  " Read để biết operation type
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( TravelId )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).

  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel UPDATE FIELDS (
      LastChangedAt LocalLastChangedAt LastChangedBy
      CreatedBy CreatedAt )
    WITH VALUE #(
      FOR lt IN lt_travels
      ( %tky               = lt-%tky
        LocalLastChangedAt  = lv_now
        LastChangedAt       = lv_now
        LastChangedBy       = lv_user
        " CreatedBy/At chỉ set khi CREATE:
        CreatedBy           = COND #( WHEN lt-%op-%create = if_abap_behv=>mk-on
                                      THEN lv_user )
        CreatedAt           = COND #( WHEN lt-%op-%create = if_abap_behv=>mk-on
                                      THEN lv_now ) ) )
    REPORTED DATA(reported).
  reported = CORRESPONDING #( DEEP reported ).
ENDMETHOD.
```

### 12.3 Validation — on save pattern

```abap
METHOD validateDates.
  " Step 1: READ từ buffer (KHÔNG dùng SELECT!)
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( TravelId BeginDate EndDate )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).

  LOOP AT lt_travels INTO DATA(ls_travel).
    " Step 2: Clear state area (xóa messages cũ từ lần save trước)
    APPEND VALUE #(
      %tky        = ls_travel-%tky
      %state_area = 'VALIDATE_DATES'
    ) TO reported-travel.

    " Step 3: Validate và report lỗi
    IF ls_travel-BeginDate IS INITIAL.
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky               = ls_travel-%tky
        %state_area        = 'VALIDATE_DATES'
        %element-BeginDate = if_abap_behv=>mk-on
        %msg = new_message_with_text(
          severity = if_abap_behv_message=>severity-error
          text     = 'Begin date is mandatory' )
      ) TO reported-travel.
    ELSEIF ls_travel-EndDate < ls_travel-BeginDate.
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky             = ls_travel-%tky
        %state_area      = 'VALIDATE_DATES'
        %element-EndDate = if_abap_behv=>mk-on
        %msg = new_message_with_text(
          severity = if_abap_behv_message=>severity-error
          text     = 'End date must be after begin date' )
      ) TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

---

## 13. EML bên ngoài RAP (Consumer pattern)

Dùng trong: report, background job, test class, CAP Node.js (via RFC/OData), class helper.

```abap
" Pattern: Create → Check → Commit → Read final result
CLASS zcl_travel_service DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS create_travel
      IMPORTING
        iv_agency    TYPE agencyid
        iv_begin     TYPE begindate
        iv_end       TYPE enddate
      EXPORTING
        ev_travel_id TYPE travelid
        ev_success   TYPE abap_bool
        et_messages  TYPE bapiret2_t.
ENDCLASS.

CLASS zcl_travel_service IMPLEMENTATION.
  METHOD create_travel.
    ev_success = abap_false.

    " Step 1: MODIFY (interaction phase)
    MODIFY ENTITIES OF z_i_travel
      ENTITY Travel
      CREATE FIELDS ( AgencyId BeginDate EndDate )
      WITH VALUE #(
        ( %cid      = 'CID_001'
          AgencyId  = iv_agency
          BeginDate = iv_begin
          EndDate   = iv_end ) )
      MAPPED   DATA(mapped)
      FAILED   DATA(failed)
      REPORTED DATA(reported).

    " Step 2: Check interaction phase errors
    IF failed IS NOT INITIAL.
      LOOP AT reported-travel INTO DATA(ls_rep).
        IF ls_rep-%msg IS BOUND.
          APPEND VALUE #(
            type    = SWITCH char1( ls_rep-%msg->if_abap_behv_message~m_severity
                        WHEN if_abap_behv_message=>severity-error   THEN 'E'
                        WHEN if_abap_behv_message=>severity-warning THEN 'W'
                        ELSE 'I' )
            message = ls_rep-%msg->if_t100_message~t100key-msgid  " simplified
          ) TO et_messages.
        ENDIF.
      ENDLOOP.
      RETURN.
    ENDIF.

    " Step 3: COMMIT ENTITIES (trigger save sequence)
    COMMIT ENTITIES
      RESPONSE OF z_i_travel
      FAILED   DATA(commit_failed)
      REPORTED DATA(commit_reported).

    IF sy-subrc <> 0 OR commit_failed IS NOT INITIAL.
      " Commit failed
      RETURN.
    ENDIF.

    " Step 4: Read final key from mapped (early numbering)
    ev_travel_id = mapped-travel[ %cid = 'CID_001' ]-TravelId.
    ev_success   = abap_true.
  ENDMETHOD.
ENDCLASS.
```

---

## 14. CONVERT KEY — Late numbering từ external consumer

Dùng khi gọi SAP standard released BO có late numbering (e.g. `I_PurchaseRequisitionTP`,
`I_PurchaseOrderTP_2`, `R_ServiceEntrySheetTP`).

```abap
" Pattern: Gọi standard BO với late numbering → lấy document number

" Step 1: CREATE
MODIFY ENTITIES OF i_purchaserequisitiontp
  ENTITY PurchaseRequisition
  CREATE AUTO FILL CID
  FIELDS ( PurchaseRequisitionType )
  WITH VALUE #( ( PurchaseRequisitionType = 'NB' ) )

  " Create items via association
  ENTITY PurchaseRequisition
  CREATE BY \_PurchaseRequisitionItem
  AUTO FILL CID
  FIELDS ( Plant Material RequestedQuantity )
  WITH VALUE #(
    ( %target = VALUE #(
        ( Plant             = '1010'
          Material          = 'ZMAT001'
          RequestedQuantity = 5 ) ) ) )

  MAPPED   DATA(mapped)
  FAILED   DATA(failed)
  REPORTED DATA(reported).

IF failed IS NOT INITIAL.
  ROLLBACK ENTITIES.
  RETURN.
ENDIF.

" Step 2: COMMIT BEGIN/END để lấy final key
COMMIT ENTITIES BEGIN
  RESPONSE OF i_purchaserequisitiontp
  FAILED   DATA(commit_failed)
  REPORTED DATA(commit_reported).

IF sy-subrc = 0 AND commit_failed IS INITIAL.
  " Step 3: CONVERT KEY — %pid → final document number
  LOOP AT mapped-purchaserequisition ASSIGNING FIELD-SYMBOL(<pr>).
    CONVERT KEY OF i_purchaserequisitiontp
      FROM TEMPORARY <pr>   " TEMPORARY: dùng %tmp khi không có %pid
      TO DATA(ls_final).

    DATA(lv_pr_number) = ls_final-PurchaseRequisition.
  ENDLOOP.
ENDIF.

COMMIT ENTITIES END.
```

> ℹ️ `FROM TEMPORARY` vs `FROM <pid>`:
> - `FROM TEMPORARY <mapped_entry>` → dùng khi instance được tạo trong cùng transaction
> - `FROM <pid>` → dùng khi có %pid explicit từ mapped
>
> Source: https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abapemlcommit_entities_late.htm

---

## 15. Anti-Patterns

### ❌ AP-EML-01: SELECT từ DB thay vì READ ENTITIES trong validation

```abap
" ❌ WRONG — đọc data cũ từ DB, không thấy changes trong buffer
METHOD validateDates.
  LOOP AT keys INTO DATA(ls_key).
    SELECT SINGLE begindate enddate
      FROM ztravel
      WHERE travel_id = @ls_key-TravelId
      INTO @DATA(ls_data).
    " ls_data có thể KHÔNG phản ánh changes vừa làm!
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT
METHOD validateDates.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( BeginDate EndDate )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).
ENDMETHOD.
```

---

### ❌ AP-EML-02: MODIFY ENTITIES trong READ handler

```abap
" ❌ WRONG — side-effect violation → DUMP
METHOD read.
  LOOP AT keys INTO DATA(ls_key).
    READ ENTITIES OF z_i_travel IN LOCAL MODE
      ENTITY Travel ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(lt_result).

    " Tự động cập nhật LastRead time? SAI!
    MODIFY ENTITIES OF z_i_travel IN LOCAL MODE   " ← DUMP
      ENTITY Travel UPDATE FIELDS ( LastReadAt )
      WITH VALUE #( ( %tky = ls_key-%tky LastReadAt = utclong_current( ) ) ).
  ENDLOOP.
ENDMETHOD.
```

---

### ❌ AP-EML-03: Thiếu IN LOCAL MODE trong handler → Infinite loop

```abap
" ❌ WRONG — gọi lại service layer của chính mình
METHOD setStatusOnCreate.
  MODIFY ENTITIES OF z_i_travel   " ← thiếu IN LOCAL MODE
    ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH VALUE #( ... ).
  " Triggers toàn bộ service stack lại → setStatusOnCreate bị gọi lại → infinite loop
ENDMETHOD.

" ✅ CORRECT
METHOD setStatusOnCreate.
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE   " ← mandatory
    ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH VALUE #( ... ).
ENDMETHOD.
```

---

### ❌ AP-EML-04: READ ENTITIES IN LOCAL MODE trong save_modified

```abap
" ❌ WRONG — saver class không có buffer access
METHOD save_modified.
  READ ENTITIES OF z_i_travel IN LOCAL MODE   " ← DUMP in save_modified
    ENTITY Travel ALL FIELDS
    WITH CORRESPONDING #( create-travel )
    RESULT DATA(lt_data).
ENDMETHOD.

" ✅ CORRECT — dùng data được truyền vào save_modified
METHOD save_modified.
  LOOP AT create-travel INTO DATA(ls_create).
    " ls_create đã chứa tất cả fields từ transactional buffer
    CALL FUNCTION 'MY_BAPI'
      EXPORTING data = ls_create-...
  ENDLOOP.
ENDMETHOD.
```

---

### ❌ AP-EML-05: Không clear %state_area → messages cũ tích lũy

```abap
" ❌ WRONG — messages từ lần save trước không bị xóa
METHOD validateDates.
  LOOP AT lt_travels INTO DATA(ls_travel).
    IF ls_travel-EndDate < ls_travel-BeginDate.
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky        = ls_travel-%tky
        " %state_area MISSING → messages accumulate!
        %msg        = new_message_with_text( ... )
      ) TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — clear state_area đầu tiên, dù có lỗi hay không
METHOD validateDates.
  LOOP AT lt_travels INTO DATA(ls_travel).
    " Always append state_area clear entry FIRST
    APPEND VALUE #(
      %tky        = ls_travel-%tky
      %state_area = 'VALIDATE_DATES'   " clears previous messages
    ) TO reported-travel.

    IF ls_travel-EndDate < ls_travel-BeginDate.
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky        = ls_travel-%tky
        %state_area = 'VALIDATE_DATES'
        %msg        = new_message_with_text( ... )
      ) TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

---

### ❌ AP-EML-06: Dùng %key thay vì %tky trong draft-enabled BO

```abap
" ❌ WRONG — %key không chứa %is_draft → ambiguous trong draft BO
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel UPDATE FIELDS ( OverallStatus )
  WITH VALUE #( ( %key-TravelId = lv_id   " ← ambiguous!
                  OverallStatus  = 'A' ) ).

" ✅ CORRECT
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel UPDATE FIELDS ( OverallStatus )
  WITH VALUE #( FOR key IN keys
                ( %tky         = key-%tky  " ← includes %is_draft
                  OverallStatus = 'A' ) ).
```

---

### ❌ AP-EML-07: AUTO FILL CID rồi dùng %cid_ref

```abap
" ❌ WRONG — AUTO FILL CID không cho phép dùng %cid_ref sau
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel CREATE AUTO FILL CID
  FIELDS ( AgencyId ) WITH VALUE #( ( AgencyId = '000001' ) )

  ENTITY Travel CREATE BY \_Booking
  WITH VALUE #(
    ( %cid_ref = ???   " ← không biết %cid được auto-generated là gì!
      %target  = VALUE #( ... ) ) )
  MAPPED DATA(mapped) FAILED DATA(failed) REPORTED DATA(reported).

" ✅ CORRECT — fill %cid thủ công khi cần %cid_ref
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel CREATE FIELDS ( AgencyId )
  WITH VALUE #( ( %cid = 'CID_TRAVEL_1'   " ← manual %cid
                  AgencyId = '000001' ) )

  ENTITY Travel CREATE BY \_Booking
  WITH VALUE #(
    ( %cid_ref = 'CID_TRAVEL_1'   " ← can reference now
      %target  = VALUE #( ... ) ) )
  MAPPED DATA(mapped) FAILED DATA(failed) REPORTED DATA(reported).
```

---

## 16. Sources

| Source | URL | Nội dung |
|---|---|---|
| SAP Help — EML Overview | https://help.sap.com/docs/abap-cloud/abap-rap/entity-manipulation-language-eml | Tổng quan EML |
| SAP Help — %cid | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abapderived_types_cid.htm | %cid, %cid_ref, AUTO FILL CID |
| SAP Help — %pid | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abapderived_types_pid.htm | %pid, late numbering |
| SAP Help — MODIFY ENTITY fields | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abapmodify_entity_entities_fields.htm | MODIFY variants + AUTO FILL CID |
| SAP Help — COMMIT ENTITIES BEGIN/END | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abapemlcommit_entities_late.htm | COMMIT + CONVERT KEY |
| SAP Help — IN LOCAL MODE | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abapin_local_mode.htm | IN LOCAL MODE semantics |
| ABAP Cheat Sheets — EML | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/08_EML_ABAP_for_RAP.md | Complete EML reference với examples |
| ABAP Cheat Sheets — BDL | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/36_RAP_Behavior_Definition_Language.md | BDEF syntax reference |
| Sachin Artani — %tky deep dive | https://sachinartani.com/blog/understanding-tky-in-sap-rap | %tky vs %key, draft scenarios |
| abapeur.fr — EML Part I | https://abapeur.fr/en/eml-part-i/ | %cid vs %pid, strict(2) rules |
| sapdev.eu — EML Samples | https://www.sapdev.eu/rap-eml-samples/ | Quick reference snippets |
| SAP Community — %cid vs %pid | https://community.sap.com/t5/technology-q-a/rap-difference-between-cid-and-pid/qaq-p/12766877 | %cid/%pid/late numbering difference |
| SAP Community — CONVERT KEY | https://community.sap.com/t5/technology-blog-posts-by-members/use-of-convert-key-which-is-return-as-a-preliminary-key-pid-from-late/ba-p/14141942 | CONVERT KEY patterns |
| SAP Community — late numbering READ | https://community.sap.com/t5/technology-q-a/abap-rap-late-numbering-how-to-convert-pid-to-draft-uuid/qaq-p/12623310 | READ ENTITIES trong adjust_numbers |