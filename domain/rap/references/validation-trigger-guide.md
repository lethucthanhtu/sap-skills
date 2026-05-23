# RAP — Validation & Determination Trigger Guide

Hướng dẫn debug khi validation/determination **không fire** hoặc **fire sai**.
File này là checklist thực chiến — đọc top-to-bottom khi gặp vấn đề.

> **Đọc file này khi:** validation không chạy, determination không trigger,
> message không hiển thị trên Fiori, validation chạy nhưng không block save,
> determination chạy nhưng field không được update.

---

## Table of Contents

1. [Validation vs Determination — Khác biệt cốt lõi](#1-validation-vs-determination--khác-biệt-cốt-lõi)
2. [Trigger Conditions — Cú pháp đầy đủ](#2-trigger-conditions--cú-pháp-đầy-đủ)
3. [Checklist Debug — 10 bước theo thứ tự](#3-checklist-debug--10-bước-theo-thứ-tự)
4. [Root Cause A — BDEF Interface thiếu trigger](#4-root-cause-a--bdef-interface-thiếu-trigger)
5. [Root Cause B — Projection BDEF thiếu `use validation`](#5-root-cause-b--projection-bdef-thiếu-use-validation)
6. [Root Cause C — Draft: validation cần `Prepare`](#6-root-cause-c--draft-validation-cần-prepare)
7. [Root Cause D — Field trigger không khớp tên CDS field](#7-root-cause-d--field-trigger-không-khớp-tên-cds-field)
8. [Root Cause E — READ ENTITIES đọc DB thay vì buffer](#8-root-cause-e--read-entities-đọc-db-thay-vì-buffer)
9. [Root Cause F — `%state_area` không được clear](#9-root-cause-f--state_area-không-được-clear)
10. [Root Cause G — Validation trong `failed` nhưng save vẫn xảy ra](#10-root-cause-g--validation-trong-failed-nhưng-save-vẫn-xảy-ra)
11. [Root Cause H — Determination on modify: field không thay đổi](#11-root-cause-h--determination-on-modify-field-không-thay-đổi)
12. [Root Cause I — Method signature sai](#12-root-cause-i--method-signature-sai)
13. [Draft `(always)` — Force trigger bất kể field changes](#13-draft-always--force-trigger-bất-kể-field-changes)
14. [Validation trên child entity trong Prepare](#14-validation-trên-child-entity-trong-prepare)
15. [Thứ tự thực thi và Priority](#15-thứ-tự-thực-thi-và-priority)
16. [State Messages — Khi nào dùng và khi nào không](#16-state-messages--khi-nào-dùng-và-khi-nào-không)
17. [Anti-Patterns](#17-anti-patterns)
18. [Sources](#18-sources)

---

## 1. Validation vs Determination — Khác biệt cốt lõi

| | Validation | Determination |
|---|---|---|
| **Mục đích** | Kiểm tra tính hợp lệ, **block save** nếu lỗi | Tính toán/derive values tự động |
| **Khi nào chạy** | `on save` (save sequence) | `on modify` hoặc `on save` |
| **Có thể MODIFY?** | ❌ Read-only — không được MODIFY ENTITIES | ✅ Được MODIFY ENTITIES IN LOCAL MODE |
| **Kết quả nếu lỗi** | Populate `failed` + `reported` → save bị block | Không block — chỉ update buffer |
| **Phù hợp cho** | Date ranges, mandatory fields, business rules | Admin fields, calculated totals, derived status |

```
Rule: Nếu bạn cần MODIFY ENTITIES trong method → dùng determination, không phải validation.
      Nếu bạn cần block save khi data sai → dùng validation, không phải determination.
```

---

## 2. Trigger Conditions — Cú pháp đầy đủ

```abap
" VALIDATION — chỉ on save
validation ValidateName on save { create; }
validation ValidateDates on save { create; update; }
validation ValidateStatus on save { create; update; delete; }
validation ValidateAmount on save { field NetAmount, Currency; }          " field trigger
validation ValidateAll on save { create; update; field NetAmount; }       " mixed: CUD + field
validation ValidateChild on save { create; update; }                      " in child entity

" DETERMINATION — on modify hoặc on save
determination SetStatus on modify { create; }                             " khi CREATE
determination CalcTotal on modify { field LineItems; }                    " khi field thay đổi
determination SetAdminFields on modify { create; update; }
determination PostProcess on save { create; update; }                     " save sequence
```

### Trigger semantics

| Trigger | Khi nào fire |
|---|---|
| `create` | Instance mới được tạo trong buffer |
| `update` | Instance hiện có được update |
| `delete` | Instance bị xóa (**không dùng trong Prepare**) |
| `field FieldName` | Field đó có giá trị mới trong buffer — kể cả khi value không đổi về nghĩa |
| `create; field X` | OR logic: create **hoặc** field X thay đổi |

> ⚠️ **Field trigger semantics**: `field X` fire khi X được **set trong request**,
> không phải khi X thực sự thay đổi về giá trị. Nếu user set X = 'A' và X đã là 'A'
> → vẫn fire.

---

## 3. Checklist Debug — 10 bước theo thứ tự

Khi validation/determination không fire, kiểm tra **theo đúng thứ tự này**:

```
□ Step 1: Interface BDEF — validation/determination có được khai báo không?
          → Xem Section 4

□ Step 2: Projection BDEF — có "use validation ValidateName" không?
          → Xem Section 5

□ Step 3: Draft enabled? → Validation có trong "draft determine action Prepare" không?
          → Xem Section 6

□ Step 4: Field trigger? → Tên field trong BDEF có khớp chính xác với CDS field name không?
          → Xem Section 7

□ Step 5: Method implementation — READ ENTITIES có dùng IN LOCAL MODE không?
          → Xem Section 8

□ Step 6: State area — %state_area có được clear ở đầu method không?
          → Xem Section 9

□ Step 7: Validation fires nhưng save vẫn xảy ra → failed có được populate không?
          → Xem Section 10

□ Step 8: Determination on modify — field có thực sự thay đổi trong request không?
          → Xem Section 11

□ Step 9: Method name — có khớp chính xác với BDEF declaration không?
          → Xem Section 12

□ Step 10: Xem activation log trong ADT → có syntax error hoặc warning nào không?
           → Window → ABAP → Activation Log sau khi activate behavior pool
```

---

## 4. Root Cause A — BDEF Interface thiếu trigger

**Triệu chứng:** Validation chưa bao giờ được gọi, không có message nào.

```abap
" ❌ WRONG — validation khai báo nhưng thiếu trigger condition
define behavior for Z_I_Travel alias Travel ... {
  validation validateDates;   " ← thiếu "on save { ... }" → syntax error hoặc không fire
}

" ❌ WRONG — field trigger nhưng thiếu CUD trigger
define behavior for Z_I_Travel alias Travel ... {
  validation validateAmount on save { field NetAmount; }
  " ← chỉ fire khi NetAmount thay đổi, KHÔNG fire khi create mới
  " Nếu create mới không set NetAmount → không fire → miss validation
}

" ✅ CORRECT — explicit triggers
define behavior for Z_I_Travel alias Travel ... {
  validation validateDates  on save { create; update; field BeginDate, EndDate; }
  validation validateAmount on save { create; field NetAmount; }
  " ← "create" ensures validation runs even when field is not explicitly set
}
```

**Fix checklist:**
- Mở interface BDEF trong ADT
- Kiểm tra mỗi validation có đủ `on save { ... }` không
- Với mandatory field validation: luôn thêm `create;` vào trigger

---

## 5. Root Cause B — Projection BDEF thiếu `use validation`

**Triệu chứng:** Validation khai báo và implement đúng ở interface, nhưng không fire từ Fiori UI.

```abap
" ❌ WRONG — projection không expose validation
projection;
strict ( 2 );
use draft;

define behavior for Z_C_Travel alias Travel
{
  use create;
  use update;
  use delete;

  use action acceptTravel;
  " validation validateDates KHÔNG có ở đây → Fiori không trigger
}

" ✅ CORRECT — explicitly expose validations
projection;
strict ( 2 );
use draft;

define behavior for Z_C_Travel alias Travel
{
  use create;
  use update;
  use delete;

  use action acceptTravel;

  use validation validateDates;     " ← bắt buộc phải có
  use validation validateAgency;    " ← mỗi validation phải được expose
  use validation validateAmount;
}
```

> 🔴 **Đây là root cause #1 phổ biến nhất.** Validation implement xong ở interface
> nhưng quên expose ở projection → test từ service binding trực tiếp thì OK,
> nhưng qua Fiori app (dùng projection) thì không fire.

**Verify nhanh:** Mở Projection BDEF → Ctrl+F search `use validation` → nếu không có → đây là vấn đề.

---

## 6. Root Cause C — Draft: validation cần `Prepare`

**Triệu chứng:** Validation không fire khi user nhấn Save trong draft-enabled app.

### Tại sao?

Trong draft BO, flow là:
```
User nhấn Save
  → draftActivate (không phải on-save validation!)
  → Prepare action (đây mới là nơi validation chạy)
  → Activate
```

Validation `on save` **KHÔNG tự động chạy** khi `draftActivate` nếu không được khai báo trong `Prepare`.

```abap
" ❌ WRONG — validation khai báo nhưng không trong Prepare
define behavior for Z_I_Travel alias Travel ... {
  with draft;

  draft action Activate optimized;
  draft action Discard;
  draft action Edit;
  draft action Resume;
  draft determine action Prepare;   " ← Prepare rỗng = không có validation nào chạy

  validation validateDates on save { create; update; field BeginDate; }
}

" ✅ CORRECT — validation phải được khai báo trong Prepare
define behavior for Z_I_Travel alias Travel ... {
  with draft;

  draft action Activate optimized;
  draft action Discard;
  draft action Edit;
  draft action Resume;
  draft determine action Prepare {
    validation validateDates;        " ← bắt buộc để fire khi save
    validation validateAgency;
    validation validateAmount;
    determination setAdminFields;    " determinations cũng cần ở đây nếu muốn fire on save
  }

  validation validateDates  on save { create; update; field BeginDate, EndDate; }
  validation validateAgency on save { create; field AgencyId; }
  validation validateAmount on save { create; field NetAmount; }
}
```

### `draft determine action Prepare` vs `draft action Activate optimized`

| | `Prepare` | `Activate optimized` |
|---|---|---|
| **Khi nào chạy** | User click Save → check button → trước Activate | Khi Activate bỏ qua unchanged entities |
| **Validation trong đây** | ✅ Runs validations/determinations | ⚠️ `optimized` bỏ qua entities không changed |
| **Dùng khi** | Pre-save feedback (validate trước khi commit) | Performance optimization |

> ⚠️ **`Activate optimized` + validation**: Nếu entity không changed từ lần save trước,
> `optimized` skip entity đó → validation không chạy → old errors không được re-check.
> Dùng `(always)` trong Prepare để force: xem Section 13.

---

## 7. Root Cause D — Field trigger không khớp tên CDS field

**Triệu chứng:** Validation chỉ fire khi CREATE, nhưng không fire khi update specific field.

```abap
" DDIC table field: begin_date
" CDS view field:   BeginDate  (alias hoặc CamelCase mapping)

" ❌ WRONG — dùng DB table field name
validation validateDates on save { create; field begin_date; }
"                                          ↑ DB name → syntax error hoặc không fire

" ✅ CORRECT — dùng CDS field name (CamelCase như trong CDS view)
validation validateDates on save { create; field BeginDate, EndDate; }
"                                          ↑ CDS field name

" Kiểm tra tên đúng: mở CDS interface view → xem tên field
" Hoặc: BDEF → hover trên field name → ADT sẽ highlight nếu sai
```

**Field name mismatch thường gặp:**

| DB field | ❌ Sai trong BDEF | ✅ Đúng trong BDEF |
|---|---|---|
| `begin_date` | `begin_date` | `BeginDate` |
| `overall_status` | `overall_status` | `OverallStatus` |
| `net_amount` | `net_amount` | `NetAmount` |
| `booking_fee` | `booking_fee` | `BookingFee` |

---

## 8. Root Cause E — READ ENTITIES đọc DB thay vì buffer

**Triệu chứng:** Validation fire nhưng check sai data — không thấy giá trị vừa nhập.

```abap
" ❌ WRONG — SELECT đọc data cũ từ DB, không thấy uncommitted changes
METHOD validateDates.
  LOOP AT keys INTO DATA(ls_key).
    SELECT SINGLE begin_date end_date
      FROM ztravel
      WHERE travel_id = @ls_key-TravelId
      INTO @DATA(ls_db).
    " ls_db-begin_date = giá trị trong DB (cũ), không phải giá trị user vừa nhập!

    IF ls_db-begin_date IS INITIAL.
      " → sẽ KHÔNG catch lỗi nếu begin_date = initial chỉ trong buffer
    ENDIF.
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — READ ENTITIES IN LOCAL MODE đọc từ transactional buffer
METHOD validateDates.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel
    FIELDS ( TravelId BeginDate EndDate )
    WITH CORRESPONDING #( keys )   " ← keys parameter từ method signature
    RESULT DATA(lt_travels)
    FAILED DATA(read_failed).

  LOOP AT lt_travels INTO DATA(ls_travel).
    IF ls_travel-BeginDate IS INITIAL.
      " Đọc từ buffer → thấy đúng giá trị user đang nhập
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

> ℹ️ **Exception**: Validation cần check data từ DB khác (cross-entity check,
> e.g. check Agency tồn tại trong table ZAgency) → `SELECT` từ DB là hợp lệ cho data đó.
> Nhưng data của entity đang validate → phải dùng `READ ENTITIES IN LOCAL MODE`.

---

## 9. Root Cause F — `%state_area` không được clear

**Triệu chứng:** Error messages từ lần save trước vẫn hiển thị dù lỗi đã được fix.
Hoặc: messages nhân đôi sau mỗi lần save.

```abap
" ❌ WRONG — không clear state_area → messages cũ tích lũy
METHOD validateDates.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( BeginDate EndDate )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).

  LOOP AT lt_travels INTO DATA(ls_travel).
    IF ls_travel-EndDate < ls_travel-BeginDate.
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky = ls_travel-%tky
        " %state_area MISSING → persists indefinitely in draft!
        %msg = new_message_with_text( severity = if_abap_behv_message=>severity-error
                                      text     = 'End date before begin date' )
      ) TO reported-travel.
    ENDIF.
    " Nếu lỗi đã được fix và không vào IF → không có entry trong reported
    " → state messages cũ từ draft vẫn còn!
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — luôn clear state_area ĐẦU TIÊN, dù có lỗi hay không
METHOD validateDates.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( BeginDate EndDate )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).

  LOOP AT lt_travels INTO DATA(ls_travel).
    " Step 1: ALWAYS append clear entry for this state_area
    APPEND VALUE #(
      %tky        = ls_travel-%tky
      %state_area = 'VALIDATE_DATES'   " unique name per validation method
    ) TO reported-travel.

    " Step 2: Check and add error messages
    IF ls_travel-EndDate < ls_travel-BeginDate.
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky        = ls_travel-%tky
        %state_area = 'VALIDATE_DATES'  " same state_area
        %element-EndDate = if_abap_behv=>mk-on
        %msg = new_message_with_text(
          severity = if_abap_behv_message=>severity-error
          text     = 'End date must be after begin date' )
      ) TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

**`%state_area` naming rules:**
- Phải unique per validation method trong toàn BO
- String constant, uppercase convention: `'VALIDATE_DATES'`, `'VALIDATE_AGENCY'`
- Hai validations dùng cùng `%state_area` sẽ xóa messages của nhau

---

## 10. Root Cause G — Validation trong `failed` nhưng save vẫn xảy ra

**Triệu chứng:** Message hiển thị nhưng màu vàng (warning), data vẫn được save.

**Nguyên nhân 1: `failed` không được populate** — chỉ có `reported`, không có `failed`

```abap
" ❌ WRONG — chỉ báo message, không populate failed → save không bị block
METHOD validateDates.
  LOOP AT lt_travels INTO DATA(ls_travel).
    IF ls_travel-BeginDate IS INITIAL.
      " Chỉ có reported, KHÔNG có failed:
      APPEND VALUE #(
        %tky = ls_travel-%tky
        %msg = new_message_with_text( severity = if_abap_behv_message=>severity-error
                                      text = 'Begin date required' )
      ) TO reported-travel.
      " ← thiếu: APPEND VALUE #( %tky = ... ) TO failed-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — cả failed VÀ reported phải được populate để block save
METHOD validateDates.
  LOOP AT lt_travels INTO DATA(ls_travel).
    IF ls_travel-BeginDate IS INITIAL.
      " Populate BOTH:
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.   " ← blocks save
      APPEND VALUE #(
        %tky = ls_travel-%tky
        %state_area = 'VALIDATE_DATES'
        %element-BeginDate = if_abap_behv=>mk-on
        %msg = new_message_with_text( severity = if_abap_behv_message=>severity-error
                                      text = 'Begin date required' )
      ) TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

**Nguyên nhân 2: `severity` không phải `-error`**

```abap
" ❌ WRONG — warning không block save dù failed được populate
%msg = new_message_with_text(
  severity = if_abap_behv_message=>severity-warning   " ← warning = không block!
  text     = 'Begin date required' )

" ✅ CORRECT
severity = if_abap_behv_message=>severity-error   " ← error = blocks save
```

**Nguyên nhân 3: strict(2) mode thiếu → Fiori không enforce**

```abap
" Với strict(0) hoặc strict(1), một số validation behaviors có thể không được enforce
" ✅ Đảm bảo BDEF dùng strict(2):
managed implementation in class zbp_z_i_travel unique;
strict ( 2 );   " ← bắt buộc cho production
```

---

## 11. Root Cause H — Determination on modify: field không thay đổi

**Triệu chứng:** Determination `on modify { field X; }` không fire khi expected.

```abap
" BDEF:
determination setTotalPrice on modify { field UnitPrice, Quantity; }

" Tình huống không fire:
" 1. User không thay đổi UnitPrice hoặc Quantity trong request này
" 2. User set UnitPrice = same value as before (e.g. 100 → 100)
"    → RAP vẫn fire vì field WAS SET trong request (không so sánh old/new value)
" 3. Determination on modify = chỉ fire trong interaction phase
"    Nếu test qua direct EML không set field → không fire
```

**Giải pháp khi cần force fire bất kể field change:**

```abap
" Option 1: Thêm create trigger
determination setTotalPrice on modify { create; field UnitPrice, Quantity; }
" → sẽ fire khi create mới HOẶC khi UnitPrice/Quantity được set

" Option 2: Dùng on save thay vì on modify
determination setTotalPrice on save { create; update; }
" → fire mọi lần save, bất kể field nào thay đổi

" Option 3: Dùng determine action với (always) trong Prepare
draft determine action Prepare {
  determination ( always ) setTotalPrice;   " ← force fire mọi lần Prepare
}
determination setTotalPrice on save { create; update; }
```

**Determination on save vs on modify:**

| | `on modify` | `on save` |
|---|---|---|
| **Timing** | Ngay trong interaction phase | Save sequence — sau interaction phase |
| **Có thể đọc buffer?** | ✅ READ ENTITIES IN LOCAL MODE | ❌ KHÔNG (save_modified không có buffer) |
| **Khi nào dùng** | Real-time field derivation (totals, status) | Post-processing sau khi tất cả changes done |
| **Side effects** | Có thể trigger other determinations | Không trigger determination on modify |

---

## 12. Root Cause I — Method signature sai

**Triệu chứng:** Activation error, hoặc method có nhưng không được gọi.

```abap
" BDEF:
validation validateDates on save { create; field BeginDate; }

" ❌ WRONG — method name không khớp BDEF (case mismatch)
METHODS:
  ValidateDates FOR VALIDATE ON SAVE    " ← capital V: error in ABAP Cloud
    IMPORTING keys FOR z_i_travel~ValidateDates.

" ❌ WRONG — thiếu FOR VALIDATE ON SAVE keyword
METHODS:
  validateDates                          " ← không khai báo đây là validation method
    IMPORTING keys FOR z_i_travel~validateDates.

" ❌ WRONG — entity name trong signature sai (alias vs view name)
METHODS:
  validateDates FOR VALIDATE ON SAVE
    IMPORTING keys FOR z_i_travel~validateDates.    " ← z_i_travel = view name
    " nhưng BDEF dùng alias Travel → phải dùng z_i_travel~validateDates
    " (entity name trong signature = CDS view name, không phải alias)

" ✅ CORRECT — method signature chuẩn
METHODS:
  validateDates FOR VALIDATE ON SAVE
    IMPORTING keys FOR z_i_travel~validateDates.
"             ↑ method name phải exact match BDEF declaration
"                              ↑ CDS view name (không phải alias) ~ validation name
```

**Quick check:** Trong ADT, sau khi activate BDEF → Quick Fix (Ctrl+1) trên class definition sẽ auto-generate đúng signature. Dùng Quick Fix thay vì tự viết.

---

## 13. Draft `(always)` — Force trigger bất kể field changes

Dùng `(always)` trong `Prepare` khi validation/determination phải luôn chạy,
bất kể field nào thay đổi hay không.

```abap
" Use case: User mở draft → không đổi gì → nhấn Save
" Bình thường: validation chỉ fire cho changed fields → mandatory fields không được check!
" Fix: (always) trong Prepare

define behavior for Z_I_Travel alias Travel ... {
  with draft;

  draft action Activate optimized;
  draft action Discard;
  draft action Edit;
  draft action Resume;

  draft determine action Prepare {
    " WITHOUT (always): chỉ fire cho changed entities
    validation validateDates;

    " WITH (always): luôn fire cho tất cả instances, bất kể có changes không
    validation ( always ) validateMandatory;    " ← mandatory field check: dùng (always)
    determination ( always ) setAdminFields;   " ← admin fields: dùng (always) để luôn refresh
  }

  validation validateDates     on save { create; update; field BeginDate, EndDate; }
  validation validateMandatory on save { create; update; }
  determination setAdminFields on save { create; update; }
}
```

**Khi nào dùng `(always)`:**

| Scenario | Dùng `(always)`? |
|---|---|
| Mandatory field validation | ✅ Yes — phải check dù user không touch field |
| Date range validation | Tùy — nếu muốn re-validate mọi lần save → Yes |
| Admin fields (CreatedAt/ChangedAt) | ✅ Yes — luôn update |
| Calculated total | ✅ Yes — re-calculate mọi lần save để đảm bảo consistency |
| Business rule phức tạp | ✅ Yes nếu rule có thể invalidate khi data liên quan khác thay đổi |
| Performance-sensitive check (BAPI call) | ❌ No — chỉ fire khi relevant field thay đổi |

> Source: https://community.sap.com/t5/technology-q-a/sap-rap-trigger-determination-on-save-without-field-changes/qaq-p/13707003

---

## 14. Validation trên child entity trong Prepare

Khi BO có composition (parent → child), validation trên child cần khai báo đặc biệt.

```abap
" Interface BDEF — child entity
define behavior for Z_I_Booking alias Booking ... {
  " trong child entity:
  validation validateFlightDate on save { create; update; field FlightDate; }
}

" Interface BDEF — parent entity
define behavior for Z_I_Travel alias Travel ... {
  with draft;

  draft determine action Prepare {
    validation validateDates;              " ← parent validation
    validation Booking~validateFlightDate; " ← child validation với syntax: Alias~method
    "           ↑ alias của child entity = Booking (từ "alias Booking" trong child BDEF)
  }

  validation validateDates on save { create; update; }
}

" ⚠️ Lưu ý:
" - delete trigger KHÔNG được dùng trong child validation khi trong Prepare
" - Alias phải khớp với "alias" keyword trong child BDEF declaration
```

---

## 15. Thứ tự thực thi và Priority

```
SAVE SEQUENCE thứ tự:
  1. finalize()           — derivations cuối cùng (saver class)
  2. check_before_save()  — unmanaged only: last validation (saver class)
  3. Validations          — tất cả validations chạy (thứ tự không đảm bảo)
  4. save_modified()      — persist (nếu không có failed)
  5. cleanup_finalize()

Trong INTERACTION PHASE:
  Determinations on modify → fire ngay khi field thay đổi trong buffer
  Không có guaranteed order giữa các determinations → không depend on order!
```

```abap
" ⚠️ KHÔNG viết code phụ thuộc vào thứ tự validation:
" validation A phải chạy TRƯỚC validation B → KHÔNG đảm bảo
" Giải pháp: gộp vào 1 validation method, hoặc không depend on order
```

---

## 16. State Messages — Khi nào dùng và khi nào không

```
Dùng state messages (%state_area):
  ✅ Validation on save trong managed BO
  ✅ Validation/determination trong Prepare (draft)
  ✅ Unmanaged: check_before_save / finalize

KHÔNG dùng state messages:
  ❌ Actions (kể cả action ở projection layer → DUMP)
  ❌ Determination on modify (không phải state context)
  ❌ Transition messages (e.g. "Order submitted successfully")
     → Dùng thay thế: new_message_with_text không có %state_area
```

```abap
" State message = gắn với STATE của entity, tồn tại đến khi state thay đổi
" Dùng trong validation:
APPEND VALUE #(
  %tky        = ls_travel-%tky
  %state_area = 'VALIDATE_DATES'   " ← state message
  %msg        = new_message_with_text( severity = ... text = '...' )
) TO reported-travel.

" Transition message = gắn với REQUEST hiện tại, mất sau khi request xong
" Dùng trong action hoặc general feedback:
APPEND VALUE #(
  %tky = ls_travel-%tky
  " %state_area KHÔNG có ← transition message
  %msg = new_message_with_text( severity = ... text = '...' )
) TO reported-travel.
```

> Source: https://community.sap.com/t5/abap-blog-posts/validation-in-draft-with-state-messages-in-rap/ba-p/14228996

---

## 17. Anti-Patterns

### ❌ AP-VAL-01: MODIFY ENTITIES trong validation

```abap
" ❌ WRONG — validation KHÔNG được modify buffer
METHOD validateDates.
  READ ENTITIES OF z_i_travel IN LOCAL MODE ...
  LOOP AT lt_travels INTO DATA(ls_travel).
    IF ls_travel-BeginDate IS INITIAL.
      " "Fix" the date automatically? WRONG!
      MODIFY ENTITIES OF z_i_travel IN LOCAL MODE   " ← FORBIDDEN in validation
        ENTITY Travel UPDATE FIELDS ( BeginDate )
        WITH VALUE #( ( %tky = ls_travel-%tky BeginDate = sy-datum ) ).
    ENDIF.
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — validation chỉ CHECK, không sửa
" Nếu cần auto-fix → dùng determination on save thay vì validation
```

---

### ❌ AP-VAL-02: Validation không expose ở projection

```abap
" ❌ WRONG — validation bị "missing" với developer vì quên expose
projection; strict ( 2 ); use draft;
define behavior for Z_C_Travel alias Travel {
  use create; use update; use delete;
  " validation không được expose → không fire từ UI
}

" ✅ CORRECT
projection; strict ( 2 ); use draft;
define behavior for Z_C_Travel alias Travel {
  use create; use update; use delete;
  use validation validateDates;
  use validation validateMandatory;
}
```

---

### ❌ AP-VAL-03: Bỏ qua Prepare trong draft BO

```abap
" ❌ WRONG — validation khai báo nhưng không trong Prepare
define behavior for Z_I_Travel alias Travel ... {
  with draft;
  draft determine action Prepare;  " ← empty Prepare
  validation validateDates on save { create; update; }
}

" ✅ CORRECT
define behavior for Z_I_Travel alias Travel ... {
  with draft;
  draft determine action Prepare {
    validation validateDates;   " ← validation phải vào đây để fire on save
  }
  validation validateDates on save { create; update; }
}
```

---

### ❌ AP-VAL-04: Dùng state message trong action

```abap
" ❌ WRONG — state message trong action → DUMP hoặc runtime error
METHOD acceptTravel.
  ...
  APPEND VALUE #(
    %tky        = ls_travel-%tky
    %state_area = 'ACCEPT_ACTION'   " ← FORBIDDEN in action!
    %msg        = new_message_with_text( ... )
  ) TO reported-travel.
ENDMETHOD.

" ✅ CORRECT — dùng transition message (không có %state_area) trong action
METHOD acceptTravel.
  ...
  APPEND VALUE #(
    %tky = ls_travel-%tky   " no %state_area
    %msg = new_message_with_text( severity = if_abap_behv_message=>severity-success
                                  text     = 'Travel accepted' )
  ) TO reported-travel.
ENDMETHOD.
```

---

### ❌ AP-VAL-05: Field trigger dùng DB column name

```abap
" ❌ WRONG
validation validateBegin on save { field begin_date; }   " DB column name

" ✅ CORRECT
validation validateBegin on save { field BeginDate; }    " CDS field name
```

---

### ❌ AP-VAL-06: Determination on modify cho admin fields — không dùng (always) trong Prepare

```abap
" ❌ WRONG — admin fields không được update nếu user không change anything
draft determine action Prepare {
  determination setAdminFields;   " ← WITHOUT (always): skip nếu không có changes
}
determination setAdminFields on save { create; update; }

" ✅ CORRECT
draft determine action Prepare {
  determination ( always ) setAdminFields;  " ← always update timestamps
}
determination setAdminFields on save { create; update; }
```

---

## 18. Sources

| Source | URL | Nội dung |
|---|---|---|
| SAP Help — Validations | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abenbdl_validations.htm | Syntax, trigger conditions |
| SAP Help — Determinations | https://help.sap.com/docs/abap-cloud/abap-rap/determinations | Determination syntax, on modify vs on save |
| SAP Help — draft action Prepare | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_draft_action.htm | Prepare, (always), Activate optimized |
| SAP Help — determine action | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_determine_action.htm | determine action, child~validation syntax |
| SAP Community — State messages | https://community.sap.com/t5/abap-blog-posts/validation-in-draft-with-state-messages-in-rap/ba-p/14228996 | State vs transition messages, %state_area |
| SAP Community — Trigger on save without field change | https://community.sap.com/t5/technology-q-a/sap-rap-trigger-determination-on-save-without-field-changes/qaq-p/13707003 | (always) keyword usage |
| SAP Community — Validation not triggering (unmanaged) | https://community.sap.com/t5/technology-q-a/validation-not-triggering-abap-rap-unmanaged/qaq-p/12770407 | Unmanaged + draft validation patterns |
| devdiary.ch — Register validation event | https://devdiary.ch/2024/01/15/how-to-register-a-validation-event-in-sap-rap-for-create-and-update/ | Prepare + validation step-by-step |
| discoveringabap.com — Determine Actions | https://discoveringabap.com/2023/03/30/determine-actions-in-abap-restful-application-programming-model/ | Determine action, child~method syntax |
| SAP Community — Precheck, Validation, Determination | https://community.sap.com/t5/technology-blog-posts-by-members/precheck-methods-validations-determinations-read-and-modify-eml-statements/ba-p/14032642 | Combined patterns, (always) in Prepare |
| sachinartani.com — Validation & Precheck | https://sachinartani.com/blog/sap-rap-validation-and-precheck | Practical validation + precheck guide |