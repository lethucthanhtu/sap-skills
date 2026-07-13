# RAP — Unit Testing & EML Test Doubles

Complete guide to unit-testing RAP business objects: the ABAP Unit test-class skeleton,
data test doubles (`cl_cds_test_environment`, `cl_osql_test_environment`), testing
validations / determinations / actions / feature control by calling handler methods
directly, and the two BO test-double frameworks — the **transactional buffer double**
(`cl_botd_txbufdbl_bo_test_env`) and the **mock EML API** double
(`cl_botd_mockemlapi_bo_test_env`). All code in this file is checked against the
**ABAP Flight Reference Scenario — branch `ABAP-platform-cloud`** and the
**ABAP Cheat Sheets** (SAP-samples).

> **Read this file when:** the question is about RAP unit tests, ABAP Unit for a behavior
> pool, `FOR TESTING`, `RISK LEVEL HARMLESS`, `DURATION SHORT`, `cl_cds_test_environment`,
> `cl_osql_test_environment`, `insert_test_data`, `clear_doubles`, test doubles, mocking a
> BO, `cl_botd_txbufdbl_bo_test_env`, `cl_botd_mockemlapi_bo_test_env`, `configure_call`,
> `when_input`/`then_set_output`, testing a validation/determination/action, asserting
> `failed`/`reported`/`mapped`, `TABLE FOR ACTION RESULT`, `ROLLBACK ENTITIES` in tests.

---

## Table of Contents

1. [Overview — What to test and how to isolate](#1-overview--what-to-test-and-how-to-isolate)
2. [Test class skeleton](#2-test-class-skeleton)
3. [Data test doubles — CDS and OSQL environments](#3-data-test-doubles--cds-and-osql-environments)
4. [Testing validations](#4-testing-validations)
5. [Testing determinations](#5-testing-determinations)
6. [Testing actions](#6-testing-actions)
7. [Testing feature control & authorization handlers](#7-testing-feature-control--authorization-handlers)
8. [Transactional buffer double — `cl_botd_txbufdbl_bo_test_env`](#8-transactional-buffer-double--cl_botd_txbufdbl_bo_test_env)
9. [Mock EML API double — `cl_botd_mockemlapi_bo_test_env`](#9-mock-eml-api-double--cl_botd_mockemlapi_bo_test_env)
10. [Choosing the right approach](#10-choosing-the-right-approach)
11. [Environment differences](#11-environment-differences)
12. [Anti-Patterns](#12-anti-patterns)
13. [Debug & Troubleshooting Checklist](#13-debug--troubleshooting-checklist)
14. [Sources](#14-sources)

---

## 1. Overview — What to test and how to isolate

RAP unit tests come in two conceptual layers. Pick the layer that matches *what you own*:

```
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER A — Test YOUR handler logic directly (most common)              │
│                                                                        │
│  You instantiate the local handler class (lhc_/lsc_) with             │
│  CREATE OBJECT ... FOR TESTING and call a validation / determination / │
│  action / feature method directly, then assert on failed/reported/     │
│  result/mapped. Data reads inside the handler are isolated with        │
│  CDS + OSQL test doubles.                                              │
│                                                                        │
│  Double: cl_cds_test_environment + cl_osql_test_environment            │
├──────────────────────────────────────────────────────────────────────┤
│  LAYER B — Test through the RAP runtime with a BO double               │
│                                                                        │
│  B1. Transactional buffer double (cl_botd_txbufdbl_bo_test_env):        │
│      run real EML (MODIFY/READ) against a doubled buffer — good for     │
│      testing that YOUR BO reacts correctly end-to-end.                 │
│                                                                        │
│  B2. Mock EML API double (cl_botd_mockemlapi_bo_test_env):             │
│      mock the RESPONSES of a BO so you can test a CONSUMER class that   │
│      calls that BO via EML — the BO itself is not executed.            │
└──────────────────────────────────────────────────────────────────────┘
```

What is worth testing in a RAP BO:

| Target | Layer | Why |
|---|---|---|
| Validations | A | Deterministic pass/fail on `failed`/`reported` |
| Determinations | A | Derived field values in the buffer |
| Actions | A | `result` table + buffer side-effects |
| Feature control (`get_*_features`) | A | `%features` for a given instance state |
| Authorization (`get_*_authorizations`) | A | `result-%create/%update/...` per role |
| A class that *calls* a BO | B2 | Isolate your consumer from the real BO |
| End-to-end BO behavior via EML | B1 | Integration-style test of the whole BO |

Golden rules that apply to every layer: keep tests `RISK LEVEL HARMLESS` and
`DURATION SHORT`; never touch real persistence — always use doubles and end write tests
with `ROLLBACK ENTITIES`; and reset doubles between tests in `setup`.

---

## 2. Test class skeleton

The canonical skeleton for Layer A (verified — managed travel BO test class):

```abap
"! @testing BDEF:Z_I_Travel
CLASS ltc_managed DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    CLASS-DATA:
      class_under_test     TYPE REF TO lhc_travel,             " your local handler class
      cds_test_environment TYPE REF TO if_cds_test_environment,
      sql_test_environment TYPE REF TO if_osql_test_environment.

    CLASS-METHODS:
      class_setup,      " instantiate CUT + create test doubles (once per class)
      class_teardown.   " destroy test environments (once per class)

    METHODS:
      setup,            " reset doubles before EACH test
      teardown,         " reset transactional buffer after EACH test

      validate_status_invalid FOR TESTING,   " one test method per case
      set_status_accepted     FOR TESTING.
ENDCLASS.

CLASS ltc_managed IMPLEMENTATION.

  METHOD class_setup.
    CREATE OBJECT class_under_test FOR TESTING.
    cds_test_environment = cl_cds_test_environment=>create( i_for_entity = 'Z_I_Travel' ).
    sql_test_environment = cl_osql_test_environment=>create(
                             i_dependency_list = VALUE #( ( 'ZCUSTOMER' ) ) ).
  ENDMETHOD.

  METHOD setup.
    cds_test_environment->clear_doubles( ).
    sql_test_environment->clear_doubles( ).
  ENDMETHOD.

  METHOD teardown.
    ROLLBACK ENTITIES.                                 "#EC CI_ROLLBACK
  ENDMETHOD.

  METHOD class_teardown.
    cds_test_environment->destroy( ).
    sql_test_environment->destroy( ).
  ENDMETHOD.

  " ... test methods below ...
ENDCLASS.
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/managed/#dmo#bp_travel_m.clas.testclasses.abap` — adapted to namespace `Z_`.

Key points:

- `CREATE OBJECT class_under_test FOR TESTING.` — the `FOR TESTING` addition creates the
  handler instance without RAP runtime wiring, so you can call its methods directly.
- `class_under_test` is typed to the **local handler class** (`lhc_travel` / `lsc_...`),
  which is visible to the test include because tests live in the same class pool.
- Lifecycle: `class_setup`/`class_teardown` run once per test class; `setup`/`teardown`
  run around each test method. Reset doubles in `setup`, roll back the buffer in
  `teardown`.

```abap
" ❌ WRONG — RISK LEVEL / DURATION missing → ATC/CI complains, test may hit real DB rules
CLASS ltc_managed DEFINITION FINAL FOR TESTING.

" ✅ CORRECT — always classify the test
CLASS ltc_managed DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.
```

---

## 3. Data test doubles — CDS and OSQL environments

Handlers read from the transactional buffer, but the initial data (active records read by
validations, joined lookups, etc.) comes from CDS views and DB tables. Isolate both:

```abap
" CDS double — for the BO's own CDS entity (what READ ENTITIES resolves to)
cds_test_environment = cl_cds_test_environment=>create( i_for_entity = 'Z_I_Travel' ).

" OSQL double — for plain DB tables / CDS your handler SELECTs directly
sql_test_environment = cl_osql_test_environment=>create(
                         i_dependency_list = VALUE #( ( 'ZCUSTOMER' ) ( 'ZAGENCY' ) ) ).
```

Insert mock data before the code under test runs, using the **underlying table type**:

```abap
DATA travel_mock_data TYPE STANDARD TABLE OF ztravel.
travel_mock_data = VALUE #( ( travel_id = '52' overall_status = 'T' ) ).
cds_test_environment->insert_test_data( travel_mock_data ).

DATA customer_mock TYPE STANDARD TABLE OF zcustomer.
customer_mock = VALUE #( ( customer_id = '000006' ) ).
sql_test_environment->insert_test_data( customer_mock ).
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/managed/#dmo#bp_travel_m.clas.testclasses.abap`.

API summary (verified):

| Method | Purpose |
|---|---|
| `cl_cds_test_environment=>create( i_for_entity = ... )` | Create a double for a CDS entity |
| `cl_osql_test_environment=>create( i_dependency_list = ... )` | Create doubles for DB tables / CDS the handler queries directly |
| `->insert_test_data( itab )` | Seed the double with rows (itab typed to the underlying table) |
| `->clear_doubles( )` | Remove all seeded rows (call in `setup`) |
| `->destroy( )` | Tear down the environment (call in `class_teardown`) |

```abap
" ❌ WRONG — seeding real tables / no double → test depends on client data, not repeatable
INSERT ztravel FROM TABLE @travel_mock_data.

" ✅ CORRECT — seed the CDS double
cds_test_environment->insert_test_data( travel_mock_data ).
```

---

## 4. Testing validations

Call the validation handler method directly with `keys`, then assert on `failed` and
`reported`. This full example is verified:

```abap
METHOD validate_status_invalid.

  " 1. Seed the CDS double with an instance that must FAIL the validation
  DATA travel_mock_data TYPE STANDARD TABLE OF ztravel.
  travel_mock_data = VALUE #( ( travel_id = '52' overall_status = 'T' ) ).  " 'T' is invalid
  cds_test_environment->insert_test_data( travel_mock_data ).

  " 2. Declare the response structures the handler fills
  DATA failed   TYPE RESPONSE FOR FAILED   LATE Z_I_Travel.
  DATA reported TYPE RESPONSE FOR REPORTED LATE Z_I_Travel.

  " 3. Call the validation method under test
  class_under_test->validate_travel_status(
    EXPORTING keys     = CORRESPONDING #( travel_mock_data )
    CHANGING  failed   = failed
              reported = reported ).

  " 4. Assert the failure was reported for the right instance and field
  cl_abap_unit_assert=>assert_equals(
    act = lines( failed-travel ) exp = 1 msg = 'lines in failed-travel' ).
  cl_abap_unit_assert=>assert_equals(
    act = failed-travel[ 1 ]-travel_id exp = '52' msg = 'travel id in failed-travel' ).

  cl_abap_unit_assert=>assert_equals(
    act = lines( reported-travel ) exp = 1 msg = 'lines in reported-travel' ).
  cl_abap_unit_assert=>assert_equals(
    act = reported-travel[ 1 ]-%element-overall_status
    exp = if_abap_behv=>mk-on msg = 'flagged field overall_status' ).
  cl_abap_unit_assert=>assert_bound(
    act = reported-travel[ 1 ]-%msg msg = 'message reference present' ).

ENDMETHOD.
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/managed/#dmo#bp_travel_m.clas.testclasses.abap` (`validate_travel_status_invalid`)
— adapted to `Z_`.

For the *passing* case, assert the responses are empty:

```abap
cl_abap_unit_assert=>assert_initial( act = failed   msg = 'failed'   ).
cl_abap_unit_assert=>assert_initial( act = reported msg = 'reported' ).
```

Notes:

- Use `RESPONSE FOR FAILED LATE` / `REPORTED LATE` for validations and determinations
  (they run in the *late* phase). Actions use `EARLY` (Section 6).
- `keys = CORRESPONDING #( mock_data )` builds the key table the handler expects from the
  mock rows.
- Assert on `%element-<field>` to prove the correct field was flagged, and
  `assert_bound( ...-%msg )` to prove a message was attached.

---

## 5. Testing determinations

Same pattern as validations, but the assertion checks **derived buffer values**. Seed the
input, call the determination, then read the buffer with a local-mode EML `READ ENTITIES`
(or assert on `reported` for messages a determination raises):

```abap
METHOD set_status_on_create.

  DATA travel_mock_data TYPE STANDARD TABLE OF ztravel.
  travel_mock_data = VALUE #( ( travel_id = '60' overall_status = '' ) ).
  cds_test_environment->insert_test_data( travel_mock_data ).

  DATA reported TYPE RESPONSE FOR REPORTED LATE Z_I_Travel.

  class_under_test->set_status_on_create(
    EXPORTING keys     = CORRESPONDING #( travel_mock_data )
    CHANGING  reported = reported ).

  " Read back from the transactional buffer to check the derived value
  READ ENTITY Z_I_Travel
    FIELDS ( travel_id overall_status )
    WITH CORRESPONDING #( travel_mock_data )
    RESULT DATA(read_result).

  cl_abap_unit_assert=>assert_equals(
    act = read_result[ 1 ]-overall_status exp = 'O' msg = 'status defaulted to Open' ).

ENDMETHOD.
```
Pattern basis: verified `READ ENTITY ... RESULT` buffer check in
`src/managed/#dmo#bp_travel_m.clas.testclasses.abap` (`set_status_accepted`); the
determination method signature (`keys`, `CHANGING reported`) follows the standard
determination-handler shape — generate the exact signature with the ADT quick-fix for your
BDEF, as method parameter names depend on the determination declaration.

⚠️ The determination *method name* and whether it also fills `failed` depend on your BDEF;
the buffer-read assertion pattern is the verified part.

---

## 6. Testing actions

Actions return a `result` table and may change the buffer. Declare `TABLE FOR ACTION
RESULT` plus `EARLY` response structures. This full example is verified:

```abap
METHOD set_status_accepted.

  " 1. Seed several instances with different starting statuses
  DATA travel_mock_data TYPE STANDARD TABLE OF ztravel.
  travel_mock_data = VALUE #( ( travel_id = '42' overall_status = 'A' )
                              ( travel_id = '43' overall_status = 'B' )
                              ( travel_id = '44' overall_status = 'X' )
                              ( travel_id = '45' overall_status = '' ) ).
  cds_test_environment->insert_test_data( travel_mock_data ).

  " 2. Declare action result + EARLY responses
  DATA result   TYPE TABLE FOR ACTION RESULT Z_I_Travel\\travel~acceptTravel.
  DATA mapped   TYPE RESPONSE FOR MAPPED   EARLY Z_I_Travel.
  DATA failed   TYPE RESPONSE FOR FAILED   EARLY Z_I_Travel.
  DATA reported TYPE RESPONSE FOR REPORTED EARLY Z_I_Travel.

  " 3. Call the action handler
  class_under_test->set_status_accepted(
    EXPORTING keys     = CORRESPONDING #( travel_mock_data )
    CHANGING  result   = result
              mapped   = mapped
              failed   = failed
              reported = reported ).

  " 4. No errors expected
  cl_abap_unit_assert=>assert_initial( act = mapped   msg = 'mapped'   ).
  cl_abap_unit_assert=>assert_initial( act = failed   msg = 'failed'   ).
  cl_abap_unit_assert=>assert_initial( act = reported msg = 'reported' ).

  " 5. Assert the action result: every instance now returns status 'A'
  DATA exp LIKE result.
  exp = VALUE #( ( travel_id = 42 %param-travel_id = '42' %param-overall_status = 'A' )
                 ( travel_id = 43 %param-travel_id = '43' %param-overall_status = 'A' )
                 ( travel_id = 44 %param-travel_id = '44' %param-overall_status = 'A' )
                 ( travel_id = 45 %param-travel_id = '45' %param-overall_status = 'A' ) ).

  DATA act LIKE result.
  act = CORRESPONDING #( result MAPPING travel_id = travel_id
                           ( %param = %param MAPPING travel_id      = travel_id
                                                     overall_status = overall_status
                                                     EXCEPT * )
                           EXCEPT * ).
  cl_abap_unit_assert=>assert_equals( exp = exp act = act msg = 'action result' ).

  " 6. Also verify the buffer was actually modified
  READ ENTITY Z_I_Travel
    FIELDS ( travel_id overall_status )
    WITH CORRESPONDING #( travel_mock_data )
    RESULT DATA(read_result).

  act = VALUE #( FOR t IN read_result
                 ( travel_id = t-travel_id
                   %param-travel_id = t-travel_id
                   %param-overall_status = t-overall_status ) ).
  cl_abap_unit_assert=>assert_equals( exp = exp act = act msg = 'read result' ).

ENDMETHOD.
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/managed/#dmo#bp_travel_m.clas.testclasses.abap` (`set_status_accepted`)
— adapted to `Z_`.

Notes:

- `TABLE FOR ACTION RESULT Z_I_Travel\\travel~acceptTravel` — the `\\alias~action` syntax
  types the result table for a specific action.
- Actions use `EARLY` response variants (`MAPPED EARLY`, `FAILED EARLY`, `REPORTED EARLY`).
- Assert both the returned `result` **and** the buffer state via a follow-up `READ ENTITY`
  — an action can return a result yet fail to persist the change, and vice versa.

---

## 7. Testing feature control & authorization handlers

Feature and authorization methods are ordinary handler methods — test them the same way.

Feature control (`get_instance_features`) — seed an instance, call, assert on `result`:

```abap
METHOD get_features_accepted.

  DATA travel_mock_data TYPE STANDARD TABLE OF ztravel.
  travel_mock_data = VALUE #( ( travel_id = '42' overall_status = 'A' ) ).  " accepted
  cds_test_environment->insert_test_data( travel_mock_data ).

  DATA result   TYPE TABLE FOR INSTANCE FEATURES RESULT Z_I_Travel.
  DATA failed   TYPE RESPONSE FOR FAILED   EARLY Z_I_Travel.
  DATA reported TYPE RESPONSE FOR REPORTED EARLY Z_I_Travel.

  class_under_test->get_instance_features(
    EXPORTING keys               = CORRESPONDING #( travel_mock_data )
              requested_features = VALUE #( %action-acceptTravel = if_abap_behv=>mk-on )
    CHANGING  result   = result
              failed   = failed
              reported = reported ).

  " An already-accepted travel must have acceptTravel disabled
  cl_abap_unit_assert=>assert_equals(
    act = result[ 1 ]-%action-acceptTravel
    exp = if_abap_behv=>fc-o-disabled msg = 'acceptTravel disabled when accepted' ).

ENDMETHOD.
```
Pattern basis: the flight reference scenario test class declares feature tests
(`get_features_open` / `get_features_accepted` / ...) over the same `class_under_test`
and CDS double. The exact `requested_features` / result-typing follow the standard
`get_instance_features` handler shape (see `authorization.md` Section 5 for the verified
handler); ⚠️ generate the precise method signature via the ADT quick-fix for your BDEF.

Authorization (`get_instance_authorizations` / `get_global_authorizations`) — same idea:
seed data, pass `requested_authorizations`, assert `result-%update` /
`result-%create` equals `if_abap_behv=>auth-allowed` or `auth-unauthorized`. See
`authorization.md` for the handler internals.

⚠️ Authorization tests that depend on the *current user's* roles are inherently
environment-dependent. The reference scenario keeps auth checks demoable by simulating a
granted result; assert the branch you can control (e.g. status-based feature control)
rather than the live `AUTHORITY-CHECK` outcome.

---

## 8. Transactional buffer double — `cl_botd_txbufdbl_bo_test_env`

Use this when you want to exercise **your own BO end-to-end through the RAP runtime** (real
EML `MODIFY`/`READ`), but against a doubled transactional buffer instead of the database.

Setup (verified):

```abap
CLASS ltc_txbufdbl DEFINITION FINAL FOR TESTING
  DURATION SHORT RISK LEVEL HARMLESS.
  PRIVATE SECTION.
    CLASS-DATA:
      environment TYPE REF TO if_botd_txbufdbl_bo_test_env,
      double      TYPE REF TO if_botd_mockemlapi_test_double.
    CLASS-METHODS class_setup.
    CLASS-METHODS class_teardown.
    METHODS setup.
    METHODS test_update FOR TESTING RAISING cx_static_check.
ENDCLASS.

CLASS ltc_txbufdbl IMPLEMENTATION.

  METHOD class_setup.
    " a. Declare which BDEF dependencies get a double
    DATA(env_config) = cl_botd_txbufdbl_bo_test_env=>prepare_environment_config(
                       )->set_bdef_dependencies( VALUE #( ( 'Z_I_Travel' ) ) ).
    " b. Create the environment (and the doubles)
    environment = cl_botd_txbufdbl_bo_test_env=>create( environment_config = env_config ).
  ENDMETHOD.

  METHOD setup.
    environment->clear_doubles( ).
  ENDMETHOD.

  METHOD class_teardown.
    environment->destroy( ).
  ENDMETHOD.
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/managed/#dmo#tc_botd_travel_m_demos.clas.testclasses.abap`
(class `ltcl_txbufdbl_variant_demos`).

Inside a test, if the BO uses early numbering with read-only keys, register a fields
handler so the double can assign keys, then seed the buffer with a `CREATE` EML and test
your `UPDATE`/`READ` (verified API calls):

```abap
double = environment->get_test_double( 'Z_I_Travel' ).
double->configure_additional_behavior( )->set_fields_handler( fields_handler = NEW ltd_fields_handler( ) ).

" seed buffer with CREATE EML, then run the UPDATE you want to test, then assert via READ
```
`configure_additional_behavior( )->set_fields_handler( )` is verified; the `ltd_fields_handler`
is a local class you implement to hand out key values. ⚠️ The exact interface it implements
depends on your numbering scenario — generate it from ADT rather than guessing.

---

## 9. Mock EML API double — `cl_botd_mockemlapi_bo_test_env`

Use this to test a **consumer class** that calls a BO via EML. You mock the BO's responses
so the BO itself never runs — the test verifies *your consumer's* handling of the result.

Setup (verified):

```abap
CLASS ltc_mockemlapi DEFINITION FINAL FOR TESTING
  DURATION SHORT RISK LEVEL HARMLESS.
  PRIVATE SECTION.
    CLASS-DATA:
      environment TYPE REF TO if_botd_mockemlapi_bo_test_env,
      double      TYPE REF TO if_botd_mockemlapi_test_double,
      cut         TYPE REF TO zcl_travel_consumer.    " the class under test
    CLASS-METHODS class_setup.
    CLASS-METHODS class_teardown.
    METHODS setup.
    METHODS isolate_create FOR TESTING RAISING cx_static_check.
ENDCLASS.

CLASS ltc_mockemlapi IMPLEMENTATION.

  METHOD class_setup.
    DATA(env_config) = cl_botd_mockemlapi_bo_test_env=>prepare_environment_config(
                       )->set_bdef_dependencies( VALUE #( ( 'Z_I_Travel' ) ) ).
    environment = cl_botd_mockemlapi_bo_test_env=>create( environment_config = env_config ).
    cut = NEW #( ).
  ENDMETHOD.

  METHOD setup.
    environment->clear_doubles( ).
  ENDMETHOD.

  METHOD class_teardown.
    environment->destroy( ).
  ENDMETHOD.
```

Configure the mocked call and run the consumer (verified API chain):

```abap
METHOD isolate_create.
  " 1. Input the consumer will send
  DATA create_instances TYPE TABLE FOR CREATE Z_I_Travel.
  create_instances = VALUE #( ( %cid = 'T1' agency_id = '000111' customer_id = '000006' ) ).

  " 2. Response the mock should return
  DATA mapped TYPE RESPONSE FOR MAPPED EARLY Z_I_Travel.
  mapped-travel = VALUE #( ( %cid = 'T1' travel_id = 987 ) ).

  " 3. Build input/output configs via the builder factory
  DATA(in_builder)  = cl_botd_mockemlapi_bldrfactory=>get_input_config_builder( )->for_modify( ).
  DATA(out_builder) = cl_botd_mockemlapi_bldrfactory=>get_output_config_builder( )->for_modify( ).

  DATA(eml_input) = in_builder->build_entity_part( 'Z_I_Travel'
                    )->set_instances_for_create( create_instances ).
  DATA(input)  = in_builder->build_input_for_eml( )->add_entity_part( eml_input ).
  DATA(output) = out_builder->build_output_for_eml( )->set_mapped( mapped ).

  " 4. Program the double: when this input arrives, return that output
  double = environment->get_test_double( 'Z_I_Travel' ).
  double->configure_call( )->for_modify( )->when_input( input )->then_set_output( output ).

  " 5. Run the consumer and assert on what IT returns
  cut->create_travel( EXPORTING travel = create_instances
                      IMPORTING mapped = DATA(mapped_cut) ).
  cl_abap_unit_assert=>assert_not_initial( mapped_cut ).
ENDMETHOD.
```
Source: SAP-samples/abap-platform-refscen-flight (branch `ABAP-platform-cloud`),
`src/managed/#dmo#tc_botd_travel_m_demos.clas.testclasses.abap`
(class `ltcl_mockemlapi_variant_demos`, method `isolate_create`) — adapted to `Z_`.

Note: in the MOCKEMLAPI variant the `%control` structure is ignored when matching the EML
input against the configured input.

---

## 10. Choosing the right approach

| You want to test... | Use | Executes the real BO? |
|---|---|---|
| A single validation / determination / action / feature / auth handler | Layer A: `CREATE OBJECT ... FOR TESTING` + CDS/OSQL doubles | The one handler method only |
| The whole BO end-to-end via EML (create → validate → save reactions) | `cl_botd_txbufdbl_bo_test_env` | Yes, against a doubled buffer |
| A class that *calls* another BO (isolate the caller) | `cl_botd_mockemlapi_bo_test_env` | No — responses are mocked |
| Only the data your handler reads (CDS view / DB table) | `cl_cds_test_environment` / `cl_osql_test_environment` | n/a (data layer) |

Default to Layer A: it is the fastest, most focused, and least brittle. Reach for the
buffer double only for genuine end-to-end cases, and the mock EML API only when the code
under test is a *consumer* of a BO.

```abap
" ❌ WRONG — spinning up a full BO double to check one validation rule
environment = cl_botd_txbufdbl_bo_test_env=>create( ... ).   " overkill + slow

" ✅ CORRECT — call the validation handler directly with a CDS double
class_under_test->validate_travel_status( EXPORTING keys = ... CHANGING failed reported ).
```

---

## 11. Environment differences

Evidence from the flight reference scenario branches (verified by inspecting the source):

- Branch **`ABAP-platform-cloud`** contains the full test suite: direct handler tests with
  `cl_cds_test_environment` / `cl_osql_test_environment`, plus the BO-double demo class
  using `cl_botd_txbufdbl_bo_test_env` and `cl_botd_mockemlapi_bo_test_env`.
- The ABAP Cheat Sheet `14_ABAP_Unit_Tests.md` documents the same four classes.

What this establishes:

- **ABAP Cloud (S/4HANA Cloud Public / BTP)** and modern **S/4HANA On-Premise**: the test
  double frameworks above are available and are the recommended approach.
- **ECC**: no RAP, so none of this applies. ECC uses classic ABAP Unit only; there is no
  behavior pool, no EML, and no RAP test doubles.

⚠️ **Not verifiable in this session** (no access to help.sap.com): the exact minimum
S/4HANA On-Premise release / ABAP SP in which each test-double class first shipped. The
reference-scenario 2020/2021 branches were not exhaustively checked for these classes.
Confirm the availability for your specific release in ADT / release notes before relying
on it. See `environment-diff.md` (once created) for a full version matrix.

---

## 12. Anti-Patterns

**1. Writing to real persistence in a test**

```abap
" ❌ WRONG
INSERT ztravel FROM TABLE @mock_data.
COMMIT ENTITIES.

" ✅ CORRECT — seed a double, and never commit; roll back the buffer in teardown
cds_test_environment->insert_test_data( mock_data ).
" ... test ... then in teardown: ROLLBACK ENTITIES.
```

**2. Not resetting doubles between tests**

```abap
" ❌ WRONG — leftover rows from a previous test leak in
METHOD setup. ENDMETHOD.

" ✅ CORRECT
METHOD setup.
  cds_test_environment->clear_doubles( ).
  sql_test_environment->clear_doubles( ).
ENDMETHOD.
```

**3. Omitting `RISK LEVEL` / `DURATION`**

```abap
" ❌ WRONG
CLASS ltc_x DEFINITION FINAL FOR TESTING.

" ✅ CORRECT
CLASS ltc_x DEFINITION FINAL FOR TESTING DURATION SHORT RISK LEVEL HARMLESS.
```

**4. Wrong response phase (`LATE` vs `EARLY`)**

```abap
" ❌ WRONG — actions use EARLY, not LATE
DATA failed TYPE RESPONSE FOR FAILED LATE Z_I_Travel.   " for an action test

" ✅ CORRECT — validations/determinations = LATE; actions = EARLY
DATA failed TYPE RESPONSE FOR FAILED EARLY Z_I_Travel.  " for an action
```

**5. Asserting only the result, never the buffer (for actions/determinations)**

```abap
" ❌ WRONG — result looks right but the change was never applied to the buffer
cl_abap_unit_assert=>assert_equals( exp = exp act = result ).

" ✅ CORRECT — also READ ENTITY and assert the buffer state
READ ENTITY Z_I_Travel FIELDS ( ... ) WITH CORRESPONDING #( mock_data ) RESULT DATA(r).
```

**6. Using the buffer double when a direct handler test suffices**

```abap
" ❌ WRONG — heavy BO double for one rule (see Section 10)
" ✅ CORRECT — CREATE OBJECT ... FOR TESTING + CDS double
```

**7. Mocking your own BO to "test" it**

```abap
" ❌ WRONG — configuring then_set_output on the BO you are trying to test
" → you only test the mock, not your logic. Use MOCKEMLAPI to isolate a CONSUMER,
"   TXBUFDBL or direct handler tests to test the BO itself.
```

**8. Depending on live user authorization in a unit test**

```abap
" ❌ WRONG — asserting AUTHORITY-CHECK outcome that varies by tester's roles
" ✅ CORRECT — assert deterministic, controllable branches (status-based features, etc.)
```

---

## 13. Debug & Troubleshooting Checklist

**Test fails with a DB / persistence error**

```
1. Did you create a CDS/OSQL double for every entity the handler reads?
   → cl_cds_test_environment for the BO entity; cl_osql_test_environment for
     directly-SELECTed tables/CDS (i_dependency_list).
2. Did you insert_test_data BEFORE calling the handler?
3. Is the mock itab typed to the underlying table (ztravel), not the CDS entity?
```

**Handler returns empty failed/reported when you expect an error**

```
1. Did the seeded data actually violate the rule? (double-check the mock values)
2. Are you calling the correct handler method name (case-sensitive)?
3. keys = CORRESPONDING #( mock_data ) — do the key fields line up?
4. For draft BOs, keys must carry %is_draft — build them from the real key table.
```

**Test data leaks between tests**

```
1. clear_doubles( ) in setup (runs before each test)?
2. ROLLBACK ENTITIES in teardown for tests that MODIFY the buffer?
3. destroy( ) only in class_teardown (once), not in setup.
```

**Numbering error in the transactional buffer double**

```
1. Early numbering + read-only keys → register a fields handler:
   double->configure_additional_behavior( )->set_fields_handler( ... ).
2. Seed instances via a CREATE EML on the double before testing UPDATE/READ.
```

**MOCKEMLAPI double returns nothing**

```
1. Does when_input( ) match the consumer's actual EML input? (%control is ignored on match)
2. Did you set both input (add_entity_part) and output (set_mapped/set_failed)?
3. get_test_double( '<BDEF name>' ) uses the exact interface BDEF name.
```

---

## 14. Sources

### Verified live in this session (fetched directly from GitHub)

Every code snippet in this file is checked against the files below:

| Source | URL | Content |
|---|---|---|
| Flight Ref Scenario — bp_travel_m test class | https://github.com/SAP-samples/abap-platform-refscen-flight/blob/ABAP-platform-cloud/src/managed/%23dmo%23bp_travel_m.clas.testclasses.abap | Direct handler tests: class skeleton, cl_cds/cl_osql_test_environment, validation & action tests, assertions |
| Flight Ref Scenario — BO test double demos | https://github.com/SAP-samples/abap-platform-refscen-flight/blob/ABAP-platform-cloud/src/managed/%23dmo%23tc_botd_travel_m_demos.clas.testclasses.abap | cl_botd_txbufdbl_bo_test_env + cl_botd_mockemlapi_bo_test_env: prepare_environment_config, create, get_test_double, configure_call/when_input/then_set_output, set_fields_handler |
| Flight Ref Scenario — branch ABAP-platform-cloud | https://github.com/SAP-samples/abap-platform-refscen-flight/tree/ABAP-platform-cloud | Full RAP test class set (managed/unmanaged/draft) |
| ABAP Cheat Sheets — ABAP Unit Tests (`14`) | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/14_ABAP_Unit_Tests.md | Confirms the four test-environment classes; FOR TESTING / DURATION SHORT / RISK LEVEL HARMLESS; ROLLBACK ENTITIES |
| ABAP Cheat Sheets — unit test double demo class | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/src/zcl_demo_abap_unit_tdf.clas.abap | Test-double framework demo (dependency isolation) |

### Official references — not fetched in this session

⚠️ The URLs below point to official SAP documentation that was **not reachable from this
session's environment** (network reaches GitHub only). They are listed by their canonical
location — open and confirm them yourself before treating them as authoritative, especially
for version-specific availability.

| Source (not verified this session) | URL |
|---|---|
| SAP Help — Writing Unit Tests for RAP BOs | https://help.sap.com/docs/abap-cloud/abap-rap/writing-unit-tests |
| SAP Help — RAP BO Test Double Framework | https://help.sap.com/docs/abap-cloud/abap-rap/rap-business-object-test-double-framework |
| SAP Help — CDS Test Double Framework | https://help.sap.com/docs/abap-cloud/abap-rap/cds-test-double-framework |
| SAP Help — ABAP SQL Test Double Framework | https://help.sap.com/docs/abap-cloud/abap-rap/abap-sql-test-double-framework-osql |
| SAP Help — ABAP Unit | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/abenabap_unit.htm |
| SAP Learning — Testing RAP Business Objects | https://learning.sap.com/courses/building-transactional-apps-with-the-abap-restful-application-programming-model |