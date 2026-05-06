# ABAP Core Development

Reference: https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/index.htm

---

## Version Compatibility Matrix

| Feature | ECC 6.0 | S/4HANA On-Prem | S/4HANA Cloud Private | S/4HANA Cloud Public |
|---------|---------|-----------------|----------------------|---------------------|
| Classic ABAP (REPORT, FORM) | ✅ | ✅ (deprecated) | ✅ (restricted) | ❌ |
| ABAP OO (Classes, Interfaces) | ✅ | ✅ | ✅ | ✅ |
| ABAP for Cloud (Tier 1) | ❌ | ✅ (2020+) | ✅ | ✅ |
| Open SQL with CDS | ❌ | ✅ | ✅ | ✅ |
| RAP Framework | ❌ | ✅ (2020+) | ✅ | ✅ |
| BOPF (legacy BO framework) | ✅ | ✅ (legacy) | limited | ❌ |

**Always clarify the target system version before generating code.**

---

## ABAP Cloud vs. Classic ABAP

### ABAP Cloud (Tier 1 - for S/4HANA Cloud Public & ABAP Platform)
- Only released APIs allowed — no direct table access (use CDS/RAP instead)
- No `CALL FUNCTION` to unreleased FMs — use class-based alternatives
- No `SELECT * FROM <sap_table>` on application tables — use C1-released CDS views
- Syntax check enforced by `ABAP for Cloud Development` language version

### Classic ABAP (ECC / S/4HANA On-Prem)
- Direct table access permitted but discouraged for core data
- Legacy constructs (`FORM`, `TABLES`, `CALL FUNCTION`) still valid but mark as technical debt
- Recommend migration path toward ABAP OO + CDS

---

## Code Standards & Best Practices

### Naming Conventions

```abap
" Classes
CLASS zcl_<namespace>_<object> DEFINITION ...  " e.g. zcl_mm_purchase_order
INTERFACE zif_<namespace>_<object> DEFINITION ...

" Methods: verb_noun pattern
METHODS get_purchase_orders ...
METHODS create_sales_order ...
METHODS validate_input ...

" Variables
DATA lv_<name> TYPE ...          " local variable (scalar)
DATA lt_<name> TYPE TABLE OF ... " local table
DATA ls_<name> TYPE ...          " local structure
DATA lo_<name> TYPE REF TO ...   " local object reference

DATA mv_<name> ...  " instance attribute
DATA mt_<name> ...
DATA mo_<name> ...

CONSTANTS gc_<name> TYPE ... VALUE ...
```

### Object-Oriented Patterns

```abap
" Prefer interfaces for loose coupling
INTERFACE zif_order_repository.
  METHODS get_by_id
    IMPORTING iv_order_id TYPE vbeln
    RETURNING VALUE(ro_order) TYPE REF TO zif_sales_order
    RAISING zcx_order_not_found.
ENDINTERFACE.

" Constructor injection for testability
CLASS zcl_order_service DEFINITION.
  PUBLIC SECTION.
    METHODS constructor
      IMPORTING io_repo TYPE REF TO zif_order_repository.
  PRIVATE SECTION.
    DATA mo_repo TYPE REF TO zif_order_repository.
ENDCLASS.
```

### Exception Handling

```abap
" Always use class-based exceptions (never SY-SUBRC for business logic)
CLASS zcx_business_error DEFINITION
  INHERITING FROM cx_static_check.
  PUBLIC SECTION.
    METHODS constructor
      IMPORTING iv_message TYPE string.
ENDCLASS.

" Usage
TRY.
    lo_service->process( iv_id ).
  CATCH zcx_business_error INTO DATA(lx_err).
    " Handle gracefully
    MESSAGE lx_err->get_text( ) TYPE 'E'.
ENDTRY.
```

### Modern ABAP Syntax (7.4+)

```abap
" Inline declarations
DATA(lv_count) = lines( lt_orders ).
DATA(ls_first) = lt_orders[ 1 ].

" Constructor expressions
DATA(lt_filtered) = VALUE #( FOR ls IN lt_orders
                              WHERE ( status = 'A' )
                              ( ls ) ).

" String templates
DATA(lv_msg) = |Order { lv_id } created on { sy-datum }|.

" Table expressions (avoid INDEX ACCESS exceptions — check first)
IF line_exists( lt_orders[ key = lv_key ] ).
  DATA(ls_order) = lt_orders[ key = lv_key ].
ENDIF.
```

---

## Performance Patterns

```abap
" Use HANA-compatible Open SQL — push logic to DB
SELECT vbeln, erdat, netwr
  FROM vbak
  WHERE erdat >= @lv_date
    AND vkorg = @lv_org
  INTO TABLE @DATA(lt_orders).

" Avoid SELECT inside loops — use JOIN or pre-fetch
" BAD:
LOOP AT lt_orders INTO ls_order.
  SELECT SINGLE * FROM vbap WHERE vbeln = ls_order-vbeln INTO ls_item. " N+1 problem
ENDLOOP.

" GOOD:
SELECT vbeln, posnr, matnr, kwmeng
  FROM vbap
  FOR ALL ENTRIES IN @lt_orders
  WHERE vbeln = @lt_orders-vbeln
  INTO TABLE @DATA(lt_items).
```

---

## Unit Testing (ABAP Unit)

```abap
CLASS ltc_order_service DEFINITION FOR TESTING
  RISK LEVEL HARMLESS DURATION SHORT.
  PRIVATE SECTION.
    DATA mo_cut TYPE REF TO zcl_order_service.  " class under test
    METHODS setup.
    METHODS test_get_order_success FOR TESTING.
ENDCLASS.

CLASS ltc_order_service IMPLEMENTATION.
  METHOD setup.
    " Use test doubles / mocks for dependencies
    mo_cut = NEW #( io_repo = NEW zcl_mock_order_repo( ) ).
  ENDMETHOD.

  METHOD test_get_order_success.
    DATA(lo_result) = mo_cut->get_order( '0000001234' ).
    cl_abap_unit_assert=>assert_not_initial( lo_result ).
  ENDMETHOD.
ENDCLASS.
```

---

## ECC-Specific Guidance

- BAPI usage still preferred for cross-system integration
- Use `CALL FUNCTION '...' IN UPDATE TASK` for LUW-safe updates
- Enhancement framework: BAdI > User Exit > Enhancement Spot
- Transport: always assign to a proper transport request, never $TMP for productive code

## S/4HANA Migration Notes

When modernizing ECC code to S/4HANA:
1. Run **ABAP Test Cockpit (ATC)** with S/4HANA ruleset
2. Replace direct access to obsolete tables (e.g., MARA → I_Product CDS view)
3. Replace BAPI calls with RAP business objects where available
4. Check **Simplification List** for removed/changed objects: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/0e4de2ae58e249c9bed6c8acca7fc5e8
