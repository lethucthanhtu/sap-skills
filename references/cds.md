# CDS Advanced Reference

Advanced CDS patterns beyond basic view entities. Covers table functions, parameters,
aggregations, hierarchy, extensions, virtual elements, abstract entities, metadata
extensions, and unit testing.

---

## Table of Contents

1. [CDS Parameters](#1-cds-parameters)
2. [Aggregation Views](#2-aggregation-views)
3. [Table Functions](#3-table-functions)
4. [CDS Hierarchy](#4-cds-hierarchy)
5. [View Extensions](#5-view-extensions)
6. [Abstract Entities](#6-abstract-entities)
7. [Custom Entities](#7-custom-entities)
8. [Virtual Elements](#8-virtual-elements)
9. [Metadata Extensions (DDLX)](#9-metadata-extensions-ddlx)
10. [CDS Test Double Framework](#10-cds-test-double-framework)

---

## 1. CDS Parameters

CDS parameters allow passing runtime values into a view — useful for date-dependent
or client-filtered queries.

### Syntax

```abap
define view entity Z_I_BalanceByDate
  with parameters
    p_key_date : abap.dats,
    p_company  : bukrs
  as select from zbalance as B
{
  key B.account     as Account,
      B.amount      as Amount,
      B.currency    as Currency
}
where
  B.valid_from <= $parameters.p_key_date
  and B.valid_to >= $parameters.p_key_date
  and B.company_code = $parameters.p_company
```

### Calling a Parameterized View in ABAP SQL

```abap
SELECT *
  FROM z_i_balancebydate(
         p_key_date = @sy-datum,
         p_company  = @lv_bukrs )
  INTO TABLE @DATA(lt_balance).
```

### Calling with Default Values

```abap
-- In CDS: default values can be defined for parameters
define view entity Z_I_MyView
  with parameters
    @Environment.systemField: #SYSTEM_DATE
    p_date : abap.dats,
    @Environment.systemField: #CLIENT
    p_client : mandt
```

`@Environment.systemField` auto-fills from system at runtime — no caller input needed.

Supported values:

| Annotation Value | Filled With |
|---|---|
| `#SYSTEM_DATE` | `SY-DATUM` |
| `#CLIENT` | `SY-MANDT` |
| `#USER` | `SY-UNAME` |
| `#SYSTEM_LANGUAGE` | `SY-LANGU` |

### Passing Parameters Through Associations

When a parameterized view is used as an association target, pass parameters explicitly:

```abap
define view entity Z_I_Header
  as select from zheader as H
  association [1..1] to Z_I_BalanceByDate( p_key_date = $projection.PostingDate,
                                            p_company  = $projection.CompanyCode )
    as _Balance on _Balance.Account = $projection.Account
{
  key H.document_id  as DocumentId,
      H.posting_date as PostingDate,
      H.company_code as CompanyCode,
      H.account      as Account,
      _Balance
}
```

---

## 2. Aggregation Views

### GROUP BY / COUNT / SUM

```abap
define view entity Z_I_SalesAgg
  as select from zsales as S
{
  key S.company_code    as CompanyCode,
  key S.fiscal_year     as FiscalYear,
  key S.product_id      as ProductId,
      @Semantics.amount.currencyCode: 'Currency'
      sum( S.net_amount ) as TotalAmount,
      @Semantics.currencyCode: true
      S.currency        as Currency,
      count(*)          as RecordCount
}
group by
  S.company_code,
  S.fiscal_year,
  S.product_id,
  S.currency
```

### HAVING clause

```abap
define view entity Z_I_TopSales
  as select from zsales as S
{
  key S.product_id     as ProductId,
      sum( S.net_amount ) as TotalAmount,
      S.currency       as Currency
}
group by S.product_id, S.currency
having sum( S.net_amount ) > 10000
```

### Analytics Annotations (Cube / Dimension)

```abap
-- Fact/Cube view
@Analytics.dataCategory: #FACT
@Analytics.dataExtraction.enabled: true
@Analytics.dataExtraction.delta.byElement.name: 'LastChangedAt'
define view entity Z_I_SalesCube
  as select from zsales as S
  association [0..1] to Z_I_Product as _Product
    on $projection.ProductId = _Product.ProductId
{
  @Analytics.dimension: true
  key S.product_id   as ProductId,

  @Analytics.dimension: true
  key S.company_code as CompanyCode,

  @Analytics.measure: true
  @Semantics.amount.currencyCode: 'Currency'
  sum( S.net_amount ) as TotalAmount,

  @Semantics.currencyCode: true
  S.currency as Currency,

  _Product
}
group by S.product_id, S.company_code, S.currency

-- Dimension view
@Analytics.dataCategory: #DIMENSION
define view entity Z_I_Product
  as select from zmaterial as M
{
  key M.product_id   as ProductId,
      M.product_name as ProductName,
      M.category     as Category
}
```

---

## 3. Table Functions

Table functions expose ABAP logic as a CDS-readable source. Required when:
- Complex ABAP processing needed (loops, function module calls)
- Dynamic WHERE conditions
- Cross-client or client-independent reads
- Legacy API integration

### DDL — Define Table Function

```abap
@EndUserText.label: 'Custom Table Function'
@ClientHandling.type: #CLIENT_DEPENDENT
@ClientHandling.algorithm: #SESSION_VARIABLE

define table function Z_TF_OpenItems
  with parameters
    @Environment.systemField: #CLIENT
    p_client      : abap.clnt,
    p_company     : bukrs,
    p_key_date    : abap.dats
  returns {
    client        : abap.clnt;
    company_code  : bukrs;
    document_id   : belnr_d;
    open_amount   : wrbtr;
    currency      : waers;
  }
  implemented by method ZCL_TF_OPEN_ITEMS=>get_open_items;
```

### ABAP Implementation Class

```abap
CLASS zcl_tf_open_items DEFINITION
  PUBLIC FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_amdp_marker_hdb.

    CLASS-METHODS get_open_items
      FOR TABLE FUNCTION z_tf_openitems.

ENDCLASS.

CLASS zcl_tf_open_items IMPLEMENTATION.

  METHOD get_open_items
    BY DATABASE FUNCTION FOR HDB
    LANGUAGE SQLSCRIPT
    OPTIONS READ-ONLY
    USING zbseg zbkpf.

    -- SQLScript body (runs on HANA)
    DECLARE lt_docs TABLE (
      client       NVARCHAR(3),
      company_code NVARCHAR(4),
      document_id  NVARCHAR(10),
      open_amount  DECIMAL(23,2),
      currency     NVARCHAR(5)
    );

    lt_docs = SELECT
        b.mandt        AS client,
        b.bukrs        AS company_code,
        b.belnr        AS document_id,
        SUM(s.dmbtr)   AS open_amount,
        s.waers        AS currency
      FROM zbkpf AS b
      INNER JOIN zbseg AS s ON b.mandt = s.mandt
                            AND b.bukrs = s.bukrs
                            AND b.belnr = s.belnr
      WHERE b.mandt    = :p_client
        AND b.bukrs    = :p_company
        AND b.budat   <= :p_key_date
        AND s.augdt    = '00000000'  -- not cleared
      GROUP BY b.mandt, b.bukrs, b.belnr, s.waers;

    RETURN SELECT * FROM :lt_docs;

  ENDMETHOD.

ENDCLASS.
```

### Using Table Function in Another CDS View

```abap
define view entity Z_I_OpenItemsView
  as select from Z_TF_OpenItems(
                   p_client   = $session.client,
                   p_company  = '1000',
                   p_key_date = $session.system_date ) as TF
{
  TF.company_code as CompanyCode,
  TF.document_id  as DocumentId,
  TF.open_amount  as OpenAmount,
  TF.currency     as Currency
}
```

### Restrictions
- ABAP Cloud: Table functions **not supported** (use ABAP-managed queries instead)
- Implementation must use `BY DATABASE FUNCTION FOR HDB LANGUAGE SQLSCRIPT`
- Cannot use ABAP variables — only SQLScript inside implementation
- `OPTIONS READ-ONLY` is mandatory for most scenarios

---

## 4. CDS Hierarchy

Define parent-child hierarchies navigable in OData and Fiori Tree tables.

### Recursive Hierarchy

```abap
define hierarchy Z_H_CostCenterHier
  as parent child hierarchy (
    source Z_I_CostCenter
    child to parent association _Parent
    start where
      ParentCostCenter is initial
    siblings order by
      CostCenter ascending
  )
{
  CostCenter,
  CostCenterName,
  ParentCostCenter,
  ValidFrom,
  ValidTo
}
```

### Source View for Hierarchy

```abap
define view entity Z_I_CostCenter
  as select from kst as K
  association [0..1] to Z_I_CostCenter as _Parent
    on $projection.ParentCostCenter = _Parent.CostCenter
    and $projection.ControllingArea  = _Parent.ControllingArea
{
  key K.kostl       as CostCenter,
  key K.kokrs       as ControllingArea,
      K.ktext       as CostCenterName,
      K.verak       as ParentCostCenter,
      K.datab       as ValidFrom,
      K.datbi       as ValidTo,
      _Parent
}
```

### Hierarchy Annotations

```abap
@Hierarchy.parentChild: [{
  recurse: {
    by: 'ParentCostCenter',  -- field pointing to parent key
    to: ['CostCenter']       -- key fields of parent
  }
}]
```

---

## 5. View Extensions

Extend an existing CDS view to add fields without modifying the original.
Used in customer/partner extensions and vertical industry add-ons.

### Extend View (Append Fields)

```abap
-- Extend a standard SAP view with customer fields
extend view entity I_BusinessPartner with Z_E_BPExtension
{
  -- Extension includes fields from an APPEND structure
  bupa_extension.zcustomer_segment as CustomerSegment,
  bupa_extension.zrisk_category    as RiskCategory
}
```

### Extension via Include Structure (DDIC)

1. Create an APPEND structure `ZI_BUPA_EXT` on the DDIC table
2. Extend the CDS view referencing those fields

### Restrictions
- Only append fields; cannot change key fields or filter conditions
- Requires `@AbapCatalog.viewEnhancementCategory: [#PROJECTION_LIST]` on source
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
  -- Action with input parameter and result
  action acceptTravel
    parameter Z_D_AcceptTravel_Params
    result [1] $self;

  -- Static factory action with parameter
  static factory action createByTemplate
    parameter Z_D_TravelTemplate
    result [1] $self;

  -- Function returning scalar result
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

    " Read filter conditions from request
    DATA(lo_filter) = io_request->get_filter( ).
    DATA(lt_ranges) = lo_filter->get_as_ranges( ).

    " Call external source (RFC / HTTP / ABAP)
    " ... your logic here ...

    " Apply $top / $skip
    DATA(lv_top)  = io_request->get_paging( )->get_page_size( ).
    DATA(lv_skip) = io_request->get_paging( )->get_offset( ).

    " Return data
    io_response->set_total_number_of_records( lines( lt_flights ) ).
    io_response->set_data( lt_flights ).

  ENDMETHOD.

ENDCLASS.
```

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

      -- Virtual element: computed at runtime
      @ObjectModel.virtualElement: true
      @ObjectModel.virtualElementCalculatedBy: 'ABAP:ZCL_TRAVEL_VIRTUAL=>calculate'
      cast( '' as abap_boolean ) as IsOverdue,

      @ObjectModel.virtualElement: true
      @ObjectModel.virtualElementCalculatedBy: 'ABAP:ZCL_TRAVEL_VIRTUAL=>calculate'
      cast( 0 as int4 ) as DaysUntilDeparture
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

  METHOD if_sadl_exit_calc_element_read~calculate.

    DATA(lt_travel) = CAST #( it_original_data ).

    LOOP AT lt_travel INTO DATA(ls_travel) ASSIGNING FIELD-SYMBOL(<fs>).
      DATA(lv_today)   = cl_abap_context_info=>get_system_date( ).

      " Calculate DaysUntilDeparture
      <fs>-DaysUntilDeparture =
        cl_abap_tstmp=>subtract( tstmp1 = ls_travel-BeginDate
                                  tstmp2 = lv_today ).

      " Calculate IsOverdue flag
      <fs>-IsOverdue = COND #( WHEN ls_travel-EndDate < lv_today
                                 AND ls_travel-OverallStatus <> 'X'
                               THEN abap_true
                               ELSE abap_false ).
    ENDLOOP.

    ct_calculated_data = lt_travel.

  ENDMETHOD.

ENDCLASS.
```

### Restrictions
- Only in **projection/consumption** views, not interface views
- Cannot be used in WHERE, ORDER BY, or aggregations
- Performance: called once per result set, not per row independently
- ABAP Cloud: supported but class must be released

---

## 9. Metadata Extensions (DDLX)

Metadata Extensions separate UI annotations from data model annotations.
This enables the Metadata-Driven UI pattern and supports layered extensions.

### Create Metadata Extension (`.ddlx` file in ADT)

```abap
@Metadata.layer: #CUSTOMER
annotate entity Z_C_Travel with
{
  @UI.headerInfo: {
    typeName: 'Travel',
    typeNamePlural: 'Travels',
    title: {
      type: #STANDARD,
      value: 'TravelId'
    },
    description: {
      value: 'Description'
    },
    imageUrl: 'PictureUrl'
  }

  @UI.presentationVariant: [{
    sortOrder: [{ by: 'BeginDate', direction: #DESC }],
    visualizations: [{ type: #AS_LINEITEM }]
  }]

  @UI.selectionField: [{ position: 10 }]
  @UI.lineItem: [{ position: 10, importance: #HIGH }]
  @UI.identification: [{ position: 10 }]
  TravelId;

  @UI.selectionField: [{ position: 20 }]
  @UI.lineItem: [{ position: 20 }]
  AgencyId;

  @UI.lineItem: [{ position: 30, importance: #MEDIUM }]
  @UI.identification: [{ position: 30 }]
  BeginDate;

  @UI.lineItem: [{ position: 40 }]
  EndDate;

  @UI.lineItem: [{
    position: 50,
    criticality: 'StatusCriticality',
    criticalityRepresentation: #WITH_ICON,
    label: 'Status'
  }]
  @UI.identification: [{ position: 50 }]
  @UI.selectionField: [{ position: 50 }]
  OverallStatus;

  @UI.facet: [{
    id:       'GeneralInfo',
    purpose:  #STANDARD,
    type:     #IDENTIFICATION_REFERENCE,
    label:    'General Information',
    position: 10
  }, {
    id:           'Bookings',
    purpose:      #STANDARD,
    type:         #LINEITEM_REFERENCE,
    label:        'Bookings',
    position:     20,
    targetElement: '_Booking'
  }]
  @UI.hidden: true
  LocalLastChangedAt;
}
```

### Metadata Layers (priority order, highest first)

| Layer | Used By | Priority |
|---|---|---|
| `#CUSTOMER` | Customer-specific annotations | Highest |
| `#PARTNER` | Partner add-ons | High |
| `#INDUSTRY` | Industry solutions | Medium |
| `#LOCALIZATION` | Country-specific | Low |
| `#CORE` | SAP standard / app developer | Lowest |

### Prerequisites on Consumption View

```abap
-- Consumption view MUST have:
@Metadata.allowExtensions: true
```

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
| Table Functions | ✅ | ✅ | ✅ | ✅ | ❌ |
| Aggregation Views | ✅ | ✅ | ✅ | ✅ | ✅ |
| CDS Hierarchy | ❌ | ✅ | ✅ | ✅ | ✅ |
| View Extensions | ✅ | ✅ | ✅ | ✅ | ⚠️ released only |
| Abstract Entities | ❌ | ❌ | ✅ | ✅ | ✅ |
| Custom Entities | ❌ | ❌ | ✅ | ✅ | ✅ |
| Virtual Elements | ❌ | ✅ | ✅ | ✅ | ✅ |
| Metadata Extensions | ❌ | ✅ | ✅ | ✅ | ✅ |
| CDS Test Doubles | ❌ | ❌ | ❌ | ✅ (7.56+) | ✅ |
