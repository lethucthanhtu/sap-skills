# RAP — BAPI Wrapper Pattern

Hướng dẫn đầy đủ để wrap BAPI/Function Module vào RAP Business Object,
covering On-Premise ECC/S4, S/4HANA Cloud Private Edition, và ABAP Cloud tiers.

---

## Table of Contents

1. [When to Use BAPI Wrapper](#1-when-to-use-bapi-wrapper)
2. [Decision Matrix — Wrapper Strategy](#2-decision-matrix--wrapper-strategy)
3. [RAP Scenario Choice for BAPI Integration](#3-rap-scenario-choice-for-bapi-integration)
4. [Phase Rule — Where to Call BAPI](#4-phase-rule--where-to-call-bapi)
5. [Pattern A — Managed with Unmanaged Save (Recommended)](#5-pattern-a--managed-with-unmanaged-save-recommended)
6. [Pattern B — Fully Unmanaged RAP](#6-pattern-b--fully-unmanaged-rap)
7. [BAPI Wrapper Class Design (OO Pattern)](#7-bapi-wrapper-class-design-oo-pattern)
8. [ABAP Cloud: Tier-2 Wrapper + C1 Release](#8-abap-cloud-tier-2-wrapper--c1-release)
9. [BAPI RETURN Table → RAP Messages Mapping](#9-bapi-return-table--rap-messages-mapping)
10. [BAPI Test Mode (Simulation) in Validation](#10-bapi-test-mode-simulation-in-validation)
11. [cl_abap_behavior_saver_failed — Errors in save_modified](#11-cl_abap_behavior_saver_failed--errors-in-save_modified)
12. [COMMIT WORK Problem & Workarounds](#12-commit-work-problem--workarounds)
13. [Anti-Patterns](#13-anti-patterns)
14. [Checklist Before Go-Live](#14-checklist-before-go-live)
15. [Sources](#15-sources)

---

## 1. When to Use BAPI Wrapper

Dùng BAPI Wrapper khi:

| Situation | Approach |
|---|---|
| Cần gọi BAPI cũ để persist data (ECC/On-Prem) | Pattern A hoặc B |
| BAPI chưa có released API tương đương | Wrap BAPI → C1 release |
| SAP standard BAPI đã có released RAP BO (e.g. `I_PurchaseRequisitionTp`) | ❌ Dùng EML gọi thẳng released BO, KHÔNG wrap BAPI |
| Custom FM không thể refactor | Pattern A hoặc B |
| ABAP Cloud (S/4HANA Cloud, BTP) — BAPI chưa released | Tier-2 wrapper (Section 8) |

> ⚠️ **Rule**: Luôn check SAP Business Accelerator Hub (`api.sap.com`) và `RELEASED_OBJECTS`
> trước khi wrap BAPI. Nếu đã có released RAP BO → dùng EML, không wrap.

---

## 2. Decision Matrix — Wrapper Strategy

```
Bạn đang ở môi trường nào?
│
├── ECC / S/4HANA On-Prem (Classic ABAP OK)
│   └── BAPI có thể gọi trực tiếp trong save_modified
│       → Pattern A (Managed with Unmanaged Save) ← RECOMMENDED
│       → Pattern B (Fully Unmanaged) nếu cần buffer toàn bộ
│
├── S/4HANA Cloud Private Edition / Developer Extensibility
│   └── BAPI có C1 release? ──→ YES: gọi trực tiếp
│                           └── NO:  Tier-2 Wrapper + ACO_PROXY (Section 8)
│
└── S/4HANA Cloud Public / BTP ABAP Environment (Steampunk)
    └── Chỉ dùng released APIs. Không thể gọi BAPI trực tiếp.
        → Dùng released RAP BO interface hoặc xem có Nominated API không
```

---

## 3. RAP Scenario Choice for BAPI Integration

| Scenario | Khi nào dùng |
|---|---|
| **Managed with Unmanaged Save** | Dùng managed buffer của SAP cho interaction, chỉ gọi BAPI trong `save_modified`. Interaction phase bình thường (validations, determinations do framework handle). **← Hầu hết trường hợp** |
| **Fully Unmanaged** | Cần full control buffer (multi-BO, complex state machine, legacy logic hoàn toàn). Phức tạp hơn đáng kể. |
| **Managed with Additional Save** | Chỉ cần trigger thêm side-effect khi save (e.g. log, notify), không thay thế persist. BAPI không phải persistence chính. |

---

## 4. Phase Rule — Where to Call BAPI

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAP TRANSACTION MODEL                         │
├─────────────────────────────────────────────────────────────────┤
│  INTERACTION PHASE (create/update/delete/action handlers)       │
│  ✅ MODIFY ENTITIES IN LOCAL MODE                               │
│  ✅ READ ENTITIES IN LOCAL MODE                                 │
│  ✅ BAPI trong TEST MODE (check/simulate) ← xem Section 10     │
│  ❌ CALL FUNCTION 'BAPI_xxx' (commit mode) ← DUMP              │
│  ❌ CALL FUNCTION 'BAPI_TRANSACTION_COMMIT' ← DUMP             │
│  ❌ COMMIT WORK / ROLLBACK WORK ← DUMP                         │
│  ❌ CALL FUNCTION ... IN UPDATE TASK ← DUMP                    │
├─────────────────────────────────────────────────────────────────┤
│  SAVE SEQUENCE (save_modified / finalize / adjust_numbers)      │
│  ✅ CALL FUNCTION 'BAPI_xxx' (full call)                       │
│  ✅ CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'                    │
│  ✅ Direct INSERT/UPDATE/DELETE to DB (unmanaged only)         │
│  ❌ MODIFY ENTITIES / READ ENTITIES IN LOCAL MODE              │
│  ❌ COMMIT WORK (dùng BAPI_TRANSACTION_COMMIT thay thế)        │
└─────────────────────────────────────────────────────────────────┘
```

> 🔴 **Critical**: BAPI call ở interaction phase sẽ gây
> `BEHAVIOR_ILLEGAL_STATEMENT` dump. KHÔNG có exception.

---

## 5. Pattern A — Managed with Unmanaged Save (Recommended)

Đây là pattern phổ biến nhất khi wrap BAPI vào RAP.
Framework xử lý buffer, bạn chỉ cần implement `save_modified`.

### 5.1 BDEF

```abap
" [Environment: S/4HANA On-Premise / ECC Extension via RAP]
managed with unmanaged save
  implementation in class zbp_i_z_salesorder unique;
strict ( 2 );

define behavior for Z_I_SalesOrder alias SalesOrder
  persistent table zsalesorder
  draft table zsalesorder_d
  lock master total etag LastChangedAt
  etag master LocalLastChangedAt
  authorization master ( global )
{
  field ( readonly ) SalesOrderId;
  field ( mandatory ) CustomerNumber, NetAmount, Currency;

  create;
  update;
  delete;

  action submitOrder result [1] $self;

  mapping for zsalesorder
  {
    SalesOrderId    = sales_order_id;
    CustomerNumber  = customer_number;
    NetAmount       = net_amount;
    Currency        = currency;
    OverallStatus   = overall_status;
    LastChangedAt   = last_changed_at;
    LocalLastChangedAt = local_last_changed_at;
    CreatedBy       = created_by;
    CreatedAt       = created_at;
    LastChangedBy   = last_changed_by;
  }
}
```

> ℹ️ `managed with unmanaged save`: Framework vẫn handle buffer bình thường.
> Chỉ khác ở save sequence: bạn implement `save_modified` thay vì framework tự INSERT.

### 5.2 Behavior Pool Structure

```abap
"=======================================================
" Global class (abstract, final — không implement gì)
"=======================================================
CLASS zbp_i_z_salesorder DEFINITION
  PUBLIC ABSTRACT FINAL
  FOR BEHAVIOR OF z_i_salesorder.
ENDCLASS.

CLASS zbp_i_z_salesorder IMPLEMENTATION.
ENDCLASS.

"=======================================================
" Local handler class — interaction phase
"=======================================================
CLASS lhc_salesorder DEFINITION
  INHERITING FROM cl_abap_behavior_handler.

  PRIVATE SECTION.
    METHODS:
      get_global_authorizations FOR GLOBAL AUTHORIZATION
        IMPORTING REQUEST requested_authorizations
        RESULT    result,

      create FOR MODIFY
        IMPORTING entities FOR CREATE salesorder,

      " ⚠️ submitOrder: KHÔNG gọi BAPI ở đây, chỉ update status flag
      submitorder FOR MODIFY
        IMPORTING keys FOR ACTION salesorder~submitOrder RESULT result.

ENDCLASS.

CLASS lhc_salesorder IMPLEMENTATION.

  METHOD get_global_authorizations.
    " Kiểm tra AUTHORITY-CHECK
    IF requested_authorizations-%create = if_abap_behv=>mk-on.
      AUTHORITY-CHECK OBJECT 'Z_SO' ID 'ACTVT' FIELD '01'.
      result-%create = COND #(
        WHEN sy-subrc = 0 THEN if_abap_behv=>auth-allowed
        ELSE                   if_abap_behv=>auth-unauthorized ).
    ENDIF.
    IF requested_authorizations-%update = if_abap_behv=>mk-on.
      AUTHORITY-CHECK OBJECT 'Z_SO' ID 'ACTVT' FIELD '02'.
      result-%update = COND #(
        WHEN sy-subrc = 0 THEN if_abap_behv=>auth-allowed
        ELSE                   if_abap_behv=>auth-unauthorized ).
    ENDIF.
  ENDMETHOD.

  METHOD create.
    " Framework tự handle — không cần code nếu dùng managed buffer
    " Chỉ cần nếu muốn custom validation ngay lúc create
  ENDMETHOD.

  METHOD submitorder.
    " ✅ CORRECT: Chỉ update status flag trong interaction phase
    " BAPI thực sự sẽ được gọi trong save_modified
    MODIFY ENTITIES OF z_i_salesorder IN LOCAL MODE
      ENTITY salesorder
      UPDATE FIELDS ( OverallStatus )
      WITH VALUE #( FOR key IN keys
                    ( %tky          = key-%tky
                      OverallStatus = 'S' ) )  " S = Submitted
      REPORTED DATA(update_reported).
    reported = CORRESPONDING #( DEEP update_reported ).

    " Return current state
    READ ENTITIES OF z_i_salesorder IN LOCAL MODE
      ENTITY salesorder ALL FIELDS
      WITH CORRESPONDING #( keys )
      RESULT DATA(lt_result).
    result = VALUE #( FOR so IN lt_result
                      ( %tky   = so-%tky
                        %param = so ) ).
  ENDMETHOD.

ENDCLASS.

"=======================================================
" Local saver class — save sequence (BAPI call here)
"=======================================================
CLASS lsc_z_i_salesorder DEFINITION
  INHERITING FROM cl_abap_behavior_saver_failed.  " ← use _failed variant!

  PROTECTED SECTION.
    METHODS:
      finalize          REDEFINITION,
      check_before_save REDEFINITION,
      save_modified     REDEFINITION,
      cleanup_finalize  REDEFINITION.

ENDCLASS.

CLASS lsc_z_i_salesorder IMPLEMENTATION.

  METHOD finalize.
    " Called after check_before_save — last chance to derive fields
    " e.g. set timestamps, defaults
    MODIFY ENTITIES OF z_i_salesorder IN LOCAL MODE
      ENTITY salesorder
      UPDATE FIELDS ( LocalLastChangedAt LastChangedAt )
      WITH VALUE #(
        FOR so IN update-salesorder
        ( %tky              = so-%tky
          LastChangedAt     = cl_abap_context_info=>get_system_time_utclong( )
          LocalLastChangedAt = cl_abap_context_info=>get_system_time_utclong( ) ) ).
  ENDMETHOD.

  METHOD check_before_save.
    " Optional: last-minute validation before BAPI call
    " Thường dùng để check data completeness
  ENDMETHOD.

  METHOD save_modified.
    " ✅ CORRECT PLACE to call BAPI

    " --- Handle CREATEs ---
    IF create-salesorder IS NOT INITIAL.
      LOOP AT create-salesorder INTO DATA(ls_create).

        " Only call BAPI for submitted orders
        CHECK ls_create-OverallStatus = 'S'.

        DATA(lo_wrapper) = zcl_fact_bapi_so=>create_instance( ).

        TRY.
            lo_wrapper->create_sales_order(
              EXPORTING
                customer_number = ls_create-CustomerNumber
                net_amount      = ls_create-NetAmount
                currency        = ls_create-Currency
              IMPORTING
                sales_doc_number = DATA(lv_vbeln)
              CHANGING
                return           = DATA(lt_return) ).

          CATCH zcx_bapi_so_error INTO DATA(lx_bapi).
            " Map exception to RAP failed/reported
            APPEND VALUE #( %key = ls_create-%key ) TO failed-salesorder.
            APPEND VALUE #( %key  = ls_create-%key
                            %msg  = new_message_with_text(
                              severity = if_abap_behv_message=>severity-error
                              text     = lx_bapi->get_text( ) ) )
              TO reported-salesorder.
            CONTINUE.
        ENDTRY.

        " Check BAPI RETURN table for errors
        LOOP AT lt_return INTO DATA(ls_return)
          WHERE type = 'E' OR type = 'A'.
          APPEND VALUE #( %key = ls_create-%key ) TO failed-salesorder.
          APPEND VALUE #( %key = ls_create-%key
                          %msg = new_message(
                            id       = ls_return-id
                            number   = ls_return-number
                            severity = if_abap_behv_message=>severity-error
                            v1       = ls_return-message_v1
                            v2       = ls_return-message_v2
                            v3       = ls_return-message_v3
                            v4       = ls_return-message_v4 ) )
            TO reported-salesorder.
        ENDLOOP.

        IF failed-salesorder IS NOT INITIAL.
          CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
          RETURN.
        ENDIF.

        " ✅ Commit ONLY after all successful
        CALL FUNCTION 'BAPI_TRANSACTION_COMMIT' EXPORTING wait = 'X'.

        " Store BAPI-assigned document number back (if needed)
        MODIFY ENTITIES OF z_i_salesorder IN LOCAL MODE
          ENTITY salesorder
          UPDATE FIELDS ( ExternalDocNumber )
          WITH VALUE #( ( %key            = ls_create-%key
                          ExternalDocNumber = lv_vbeln ) ).

      ENDLOOP.
    ENDIF.

    " --- Handle UPDATEs ---
    IF update-salesorder IS NOT INITIAL.
      LOOP AT update-salesorder INTO DATA(ls_update).
        " Only process if OverallStatus changed to 'S'
        CHECK ls_update-%control-OverallStatus = if_abap_behv=>mk-on
          AND ls_update-OverallStatus = 'S'.

        DATA(lo_upd) = zcl_fact_bapi_so=>create_instance( ).

        TRY.
            lo_upd->update_sales_order(
              EXPORTING
                sales_doc = ls_update-ExternalDocNumber
                " Only pass changed fields via %control check
                net_amount = COND #(
                  WHEN ls_update-%control-NetAmount = if_abap_behv=>mk-on
                  THEN ls_update-NetAmount )
              CHANGING
                return = DATA(lt_upd_return) ).

          CATCH zcx_bapi_so_error INTO DATA(lx_upd).
            APPEND VALUE #( %key = ls_update-%key ) TO failed-salesorder.
            APPEND VALUE #( %key = ls_update-%key
                            %msg = new_message_with_text(
                              severity = if_abap_behv_message=>severity-error
                              text     = lx_upd->get_text( ) ) )
              TO reported-salesorder.
            CONTINUE.
        ENDTRY.

        LOOP AT lt_upd_return INTO DATA(ls_upd_return) WHERE type = 'E'.
          APPEND VALUE #( %key = ls_update-%key ) TO failed-salesorder.
          APPEND VALUE #( %key = ls_update-%key
                          %msg = new_message(
                            id = ls_upd_return-id number = ls_upd_return-number
                            severity = if_abap_behv_message=>severity-error
                            v1 = ls_upd_return-message_v1 ) )
            TO reported-salesorder.
        ENDLOOP.

        IF failed-salesorder IS NOT INITIAL.
          CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
          RETURN.
        ENDIF.

        CALL FUNCTION 'BAPI_TRANSACTION_COMMIT' EXPORTING wait = 'X'.
      ENDLOOP.
    ENDIF.

    " --- Handle DELETEs ---
    IF delete-salesorder IS NOT INITIAL.
      LOOP AT delete-salesorder INTO DATA(ls_delete).
        " Call BAPI to reverse/cancel, then commit
        " (implementation similar to CREATE above)
      ENDLOOP.
    ENDIF.

  ENDMETHOD.

  METHOD cleanup_finalize.
    " Called on framework rollback — cleanup BAPI transaction
    CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
  ENDMETHOD.

ENDCLASS.
```

---

## 6. Pattern B — Fully Unmanaged RAP

Dùng khi cần buffer toàn bộ (multi-entity, complex workflow).
Pattern này phức tạp hơn nhưng cho full control.

```abap
" BDEF — fully unmanaged
unmanaged implementation in class zbp_i_z_purchaseorder unique;
strict ( 2 );

define behavior for Z_I_PurchaseOrder alias PurchaseOrder
  lock master
  authorization master ( global )
  etag master LastChangedAt
{
  field ( readonly ) PurchaseOrderId;
  field ( mandatory ) Vendor, CompanyCode;

  create;
  update;
  delete;

  mapping for zpurchaseorder
  {
    PurchaseOrderId = po_id;
    Vendor          = vendor;
    CompanyCode     = company_code;
    LastChangedAt   = last_changed_at;
  }
}
```

```abap
" Local buffer class — holds transient state during interaction
CLASS lcl_buffer DEFINITION CREATE PRIVATE.
  PUBLIC SECTION.
    CLASS-METHODS: get_instance RETURNING VALUE(result) TYPE REF TO lcl_buffer.
    METHODS:
      add_create    IMPORTING is_data TYPE z_i_purchaseorder,
      add_update    IMPORTING is_data TYPE z_i_purchaseorder,
      add_delete    IMPORTING is_key  TYPE z_i_purchaseorder-PurchaseOrderId,
      get_creates   RETURNING VALUE(rt_data) TYPE STANDARD TABLE OF z_i_purchaseorder,
      get_updates   RETURNING VALUE(rt_data) TYPE STANDARD TABLE OF z_i_purchaseorder,
      get_deletes   RETURNING VALUE(rt_keys) TYPE STANDARD TABLE OF z_i_purchaseorder-PurchaseOrderId,
      clear.

  PRIVATE SECTION.
    CLASS-DATA: instance TYPE REF TO lcl_buffer.
    DATA: new_entries    TYPE STANDARD TABLE OF z_i_purchaseorder,
          update_entries TYPE STANDARD TABLE OF z_i_purchaseorder,
          delete_keys    TYPE STANDARD TABLE OF z_i_purchaseorder-PurchaseOrderId.
ENDCLASS.

CLASS lcl_buffer IMPLEMENTATION.
  METHOD get_instance.
    IF instance IS INITIAL.
      instance = NEW #( ).
    ENDIF.
    result = instance.
  ENDMETHOD.
  METHOD add_create.    INSERT is_data INTO TABLE new_entries. ENDMETHOD.
  METHOD add_update.    INSERT is_data INTO TABLE update_entries. ENDMETHOD.
  METHOD add_delete.    INSERT is_key  INTO TABLE delete_keys.   ENDMETHOD.
  METHOD get_creates.   rt_data = new_entries.    ENDMETHOD.
  METHOD get_updates.   rt_data = update_entries. ENDMETHOD.
  METHOD get_deletes.   rt_keys = delete_keys.    ENDMETHOD.
  METHOD clear.
    CLEAR: new_entries, update_entries, delete_keys.
  ENDMETHOD.
ENDCLASS.
```

---

## 7. BAPI Wrapper Class Design (OO Pattern)

Pattern chuẩn: **Interface → Wrapper Class → Factory Class**
(theo SAP RAP640 + SAP tutorial `abap-s4hanacloud-purchasereq-create-wrapper`)

### 7.1 Interface (C1-released)

```abap
INTERFACE zif_bapi_so_create
  PUBLIC.

  " Shadow types for unreleased BAPI structures
  TYPES:
    BEGIN OF ty_so_header,
      kunnr    TYPE kunnr,    " Customer
      waers    TYPE waerk,    " Currency
      netwr    TYPE netwr_ap, " Net amount
    END OF ty_so_header,

    ty_return TYPE STANDARD TABLE OF bapiret2 WITH DEFAULT KEY.

  " Method signature — expose ONLY what callers need
  METHODS:
    create_sales_order
      IMPORTING
        is_header          TYPE ty_so_header
      EXPORTING
        ev_sales_doc       TYPE vbeln_va
      CHANGING
        ct_return          TYPE ty_return
      RAISING
        zcx_bapi_so_error,

    " Simulation mode — for use in validation
    check_sales_order
      IMPORTING
        is_header          TYPE ty_so_header
      RETURNING
        VALUE(rt_return)   TYPE ty_return.

ENDINTERFACE.
```

### 7.2 Wrapper Class (Tier-2, NOT C1-released directly)

```abap
CLASS zcl_bapi_so_wrapper DEFINITION
  PUBLIC FINAL
  CREATE PRIVATE.  " ← private: only via factory

  PUBLIC SECTION.
    INTERFACES zif_bapi_so_create.

  PRIVATE SECTION.
    METHODS:
      call_bapi_salesorder_create  " Central private method — best practice
        IMPORTING
          is_header          TYPE zif_bapi_so_create=>ty_so_header
          iv_testrun         TYPE abap_bool DEFAULT abap_false
        EXPORTING
          ev_sales_doc       TYPE vbeln_va
        CHANGING
          ct_return          TYPE zif_bapi_so_create=>ty_return.

ENDCLASS.

CLASS zcl_bapi_so_wrapper IMPLEMENTATION.

  METHOD zif_bapi_so_create~create_sales_order.
    call_bapi_salesorder_create(
      EXPORTING is_header    = is_header
                iv_testrun   = abap_false
      IMPORTING ev_sales_doc = ev_sales_doc
      CHANGING  ct_return    = ct_return ).

    " Check for errors — raise exception for Tier-1 to handle
    LOOP AT ct_return INTO DATA(ls_ret) WHERE type = 'E' OR type = 'A'.
      RAISE EXCEPTION TYPE zcx_bapi_so_error
        MESSAGE ID   ls_ret-id
                TYPE ls_ret-type
                NUMBER ls_ret-number
                WITH ls_ret-message_v1 ls_ret-message_v2
                     ls_ret-message_v3 ls_ret-message_v4.
    ENDLOOP.
  ENDMETHOD.

  METHOD zif_bapi_so_create~check_sales_order.
    DATA(lv_dummy) = VALUE vbeln_va( ).
    call_bapi_salesorder_create(
      EXPORTING is_header    = is_header
                iv_testrun   = abap_true  " ← test mode
      IMPORTING ev_sales_doc = lv_dummy
      CHANGING  ct_return    = rt_return ).
  ENDMETHOD.

  METHOD call_bapi_salesorder_create.
    " Central method: has access to ALL BAPI parameters
    " Interface only exposes what is needed (encapsulation)
    DATA: ls_header TYPE bapisdhead1.

    " Map from clean interface type to BAPI structure
    ls_header-kunnr = is_header-kunnr.
    ls_header-waers = is_header-waers.
    ls_header-netwr = is_header-netwr.

    CALL FUNCTION 'BAPI_SALESORDER_CREATEFROMDAT2'
      EXPORTING
        order_header_in     = ls_header
        testrun             = COND char1( WHEN iv_testrun = abap_true THEN 'X' )
      IMPORTING
        salesdocument       = ev_sales_doc
      TABLES
        return              = ct_return.

    " ✅ COMMIT only in create (non-test), called from save_modified
    " ❌ NEVER commit here — let save_modified handle it
  ENDMETHOD.

ENDCLASS.
```

### 7.3 Factory Class (C1-released — Tier-1 entry point)

```abap
CLASS zcl_fact_bapi_so DEFINITION
  PUBLIC FINAL
  CREATE PRIVATE.

  PUBLIC SECTION.
    CLASS-METHODS create_instance
      RETURNING VALUE(result) TYPE REF TO zif_bapi_so_create.

  PRIVATE SECTION.
    METHODS constructor.

ENDCLASS.

CLASS zcl_fact_bapi_so IMPLEMENTATION.
  METHOD create_instance.
    result = NEW zcl_bapi_so_wrapper( ).
  ENDMETHOD.
  METHOD constructor.
  ENDMETHOD.
ENDCLASS.
```

**Usage in Tier-1 (save_modified):**

```abap
" ✅ Tier-1 code only knows the interface — decoupled from wrapper
DATA(lo_bapi) = zcl_fact_bapi_so=>create_instance( ).
lo_bapi->create_sales_order(
  EXPORTING is_header = VALUE #( kunnr = '0001000001' waers = 'VND' netwr = '5000000' )
  IMPORTING ev_sales_doc = DATA(lv_doc)
  CHANGING  ct_return    = DATA(lt_ret) ).
```

---

## 8. ABAP Cloud: Tier-2 Wrapper + C1 Release

Áp dụng cho: **S/4HANA Cloud Private Edition, S/4HANA On-Prem với Developer Extensibility**.

### 8.1 Automated via ACO_PROXY (S/4HANA 2022+)

```
Transaction: ACO_PROXY
   ├── Input: BAPI Function Module name (e.g. BAPI_PR_CREATE)
   ├── Options:
   │   ├── Generate: Wrapper class + Interface + Factory class
   │   ├── C1 Release: ✅ (check this)
   │   └── Target Package: Tier-2 package (e.g. Z_TIER2_PKGS)
   └── Output:
       ├── ZCL_WRAP_<BAPI>      — wrapper class
       ├── ZIF_WRAP_<BAPI>      — interface (C1-released)
       └── ZCL_FACT_<BAPI>      — factory class (C1-released)
```

> ℹ️ `ACO_PROXY` available from S/4HANA 2022 On-Prem.
> SAP Notes: 3444292, 3457580 phải được apply trước khi dùng.
> Source: [SAP Blog — How to generate a wrapper](https://community.sap.com/t5/technology-blog-posts-by-sap/how-to-generate-a-wrapper-for-function-modules-bapis-for-missing-released/ba-p/13692790)

### 8.2 Manual Tier-2 Package Setup

```
Package structure:
│
├── Z_TIER2_PKGS/         ← Tier-2 package (ABAP for Cloud NOT enabled)
│   ├── ZCL_BAPI_WRAP_*   ← wrapper class (accesses unreleased BAPI)
│   └── ZIF_BAPI_WRAP_*   ← interface C1-released → accessible in Tier-1
│
└── Z_TIER1_PKGS/         ← Tier-1 package (ABAP Cloud enabled)
    └── ZBP_I_*           ← RAP behavior implementation
        └── uses ZIF_BAPI_WRAP_* via factory
```

### 8.3 C1 Release Steps (Manual)

```
1. Open ZIF_BAPI_WRAP_* in ADT
2. Properties → API State → Release Contract
3. Add: C1 (Use System-Internally + Use in Cloud Development)
4. Repeat for ZCL_FACT_BAPI_*  (factory class only, NOT wrapper class)
5. Activate both objects
```

---

## 9. BAPI RETURN Table → RAP Messages Mapping

Đây là phần quan trọng nhất — mapping đúng giúp Fiori hiển thị lỗi đúng.

```abap
" Standard pattern: map BAPIRET2/BAPIRETTAB → RAP reported
" Dùng trong save_modified hoặc validation (test mode)
TYPES: ty_return TYPE STANDARD TABLE OF bapiret2 WITH DEFAULT KEY.

DATA(lt_return) = VALUE ty_return( ).

" ... call BAPI ...

" Map BAPI RETURN → RAP messages
LOOP AT lt_return INTO DATA(ls_ret).
  CASE ls_ret-type.
    WHEN 'E' OR 'A'.   " Error / Abort
      APPEND VALUE #( %key = <entity>-%key ) TO failed-<entity>.
      APPEND VALUE #(
        %key = <entity>-%key
        %msg = new_message(
          id       = ls_ret-id
          number   = ls_ret-number
          severity = if_abap_behv_message=>severity-error
          v1       = ls_ret-message_v1
          v2       = ls_ret-message_v2
          v3       = ls_ret-message_v3
          v4       = ls_ret-message_v4 )
      ) TO reported-<entity>.

    WHEN 'W'.          " Warning — show to user but don't block
      APPEND VALUE #(
        %key = <entity>-%key
        %msg = new_message(
          id       = ls_ret-id
          number   = ls_ret-number
          severity = if_abap_behv_message=>severity-warning
          v1       = ls_ret-message_v1
          v2       = ls_ret-message_v2
          v3       = ls_ret-message_v3
          v4       = ls_ret-message_v4 )
      ) TO reported-<entity>.

    WHEN 'S' OR 'I'.   " Success / Info — optional, show in Fiori toast
      APPEND VALUE #(
        %key = <entity>-%key
        %msg = new_message(
          id       = ls_ret-id
          number   = ls_ret-number
          severity = if_abap_behv_message=>severity-success
          v1       = ls_ret-message_v1 )
      ) TO reported-<entity>.

    WHEN OTHERS.
      " Ignore unknown types
  ENDCASE.
ENDLOOP.
```

> ⚠️ **Warning duplication bug**: Nếu BAPI trả về warning kèm success,
> Fiori có thể gọi lại action (double execution). Giải pháp:
> 1. Dùng `%control` để kiểm tra trạng thái đã xử lý
> 2. Hoặc chỉ map type `'E'/'A'` vào `failed`, bỏ qua `'W'` nếu không cần
> Source: [SAP Community — BAPI Warning issue](https://community.sap.com/t5/technology-q-a/in-rap-issue-with-bapi-warning-message-handling-in-unmanaged-save/qaq-p/13988852)

---

## 10. BAPI Test Mode (Simulation) in Validation

Gọi BAPI trong **test/simulation mode** để validate ở interaction phase — hoàn toàn hợp lệ.

```abap
METHOD validate_order.
  " ✅ CORRECT: BAPI test mode in interaction phase (no DB write, no commit)
  LOOP AT entities INTO DATA(ls_entity)
    WHERE %validation-validateOrderData = if_abap_behv=>mk-on.

    DATA(lt_return) = zcl_fact_bapi_so=>create_instance( )->check_sales_order(
      is_header = VALUE #(
        kunnr = ls_entity-CustomerNumber
        waers = ls_entity-Currency
        netwr = ls_entity-NetAmount ) ).

    " Map errors from BAPI test mode to RAP validation messages
    LOOP AT lt_return INTO DATA(ls_ret) WHERE type = 'E'.
      APPEND VALUE #( %tky = ls_entity-%tky ) TO failed-salesorder.
      APPEND VALUE #(
        %tky        = ls_entity-%tky
        %state_area = 'VALIDATE_ORDER_DATA'  " must be unique per validation
        %msg        = new_message(
          id       = ls_ret-id
          number   = ls_ret-number
          severity = if_abap_behv_message=>severity-error
          v1       = ls_ret-message_v1
          v2       = ls_ret-message_v2
          v3       = ls_ret-message_v3
          v4       = ls_ret-message_v4 )
      ) TO reported-salesorder.
    ENDLOOP.

  ENDLOOP.
ENDMETHOD.
```

> ✅ Nhiều BAPI có parameter `TESTRUN = 'X'` để simulate mà không commit.
> Kiểm tra BAPI documentation trong SE37 trước khi dùng pattern này.

---

## 11. cl_abap_behavior_saver_failed — Errors in save_modified

Để `save_modified` có thể trả về `failed`/`reported` parameters, phải dùng
`cl_abap_behavior_saver_failed` thay vì `cl_abap_behavior_saver`.

```abap
" ✅ CORRECT — supports failed/reported in save_modified
CLASS lsc_z_i_salesorder DEFINITION
  INHERITING FROM cl_abap_behavior_saver_failed.   " ← _failed variant
  PROTECTED SECTION.
    METHODS save_modified REDEFINITION.
ENDCLASS.

" ❌ WRONG — save_modified có không có failed/reported output
CLASS lsc_z_i_salesorder DEFINITION
  INHERITING FROM cl_abap_behavior_saver.   " ← basic variant, no error reporting
  PROTECTED SECTION.
    METHODS save_modified REDEFINITION.
ENDCLASS.
```

> Source: [SAP Community — Exposing BAPI as OData via RAP Facade](https://community.sap.com/t5/technology-blog-posts-by-sap/exposing-bapi-as-odata-api-using-rap-facade/ba-p/13571926)

---

## 12. COMMIT WORK Problem & Workarounds

### Problem

Nhiều BAPI cũ có `COMMIT WORK` hardcoded bên trong. Gọi các BAPI này
trong `save_modified` gây DUMP `BEHAVIOR_ILLEGAL_STATEMENT`.

### Root Cause Diagnosis

```abap
" Kiểm tra BAPI có internal COMMIT không
" SE37 → BAPI name → Display → Step through code
" Hoặc dùng: WHERE-USED → search for COMMIT WORK in include
```

### Workarounds (theo thứ tự ưu tiên)

```
1. Dùng BAPI có parameter TESTRUN/SIMUL → real call không có commit
   (nhiều BAPIs mới hỗ trợ này)

2. Gọi BAPI qua aRFC (asynchronous RFC) — CALL FUNCTION IN STARTING NEW TASK
   ⚠️ Chỉ dùng nếu không cần kết quả đồng bộ

3. CALL FUNCTION 'BAPI_xxx' DESTINATION 'NONE'
   → Tạo LUW riêng, COMMIT trong LUW đó không ảnh hưởng RAP LUW
   ⚠️ Cần verify behavior trên hệ thống thực

4. Background Processing Framework (BGPF) — S/4HANA 2023 On-Prem+
   → Gọi BAPI trong background task, không block LUW
   ⚠️ Async — không có result ngay trong same request

5. Refactor BAPI thành class method không có COMMIT
   → Tốt nhất về lâu dài nhưng rủi ro regression
```

> Source: [SAP Community — BAPI Commit Issue in RAP](https://community.sap.com/t5/technology-q-a/save-sequence-bapi-commit-issue-abap-restful-programming-on-premise/qaq-p/12135945)

---

## 13. Anti-Patterns

### ❌ AP-BAPI-01: BAPI call trong interaction phase

```abap
" ❌ WRONG — DUMP: BEHAVIOR_ILLEGAL_STATEMENT
METHOD create.
  LOOP AT entities INTO DATA(ls_entity).
    CALL FUNCTION 'BAPI_SALESORDER_CREATEFROMDAT2'   " ← DUMP
      EXPORTING order_header_in = ...
      IMPORTING salesdocument   = ...
    CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'.          " ← DUMP
  ENDLOOP.
ENDMETHOD.
```

```abap
" ✅ CORRECT — chỉ update buffer flag, BAPI call trong save_modified
METHOD create.
  " Framework tự buffer — không cần gọi BAPI ở đây
ENDMETHOD.

METHOD save_modified.
  LOOP AT create-salesorder INTO DATA(ls_create).
    CALL FUNCTION 'BAPI_SALESORDER_CREATEFROMDAT2' ...  " ← correct
    CALL FUNCTION 'BAPI_TRANSACTION_COMMIT' ...
  ENDLOOP.
ENDMETHOD.
```

---

### ❌ AP-BAPI-02: Không check RETURN table sau BAPI call

```abap
" ❌ WRONG — ignore errors, persist bad data silently
CALL FUNCTION 'BAPI_TRAVEL_CREATE' ...
CALL FUNCTION 'BAPI_TRANSACTION_COMMIT' EXPORTING wait = 'X'.
" No RETURN table check!
```

```abap
" ✅ CORRECT — always check RETURN before commit
CALL FUNCTION 'BAPI_TRAVEL_CREATE'
  TABLES return = lt_return.

" Check errors BEFORE commit
LOOP AT lt_return INTO ls_ret WHERE type = 'E' OR type = 'A'.
  APPEND VALUE #( ... ) TO failed-travel.
  APPEND VALUE #( ... ) TO reported-travel.
ENDLOOP.

IF failed-travel IS NOT INITIAL.
  CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.  " ← rollback on error
  RETURN.
ENDIF.

CALL FUNCTION 'BAPI_TRANSACTION_COMMIT' EXPORTING wait = 'X'.
```

---

### ❌ AP-BAPI-03: Gọi trực tiếp BAPI (không qua wrapper) trong Tier-1 ABAP Cloud

```abap
" ❌ WRONG — compile error in ABAP Cloud
CLASS-METHODS create
  FOR TESTING.
  CALL FUNCTION 'BAPI_PR_CREATE' ...   " ← unreleased, won't activate
ENDMETHOD.
```

```abap
" ✅ CORRECT — use factory + interface (Tier-1)
DATA(lo_wrapper) = zcl_fact_bapi_pr=>create_instance( ).
lo_wrapper->create_purchase_requisition( ... ).
```

---

### ❌ AP-BAPI-04: COMMIT WORK thay vì BAPI_TRANSACTION_COMMIT

```abap
" ❌ WRONG — COMMIT WORK gây DUMP trong behavior class
METHOD save_modified.
  CALL FUNCTION 'MY_BAPI' ...
  COMMIT WORK.   " ← DUMP even in save_modified
ENDMETHOD.
```

```abap
" ✅ CORRECT
METHOD save_modified.
  CALL FUNCTION 'MY_BAPI' ...
  CALL FUNCTION 'BAPI_TRANSACTION_COMMIT' EXPORTING wait = 'X'.
ENDMETHOD.
```

---

### ❌ AP-BAPI-05: Inheriting cl_abap_behavior_saver (không có failed output)

```abap
" ❌ WRONG — save_modified không trả được errors về Fiori
CLASS lsc_entity DEFINITION
  INHERITING FROM cl_abap_behavior_saver.   " ← no failed/reported params
```

```abap
" ✅ CORRECT — use _failed variant
CLASS lsc_entity DEFINITION
  INHERITING FROM cl_abap_behavior_saver_failed.
```

---

### ❌ AP-BAPI-06: Dùng wrapper class trực tiếp (không qua factory) trong Tier-1

```abap
" ❌ WRONG — wrapper class không C1-released, won't compile in Tier-1
DATA(lo) = NEW zcl_bapi_so_wrapper( ).
```

```abap
" ✅ CORRECT — chỉ dùng factory (C1-released)
DATA(lo) = zcl_fact_bapi_so=>create_instance( ).
```

---

## 14. Checklist Before Go-Live

```
[ ] BAPI đã có released RAP BO alternative? → dùng EML thay thế
[ ] Wrapper class ở Tier-2 package (separate từ Tier-1)
[ ] Interface + Factory đã C1-released (ADT → Properties → API State)
[ ] save_modified kế thừa cl_abap_behavior_saver_FAILED (không phải base)
[ ] BAPI call CHỈ trong save_modified (không trong action/create/update handler)
[ ] RETURN table được check BEFORE BAPI_TRANSACTION_COMMIT
[ ] BAPI_TRANSACTION_ROLLBACK được gọi khi có lỗi
[ ] BAPI_TRANSACTION_COMMIT dùng EXPORTING wait = 'X' (synchronous)
[ ] Test mode validation dùng BAPI với TESTRUN = 'X' nếu BAPI hỗ trợ
[ ] Warning message mapping không gây double-execution (Section 9 note)
[ ] cleanup_finalize gọi BAPI_TRANSACTION_ROLLBACK
[ ] strict(1) nếu BAPI có CALL FUNCTION IN UPDATE TASK nội bộ
```

---

## 15. Sources

| Source | URL | Nội dung |
|---|---|---|
| SAP Help — RAP Transactional Model | https://help.sap.com/docs/abap-cloud/abap-rap/rap-transactional-model | LUW, save sequence, phase rules |
| SAP Tutorial — Create BAPI Wrapper | https://developers.sap.com/tutorials/abap-s4hanacloud-purchasereq-create-wrapper.html | Interface + Factory + C1 release |
| SAP Tutorial — Integrate Wrapper | https://developers.sap.com/tutorials/abap-s4hanacloud-purchasereq-integrate-wrapper.html | save_modified + RETURN mapping |
| SAP Community — ACO_PROXY Blog | https://community.sap.com/t5/technology-blog-posts-by-sap/how-to-generate-a-wrapper-for-function-modules-bapis-for-missing-released/ba-p/13692790 | ACO_PROXY automated generation |
| SAP Community — RAP Facade / BAPI OData | https://community.sap.com/t5/technology-blog-posts-by-sap/exposing-bapi-as-odata-api-using-rap-facade/ba-p/13571926 | cl_abap_behavior_saver_failed |
| SAP Community — BAPI Commit Issue | https://community.sap.com/t5/technology-q-a/save-sequence-bapi-commit-issue-abap-restful-programming-on-premise/qaq-p/12135945 | COMMIT WORK workarounds |
| SAP Community — BAPI Warning Bug | https://community.sap.com/t5/technology-q-a/in-rap-issue-with-bapi-warning-message-handling-in-unmanaged-save/qaq-p/13988852 | Warning duplication problem |
| GitHub RAP640 | https://github.com/SAP-samples/abap-platform-rap640 | Full hands-on scenario |
| GitHub tier2-rfc-proxy | https://github.com/SAP-samples/tier2-rfc-proxy | ACO_PROXY automation script |
| abapeur.fr — BAPI Clean Core | https://abapeur.fr/en/rap-application-with-bapi-clean-core-objective/ | Managed with unmanaged save decision |
| discoveringabap.com — Unmanaged Part 3 | https://discoveringabap.com/2022/06/11/abap-restful-application-programming-model-6-unmanaged-scenario-part-3/ | FM call + message mapping |
| software-heroes.com — RAP API Pattern | https://software-heroes.com/en/blog/abap-rap-api-pattern-en | Buffer pattern + message examples |