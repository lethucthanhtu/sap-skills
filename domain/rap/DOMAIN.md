# RAP Domain — Router & Rules

## When to Read This File
Activate when user mentions: RAP, BDEF, behavior definition, managed, unmanaged,
draft, EML, MODIFY ENTITIES, READ ENTITIES, COMMIT ENTITIES, action, determination,
validation, business events, Event Mesh, BAPI wrapper, save_modified, strict(2),
late numbering, bgPF, authorization, augmentation, precheck, side effects, projection BDEF,
%tky, %key, %control, %cid, lhc_, lsc_, behavior pool, BO extension, /DMO/

---

## MANDATORY Rules for ALL RAP Responses

### Rule R1 — Architecture Decision First
Before writing any BDEF code, determine the correct implementation type:

```
New greenfield development → Z table exists or will be created?
  YES → Managed RAP (framework handles persistence)
  NO  → Ask user for more context

Wrapping existing BAPI/FM/legacy code?
  Wrapping ONLY in save sequence → Managed with unmanaged save (managed with additional save = WRONG choice here)
  Full custom persistence needed → Unmanaged RAP
  Note: "managed with additional save" = for extra side-effects only, NOT main persistence

Extending SAP standard RAP BO?
  → Behavior extension (use extend behavior for <standard_bo>)
  → Never copy/modify SAP standard BDEF directly

Rule of thumb (from SAP architect):
  "Start managed, switch to unmanaged only when the managed framework genuinely gets in your way."
```
Source: https://aixsap.com/abap-restful-application-programming-model-rap-a-senior-architects-practical-guide-to-building-modern-sap-applications/

---

### Rule R2 — Environment Check Before Writing BDEF
Check `references/environment-matrix.md` section 3 (RAP Features Matrix).

Critical checks:
- `strict(2)` → only available from S/4HANA 2021 (ABAP 7.56+). Always use for new dev on 2021+.
- Business Events → only from S/4HANA 2022 (ABAP 7.57+)
- Augmentation, Precheck → only from S/4HANA 2021 (ABAP 7.56+)
- CDS Table Entities as persistence → only from S/4HANA 2025 (ABAP 8.16+)
- Collaborative draft, cross-BO, tree views → only from S/4HANA 2025 (ABAP 8.16+)

---

### Rule R3 — EML Phase Awareness (Most Common Source of Bugs)
RAP has two clearly separated phases. Violations cause runtime dumps (`BEHAVIOR_ILLEGAL_STATEMENT`):

```
INTERACTION PHASE (handler methods: create, update, delete, action, determination on modify)
  ✅ Allowed: READ ENTITIES IN LOCAL MODE
  ✅ Allowed: MODIFY ENTITIES IN LOCAL MODE (except in READ handler!)
  ✅ Allowed: BAPI in TEST MODE only (simulation, no commit)
  ❌ FORBIDDEN: COMMIT WORK, BAPI_TRANSACTION_COMMIT, CALL FUNCTION IN UPDATE TASK
  ❌ FORBIDDEN: MODIFY ENTITIES without IN LOCAL MODE (causes service layer loop)
  ❌ FORBIDDEN: Direct DB INSERT/UPDATE/DELETE

SAVE SEQUENCE (saver class: finalize, check_before_save, save_modified, cleanup_finalize)
  ✅ Allowed: BAPI calls with COMMIT (via BAPI_TRANSACTION_COMMIT)
  ✅ Allowed: Direct DB operations (for unmanaged only)
  ✅ Allowed: CALL FUNCTION IN UPDATE TASK
  ❌ FORBIDDEN: MODIFY ENTITIES EML statements
  ❌ FORBIDDEN: READ ENTITIES IN LOCAL MODE (saver has no transactional buffer access)
```
Source: https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abapin_local_mode.htm
Source: https://sachinartani.com/blog/using-bapis-in-sap-rap

---

### Rule R4 — Always Use %tky for Draft-Enabled BOs
```abap
" %key  = primary key fields only
" %tky  = %key + %is_draft (transactional key)
" %is_draft = if_abap_behv=>mk-on  → draft instance
"           = if_abap_behv=>mk-off → active instance

" ALWAYS use %tky in draft-enabled BOs:
READ ENTITIES OF z_i_travel IN LOCAL MODE
  ENTITY Travel FIELDS ( Status )
  WITH CORRESPONDING #( keys )   " keys already contains %tky
  RESULT DATA(lt_result).

" NEVER construct keys manually without %is_draft for draft BOs:
" WITH VALUE #( ( TravelId = lv_id ) )  ← missing %is_draft = WRONG
```
Source: https://github.com/SAP-samples/abap-cheat-sheets/blob/main/08_EML_ABAP_for_RAP.md

---

### Rule R5 — Mandatory Response Structure
```
[Environment: <S/4 version>]
[RAP Type: Managed / Unmanaged / Managed with Unmanaged Save / Extension]
[strict mode: strict(1) / strict(2) / none]

<explanation>

<BDEF code>
<Behavior Implementation code>

⚠️ Phase violations to avoid:
- <specific phase rule relevant to the answer>

Sources:
- <cited SAP Help URL>
- <cited SAP sample/community URL>
```

---

## Domain File Routing

| User asks about... | Read file |
|---|---|
| Managed RAP from scratch, new BO | `references/managed.md` |
| Unmanaged RAP, save_modified, saver class | `references/unmanaged.md` |
| BAPI/FM wrapping in RAP | `references/bapi-wrapper.md` ← **read first for BAPI questions** |
| Extending SAP standard RAP BO | `references/standard-bo-extension.md` |
| Draft handling, draftEdit, draftActivate | `references/draft-handling.md` |
| Actions, static actions, factory actions | `references/actions-validations.md` |
| Validations, on save, field triggers | `references/actions-validations.md` |
| Determinations, on modify, on save | `references/actions-validations.md` |
| Business Events, Event Mesh, RAISE ENTITY EVENT | `references/business-events.md` |
| EML patterns, %tky, %cid, IN LOCAL MODE | `references/eml-patterns.md` ← **read for ANY EML question** |
| Validation not triggering, determination not firing | `references/validation-trigger-guide.md` |
| RAP performance, slow query, N+1 | `references/performance.md` |
| Authorization, get_global_authorizations | `references/authorization.md` |
| RAP unit testing, EML test doubles | `references/testing-eml.md` |
| Environment differences, strict(2), versions | `references/environment-diff.md` |

For cross-domain questions (RAP + OData + CAP): read RAP domain files + `domains/odata/DOMAIN.md` and/or `domains/cap/DOMAIN.md`.

---

## Quick Anti-Pattern Guard

Before returning any RAP code, scan for these — flag immediately if found:

| Pattern Found | Violation | Fix |
|---|---|---|
| `COMMIT WORK` in handler method | Phase violation → DUMP | Move to save_modified |
| `BAPI_TRANSACTION_COMMIT` in action/determination | Phase violation → DUMP | Move to save_modified |
| `CALL FUNCTION IN UPDATE TASK` in interaction phase | Phase violation → DUMP | Move to save_modified |
| `MODIFY ENTITIES` in READ handler | Side-effect violation → DUMP | Use only in modify handlers |
| `MODIFY ENTITIES` without `IN LOCAL MODE` | Infinite loop risk | Add IN LOCAL MODE |
| `SELECT` from DB in validation | Reads stale data | Use READ ENTITIES IN LOCAL MODE |
| `RAISE EXCEPTION` in behavior handler | Crashes OData with 500 | Use failed + reported structures |
| `WITH VALUE #( ( Id = lv_id ) )` in draft BO | Missing %is_draft | Use CORRESPONDING #( keys ) |
| `strict` keyword missing | Default strict(0) | Add strict(2) for new dev |
| `managed with additional save` for BAPI | Wrong choice | Use `managed with unmanaged save` |

---

## RAP Lifecycle — Visual Overview

```
┌─────────────────────────────────────────────────────────┐
│                  INTERACTION PHASE                      │
│                                                         │
│  CREATE / UPDATE / DELETE ──► Transactional Buffer      │
│  ACTIONS ──────────────────► Transactional Buffer       │
│  DETERMINATIONS (on modify)► Transactional Buffer       │
│                                                         │
│  Rules: IN LOCAL MODE | No COMMIT | BAPI test-mode only │
└────────────────────────┬────────────────────────────────┘
                         │  COMMIT ENTITIES / Save pressed
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   SAVE SEQUENCE                         │
│                                                         │
│  1. FINALIZE          ─ last derivations before save    │
│  2. CHECK_BEFORE_SAVE ─ final validation (unmanaged)    │
│  3. SAVE_MODIFIED     ─ actual persistence              │
│     └─ Managed:  framework writes to DB automatically   │
│     └─ Unmanaged: developer writes BAPI/DB calls here   │
│  4. CLEANUP_FINALIZE  ─ cleanup on success              │
│  5. CLEANUP           ─ cleanup on error / rollback     │
│                                                         │
│  Rules: BAPI allowed | COMMIT allowed | No EML MODIFY   │
└─────────────────────────────────────────────────────────┘
```

---

## BDEF Skeleton Templates

### Managed RAP (Greenfield — most common)
```abap
managed implementation in class zbp_z_i_travel unique;
strict ( 2 );
with draft;

define behavior for Z_I_Travel alias Travel
  persistent table ztravel
  draft table ztravel_d
  etag master LocalLastChangedAt
  lock master total etag LastChangedAt
  authorization master ( global )
{
  field ( readonly ) TravelId;
  field ( mandatory : create ) AgencyId, BeginDate, EndDate;

  create;
  update;
  delete;

  association _Booking { create; with draft; }

  action  ( features : instance ) acceptTravel result [1] $self;
  action  ( features : instance ) rejectTravel result [1] $self;

  validation validateDates     on save { create; field BeginDate, EndDate; }
  validation validateAgency    on save { create; field AgencyId; }

  determination setStatusOnCreate on modify { create; }
  determination setEtag           on modify { create; update; }

  side effects {
    field BeginDate  affects field TotalPrice;
    action acceptTravel affects field OverallStatus;
  }

  mapping for ztravel corresponding;
}
```

### Managed with Unmanaged Save (BAPI Wrapper — brownfield)
```abap
managed with unmanaged save          " ← KEY DIFFERENCE: not "additional save"
  implementation in class zbp_z_i_travel unique;
strict ( 2 );
with draft;

define behavior for Z_I_Travel alias Travel
  persistent table ztravel           " ← comment out if BAPI owns persistence
  draft table ztravel_d
  etag master LocalLastChangedAt
  lock master total etag LastChangedAt
  authorization master ( global )
{
  field ( readonly ) TravelId;
  create;
  update;
  delete;

  validation checkBeforeSave on save { create; update; }
  " ... actions, associations as needed
}
```

### Unmanaged RAP (Full control)
```abap
unmanaged implementation in class zbp_z_i_travel unique;
strict ( 2 );

define behavior for Z_I_Travel alias Travel
  lock master
  authorization master ( global )
  etag master EtagField
{
  field ( readonly ) TravelId;
  create;
  update;
  delete;

  mapping for ztravel
  {
    TravelId  = travel_id;
    AgencyId  = agency_id;
    EtagField = last_changed_at;
  }
}
```

---

## Admin Fields — Mandatory for strict(2)

Every RAP entity table and draft table MUST have these fields:

```abap
" In DDIC table (SE11 / ADT):
created_by          TYPE syuname         " who created
created_at          TYPE utclong         " when created (utclong, NOT timestamp!)
last_changed_by     TYPE syuname         " who last changed
last_changed_at     TYPE utclong         " total etag → used in: lock master total etag
local_last_changed_at TYPE utclong       " local etag → used in: etag master

" In BDEF:
etag master LocalLastChangedAt
lock master total etag LastChangedAt

" In Determination (auto-populate):
determination setAdminFields on modify { create; update; }
METHOD setAdminFields.
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( TravelId ) WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).

  DATA(lv_now) = cl_abap_context_info=>get_system_time_utclong( ).
  DATA(lv_user) = cl_abap_context_info=>get_user_alias( ).

  MODIFY ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel UPDATE FIELDS (
      LastChangedAt LocalLastChangedAt LastChangedBy
      CreatedBy CreatedAt )
    WITH VALUE #( FOR lt IN lt_travels
                  ( %tky             = lt-%tky
                    LocalLastChangedAt = lv_now
                    LastChangedAt      = lv_now
                    LastChangedBy      = lv_user
                    CreatedBy          = COND #( WHEN lt-%op-%create = if_abap_behv=>mk-on
                                                 THEN lv_user )
                    CreatedAt          = COND #( WHEN lt-%op-%create = if_abap_behv=>mk-on
                                                 THEN lv_now ) ) )
    REPORTED DATA(lt_reported).
ENDMETHOD.
```
Source: https://help.sap.com/docs/abap-cloud/abap-rap/managed-scenario

---

## Validation — Complete Pattern with State Messages

```abap
" BDEF:
validation validateDates on save { create; field BeginDate, EndDate; }

" Implementation (correct pattern with %state_area):
METHOD validateDates.
  " Step 1: Read from transactional buffer (NOT from DB!)
  READ ENTITIES OF z_i_travel IN LOCAL MODE
    ENTITY Travel FIELDS ( TravelId BeginDate EndDate )
    WITH CORRESPONDING #( keys )
    RESULT DATA(lt_travels).

  LOOP AT lt_travels INTO DATA(ls_travel).
    " Step 2: Clear previous state messages for this area
    APPEND VALUE #(
      %tky        = ls_travel-%tky
      %state_area = 'VALIDATE_DATES'   " identifies this validation's messages
    ) TO reported-travel.

    " Step 3: Check and report errors
    IF ls_travel-BeginDate IS INITIAL.
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky        = ls_travel-%tky
        %state_area = 'VALIDATE_DATES'
        %msg        = new_message_with_text(
                        severity = if_abap_behv_message=>severity-error
                        text     = 'Begin date is mandatory' )
        %element-BeginDate = if_abap_behv=>mk-on
      ) TO reported-travel.
    ENDIF.

    IF ls_travel-EndDate < ls_travel-BeginDate.
      APPEND VALUE #( %tky = ls_travel-%tky ) TO failed-travel.
      APPEND VALUE #(
        %tky        = ls_travel-%tky
        %state_area = 'VALIDATE_DATES'
        %msg        = new_message_with_text(
                        severity = if_abap_behv_message=>severity-error
                        text     = 'End date must be after begin date' )
        %element-EndDate = if_abap_behv=>mk-on
      ) TO reported-travel.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```
Source: https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/abenbdl_validations.htm
Source: https://community.sap.com/t5/abap-blog-posts/validation-in-draft-with-state-messages-in-rap/ba-p/14228996

---

## Validation Not Triggering — Debug Checklist

When validation does not fire, check in this exact order:

```
1. BDEF interface view — does validation have correct field trigger?
   validation validateDates on save { create; field BeginDate, EndDate; }
                                                    ↑ field name must match CDS field name (case-sensitive)

2. Projection BDEF — is validation exposed?
   use validation validateDates;   ← missing this = validation never called from UI

3. Draft scenario — validation runs on draftActivate (save button), NOT on field change
   For real-time field feedback: use DETERMINATION on modify + side effects, not validation

4. Method name — exactly matches BDEF declaration?
   BDEF:   validation validateDates  ...
   Method: METHOD validateDates.      ← must be identical, case-sensitive in ABAP Cloud

5. READ ENTITIES — are you reading from DB instead of buffer?
   SELECT SINGLE FROM ztravel ...     ← WRONG: reads old data, not current buffer
   READ ENTITIES IN LOCAL MODE ...    ← CORRECT: reads from transactional buffer

6. EML MODIFY inside validation?
   ❌ FORBIDDEN: validations must be read-only
   Use determination for field derivation, validation only for checks

7. %state_area — did you clear it at start of method?
   APPEND VALUE #( %tky = ... %state_area = 'MY_AREA' ) TO reported-...
   ← Without this, old error messages from previous save attempts persist
```
Source: https://help.sap.com/docs/abap-cloud/abap-rap/validations

---

## Sources

| Topic | URL |
|---|---|
| RAP Overview | https://help.sap.com/docs/abap-cloud/abap-rap/abap-restful-application-programming-model |
| RAP Managed Scenario | https://help.sap.com/docs/abap-cloud/abap-rap/managed-scenario |
| RAP Unmanaged Scenario | https://help.sap.com/docs/abap-cloud/abap-rap/unmanaged-scenario |
| EML Cheat Sheet | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/08_EML_ABAP_for_RAP.md |
| BDL Cheat Sheet | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/36_RAP_Behavior_Definition_Language.md |
| RAP Validations | https://help.sap.com/docs/abap-cloud/abap-rap/validations |
| RAP Determinations | https://help.sap.com/docs/abap-cloud/abap-rap/determinations |
| RAP Actions | https://help.sap.com/docs/abap-cloud/abap-rap/actions |
| RAP Draft | https://help.sap.com/docs/abap-cloud/abap-rap/draft-concept |
| IN LOCAL MODE docs | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abapin_local_mode.htm |
| BAPI in RAP (Sachin Artani) | https://sachinartani.com/blog/using-bapis-in-sap-rap |
| BAPI Wrapper Tutorial (SAP) | https://developers.sap.com/tutorials/abap-s4hanacloud-purchasereq-integrate-wrapper.html |
| RAP640 Workshop (BAPI wrapper) | https://github.com/SAP-samples/abap-platform-rap640 |
| RAP State Messages | https://community.sap.com/t5/abap-blog-posts/validation-in-draft-with-state-messages-in-rap/ba-p/14228996 |
| RAP Architect Guide | https://aixsap.com/abap-restful-application-programming-model-rap-a-senior-architects-practical-guide-to-building-modern-sap-applications/ |
| RAP Practical Series | https://sachinartani.com/blog/sap-rap-series |
| SFlight Reference (2023/2025) | https://github.com/SAP-samples/abap-platform-refscen-flight |
| RAP Workshops | https://github.com/SAP-samples/abap-platform-rap-workshops |