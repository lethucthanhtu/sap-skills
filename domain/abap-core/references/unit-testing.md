# ABAP Unit — Tests, Test Doubles, and Isolation

Read for: `FOR TESTING`, `RISK LEVEL`, `DURATION`, `cl_abap_unit_assert`, class under test (CUT),
`cl_abap_testdouble`, constructor injection, `cl_osql_test_environment`,
`cl_cds_test_environment`, local test classes, `FRIENDS`, test fixtures (`setup`,
`class_setup`, `teardown`), and choosing a test isolation technique.

RAP behavior pools, EML test doubles and BO doubles → `domain/rap/references/testing-eml.md`.
CDS view tests in depth → `domain/cds/references/cds-testing.md`.

---

## 1. Test Class Skeleton

```abap
"! @testing zcl_travel_processor
CLASS ltc_travel_processor DEFINITION FINAL
  FOR TESTING RISK LEVEL HARMLESS DURATION SHORT.

  PRIVATE SECTION.
    DATA cut             TYPE REF TO zcl_travel_processor.
    DATA mock_repository TYPE REF TO zif_travel_repository.

    METHODS setup.
    METHODS approve_sets_status_accepted FOR TESTING RAISING cx_static_check.
    METHODS approve_rejects_cancelled    FOR TESTING RAISING cx_static_check.
ENDCLASS.

CLASS ltc_travel_processor IMPLEMENTATION.

  METHOD setup.
    " Fresh fixture per test method: no state leaks between tests.
    mock_repository ?= cl_abap_testdouble=>create( 'ZIF_TRAVEL_REPOSITORY' ).
    cut = NEW zcl_travel_processor( travel_repository = mock_repository ).
  ENDMETHOD.

  METHOD approve_sets_status_accepted.
    " Given
    DATA(travel) = VALUE zif_travel_repository=>ty_travel( travel_id = '42' status = 'O' ).
    cl_abap_testdouble=>configure_call( mock_repository
      )->returning( travel
      )->ignore_all_parameters( ).
    mock_repository->read( '42' ).

    " When
    DATA(result) = cut->approve( '42' ).

    " Then
    cl_abap_unit_assert=>assert_equals( exp = 'A' act = result-status
                                        msg = 'Approved travel must be accepted' ).
  ENDMETHOD.

  METHOD approve_rejects_cancelled.
    DATA(travel) = VALUE zif_travel_repository=>ty_travel( travel_id = '43' status = 'X' ).
    cl_abap_testdouble=>configure_call( mock_repository
      )->returning( travel
      )->ignore_all_parameters( ).
    mock_repository->read( '43' ).

    TRY.
        cut->approve( '43' ).
        cl_abap_unit_assert=>fail( 'Cancelled travel must not be approved' ).
      CATCH zcx_travel_error ##NO_HANDLER.
        " expected
    ENDTRY.
  ENDMETHOD.

ENDCLASS.
```

Rules:
- One behaviour per test method; the name says what is expected.
- `setup` builds a fresh CUT and doubles for every method; `class_setup` only for expensive,
  read-only environments (OSQL/CDS test environments), cleared in `setup` and destroyed in
  `class_teardown`.
- `RISK LEVEL HARMLESS` + `DURATION SHORT` for real unit tests. Needing `DANGEROUS` or
  `LONG` usually means the test is touching the database or external systems.
- Assert on outcomes (`assert_equals`, `assert_initial`, `assert_bound`, `fail`), not on
  internal call counts unless the call itself is the contract.

---

## 2. Choosing an Isolation Technique

| Dependency of the CUT | Technique |
|---|---|
| Your own class behind an interface | Constructor injection + `cl_abap_testdouble` (or a hand-written local double) |
| Database tables read with ABAP SQL | `cl_osql_test_environment` |
| CDS view entities | `cl_cds_test_environment` (see `domain/cds/references/cds-testing.md`) |
| RAP BO consumed via EML | BO test doubles (see `domain/rap/references/testing-eml.md`) |
| Released SAP API / function module without an interface | Wrap it in your own interface, double the wrapper |
| Legacy code you cannot refactor yet | Test seams (`TEST-SEAM` / `TEST-INJECTION`) — a last resort, and check whether your environment allows them |

Prefer injection through the constructor (or an importing parameter) over factories with
static setters. Static singletons and `NEW` inside the CUT make doubles impossible.

---

## 3. `cl_abap_testdouble` Essentials

```abap
" Create a double for an interface (global interfaces only)
double ?= cl_abap_testdouble=>create( 'ZIF_PRICE_SERVICE' ).

" Configure the NEXT call on the double, then call the method once to register it
cl_abap_testdouble=>configure_call( double )->returning( 100 ).
double->get_price( product = 'P1' ).

" Raise an exception instead of returning
cl_abap_testdouble=>configure_call( double )->raise_exception( NEW zcx_price_unavailable( ) ).
double->get_price( product = 'P2' ).

" Verify an expected call (optional; prefer outcome assertions)
cl_abap_testdouble=>configure_call( double )->and_expect( )->is_called_once( ).
double->notify( 'P1' ).
" ... run the CUT ...
cl_abap_testdouble=>verify_expectations( double ).
```

- `configure_call` applies to the next method call on the double; that call registers the
  configuration and does not execute anything.
- Parameter matching is exact unless you use `ignore_parameter` / `ignore_all_parameters`.
- Release: available from 7.40 SP09 on-premise and in ABAP Cloud. Older ECC releases need
  hand-written local doubles (`CLASS ltd_price_service DEFINITION FOR TESTING`).

---

## 4. ABAP SQL Test Environment

```abap
CLASS ltc_travel_reader DEFINITION FINAL
  FOR TESTING RISK LEVEL HARMLESS DURATION SHORT.
  PRIVATE SECTION.
    CLASS-DATA sql_environment TYPE REF TO if_osql_test_environment.
    CLASS-METHODS class_setup.
    CLASS-METHODS class_teardown.
    METHODS setup.
    METHODS reads_only_open_travels FOR TESTING.
ENDCLASS.

CLASS ltc_travel_reader IMPLEMENTATION.
  METHOD class_setup.
    sql_environment = cl_osql_test_environment=>create(
      i_dependency_list = VALUE #( ( 'ZTRAVEL' ) ) ).
  ENDMETHOD.

  METHOD class_teardown.
    sql_environment->destroy( ).
  ENDMETHOD.

  METHOD setup.
    sql_environment->clear_doubles( ).
  ENDMETHOD.

  METHOD reads_only_open_travels.
    DATA travels TYPE STANDARD TABLE OF ztravel WITH EMPTY KEY.
    travels = VALUE #( ( travel_id = '1' status = 'O' )
                       ( travel_id = '2' status = 'X' ) ).
    sql_environment->insert_test_data( travels ).

    DATA(result) = NEW zcl_travel_reader( )->get_open_travels( ).

    cl_abap_unit_assert=>assert_equals( exp = 1 act = lines( result ) ).
  ENDMETHOD.
ENDCLASS.
```

The SQL statements in the CUT run unchanged; the environment redirects them to test
doubles of the listed tables, so production data is never read or written.

---

## 5. Testing Private Logic

Test through the public API first. If a private method genuinely needs direct tests, the
CUT can grant friendship to the test class (`CLASS zcl_x DEFINITION LOCAL FRIENDS ltc_x.`
in the test include). Frequent need for this is a design smell: extract a class.

---

## 6. Anti-Patterns

| Pattern | Problem | Fix |
|---|---|---|
| Test reads/writes real DB tables | Flaky, `RISK LEVEL DANGEROUS`, pollutes data | OSQL / CDS test environment |
| `NEW zcl_dependency( )` inside the CUT | Cannot double | Inject an interface |
| One test method checks five behaviours | Failure tells you nothing | One behaviour per method |
| Shared mutable state set in `class_setup` | Order-dependent tests | Rebuild in `setup` |
| Asserting only that "no exception happened" | Passes on wrong results | Assert on the actual outcome |
| `COMMIT WORK` in a test | Persists test data | Doubles; RAP tests use `ROLLBACK ENTITIES` |
| Tests that only reach coverage | No behaviour protected | Assert business rules |

---

## Sources

| Topic | URL |
|---|---|
| ABAP Unit (keyword docs) | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/index.htm?file=abenabap_unit.htm |
| DSAG ABAP guide — advanced ABAP Unit / test doubles | https://marianfoo.github.io/DSAG-ABAP-Guide/testing/abap_unit_advanced/ |
| ABAP cheat sheets (includes ABAP Unit) | https://github.com/SAP-samples/abap-cheat-sheets |
