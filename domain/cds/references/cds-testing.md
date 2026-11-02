# CDS Test Double Framework & Version Summary

Read for: `cl_cds_test_environment`, test data insertion, and which CDS feature exists in which release.

---

## 10. CDS Test Double Framework

Unit-test CDS views in isolation by substituting DB tables with test data.

### Test Class Structure

```abap
CLASS zcl_test_z_i_travel DEFINITION
  PUBLIC FINAL
  FOR TESTING
  RISK LEVEL HARMLESS
  DURATION SHORT.

  PRIVATE SECTION.
    CLASS-DATA: environment TYPE REF TO if_cds_test_environment.

    CLASS-METHODS:
      class_setup,
      class_teardown.

    METHODS:
      setup,
      test_open_travels FOR TESTING,
      test_accepted_travel FOR TESTING.

ENDCLASS.

CLASS zcl_test_z_i_travel IMPLEMENTATION.

  METHOD class_setup.
    " Create test environment for the CDS view under test
    environment = cl_cds_test_environment=>create(
                    i_for_entity = 'Z_I_TRAVEL' ).
  ENDMETHOD.

  METHOD class_teardown.
    environment->destroy( ).
  ENDMETHOD.

  METHOD setup.
    " Clear all test data before each test
    environment->clear_doubles( ).
  ENDMETHOD.

  METHOD test_open_travels.
    " Arrange: insert test data into CDS double
    environment->insert_test_data(
      i_data = VALUE ztravel_t(
        ( client = sy-mandt travel_id = '00000001'
          agency_id = '000001' overall_status = 'O'
          begin_date = '20241201' end_date = '20241231'
          currency_code = 'EUR' booking_fee = '100' )
        ( client = sy-mandt travel_id = '00000002'
          agency_id = '000002' overall_status = 'A'
          begin_date = '20241101' end_date = '20241130'
          currency_code = 'USD' booking_fee = '200' ) ) ).

    " Act: query the CDS view
    SELECT * FROM z_i_travel
      WHERE overall_status = 'O'
      INTO TABLE @DATA(lt_result).

    " Assert
    cl_abap_unit_assert=>assert_equals(
      act = lines( lt_result )
      exp = 1
      msg = 'Expected 1 open travel' ).

    cl_abap_unit_assert=>assert_equals(
      act = lt_result[ 1 ]-travel_id
      exp = '00000001' ).
  ENDMETHOD.

  METHOD test_accepted_travel.
    environment->insert_test_data(
      i_data = VALUE ztravel_t(
        ( client = sy-mandt travel_id = '00000003'
          overall_status = 'A'
          begin_date = '20241201' end_date = '20241231'
          currency_code = 'EUR' booking_fee = '300' ) ) ).

    SELECT SINGLE * FROM z_i_travel
      WHERE travel_id = '00000003'
      INTO @DATA(ls_travel).

    cl_abap_unit_assert=>assert_equals(
      act = ls_travel-overall_status
      exp = 'A' ).
  ENDMETHOD.

ENDCLASS.
```

### Test Environment with Multiple Tables

```abap
" If the CDS view joins multiple tables, register all of them
environment = cl_cds_test_environment=>create_for_multiple_cds(
                i_for_entities = VALUE #(
                  ( i_for_entity = 'Z_I_TRAVEL' )
                  ( i_for_entity = 'Z_I_BOOKING' ) ) ).
```

### Restrictions
- Only works for views based on **DDIC transparent tables** — not table functions or custom entities
- Test doubles replace DB access at statement level — no real DB I/O
- Parameterized views: pass parameters in `SELECT ... FROM view( p1 = @val )`
- ABAP Cloud: fully supported

---

## Version Compatibility Summary

| Feature | 7.40 | 7.50 | 7.54 | 7.57+ | ABAP Cloud |
|---|---|---|---|---|---|
| CDS Parameters | ✅ | ✅ | ✅ | ✅ | ✅ |
| Table Functions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aggregation Views | ✅ | ✅ | ✅ | ✅ | ✅ |
| CDS Hierarchy (`define hierarchy`, 7.53+) | ❌ | ❌ | ✅ | ✅ | ✅ |
| View Extensions | ✅ | ✅ | ✅ | ✅ | ⚠️ released only |
| Abstract Entities | ❌ | ❌ | ✅ | ✅ | ✅ |
| Custom Entities | ❌ | ❌ | ✅ | ✅ | ✅ |
| Virtual Elements | ❌ | ✅ | ✅ | ✅ | ✅ |
| Metadata Extensions | ❌ | ✅ | ✅ | ✅ | ✅ |
| CDS Test Doubles (7.51+) | ❌ | ❌ | ✅ | ✅ | ✅ |
