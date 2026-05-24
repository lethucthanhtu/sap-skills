# RAP — Business Events

Hướng dẫn đầy đủ về RAP Business Events: define, raise, consume (local + remote),
event binding, event parameter, và các patterns thực tế.

> **Đọc file này khi:** câu hỏi về RAP business events, `RAISE ENTITY EVENT`,
> `event` keyword trong BDEF, event binding, local event handler,
> event consumption model, event mesh, event-driven architecture trong RAP.

---

## Table of Contents

1. [Business Events — Tổng quan](#1-business-events--tổng-quan)
2. [Architecture — Provider vs Consumer](#2-architecture--provider-vs-consumer)
3. [Environment Availability](#3-environment-availability)
4. [Step 1: Define Event Parameter (Abstract Entity)](#4-step-1-define-event-parameter-abstract-entity)
5. [Step 2: Define Event trong BDEF](#5-step-2-define-event-trong-bdef)
6. [Step 3: Enable Additional Save](#6-step-3-enable-additional-save)
7. [Step 4: Raise Event trong save_modified](#7-step-4-raise-event-trong-save_modified)
8. [Step 5: Create Event Binding (cho remote consumption)](#8-step-5-create-event-binding-cho-remote-consumption)
9. [Local Event Consumption — Handler Class](#9-local-event-consumption--handler-class)
10. [Remote Event Consumption — Event Consumption Model](#10-remote-event-consumption--event-consumption-model)
11. [Pattern: Raise từ Action (wrapper method)](#11-pattern-raise-từ-action-wrapper-method)
12. [Pattern: Consume Standard SAP Events + Raise Custom](#12-pattern-consume-standard-sap-events--raise-custom)
13. [Event Payload — Notification vs Data Event](#13-event-payload--notification-vs-data-event)
14. [Monitor và Debug Events](#14-monitor-và-debug-events)
15. [Anti-Patterns](#15-anti-patterns)
16. [Checklist](#16-checklist)
17. [Sources](#17-sources)

---

## 1. Business Events — Tổng quan

**RAP Business Events** = cơ chế event-driven, asynchronous, decoupled.
Khi BO thay đổi trạng thái → raise event → consumers xử lý độc lập.

```
Đặc điểm chính:
  ✅ Asynchronous — consumer không block provider
  ✅ Decoupled — provider không biết consumer
  ✅ Stable API — event definition versioned, upgrade-safe
  ✅ Native RAP — defined trong BDEF, raised via EML
  ✅ Dual consumption — local (same system) + remote (Event Mesh, BTP)
  ✅ Available từ S/4HANA 2022 On-Prem và BTP ABAP Environment

Khi nào dùng:
  → Trigger follow-up process sau khi BO state thay đổi
    (e.g. Travel accepted → send email, update downstream system)
  → Integration giữa systems (S/4 → BTP → CAP → third party)
  → Thay thế RFC/BAPI calls bằng event-driven pattern
  → Decouple business logic khỏi core transaction
```

---

## 2. Architecture — Provider vs Consumer

```
┌─────────────────────────────────────────────────────────────────────┐
│  EVENT PROVIDER (RAP BO)                                             │
│                                                                      │
│  BDEF:  event travel_accepted parameter Z_A_Travel;                 │
│  Code:  RAISE ENTITY EVENT Z_Travel~travel_accepted FROM ...        │
│  When:  Trong save sequence (after point of no return)              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Event raised
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SAP EVENT INFRASTRUCTURE                                            │
│  (Event stored, routed asynchronously)                               │
└──────────────┬───────────────────────────────┬──────────────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────┐   ┌───────────────────────────────────┐
│  LOCAL CONSUMER          │   │  REMOTE CONSUMER                  │
│  (same S/4HANA system)   │   │  (BTP, Event Mesh, CAP, etc.)     │
│                          │   │                                   │
│  Event handler class:    │   │  Event Binding → publish topic    │
│  FOR EVENTS OF <bdef>    │   │  Event Consumption Model (ECM)    │
│  FOR ENTITY EVENT        │   │  → Class implementing handler     │
│  Processed async         │   │  Processed async via queue        │
└──────────────────────────┘   └───────────────────────────────────┘
```

---

## 3. Environment Availability

| Feature | ECC | S/4HANA On-Prem < 2022 | S/4HANA On-Prem 2022+ | S/4HANA Cloud Private | S/4HANA Cloud Public / BTP |
|---|---|---|---|---|---|
| Define event in BDEF | ❌ | ❌ | ✅ | ✅ | ✅ |
| Raise entity event | ❌ | ❌ | ✅ | ✅ | ✅ |
| Local consumption | ❌ | ❌ | ✅ | ✅ | ✅ |
| Remote (Event Mesh) | ❌ | ❌ | ✅ (SAP Event Mesh) | ✅ | ✅ |
| Event in child node | ❌ | ❌ | ✅ (2023+) | ✅ | ✅ |
| Event in extension | ❌ | ❌ | ✅ | ✅ | ✅ |

> ⚠️ **Pre-2023 On-Prem**: Events chỉ có thể khai báo ở **root node** của BDEF.
> Từ S/4HANA 2023+: events có thể khai báo ở **bất kỳ entity** trong composition tree.
> Source: https://community.sap.com/t5/technology-blog-posts-by-sap/step-by-step-implementation-of-customer-defined-events-in-business-event/ba-p/14056091

---

## 4. Step 1: Define Event Parameter (Abstract Entity)

Event parameter = payload được gửi kèm event (ngoài key của entity).
Được model bằng **CDS Abstract Entity** — không tạo DB table.

```cds
// File: Z_A_TravelEvent (Data Definition → Abstract Entity)
@EndUserText.label: 'Event Parameter for Travel Accepted'
define abstract entity Z_A_TravelAccepted {
  " Entity key sẽ tự động được thêm vào payload → không cần khai báo lại
  " Chỉ khai báo EXTRA fields muốn gửi kèm
  agency_id      : /dmo/agency_id;
  customer_id    : /dmo/customer_id;
  overall_status : /dmo/overall_status;
  description    : /dmo/description;
  @Semantics.amount.currencyCode: 'currency_code'
  total_price    : /dmo/total_price;
  currency_code  : /dmo/currency_code;
  begin_date     : /dmo/begin_date;
  end_date       : /dmo/end_date;
  email_address  : /dmo/email_address;   " ← extra field không có trong entity
}
```

> ℹ️ **Notification event** = event KHÔNG có parameter → chỉ gửi entity key
> **Data event** = event CÓ parameter → gửi key + extra fields
> Nếu consumer cần data ngoài key → dùng data event với abstract entity

---

## 5. Step 2: Define Event trong BDEF

```abap
" Interface BDEF — thêm event vào behavior body của entity
managed with additional save
  implementation in class zbp_i_z_travel unique;
strict ( 2 );

define behavior for Z_I_Travel alias Travel
  persistent table ztravel
  draft table ztravel_d
  lock master total etag LastChangedAt
  etag master LocalLastChangedAt
  authorization master ( global )
{
  field ( readonly ) TravelId;
  field ( mandatory ) AgencyId, CustomerId;

  create; update; delete;

  " Actions
  action acceptTravel result [1] $self;
  action rejectTravel result [1] $self;

  " Side effects
  side effects {
    field OverallStatus affects field LocalLastChangedAt;
  }

  " Business Events — khai báo sau side effects
  event travel_accepted parameter Z_A_TravelAccepted;   " ← data event (có parameter)
  event travel_rejected;                                  " ← notification event (không có parameter)

  " Mapping
  mapping for ztravel { ... }
}
```

### Syntax variants

```abap
" Notification event (chỉ gửi key)
event OrderCreated;

" Data event (gửi key + extra fields từ abstract entity)
event OrderStatusChanged parameter Z_A_OrderStatusParam;

" Event trong child entity (S/4HANA 2023+)
define behavior for Z_I_OrderItem alias OrderItem ... {
  ...
  " Event ở child → raised với key của child
  event ItemCancelled parameter Z_A_OrderItemParam;
}
```

---

## 6. Step 3: Enable Additional Save

**Business events phải được raised trong save sequence** — cần `with additional save`
trong managed BO (vì managed BO không có custom `save_modified` mặc định).

```abap
" ✅ CORRECT — thêm "with additional save" vào BDEF header
managed with additional save        " ← bắt buộc để có save_modified custom
  implementation in class zbp_i_z_travel unique;
strict ( 2 );

" Hoặc với full data (để access tất cả fields trong save_modified):
managed with additional save
  implementation in class zbp_i_z_travel unique;
" + trong entity:
define behavior for Z_I_Travel ... {
  ...
  with additional save              " ← entity-level full data access
}
```

> ℹ️ `with additional save` vs `with unmanaged save`:
> - `with additional save` → framework vẫn persist, bạn thêm logic SAU khi persist
> - `with unmanaged save` → bạn tự implement toàn bộ save (dùng cho BAPI wrapper)
>
> Cho business events trong managed BO → luôn dùng `with additional save`

---

## 7. Step 4: Raise Event trong save_modified

```abap
" Local saver class — additional save implementation
CLASS lsc_z_i_travel DEFINITION
  INHERITING FROM cl_abap_behavior_saver.    " ← base class (không cần _failed)
  PROTECTED SECTION.
    METHODS save_modified REDEFINITION.
    METHODS cleanup_finalize REDEFINITION.
ENDCLASS.

CLASS lsc_z_i_travel IMPLEMENTATION.

  METHOD save_modified.
    " ✅ Raise event khi Travel được accepted
    " Chỉ raise khi OverallStatus thay đổi thành 'A' (Accepted)

    " Pattern 1: Raise với parameter (data event)
    IF update-travel IS NOT INITIAL.
      DATA lt_accepted TYPE TABLE FOR EVENT Z_I_Travel~travel_accepted.
      DATA lt_rejected TYPE TABLE FOR EVENT Z_I_Travel~travel_rejected.

      LOOP AT update-travel INTO DATA(ls_update).
        " Chỉ raise khi OverallStatus thực sự thay đổi
        CHECK ls_update-%control-OverallStatus = if_abap_behv=>mk-on.

        CASE ls_update-OverallStatus.
          WHEN 'A'.   " Accepted
            " Build event payload — key tự động có, thêm extra fields
            APPEND VALUE #(
              %key         = ls_update-%key    " key của entity
              " Extra parameter fields:
              %param-AgencyId      = ls_update-AgencyId
              %param-CustomerId    = ls_update-CustomerId
              %param-OverallStatus = ls_update-OverallStatus
              %param-TotalPrice    = ls_update-TotalPrice
              %param-CurrencyCode  = ls_update-CurrencyCode
              %param-EmailAddress  = ls_update-EmailAddress
            ) TO lt_accepted.

          WHEN 'R'.   " Rejected
            " Notification event — chỉ cần key
            APPEND VALUE #(
              %key = ls_update-%key
            ) TO lt_rejected.
        ENDCASE.
      ENDLOOP.

      " Raise accepted events
      IF lt_accepted IS NOT INITIAL.
        RAISE ENTITY EVENT Z_I_Travel~travel_accepted
          FROM lt_accepted.
      ENDIF.

      " Raise rejected events (notification — không có %param)
      IF lt_rejected IS NOT INITIAL.
        RAISE ENTITY EVENT Z_I_Travel~travel_rejected
          FROM lt_rejected.
      ENDIF.
    ENDIF.

    " Pattern 2: Raise khi entity được CREATE
    IF create-travel IS NOT INITIAL.
      DATA lt_created TYPE TABLE FOR EVENT Z_I_Travel~travel_created.
      lt_created = VALUE #(
        FOR ls_create IN create-travel
        ( %key                   = ls_create-%key
          %param-AgencyId        = ls_create-AgencyId
          %param-CustomerId      = ls_create-CustomerId ) ).

      IF lt_created IS NOT INITIAL.
        RAISE ENTITY EVENT Z_I_Travel~travel_created
          FROM lt_created.
      ENDIF.
    ENDIF.
  ENDMETHOD.

  METHOD cleanup_finalize.
    " Cleanup nếu cần — optional
  ENDMETHOD.

ENDCLASS.
```

### Raise với `with full data` (access all fields không cần read)

```abap
" BDEF header:
managed with additional save
  implementation in class zbp_i_z_travel unique;

" Entity:
define behavior for Z_I_Travel ... {
  with additional save   " ← full data available in save_modified
  ...
  event travel_accepted parameter Z_A_TravelAccepted;
}

" save_modified với full data:
METHOD save_modified.
  IF update-travel IS NOT INITIAL.
    DATA lt_accepted TYPE TABLE FOR EVENT Z_I_Travel~travel_accepted.

    LOOP AT update-travel INTO DATA(ls_update).
      " With full data: tất cả fields có trong ls_update
      " Không cần READ ENTITIES thêm
      CHECK ls_update-%control-OverallStatus = if_abap_behv=>mk-on
        AND ls_update-OverallStatus = 'A'.

      APPEND VALUE #(
        %key              = ls_update-%key
        %param-AgencyId   = ls_update-AgencyId     " ← trực tiếp từ update data
        %param-TotalPrice = ls_update-TotalPrice
      ) TO lt_accepted.
    ENDLOOP.

    IF lt_accepted IS NOT INITIAL.
      RAISE ENTITY EVENT Z_I_Travel~travel_accepted FROM lt_accepted.
    ENDIF.
  ENDIF.
ENDMETHOD.
```

> ⚠️ **RAISE ENTITY EVENT chỉ có thể dùng trong behavior pool** (global class hoặc local class).
> KHÔNG thể raise từ external class, report, job.
> Nếu cần raise từ bên ngoài → dùng wrapper method (Section 11).

---

## 8. Step 5: Create Event Binding (cho remote consumption)

Event Binding = mapping RAP event → SAP Object Type → Event Mesh topic.
**Chỉ cần cho remote consumption** (BTP, Event Mesh). Local consumption không cần Event Binding.

```
ADT: Right-click package → New → Other ABAP Repository Object
     → Business Services → Event Binding

Event Binding fields:
  Name:        ZEVENT_TRAVEL_ACCEPTED
  Description: Event Binding for Travel Accepted

Editor — Add events:
  Entity name:       Z_I_Travel           ← BDEF root entity name (không phải alias)
  Entity event name: travel_accepted      ← event name từ BDEF
  Version:           1                   ← semantic versioning

Auto-generated Topic (Type field):
  Format: <namespace>.<SAPObjectType>.<operation>.v<version>
  e.g.:   Z.Travel.Accepted.v1

→ Activate Event Binding
→ SAP Object Type (SOT) phải được tạo/link nếu chưa có
```

### SAP Object Type (SOT) Setup

```
ADT: New → SAP Object Node Type (nếu chưa có)
  Name:        ZTravel
  Description: Travel BO

New → SAP Object Type:
  Name:           ZTravel
  Root Node Type: ZTravel (link tới SOT trên)
  → Map tới CDS root view: Z_I_Travel

Trong Event Binding → link SAP Object Type = ZTravel
```

> Source: https://help.sap.com/docs/abap-cloud/abap-rap/event-binding

---

## 9. Local Event Consumption — Handler Class

Local consumption = event được xử lý trong **cùng S/4HANA system**, asynchronously.
Không cần Event Binding. Dùng để trigger local follow-up logic.

```abap
" Event handler class — FOR EVENTS OF <bdef>
CLASS zcl_travel_event_handler DEFINITION
  PUBLIC FINAL
  CREATE PUBLIC
  FOR EVENTS OF Z_I_Travel.    " ← liên kết với BDEF

  PUBLIC SECTION.
    " Method signature: FOR ENTITY EVENT ... FOR <entity>~<event>
    METHODS handle_travel_accepted
      FOR ENTITY EVENT
      IMPORTING events FOR Z_I_Travel~travel_accepted.   " ← entity~event

    METHODS handle_travel_rejected
      FOR ENTITY EVENT
      IMPORTING events FOR Z_I_Travel~travel_rejected.

ENDCLASS.

CLASS zcl_travel_event_handler IMPLEMENTATION.

  METHOD handle_travel_accepted.
    " 'events' = TABLE FOR EVENT Z_I_Travel~travel_accepted
    " Chứa tất cả instances của event này được raised trong transaction

    CHECK events IS NOT INITIAL.

    " Xử lý từng event instance
    LOOP AT events INTO DATA(ls_event).
      DATA(lv_travel_id)   = ls_event-%key-TravelId.
      DATA(lv_customer_id) = ls_event-%param-CustomerId.
      DATA(lv_email)       = ls_event-%param-EmailAddress.

      " Trigger follow-up logic — ví dụ: write to log table
      INSERT INTO zevent_log VALUES @(
        VALUE #(
          event_id   = cl_system_uuid=>create_uuid_c22_static( )
          event_type = 'TRAVEL_ACCEPTED'
          entity_key = lv_travel_id
          event_time = utclong_current( )
          payload    = |Customer: { lv_customer_id }, Email: { lv_email }|
        ) ).

      " Hoặc: trigger bgPF để send email async
      " zcl_bgpf_send_email=>run_via_bgpf( iv_email = lv_email ).

      COMMIT WORK.    " ← consumer có LUW riêng — được phép COMMIT
    ENDLOOP.
  ENDMETHOD.

  METHOD handle_travel_rejected.
    CHECK events IS NOT INITIAL.

    LOOP AT events INTO DATA(ls_event).
      " Notification event — chỉ có key, không có %param
      DATA(lv_travel_id) = ls_event-%key-TravelId.

      " Log rejection
      INSERT INTO zevent_log VALUES @(
        VALUE #(
          event_id   = cl_system_uuid=>create_uuid_c22_static( )
          event_type = 'TRAVEL_REJECTED'
          entity_key = lv_travel_id
          event_time = utclong_current( )
        ) ).
      COMMIT WORK.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.
```

> ✅ **COMMIT WORK** được phép trong local event handler — consumer có LUW riêng.
> ✅ Có thể dùng `SELECT`, `INSERT`, `UPDATE` trực tiếp.
> ✅ Có thể raise other events từ handler.
> ⚠️ Handler được gọi **asynchronously** — không block provider transaction.

---

## 10. Remote Event Consumption — Event Consumption Model

Remote consumption qua Event Mesh / BTP — cần **Event Consumption Model (ECM)**.

```
ADT: New → Event Consumption Model
  Name:        ZCM_TRAVEL_EVENTS
  Description: Consumption model for Travel events

Editor:
  Topic:   Z.Travel.Accepted.v1   ← từ Event Binding (copy exact topic)
  Handler: ZCL_TRAVEL_REMOTE_HANDLER → method to call when event arrives
```

```abap
" Remote event handler class
CLASS zcl_travel_remote_handler DEFINITION
  PUBLIC FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    " Interface từ Event Consumption Model
    INTERFACES if_amdp_marker_hdb.   " ← nếu AMDP processing needed

    CLASS-METHODS handle_travel_accepted
      IMPORTING
        !event_data TYPE string   " ← JSON payload từ Event Mesh
      RAISING
        cx_static_check.
ENDCLASS.

CLASS zcl_travel_remote_handler IMPLEMENTATION.
  METHOD handle_travel_accepted.
    " Parse JSON payload
    DATA(lo_json) = cl_abap_codepage=>convert_to( event_data ).
    " ... process event ...
  ENDMETHOD.
ENDCLASS.
```

> ℹ️ Remote consumption chi tiết phụ thuộc vào setup Event Mesh channel.
> Refer: https://help.sap.com/docs/abap-cloud/abap-rap/business-event-consumption

---

## 11. Pattern: Raise từ Action (wrapper method)

`RAISE ENTITY EVENT` chỉ hoạt động trong behavior pool context.
Nếu cần raise từ action handler (interaction phase) → **không thể raise trực tiếp**
vì events phải được raised trong save sequence.

**Pattern đúng: action set flag → save_modified raise event**

```abap
" ❌ WRONG — raise trong action handler (interaction phase)
METHOD acceptTravel.
  ...
  RAISE ENTITY EVENT Z_I_Travel~travel_accepted   " ← ERROR: không trong save sequence
    FROM VALUE #( ... ).
ENDMETHOD.

" ✅ CORRECT — Pattern: action cập nhật status → save_modified raise event
METHOD acceptTravel.
  " Chỉ update OverallStatus → save_modified sẽ detect và raise event
  MODIFY ENTITIES OF Z_I_Travel IN LOCAL MODE
    ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH VALUE #( FOR key IN keys
                  ( %tky = key-%tky OverallStatus = 'A' ) )
    REPORTED DATA(reported).
  reported = CORRESPONDING #( DEEP reported ).

  READ ENTITIES OF Z_I_Travel IN LOCAL MODE
    ENTITY Travel ALL FIELDS WITH CORRESPONDING #( keys )
    RESULT DATA(lt_result).
  result = VALUE #( FOR r IN lt_result ( %tky = r-%tky %param = r ) ).
ENDMETHOD.

" save_modified detect OverallStatus = 'A' → raise event
METHOD save_modified.
  LOOP AT update-travel INTO DATA(ls_update).
    CHECK ls_update-%control-OverallStatus = if_abap_behv=>mk-on
      AND ls_update-OverallStatus = 'A'.
    " ... raise event ...
  ENDLOOP.
ENDMETHOD.
```

### Wrapper method pattern (raise từ global class pool)

Nếu muốn raise event từ ngoài behavior pool (e.g. từ bgPF worker):

```abap
" Global class ZBP_I_Z_TRAVEL — thêm static method
CLASS zbp_i_z_travel DEFINITION
  PUBLIC ABSTRACT FINAL
  FOR BEHAVIOR OF z_i_travel.

  " ✅ Static method wrapper — có thể gọi từ bất kỳ đâu
  CLASS-METHODS raise_travel_accepted
    IMPORTING it_events TYPE TABLE FOR EVENT z_i_travel~travel_accepted.
ENDCLASS.

CLASS zbp_i_z_travel IMPLEMENTATION.
  METHOD raise_travel_accepted.
    RAISE ENTITY EVENT z_i_travel~travel_accepted
      FROM it_events.
  ENDMETHOD.
ENDCLASS.

" Caller (từ bên ngoài behavior pool):
zbp_i_z_travel=>raise_travel_accepted(
  it_events = VALUE #(
    ( %key-TravelId        = lv_travel_id
      %param-CustomerId    = lv_customer_id
      %param-EmailAddress  = lv_email ) ) ).
```

> ⚠️ **Quan trọng**: Wrapper method vẫn phải được gọi trong **save sequence context**
> (không thể call từ interaction phase bình thường).
> Nếu gọi từ bgPF → OK vì bgPF có LUW riêng.
> Source: https://community.sap.com/t5/technology-blog-posts-by-sap/rap-business-events-with-advanced-event-mesh-2-creating-custom-business/ba-p/13914171

---

## 12. Pattern: Consume Standard SAP Events + Raise Custom

Khi cần extend payload của standard SAP event (e.g. Purchase Order event chỉ có PO number,
bạn muốn thêm PO type vào payload):

```
Approach:
  1. Consume standard SAP event locally (Event Consumption Model)
  2. In handler: call BAPI/FM hoặc EML để get thêm data
  3. Raise custom RAP event với enriched payload

Use case từ SAP Community: r_purchaseordertp event chỉ có PO number
→ workaround: local consume → raise custom event với PO number + PO type
```

```abap
" Local handler cho standard SAP PO event
CLASS zcl_po_event_handler DEFINITION
  PUBLIC FINAL CREATE PUBLIC
  FOR EVENTS OF i_purchaseordertp.   " ← standard BO

  PUBLIC SECTION.
    METHODS handle_po_changed
      FOR ENTITY EVENT
      IMPORTING events FOR i_purchaseordertp~PurchaseOrderChanged.
ENDCLASS.

CLASS zcl_po_event_handler IMPLEMENTATION.
  METHOD handle_po_changed.
    CHECK events IS NOT INITIAL.

    LOOP AT events INTO DATA(ls_event).
      DATA(lv_po) = ls_event-%key-PurchaseOrder.

      " Read additional data not in standard payload
      SELECT SINGLE purchaseordertype
        FROM i_purchaseorder
        WHERE purchaseorder = @lv_po
        INTO @DATA(lv_po_type).

      " Raise custom event với enriched payload
      zbp_i_z_po_enriched=>raise_po_changed(
        it_events = VALUE #(
          ( %key-PoNumber     = lv_po
            %param-PoType     = lv_po_type
            %param-ChangedAt  = utclong_current( ) ) ) ).

      COMMIT WORK.
    ENDLOOP.
  ENDMETHOD.
ENDCLASS.
```

> Source: https://community.sap.com/t5/technology-blog-posts-by-sap/rap-event-consume-sap-standard-event-and-trigger-custom-rap-event/ba-p/14241235

---

## 13. Event Payload — Notification vs Data Event

```
NOTIFICATION EVENT (không có parameter):
  → Payload: chỉ entity key
  → Consumer biết WHAT happened (event type) và WHO (key)
  → Consumer phải tự call API để lấy data nếu cần
  → Nhẹ hơn, phù hợp khi consumer không cần extra data

  BDEF:  event OrderCreated;
  Raise: RAISE ENTITY EVENT Z_I_Order~OrderCreated
           FROM VALUE #( ( %key-OrderId = lv_order_id ) ).

DATA EVENT (có parameter — abstract entity):
  → Payload: entity key + extra fields từ abstract entity
  → Consumer nhận đầy đủ data, không cần gọi lại API
  → Nặng hơn, phù hợp khi consumer cần nhiều fields ngay lập tức

  BDEF:  event OrderStatusChanged parameter Z_A_OrderPayload;
  Raise: RAISE ENTITY EVENT Z_I_Order~OrderStatusChanged
           FROM VALUE #( ( %key-OrderId      = lv_id
                            %param-Status     = lv_status
                            %param-CustomerEmail = lv_email ) ).
```

**Khi nào chọn loại nào:**

| Criteria | Notification | Data |
|---|---|---|
| Consumer cần gọi API để lấy data | ✅ Phù hợp | Không cần |
| Nhiều consumers với data needs khác nhau | ✅ Flexible | Payload cố định |
| Payload nhỏ, bandwidth quan trọng | ✅ | — |
| Consumer cần data tại thời điểm raise | — | ✅ |
| Data có thể thay đổi sau khi event raised | — | ✅ (snapshot) |
| Tracing/audit cần snapshot | — | ✅ |

---

## 14. Monitor và Debug Events

### On-Premise: `/IWXBE/EVENT_MONITOR`

```
Transaction: /IWXBE/EVENT_MONITOR
  → Hiển thị tất cả events đã được raised
  → Status: Pending / Sent / Error
  → Payload content
  → Timestamp, consumer info

Dùng để:
  - Verify event được raised đúng
  - Check payload content
  - Debug delivery failures
```

### BTP ABAP Environment: Event Monitor trong ADT

```
ADT → Window → Show View → Others → Event Monitor
  → Filter by: event type, time range, status
  → Click event để xem payload
```

### Debug với local event handler

```abap
" Thêm logging trong event handler để debug
METHOD handle_travel_accepted.
  CHECK events IS NOT INITIAL.

  " Log to SLG1 (Application Log)
  DATA(lo_log) = cl_bali_log=>create_with_header(
    i_object   = 'ZEV'
    i_subobject = 'TRAVEL' ).

  LOOP AT events INTO DATA(ls_event).
    lo_log->add_item( cl_bali_free_text_item=>create(
      i_severity  = if_bali_constants=>c_severity_status
      i_text      = |Travel { ls_event-%key-TravelId } accepted| ) ).

    " ... process event ...
  ENDLOOP.

  cl_bali_log_db=>save_log( lo_log ).
  COMMIT WORK.
ENDMETHOD.
```

### SLG1 — Application Log

```
Transaction: SLG1
  Object: ZEV (custom log object)
  SubObject: TRAVEL
  → Hiển thị event processing log
  → Error tracking
```

---

## 15. Anti-Patterns

### ❌ AP-EVT-01: RAISE ENTITY EVENT trong interaction phase

```abap
" ❌ WRONG — event phải raised trong save sequence
METHOD acceptTravel.
  ...
  RAISE ENTITY EVENT Z_I_Travel~travel_accepted   " ← ERROR hoặc silently ignored
    FROM VALUE #( ... ).
ENDMETHOD.

" ✅ CORRECT — raise trong save_modified (additional save)
METHOD save_modified.   " ← save sequence
  IF update-travel IS NOT INITIAL.
    ...
    RAISE ENTITY EVENT Z_I_Travel~travel_accepted FROM lt_events.
  ENDIF.
ENDMETHOD.
```

---

### ❌ AP-EVT-02: RAISE ENTITY EVENT nhưng thiếu `with additional save`

```abap
" ❌ WRONG — managed BO không có custom save_modified mặc định
managed implementation in class zbp_i_z_travel unique;   " ← thiếu "with additional save"
strict ( 2 );

" Sẽ không có save_modified để raise event

" ✅ CORRECT
managed with additional save   " ← bắt buộc
  implementation in class zbp_i_z_travel unique;
strict ( 2 );
```

---

### ❌ AP-EVT-03: Raise event cho mọi save (không check field change)

```abap
" ❌ WRONG — raise event dù OverallStatus không thay đổi
METHOD save_modified.
  LOOP AT update-travel INTO DATA(ls_update).
    " Raise event bất kể field nào thay đổi → event spam
    RAISE ENTITY EVENT Z_I_Travel~travel_accepted
      FROM VALUE #( ( %key = ls_update-%key ) ).
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT — chỉ raise khi field liên quan thay đổi
METHOD save_modified.
  LOOP AT update-travel INTO DATA(ls_update).
    " Check: OverallStatus có thay đổi không?
    CHECK ls_update-%control-OverallStatus = if_abap_behv=>mk-on
      AND ls_update-OverallStatus = 'A'.   " và đúng giá trị cần
    " ... raise event ...
  ENDLOOP.
ENDMETHOD.
```

---

### ❌ AP-EVT-04: COMMIT WORK trong event provider (save_modified)

```abap
" ❌ WRONG — COMMIT WORK trong save_modified của provider
METHOD save_modified.
  ...
  RAISE ENTITY EVENT Z_I_Travel~travel_accepted FROM lt_events.
  COMMIT WORK.   " ← DUMP trong save_modified
ENDMETHOD.

" ✅ CORRECT — framework tự commit sau save sequence
" COMMIT WORK chỉ được phép trong local event CONSUMER (handler), không trong provider
```

---

### ❌ AP-EVT-05: Khai báo event ở child entity trong pre-2023 system

```abap
" ❌ WRONG — S/4HANA On-Prem 2022 không support event ở child node
define behavior for Z_I_BookingItem alias BookingItem ... {
  event ItemCancelled;   " ← không compile ở 2022 On-Prem
}

" ✅ CORRECT — pre-2023: khai báo tất cả events ở ROOT node
define behavior for Z_I_Travel alias Travel ... {
  " Events cho child entities phải khai báo ở root trước 2023
  event ItemCancelled parameter Z_A_ItemCancel;   " ← workaround
}
```

---

### ❌ AP-EVT-06: Local handler có side effects trong provider LUW

```abap
" ❌ WRONG — nhầm tưởng local handler chạy sync trong provider transaction
" Local handler KHÔNG chạy trong provider LUW — chạy async sau đó
" KHÔNG dựa vào handler để complete provider transaction

METHOD handle_travel_accepted.
  " ❌ Assumption: handler fails → provider transaction rollback
  " THỰC TẾ: handler fail chỉ ảnh hưởng handler LUW, provider đã committed
  RAISE EXCEPTION TYPE cx_some_error.   " ← chỉ rollback handler LUW
ENDMETHOD.

" ✅ CORRECT — handle errors trong handler độc lập
METHOD handle_travel_accepted.
  TRY.
    " ... process ...
    COMMIT WORK.
  CATCH cx_root INTO DATA(lx_err).
    " Log error — provider đã committed, không rollback được
    " Implement retry / dead letter queue nếu cần
  ENDTRY.
ENDMETHOD.
```

---

## 16. Checklist

```
DEFINE PHASE:
[ ] Abstract entity (event parameter) có đúng fields không?
[ ] BDEF: event keyword trong behavior body đúng entity không?
[ ] BDEF header: "with additional save" được thêm chưa?
[ ] Event Binding tạo xong và activated chưa? (chỉ cần cho remote)
[ ] SAP Object Type linked tới Event Binding chưa? (remote only)

RAISE PHASE:
[ ] RAISE ENTITY EVENT CHỈ trong save_modified (save sequence)
[ ] %control check trước khi raise (chỉ raise khi field thay đổi)
[ ] %param fields điền đầy đủ theo abstract entity structure
[ ] Không có COMMIT WORK sau RAISE trong save_modified

LOCAL CONSUMPTION:
[ ] Handler class: FOR EVENTS OF <bdef> trong class definition
[ ] Method: FOR ENTITY EVENT IMPORTING events FOR <entity>~<event>
[ ] CHECK events IS NOT INITIAL ở đầu method
[ ] COMMIT WORK sau xử lý (handler có LUW riêng)
[ ] Error handling trong handler độc lập với provider

ENVIRONMENT:
[ ] S/4HANA 2022+ On-Prem hoặc BTP ABAP Environment
[ ] Events ở child entity: chỉ từ S/4HANA 2023+
[ ] Monitor: /IWXBE/EVENT_MONITOR (On-Prem) sau khi test
```

---

## 17. Sources

| Source | URL | Nội dung |
|---|---|---|
| SAP Help — Business Events | https://help.sap.com/docs/abap-cloud/abap-rap/business-events | Official overview |
| SAP Help — Develop Business Events | https://help.sap.com/docs/abap-cloud/abap-rap/develop-business-events | BDEF syntax, RAISE EML |
| SAP Help — Business Event Consumption | https://help.sap.com/docs/abap-cloud/abap-rap/business-event-consumption | Local + remote consumption |
| SAP Help — Event Binding | https://help.sap.com/docs/abap-cloud/abap-rap/event-binding | Event Binding creation |
| SAP Tutorial — RAP Events on BTP | https://developers.sap.com/tutorials/abap-environment-create-rap-business-events.html | Step-by-step BTP tutorial |
| SAP Tutorial — RAP Events On-Premise | https://developers.sap.com/tutorials/abap-environment-create-s4hana-rap-business-events.html | Step-by-step On-Prem tutorial |
| GitHub — RAP110 Exercise 11 | https://github.com/SAP-samples/abap-platform-rap110/blob/main/exercises/ex11/README.md | Full hands-on: define + raise + local consume |
| SAP Community — Create RAP Events BTP | https://blogs.sap.com/2022/09/19/how-to-create-rap-business-events-in-sap-btp-abap-environment/ | Detailed BTP guide |
| SAP Community — Create RAP Events On-Prem 2022 | https://community.sap.com/t5/technology-blog-posts-by-sap/how-to-create-rap-business-events-in-sap-s-4hana-on-premise-2022/ba-p/13553312 | On-Prem guide |
| SAP Community — BEL + customer events | https://community.sap.com/t5/technology-blog-posts-by-sap/step-by-step-implementation-of-customer-defined-events-in-business-event/ba-p/14056091 | Events ở child node, BEL integration |
| SAP Community — Consume standard + raise custom | https://community.sap.com/t5/technology-blog-posts-by-sap/rap-event-consume-sap-standard-event-and-trigger-custom-rap-event/ba-p/14241235 | Standard event consumption + re-raise pattern |
| SAP Community — Event Mesh blog series [2] | https://community.sap.com/t5/technology-blog-posts-by-sap/rap-business-events-with-advanced-event-mesh-2-creating-custom-business/ba-p/13914171 | Event Binding, wrapper method pattern |
| SAP Community — Custom payload fields | https://community.sap.com/t5/technology-blog-posts-by-members/enhancing-sap-business-events-with-custom-payload-fields-using-rap/ba-p/14241341 | Derived events, payload enhancement |
| SAP Community — Local consumption On-Prem | https://community.sap.com/t5/technology-q-a/local-rap-business-event-consumption-in-s-4hana-2023-op/qaq-p/13939478 | Local handler syntax, FOR ENTITY EVENT |
| SAP Learning — Raising and Handling Events | https://learning.sap.com/courses/building-transactional-apps-with-the-abap-restful-application-programming-model/raising-and-handling-business-events | Official SAP learning course |