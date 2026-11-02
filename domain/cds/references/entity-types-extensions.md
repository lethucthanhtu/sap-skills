# CDS View Extensions, Abstract & Custom Entities

Read for: `extend view entity`, abstract entities (action parameters), custom entities with a query provider (`if_rap_query_provider`).

---

## 5. View Extensions

Extend an existing CDS view to add fields without modifying the original.
Used in customer/partner extensions and vertical industry add-ons.

### Extend View (Append Fields)

```abap
-- Extend a CDS view entity with customer fields. For view entities there is no
-- extension name after WITH; the DDL source name is the extension name.
-- The data source alias (here: bupa) must exist in the extended view.
extend view entity Z_I_BusinessPartner with
{
  bupa.zzcustomer_segment as ZZCustomerSegment,
  bupa.zzrisk_category    as ZZRiskCategory
}

-- Classic DDIC-based views (define view) use: extend view <view> with <name> { ... }
```

### Extension via Include Structure (DDIC)

1. Create an APPEND structure `ZI_BUPA_EXT` on the DDIC table
2. Extend the CDS view referencing those fields

### Restrictions
- Only append fields; cannot change key fields or filter conditions
- The extended view must allow it via `@AbapCatalog.viewEnhancementCategory` (e.g. `[#PROJECTION_LIST]`)
- Not available in ABAP Cloud for SAP standard objects (use released extension points)

---

## 6. Abstract Entities

Abstract entities define the parameter/result structure for RAP actions and functions.
They have no database persistence — purely structural.

### Define Abstract Entity

```abap
-- Input structure for a RAP action
define abstract entity Z_D_AcceptTravel_Params
{
  Reason    : abap.char( 255 );
  NotifyUser : abap_boolean;
}

-- Output/result structure
define abstract entity Z_D_TravelPrice_Result
{
  TotalPrice   : wrbtr;
  CurrencyCode : waers;
  Breakdown    : abap.char( 1000 );
}
```

### Usage in BDEF

```abap
define behavior for Z_I_Travel alias Travel
{
  // Action with input parameter and result
  action acceptTravel
    parameter Z_D_AcceptTravel_Params
    result [1] $self;

  // Static factory action with parameter
  static factory action createByTemplate
    parameter Z_D_TravelTemplate
    result [1] $self;

  // Function returning a structured result
  static function calculatePrice
    parameter Z_D_PriceInput
    result [1] Z_D_TravelPrice_Result;
}
```

---

## 7. Custom Entities

Custom entities expose non-database data via a custom query class implementing
`IF_RAP_QUERY_PROVIDER`. Use when data comes from RFC, REST API, or complex logic.

### Define Custom Entity

```abap
@EndUserText.label: 'Flight Availability (External API)'
@ObjectModel.query.implementedBy: 'ABAP:ZCL_FLIGHT_QUERY_PROVIDER'

define custom entity Z_CE_FlightAvailability
{
  key ConnectionId  : /dmo/connection_id;
  key FlightDate    : /dmo/flight_date;
      AirlineId     : /dmo/carrier_id;
      AvailableSeats: /dmo/seats_max;
      Price         : /dmo/flight_price;
      CurrencyCode  : /dmo/currency_code;
}
```

### Query Provider Class

```abap
CLASS zcl_flight_query_provider DEFINITION
  PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_rap_query_provider.

ENDCLASS.

CLASS zcl_flight_query_provider IMPLEMENTATION.

  METHOD if_rap_query_provider~select.

    DATA: lt_flights TYPE TABLE OF z_ce_flightavailability.

    " Only return what was requested — calling set_data / set_total_number_of_records
    " for something not requested raises an exception
    IF io_request->is_data_requested( ) = abap_false
       AND io_request->is_total_numb_of_rec_requested( ) = abap_false.
      RETURN.
    ENDIF.

    " Read filter conditions from request
    DATA(lo_filter) = io_request->get_filter( ).
    DATA(lt_ranges) = lo_filter->get_as_ranges( ).

    " Call external source (RFC / HTTP / ABAP)
    " ... your logic here ...

    " Apply $top / $skip (page size = if_rap_query_paging=>page_size_unlimited
    " when no $top was sent)
    DATA(lv_top)  = io_request->get_paging( )->get_page_size( ).
    DATA(lv_skip) = io_request->get_paging( )->get_offset( ).

    " Return data
    IF io_request->is_total_numb_of_rec_requested( ).
      io_response->set_total_number_of_records( lines( lt_flights ) ).
    ENDIF.
    IF io_request->is_data_requested( ).
      io_response->set_data( lt_flights ).
    ENDIF.

  ENDMETHOD.

ENDCLASS.
```
