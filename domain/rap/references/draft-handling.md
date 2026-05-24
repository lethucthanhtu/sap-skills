# RAP — Draft Handling

Hướng dẫn đầy đủ về RAP Draft: draft table setup, draft actions, ETag/locking,
Prepare action, `with additional implementation`, projection BDEF, và debug patterns.

> **Đọc file này khi:** câu hỏi về draft, `with draft`, draft table, `total etag`,
> `draft action Edit/Activate/Discard/Resume`, `draft determine action Prepare`,
> `use draft` trong projection, ETag validation, lock expired, draft concurrency,
> `with additional implementation`, draft + late numbering.

---

## Table of Contents

1. [Draft Concept — Tổng quan](#1-draft-concept--tổng-quan)
2. [Draft Lifecycle — Từ Edit đến Activate](#2-draft-lifecycle--từ-edit-đến-activate)
3. [Draft Table — Cấu trúc bắt buộc](#3-draft-table--cấu-trúc-bắt-buộc)
4. [BDEF — Cú pháp đầy đủ cho draft-enabled BO](#4-bdef--cú-pháp-đầy-đủ-cho-draft-enabled-bo)
5. [ETag và Total ETag — Concurrency control](#5-etag-và-total-etag--concurrency-control)
6. [Draft Actions — Chi tiết từng action](#6-draft-actions--chi-tiết-từng-action)
7. [draft determine action Prepare](#7-draft-determine-action-prepare)
8. [with additional implementation — Custom draft logic](#8-with-additional-implementation--custom-draft-logic)
9. [Projection BDEF — use draft](#9-projection-bdef--use-draft)
10. [EML với draft instances — %is_draft](#10-eml-với-draft-instances--is_draft)
11. [Draft + Composition (Parent-Child)](#11-draft--composition-parent-child)
12. [Draft + Late Numbering](#12-draft--late-numbering)
13. [Draft + CDS Table Entity (ABAP 8.16+)](#13-draft--cds-table-entity-abap-816)
14. [Draft Lock — Pessimistic vs Optimistic](#14-draft-lock--pessimistic-vs-optimistic)
15. [Debug Patterns](#15-debug-patterns)
16. [Anti-Patterns](#16-anti-patterns)
17. [Checklist — Draft Setup](#17-checklist--draft-setup)
18. [Sources](#18-sources)

---

## 1. Draft Concept — Tổng quan

**Draft** = bản tạm thời của BO instance, chưa được persist vào active (production) table.
User có thể edit, save draft nhiều lần, rồi mới Activate (chuyển thành active).

```
Khi nào dùng draft:
  ✅ Fiori transactional apps (Create/Edit object page với auto-save)
  ✅ Ứng dụng cần multi-step workflow trước khi confirm
  ✅ Khi user cần đóng browser giữa chừng, mở lại tiếp tục
  ✅ Cần user review trước khi commit (Prepare → validate trước save)

Khi KHÔNG cần draft:
  ❌ Simple list report hoặc read-only app
  ❌ Immediate-save scenarios (không cần "Save" button concept)
  ❌ Background processing / batch jobs

Draft = SAP-standard feature của Fiori Elements OData V4 apps.
Hầu hết Fiori transactional apps dùng draft.
```

---

## 2. Draft Lifecycle — Từ Edit đến Activate

```
┌─────────────────────────────────────────────────────────────────────┐
│                       DRAFT LIFECYCLE                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Active Instance]                                                   │
│       │                                                              │
│       │  User clicks "Edit"                                          │
│       ▼                                                              │
│  draft action Edit ────────────────────────────────────────────┐    │
│       │  copies active → draft table                            │    │
│       │  sets exclusive lock on active                          │    │
│       ▼                                                         │    │
│  [Draft Instance] (%is_draft = mk-on)                           │    │
│       │                                                         │    │
│       │  User modifies fields                                   │    │
│       │  → Auto-saved to draft table periodically              │    │
│       │                                                         │    │
│       ├──── User navigates away ──────────────────────────────►│    │
│       │     Lock EXPIRES (default: 10 min inactivity)           │    │
│       │     Draft remains in draft table                        │    │
│       │                                                         │    │
│       │  User comes back → "Resume" button shown               │    │
│       │                                                         │    │
│  draft action Resume ◄──────────────────────────────────────────    │
│       │  re-acquires lock (if ETag still valid)                      │
│       │  if ETag mismatch → active was changed → show conflict       │
│       │                                                              │
│       ▼                                                              │
│  [Draft Instance — editing continues]                                │
│       │                                                              │
│       │  User clicks "Save" (= Activate)                            │
│       ▼                                                              │
│  draft determine action Prepare ─────────────────────────────────►  │
│       │  runs validations + determinations                           │
│       │  if errors → show on UI, stay in draft                      │
│       │  if OK → proceed to Activate                                │
│       ▼                                                              │
│  draft action Activate [optimized]                                   │
│       │  copies draft → active table                                 │
│       │  deletes draft table entry                                   │
│       │  releases lock                                               │
│       ▼                                                              │
│  [Active Instance — updated]                                         │
│                                                                      │
│  OR: User clicks "Discard"                                           │
│  draft action Discard ───────────────────────────────────────────►  │
│       │  deletes draft table entries                                 │
│       │  releases lock                                               │
│       ▼                                                              │
│  [Active Instance — unchanged]                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Draft Table — Cấu trúc bắt buộc

Draft table phải có **cùng fields với CDS entity** + **draft admin include**.

```abap
" Active table (ví dụ)
@EndUserText.label: 'Travel'
define table ztravel {
  key client         : abap.clnt not null;
  key travel_id      : /dmo/travel_id not null;
  agency_id          : /dmo/agency_id;
  customer_id        : /dmo/customer_id;
  begin_date         : /dmo/begin_date;
  end_date           : /dmo/end_date;
  overall_status     : /dmo/overall_status;
  last_changed_at    : timestampl;
  local_last_changed_at : timestampl;
}

" Draft table — cùng fields + SYCH_BDL_DRAFT_ADMIN_INC
@EndUserText.label: 'Travel Draft'
define table ztravel_d {
  key client         : abap.clnt not null;
  key travel_id      : /dmo/travel_id not null;   " ← cùng key
  agency_id          : /dmo/agency_id;
  customer_id        : /dmo/customer_id;
  begin_date         : /dmo/begin_date;
  end_date           : /dmo/end_date;
  overall_status     : /dmo/overall_status;
  last_changed_at    : timestampl;
  local_last_changed_at : timestampl;
  " ⚠️ Draft admin fields — bắt buộc
  include SYCH_BDL_DRAFT_ADMIN_INC;
}
```

**Draft admin include `SYCH_BDL_DRAFT_ADMIN_INC` chứa:**

| Field | Type | Ý nghĩa |
|---|---|---|
| `draftentitycreationdatetime` | `UTCLong` | Khi nào draft được tạo |
| `draftentitylastchangedatetime` | `UTCLong` | Lần cuối draft được modified |
| `draftadministrativeuuid` | `sysuuid_x16` | UUID định danh draft entry |
| `hasdraftentity` | `abap_bool` | Active instance có draft không |
| `draftentityoperationcode` | `c(1)` | C = Create draft, U = Update/Edit draft |
| `inprocessbyuser` | `uname` | User đang giữ lock |
| `lastchangedbyuser` | `uname` | User cuối cùng sửa draft |
| `enqueuestarttimestamp` | `UTCLong` | Lock start time |

> ✅ **Quick fix**: Trong ADT sau khi khai báo `draft table ztravel_d` trong BDEF,
> nếu table chưa tồn tại → Quick Fix (Ctrl+1) → **Generate Draft Table** →
> ADT tự tạo đúng structure với draft admin include.
>
> Source: SAP Learning — draft table được tạo tự động bởi Quick Fix trong ADT sau khi khai báo `draft table` trong BDEF

---

## 4. BDEF — Cú pháp đầy đủ cho draft-enabled BO

```abap
" Interface BDEF — đầy đủ draft syntax
managed implementation in class zbp_i_z_travel unique;
strict ( 2 );
with draft;                        " ← 1: Enable draft cho toàn BO

define behavior for Z_I_Travel alias Travel
  persistent table ztravel
  draft table ztravel_d            " ← 2: Draft table
  lock master
  total etag LastChangedAt         " ← 3: Total ETag (bắt buộc cho draft)
  etag master LocalLastChangedAt  " ← 4: Instance ETag
  authorization master ( global )
{
  field ( readonly )            TravelId;
  field ( readonly : update,
          mandatory : create )  AgencyId, CustomerId;
  field ( readonly )            CreatedBy, CreatedAt,
                                LastChangedBy, LastChangedAt,
                                LocalLastChangedAt;

  create;
  update;
  delete;

  association _Booking { create; with draft; }   " ← 5: child cũng phải "with draft"

  " ── Draft Actions ──────────────────────────────────
  draft action Edit;                             " ← 6: Copy active → draft, set lock
  draft action Activate optimized;              " ← 7: Draft → active (skip unchanged)
  draft action Discard;                          " ← 8: Delete draft, release lock
  draft action Resume;                           " ← 9: Re-acquire lock, check ETag

  " ── draft determine action ──────────────────────────
  draft determine action Prepare {              " ← 10: Pre-save validate/determine
    validation ( always ) validateMandatory;
    validation validateDates;
    determination ( always ) setAdminFields;
  }

  " ── Regular operations ──────────────────────────────
  action ( features : instance ) acceptTravel result [1] $self;

  validation validateMandatory on save { create; update; }
  validation validateDates     on save { create; field BeginDate, EndDate; }
  determination setAdminFields on save { create; update; }
  determination setStatus      on modify { create; }

  side effects {
    field BeginDate affects field TotalPrice;
    action acceptTravel affects field OverallStatus;
  }

  mapping for ztravel {
    TravelId           = travel_id;
    AgencyId           = agency_id;
    CustomerId         = customer_id;
    BeginDate          = begin_date;
    EndDate            = end_date;
    OverallStatus      = overall_status;
    LastChangedAt      = last_changed_at;
    LocalLastChangedAt = local_last_changed_at;
  }
}

" Child entity phải có draft table riêng
define behavior for Z_I_Booking alias Booking
  persistent table zbooking
  draft table zbooking_d           " ← child draft table riêng biệt
  lock dependent by _Travel        " ← lock từ parent
  etag dependent by _Travel        " ← ETag từ parent
  authorization dependent by _Travel
{
  field ( readonly ) BookingId, TravelId;
  update;
  delete;

  validation validateFlightDate on save { create; update; field FlightDate; }
  mapping for zbooking { ... }
}
```

---

## 5. ETag và Total ETag — Concurrency control

RAP draft dùng **hai loại ETag** với mục đích khác nhau:

```
etag master <field>       = Optimistic concurrency cho ENTITY instance
total etag <field>        = Concurrency giữa ACTIVE và DRAFT version
```

### Total ETag — tại sao bắt buộc

Total ETag là designated field trong draft-enabled BO dùng để xác định changes giữa active version và draft version. Nếu Total ETag trong active instance khác với giá trị khi draft được tạo → active đã bị thay đổi sau khi draft được tạo → draft invalid → Resume bị từ chối.

```abap
" Total ETag requirements:
" 1. Giá trị trong ACTIVE version LUÔN thay đổi khi active được modified
" 2. Giá trị trong DRAFT instance KHÔNG thay đổi trong suốt draft lifetime

" ✅ CORRECT — dùng LastChangedAt (timestamp) làm total etag
lock master total etag LastChangedAt   " ← thay đổi mỗi khi active được saved
etag master LocalLastChangedAt         " ← entity-level ETag

" ❌ WRONG — dùng field không thay đổi khi update
lock master total etag TravelId        " ← không thay đổi → ETag không phát hiện conflict
```

### ETag flow trong conflict scenario

```
Timeline:
  T1: User A starts Edit → Draft created, total_etag_saved = '2024-01-01 10:00'
  T2: User B modifies active record → active LastChangedAt = '2024-01-01 10:05'
  T3: User A tries to Resume after lock expired

Resume check:
  saved total etag (in draft) = '2024-01-01 10:00'
  current active total etag   = '2024-01-01 10:05'
  → MISMATCH → Resume rejected → Fiori shows "Record changed by another user"
  → User A must reload active and redo changes
```

---

## 6. Draft Actions — Chi tiết từng action

### `draft action Edit`

```abap
" Copies active instance → draft table
" Sets exclusive lock on active record
" Returns draft instance to UI

" Optional: custom logic with additional implementation
draft action Edit with additional implementation;

" Custom handler:
METHOD draft_action_edit.
  " Called BEFORE framework copies active → draft
  " Use for: checking prerequisites, custom lock logic
  LOOP AT keys INTO DATA(ls_key).
    " Check if edit is allowed
    READ ENTITIES OF z_i_travel IN LOCAL MODE
      ENTITY Travel FIELDS ( OverallStatus )
      WITH VALUE #( ( %key = ls_key-%key ) )
      RESULT DATA(lt_travels).

    " Block edit if status is 'Closed'
    IF lt_travels[ 1 ]-OverallStatus = 'C'.
      APPEND VALUE #( %key = ls_key-%key ) TO failed-travel.
      APPEND VALUE #(
        %key = ls_key-%key
        %msg = new_message_with_text(
          severity = if_abap_behv_message=>severity-error
          text     = 'Closed travels cannot be edited' )
      ) TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

> ℹ️ `draft action Edit` với `with additional implementation` cho phép thêm custom logic. Method được gọi TRƯỚC khi framework copy active → draft.

### `draft action Activate [optimized]`

```abap
" Copies draft → active table
" Deletes draft table entries
" Releases lock
" Triggers save sequence (validations, determinations on save, save_modified)

" Activate vs Activate optimized:
draft action Activate;            " ← re-save tất cả entities (kể cả unchanged)
draft action Activate optimized;  " ← chỉ save CHANGED entities → performance

" Best practice cho production: dùng "optimized"
" Kết hợp với (always) trong Prepare cho critical validations
draft action Activate optimized;
draft determine action Prepare {
  validation ( always ) validateMandatory;   " ← force check even if unchanged
  determination ( always ) setAdminFields;
}
```

### `draft action Discard`

```abap
" Deletes all draft table entries for this BO instance
" Releases exclusive lock
" Active instance unchanged

draft action Discard with additional implementation;

" Custom handler — dùng để cleanup custom data khi discard
METHOD draft_action_discard.
  LOOP AT keys INTO DATA(ls_key).
    " e.g. delete temporary attachments
    DELETE FROM zattachment_temp
      WHERE travel_id = @ls_key-%key-TravelId.
  ENDLOOP.
ENDMETHOD.
```

### `draft action Resume`

```abap
" Re-acquires lock for an existing draft instance
" Triggered when user returns to draft after lock expired
" Checks Total ETag: active unchanged? → OK; active changed? → reject

" Resume is also triggered automatically when:
" - User modifies a draft instance whose lock has expired
" - For new draft instances (no active yet): same feature control as Create
" - For existing: same feature control as Edit

draft action Resume;

" Note: Resume KHÔNG cần custom implementation trong hầu hết cases
" Framework tự handle ETag check và lock re-acquisition
```

> Source: `draft action Resume` sets a lock for an entity instance on the persistent database table. It is executed automatically whenever there is a modification on a draft instance whose exclusive lock has expired.

---

## 7. draft determine action Prepare

Prepare là draft-equivalent của determine actions cho active instances.
Chạy khi user nhấn **Save** (trước Activate) — pre-save validation & determination.

```abap
" Syntax đầy đủ
draft determine action Prepare {
  " Validation: chỉ fire khi entity có changes (default)
  validation validateDates;

  " Validation với (always): LUÔN fire, kể cả entity không có changes
  validation ( always ) validateMandatory;

  " Determination với (always): LUÔN recalculate
  determination ( always ) setAdminFields;
  determination ( always ) calculateTotalPrice;

  " Child entity validation
  validation Booking~validateFlightDate;   " ← Alias~method
}

" Mối quan hệ giữa Prepare và validation on save:
" validation khai báo on save → phải listed trong Prepare để fire khi draft Save
" Nếu validation KHÔNG trong Prepare → chỉ fire khi active edit (non-draft flow)
```

### (always) — khi nào bắt buộc

```abap
" ❌ WRONG — validateMandatory không trong (always)
" Scenario: User mở draft → không đổi gì → nhấn Save
" → Prepare fires nhưng validateMandatory bỏ qua (no changes)
" → Mandatory field check bị miss!
draft determine action Prepare {
  validation validateMandatory;   " ← fires only if entity changed
}

" ✅ CORRECT
draft determine action Prepare {
  validation ( always ) validateMandatory;   " ← always check mandatory
  validation validateDates;                  " ← only if dates changed: OK
}
```

---

## 8. with additional implementation — Custom draft logic

```abap
" Thêm custom logic vào draft actions — 4 actions đều hỗ trợ
draft action Edit     with additional implementation;
draft action Activate optimized with additional implementation;
draft action Discard  with additional implementation;
draft action Resume   with additional implementation;
```

### Method signatures trong behavior pool

```abap
" Behavior pool local handler
CLASS lhc_travel DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS:
      " Edit với additional implementation
      draft_action_edit FOR MODIFY
        IMPORTING keys FOR ACTION Travel~Edit RESULT result,

      " Activate với additional implementation
      draft_action_activate FOR MODIFY
        IMPORTING keys FOR ACTION Travel~Activate RESULT result,

      " Discard với additional implementation
      draft_action_discard FOR MODIFY
        IMPORTING keys FOR ACTION Travel~Discard RESULT result,

      " Resume với additional implementation
      draft_action_resume FOR MODIFY
        IMPORTING keys FOR ACTION Travel~Resume RESULT result.
ENDCLASS.

CLASS lhc_travel IMPLEMENTATION.

  METHOD draft_action_edit.
    " Custom pre-edit logic
    " keys = instances user wants to edit
    LOOP AT keys INTO DATA(ls_key).
      " ... custom check ...
    ENDLOOP.
    " result = updated instances (framework fills if not customized)
  ENDMETHOD.

  METHOD draft_action_activate.
    " Custom post-activate logic (rare use case)
    " Most logic should be in validations/determinations in Prepare
    " or in save_modified
  ENDMETHOD.

  METHOD draft_action_discard.
    " Custom cleanup on discard
    LOOP AT keys INTO DATA(ls_key).
      DELETE FROM ztmp_draft_attach
        WHERE travel_id = @ls_key-%key-TravelId.
      IF sy-subrc = 0.
        COMMIT WORK.   " ← OK in save context / draft action context
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

  METHOD draft_action_resume.
    " Custom post-resume logic (very rare)
    " Usually not needed
  ENDMETHOD.

ENDCLASS.
```

> ⚠️ **Use sparingly**: `with additional implementation` thêm complexity.
> Hầu hết logic nên nằm trong validations/determinations (trong Prepare),
> hoặc `save_modified`. Custom draft action implementation chỉ dùng khi
> thực sự cần intercept draft lifecycle (e.g. cleanup temp data on Discard).

---

## 9. Projection BDEF — use draft

Trong projection BDEF, phải dùng `use draft` và expose tất cả draft actions bằng `use action`.

```abap
" Projection BDEF — syntax chuẩn
projection;
strict ( 2 );
use draft;                " ← bắt buộc để enable draft trong projection

define behavior for Z_C_Travel alias Travel
  use etag                " ← inherit ETag từ interface BDEF
{
  use create;
  use update;
  use delete;

  use association _Booking { create; with draft; }

  " ── Expose draft actions ─────────────────────────────
  use action Edit;        " ← bắt buộc expose tất cả 4 draft actions
  use action Activate;
  use action Discard;
  use action Resume;
  use action Prepare;     " ← expose Prepare (= expose validation/determination)

  " ── Expose regular actions ───────────────────────────
  use action acceptTravel;

  " ── Expose validations (nếu cần override behavior) ──
  use validation validateDates;
  use validation validateMandatory;
}
```

> ⚠️ **Phổ biến nhất**: Quên `use action Prepare` trong projection.
> Khi thiếu Prepare → validations trong Prepare không được expose qua UI
> → user Save mà không thấy validation errors.

---

## 10. EML với draft instances — %is_draft

```abap
" %is_draft phân biệt draft instance với active instance:
" if_abap_behv=>mk-on  → draft instance
" if_abap_behv=>mk-off → active instance (default)

" READ draft instance (bên trong handler — IN LOCAL MODE)
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel FIELDS ( OverallStatus BeginDate )
  WITH VALUE #( ( %key-TravelId = lv_id
                  %is_draft     = if_abap_behv=>mk-on ) )  " ← explicit draft
  RESULT DATA(lt_draft).

" READ active instance
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel FIELDS ( OverallStatus )
  WITH VALUE #( ( %key-TravelId = lv_id
                  %is_draft     = if_abap_behv=>mk-off ) )  " ← explicit active
  RESULT DATA(lt_active).

" ✅ Best practice: dùng CORRESPONDING #( keys ) — keys tự có %is_draft correct
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel FIELDS ( OverallStatus )
  WITH CORRESPONDING #( keys )   " ← %tky = %key + %is_draft đã set đúng
  RESULT DATA(lt_result).

" ✅ Luôn dùng %tky trong MODIFY của draft BO (không dùng %key trực tiếp)
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel UPDATE FIELDS ( OverallStatus )
  WITH VALUE #( FOR key IN keys
                ( %tky         = key-%tky   " ← %tky bao gồm %is_draft
                  OverallStatus = 'A' ) ).
```

### Check inside handler: draft hay active?

```abap
" Kiểm tra handler đang xử lý draft hay active instance
METHOD validateDates.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( TravelId BeginDate EndDate )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).

  LOOP AT lt_travels INTO DATA(ls_travel).
    " Nếu cần xử lý khác nhau cho draft vs active:
    IF ls_travel-%is_draft = if_abap_behv=>mk-on.
      " Đây là draft instance (trong Prepare)
      " Có thể validate ít strict hơn (allow partial saves)
    ELSE.
      " Đây là active instance (non-draft save)
      " Full validation
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

---

## 11. Draft + Composition (Parent-Child)

Khi BO có composition hierarchy, **tất cả entities trong composition tree phải có draft table riêng**.
Draft action chỉ khai báo ở **root entity** (lock master).

```abap
" Đúng cấu trúc cho Travel → Booking → BookingSupplements
managed implementation in class zbp_i_z_travel unique;
strict ( 2 );
with draft;

" ROOT entity
define behavior for Z_I_Travel alias Travel
  persistent table ztravel
  draft table ztravel_d
  lock master total etag LastChangedAt
  etag master LocalLastChangedAt
  authorization master ( global )
{
  ...
  draft action Edit;
  draft action Activate optimized;
  draft action Discard;
  draft action Resume;
  draft determine action Prepare {
    validation ( always ) validateMandatory;
    validation validateDates;
    validation Booking~validateFlight;       " ← child validation
  }
  association _Booking { create; with draft; }   " ← "with draft" bắt buộc
  ...
}

" CHILD entity — lock/auth dependent từ parent
define behavior for Z_I_Booking alias Booking
  persistent table zbooking
  draft table zbooking_d         " ← riêng biệt
  lock dependent by _Travel      " ← parent lock
  etag dependent by _Travel      " ← parent ETag
  authorization dependent by _Travel
{
  update;
  delete;
  validation validateFlight on save { create; field FlightDate; }
  association _BookingSuppl { create; with draft; }
  ...
}

" GRANDCHILD entity
define behavior for Z_I_BookingSuppl alias BookingSuppl
  persistent table zbookingsupp
  draft table zbookingsupp_d     " ← riêng biệt
  lock dependent by _Booking
  etag dependent by _Booking
  authorization dependent by _Booking
{
  update;
  delete;
  ...
}
```

> ⚠️ **Không được direct create child** trong draft BO từ external consumer.
> Direct create operations on child instances (có syntax OK trong BDL, nhưng short dump xảy ra lúc runtime).
> → Luôn create child thông qua parent association: `CREATE BY \_Booking`.

---

## 12. Draft + Late Numbering

Late numbering không được hỗ trợ trong draft-enabled BOs theo SAP keyword documentation.
Dùng **early numbering** hoặc **managed numbering** thay thế.

```abap
" ✅ CORRECT cho draft: managed numbering (framework gán UUID tự động)
define behavior for Z_I_Travel alias Travel
  persistent table ztravel
  draft table ztravel_d
  lock master total etag LastChangedAt
{
  field ( numbering : managed, readonly ) TravelId;  " ← managed numbering
  ...
}

" ✅ CORRECT cho draft: early numbering (gán key trong create handler)
define behavior for Z_I_Travel alias Travel ... {
  field ( readonly ) TravelId;   " ← readonly, key set trong create handler

  " Trong CREATE handler:
  " LOOP AT entities → assign TravelId từ number range
  " Key available IMMEDIATELY → no late numbering needed
}

" ❌ WRONG — late numbering với draft
" late numbering      " ← không combine với "with draft"
" etag master LastChangedAt  " ← late numbering BDEF header
```

---

## 13. Draft + CDS Table Entity (ABAP 8.16+)

CDS Table Entities không có syntax cho phép draft persistence được handle trực tiếp. Không thể dùng `draft table` directive với CDS Table Entity làm persistence. Ngoài ra, CDS Table Entities không support extensions.

```abap
" ⚠️ Limitation (tính đến Feb 2026 — ABAP 8.16):
" CDS Table Entity as persistence → vẫn cần separate classic DDIC draft table

" ❌ KHÔNG có syntax này:
define behavior for Z_I_Travel alias Travel
  persistent cds entity ZTE_Travel     " ← CDS Table Entity
  draft cds entity ZTE_Travel_D        " ← KHÔNG tồn tại

" ✅ WORKAROUND (vẫn dùng classic DDIC draft table):
define behavior for Z_I_Travel alias Travel
  persistent cds entity ZTE_Travel     " ← CDS Table Entity làm active persistence
  draft table ztravel_d                " ← classic DDIC table làm draft table
  lock master total etag LastChangedAt
{
  ...
}
```

---

## 14. Draft Lock — Pessimistic vs Optimistic

```
PESSIMISTIC LOCK (exclusive draft lock):
  → Khi user click Edit: active record bị locked
  → Không ai khác có thể Edit cùng lúc
  → Lock timeout: mặc định 10 phút inactivity
  → Sau timeout: lock expires, draft vẫn còn, user cần Resume

OPTIMISTIC LOCK (Total ETag):
  → Detect conflicts khi Resume sau khi lock expired
  → So sánh Total ETag: draft (khi tạo) vs active (hiện tại)
  → Match → OK, Resume thành công
  → Mismatch → Conflict, user phải reload
```

```abap
" Lock configuration trong BDEF:
lock master                   " ← pessimistic: exclusive lock per user
total etag LastChangedAt      " ← optimistic: ETag for conflict detection

" ❌ WRONG — thiếu total etag khi dùng draft
define behavior for Z_I_Travel alias Travel
  draft table ztravel_d
  lock master                  " ← thiếu total etag → activation error
{
  ...
}

" ✅ CORRECT
define behavior for Z_I_Travel alias Travel
  draft table ztravel_d
  lock master total etag LastChangedAt   " ← mandatory for draft
{
  ...
}
```

---

## 15. Debug Patterns

### Problem: "Draft entry still exists after Activate"

```
Symptom: Sau khi user Save, draft entry vẫn còn trong draft table
Root cause: Validation failed → Activate bị blocked → draft not deleted
Debug:
  1. Check Fiori Network tab → POST request tới Prepare:
     response có "target" fields với error messages không?
  2. Check: validation listed trong Prepare không?
  3. Check: validation fires cho đúng trigger (create/field)?
  4. SE16 → draft table → xem record còn đó không
```

### Problem: "Resume rejected — ETag mismatch"

```
Symptom: User mở lại draft sau khi lock expired → "Record changed by another user"
Root cause: Active record bị thay đổi sau khi draft được tạo
Debug:
  1. SE16 → draft table → field draftentitylastchangedatetime
  2. SE16 → active table → field last_changed_at
  3. So sánh: active bị sửa sau T(draft created)?
     YES → expected behavior
     NO  → total etag field không update đúng khi active modified
Fix:
  → Đảm bảo total etag field (e.g. LastChangedAt) được update
    trong MỌIMODIFY operation của active record
```

### Problem: "Validation not firing on draft Save"

```
Root causes (theo thứ tự check):
  1. Validation không có trong Prepare → thêm vào
  2. Validation không có (always) → mandatory check bị skip nếu no changes
  3. Projection BDEF thiếu "use action Prepare" → Prepare không được exposed
  4. Trigger sai (field name, missing create) → xem validation-trigger-guide.md
```

### SE16 / Draft Table Monitoring

```abap
" Check draft entries trong system:
" SE16 → table name = BDEF draft table name (e.g. ZTRAVEL_D)
" Columns quan trọng:
"   INPROCESSBYUSER     → user giữ lock
"   ENQUEUESTARTTIMESTAMP → lock start time
"   HASDRAFTENTITY      → 'X' = active record có draft, ' ' = new entity
"   DRAFTENTITYOPERATIONCODE → 'C' = new draft (no active), 'U' = edit draft
```

---

## 16. Anti-Patterns

### ❌ AP-DFT-01: Thiếu `total etag` trong draft-enabled BO

```abap
" ❌ WRONG — compile/activation error
define behavior for Z_I_Travel alias Travel
  draft table ztravel_d
  lock master                     " ← thiếu total etag → ERROR
{
  draft action Edit; ...
}

" ✅ CORRECT
define behavior for Z_I_Travel alias Travel
  draft table ztravel_d
  lock master total etag LastChangedAt   " ← bắt buộc
{
  ...
}
```

---

### ❌ AP-DFT-02: Child entity không có draft table

```abap
" ❌ WRONG — child thiếu draft table → runtime error khi Edit
define behavior for Z_I_Booking alias Booking
  persistent table zbooking
  " draft table zbooking_d ← MISSING
  lock dependent by _Travel
{
  ...
}

" ✅ CORRECT
define behavior for Z_I_Booking alias Booking
  persistent table zbooking
  draft table zbooking_d      " ← bắt buộc
  lock dependent by _Travel
{
  ...
}
```

---

### ❌ AP-DFT-03: Child association thiếu `with draft`

```abap
" ❌ WRONG — child không draft-enabled từ parent
define behavior for Z_I_Travel alias Travel ... {
  association _Booking { create; }     " ← thiếu "with draft"
  draft action Edit; ...
}

" ✅ CORRECT
define behavior for Z_I_Travel alias Travel ... {
  association _Booking { create; with draft; }   " ← bắt buộc
  draft action Edit; ...
}
```

---

### ❌ AP-DFT-04: Projection thiếu `use draft` hoặc `use action Prepare`

```abap
" ❌ WRONG
projection; strict ( 2 );
" use draft;  ← MISSING → draft không hoạt động từ UI

define behavior for Z_C_Travel alias Travel {
  use create; use update; use delete;
  use action Edit; use action Activate;
  use action Discard; use action Resume;
  " use action Prepare; ← MISSING → validation không hiển thị lỗi khi Save
}

" ✅ CORRECT
projection; strict ( 2 );
use draft;   " ← bắt buộc

define behavior for Z_C_Travel alias Travel {
  use create; use update; use delete;
  use action Edit;
  use action Activate;
  use action Discard;
  use action Resume;
  use action Prepare;   " ← bắt buộc để expose validations
}
```

---

### ❌ AP-DFT-05: Late numbering với draft

```abap
" ❌ WRONG — late numbering không compatible với draft
managed with draft;
late numbering   " ← không compile hoặc runtime error

" ✅ CORRECT — dùng managed numbering hoặc early numbering
managed with draft;
field ( numbering : managed, readonly ) TravelId;   " ← managed numbering: OK
```

---

### ❌ AP-DFT-06: Validation mandatory không có `(always)` trong Prepare

```abap
" ❌ WRONG — mandatory check bị bỏ qua khi user không thay đổi gì
draft determine action Prepare {
  validation validateMandatory;   " ← bị skip nếu no changes!
}

" ✅ CORRECT
draft determine action Prepare {
  validation ( always ) validateMandatory;   " ← luôn check
}
```

---

### ❌ AP-DFT-07: Direct create child instance qua EML (không qua association)

```abap
" ❌ WRONG — compile OK nhưng runtime DUMP trong draft-enabled BO
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Booking CREATE FIELDS ( ... )   " ← direct create child = DUMP
  WITH VALUE #( ... ).

" ✅ CORRECT — create qua parent association
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel CREATE BY \_Booking
  WITH VALUE #(
    ( %cid_ref = 'CID_TRAVEL_1'
      %target  = VALUE #( ( %cid = 'CID_BOOK_1' FlightDate = ... ) ) ) ).
```

---

## 17. Checklist — Draft Setup

```
BDEF INTERFACE:
[ ] "with draft;" trong BDEF header
[ ] "draft table <name>" khai báo cho ROOT entity
[ ] "draft table <name>" khai báo cho MỌI child entity trong composition
[ ] "lock master total etag <field>" — total etag field bắt buộc
[ ] Tất cả 4 draft actions khai báo: Edit, Activate, Discard, Resume
[ ] "draft determine action Prepare" khai báo với validations/determinations
[ ] Mandatory validations dùng "(always)" trong Prepare
[ ] Child entity validations dùng "Alias~method" syntax trong Prepare
[ ] Child associations có "with draft;" keyword

DRAFT TABLE:
[ ] Draft table fields = active table fields (exact match)
[ ] Draft table có "include SYCH_BDL_DRAFT_ADMIN_INC"
[ ] Field names dùng CDS alias names (không dùng DB column names)
[ ] Quick Fix trong ADT để generate draft table (recommended)

PROJECTION BDEF:
[ ] "use draft;" trong projection header
[ ] "use etag" trong entity definition
[ ] Tất cả 4 draft actions được expose: use action Edit/Activate/Discard/Resume
[ ] "use action Prepare;" được expose

NUMBERING:
[ ] Không dùng late numbering với draft BO
[ ] Dùng managed numbering hoặc early numbering

TESTING:
[ ] Test Edit → modify → Save → verify active record updated
[ ] Test Edit → navigate away → Resume → verify ETag check
[ ] Test Edit → navigate away → another user modifies active → Resume → verify conflict
[ ] Test Discard → verify draft table empty
[ ] Test validation in Prepare fires correctly (mandatory + field-specific)
```

---

## 18. Sources

| Source | URL | Nội dung |
|---|---|---|
| SAP Help — with draft | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_with_draft.htm | Syntax, rules, limitations |
| SAP Help — draft action | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_draft_action.htm | Edit/Activate/Discard/Resume detail |
| SAP Help — draft determine action Prepare extensible | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_draft_action_ext.htm | Prepare extensible, (always) keyword |
| SAP Help — Draft Database Table | https://help.sap.com/docs/abap-cloud/abap-rap/draft-database-table | Draft table structure, SYCH_BDL_DRAFT_ADMIN_INC |
| SAP Help — Adding Draft to Managed BO | https://help.sap.com/docs/abap-cloud/abap-rap/adding-draft-capabilities-to-managed-business-object | Step-by-step managed draft |
| SAP Learning — Understanding Draft | https://learning.sap.com/courses/building-transactional-apps-with-the-abap-restful-application-programming-model/understanding-the-draft-concept | Total ETag concept, ADT quick fix |
| SAP Community — Draft Actions detail | https://community.sap.com/t5/technology-blog-posts-by-members/rap-draft-actions/ba-p/13988688 | with additional implementation, projection |
| SAP Community — Customizing Draft Behavior | https://community.sap.com/t5/technology-blog-posts-by-members/abap-rap-customizing-draft-behavior-in-a-fiori-application/ba-p/13575424 | Edit with additional implementation pattern |
| SAP Community — Draft Table Guide | https://community.sap.com/t5/application-development-and-automation-blog-posts/understanding-and-using-draft-tables-in-sap-s-rap-model/ba-p/13882473 | Draft table structure, field explanations |
| Sachin Artani — Enabling Draft | https://sachinartani.com/blog/enabling-draft-in-a-rap-app | Full step-by-step managed draft guide |
| Sachin Artani — Draft on CDS Table Entity | https://sachinartani.com/blog/enabling-draft-in-app-on-cds-table-entity | CDS Table Entity + draft limitations (Feb 2026) |
| software-heroes.com — RAP Draft | https://software-heroes.com/en/blog/abap-rap-draft-en | Draft concepts, ETag, lock explained |
| ABAP Cheat Sheets — Draft Late Numbering | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/src/zcl_demo_abap_rap_draft_ln_m.clas.abap | Code sample: draft + managed numbering |