# RAP — Standard BO Extension (Developer Extensibility)

Hướng dẫn đầy đủ để extend SAP standard RAP Business Objects:
thêm custom fields, validations, determinations, actions, và child nodes —
upgrade-stable, không modify standard code.

> **Đọc file này khi:** cần extend standard app (e.g. Purchase Requisition, Sales Order,
> Reservation), thêm custom field ZZ vào SAP standard BO, thêm validation/action
> vào released BDEF, câu hỏi về C0/C1 release, `extend behavior for`, `extension using interface`.

---

## Table of Contents

1. [Extensibility Types — Tổng quan](#1-extensibility-types--tổng-quan)
2. [Decision Matrix — Loại extension nào?](#2-decision-matrix--loại-extension-nào)
3. [Prerequisites — Kiểm tra trước khi bắt đầu](#3-prerequisites--kiểm-tra-trước-khi-bắt-đầu)
4. [Environment Availability](#4-environment-availability)
5. [Step-by-Step: Field Extension (thêm custom field)](#5-step-by-step-field-extension-thêm-custom-field)
6. [Step-by-Step: Behavior Extension (validation/determination)](#6-step-by-step-behavior-extension-validationdetermination)
7. [Step-by-Step: Action Extension (thêm custom action)](#7-step-by-step-action-extension-thêm-custom-action)
8. [Step-by-Step: Node Extension (thêm child entity)](#8-step-by-step-node-extension-thêm-child-entity)
9. [BAdI Extension Pattern (alternative)](#9-badi-extension-pattern-alternative)
10. [EML trong Extension — Đọc/Modify standard BO](#10-eml-trong-extension--đọcmodify-standard-bo)
11. [Package Setup cho Developer Extensibility](#11-package-setup-cho-developer-extensibility)
12. [Anti-Patterns](#12-anti-patterns)
13. [Checklist Before Go-Live](#13-checklist-before-go-live)
14. [Sources](#14-sources)

---

## 1. Extensibility Types — Tổng quan

SAP RAP cung cấp 3 loại developer extensibility chính:

```
┌─────────────────────────────────────────────────────────────────────┐
│  TYPE 1: FIELD EXTENSIBILITY                                         │
│  Thêm custom fields (ZZ prefix) vào standard BO entity              │
│  Objects: Append Structure → Extend CDS View → Extend BDEF          │
│  Keyword: "extend view entity", "extend behavior for"               │
├─────────────────────────────────────────────────────────────────────┤
│  TYPE 2: BEHAVIOR EXTENSIBILITY                                      │
│  Thêm validations, determinations, additional save vào standard BO  │
│  Objects: BDEF Extension (extension ... using interface ...)         │
│  Keyword: "extension using interface", "extend behavior for"        │
├─────────────────────────────────────────────────────────────────────┤
│  TYPE 3: NODE EXTENSIBILITY                                          │
│  Thêm child entity mới vào BO composition hierarchy                 │
│  Objects: New DB table + CDS + BDEF Extension với "define behavior" │
│  Keyword: "define behavior for ExtNode ... dependent"               │
└─────────────────────────────────────────────────────────────────────┘

NGOÀI RA: BAdI Extension — inject custom logic vào released BAdI point
  Đơn giản hơn, không cần CDS/BDEF extension
  Dùng khi SAP standard BO đã expose BAdI definition
```

**Release contracts liên quan:**

| Contract | Ý nghĩa | Developer làm gì |
|---|---|---|
| **C0** | SAP enables extensibility — BO CÓ THỂ được extend | Đây là điều kiện cần. Check `extensible` keyword trong BDEF |
| **C1** | Released for use — customer có thể CALL object này | Factory class, interface → phải C1 để dùng trong Tier-1 |
| **C0 + C1** | Cả hai — vừa extend được, vừa call được | Standard released RAP BOs thường có cả hai |

---

## 2. Decision Matrix — Loại extension nào?

```
Bạn muốn làm gì?
│
├── Thêm custom data field vào standard entity (e.g. ZZ_REGION vào Sales Order)
│   └── → TYPE 1: Field Extension (Section 5)
│
├── Thêm validation / determination vào standard BO
│   ├── Standard BDEF có keyword "extensible" + "with validations on save"?
│   │   └── YES → TYPE 2: Behavior Extension (Section 6)
│   └── Standard BO expose BAdI definition?
│       └── YES → BAdI Extension (Section 9) ← đơn giản hơn
│
├── Thêm custom action / button vào standard Fiori app
│   ├── Standard BDEF có "extensible" + action extension allowed?
│   │   └── YES → TYPE 2: Action Extension (Section 7)
│   └── Không → Chỉ UI Adaptation (Key User Extensibility) hoặc custom app
│
└── Thêm child entity mới vào standard BO (e.g. thêm Attachment vào PR)
    ├── Standard BDEF có "node extensibility" enabled?
    │   └── YES → TYPE 3: Node Extension (Section 8)
    └── Không → Không thể extend, cần custom standalone BO
```

---

## 3. Prerequisites — Kiểm tra trước khi bắt đầu

### Bước 1: Check extensibility trong Fiori Apps Library

```
1. Mở https://fioriappslibrary.hana.ondemand.com
2. Search App ID hoặc App Name (e.g. "F2284" = Manage Purchase Requisitions)
3. Chọn đúng release (e.g. S/4HANA 2023 On-Premise)
4. Mở tab: Implementation Information → Extensibility
5. Check sections:
   - "Customer Fields and Logic" → Key User Extensibility có sẵn
   - "Developer Extensibility" → Developer Extensibility có sẵn
     → Nếu có: liệt kê extension types được phép
```

### Bước 2: Check BDEF trong ADT

```
1. ADT → Ctrl+Shift+A → tìm BDEF (filter: type:bdef api:released)
   e.g. I_PurchaseRequisitionTP, R_SalesOrderTP, I_ReservationDocumentTP
2. Mở BDEF → kiểm tra header:
```

```abap
" ✅ BDEF extensible — có thể extend
managed; strict ( 2 ); extensible {
  with validations on save;       " ← validation extension allowed
  with determinations on modify;  " ← determination on modify allowed
  with determinations on save;    " ← determination on save allowed
  with additional save;           " ← additional save allowed
}
define behavior for I_PurchaseRequisitionTP alias PurchaseRequisition
  extensible {                    " ← entity-level extensible
    field (readonly) PurchaseRequisition;
    ...
  }

" ❌ BDEF không extensible — không extend được bằng BDEF extension
managed; strict ( 2 );           " ← không có extensible keyword
define behavior for I_SomeBO ... {
  ...
}
```

### Bước 3: Check DB table extension category

```
1. SE11 → tìm DB table của standard BO (e.g. EBAN cho PR items)
2. Technical Settings → Enhancement Category
   → "Can Be Enhanced (Deep)" hoặc "Can Be Enhanced (Character-Like Fields)"
   → Nếu "Cannot Be Enhanced" → không thể thêm field
3. Check có Include Structure EBAN_INCL hay không (cần có để append)
```

---

## 4. Environment Availability

| Feature | ECC | S/4HANA On-Prem 2020/2021 | S/4HANA On-Prem 2022+ | S/4HANA Cloud Private | S/4HANA Cloud Public |
|---|---|---|---|---|---|
| Field Extensibility (ZZ fields) | ✅ (classic) | Limited | ✅ | ✅ | ✅ |
| Behavior Extension (BDEF ext) | ❌ | ❌ | ✅ (ABAP 7.57+) | ✅ | ✅ |
| Node Extension | ❌ | ❌ | ✅ | ✅ | ✅ |
| BAdI Extension | ✅ (classic BAdI) | ✅ | ✅ | ✅ | ✅ |
| C0 Developer Extensibility | ❌ | ❌ | ✅ | ✅ | ✅ |

> Source: https://community.sap.com/t5/technology-q-a/extend-standard-s4hana-app-using-rap-bo-extension/qaq-p/12670571
> **RAP BO Behavior Extension chỉ available từ S/4HANA On-Premise 2022 (ABAP 7.57).**

---

## 5. Step-by-Step: Field Extension (thêm custom field)

**Use case:** Thêm field ZZ_CUSTOM_REGION vào entity Purchase Requisition Item.

### Step 1: Extend DB table (Append Structure)

```abap
" Tạo Append Structure trong ADT hoặc SE11
@AbapCatalog.appendStructureName: 'ZS_PR_ITEM_EXT'
extend type EBAN with ZS_PR_ITEM_EXT {
  " Custom field với ZZ prefix (mandatory cho standard extension)
  zz_custom_region : land1;          " ← sử dụng standard domain nếu có
  zz_risk_level    : /dmo/risk_level;
}
```

> ⚠️ **ZZ prefix convention**: SAP khuyến nghị dùng `ZZ_` cho extension fields trong standard objects.
> Fields của bạn sẽ tự động có trong DB table sau khi activate.

### Step 2: Extend CDS Interface View

```cds
// Extend standard interface CDS view
// Target: cùng tên với standard interface view (không phải projection)
extend view entity I_PurchaseReqItem with ZX_I_PR_ITEM_EXT {
  // Map DB extension field → CDS field name
  Eban.zz_custom_region as ZzCustomRegion,
  Eban.zz_risk_level    as ZzRiskLevel
}
```

> ℹ️ `extend view entity` (không phải `extend view`) — dùng cho CDS View Entities (RAP).
> Tên file extension: thường dùng prefix `ZX_` để phân biệt.

### Step 3: Extend BDEF (field characteristics)

```abap
" BDEF Extension file (New → Other → BDEF Extension trong ADT)
extension using interface I_PurchaseReqItemTP    " ← transactional interface view
  implementation in class zbp_x_i_pr_item unique;

extend behavior for PurchaseReqItem {
  " Khai báo field mới trong behavior extension
  field ( mandatory : create ) ZzCustomRegion;   " ← mandatory on create
  field ( readonly )           ZzRiskLevel;      " ← read-only

  " Mapping extension fields (nếu DB field name khác CDS field name)
  mapping for EBAN extensible corresponding
  {
    ZzCustomRegion = zz_custom_region;
    ZzRiskLevel    = zz_risk_level;
  }
}
```

### Step 4: Metadata Extension (hiển thị trên Fiori)

```cds
// Extend metadata extension để field xuất hiện trên UI
@Metadata.layer: #CUSTOMER
annotate view I_PurchaseReqItem with {
  @UI: {
    lineItem:       [{ position: 200, importance: #HIGH }],
    identification: [{ position: 200 }],
    selectionField: [{ position: 200 }]
  }
  @EndUserText.label: 'Region'
  ZzCustomRegion;

  @UI.hidden: true
  ZzRiskLevel;
}
```

---

## 6. Step-by-Step: Behavior Extension (validation/determination)

**Use case:** Thêm validation kiểm tra `ZzCustomRegion` khi save Purchase Requisition.

### BDEF Extension — khai báo validation

```abap
" Prerequisite: Standard BDEF phải có "with validations on save" trong header
" (đã kiểm tra ở Step 3 trên)

extension using interface I_PurchaseReqItemTP
  implementation in class zbp_x_i_pr_item unique;

" Extend CÙNG BDEF extension file với field extension (hoặc tạo riêng)
extend behavior for PurchaseReqItem {

  " Thêm validation
  validation validateCustomRegion on save {
    field ZzCustomRegion;    " ← fire khi ZzCustomRegion thay đổi
    create;                  " ← và khi tạo mới
  }

  " Thêm determination (nếu cần)
  determination setDefaultRegion on modify {
    create;                  " ← fire khi tạo mới
  }
}
```

> ⚠️ **Projection extension**: Validation khai báo ở interface extension tự động available ở projection.
> Không cần khai báo lại trong projection BDEF extension —
> nhưng phải kiểm tra projection có `extensible` keyword không để Fiori pick up.

### Behavior Implementation Class

```abap
" Extension implementation class
" (không phải behavior pool của standard — đây là class riêng của bạn)
CLASS zbp_x_i_pr_item DEFINITION
  PUBLIC ABSTRACT FINAL
  FOR BEHAVIOR OF i_purchasereqitemtp.
ENDCLASS.

CLASS zbp_x_i_pr_item IMPLEMENTATION.
ENDCLASS.

" Local handler
CLASS lhc_purchasereqitem DEFINITION
  INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS:
      validateCustomRegion FOR VALIDATE ON SAVE
        IMPORTING keys FOR i_purchasereqitemtp~validateCustomRegion,

      setDefaultRegion FOR DETERMINE ON MODIFY
        IMPORTING keys FOR i_purchasereqitemtp~setDefaultRegion.
ENDCLASS.

CLASS lhc_purchasereqitem IMPLEMENTATION.

  METHOD validateCustomRegion.
    " ✅ READ standard BO IN LOCAL MODE — same pattern as custom BO
    READ ENTITIES OF i_purchasereqitemtp IN LOCAL MODE
      ENTITY PurchaseReqItem
      FIELDS ( PurchaseRequisitionItem ZzCustomRegion )
      WITH CORRESPONDING #( keys )
      RESULT DATA(lt_items)
      FAILED DATA(read_failed).

    LOOP AT lt_items INTO DATA(ls_item).
      " Clear state area
      APPEND VALUE #(
        %tky        = ls_item-%tky
        %state_area = 'Z_VALIDATE_REGION'
      ) TO reported-purchasereqitem.

      " Validate custom field
      IF ls_item-ZzCustomRegion IS INITIAL.
        APPEND VALUE #( %tky = ls_item-%tky ) TO failed-purchasereqitem.
        APPEND VALUE #(
          %tky               = ls_item-%tky
          %state_area        = 'Z_VALIDATE_REGION'
          %element-ZzCustomRegion = if_abap_behv=>mk-on
          %msg = new_message_with_text(
            severity = if_abap_behv_message=>severity-error
            text     = 'Custom Region is required for procurement items' )
        ) TO reported-purchasereqitem.
      ELSE.
        " Check region exists in Z-table
        SELECT SINGLE FROM zregion_config
          FIELDS region_id
          WHERE region_id = @ls_item-ZzCustomRegion
          INTO @DATA(lv_region).
        IF sy-subrc <> 0.
          APPEND VALUE #( %tky = ls_item-%tky ) TO failed-purchasereqitem.
          APPEND VALUE #(
            %tky               = ls_item-%tky
            %state_area        = 'Z_VALIDATE_REGION'
            %element-ZzCustomRegion = if_abap_behv=>mk-on
            %msg = new_message_with_text(
              severity = if_abap_behv_message=>severity-error
              text     = |Region { ls_item-ZzCustomRegion } does not exist| )
          ) TO reported-purchasereqitem.
        ENDIF.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

  METHOD setDefaultRegion.
    READ ENTITIES OF i_purchasereqitemtp IN LOCAL MODE
      ENTITY PurchaseReqItem
      FIELDS ( PurchaseRequisitionItem Plant ZzCustomRegion )
      WITH CORRESPONDING #( keys )
      RESULT DATA(lt_items).

    " Set default region based on Plant if not filled
    DATA lt_update TYPE TABLE FOR UPDATE i_purchasereqitemtp\\PurchaseReqItem.
    LOOP AT lt_items INTO DATA(ls_item).
      CHECK ls_item-ZzCustomRegion IS INITIAL.
      " Derive region from plant
      SELECT SINGLE zz_region FROM t001w
        WHERE werks = @ls_item-Plant
        INTO @DATA(lv_default_region).
      IF sy-subrc = 0.
        APPEND VALUE #(
          %tky           = ls_item-%tky
          ZzCustomRegion = lv_default_region
        ) TO lt_update.
      ENDIF.
    ENDLOOP.

    CHECK lt_update IS NOT INITIAL.
    MODIFY ENTITIES OF i_purchasereqitemtp IN LOCAL MODE
      ENTITY PurchaseReqItem
      UPDATE FIELDS ( ZzCustomRegion )
      WITH lt_update
      REPORTED DATA(reported_inner).
    reported = CORRESPONDING #( DEEP reported_inner ).
  ENDMETHOD.

ENDCLASS.
```

### Thêm vào Prepare (draft-enabled standard BOs)

```abap
" Nếu standard BO là draft-enabled và Prepare action có 'extensible':
" Không cần khai báo trong Prepare của extension —
" validation/determination trong extension tự động được added vào Prepare
" NẾU standard BDEF có:
"   draft determine action Prepare extensible { ... }
"
" ⚠️ Verify trong standard BDEF — nếu Prepare không extensible →
"    validation của bạn sẽ KHÔNG fire khi user nhấn Save trong draft app
```

---

## 7. Step-by-Step: Action Extension (thêm custom action)

**Use case:** Thêm action "Approve Custom" vào Purchase Requisition.

```abap
" Prerequisite: Standard BDEF entity body phải có "extensible" keyword
" Verify: define behavior for I_PurchaseRequisitionTP ... extensible { ... }

extension using interface I_PurchaseReqTP
  implementation in class zbp_x_i_purchasereq unique;

extend behavior for PurchaseRequisition {
  " Action trả về $self (current instance sau action)
  action approveCustom result [1] $self;

  " Hoặc action với parameter
  action rejectWithReason
    parameter ZS_PurchaseReq_RejectParam   " ← Z-structure cho parameters
    result [1] $self;
}
```

```abap
" Implementation
CLASS lhc_purchasereq DEFINITION
  INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS:
      approveCustom FOR MODIFY
        IMPORTING keys FOR ACTION i_purchasereqtp~approveCustom RESULT result,

      rejectWithReason FOR MODIFY
        IMPORTING keys FOR ACTION i_purchasereqtp~rejectWithReason RESULT result.
ENDCLASS.

CLASS lhc_purchasereq IMPLEMENTATION.

  METHOD approveCustom.
    " Read current state
    READ ENTITIES OF i_purchasereqtp IN LOCAL MODE
      ENTITY PurchaseRequisition
      FIELDS ( PurchaseRequisition PurchaseRequisitionType ZzApprovalStatus )
      WITH CORRESPONDING #( keys )
      RESULT DATA(lt_prs).

    " Update custom approval status field
    MODIFY ENTITIES OF i_purchasereqtp IN LOCAL MODE
      ENTITY PurchaseRequisition
      UPDATE FIELDS ( ZzApprovalStatus )
      WITH VALUE #( FOR pr IN lt_prs
                    ( %tky           = pr-%tky
                      ZzApprovalStatus = 'A' ) )   " A = Approved
      REPORTED DATA(reported_mod).
    reported = CORRESPONDING #( DEEP reported_mod ).

    " Build result
    READ ENTITIES OF i_purchasereqtp IN LOCAL MODE
      ENTITY PurchaseRequisition ALL FIELDS
      WITH CORRESPONDING #( keys )
      RESULT DATA(lt_result).

    result = VALUE #( FOR r IN lt_result
                      ( %tky = r-%tky %param = r ) ).
  ENDMETHOD.

  METHOD rejectWithReason.
    LOOP AT keys INTO DATA(ls_key).
      DATA(lv_reason) = ls_key-%param-RejectionReason.
      " ... custom reject logic ...
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.
```

---

## 8. Step-by-Step: Node Extension (thêm child entity)

**Use case:** Thêm Attachment entity vào Purchase Requisition.

> ⚠️ **Node Extension phức tạp nhất** — cần standard BO cho phép node extensibility.
> Check trong standard BDEF: entity body `extensible` + association target extensible.

### Tạo DB table + CDS + BDEF cho extension node

```abap
" Step 1: Tạo DB table cho child entity mới
@EndUserText.label: 'PR Item Attachment'
define table zpritm_attach {
  key client     : abap.clnt not null;
  key pr_item_id : ebeln not null;    " FK to parent
  key attach_id  : sysuuid_x16 not null;
  file_name      : string;
  mime_type      : string;
  content        : rawstring;
  @Semantics.systemDateTime.lastChangedAt: true
  last_changed   : utclong;
}
```

```cds
// Step 2: CDS View Entity cho child node
define view entity ZI_PrItemAttachment
  as select from zpritm_attach
{
  key pr_item_id  as PrItemId,
  key attach_id   as AttachId,
      file_name   as FileName,
      mime_type   as MimeType,
      last_changed as LastChanged
}
```

```abap
" Step 3: BDEF Extension — define new child node + behavior-enable association
extension using interface I_PurchaseReqItemTP
  implementation in class zbp_x_i_pritem_node unique;

" Extend parent to add association to new child
extend behavior for PurchaseReqItem {
  " Behavior-enable association to new child node
  association _ZAttachments { create; with draft; }
}

" Define behavior for the new child entity
define behavior for ZI_PrItemAttachment alias PrAttachment
  persistent table zpritm_attach
  draft table zpritm_attach_d      " ← if parent is draft-enabled
  lock dependent by _PurchaseReqItem
  authorization dependent by _PurchaseReqItem
  etag dependent by _PurchaseReqItem
{
  field ( readonly ) PrItemId, AttachId;
  field ( mandatory ) FileName, MimeType;

  update;
  delete;

  " No create here — created via parent association _ZAttachments
}
```

---

## 9. BAdI Extension Pattern (alternative)

Khi standard BO expose BAdI definition — **đây là cách đơn giản nhất**, không cần BDEF extension.

```abap
" Step 1: Tìm BAdI trong ADT
" Ctrl+Shift+A → search "BADI_*" hoặc xem documentation của standard app
" e.g. BADI_PR_ITEM_VALIDATION cho Purchase Requisition Item

" Step 2: Tạo BAdI Implementation
CLASS zcl_badi_pr_validation DEFINITION
  PUBLIC FINAL
  CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES zbadi_pr_item_validation.   " ← interface của BAdI
ENDCLASS.

CLASS zcl_badi_pr_validation IMPLEMENTATION.

  METHOD zbadi_pr_item_validation~validate.
    " BAdI method parameters depend on BAdI definition
    " Thường nhận entity data và returning failed/reported
    LOOP AT it_pr_items INTO DATA(ls_item).
      IF ls_item-ZzCustomRegion IS INITIAL.
        APPEND VALUE #(
          purchase_req_item = ls_item-PurchaseRequisitionItem
          message           = 'Region required'
          severity          = 'E'
        ) TO et_messages.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.

" Step 3: Register BAdI implementation trong Enhancement Spot
" ADT → Enhancement Spot của BAdI → New Implementation → assign class above
```

---

## 10. EML trong Extension — Đọc/Modify standard BO

Trong extension, dùng EML với **tên của standard interface BO** — không phải tên custom view.

```abap
" ✅ CORRECT — dùng standard BO name trong EML
READ ENTITIES OF i_purchasereqitemtp IN LOCAL MODE   " ← standard BO interface name
  ENTITY PurchaseReqItem
  FIELDS ( PurchaseRequisitionItem Plant ZzCustomRegion )
  WITH CORRESPONDING #( keys )
  RESULT DATA(lt_items).

" ✅ CORRECT — MODIFY standard BO IN LOCAL MODE
MODIFY ENTITIES OF i_purchasereqitemtp IN LOCAL MODE
  ENTITY PurchaseReqItem
  UPDATE FIELDS ( ZzCustomRegion )
  WITH VALUE #( ( %tky = ls_item-%tky ZzCustomRegion = 'EU' ) )
  REPORTED DATA(reported).

" ❌ WRONG — không dùng custom extension view name
READ ENTITIES OF zx_i_pr_item_ext IN LOCAL MODE ...   " ← extension view, không phải BO
```

### Đọc child entity của standard BO

```abap
" Đọc Schedule Lines của PR Item (child entity của standard BO)
READ ENTITIES OF i_purchasereqitemtp IN LOCAL MODE
  ENTITY PurchaseReqItem
  BY \_ScheduleLine                " ← standard association name (xem BDEF)
  FIELDS ( ScheduleLine DeliveryDate OrderQuantity )
  WITH CORRESPONDING #( keys )
  RESULT DATA(lt_schedule_lines).
```

### EML với %tky trong extension (draft-enabled standard BO)

```abap
" Standard BO draft-enabled → luôn dùng %tky (không dùng %key)
MODIFY ENTITIES OF i_purchasereqitemtp IN LOCAL MODE
  ENTITY PurchaseReqItem
  UPDATE FIELDS ( ZzCustomRegion )
  WITH VALUE #( FOR key IN keys
                ( %tky           = key-%tky   " ← %tky bao gồm %is_draft
                  ZzCustomRegion = lv_region ) )
  REPORTED DATA(reported).
```

---

## 11. Package Setup cho Developer Extensibility

Trên On-Premise S/4HANA, cần package riêng cho extension objects:

```
Recommended package structure:
│
├── ZEXT_SOFT_COMP          ← Software Component (product-level)
│   └── ZEXT_MAIN_PKG       ← Main package (structure package)
│       ├── ZEXT_DATA_PKG   ← DB tables, structures (Data tier)
│       ├── ZEXT_CDS_PKG    ← CDS Views, Metadata Extensions (CDS tier)
│       ├── ZEXT_BEH_PKG    ← BDEF Extensions, Implementation Classes (Behavior tier)
│       └── ZEXT_SRV_PKG    ← Service definitions (Service tier)
```

```
Package properties cho extension objects:
  - Package Type: Development Package
  - Application Component: phù hợp với standard BO (e.g. MM-PUR cho PR)
  - Software Component: Z_CUST hoặc custom software component

⚠️ KHÔNG tạo extension objects trong $TMP (local workbench) —
   Extension objects phải transportable để đến Production.
```

---

## 12. Anti-Patterns

### ❌ AP-EXT-01: Modify standard BDEF/CDS trực tiếp

```
" ❌ NEVER modify SAP standard objects directly
" SE80/ADT → open I_PurchaseRequisitionTP → Add validation → WRONG

" ✅ CORRECT: Tạo BDEF Extension riêng biệt
extension using interface I_PurchaseRequisitionTP
  implementation in class zbp_x_my_ext unique;
extend behavior for PurchaseRequisition { ... }
```

---

### ❌ AP-EXT-02: Extend khi standard BDEF không có `extensible`

```abap
" Situation: Standard BDEF không có extensible keyword
" ❌ WRONG — tạo BDEF extension nhưng standard BDEF không allow
extension using interface I_SomeNonExtensibleBO ...
extend behavior for SomeEntity {
  validation myValidation on save { create; }   " ← activation error!
}

" ✅ CORRECT — check trước khi bắt đầu (Section 3)
" Nếu không extensible → xem xét BAdI nếu có, hoặc
" liên hệ SAP để request extensibility enablement
```

---

### ❌ AP-EXT-03: Dùng SELECT thay vì READ ENTITIES trong extension validation

```abap
" ❌ WRONG — SELECT không thấy buffer changes
METHOD validateCustomRegion.
  LOOP AT keys INTO DATA(ls_key).
    SELECT SINGLE zz_custom_region FROM eban
      WHERE banfn = @ls_key-PurchaseRequisition
      INTO @DATA(lv_region).
    " ls_region có thể cũ!
  ENDLOOP.
ENDMETHOD.

" ✅ CORRECT
METHOD validateCustomRegion.
  READ ENTITIES OF i_purchasereqitemtp IN LOCAL MODE
    ENTITY PurchaseReqItem
    FIELDS ( ZzCustomRegion )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_items).
  " lt_items phản ánh buffer state
ENDMETHOD.
```

---

### ❌ AP-EXT-04: Dùng wrong BO name trong EML

```abap
" ❌ WRONG — extension view name không phải BO transactional interface
READ ENTITIES OF zx_i_pr_item_ext ...     " ← extension view
MODIFY ENTITIES OF z_my_ext_view ...      " ← custom view

" ✅ CORRECT — dùng standard interface BO name
READ ENTITIES OF i_purchasereqitemtp ...  " ← standard BO
```

---

### ❌ AP-EXT-05: Extension objects trong $TMP package

```
" ❌ WRONG
Package: $TMP (local workbench)
→ Không transportable → mất sau system refresh → sẽ không có trong Production!

" ✅ CORRECT
Package: ZEXT_BEH_PKG (custom development package)
→ Transportable via CTS → available in QA và Production
```

---

### ❌ AP-EXT-06: Thêm validation nhưng không có trong Prepare

```abap
" Situation: Standard BO là draft-enabled

" ❌ WRONG — validation extension khai báo nhưng Prepare của standard
" không có extensible → validation không fire khi user nhấn Save
extend behavior for PurchaseReqItem {
  validation validateCustomRegion on save { create; field ZzCustomRegion; }
}
" → check standard BDEF: draft determine action Prepare extensible { ... }
" → nếu KHÔNG có extensible trong Prepare → validation không fire on save!

" ✅ VERIFY: Standard BDEF Prepare có extensible không
" draft determine action Prepare extensible {   " ← phải có extensible
"   validation validateSomething;
" }
" Nếu không có → report issue / SAP Note / BAdI alternative
```

---

## 13. Checklist Before Go-Live

```
PRE-DEVELOPMENT:
[ ] Fiori Apps Library → confirm extensibility type supported
[ ] Standard BDEF: keyword "extensible" present ở header VÀ entity body
[ ] "with validations on save" / "with determinations on modify" present nếu cần
[ ] DB table enhancement category: "Can Be Enhanced"
[ ] Environment: S/4HANA On-Prem 2022+ hoặc Cloud (ABAP 7.57+)
[ ] Package structure: transportable packages setup, KHÔNG dùng $TMP

DEVELOPMENT:
[ ] Append Structure: ZZ prefix cho tất cả custom fields
[ ] extend view entity (không phải extend view): dùng đúng syntax
[ ] BDEF Extension: "extension using interface" (không phải "extend behavior" standalone)
[ ] Implementation class: kế thừa cl_abap_behavior_handler
[ ] EML dùng standard BO name (I_*TP), không phải extension view name
[ ] READ ENTITIES IN LOCAL MODE trong validation (không SELECT từ DB)
[ ] %tky dùng trong EML (không %key) nếu BO draft-enabled
[ ] %state_area unique per validation method
[ ] Metadata Extension: @Metadata.layer: #CUSTOMER (không #CORE)

TESTING:
[ ] Test từ standard Fiori app (không phải direct OData call) — qua projection
[ ] Test CREATE + UPDATE + DELETE cho validation behavior
[ ] Test draft: Prepare fires validation khi user nhấn Save
[ ] Transport: extension objects nằm trong transport request đúng
[ ] Regression: standard BO behavior không bị ảnh hưởng
```

---

## 14. Sources

| Source | URL | Nội dung |
|---|---|---|
| SAP Help — RAP Extensibility Overview | https://help.sap.com/docs/abap-cloud/abap-rap/extend | Official overview, all extension types |
| SAP Help — BDEF Extension Syntax | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_define_beh_extend.htm | Extension entity behavior definition |
| SAP Help — Extensibility Enabling (Base) | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/ABENBDL_EXT_ENABL_EXT_BASE.html | `extensible` keyword, with validations/determinations |
| SAP Community — C0 Dev Extensibility BDEF | https://community.sap.com/t5/technology-blog-posts-by-sap/c0-developer-extensibility-for-cds-behavior-definitions/ba-p/13530605 | C0 extensibility for BDEFs (by SAP) |
| SAP Community — Behavior Extension example | https://community.sap.com/t5/technology-blog-posts-by-members/behavior-extension-an-example-of-developer-extensibility/ba-p/13573867 | Real example: I_ReservationDocumentTP extension |
| SAP Community — RAP Extension basic | https://community.sap.com/t5/application-development-and-automation-blog-posts/rap-extension-for-manage-scenario-in-sap-abap/ba-p/13986068 | Field + behavior extension step-by-step |
| SAP Community — RAP Extension advanced | https://community.sap.com/t5/application-development-and-automation-blog-posts/rap-extension-advance-level-for-manage-scenario-in-sap-abap/ba-p/14049827 | Node extension, advanced patterns |
| SAP Community — RAP Validation Extension guide | https://community.sap.com/t5/technology-blog-posts-by-members/rap-validation-extension-in-sap-step-by-step-guide/ba-p/14370511 | Step-by-step validation extension (Apr 2026) |
| SAP Community — Extend standard S/4 app | https://community.sap.com/t5/technology-q-a/extend-standard-s4hana-app-using-rap-bo-extension/qaq-p/12670571 | Version availability (2022+ On-Prem) |
| Sachin Artani — Check extensibility options | https://sachinartani.com/blog/check-extensibility-options-for-standard-rap-app | Fiori Apps Library + BDEF check guide |
| SAP Fiori Apps Library | https://fioriappslibrary.hana.ondemand.com | Check extensibility options per app |
| SAP Help — determine action extensible | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_determine_action.htm | Prepare extensible, draft determine action |