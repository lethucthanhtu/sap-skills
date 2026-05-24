# RAP — Actions & Feature Control

Hướng dẫn đầy đủ về RAP Actions (tất cả types), Feature Control (instance/global),
Precheck, Determine Actions, và các patterns thực tế.

> **Đọc file này khi:** câu hỏi về action, `FOR MODIFY FOR ACTION`, static action,
> factory action, copy action, feature control, `get_instance_features`,
> `get_global_features`, `fc-o-disabled`, `fc-f-mandatory`, precheck,
> `FOR PRECHECK`, determine action, `%param`, `result [1] $self`.
>
> *Validations và determinations: xem `validation-trigger-guide.md` và `eml-patterns.md`.*

---

## Table of Contents

1. [Action Types — Tổng quan](#1-action-types--tổng-quan)
2. [BDEF Syntax — Tất cả variants](#2-bdef-syntax--tất-cả-variants)
3. [Instance Non-Factory Action — Pattern chuẩn](#3-instance-non-factory-action--pattern-chuẩn)
4. [Static Non-Factory Action — Bulk operations](#4-static-non-factory-action--bulk-operations)
5. [Instance Factory Action — Copy pattern](#5-instance-factory-action--copy-pattern)
6. [Static Factory Action — Create with defaults](#6-static-factory-action--create-with-defaults)
7. [Action với Parameter (Abstract Entity)](#7-action-với-parameter-abstract-entity)
8. [Internal Action — Chỉ dùng trong behavior pool](#8-internal-action--chỉ-dùng-trong-behavior-pool)
9. [Repeatable Action](#9-repeatable-action)
10. [Instance Feature Control — get_instance_features](#10-instance-feature-control--get_instance_features)
11. [Global Feature Control — get_global_features](#11-global-feature-control--get_global_features)
12. [Field Feature Control — %field trong instance FC](#12-field-feature-control--field-trong-instance-fc)
13. [Precheck — Gatekeeper trước buffer](#13-precheck--gatekeeper-trước-buffer)
14. [Determine Action — On-demand trigger](#14-determine-action--on-demand-trigger)
15. [Projection BDEF — Expose actions](#15-projection-bdef--expose-actions)
16. [Action Result — $self vs deep result vs abstract entity](#16-action-result--self-vs-deep-result-vs-abstract-entity)
17. [Anti-Patterns](#17-anti-patterns)
18. [Checklist](#18-checklist)
19. [Sources](#19-sources)

---

## 1. Action Types — Tổng quan

```
NON-FACTORY ACTIONS — thay đổi state của instance hiện có
│
├── Instance action (default)
│   → Thao tác trên instance đang được chọn
│   → `action acceptTravel result [1] $self`
│   → Button trên Object Page hoặc List Report (khi select rows)
│
├── Static action
│   → Thao tác trên toàn bộ entity (không bound với instance cụ thể)
│   → `static action clearAllDrafts`
│   → Button trên List Report (không cần select row)
│
└── Internal action
    → Chỉ gọi được từ bên trong behavior pool
    → `internal action recalculate`

FACTORY ACTIONS — tạo instance mới
│
├── Instance factory action (copy action)
│   → Copy values từ instance hiện có, tạo instance mới
│   → `factory action copyTravel [1]`
│   → "Copy" button trên Object Page/List Report
│
└── Static factory action
    → Tạo instance mới với default values (không cần base instance)
    → `static factory action createFromTemplate [1]`
    → Có thể đặt làm `default factory action` cho OData CREATE
```

---

## 2. BDEF Syntax — Tất cả variants

```abap
" Interface BDEF — tất cả action syntax variants

define behavior for Z_I_Travel alias Travel ... {

  " ── Non-factory instance actions ──────────────────────────
  " Basic instance action
  action acceptTravel result [1] $self;

  " Instance action với feature control
  action ( features : instance ) rejectTravel result [1] $self;

  " Instance action với global feature control
  action ( features : global ) bulkApprove result [1] $self;

  " Instance action với parameter input
  action rejectWithReason
    parameter Z_A_RejectParam
    result [1] $self;

  " Instance action với deep result (S/4HANA 2022+)
  action deepAction deep result selective [1] Z_A_DeepResult;

  " Instance action với precheck
  action ( precheck ) deleteWithCheck;

  " Repeatable action (can be called multiple times on same instance)
  repeatable action recalculate result [1] $self;

  " Internal action (only callable from within behavior pool)
  internal action syncStatus;

  " ── Factory actions ──────────────────────────────────────
  " Instance factory action (copy)
  factory action copyTravel [1];

  " Static factory action (create with defaults)
  static factory action createFromTemplate [1];

  " Default factory action (used by OData as default CREATE)
  default factory action createFromTemplate [1];

  " ── Static non-factory actions ───────────────────────────
  " Static action (no instance binding)
  static action clearExpiredDrafts;

  " Static action với parameter
  static action massUpdate parameter Z_A_MassUpdateParam;

  " ── Determine actions ────────────────────────────────────
  determine action triggerRecalc {
    determination ( always ) calculateTotal;
  }
}
```

---

## 3. Instance Non-Factory Action — Pattern chuẩn

```abap
" BDEF:
action ( features : instance ) acceptTravel result [1] $self;

" Method signature — generated by Quick Fix (Ctrl+1)
METHODS acceptTravel FOR MODIFY
  IMPORTING keys FOR ACTION Z_I_Travel~acceptTravel
  RESULT result.

" Implementation — chuẩn 4 bước
METHOD acceptTravel.
  " Step 1: READ current state từ buffer
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel
    FIELDS ( TravelId AgencyId OverallStatus )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels)
    FAILED DATA(read_failed).

  " Step 2: Filter + validate
  DATA lt_update TYPE TABLE FOR UPDATE z_i_travel\\Travel.
  LOOP AT lt_travels INTO DATA(ls_travel).
    " Skip already accepted
    IF ls_travel-OverallStatus = 'A'.
      APPEND VALUE #(
        %tky = ls_travel-%tky
        %msg = new_message_with_text(
          severity = if_abap_behv_message=>severity-warning
          text     = 'Travel already accepted' )
      ) TO reported-travel.
      CONTINUE.
    ENDIF.

    APPEND VALUE #(
      %tky          = ls_travel-%tky
      OverallStatus = 'A'
    ) TO lt_update.
  ENDLOOP.

  " Step 3: MODIFY buffer
  IF lt_update IS NOT INITIAL.
    MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
      ENTITY Travel
      UPDATE FIELDS ( OverallStatus )
      WITH lt_update
      REPORTED DATA(update_reported).
    reported = CORRESPONDING #( DEEP update_reported ).
  ENDIF.

  " Step 4: Build result — READ updated state
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel ALL FIELDS
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_result).

  result = VALUE #( FOR r IN lt_result
                    ( %tky   = r-%tky
                      %param = r ) ).
ENDMETHOD.
```

---

## 4. Static Non-Factory Action — Bulk operations

Static action không bound với instance cụ thể — nhận danh sách keys hoặc không nhận gì.

```abap
" BDEF:
static action clearExpiredTravels;
static action massReject parameter Z_A_MassRejectParam;

" Method signature — static: không có keys parameter theo cách thông thường
METHODS clearExpiredTravels FOR MODIFY
  IMPORTING keys FOR ACTION Z_I_Travel~clearExpiredTravels.

METHODS massReject FOR MODIFY
  IMPORTING keys FOR ACTION Z_I_Travel~massReject.

" Implementation
METHOD clearExpiredTravels.
  " Static action: keys có thể empty (không bound to instance)
  " Logic áp dụng cho toàn entity

  " Tìm tất cả expired travels trực tiếp từ buffer hoặc DB
  SELECT FROM ztravel
    FIELDS travel_id
    WHERE overall_status = 'O'
      AND end_date < @sy-datum
    INTO TABLE @DATA(lt_expired).

  " Modify all expired via EML
  IF lt_expired IS NOT INITIAL.
    MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
      ENTITY Travel
      UPDATE FIELDS ( OverallStatus )
      WITH VALUE #( FOR lt IN lt_expired
                    ( %key-TravelId = lt-travel_id
                      OverallStatus  = 'X' ) )   " X = Expired
      REPORTED DATA(reported_inner).
    reported = CORRESPONDING #( DEEP reported_inner ).
  ENDIF.
ENDMETHOD.

METHOD massReject.
  " Parameter từ user input (e.g. rejection reason text)
  " keys[1]-%param chứa parameter (static action: dùng first entry)
  DATA(lv_reason) = keys[ 1 ]-%param-RejectionReason.

  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( TravelId OverallStatus )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).

  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH VALUE #( FOR lt IN lt_travels
                  ( %tky = lt-%tky OverallStatus = 'R' ) )
    REPORTED DATA(rep).
  reported = CORRESPONDING #( DEEP rep ).
ENDMETHOD.
```

---

## 5. Instance Factory Action — Copy pattern

Instance factory action tạo instance MỚI dựa trên values của instance được chọn.

```abap
" BDEF:
factory action copyTravel [1];   " [1] = cardinality: tạo 1 instance mới

" Method signature — factory action KHÔNG có RESULT parameter
" (result được trả qua MAPPED, không phải RESULT)
METHODS copyTravel FOR MODIFY
  IMPORTING keys FOR ACTION Z_I_Travel~copyTravel
  MAPPED mapped.

" Implementation
METHOD copyTravel.
  " Step 1: READ source instance
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel ALL FIELDS
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_source).

  " Step 2: BUILD new instances — copy fields, assign new key/CID
  DATA lt_creates TYPE TABLE FOR CREATE z_i_travel\\Travel.
  LOOP AT lt_source INTO DATA(ls_source).
    " Generate new key
    DATA(lv_new_id) = cl_system_uuid=>create_uuid_x16_static( ).

    APPEND VALUE #(
      %cid          = |COPY_{ ls_source-TravelId }|   " unique CID per copy
      TravelId      = lv_new_id
      AgencyId      = ls_source-AgencyId
      CustomerId    = ls_source-CustomerId
      BeginDate     = ls_source-BeginDate
      EndDate       = ls_source-EndDate
      BookingFee    = ls_source-BookingFee
      CurrencyCode  = ls_source-CurrencyCode
      OverallStatus = 'O'    " reset status to Open for new copy
      %control = VALUE #(
        TravelId      = if_abap_behv=>mk-on
        AgencyId      = if_abap_behv=>mk-on
        CustomerId    = if_abap_behv=>mk-on
        BeginDate     = if_abap_behv=>mk-on
        EndDate       = if_abap_behv=>mk-on
        BookingFee    = if_abap_behv=>mk-on
        CurrencyCode  = if_abap_behv=>mk-on
        OverallStatus = if_abap_behv=>mk-on )
    ) TO lt_creates.
  ENDLOOP.

  " Step 3: CREATE new instances
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel CREATE FROM lt_creates
    MAPPED   DATA(mapped_inner)
    FAILED   DATA(failed_inner)
    REPORTED DATA(reported_inner).

  " Step 4: Propagate — mapped is critical for factory action result
  mapped    = CORRESPONDING #( DEEP mapped_inner ).
  failed    = CORRESPONDING #( DEEP failed_inner ).
  reported  = CORRESPONDING #( DEEP reported_inner ).
ENDMETHOD.
```

> ⚠️ **Factory action result**: phải populate `mapped` (không phải `result`).
> `mapped-travel[ %cid = 'COPY_...' ]-TravelId` = key của instance mới.
> Consumer (Fiori) dùng mapped để navigate đến record mới tạo.
> Source: https://developers.sap.com/tutorials/abap-environment-rap100-factory-action..html

---

## 6. Static Factory Action — Create with defaults

```abap
" BDEF:
static factory action createFromTemplate [1];
default factory action createFromTemplate [1];   " ← OData dùng làm default CREATE

" Method signature
METHODS createFromTemplate FOR MODIFY
  IMPORTING keys FOR ACTION Z_I_Travel~createFromTemplate
  MAPPED mapped.

" Implementation
METHOD createFromTemplate.
  " Static factory: keys thường empty hoặc có 1 entry với %param
  DATA lv_cid TYPE abap.char(30).

  DATA lt_creates TYPE TABLE FOR CREATE z_i_travel\\Travel.

  " Có thể có nhiều creates trong 1 call (batch)
  IF keys IS INITIAL.
    " Tạo 1 instance mới với hardcoded defaults
    APPEND VALUE #(
      %cid         = cl_system_uuid=>create_uuid_c22_static( )
      OverallStatus = 'O'
      BeginDate     = sy-datum
      EndDate       = sy-datum + 30
      %control = VALUE #(
        OverallStatus = if_abap_behv=>mk-on
        BeginDate     = if_abap_behv=>mk-on
        EndDate       = if_abap_behv=>mk-on )
    ) TO lt_creates.
  ELSE.
    " Parameter-driven create
    LOOP AT keys INTO DATA(ls_key).
      APPEND VALUE #(
        %cid          = cl_system_uuid=>create_uuid_c22_static( )
        AgencyId      = ls_key-%param-AgencyId   " from parameter
        OverallStatus = 'O'
        %control = VALUE #(
          AgencyId      = if_abap_behv=>mk-on
          OverallStatus = if_abap_behv=>mk-on )
      ) TO lt_creates.
    ENDLOOP.
  ENDIF.

  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel CREATE FROM lt_creates
    MAPPED   DATA(mapped_inner)
    FAILED   DATA(failed_inner)
    REPORTED DATA(reported_inner).

  mapped   = CORRESPONDING #( DEEP mapped_inner ).
  failed   = CORRESPONDING #( DEEP failed_inner ).
  reported = CORRESPONDING #( DEEP reported_inner ).
ENDMETHOD.
```

---

## 7. Action với Parameter (Abstract Entity)

```abap
" Step 1: Define parameter entity (abstract — no DB table)
@EndUserText.label: 'Reject Parameter'
define abstract entity Z_A_RejectParam {
  rejection_reason : abap.char(256);
  notify_customer  : abap_boolean;
}

" Step 2: BDEF
action rejectWithReason
  parameter Z_A_RejectParam   " ← input parameter
  result [1] $self;            " ← output: updated instance

" Step 3: Implementation
METHODS rejectWithReason FOR MODIFY
  IMPORTING keys FOR ACTION Z_I_Travel~rejectWithReason
  RESULT result.

METHOD rejectWithReason.
  LOOP AT keys INTO DATA(ls_key).
    " Access parameter via %param
    DATA(lv_reason)   = ls_key-%param-RejectionReason.
    DATA(lv_notify)   = ls_key-%param-NotifyCustomer.

    " Validate parameter
    IF lv_reason IS INITIAL.
      APPEND VALUE #( %tky = ls_key-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky = ls_key-%tky
        %msg = new_message_with_text(
          severity = if_abap_behv_message=>severity-error
          text     = 'Rejection reason is required' )
      ) TO reported-travel.
      CONTINUE.
    ENDIF.

    " Update status + reason
    MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
      ENTITY Travel UPDATE FIELDS ( OverallStatus RejectionReason )
      WITH VALUE #(
        ( %tky            = ls_key-%tky
          OverallStatus   = 'R'
          RejectionReason = lv_reason ) )
      REPORTED DATA(rep).
    reported = CORRESPONDING #( DEEP rep ).

    " Trigger email if requested (via flag, actual sending in additional save)
    IF lv_notify = abap_true.
      MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
        ENTITY Travel UPDATE FIELDS ( NotifyFlag )
        WITH VALUE #( ( %tky = ls_key-%tky NotifyFlag = abap_true ) )
        REPORTED DATA(rep2).
    ENDIF.
  ENDLOOP.

  " Build result
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel ALL FIELDS
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_result).

  result = VALUE #( FOR r IN lt_result
                    ( %tky = r-%tky %param = r ) ).
ENDMETHOD.
```

---

## 8. Internal Action — Chỉ dùng trong behavior pool

```abap
" BDEF:
internal action syncExternalStatus;   " ← chỉ gọi được từ behavior pool

" Dùng trong handler khác (e.g. determination gọi action)
METHOD setStatusOnActivate.
  " Gọi internal action để sync external system
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel
    EXECUTE syncExternalStatus
    FROM VALUE #( FOR key IN keys ( %tky = key-%tky ) )
    FAILED   DATA(failed_inner)
    REPORTED DATA(reported_inner).
  reported = CORRESPONDING #( DEEP reported_inner ).
ENDMETHOD.

METHOD syncExternalStatus.
  " Implementation của internal action
  LOOP AT keys INTO DATA(ls_key).
    " Custom sync logic — chỉ accessible từ behavior pool
    zcl_external_sync=>sync( lv_id = ls_key-%key-TravelId ).
  ENDLOOP.
ENDMETHOD.
```

> ℹ️ `internal action` không có `result` parameter vì không expose ra OData.
> Precheck KHÔNG thể dùng với `internal` actions.

---

## 9. Repeatable Action

Mặc định, action chỉ được gọi **một lần** trên cùng instance trong 1 request (non-repeatable).
`repeatable` cho phép gọi nhiều lần — dùng cho recalculation, refresh actions.

```abap
" BDEF:
repeatable action recalculateTotals result [1] $self;
" ← có thể gọi nhiều lần trên cùng TravelId trong 1 request

" Non-repeatable (default):
action acceptTravel result [1] $self;
" ← chỉ gọi 1 lần trên TravelId = '001' trong cùng request
```

---

## 10. Instance Feature Control — get_instance_features

Feature control động dựa trên **data của từng instance** — mỗi instance có thể khác nhau.

```abap
" BDEF: khai báo action/field cần instance-level feature control
define behavior for Z_I_Travel alias Travel ... {
  " Operations với instance feature control
  action ( features : instance ) acceptTravel result [1] $self;
  action ( features : instance ) rejectTravel result [1] $self;
  delete ( features : instance );
  update ( features : instance );

  " Fields với instance feature control
  field ( features : instance ) OverallStatus;

  " Khai báo authorization master kèm "instance" để enable get_instance_features
  authorization master ( global, instance )
}

" Method signature — generated bởi Quick Fix
METHODS get_instance_features FOR INSTANCE FEATURES
  USING KEYS REQUESTING requested_features
  RESULT result.

" Implementation
METHOD get_instance_features.
  " READ current state từ buffer
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel
    FIELDS ( TravelId OverallStatus )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels)
    FAILED DATA(failed_inner).

  " Build result: set feature per instance
  result = VALUE #(
    FOR ls_travel IN lt_travels
    LET
      " acceptTravel: disabled if already Accepted
      lv_accept  = COND #(
        WHEN ls_travel-OverallStatus = 'A'
        THEN if_abap_behv=>fc-o-disabled
        ELSE if_abap_behv=>fc-o-enabled )

      " rejectTravel: disabled if already Rejected or Accepted
      lv_reject  = COND #(
        WHEN ls_travel-OverallStatus = 'R' OR ls_travel-OverallStatus = 'A'
        THEN if_abap_behv=>fc-o-disabled
        ELSE if_abap_behv=>fc-o-enabled )

      " delete: only allow if status is Open
      lv_delete  = COND #(
        WHEN ls_travel-OverallStatus = 'O'
        THEN if_abap_behv=>fc-o-enabled
        ELSE if_abap_behv=>fc-o-disabled )

      " update: disabled if Accepted
      lv_update  = COND #(
        WHEN ls_travel-OverallStatus = 'A'
        THEN if_abap_behv=>fc-o-disabled
        ELSE if_abap_behv=>fc-o-enabled )
    IN
    ( %tky                    = ls_travel-%tky
      %features-%delete       = lv_delete
      %features-%update       = lv_update
      %action-acceptTravel    = lv_accept
      %action-rejectTravel    = lv_reject ) ).
ENDMETHOD.
```

### fc-o-* constants (operations)

| Constant | Value | Ý nghĩa |
|---|---|---|
| `if_abap_behv=>fc-o-enabled` | initial | ✅ Enabled (default — không cần set explicitly) |
| `if_abap_behv=>fc-o-disabled` | `'1'` | ❌ Disabled (button ẩn/grey trên UI) |

> Source: Lưu ý: `if_abap_behv=>fc-o-enabled` dùng cho operations (actions), không phải fields. Cho fields dùng `if_abap_behv=>fc-f-mandatory` (hoặc readonly, unrestricted).

---

## 11. Global Feature Control — get_global_features

Feature control dựa trên **system-wide conditions** — áp dụng cho tất cả instances giống nhau.
Không đọc instance data — chỉ dựa trên config, user role, system state.

```abap
" BDEF: khai báo action với global feature control
define behavior for Z_I_Travel alias Travel ... {
  action ( features : global ) bulkApprove result [1] $self;
  delete ( features : global );
}

" Method signature
METHODS get_global_features FOR GLOBAL FEATURES
  REQUESTING requested_features
  RESULT result.

" Implementation — không đọc instance data
METHOD get_global_features.
  " Check: delete enabled chỉ cho admin role
  IF requested_features-%delete = if_abap_behv=>mk-on.
    result-%delete = COND #(
      WHEN cl_abap_context_info=>get_user_alias( ) = 'ADMIN'
      THEN if_abap_behv=>fc-o-enabled
      ELSE if_abap_behv=>fc-o-disabled ).
  ENDIF.

  " Check: bulkApprove enabled theo system config
  IF requested_features-%action-bulkApprove = if_abap_behv=>mk-on.
    SELECT SINGLE enabled FROM zsystem_config
      WHERE feature = 'BULK_APPROVE'
      INTO @DATA(lv_enabled).
    result-%action-bulkApprove = COND #(
      WHEN lv_enabled = abap_true
      THEN if_abap_behv=>fc-o-enabled
      ELSE if_abap_behv=>fc-o-disabled ).
  ENDIF.
ENDMETHOD.
```

### Global vs Instance Feature Control — khi nào dùng gì

| Scenario | Global FC | Instance FC |
|---|---|---|
| Disable action theo user role | ✅ | ❌ |
| Disable action theo system config/customizing | ✅ | ❌ |
| Disable action theo status của record này | ❌ | ✅ |
| Hide "Delete" button cho non-owner | ❌ | ✅ (check CreatedBy) |
| Maintenance window — disable all writes | ✅ | ❌ |
| Enable action chỉ khi đơn hàng chưa được confirm | ❌ | ✅ |

---

## 12. Field Feature Control — %field trong instance FC

```abap
" BDEF:
define behavior for Z_I_Travel alias Travel ... {
  field ( features : instance ) AgencyId;    " ← field-level feature control
  field ( features : instance ) CustomerId;
  authorization master ( global, instance )
}

" Implementation trong get_instance_features
METHOD get_instance_features.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( OverallStatus )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).

  result = VALUE #(
    FOR ls_travel IN lt_travels
    LET
      " AgencyId: readonly sau khi travel đã confirmed
      lv_agency = COND #(
        WHEN ls_travel-OverallStatus = 'A' OR ls_travel-OverallStatus = 'R'
        THEN if_abap_behv=>fc-f-readonly
        ELSE if_abap_behv=>fc-f-unrestricted )

      " CustomerId: mandatory nếu BeginDate trong tương lai
      lv_cust = COND #(
        WHEN ls_travel-OverallStatus = 'O'
        THEN if_abap_behv=>fc-f-mandatory
        ELSE if_abap_behv=>fc-f-unrestricted )
    IN
    ( %tky              = ls_travel-%tky
      %field-AgencyId   = lv_agency
      %field-CustomerId = lv_cust ) ).
ENDMETHOD.
```

### fc-f-* constants (fields)

| Constant | Ý nghĩa |
|---|---|
| `if_abap_behv=>fc-f-unrestricted` | ✅ Editable (default) |
| `if_abap_behv=>fc-f-readonly` | 🔒 Read-only cho instance này |
| `if_abap_behv=>fc-f-mandatory` | ⚠️ Mandatory (phải điền) |

---

## 13. Precheck — Gatekeeper trước buffer

**Precheck** chạy **trước** khi operation reach transactional buffer.
Nhanh hơn validation (không cần buffer read), nhưng có limitation.

```
Precheck vs Validation:
  Precheck  = chạy TRƯỚC khi vào buffer → lightweight, early check
              Không thể dùng: READ ENTITIES (buffer chưa có data)
              Có thể dùng: SELECT từ DB
              ⚠️ Không hoạt động với draft-enabled BO (precheck chạy trên DB, draft data ở draft table)

  Validation = chạy SAU khi vào buffer (on save) → full access đến buffer
               Có thể: READ ENTITIES IN LOCAL MODE
               Hoạt động với draft
```

```abap
" BDEF:
create ( precheck );        " ← precheck cho create
action ( precheck ) deleteWithCheck;

" Method signature — FOR PRECHECK
METHODS precheck_create FOR PRECHECK
  IMPORTING entities FOR CREATE Z_I_Travel.

METHODS precheck_deleteWithCheck FOR PRECHECK
  IMPORTING keys FOR ACTION Z_I_Travel~deleteWithCheck.

" Implementation — precheck create: check customer exists
METHOD precheck_create.
  " Precheck: có thể SELECT, nhưng KHÔNG dùng READ ENTITIES
  DATA lt_custs TYPE SORTED TABLE OF zdmocustomer WITH UNIQUE KEY customer_id.

  " Collect all customer IDs
  lt_custs = CORRESPONDING #(
    entities
    DISCARDING DUPLICATES
    MAPPING customer_id = CustomerId EXCEPT * ).
  DELETE lt_custs WHERE customer_id IS INITIAL.

  " FAE check: all customers exist?
  DATA lt_valid TYPE SORTED TABLE OF zdmocustomer WITH UNIQUE KEY customer_id.
  IF lt_custs IS NOT INITIAL.
    SELECT FROM zdmocustomer FIELDS customer_id
      FOR ALL ENTRIES IN @lt_custs
      WHERE customer_id = @lt_custs-customer_id
      INTO TABLE @lt_valid.
  ENDIF.

  " Mark invalid as failed
  LOOP AT entities INTO DATA(ls_entity).
    APPEND VALUE #( %tky = ls_entity-%tky %state_area = 'PRECHECK_CUSTOMER' )
      TO reported-travel.

    IF NOT line_exists( lt_valid[ customer_id = ls_entity-CustomerId ] ).
      APPEND VALUE #( %tky = ls_entity-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky               = ls_entity-%tky
        %state_area        = 'PRECHECK_CUSTOMER'
        %element-CustomerId = if_abap_behv=>mk-on
        %msg = new_message_with_text(
          severity = if_abap_behv_message=>severity-error
          text     = 'Customer does not exist' )
      ) TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

> ⚠️ **Draft limitation**: Precheck không hoạt động với draft-enabled BO vì precheck validates against the database, nhưng trong draft scenario, active data ở database trong khi draft data ở separate draft tables.
> → Với draft-enabled BO: dùng validation on save (trong Prepare) thay vì precheck.

---

## 14. Determine Action — On-demand trigger

**Determine action** = trigger determinations/validations on-demand (không tự động như on modify/on save).
Dùng để tính toán lại khi user explicitly request.

```abap
" BDEF:
determine action triggerRecalc {
  determination ( always ) calculateTotal;
  determination ( always ) setAdminFields;
}

determine action triggerValidation {
  validation ( always ) validateDates;
  validation ( always ) validateMandatory;
}

" Projection BDEF:
use action triggerRecalc;

" Gọi từ EML (external consumer):
MODIFY ENTITIES OF z_i_travel
  ENTITY Travel
  EXECUTE triggerRecalc
  FROM VALUE #( FOR key IN keys ( %tky = key-%tky ) )
  FAILED   DATA(failed)
  REPORTED DATA(reported).
```

---

## 15. Projection BDEF — Expose actions

```abap
projection;
strict ( 2 );
use draft;

define behavior for Z_C_Travel alias Travel {
  use create;
  use update;
  use delete;

  " Expose instance actions từ interface
  use action acceptTravel;
  use action rejectTravel;
  use action rejectWithReason;

  " Expose factory actions
  use action copyTravel;
  use action createFromTemplate;

  " Expose determine actions
  use action triggerRecalc;

  " Projection-layer precheck (thêm vào base precheck)
  " create ( precheck );   ← uncomment nếu cần thêm projection precheck

  " Expose feature control (không cần declare — tự động từ interface)
}
```

> ✅ Feature control (`get_instance_features`, `get_global_features`) tự động inherited từ interface BDEF — không cần khai báo lại trong projection.

---

## 16. Action Result — $self vs deep result vs abstract entity

```abap
" Option 1: $self — trả về instance sau khi modify (phổ biến nhất)
action acceptTravel result [1] $self;
" → Fiori tự reload object page với updated data

" Option 2: Abstract entity — trả về custom structure
action calculateSummary result [1] Z_A_TravelSummary;
" → Dùng khi muốn trả về data khác với entity structure

" Option 3: deep result selective — trả về entity + children (S/4HANA 2022+)
action deepProcess deep result selective [1] Z_I_Travel;
" → Trả về Travel + Bookings trong 1 response

" Option 4: Không có result — action chỉ modify, không cần return
action discardExpired;
" → Không populate result

" Cardinality variants:
result [1] $self      " ← luôn 1 instance
result [0..1] $self   " ← 0 hoặc 1 instance (nullable)
result [0..*] $self   " ← multiple instances (batch result)
```

### Bắt buộc populate result khi khai báo

```abap
" ❌ WRONG — khai báo result nhưng không populate
METHOD acceptTravel.
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE ...
  " result không được fill → Fiori hiển thị blank / không reload
ENDMETHOD.

" ✅ CORRECT — luôn populate result nếu đã khai báo
METHOD acceptTravel.
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE ...

  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel ALL FIELDS
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_result).

  result = VALUE #( FOR r IN lt_result
                    ( %tky = r-%tky %param = r ) ).   " ← bắt buộc
ENDMETHOD.
```

---

## 17. Anti-Patterns

### ❌ AP-ACT-01: COMMIT WORK trong action handler

```abap
" ❌ WRONG — DUMP: BEHAVIOR_ILLEGAL_STATEMENT
METHOD acceptTravel.
  ...
  CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'.   " ← DUMP!
ENDMETHOD.

" ✅ CORRECT — action chỉ modify buffer; save sequence handles commit
METHOD acceptTravel.
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel UPDATE FIELDS ( OverallStatus ) ...
  " No commit here
ENDMETHOD.
```

---

### ❌ AP-ACT-02: Quên populate result khi khai báo

```abap
" ❌ WRONG — result khai báo nhưng không fill
" BDEF: action acceptTravel result [1] $self;
METHOD acceptTravel.
  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE ...
  " result = ? ← không fill → Fiori blank sau action
ENDMETHOD.

" ✅ CORRECT
METHOD acceptTravel.
  MODIFY ENTITIES ...
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel ALL FIELDS
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_result).
  result = VALUE #( FOR r IN lt_result ( %tky = r-%tky %param = r ) ).
ENDMETHOD.
```

---

### ❌ AP-ACT-03: Factory action dùng RESULT thay vì MAPPED

```abap
" ❌ WRONG — factory action không có RESULT parameter
METHOD copyTravel.
  ...
  result = VALUE #( ... ).   " ← compile error! factory không có result
ENDMETHOD.

" ✅ CORRECT — factory action dùng MAPPED
METHOD copyTravel.
  ...
  MODIFY ENTITIES ... MAPPED DATA(mapped_inner) ...
  mapped = CORRESPONDING #( DEEP mapped_inner ).   " ← đúng
ENDMETHOD.
```

---

### ❌ AP-ACT-04: Dùng precheck với draft-enabled BO

```abap
" ❌ WRONG — precheck không detect draft data
" BDEF: create ( precheck );   với draft-enabled BO
METHOD precheck_create.
  " Check customer trong DB — nhưng draft data ở draft table
  " → precheck cho kết quả không chính xác với draft
ENDMETHOD.

" ✅ CORRECT — dùng validation on save với (always) trong Prepare
validation validateCustomer on save { create; field CustomerId; }
draft determine action Prepare {
  validation ( always ) validateCustomer;
}
```

---

### ❌ AP-ACT-05: fc-o-disabled cho tất cả instances (nên dùng global FC)

```abap
" ❌ WRONG — instance FC nhưng logic không phụ thuộc vào instance data
METHOD get_instance_features.
  READ ENTITIES OF z_i_travel IN LOCAL MODE ...
  RESULT DATA(lt_travels).

  " Condition chỉ check user, không phụ thuộc vào data của instance
  result = VALUE #(
    FOR ls IN lt_travels
    ( %tky = ls-%tky
      %action-bulkApprove = COND #(
        WHEN cl_abap_context_info=>get_user_alias( ) <> 'ADMIN'
        THEN if_abap_behv=>fc-o-disabled ) ) ).
  " ← đọc N instances chỉ để check user → waste

" ✅ CORRECT — dùng global FC nếu condition không phụ thuộc instance
" BDEF: action ( features : global ) bulkApprove result [1] $self;
METHOD get_global_features.
  IF requested_features-%action-bulkApprove = if_abap_behv=>mk-on.
    result-%action-bulkApprove = COND #(
      WHEN cl_abap_context_info=>get_user_alias( ) = 'ADMIN'
      THEN if_abap_behv=>fc-o-enabled
      ELSE if_abap_behv=>fc-o-disabled ).
  ENDIF.
ENDMETHOD.
```

---

### ❌ AP-ACT-06: READ ENTITIES trong precheck

```abap
" ❌ WRONG — precheck chạy TRƯỚC buffer, READ ENTITIES không có data
METHOD precheck_create.
  READ ENTITIES OF z_i_travel IN LOCAL MODE   " ← buffer chưa có data!
    ENTITY Travel FIELDS ( CustomerId )
    WITH CORRESPONDING #( entities )
    RESULT DATA(lt_travels).
ENDMETHOD.

" ✅ CORRECT — precheck dùng SELECT từ DB hoặc dùng entities input
METHOD precheck_create.
  LOOP AT entities INTO DATA(ls_entity).
    " entities = data being created (from request, not buffer)
    DATA(lv_customer) = ls_entity-CustomerId.
    SELECT SINGLE customer_id FROM zdmocustomer
      WHERE customer_id = @lv_customer
      INTO @DATA(lv_found).
    IF sy-subrc <> 0.
      APPEND VALUE #( %tky = ls_entity-%tky ) TO failed-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

---

### ❌ AP-ACT-07: Dùng fc-f-* cho operations hoặc fc-o-* cho fields

```abap
" ❌ WRONG — mix up constants
result = VALUE #(
  FOR ls IN lt_travels
  ( %tky = ls-%tky
    %action-acceptTravel = if_abap_behv=>fc-f-readonly    " ← fc-f là cho fields!
    %field-AgencyId      = if_abap_behv=>fc-o-disabled ) " ← fc-o là cho operations!
).

" ✅ CORRECT
result = VALUE #(
  FOR ls IN lt_travels
  ( %tky = ls-%tky
    %action-acceptTravel = if_abap_behv=>fc-o-disabled    " ← fc-o cho action
    %field-AgencyId      = if_abap_behv=>fc-f-readonly )  " ← fc-f cho field
).
```

---

## 18. Checklist

```
BDEF:
[ ] Action type xác định đúng: instance/static/factory/internal/repeatable
[ ] Factory action không có "result" — chỉ có cardinality [1] hoặc [0..*]
[ ] Non-factory action có "result [1] $self" nếu Fiori cần reload
[ ] Feature control type đúng: (features: instance) vs (features: global)
[ ] "authorization master ( global, instance )" nếu dùng instance feature control
[ ] Precheck KHÔNG dùng với draft-enabled BO
[ ] Internal action không expose ra projection

IMPLEMENTATION:
[ ] result luôn được populate nếu đã khai báo
[ ] Factory action dùng mapped (không dùng result)
[ ] get_instance_features: check requested_features trước khi READ (performance)
[ ] get_global_features: không READ instance data — chỉ system/config check
[ ] Precheck: dùng entities/keys input hoặc SELECT DB, không READ ENTITIES
[ ] fc-o-* cho operations; fc-f-* cho fields — không mix
[ ] Không COMMIT WORK trong action handler

PROJECTION:
[ ] Tất cả actions cần expose đều có "use action <name>"
[ ] Factory actions cũng cần expose: "use action copyTravel"
[ ] Feature control inherited tự động — không cần khai báo lại

TESTING:
[ ] Test feature control: select instance với different statuses → verify button states
[ ] Test factory action: verify new instance được tạo và navigate đến
[ ] Test action với parameter: verify %param values nhận đúng
[ ] Test precheck (non-draft): verify invalid instances bị block trước buffer
```

---

## 19. Sources

| Source | URL | Nội dung |
|---|---|---|
| SAP Help — action BDEF syntax | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abenbdl_action.htm | Full syntax: non-factory, factory, static, internal, repeatable |
| SAP Help — factory action | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abenbdl_action_factory.htm | Factory action variants, AUTO FILL CID |
| SAP Help — precheck BDEF | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_precheck.htm | Precheck syntax, limitations |
| SAP Help — FOR PRECHECK handler | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abaphandler_meth_precheck.htm | Method signature, CHANGING failed/reported |
| SAP Help — Instance Feature Control | https://help.sap.com/docs/abap-cloud/abap-rap/instance-feature-control | fc-o-*, fc-f-*, get_instance_features |
| SAP Help — Global Feature Control | https://help.sap.com/docs/abap-cloud/abap-rap/global-feature-control | get_global_features, global vs instance |
| SAP Tutorial — Instance Action | https://developers.sap.com/tutorials/abap-environment-rap100-instance-action..html | Step-by-step instance action guide |
| SAP Tutorial — Factory Action | https://developers.sap.com/tutorials/abap-environment-rap100-factory-action..html | Copy action, static factory action |
| SAP Tutorial — Dynamic Feature Control | https://developers.sap.com/tutorials/abap-environment-rap100-dynamic-feature-control..html | get_instance_features full example |
| SAP Learning — Defining Actions | https://learning.sap.com/courses/building-transactional-apps-with-the-abap-restful-application-programming-model/defining-actions-and-messages | Actions + feature control concepts |
| SAP Learning — Implementing Feature Control | https://learning.sap.com/courses/building-transactional-apps-with-the-abap-restful-application-programming-model/implementing-dynamic-feature-control | fc-o-disabled/enabled, result parameter |
| Sachin Artani — Validation & Precheck | https://sachinartani.com/blog/sap-rap-validation-and-precheck | Precheck vs validation, draft limitation |
| SAP Community — Global Feature Control | https://community.sap.com/t5/application-development-and-automation-blog-posts/global-feature-contron-in-rap-feature-control-in-rap/ba-p/14056926 | get_global_features implementation |
| SAP Community — Dynamic Feature Control | https://community.sap.com/t5/application-development-and-automation-blog-posts/feature-control-in-rap-dynamic-feature-control-part-2/ba-p/13997487 | Instance feature control patterns |
| discoveringabap.com — Actions & Feature Control | https://discoveringabap.com/2023/02/27/abap-restful-application-programming-23-actions-and-feature-control/ | Factory/static/internal actions explained |
| ABAP Cheat Sheets — BDL | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/36_RAP_Behavior_Definition_Language.md | All action syntax variants reference |