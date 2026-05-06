# ABAP RAP (RESTful Application Programming Model)

Reference: https://help.sap.com/docs/abap-cloud/abap-rap/abap-restful-application-programming-model
SAP Learning: https://developers.sap.com/group.abap-env-restful-managed.html

---

## RAP Architecture Overview

```
Consumer (Fiori, OData client, ABAP)
          ↓
    Service Binding (SRVB)           ← OData V4 / V2 endpoint
          ↓
    Service Definition (SRVD)        ← Which entities to expose
          ↓
  Behavior Definition (BDEF)         ← Business logic contract
          ↓
  Behavior Implementation (BILC)     ← ABAP class with handler methods
          ↓
    CDS View Entity                  ← Data model
          ↓
    DB Table (Draft table optional)
```

---

## Implementation Types

| Type | Use Case | Who writes DB logic |
|------|----------|---------------------|
| **Managed** | Standard CRUD, less custom logic | Framework handles CRUD automatically |
| **Unmanaged** | Full custom logic, existing BAPIs | Developer implements all operations |
| **Managed + Additional Save** | Managed + custom side effects on save | Framework CRUD + custom `save_modified` |

**Recommendation**: Start with Managed. Use Unmanaged only when wrapping existing APIs (BAPIs, FMs).

---

## Managed RAP — Full Example

### 1. DB Table
```abap
@EndUserText.label : 'Sales Order'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
define table zsales_order {
  key client      : abap.clnt not null;
  key order_id    : vbeln not null;
  customer        : kunnr;
  net_value       : netwr;
  currency        : waerk;
  status          : abap.char(1);
  created_by      : abp_creation_user;
  created_at      : abp_creation_tstmpl;
  last_changed_by : abp_locinst_lastchange_user;
  last_changed_at : abp_locinst_lastchange_tstmpl;
  local_last_changed_at : abp_lastchange_tstmpl;
}
```

### 2. CDS View Entity (Root)
```cds
@AccessControl.authorizationCheck: #CHECK
define view entity ZI_SalesOrder
  as select from zsales_order
{
  key order_id     as OrderId,
      customer     as Customer,
      net_value    as NetValue,
      currency     as Currency,
      status       as Status,
      created_by   as CreatedBy,
      created_at   as CreatedAt,
      last_changed_by as LastChangedBy,
      last_changed_at as LastChangedAt,
      local_last_changed_at as LocalLastChangedAt
}
```

### 3. Behavior Definition
```cds
managed implementation in class zbp_i_salesorder unique;
strict ( 2 );

define behavior for ZI_SalesOrder alias SalesOrder
  persistent table zsales_order
  lock master
  authorization master ( global )
  etag master LocalLastChangedAt
{
  " Standard CRUD
  create;
  update;
  delete;

  " Field control
  field ( readonly ) OrderId, CreatedBy, CreatedAt, LastChangedBy, LastChangedAt;
  field ( mandatory ) Customer, Currency;

  " Actions
  action ( features: instance ) submitOrder result [1] $self;
  action cancelOrder result [1] $self;

  " Determinations (auto-run on field change)
  determination setInitialStatus on modify { create; }

  " Validations (run before save)
  validation validateCustomer on save { create; update; }

  " Mapping (if DB column names differ from CDS element names)
  mapping for zsales_order corresponding;
}
```

### 4. Behavior Implementation Class
```abap
CLASS zbp_i_salesorder DEFINITION PUBLIC ABSTRACT FINAL
  FOR BEHAVIOR OF zi_salesorder.
ENDCLASS.

CLASS zbp_i_salesorder IMPLEMENTATION.
ENDCLASS.

" Local handler class (generated name convention)
CLASS lhc_salesorder DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS submit_order     FOR MODIFY
      IMPORTING keys FOR ACTION salesorder~submitorder RESULT result.
    METHODS validate_customer FOR VALIDATE ON SAVE
      IMPORTING keys FOR salesorder~validatecustomer.
    METHODS set_initial_status FOR DETERMINE ON MODIFY
      IMPORTING keys FOR salesorder~setinitialstatus.
    METHODS get_global_authorizations FOR GLOBAL AUTHORIZATION
      IMPORTING REQUEST requested_authorizations FOR salesorder
      RESULT result.
ENDCLASS.

CLASS lhc_salesorder IMPLEMENTATION.
  METHOD set_initial_status.
    " Read current state
    READ ENTITIES OF zi_salesorder IN LOCAL MODE
      ENTITY salesorder
        FIELDS ( Status )
        WITH CORRESPONDING #( keys )
      RESULT DATA(lt_orders)
      FAILED DATA(ls_failed).

    " Set default
    MODIFY ENTITIES OF zi_salesorder IN LOCAL MODE
      ENTITY salesorder
        UPDATE FIELDS ( Status )
        WITH VALUE #( FOR ls IN lt_orders
                      WHERE ( status IS INITIAL )
                      ( %tky   = ls-%tky
                        status = 'N' ) ).  " N = New
  ENDMETHOD.

  METHOD validate_customer.
    READ ENTITIES OF zi_salesorder IN LOCAL MODE
      ENTITY salesorder FIELDS ( Customer )
      WITH CORRESPONDING #( keys )
      RESULT DATA(lt_orders).

    LOOP AT lt_orders INTO DATA(ls_order).
      " Validate customer exists
      SELECT SINGLE kunnr FROM kna1
        WHERE kunnr = @ls_order-customer
        INTO @DATA(lv_kunnr).

      IF sy-subrc <> 0.
        APPEND VALUE #(
          %tky = ls_order-%tky
          %state_area = 'VALIDATE_CUSTOMER'
        ) TO failed-salesorder.

        APPEND VALUE #(
          %tky        = ls_order-%tky
          %state_area = 'VALIDATE_CUSTOMER'
          %msg        = new_message_with_text(
                          severity = if_abap_behv_message=>severity-error
                          text     = |Customer { ls_order-customer } does not exist| )
        ) TO reported-salesorder.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

  METHOD get_global_authorizations.
    " Implement authorization check
    result-%action-submitorder =
      COND #( WHEN is_authorized( )
              THEN if_abap_behv=>auth-allowed
              ELSE if_abap_behv=>auth-unauthorized ).
  ENDMETHOD.
ENDCLASS.
```

---

## Draft Handling

For transactional apps with "Save" / "Discard" pattern:
```cds
managed with additional save implementation in class zbp_i_salesorder unique;

define behavior for ZI_SalesOrder alias SalesOrder
  persistent table zsales_order
  draft table zsales_order_d        " Draft table (generate with ADT)
  lock master total etag LastChangedAt
  ...
{
  create; update; delete;
  draft action Edit;
  draft action Activate optimized;
  draft action Discard;
  draft action Resume;
  draft determine action Prepare;
  ...
}
```

---

## Unmanaged RAP — Wrapping Existing BAPIs

```cds
unmanaged implementation in class zbp_i_so_unmanaged unique;

define behavior for ZI_SalesOrderUnmanaged alias SalesOrder
  lock master
  authorization master ( global )
{
  create; update; delete;
  ...
}
```

```abap
METHOD create_salesorder.   " in behavior implementation
  LOOP AT entities INTO DATA(ls_entity).
    " Call legacy BAPI
    CALL FUNCTION 'BAPI_SALESORDER_CREATEFROMDAT2'
      EXPORTING order_header_in = ...
      ...
      TABLES return = lt_return.

    " Map BAPI errors to RAP messages
    LOOP AT lt_return INTO DATA(ls_ret) WHERE type CA 'EA'.
      APPEND VALUE #(
        %cid = ls_entity-%cid
        %msg = new_message( id = ls_ret-id number = ls_ret-number
                            severity = if_abap_behv_message=>severity-error
                            v1 = ls_ret-message_v1 )
      ) TO reported-salesorder.
    ENDLOOP.
  ENDLOOP.
ENDMETHOD.
```

---

## Service Definition & Binding

```cds
" Service Definition (SRVD)
@EndUserText.label: 'Sales Order Service'
define service ZSD_SalesOrder {
  expose ZI_SalesOrder as SalesOrder;
  expose ZI_CustomerText as CustomerText;
}
```

Service Binding (created in ADT, not CDS syntax):
- **ODATA V4 - UI**: For Fiori Elements apps
- **ODATA V4 - Web API**: For programmatic consumption
- **ODATA V2 - UI**: Legacy Fiori / Gateway apps

---

## Testing RAP

```abap
" Use EML (Entity Manipulation Language) in unit tests
CLASS ltc_salesorder DEFINITION FOR TESTING RISK LEVEL HARMLESS.
  METHODS test_create_order FOR TESTING.
ENDCLASS.

CLASS ltc_salesorder IMPLEMENTATION.
  METHOD test_create_order.
    MODIFY ENTITIES OF zi_salesorder
      ENTITY salesorder CREATE
        FIELDS ( Customer Currency )
        WITH VALUE #( ( %cid     = 'NEW1'
                        customer = '0000001000'
                        currency = 'USD' ) )
      MAPPED   DATA(ls_mapped)
      FAILED   DATA(ls_failed)
      REPORTED DATA(ls_reported).

    cl_abap_unit_assert=>assert_initial( ls_failed ).
  ENDMETHOD.
ENDCLASS.
```

---

## Common Mistakes

1. **Missing etag field**: Always include `local_last_changed_at` for optimistic locking
2. **Direct DB modify in handler**: Never `UPDATE zsales_order` in handler — use `MODIFY ENTITIES IN LOCAL MODE`
3. **Using SY-SUBRC for errors**: Use `failed` / `reported` tables
4. **Forgetting `IN LOCAL MODE`**: Without it, triggers authorization checks and validations again
5. **Draft table not activated**: Generate draft table via ADT before activating behavior definition
