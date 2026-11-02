# CDS Virtual Elements

Read for: `@ObjectModel.virtualElementCalculatedBy`, `if_sadl_exit_calc_element_read`, limits (not filterable/sortable in SQL).

---

## 8. Virtual Elements

Virtual elements are computed fields in a CDS projection view — they have no DB column
but are calculated at runtime via an ABAP implementation class.

### Declare Virtual Element in Projection View

```abap
define root view entity Z_C_Travel
  provider contract transactional_query
  as projection on Z_I_Travel
{
  key TravelId,
      AgencyId,
      OverallStatus,

      BeginDate,
      EndDate,

      -- Virtual elements in projection views use the VIRTUAL keyword;
      -- the annotation value is 'ABAP:<class name>' only (no method)
      @ObjectModel.virtualElementCalculatedBy: 'ABAP:ZCL_TRAVEL_VIRTUAL'
      virtual IsOverdue : abap_boolean,

      @ObjectModel.virtualElementCalculatedBy: 'ABAP:ZCL_TRAVEL_VIRTUAL'
      virtual DaysUntilDeparture : abap.int4
}
```

### Implementation Class

```abap
CLASS zcl_travel_virtual DEFINITION
  PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_sadl_exit_calc_element_read.

ENDCLASS.

CLASS zcl_travel_virtual IMPLEMENTATION.

  METHOD if_sadl_exit_calc_element_read~get_calculation_info.
    " Tell SADL which base fields must be read for the calculation
    et_requested_orig_elements = VALUE #( ( `BEGINDATE` ) ( `ENDDATE` )
                                          ( `OVERALLSTATUS` ) ).
  ENDMETHOD.

  METHOD if_sadl_exit_calc_element_read~calculate.
    DATA lt_travel TYPE STANDARD TABLE OF z_c_travel WITH DEFAULT KEY.
    lt_travel = CORRESPONDING #( it_original_data ).

    DATA(lv_today) = cl_abap_context_info=>get_system_date( ).

    LOOP AT lt_travel ASSIGNING FIELD-SYMBOL(<fs>).
      " Date difference in days: plain subtraction of two date fields
      <fs>-DaysUntilDeparture = <fs>-BeginDate - lv_today.

      <fs>-IsOverdue = COND #( WHEN <fs>-EndDate < lv_today
                                 AND <fs>-OverallStatus <> 'X'
                               THEN abap_true
                               ELSE abap_false ).
    ENDLOOP.

    ct_calculated_data = CORRESPONDING #( lt_travel ).
  ENDMETHOD.

ENDCLASS.
```

### Restrictions
- Only in **projection/consumption** views, not interface views
- Cannot be used in WHERE, ORDER BY, or aggregations
- Performance: called once per result set, not per row independently
- ABAP Cloud: supported; the interface `IF_SADL_EXIT_CALC_ELEMENT_READ` is released,
  your own calculation class does not need a release contract
- Only evaluated when read through the OData/SADL stack — a plain ABAP SQL `SELECT`
  on the projection view does not compute them
