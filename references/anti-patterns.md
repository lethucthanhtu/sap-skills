# SAP Anti-Patterns — Complete Reference

Danh sách các lỗi phổ biến nhất theo từng domain.
Claude phải **scan file này trước khi trả lời bất kỳ câu hỏi code nào** và **cảnh báo ngay** nếu phát hiện vi phạm.

Mỗi anti-pattern có: mô tả lỗi, ví dụ sai ❌, ví dụ đúng ✅, mức độ nghiêm trọng, và nguồn tham khảo.

---

## Severity Legend
- 🔴 **CRITICAL** — Causes runtime crash, data loss, or silent data corruption
- 🟠 **HIGH** — Causes wrong behavior, hard-to-debug issues, ATC violations
- 🟡 **MEDIUM** — Performance degradation, bad practices, future maintenance issues
- 🟢 **INFO** — Style or minor optimization

---

## Table of Contents
1. [ABAP Core Anti-Patterns](#1-abap-core-anti-patterns)
2. [ABAP Cloud / Clean Core Violations](#2-abap-cloud--clean-core-violations)
3. [RAP Anti-Patterns](#3-rap-anti-patterns)
4. [CDS Anti-Patterns](#4-cds-anti-patterns)
5. [OData Anti-Patterns](#5-odata-anti-patterns)
6. [CAP Node.js Anti-Patterns](#6-cap-nodejs-anti-patterns)
7. [CAP + SAP OData Integration Anti-Patterns](#7-cap--sap-odata-integration-anti-patterns)
8. [Performance Anti-Patterns (Cross-domain)](#8-performance-anti-patterns-cross-domain)

---

## 1. ABAP Core Anti-Patterns

### AP-ABAP-01 🔴 — SELECT * without field list
```abap
" ❌ WRONG — fetches all fields, increases memory & transfer time
SELECT * FROM mara INTO TABLE @DATA(lt_mara).

" ✅ CORRECT — select only what you need
SELECT matnr, maktx, mtart
  FROM mara
  INTO TABLE @DATA(lt_mara).
```
**Why**: Unnecessary data transfer, violates ABAP Cloud rules, triggers ATC warning.
Source: https://help.sap.com/doc/abapdocu/latest/en-US/index.htm

---

### AP-ABAP-02 🔴 — FOR ALL ENTRIES on empty table
```abap
" ❌ WRONG — if lt_keys is empty, FAE returns ALL rows (full table scan!)
SELECT * FROM vbap
  FOR ALL ENTRIES IN @lt_keys
  WHERE vbeln = @lt_keys-vbeln
  INTO TABLE @DATA(lt_items).

" ✅ CORRECT — always guard with IS NOT INITIAL
IF lt_keys IS NOT INITIAL.
  SELECT vbeln, posnr, matnr, kwmeng
    FROM vbap
    FOR ALL ENTRIES IN @lt_keys
    WHERE vbeln = @lt_keys-vbeln
    INTO TABLE @DATA(lt_items).
ENDIF.
```
**Why**: Empty FAE = full table scan = production system meltdown.
Source: https://help.sap.com/doc/abapdocu/latest/en-US/index.htm?file=abapselect_for_all_entries.htm

---

### AP-ABAP-03 🟠 — MODIFY inside LOOP (copy-modify pattern)
```abap
" ❌ WRONG — copies row, modifies copy, writes back (expensive!)
LOOP AT lt_table INTO DATA(ls_row).
  IF ls_row-status = 'A'.
    ls_row-status = 'X'.
    MODIFY lt_table FROM ls_row.  " rebuilds index!
  ENDIF.
ENDLOOP.

" ✅ CORRECT — modify in-place with field symbol
LOOP AT lt_table ASSIGNING FIELD-SYMBOL(<ls_row>)
  WHERE status = 'A'.
  <ls_row>-status = 'X'.
ENDLOOP.
```
**Why**: MODIFY inside loop causes O(n²) complexity for sorted/hashed tables.

---

### AP-ABAP-04 🟠 — Raising exception inside RAP handler
```abap
" ❌ WRONG — crashes the entire OData call with a generic 500 error
METHOD validateDates.
  IF ls_travel-begin_date > ls_travel-end_date.
    RAISE EXCEPTION TYPE cx_abap_invalid_value.  " ← NEVER in RAP handler!
  ENDIF.
ENDMETHOD.

" ✅ CORRECT — populate FAILED and REPORTED structures
METHOD validateDates.
  IF ls_travel-begin_date > ls_travel-end_date.
    APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
    APPEND VALUE #(
      %tky = ls_travel-%tky
      %msg = new_message_with_text(
               severity = if_abap_behv_message=>severity-error
               text     = 'End date must be after begin date' )
    ) TO reported-travel.
  ENDIF.
ENDMETHOD.
```
**Why**: Unhandled exception in RAP handler = zero useful feedback, full OData error.
Source: https://help.sap.com/docs/abap-cloud/abap-rap/validations

---

### AP-ABAP-05 🟡 — Hungarian notation in modern ABAP
```abap
" ❌ WRONG — type-encoded names (old-school)
DATA lv_str_travel_id TYPE /dmo/travel_id.
DATA lt_tab_results   TYPE TABLE OF /dmo/travel.

" ✅ CORRECT — intent-revealing names (Clean ABAP)
DATA travel_id TYPE /dmo/travel_id.
DATA travels   TYPE TABLE OF /dmo/travel.
```
**Why**: Violates Clean ABAP style guide; harder to read, refactor.
Source: https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md

---

### AP-ABAP-06 🟡 — Mega methods (> 50 lines)
```abap
" ❌ WRONG — one method doing everything (create, validate, persist, notify)
METHOD process_travel.
  " 200+ lines of mixed logic
ENDMETHOD.

" ✅ CORRECT — single-responsibility methods
METHOD process_travel.
  validate_travel_data( is_travel ).
  assign_number( CHANGING cs_travel ).
  persist_travel( is_travel ).
  notify_agency( is_travel-agency_id ).
ENDMETHOD.
```
**Why**: Untestable, unmaintainable. Clean ABAP: methods should do ONE thing.
Source: https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md#keep-methods-small

---

## 2. ABAP Cloud / Clean Core Violations

### AP-CLOUD-01 🔴 — Accessing unreleased DB tables directly
```abap
" ❌ WRONG — DD02L is an internal SAP DDIC table, not released for Cloud
SELECT tabname FROM dd02l INTO TABLE @DATA(lt_tables).

" ✅ CORRECT — use released CDS views
SELECT entityid FROM i_ddlsource INTO TABLE @DATA(lt_entities).
```
**Why**: ATC error in Cloud; behavior undefined; SAP can change internal tables anytime.
Source: https://help.sap.com/docs/abap-cloud/abap-cloud/what-is-abap-cloud

---

### AP-CLOUD-02 🔴 — AUTHORITY-CHECK in ABAP Cloud
```abap
" ❌ WRONG — not supported in ABAP Cloud / BTP Steampunk
AUTHORITY-CHECK OBJECT 'Z_TRAVEL'
  ID 'ACTVT' FIELD '03'.
IF sy-subrc <> 0. RAISE EXCEPTION ... ENDIF.

" ✅ CORRECT — use RAP authorization (get_global_authorizations / get_instance_authorizations)
" or IAM (Identity & Access Management) for BTP
```
**Why**: `AUTHORITY-CHECK` is blocked in ABAP for Cloud Development.
Source: https://help.sap.com/docs/abap-cloud/abap-rap/authorization

---

### AP-CLOUD-03 🟠 — Calling unreleased Function Modules
```abap
" ❌ WRONG — CONVERSION_EXIT_MATN1_INPUT is not released for Cloud
CALL FUNCTION 'CONVERSION_EXIT_MATN1_INPUT'
  EXPORTING input  = lv_matnr_ext
  IMPORTING output = lv_matnr_int.

" ✅ CORRECT — use released class method
DATA(lv_matnr_int) = cl_material_number=>convert_to_internal( lv_matnr_ext ).
```
**Why**: ATC check blocks deployment to Cloud. Always verify C1 release status in ADT.
Source: https://github.com/SAP-samples/abap-cheat-sheets/blob/main/22_Released_ABAP_Classes.md

---

### AP-CLOUD-04 🟠 — Classic WRITE statement in Cloud
```abap
" ❌ WRONG — no classic reports in ABAP Cloud
WRITE: 'Travel ID:', lv_travel_id.

" ✅ CORRECT — use IF_OO_ADT_CLASSRUN for console output
METHOD if_oo_adt_classrun~main.
  out->write( |Travel ID: { lv_travel_id }| ).
ENDMETHOD.
```
**Why**: WRITE is Standard ABAP only; blocked in ABAP for Cloud Development.

---

### AP-CLOUD-05 🟠 — Direct DB INSERT/UPDATE/DELETE in Cloud (outside RAP)
```abap
" ❌ WRONG — bypasses RAP transactional model
INSERT ztravel FROM ls_travel.
MODIFY ztravel FROM TABLE lt_travels.

" ✅ CORRECT — use EML (Entity Manipulation Language) via RAP
MODIFY ENTITIES OF z_i_travel
  ENTITY Travel CREATE FROM ...
```
**Why**: Bypasses locking, draft handling, validations. Use RAP/EML for all persistence.
Source: https://help.sap.com/docs/abap-cloud/abap-rap/entity-manipulation-language-eml

---

## 3. RAP Anti-Patterns

### AP-RAP-01 🔴 — EML MODIFY inside READ handler (side-effect violation)
```abap
" ❌ WRONG — READ handler must have zero side effects!
METHOD get_travel.
  READ ENTITIES OF z_i_travel ...
  " ... process data ...
  MODIFY ENTITIES OF z_i_travel ...  " ← NEVER in READ handler!
ENDMETHOD.

" ✅ CORRECT — modifications only in MODIFY/CREATE/DELETE/ACTION handlers
```
**Why**: READ operations must be side-effect free. Triggers runtime exception, corrupt data.
Source: https://help.sap.com/docs/abap-cloud/abap-rap/behavior-implementation-class

---

### AP-RAP-02 🔴 — Missing IN LOCAL MODE on internal EML calls
```abap
" ❌ WRONG — calls external service layer → infinite loop / authorization bypass issues
MODIFY ENTITIES OF z_i_travel
  ENTITY Travel UPDATE FIELDS ( Status ) WITH lt_update.

" ✅ CORRECT — IN LOCAL MODE bypasses service layer for internal calls
MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel UPDATE FIELDS ( Status ) WITH lt_update
  FAILED   DATA(lt_failed)
  REPORTED DATA(lt_reported).
```
**Why**: Without LOCAL MODE, the framework calls the public service → risk of infinite loop or bypass of authorization checks that were meant for external callers only.
Source: https://help.sap.com/docs/abap-cloud/abap-rap/entity-manipulation-language-eml

---

### AP-RAP-03 🔴 — Confusing %tky with %key
```abap
" ❌ WRONG — %key only contains primary key fields; %tky includes draft admin fields
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel FIELDS ( Status )
  WITH VALUE #( ( TravelId = lv_id ) )  " missing %is_draft for draft BOs!
  RESULT DATA(lt_result).

" ✅ CORRECT — always use %tky for draft-enabled BOs
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel FIELDS ( Status )
  WITH CORRESPONDING #( keys )          " keys already has %tky
  RESULT DATA(lt_result).
```
**Why**: `%tky` = `%key` + `%is_draft`. For draft BOs, omitting `%is_draft` causes wrong record lookup.
Source: https://github.com/SAP-samples/abap-cheat-sheets/blob/main/08_EML_ABAP_for_RAP.md

---

### AP-RAP-04 🟠 — Validation not triggering — wrong field trigger
```abap
" ❌ WRONG — 'on save' only fires at save, not on field change
validation validateDates on save { create; update; }

" ✅ CORRECT — add field triggers so Fiori re-validates on field change
validation validateDates on save { create; field BeginDate, EndDate; }
```
**Checklist when validation doesn't fire:**
1. Is field listed in `field` trigger in BDEF?
2. Is the validation exposed in the **projection** BDEF via `use validation validateDates;`?
3. For draft BOs: does the validation fire on `draftActivate` (save)?
4. Is the method name exactly matching the BDEF? (case-sensitive)
Source: https://help.sap.com/docs/abap-cloud/abap-rap/validations

---

### AP-RAP-05 🟠 — Reading from DB directly instead of transactional buffer
```abap
" ❌ WRONG — reads persisted (old) data, misses unsaved changes in buffer
METHOD validateStatus.
  SELECT SINGLE overall_status
    FROM ztravel
    WHERE travel_id = @ls_key-TravelId
    INTO @DATA(lv_status).

" ✅ CORRECT — read from RAP transactional buffer
METHOD validateStatus.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( OverallStatus )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_result).
```
**Why**: Validation sees stale data; user can change value that hasn't been saved yet.
Source: https://aixsap.com/abap-rap-deep-dive-part-2-implementing-business-logic-validations-and-determinations-in-sap-s-4hana/

---

### AP-RAP-06 🟠 — Determination firing on every field change (too broad trigger)
```abap
" ❌ WRONG — fires on every create/update, even unrelated field changes
determination setTotalPrice on modify { create; update; }

" ✅ CORRECT — limit trigger to relevant fields only
determination setTotalPrice on modify { create; field BookingFee, FlightPrice, CurrencyCode; }
```
**Why**: Broad triggers = unnecessary recalculations, UI slow, hard to debug.
Source: https://help.sap.com/docs/abap-cloud/abap-rap/determinations

---

### AP-RAP-07 🟠 — Missing strict(2) on new BDEF
```abap
" ❌ WRONG — no strict mode on new development
managed implementation in class zbp_z_i_travel unique;

" ✅ CORRECT — always use strict(2) for new development
managed implementation in class zbp_z_i_travel unique;
strict ( 2 );
```
**Why**: `strict(2)` enforces etag, lock, draft admin fields — prevents subtle bugs at runtime.
Source: https://help.sap.com/docs/abap-cloud/abap-rap/behavior-definition

---

### AP-RAP-08 🟡 — BAPI wrapper: forgetting BAPI_TRANSACTION_COMMIT
```abap
" ❌ WRONG — BAPI changes not committed, data lost
METHOD save_modified.
  LOOP AT create-travel INTO DATA(ls_create).
    CALL FUNCTION 'BAPI_TRAVEL_CREATE' ...
  ENDLOOP.
  " ← forgot COMMIT!

" ✅ CORRECT — always commit (or rollback on error)
METHOD save_modified.
  LOOP AT create-travel INTO DATA(ls_create).
    CALL FUNCTION 'BAPI_TRAVEL_CREATE'
      IMPORTING return = DATA(lt_return).
    IF line_exists( lt_return[ type = 'E' ] ).
      CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
      RETURN.
    ENDIF.
  ENDLOOP.
  CALL FUNCTION 'BAPI_TRANSACTION_COMMIT' EXPORTING wait = 'X'.
ENDMETHOD.
```
**Why**: BAPIs use their own LUW; without explicit COMMIT, changes are rolled back.
Source: https://help.sap.com/docs/abap-cloud/abap-rap/unmanaged-scenario

---

### AP-RAP-09 🟡 — Business Events: missing Event Binding activation
```abap
" Code is correct but events are not published — common setup mistake:
" ❌ Forgot to create/activate the Event Binding object in ADT
" ❌ Event Binding channel is 'LOCAL' but Event Mesh is expected
" ❌ Event Binding is inactive (not published)

" ✅ Checklist:
" 1. Create Event Binding in ADT (New → Event Binding)
" 2. Reference correct BDEF and event name (case-sensitive)
" 3. Set channel: LOCAL (same system) or SAP_EM (Event Mesh on BTP)
" 4. Activate the Event Binding
" 5. Verify event fires: check /IWXBE/CONFIG and Event Monitor
```
Source: https://help.sap.com/docs/abap-cloud/abap-rap/business-events

---

## 4. CDS Anti-Patterns

### AP-CDS-01 🔴 — Missing @AccessControl.authorizationCheck when no DCL exists
```abap
" ❌ WRONG — implicit authorization check fails if no DCL file exists
@AbapCatalog.viewEnhancementCategory: [#NONE]
define view entity Z_I_Travel as select from ztravel { ... }

" ✅ CORRECT — explicitly disable check if no DCL is planned
@AccessControl.authorizationCheck: #NOT_REQUIRED
define view entity Z_I_Travel as select from ztravel { ... }
```
**Why**: Without the annotation, SAP assumes a DCL must exist. If it doesn't → access denied for all users.
Source: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/4f826dad6c034ff0b7dfc82cc79ad5f9.html

---

### AP-CDS-02 🟠 — @UI.lineItem without position → undefined rendering order
```abap
" ❌ WRONG — columns render in undefined order
@UI.lineItem: [{ importance: #HIGH }]
TravelId;

" ✅ CORRECT — always define position
@UI.lineItem: [{ position: 10, importance: #HIGH }]
TravelId;
```
**Why**: Fiori Elements renders columns by position. Without it, order is random.
Source: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/b3b02cf03c894498b1f01a303ec81e0e.html

---

### AP-CDS-03 🟠 — @OData.publish: true (deprecated shortcut)
```abap
" ❌ WRONG — deprecated since S/4HANA 1909, not supported in ABAP Cloud
@OData.publish: true
define view entity Z_I_Travel ...

" ✅ CORRECT — always use explicit Service Definition + Service Binding
" Step 1: Create Service Definition (SRVD object)
" Step 2: Create Service Binding (SRVB object) → choose V4 UI or V4 API
```
**Why**: `@OData.publish` is a legacy shortcut that bypasses proper service lifecycle management.
Source: https://help.sap.com/docs/abap-cloud/abap-rap/service-binding

---

### AP-CDS-04 🟠 — INNER JOIN for optional data (should be LEFT OUTER JOIN)
```abap
" ❌ WRONG — INNER JOIN eliminates rows where text doesn't exist (e.g., missing language)
define view entity Z_I_Material as select from mara
  join makt on makt.matnr = mara.matnr
  { mara.matnr, makt.maktx }

" ✅ CORRECT — LEFT OUTER JOIN preserves all materials even without text
define view entity Z_I_Material as select from mara
  left outer join makt on  makt.matnr = mara.matnr
                        and makt.spras = $session.system_language
  { mara.matnr, coalesce( makt.maktx, '' ) as Description }
```
**Why**: INNER JOINs silently drop records. Also: INNER JOINs always execute even when fields not selected.
Source: https://medium.com/sap-innovation-hub/cds-view-performance-dos-and-don-ts-for-optimal-sql-and-cds-design-f12104bbd7e2

---

### AP-CDS-05 🟡 — NOT NULL-preserving expression in LEFT OUTER JOIN association
```abap
" ❌ WRONG — CASE with ELSE branch prevents NULL → HANA can't optimize join
association [0..1] to Z_I_Status as _Status
  on _Status.code = case overall_status
                      when 'O' then 'OPEN'
                      else 'CLOSED'    " ← ELSE means result is never NULL
                    end

" ✅ CORRECT — keep expressions NULL-preserving in join conditions
association [0..1] to Z_I_Status as _Status
  on _Status.code = overall_status     " direct field reference = NULL-preserving
```
**Why**: Non-NULL-preserving expressions in LEFT JOIN force HANA to evaluate ALL rows before join → severe performance impact on large datasets.
Source: https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/cds-view-performance-best-practice-not-null-preserving-left-outer-join/ba-p/13579510

---

### AP-CDS-06 🟡 — Table function in ABAP Cloud
```abap
" ❌ WRONG — table functions not supported in ABAP Cloud / BTP
define table function Z_TF_OpenItems ...
  implemented by method ZCL_TF_IMPL=>get_data;

" ✅ CORRECT — use custom entity with query provider class instead
@ObjectModel.query.implementedBy: 'ABAP:ZCL_QUERY_PROVIDER'
define custom entity Z_CE_OpenItems { ... }
```
**Why**: Table functions require SQLScript/HANA DB procedures — not available in ABAP Cloud.

---

### AP-CDS-07 🟡 — Deeply nested CASE statements in CDS
```abap
" ❌ WRONG — complex nested CASE = poor execution plan, high CPU
case
  when a = 1 then case when b = 2 then case when c = 3 then 'X' else 'Y' end else 'Z' end
  else 'W'
end as result

" ✅ CORRECT — simplify or move complex logic to virtual elements / ABAP layer
case overall_status
  when 'O' then 'Open'
  when 'A' then 'Accepted'
  when 'X' then 'Cancelled'
  else 'Unknown'
end as StatusText
```
**Why**: Complex CASE in CDS degrades HANA query optimizer, increases compile time.
Source: https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/cds-view-performance-best-practices/ba-p/13559714

---

## 5. OData Anti-Patterns

### AP-ODATA-01 🔴 — Modifying calls without CSRF token (V2)
```http
❌ WRONG — POST/PUT/PATCH/DELETE without CSRF token → 403 Forbidden
POST /sap/opu/odata/sap/Z_TRAVEL_SRV/TravelSet
Content-Type: application/json
{ ... }

✅ CORRECT — fetch token first, then use it
GET /sap/opu/odata/sap/Z_TRAVEL_SRV/$metadata
X-CSRF-Token: Fetch
→ Response: X-CSRF-Token: abc123

POST /sap/opu/odata/sap/Z_TRAVEL_SRV/TravelSet
X-CSRF-Token: abc123
```
**Why**: SAP OData V2 requires CSRF token for all modifying requests.

---

### AP-ODATA-02 🟠 — Not using $select to limit fields
```http
❌ WRONG — fetches all fields including large text/binary fields
GET /Travel?$filter=IsActiveEntity eq true

✅ CORRECT — request only needed fields
GET /Travel?$select=TravelId,AgencyId,OverallStatus&$filter=IsActiveEntity eq true
```
**Why**: Large payloads slow down Fiori UI; especially critical on mobile.

---

### AP-ODATA-03 🟠 — Ignoring ETag for updates (lost update problem)
```http
❌ WRONG — overwrites changes made by other users
PATCH /Travel(TravelId='001',IsActiveEntity=false)
{ "Description": "new value" }

✅ CORRECT — always send ETag read from GET response
PATCH /Travel(TravelId='001',IsActiveEntity=false)
If-Match: W/"2024-12-01T10:30:00Z"
{ "Description": "new value" }
```
**Why**: Without If-Match, two users can overwrite each other's changes silently.
Source: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/sap-abap-for-odata

---

### AP-ODATA-04 🟡 — Using /IWFND/ERROR_LOG wrong way
```
❌ WRONG — checking SM21 for OData errors (too low-level)

✅ CORRECT — always check these in order:
1. /IWFND/ERROR_LOG  → OData framework errors (most useful)
2. /IWFND/TRACES     → enable detailed OData request/response trace
3. /IWFND/GW_CLIENT  → test OData calls directly from browser
4. ST05              → SQL trace for DB-level issues
```
**Why**: OData errors are logged at framework level, not in SM21.

---

## 6. CAP Node.js Anti-Patterns

### AP-CAP-01 🔴 — Single service exposing ALL entities (1:1 anti-pattern)
```js
// ❌ WRONG — from CAP official docs: "The anti-pattern"
service AllInOneService {
  entity Books as projection on db.Books;
  entity Authors as projection on db.Authors;
  entity Orders as projection on db.Orders;
  entity Suppliers as projection on db.Suppliers;
  // ... 20 more entities
}

// ✅ CORRECT — separate services per use case
service BookshopService {   // for end-users
  entity Books as projection on db.Books;
}
service AdminService @(requires: 'admin') {  // for admin
  entity Books as projection on db.Books;
  entity Authors as projection on db.Authors;
}
```
**Why**: One giant service = huge entry door, complex authorization, poor API design.
Source: https://cap.cloud.sap/docs/guides/providing-services

---

### AP-CAP-02 🔴 — throw Error instead of req.error() / req.reject()
```js
// ❌ WRONG — throws unhandled error, returns generic 500 to Fiori
this.on('CREATE', 'Travel', async (req) => {
  if (!req.data.AgencyId) {
    throw new Error('Agency ID is required')  // ← generic 500!
  }
})

// ✅ CORRECT — use req.error() for business errors → proper OData error response
this.on('CREATE', 'Travel', async (req) => {
  if (!req.data.AgencyId) {
    req.error(400, 'Agency ID is required', 'in/AgencyId')  // ← proper 400
    return
  }
})
```
**Why**: Fiori Elements needs proper OData error format to show inline field errors.
Source: https://cap.cloud.sap/docs/node.js/core-services#req-error

---

### AP-CAP-03 🔴 — Hardcoded destination names
```js
// ❌ WRONG — breaks between environments (dev/test/prod)
const S4 = await cds.connect.to('S4HANA_PROD_SYSTEM')

// ✅ CORRECT — use logical service name from cds.requires config
const S4 = await cds.connect.to('API_BUSINESS_PARTNER')
// Configure in package.json:
// "cds": { "requires": { "API_BUSINESS_PARTNER": { "kind": "odata-v2", "destination": "S4H_DEST" } } }
```
**Why**: Different destinations per landscape (dev uses mock, prod uses real SAP system).

---

### AP-CAP-04 🟠 — Not using cds.requires for service config
```js
// ❌ WRONG — credentials hardcoded, different config per environment impossible
const destination = { url: 'https://my.s4hana.example.com', auth: 'Basic ...' }

// ✅ CORRECT — use cds env / MTA binding
// package.json:
"cds": {
  "requires": {
    "API_BUSINESS_PARTNER": {
      "kind": "odata-v2",
      "model": "srv/external/API_BUSINESS_PARTNER"
    }
  }
}
// BTP: bind destination service via MTA / cds bind
```
Source: https://cap.cloud.sap/docs/guides/using-services#destinations

---

### AP-CAP-05 🟡 — Missing health endpoint in CF deployment
```js
// ❌ WRONG — CF health check fails → app restarts in loop
// No /health endpoint defined

// ✅ CORRECT — CAP provides /health out of the box since @sap/cds ^7.8
// Verify: GET /health → { "status": "UP" }
// For custom checks:
cds.on('bootstrap', app => {
  app.get('/health', (_, res) => res.status(200).json({ status: 'UP' }))
})
```
Source: https://cap.cloud.sap/docs/node.js/best-practices

---

### AP-CAP-06 🟡 — Pinned exact dependency versions in package.json
```json
// ❌ WRONG — misses security patches, CAP bug fixes
{
  "@sap/cds": "8.1.0"
}

// ✅ CORRECT — use caret for latest compatible minor/patch
{
  "@sap/cds": "^8.1.0"
}
```
**Why**: SAP CAP releases frequent patch fixes. Exact pinning means you miss them.
Source: https://cap.cloud.sap/docs/node.js/best-practices

---

## 7. CAP + SAP OData Integration Anti-Patterns

### AP-CAP-SAP-01 🔴 — Swallowing SAP OData errors silently
```js
// ❌ WRONG — Fiori shows empty table with no error message
this.on('READ', 'Travel', async (req) => {
  const result = await SAPService.run(req.query).catch(() => [])
  return result
})

// ✅ CORRECT — propagate SAP error to Fiori via req.error()
this.on('READ', 'Travel', async (req) => {
  try {
    return await SAPService.run(req.query)
  } catch (err) {
    const code   = err.statusCode || err.code || 500
    const msg    = err.message
               || err.innererror?.message
               || err.error?.message
               || 'SAP backend error'
    req.error(code, msg)
  }
})
```
**Why**: `.catch(() => [])` hides SAP errors. User sees empty data, no way to debug.
Source: https://cap.cloud.sap/docs/node.js/core-services#req-error

---

### AP-CAP-SAP-02 🔴 — Missing CSRF config for SAP OData V2 write operations
```json
// ❌ WRONG — POST/PUT/PATCH to SAP V2 service → 403 Forbidden
"API_BUSINESS_PARTNER": {
  "kind": "odata-v2",
  "destination": "S4H_DEST"
}

// ✅ CORRECT — enable CSRF token handling for write operations
"API_BUSINESS_PARTNER": {
  "kind": "odata-v2",
  "destination": "S4H_DEST",
  "csrf": true,
  "csrfInBatch": true
}
```
**Why**: SAP OData V2 requires X-CSRF-Token for all modifying requests. CAP can handle it automatically.
Source: https://cap.cloud.sap/docs/node.js/remote-services

---

### AP-CAP-SAP-03 🟠 — Not handling 502 ECONNRESET from Cloud Connector
```js
// ❌ WRONG — generic error, hard to diagnose
// Error: Error during request to remote service: read ECONNRESET

// ✅ CORRECT — debug checklist for ECONNRESET:
// 1. Check SCC (Cloud Connector) is running and system mapping is correct
// 2. Check BTP Destination: proxyType = OnPremise, Authentication = correct
// 3. Local dev: use 'cds bind --to-app-name' or .cdsrc-private.json
// 4. Check firewall between SCC and backend SAP system
// 5. Verify virtual host in SCC matches destination URL exactly
```
Source: https://community.sap.com/t5/technology-q-a/sap-cap-502-quot-error-during-request-to-remote-service-read-econnreset/qaq-p/14142585

---

### AP-CAP-SAP-04 🟠 — Not mocking SAP remote service during local dev
```js
// ❌ WRONG — always calls real SAP system during development → slow, unstable
// (no mock configured)

// ✅ CORRECT — use CAP's built-in mock for local development
// 1. Add mock data in srv/external/data/API_BUSINESS_PARTNER-A_BusinessPartner.csv
// 2. In package.json:
"cds": {
  "requires": {
    "API_BUSINESS_PARTNER": {
      "[development]": { "kind": "odata", "model": "srv/external/API_BUSINESS_PARTNER" }
      "[production]":  { "kind": "odata-v2", "destination": "S4H_DEST" }
    }
  }
}
```
Source: https://cap.cloud.sap/docs/guides/using-services#mocking

---

### AP-CAP-SAP-05 🟠 — Receiving 'text/html' content type from SAP
```
❌ SYMPTOM: Error during request to remote service: Received content type 'text/html'
             which is not part of accepted content types

✅ ROOT CAUSES (check in order):
1. SAP system is returning an HTML login page → authentication failed (check destination credentials)
2. Wrong destination URL (missing /sap/opu/odata/sap/ prefix)
3. OData service not activated in /IWFND/MAINT_SERVICE
4. SAP system returning an HTML error page → check /IWFND/ERROR_LOG
```
Source: https://community.sap.com/t5/technology-q-a/reading-external-odata-api-from-cap/qaq-p/13678939

---

### AP-CAP-SAP-06 🟡 — Not adapting imported EDMX model
```js
// ❌ WRONG — use raw imported model with 200+ entities and fields
// All entities from API_BUSINESS_PARTNER exposed as-is

// ✅ CORRECT — project only what you need
using { API_BUSINESS_PARTNER as external } from '../srv/external/API_BUSINESS_PARTNER';

service MyService {
  // Project only relevant entity and fields
  entity BusinessPartners as projection on external.A_BusinessPartner {
    key BusinessPartner,
    BusinessPartnerFullName,
    BusinessPartnerType
  }
}
```
**Why**: Importing and exposing all entities bloats model, impacts performance, exposes sensitive fields.
Source: https://cap.cloud.sap/docs/guides/using-services#external-service-api

---

## 8. Performance Anti-Patterns (Cross-domain)

### AP-PERF-01 🟠 — N+1 query problem in RAP / CAP
```abap
" ❌ WRONG — one DB call per travel (N+1 problem)
LOOP AT lt_travels INTO DATA(ls_travel).
  SELECT SINGLE agency_name FROM zagency
    WHERE agency_id = @ls_travel-AgencyId
    INTO @DATA(lv_name).
ENDLOOP.

" ✅ CORRECT — one query for all agencies
SELECT agency_id, agency_name
  FROM zagency
  FOR ALL ENTRIES IN @lt_travels
  WHERE agency_id = @lt_travels-AgencyId
  INTO TABLE @DATA(lt_agencies).
```
**Why**: N+1 = N database roundtrips. With 1000 travels = 1000 DB calls.

---

### AP-PERF-02 🟡 — Fetching ALL FIELDS in READ ENTITIES
```abap
" ❌ WRONG — reads all fields including large text/binary
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel ALL FIELDS WITH CORRESPONDING #( keys )
  RESULT DATA(lt_result).

" ✅ CORRECT — request only needed fields
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel FIELDS ( TravelId OverallStatus BeginDate )
  WITH CORRESPONDING #( keys )
  RESULT DATA(lt_result).
```
**Why**: `ALL FIELDS` fetches everything including unused large/binary fields.
Source: https://help.sap.com/docs/abap-cloud/abap-rap/entity-manipulation-language-eml

---

### AP-PERF-03 🟡 — No index on frequently filtered CDS fields
```
❌ WRONG — filter on non-indexed field → full table scan
SELECT ... FROM ztravel WHERE agency_id = @lv_agency AND status = 'O'
(No secondary index on agency_id + status)

✅ CORRECT — create secondary index in SE11/ADT
Index: ZTRAVEL~001
Fields: agency_id, overall_status, begin_date
```
**Why**: Without index, large tables cause full scans regardless of CDS optimization.
Source: https://sapexpert.ai/news/2025-09-13-abap-rap-performance-diagnostics-real-world-checklist-for-2025/

---

### AP-PERF-04 🟡 — Using SAT/ST05 wrong way for RAP performance
```
Performance diagnosis tools for RAP — use in this order:

1. /IWFND/TRACES         → enable OData request tracing (see payload size, roundtrips)
2. /IWFND/GW_CLIENT      → replay OData calls manually without UI
3. SAT (ABAP Runtime Analysis) → profile ABAP execution in behavior implementation
4. ST05 (SQL Trace)      → capture exact DB SQL, see execution plans
5. ADT CDS Dependency Analyzer → check join complexity, view nesting depth
6. SE30 (old) or SAT (new) → measure method execution times
```
Source: https://sapexpert.ai/news/2025-09-13-abap-rap-performance-diagnostics-real-world-checklist-for-2025/

---

## Additional Sources for Anti-Patterns

| Domain | Reference |
|---|---|
| RAP best practices | https://aixsap.com/abap-rap-deep-dive-part-2-implementing-business-logic-validations-and-determinations-in-sap-s-4hana/ |
| RAP series (practical) | https://sachinartani.com/blog/sap-rap-series |
| CDS performance | https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/cds-view-performance-best-practices/ba-p/13559714 |
| CDS NULL-preserving JOIN | https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/cds-view-performance-best-practice-not-null-preserving-left-outer-join/ba-p/13579510 |
| CAP best practices | https://cap.cloud.sap/docs/node.js/best-practices |
| CAP providing services | https://cap.cloud.sap/docs/guides/providing-services |
| CAP consuming services | https://cap.cloud.sap/docs/guides/using-services |
| CAP remote services | https://cap.cloud.sap/docs/node.js/remote-services |
| RAP performance checklist | https://sapexpert.ai/news/2025-09-13-abap-rap-performance-diagnostics-real-world-checklist-for-2025/ |
| Clean ABAP | https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md |