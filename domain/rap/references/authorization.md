# RAP — Authorization & Feature Control

Hướng dẫn đầy đủ về phân quyền trong RAP: global vs instance authorization,
authorization control vs feature control, khai báo trong BDEF, implement 4 method
(`get_global_authorizations`, `get_instance_authorizations`, `get_global_features`,
`get_instance_features`), `AUTHORITY-CHECK` trong ABAP Cloud, authorization context /
privileged mode, và precheck. Code trong file này được đối chiếu trực tiếp với
**ABAP Flight Reference Scenario — branch `ABAP-platform-cloud`** (SAP-samples).

> **Đọc file này khi:** câu hỏi về `authorization master`, `authorization dependent by`,
> `get_global_authorizations`, `get_instance_authorizations`, `get_global_features`,
> `get_instance_features`, `%global`, `if_abap_behv=>auth-allowed`, `fc-o-enabled`,
> `fc-f-read_only`, `AUTHORITY-CHECK` trong RAP, `authorization context`, privileged mode,
> `( authorization : update )` trên action/association, precheck, feature control,
> action bị "xám" (disabled) trên UI, field readonly động, phân quyền theo instance.

---

## Table of Contents

1. [Overview — Mô hình phân quyền RAP](#1-overview--mô-hình-phân-quyền-rap)
2. [Khai báo trong BDEF](#2-khai-báo-trong-bdef)
3. [Global Authorization — `get_global_authorizations`](#3-global-authorization--get_global_authorizations)
4. [Instance Authorization — `get_instance_authorizations`](#4-instance-authorization--get_instance_authorizations)
5. [Feature Control — global vs instance features](#5-feature-control--global-vs-instance-features)
6. [Authorization Check thật — `AUTHORITY-CHECK` trong ABAP Cloud](#6-authorization-check-thật--authority-check-trong-abap-cloud)
7. [Authorization Context & Privileged Mode](#7-authorization-context--privileged-mode)
8. [Precheck — phân quyền sớm](#8-precheck--phân-quyền-sớm)
9. [Projection layer & phân quyền chuỗi các phase](#9-projection-layer--phân-quyền-chuỗi-các-phase)
10. [Environment Differences — ECC / On-Prem / Cloud](#10-environment-differences--ecc--on-prem--cloud)
11. [Anti-Patterns](#11-anti-patterns)
12. [Debug Checklist](#12-debug-checklist)
13. [Sources](#13-sources)

---

## 1. Overview — Mô hình phân quyền RAP

RAP tách phân quyền thành **hai trục độc lập** — đừng nhầm lẫn hai trục này vì chúng
được gọi ở thời điểm khác nhau và trả về structure khác nhau:

```
┌───────────────────────────────────────────────────────────────────┐
│  TRỤC 1 — AUTHORIZATION CONTROL  (người dùng CÓ ĐƯỢC PHÉP không?)   │
│                                                                     │
│  get_global_authorizations   → type-level: user có được create /   │
│                                 update / delete BO này KHÔNG?       │
│  get_instance_authorizations → instance-level: user có được sửa    │
│                                 CHÍNH instance NÀY không?           │
│  Kết quả: if_abap_behv=>auth-allowed / auth-unauthorized           │
│  Vi phạm → operation bị TỪ CHỐI + message lỗi                      │
├───────────────────────────────────────────────────────────────────┤
│  TRỤC 2 — FEATURE CONTROL  (operation/field CÓ KHẢ DỤNG không?)     │
│                                                                     │
│  get_global_features    → static: action luôn ẩn/hiện theo cấu hình│
│  get_instance_features  → dynamic: action/field enable theo STATE  │
│                            của instance (vd: đã accepted → khoá)   │
│  Kết quả: fc-o-enabled / fc-o-disabled  (operation)                │
│           fc-f-read_only / fc-f-mandatory / fc-f-unrestricted (field)│
│  Vi phạm: nút bị "xám" trên Fiori, field readonly                  │
└───────────────────────────────────────────────────────────────────┘
```

**Phân biệt cốt lõi:**

| | Authorization Control | Feature Control |
|---|---|---|
| Câu hỏi | "User này CÓ QUYỀN không?" | "Thao tác này CÓ KHẢ DỤNG lúc này không?" |
| Dựa trên | Vai trò / authorization object của user | Trạng thái nghiệp vụ của instance |
| Global method | `get_global_authorizations` | `get_global_features` |
| Instance method | `get_instance_authorizations` | `get_instance_features` |
| Fiori thể hiện | Lỗi "Not authorized" khi thao tác | Nút xám, field khoá |
| Bỏ qua khi | privileged mode | không tự bỏ qua |

⚠️ **Sai lầm phổ biến nhất**: dùng feature control để làm bảo mật. Feature control chỉ
là UX (ẩn nút cho gọn) — user vẫn có thể gọi thẳng OData. **Bảo mật thực sự phải nằm ở
authorization control** (và, với ghi dữ liệu, ở validation trong save sequence).

**Thứ tự gọi trong runtime** (quan trọng để hiểu khi nào code chạy):

```
1. Global authorization  → chặn sớm ở type level (user không có role → cấm luôn)
2. Instance features      → quyết định nút nào enable trên từng record
3. Instance authorization → khi user thực sự update/delete một instance cụ thể
4. (Precheck)             → nếu có, chạy trước cả buffer modification
```

---

## 2. Khai báo trong BDEF

Phân quyền bắt đầu từ khai báo trong Behavior Definition. Có 3 tầng khai báo.

### 2.1 Root-level: `authorization master`

Khai báo ngay sau `define behavior for ...`:

```abap
" Managed root BO — kết hợp cả global và instance authorization
define behavior for Z_R_Travel alias Travel
implementation in class zbp_r_travel unique
persistent table ztravel
lock master
authorization master ( global, instance )   " ✅ cả hai trục cùng lúc
{
  ...
}
```

Các giá trị hợp lệ của `authorization master`:

| Khai báo | Ý nghĩa | Method cần implement |
|---|---|---|
| `authorization master ( global )` | Chỉ check type-level | `get_global_authorizations` |
| `authorization master ( instance )` | Chỉ check per-instance | `get_instance_authorizations` |
| `authorization master ( global, instance )` | Cả hai | Cả hai method |
| `authorization master ( none )` | Không check (⚠️ chỉ dùng khi thực sự public) | không cần |

```abap
" ❌ WRONG — khai báo global nhưng quên implement method
authorization master ( global )
" → runtime: framework gọi get_global_authorizations nhưng method rỗng/thiếu
"   → mọi thao tác bị coi là unauthorized hoặc trả về không nhất quán

" ✅ CORRECT — khai báo đến đâu implement đến đó
authorization master ( global )   " + implement get_global_authorizations đầy đủ
```

### 2.2 Child entity: `authorization dependent by`

Child (booking, item...) trong composition **thường không tự phân quyền** mà thừa hưởng
từ root qua association:

```abap
" Child entity thừa quyền từ root Travel qua association _Travel
define behavior for Z_R_Booking alias Booking
implementation in class zbp_r_booking unique
persistent table zbooking
lock dependent by _Travel
authorization dependent by _Travel   " ✅ quyền của booking = quyền của travel cha
{
  update;
  delete;
  association _Travel;
  ...
}
```

`authorization dependent by _Travel` nghĩa là: khi user thao tác trên Booking, framework
đánh giá quyền dựa trên Travel cha (qua association `_Travel`). Không cần viết
`get_*_authorizations` cho Booking.

```abap
" ❌ WRONG — child khai báo authorization master rồi để rỗng
define behavior for Z_R_Booking alias Booking
authorization master ( instance )    " phải tự implement, dễ lệch với root
{ ... }

" ✅ CORRECT — child dùng dependent by, thừa quyền từ root một cách nhất quán
authorization dependent by _Travel
```

### 2.3 Per-operation: `( authorization : <op> )`

Gắn yêu cầu phân quyền cho từng action / association / determine action. Đây là cách
nói "action này cần quyền như thể một update":

```abap
define behavior for Z_R_Travel alias Travel
authorization master ( global, instance )
{
  create;
  update;
  delete;

  " action cần quyền update → khi user gọi acceptTravel, framework check quyền update
  action ( features : instance, authorization : update ) acceptTravel result [1] $self;
  action ( features : instance, authorization : update ) rejectTravel result [1] $self;

  " association: tạo booking con cũng cần quyền update trên travel
  association _Booking { create ( features : instance, authorization : update ); }

  " determine action gọi validation cũng gắn quyền update
  determine action ( authorization : update ) validateDateRange { validation validateDates; }
}
```

Nếu **không** khai báo `authorization : ...` trên action, action đó không kích hoạt
instance authorization check riêng — nó chạy theo mặc định của framework. Với action làm
thay đổi dữ liệu, hầu như luôn nên gắn `authorization : update`.

```abap
" ❌ WRONG — action ghi dữ liệu nhưng không gắn authorization
action ( features : instance ) acceptTravel result [1] $self;
" → get_instance_authorizations có thể không được gọi cho action này

" ✅ CORRECT
action ( features : instance, authorization : update ) acceptTravel result [1] $self;
```

### 2.4 Feature control declaration: `( features : ... )`

Khai báo rằng field/action/association được điều khiển khả dụng động:

```abap
{
  field ( features : instance ) BookingFee;          " field readonly động theo instance
  action ( features : instance ) acceptTravel ...;   " action enable/disable động
  action ( features : global   ) resetAllCounters;   " action ẩn/hiện tĩnh (global)
}
```

- `features : instance` → framework gọi `get_instance_features` cho từng record.
- `features : global` → framework gọi `get_global_features` một lần.

---

## 3. Global Authorization — `get_global_authorizations`

**Mục đích**: chặn ở cấp type. Ví dụ "user thuộc role đọc-only thì không được create/update/delete
bất kỳ Travel nào". Chạy sớm, không cần đọc instance nào.

Signature (verified — flight reference scenario, branch cloud):

```abap
METHODS get_global_authorizations FOR GLOBAL AUTHORIZATION
  IMPORTING REQUEST requested_authorizations FOR Travel
  RESULT result.
```

Pattern chuẩn — đọc `requested_authorizations`, set `result`, và append message vào
`reported` với `%global = if_abap_behv=>mk-on`:

```abap
METHOD get_global_authorizations.
  " create ---------------------------------------------------------
  IF requested_authorizations-%create EQ if_abap_behv=>mk-on.
    IF is_create_granted( ) = abap_true.
      result-%create = if_abap_behv=>auth-allowed.
    ELSE.
      result-%create = if_abap_behv=>auth-unauthorized.
      APPEND VALUE #( %msg    = NEW zcm_travel(
                                    textid   = zcm_travel=>not_authorized
                                    severity = if_abap_behv_message=>severity-error )
                      %global = if_abap_behv=>mk-on ) TO reported-travel.
    ENDIF.
  ENDIF.

  " update (Edit của draft được coi như update) --------------------
  IF requested_authorizations-%update      = if_abap_behv=>mk-on OR
     requested_authorizations-%action-Edit = if_abap_behv=>mk-on.
    IF is_update_granted( ) = abap_true.
      result-%update      = if_abap_behv=>auth-allowed.
      result-%action-Edit = if_abap_behv=>auth-allowed.
    ELSE.
      result-%update      = if_abap_behv=>auth-unauthorized.
      result-%action-Edit = if_abap_behv=>auth-unauthorized.
      APPEND VALUE #( %msg    = NEW zcm_travel(
                                    textid   = zcm_travel=>not_authorized
                                    severity = if_abap_behv_message=>severity-error )
                      %global = if_abap_behv=>mk-on ) TO reported-travel.
    ENDIF.
  ENDIF.

  " delete ---------------------------------------------------------
  IF requested_authorizations-%delete = if_abap_behv=>mk-on.
    IF is_delete_granted( ) = abap_true.
      result-%delete = if_abap_behv=>auth-allowed.
    ELSE.
      result-%delete = if_abap_behv=>auth-unauthorized.
      APPEND VALUE #( %msg    = NEW zcm_travel(
                                    textid   = zcm_travel=>not_authorized
                                    severity = if_abap_behv_message=>severity-error )
                      %global = if_abap_behv=>mk-on ) TO reported-travel.
    ENDIF.
  ENDIF.
ENDMETHOD.
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/draft/#dmo#bp_travel_d.clas.locals_imp.abap` — adapted sang namespace `Z_`.

> **Về message class `zcm_travel`:** đây là class do bạn tự tạo, phải implement interface
> `if_abap_behv_message` (thường qua kế thừa `cx_static_check` + implement interface đó)
> thì mới gán được vào `%msg`. Reference scenario dùng `/dmo/cm_flight_messages` cho vai
> trò này. Ngoài ra, trong behavior pool còn có helper sẵn `new_message_with_text(
> severity = ... text = ... )` để tạo message nhanh từ text tự do (dùng ở Section 5.3).
> Cả hai cách (`NEW zcm_...( )` và `new_message_with_text( )`) đều verified trong SAP-samples.

**Điểm quan trọng:**

- Chỉ set `result-%create/%update/%delete` cho những gì được **request** (`requested_authorizations`).
  Framework hỏi cái gì thì trả lời cái đó — không cần set tất cả.
- Với draft-enabled BO, action `Edit` được xử lý **như update** (`%action-Edit`).
- Message dùng `%global = if_abap_behv=>mk-on` (không phải `%tky`) vì đây là lỗi cấp type,
  không gắn với instance cụ thể.
- Trong global auth **không** đọc instance nào — không `READ ENTITIES`. Nếu cần dữ liệu
  instance để quyết định → đó là **instance** authorization.

```abap
" ❌ WRONG — set tất cả result kể cả cái không được request
result-%create = if_abap_behv=>auth-allowed.
result-%update = if_abap_behv=>auth-allowed.   " user không request %update
result-%delete = if_abap_behv=>auth-allowed.
" → dư thừa, và dễ trả allowed nhầm cho op chưa kiểm tra

" ✅ CORRECT — chỉ trả lời cái được request (xem pattern IF ở trên)
```

---

## 4. Instance Authorization — `get_instance_authorizations`

**Mục đích**: phân quyền theo **từng instance**. Ví dụ "user chỉ được sửa Travel thuộc
agency ở quốc gia mình quản lý". Phải đọc instance để biết thuộc tính (agency, country...).

Signature (verified):

```abap
METHODS get_instance_authorizations FOR INSTANCE AUTHORIZATION
  IMPORTING keys REQUEST requested_authorizations FOR Travel
  RESULT result.
```

Pattern chuẩn — **luôn `READ ENTITIES ... IN LOCAL MODE`** để lấy thuộc tính instance từ
transactional buffer, rồi (nếu cần before-image) SELECT từ active table, và phân biệt
**instance active (đã persist)** với **instance draft/mới tạo**:

```abap
METHOD get_instance_authorizations.
  DATA: update_requested TYPE abap_bool,
        delete_requested TYPE abap_bool,
        update_granted   TYPE abap_bool,
        delete_granted   TYPE abap_bool.

  " (1) Đọc field cần cho auth từ transactional buffer — KHÔNG SELECT DB trực tiếp
  READ ENTITIES OF Z_R_Travel IN LOCAL MODE
    ENTITY Travel
      FIELDS ( AgencyID )
      WITH CORRESPONDING #( keys )
      RESULT DATA(travels)
    FAILED failed.

  CHECK travels IS NOT INITIAL.

  " (2) Lấy before-image từ active table (chỉ instance đã persist mới có)
  "     auth theo country_code của agency → cần join sang bảng agency
  SELECT FROM ztravel      AS travel
    INNER JOIN zagency     AS agency ON travel~agency_id = agency~agency_id
    FIELDS travel~travel_uuid, travel~agency_id, agency~country_code
    FOR ALL ENTRIES IN @travels
    WHERE travel_uuid = @travels-TravelUUID
    INTO TABLE @DATA(travel_agency_country).

  update_requested = COND #( WHEN requested_authorizations-%update      = if_abap_behv=>mk-on
                               OR requested_authorizations-%action-Edit = if_abap_behv=>mk-on
                             THEN abap_true ELSE abap_false ).
  delete_requested = COND #( WHEN requested_authorizations-%delete = if_abap_behv=>mk-on
                             THEN abap_true ELSE abap_false ).

  LOOP AT travels INTO DATA(travel).
    READ TABLE travel_agency_country WITH KEY travel_uuid = travel-TravelUUID
      ASSIGNING FIELD-SYMBOL(<country>).

    IF sy-subrc = 0.
      " (3a) Instance ACTIVE (có before-image) → check theo dữ liệu đã persist
      IF update_requested = abap_true.
        update_granted = is_update_granted( <country>-country_code ).
        IF update_granted = abap_false.
          APPEND VALUE #( %tky              = travel-%tky
                          %msg              = NEW zcm_travel(
                                                textid    = zcm_travel=>not_authorized_for_agency
                                                agency_id = travel-AgencyID
                                                severity  = if_abap_behv_message=>severity-error )
                          %element-AgencyID = if_abap_behv=>mk-on ) TO reported-travel.
        ENDIF.
      ENDIF.
      IF delete_requested = abap_true.
        delete_granted = is_delete_granted( <country>-country_code ).
        IF delete_granted = abap_false.
          APPEND VALUE #( %tky              = travel-%tky
                          %msg              = NEW zcm_travel(
                                                textid    = zcm_travel=>not_authorized_for_agency
                                                agency_id = travel-AgencyID
                                                severity  = if_abap_behv_message=>severity-error )
                          %element-AgencyID = if_abap_behv=>mk-on ) TO reported-travel.
        ENDIF.
      ENDIF.
    ELSE.
      " (3b) Instance DRAFT hoặc MỚI TẠO (chưa có before-image)
      "      → check quyền create thay vì update/delete
      update_granted = delete_granted = is_create_granted( ).
      IF update_granted = abap_false.
        APPEND VALUE #( %tky              = travel-%tky
                        %msg              = NEW zcm_travel(
                                              textid   = zcm_travel=>not_authorized
                                              severity = if_abap_behv_message=>severity-error )
                        %element-AgencyID = if_abap_behv=>mk-on ) TO reported-travel.
      ENDIF.
    ENDIF.

    " (4) Ghi kết quả cho từng instance qua %tky
    APPEND VALUE #( LET upd = COND #( WHEN update_granted = abap_true
                                      THEN if_abap_behv=>auth-allowed
                                      ELSE if_abap_behv=>auth-unauthorized )
                        del = COND #( WHEN delete_granted = abap_true
                                      THEN if_abap_behv=>auth-allowed
                                      ELSE if_abap_behv=>auth-unauthorized )
                    IN  %tky           = travel-%tky
                        %update        = upd
                        %action-Edit   = upd
                        %delete        = del ) TO result.
  ENDLOOP.
ENDMETHOD.
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/draft/#dmo#bp_travel_d.clas.locals_imp.abap` — adapted sang `Z_`.

**Điểm quan trọng:**

- **`READ ENTITIES ... IN LOCAL MODE`** để lấy thuộc tính từ buffer. Không `SELECT` field
  đó từ DB (buffer có thể đã thay đổi so với DB).
- Cần **before-image** (giá trị đã persist, ví dụ agency cũ để so khớp quyền) → SELECT từ
  active table là hợp lệ, vì before-image chỉ tồn tại ở active table, không ở buffer.
- **Phải phân biệt** instance active (đã có bản ghi trên active table) với instance
  draft/mới tạo (chưa có). Instance mới → dùng quyền **create** thay cho update/delete.
- Kết quả gắn theo `%tky` (draft-safe). Message gắn `%element-<field>` để Fiori highlight
  đúng field.

```abap
" ❌ WRONG — đọc field auth bằng SELECT từ DB trong instance auth
SELECT SINGLE agency_id FROM ztravel WHERE travel_uuid = @lv_uuid INTO @DATA(lv_agency).
" → đọc dữ liệu cũ, bỏ qua thay đổi đang có trong buffer

" ✅ CORRECT — READ ENTITIES IN LOCAL MODE cho dữ liệu buffer
READ ENTITIES OF Z_R_Travel IN LOCAL MODE ENTITY Travel FIELDS ( AgencyID ) ...
```

```abap
" ❌ WRONG — dùng %key trong draft-enabled BO
APPEND VALUE #( %key = travel-%key %update = ... ) TO result.

" ✅ CORRECT — luôn %tky (gồm %key + %is_draft) trong draft BO
APPEND VALUE #( %tky = travel-%tky %update = ... ) TO result.
```

---

## 5. Feature Control — global vs instance features

Feature control **không phải bảo mật** (xem Section 1) — nó điều khiển **khả dụng** của
action/field trên UI theo trạng thái nghiệp vụ.

### 5.1 Instance features — `get_instance_features`

Phổ biến nhất: enable/disable action theo trạng thái, khoá field khi record đã "đóng".

Signature (verified):

```abap
METHODS get_instance_features FOR INSTANCE FEATURES
  IMPORTING keys REQUEST requested_features FOR Travel
  RESULT result.
```

Pattern chuẩn (verified):

```abap
METHOD get_instance_features.
  READ ENTITIES OF Z_R_Travel IN LOCAL MODE
    ENTITY Travel
      FIELDS ( OverallStatus )
      WITH CORRESPONDING #( keys )
    RESULT DATA(travels)
    FAILED failed.

  result = VALUE #( FOR ls_travel IN travels
    ( %tky = ls_travel-%tky

      " field: khoá BookingFee khi travel đã accepted
      %field-BookingFee    = COND #( WHEN ls_travel-OverallStatus = travel_status-accepted
                                     THEN if_abap_behv=>fc-f-read_only
                                     ELSE if_abap_behv=>fc-f-unrestricted )

      " action: disable acceptTravel nếu đã accepted
      %action-acceptTravel = COND #( WHEN ls_travel-OverallStatus = travel_status-accepted
                                     THEN if_abap_behv=>fc-o-disabled
                                     ELSE if_abap_behv=>fc-o-enabled )

      " action: disable rejectTravel nếu đã rejected
      %action-rejectTravel = COND #( WHEN ls_travel-OverallStatus = travel_status-rejected
                                     THEN if_abap_behv=>fc-o-disabled
                                     ELSE if_abap_behv=>fc-o-enabled )

      " association: ẩn tạo Booking khi travel đã rejected
      %assoc-_Booking      = COND #( WHEN ls_travel-OverallStatus = travel_status-rejected
                                     THEN if_abap_behv=>fc-o-disabled
                                     ELSE if_abap_behv=>fc-o-enabled ) ) ).
ENDMETHOD.
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/draft/#dmo#bp_travel_d.clas.locals_imp.abap` — adapted sang `Z_`.

### 5.2 Feature control constants (verified — đừng nhầm)

```abap
" Operation (action, create, update, delete, association):
if_abap_behv=>fc-o-enabled      " khả dụng (mặc định)
if_abap_behv=>fc-o-disabled     " bị khoá / xám

" Field:
if_abap_behv=>fc-f-unrestricted " sửa được (mặc định)
if_abap_behv=>fc-f-read_only    " ⚠️ có gạch dưới: read_only, KHÔNG phải readonly
if_abap_behv=>fc-f-mandatory    " bắt buộc nhập
```

⚠️ **Lưu ý naming**: constant field là `fc-f-read_only` (có dấu gạch dưới), đúng như code
trong reference scenario. Viết `fc-f-readonly` (không gạch dưới) sẽ **không compile**.

### 5.3 Global features — `get_global_features`

Dùng khi action ẩn/hiện **tĩnh** (không phụ thuộc instance cụ thể) — ví dụ một action chỉ
khả dụng trong một khung giờ, hoặc theo cấu hình hệ thống.

Signature (verified):

```abap
METHODS get_global_features FOR GLOBAL FEATURES
  IMPORTING REQUEST requested_features FOR Travel
  RESULT result.
```

Pattern chuẩn (verified — enable/disable action theo khung giờ):

```abap
METHOD get_global_features.
  DATA(time1) = CONV t( '070000' ).
  DATA(time2) = CONV t( '120000' ).

  result = VALUE #(
    %action-setStatus = COND #( WHEN cl_abap_context_info=>get_system_time( ) BETWEEN time1 AND time2
                                THEN if_abap_behv=>fc-o-enabled
                                ELSE if_abap_behv=>fc-o-disabled ) ).

  IF result-%action-setStatus = if_abap_behv=>fc-o-disabled.
    APPEND VALUE #( %msg    = new_message_with_text(
                                text     = 'Execution of action currently not allowed.'
                                severity = if_abap_behv_message=>severity-error )
                    %global = if_abap_behv=>mk-on ) TO reported-travel.
  ENDIF.
ENDMETHOD.
```
Source: SAP-samples/abap-cheat-sheets, `src/zbp_demo_abap_rap_ro_u.clas.locals_imp.abap`
(`get_global_features`) — adapted sang `Z_`.

Lưu ý: global features dùng `%action-...` với `fc-o-enabled/disabled` và message gắn
`%global = mk-on` (không phải `%tky`, vì không gắn với instance). Field-level global
feature (`%field-...`) cũng hợp lệ nếu field readonly/mandatory theo cấu hình tĩnh.

---

## 6. Authorization Check thật — `AUTHORITY-CHECK` trong ABAP Cloud

Đây là điểm dễ hiểu sai nhất. Nhiều tài liệu nói "ABAP Cloud không cho `AUTHORITY-CHECK`".
**Điều đó không đúng cho statement `AUTHORITY-CHECK OBJECT`.**

Reference scenario branch `ABAP-platform-cloud` dùng `AUTHORITY-CHECK OBJECT` ngay trong
các helper của behavior pool:

```abap
METHOD is_update_granted.
  " Instance auth: truyền country_code để check theo dữ liệu
  IF country_code IS SUPPLIED.
    AUTHORITY-CHECK OBJECT 'ZTRVL'                 " ✅ hợp lệ trong ABAP Cloud
      ID 'ZCNTRY' FIELD country_code
      ID 'ACTVT'  FIELD '02'.                       " 02 = Change
    update_granted = COND #( WHEN sy-subrc = 0 THEN abap_true ELSE abap_false ).
  ELSE.
    " Global auth: không có country cụ thể → dùng DUMMY
    AUTHORITY-CHECK OBJECT 'ZTRVL'
      ID 'ZCNTRY' DUMMY
      ID 'ACTVT'  FIELD '02'.
    update_granted = COND #( WHEN sy-subrc = 0 THEN abap_true ELSE abap_false ).
  ENDIF.
ENDMETHOD.
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/draft/#dmo#bp_travel_d.clas.locals_imp.abap`.

**ACTVT values thường dùng:**

| ACTVT | Ý nghĩa | Map với RAP op |
|---|---|---|
| `01` | Create / Add | `%create` |
| `02` | Change | `%update`, `%action-Edit` |
| `03` | Display | (read — thường qua DCL) |
| `06` | Delete | `%delete` |

**Điểm quan trọng:**

- `AUTHORITY-CHECK OBJECT '<obj>'` là một phần **released** của ngôn ngữ ABAP for Cloud
  Development — được dùng chính thức trong reference scenario cloud. Cái *bị cấm* trong
  ABAP Cloud là các cơ chế phân quyền cổ điển khác (ví dụ kiểm tra trực tiếp qua
  transaction / một số API cũ), không phải bản thân `AUTHORITY-CHECK OBJECT`.
- `DUMMY` dùng cho global check khi chưa có giá trị cụ thể của một ID.
- **Authorization object** (SU21) phải tồn tại. Trong Cloud Public, tạo qua ADT
  (Authorization Object + Authorization Field). Read-access (hiển thị) thường được xử lý
  bằng **DCL / Access Control** trên CDS, không phải trong `get_*_authorizations`.

⚠️ **Correction so với ma trận trong `SKILL.md` hiện tại**: bảng "Environment Compatibility"
trong `SKILL.md` đánh `AUTHORITY-CHECK = ❌ use IAM` cho Cloud/BTP. Reference scenario cloud
cho thấy `AUTHORITY-CHECK OBJECT` **có** hoạt động trong ABAP Cloud. Nên cập nhật lại dòng
đó (đề xuất: đổi thành ✅ cho cả Cloud Public và BTP đối với `AUTHORITY-CHECK OBJECT`).

```abap
" ❌ WRONG (giả định sai) — né AUTHORITY-CHECK, tự query bảng role
SELECT ... FROM agr_users WHERE ...  " bảng cũ, không released trong Cloud

" ✅ CORRECT — dùng AUTHORITY-CHECK OBJECT với authorization object của mình
AUTHORITY-CHECK OBJECT 'ZTRVL' ID 'ZCNTRY' FIELD lv_country ID 'ACTVT' FIELD '02'.
```

---

## 7. Authorization Context & Privileged Mode

Đôi khi cần **bỏ qua** authorization check — ví dụ khi một BO khác đọc/ghi BO này trong
internal call (không nên bị chặn bởi quyền của end-user), hoặc trong test.

### 7.1 Khai báo trong BDEF (verified)

```abap
" Đầu file BDEF, trước define behavior:
define authorization context NoCheckWhenPrivileged { 'ZTRVL'; }
define own authorization context by privileged mode;
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/draft/#dmo#r_travel_d.bdef.asbdef`.

- `define authorization context NoCheckWhenPrivileged { 'ZTRVL'; }` — đặt tên context và
  liệt kê authorization object liên quan.
- `define own authorization context by privileged mode;` — cho phép chạy BO ở privileged
  mode (bỏ qua auth) khi được gọi từ ngữ cảnh privileged.

### 7.2 Bỏ qua auth trong internal call — `IN LOCAL MODE`

Trong behavior implementation, cơ chế **đã được xác nhận** để bỏ qua kiểm tra là addition
`IN LOCAL MODE` trên EML `READ`/`MODIFY`:

> "Using the `IN LOCAL MODE` addition to ABAP EML `READ` and `MODIFY` statements can be
> used to suppress feature controls, authorization checks, and prechecks."
> — SAP-samples/abap-cheat-sheets, `08_EML_ABAP_for_RAP.md`

```abap
" Trong behavior pool: đọc/ghi nội bộ, bỏ qua feature control + auth + precheck
READ ENTITIES OF Z_R_Travel IN LOCAL MODE
  ENTITY Travel FIELDS ( OverallStatus )
  WITH CORRESPONDING #( keys )
  RESULT DATA(travels).

MODIFY ENTITIES OF Z_R_Travel IN LOCAL MODE
  ENTITY Travel UPDATE FIELDS ( OverallStatus )
    WITH VALUE #( ( %tky = ... OverallStatus = 'A' ) )
  REPORTED DATA(reported).
```

Đây là lý do mọi EML **bên trong** determination/validation/action đều dùng `IN LOCAL MODE`:
ngoài việc tránh gọi lại service layer (vòng lặp), nó còn bỏ qua auth/feature/precheck —
đúng ý đồ, vì các phase nội bộ không nên bị chặn bởi quyền end-user.

⚠️ **Về addition `PRIVILEGED` (dùng ngoài behavior pool):** tài liệu xác nhận EML có
addition `PRIVILEGED` (và `FORWARDING PRIVILEGED` để truyền tiếp ngữ cảnh privileged sang
EML request kế tiếp) cho luồng gọi RAP BO từ code ngoài (job, service khác) với quyền nâng
cao. **Cú pháp chính xác của statement `PRIVILEGED` không verify được từ source truy cập
được trong session này** — không hiển thị ở đây để tránh đưa cú pháp sai. Khi cần, tra
trong ADT (F1 trên `READ ENTITIES`) hoặc SAP Help "EML in behavior pools". Nguyên tắc bất
biến: privileged/local-mode **chỉ cho internal/system call**, không mở cho luồng end-user.

```abap
" ❌ WRONG — dùng IN LOCAL MODE trong luồng để end-user vượt quyền cố ý
" (local mode bỏ qua auth → chỉ hợp lệ cho xử lý nội bộ, không phải "lách quyền")

" ✅ CORRECT — end-user đi qua auth bình thường; IN LOCAL MODE chỉ trong internal logic
```

---

## 8. Precheck — phân quyền sớm

`precheck` cho phép kiểm tra **trước khi** dữ liệu vào transactional buffer, chặn sớm
input không hợp lệ / không có quyền, tránh chi phí xử lý buffer.

### 8.1 Khai báo trong BDEF (verified)

Precheck là **operation specification** — đặt trong ngoặc sau operation, không phải câu
lệnh riêng:

```abap
define behavior for Z_R_Travel alias Travel
{
  create ( precheck );        " ✅ verified: precheck là spec của operation
  update ( precheck );
  " action ( precheck ) approveTravel result [1] $self;   " precheck cho action cũng hợp lệ
}
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/draft/#dmo#r_travel_d.bdef.asbdef`; cú pháp `( precheck )` cũng nêu trong
`abap-cheat-sheets/36_RAP_Behavior_Definition_Language.md`.

```abap
" ❌ WRONG — precheck KHÔNG phải câu lệnh độc lập
precheck update;
precheck delete;

" ✅ CORRECT — precheck là spec trong ngoặc của operation
update ( precheck );
```

### 8.2 Implement (verified)

Signature dùng `FOR PRECHECK IMPORTING entities FOR <OP>` — verified:

```abap
METHODS precheck_create FOR PRECHECK IMPORTING entities FOR CREATE travel.
METHODS precheck_update FOR PRECHECK IMPORTING entities FOR UPDATE travel.
```

Trong reference scenario, cả hai delegate sang một helper chung; điểm mấu chốt: `entities`
chứa **payload thô người dùng gửi lên** (trước khi vào buffer), phân biệt create/update qua
`if_abap_behv=>op-m-create` / `op-m-update`, và fail bằng `%cid` (create) + `%tky`:

```abap
METHOD precheck_update.
  " entities = payload update thô; kiểm tra quyền trước khi vào buffer
  " (reference scenario gọi helper precheck_auth chung cho create + update)
  DATA(agencies) = CORRESPONDING #( entities DISCARDING DUPLICATES
                     MAPPING agency_id = AgencyID EXCEPT * ).
  CHECK agencies IS NOT INITIAL.

  SELECT FROM zagency FIELDS agency_id, country_code
    FOR ALL ENTRIES IN @agencies WHERE agency_id = @agencies-agency_id
    INTO TABLE @DATA(agency_country).

  LOOP AT entities INTO DATA(entity).
    READ TABLE agency_country WITH KEY agency_id = entity-AgencyID
      ASSIGNING FIELD-SYMBOL(<country>).
    CHECK sy-subrc = 0.                       " AgencyID rỗng/sai → để validation lo

    IF is_update_granted( <country>-country_code ) = abap_false.
      APPEND VALUE #( %tky = entity-%tky ) TO failed-travel.
      APPEND VALUE #( %tky = entity-%tky
                      %msg = NEW zcm_travel(
                               textid    = zcm_travel=>not_authorized_for_agency
                               agency_id = entity-AgencyID
                               severity  = if_abap_behv_message=>severity-error ) ) TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/draft/#dmo#bp_travel_d.clas.locals_imp.abap` (`precheck_create` / `precheck_update` /
`precheck_auth`) — rút gọn và adapt sang `Z_`.

Với create, dùng `%cid` / `%cid_ref` (instance chưa có key thật) thay cho `%tky`.

**Availability** (verified bằng so sánh branch reference scenario):

- `precheck` xuất hiện trong branch **`ABAP-platform-cloud`** (`create ( precheck ); update ( precheck );`).
- Branch **`ABAP-platform-2020`** và **`ABAP-platform-2021`** của reference scenario **không**
  dùng `precheck` trong BDEF.
- ⚠️ Sự vắng mặt trong sample 2020/2021 **không đủ để kết luận** release tối thiểu chính
  xác cho on-prem. **Không verify được mốc version cụ thể trong session này** (không truy
  cập help.sap.com). Trước khi cam kết version, kiểm tra ADT / release notes của hệ thống.
- ECC không có RAP → không áp dụng.

**Precheck vs instance authorization**: precheck thấy **payload thô** và chặn **trước** khi
vào buffer; instance auth đánh giá quyền trên buffer/instance. Lưu ý `IN LOCAL MODE` **bỏ
qua cả precheck** (Section 7.2) — nên precheck không chạy cho EML nội bộ.

---

## 9. Projection layer & phân quyền chuỗi các phase

RAP có hai tầng BDEF: **base BDEF** (interface) và **projection BDEF** (dùng cho service).
Phân quyền được **định nghĩa và implement ở base BDEF**. Projection chỉ `use`:

```abap
" Projection BDEF:
projection;
strict ( 2 );
use draft;

define behavior for Z_C_Travel alias Travel
{
  use create;
  use update;
  use delete;

  use action acceptTravel;
  use action rejectTravel;
  " KHÔNG khai báo lại get_*_authorizations ở projection — thừa hưởng từ base
}
```

- **Authorization + feature control implement một lần ở base**, projection tự thừa hưởng.
- Nếu action/field không được `use` ở projection thì UI không thấy → đó không phải cơ chế
  bảo mật, chỉ là expose.

```abap
" ❌ WRONG — cố implement get_instance_authorizations ở behavior pool của projection
" → projection không có behavior implementation cho auth; sai kiến trúc

" ✅ CORRECT — auth ở base BO; projection chỉ use
```

**Chuỗi phase tổng hợp** (khi user bấm nút trên Fiori):

```
UI action → Projection (use) → Base BO
   ├─ get_global_authorizations   (chặn nếu user không có role)
   ├─ get_instance_features       (nút có enable không?)
   ├─ (precheck)                  (payload hợp lệ + quyền sớm?)
   ├─ get_instance_authorizations (được sửa CHÍNH record này?)
   ├─ validation (on save)        (dữ liệu hợp lệ?)
   └─ save sequence               (persist)
```

---

## 10. Environment Differences — ECC / On-Prem / Cloud

Cách trung thực nhất để nói về khác biệt môi trường là dựa trên **bằng chứng trực tiếp**:
so sánh cùng một BO (travel) qua các branch của flight reference scenario. Bảng dưới là
những gì **thực sự có trong code** từng branch (verified bằng grep source):

| Bằng chứng trong reference scenario | Branch 2020 | Branch 2021 | Branch Cloud |
|---|---|---|---|
| `get_global_authorizations` implement | không (chỉ để comment) | ✅ (nhiều nơi) | ✅ |
| `get_instance_authorizations` implement | không | ✅ | ✅ |
| `AUTHORITY-CHECK OBJECT` trong behavior pool | không | ✅ | ✅ |
| `precheck` trong BDEF (`create ( precheck )`) | không | không | ✅ |
| `authorization context` / privileged mode | — | — | ✅ |

Từ bằng chứng này, những điều **verify được**:

- **RAP authorization + `AUTHORITY-CHECK OBJECT` trong behavior pool**: có trong branch
  2021 và Cloud (branch 2020 chỉ để dạng comment). → Trên S/4 On-Prem đủ mới và Cloud,
  pattern trong file này chạy được; `AUTHORITY-CHECK OBJECT` hợp lệ trong ABAP Cloud.
- **`precheck`**: chỉ thấy ở branch Cloud trong các branch đã kiểm tra.
- **`IN LOCAL MODE`** (bỏ qua feature/auth/precheck — Section 7.2): là addition lõi của RAP
  EML, có ở mọi nơi có behavior pool.

Những điều **KHÔNG verify được trong session này** (không truy cập help.sap.com) — nên
kiểm tra trong ADT / release notes trước khi cam kết:

- Mốc release on-prem tối thiểu cho `precheck` (sự vắng mặt trong sample 2020/2021 không đủ
  để kết luận release cụ thể).
- Con số ABAP release / SP chính xác cho từng tính năng (ví dụ "7.56").
- Cú pháp chính xác của statement EML `PRIVILEGED` (xem Section 7.2).

Xem thêm `environment-diff.md` (khi file đó được tạo) cho ma trận version đầy đủ.

**Lưu ý ECC**: ECC **không có RAP** → toàn bộ file này không áp dụng. Phân quyền ECC dùng
`AUTHORITY-CHECK` cổ điển trực tiếp trong report/module pool + role PFCG.

**Lưu ý read-access**: `get_*_authorizations` phân quyền cho **thao tác ghi** (create/update/
delete/action). Phân quyền **đọc** (ai thấy record nào) thường làm bằng **DCL / Access
Control** (`@AccessControl.authorizationCheck`) trên CDS view, không phải trong behavior
pool — đây là kiến thức RAP chung, hãy xác nhận cú pháp DCL trong domain `cds` khi có.
Đừng cố chặn read bằng instance authorization.

---

## 11. Anti-Patterns

**1. Dùng feature control làm bảo mật**

```abap
" ❌ WRONG — ẩn nút delete để "chặn" user
%action-delete = if_abap_behv=>fc-o-disabled.   " chỉ ẩn trên UI

" ✅ CORRECT — bảo mật ở authorization control
" get_global_authorizations / get_instance_authorizations trả auth-unauthorized
```
Feature control là UX. User vẫn gọi được OData `$batch` trực tiếp nếu chỉ dựa vào nút xám.

**2. SELECT từ DB trong instance authorization thay vì READ ENTITIES**

```abap
" ❌ WRONG
SELECT SINGLE agency_id FROM ztravel WHERE ... INTO @DATA(lv).  " dữ liệu cũ

" ✅ CORRECT
READ ENTITIES OF Z_R_Travel IN LOCAL MODE ENTITY Travel FIELDS ( AgencyID ) ...
```
Ngoại lệ hợp lệ duy nhất: lấy **before-image** từ active table (giá trị đã persist) để so
khớp quyền — như Section 4.

**3. Quên `%global` trong message của global authorization**

```abap
" ❌ WRONG — dùng %tky trong global auth (không có instance)
APPEND VALUE #( %tky = ... %msg = ... ) TO reported-travel.

" ✅ CORRECT
APPEND VALUE #( %global = if_abap_behv=>mk-on %msg = ... ) TO reported-travel.
```

**4. Không xử lý instance draft / mới tạo trong instance authorization**

```abap
" ❌ WRONG — luôn giả định có before-image
READ TABLE before_image WITH KEY ... .
delete_granted = is_delete_granted( <row>-country ).  " dump nếu row chưa persist

" ✅ CORRECT — IF sy-subrc = 0 (active) ELSE (draft/mới) → check quyền create
```

**5. Hardcode `auth-allowed` trong code production**

```abap
" ❌ WRONG — để lại dòng simulation của demo
create_granted = abap_true.   " "Simulation for full authorization"

" ✅ CORRECT — bỏ dòng simulation, để AUTHORITY-CHECK quyết định
```
Reference scenario cố tình để `create_granted = abap_true` cho demo và **ghi rõ**
"not to be used in productive code". Đừng copy nguyên si lên production.

**6. Action ghi dữ liệu nhưng không gắn `authorization : update`**

```abap
" ❌ WRONG
action ( features : instance ) approveTravel result [1] $self;

" ✅ CORRECT
action ( features : instance, authorization : update ) approveTravel result [1] $self;
```

**7. Dùng `%key` thay vì `%tky` trong draft-enabled BO**

```abap
" ❌ WRONG
APPEND VALUE #( %key = ... %update = ... ) TO result.

" ✅ CORRECT
APPEND VALUE #( %tky = ... %update = ... ) TO result.
```

**8. Child entity tự implement authorization thay vì `dependent by`**

```abap
" ❌ WRONG — child khai báo authorization master ( instance ) rồi copy logic root
" → dễ lệch quyền giữa parent và child

" ✅ CORRECT
authorization dependent by _Travel
```

**9. Cố chặn read-access bằng get_instance_authorizations**

```abap
" ❌ WRONG — không có "read authorization" trong behavior pool
" ✅ CORRECT — phân quyền đọc bằng DCL (@AccessControl.authorizationCheck) trên CDS
```

---

## 12. Debug Checklist

**Triệu chứng: thao tác không bị chặn dù user không có quyền**

```
1. BDEF có khai báo authorization master ( global / instance ) chưa?
   → thiếu khai báo = framework không gọi get_*_authorizations

2. Action ghi dữ liệu có ( authorization : update ) chưa?
   → thiếu = instance auth không chạy cho action đó

3. Còn dòng simulation "granted = abap_true" trong is_*_granted không?
   → xoá dòng demo, để AUTHORITY-CHECK quyết định

4. Authorization object (SU21/ADT) đã gán vào role của user test chưa?
   → AUTHORITY-CHECK luôn trả sy-subrc <> 0 nếu object chưa gán

5. Có đang chạy PRIVILEGED mode / test double vô tình bật privileged không?
```

**Triệu chứng: nút bị xám / field khoá dù đáng lẽ phải mở**

```
1. get_instance_features đọc đúng field state chưa? (READ ENTITIES IN LOCAL MODE)
2. COND # có nhánh ELSE trả fc-o-enabled / fc-f-unrestricted chưa?
   → thiếu ELSE = mặc định về initial → hành vi khó đoán
3. Field/action đã khai báo ( features : instance ) trong BDEF chưa?
4. Projection đã use action/field đó chưa?
5. Constant có viết đúng fc-f-read_only (gạch dưới) không?
```

**Triệu chứng: message lỗi auth không hiện trên Fiori**

```
1. Có APPEND vào reported-<entity> không? (không phải chỉ failed)
2. Global auth dùng %global = mk-on; instance auth dùng %tky
3. severity = if_abap_behv_message=>severity-error?
4. Message class / textid tồn tại?
```

---

## 13. Sources

### Verified live trong session này (fetch trực tiếp từ GitHub)

Mọi code trong file này được đối chiếu với các file dưới đây:

| Source | URL | Nội dung |
|---|---|---|
| Flight Ref Scenario — branch ABAP-platform-cloud | https://github.com/SAP-samples/abap-platform-refscen-flight/tree/ABAP-platform-cloud | Code verified: get_global/instance_authorizations, get_instance_features, is_*_granted, AUTHORITY-CHECK, authorization context |
| Flight Ref Scenario — bp_travel_d locals_imp | https://github.com/SAP-samples/abap-platform-refscen-flight/blob/ABAP-platform-cloud/src/draft/%23dmo%23bp_travel_d.clas.locals_imp.abap | Nguồn trực tiếp: 4 method auth/feature + is_*_granted + precheck_create/update/auth |
| Flight Ref Scenario — r_travel_d BDEF | https://github.com/SAP-samples/abap-platform-refscen-flight/blob/ABAP-platform-cloud/src/draft/%23dmo%23r_travel_d.bdef.asbdef | authorization master ( global, instance ), dependent by, authorization context, `create ( precheck )` |
| Flight Ref Scenario — branch 2020 vs 2021 | https://github.com/SAP-samples/abap-platform-refscen-flight/branches | So sánh branch để verify tính năng nào có ở release nào (auth methods, AUTHORITY-CHECK, precheck) |
| ABAP Cheat Sheets — RAP BDL (`36`) | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/36_RAP_Behavior_Definition_Language.md | Cú pháp `( precheck )`, authorization/feature spec trong BDEF |
| ABAP Cheat Sheets — EML for RAP (`08`) | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/08_EML_ABAP_for_RAP.md | `IN LOCAL MODE` suppress feature/auth/precheck; %tky/%global; PRIVILEGED tồn tại |
| ABAP Cheat Sheets — demo class ro_u | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/src/zbp_demo_abap_rap_ro_u.clas.locals_imp.abap | `get_global_features` signature + impl (time-based enable/disable) |
| ABAP Cheat Sheets — Authorization Checks (`25`) | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/25_Authorization_Checks.md | RAP BO precheck cho auth trên incoming values |

### Tham khảo chính thức — chưa fetch trong session này

⚠️ Các URL dưới đây trỏ tới tài liệu chính thức của SAP nhưng **không truy cập được từ môi
trường session này** (network chỉ ra được GitHub). Chúng được liệt kê theo hiểu biết về vị
trí tài liệu chuẩn — **hãy tự mở và đối chiếu** trước khi coi là nguồn xác thực, đặc biệt
cho version-specific facts và cú pháp `PRIVILEGED`.

| Source (chưa verify trong session) | URL |
|---|---|
| SAP Help — RAP Authorization Control | https://help.sap.com/docs/abap-cloud/abap-rap/authorization-control |
| SAP Help — Feature Control | https://help.sap.com/docs/abap-cloud/abap-rap/feature-control |
| SAP Help — BDL authorization | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_authorization.htm |
| SAP Help — RAP BO Precheck | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenbdl_precheck.htm |
| SAP Help — IN LOCAL MODE | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abapin_local_mode.htm |
| SAP Learning — RAP Authorization | https://learning.sap.com/courses/building-transactional-apps-with-the-abap-restful-application-programming-model |