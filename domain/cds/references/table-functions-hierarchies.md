# CDS Table Functions & Hierarchies

Read for: `define table function` + AMDP implementation, client handling, `define hierarchy`. Table functions are available in ABAP Cloud too (AMDP `USING` may only list released or own objects).

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
- ABAP Cloud: supported (AMDP is available in ABAP Cloud); the SQLScript may only
  use objects permitted in ABAP Cloud (released or own objects)
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
-- Source: a custom table with an explicit parent column (illustrative; the SAP
-- standard cost center table CSKS has no parent field — hierarchies live elsewhere)
define view entity Z_I_CostCenter
  as select from zcostcenter as K
  association [0..1] to Z_I_CostCenter as _Parent
    on $projection.ParentCostCenter = _Parent.CostCenter
    and $projection.ControllingArea  = _Parent.ControllingArea
{
  key K.kostl        as CostCenter,
  key K.kokrs        as ControllingArea,
      K.ktext        as CostCenterName,
      K.parent_kostl as ParentCostCenter,
      K.datab       as ValidFrom,
      K.datbi       as ValidTo,
      _Parent
}
```

### Hierarchy Annotations (legacy, DDIC-based views / analytics)

```abap
@Hierarchy.parentChild: [{
  recurse: {
    by: 'ParentCostCenter',  -- field pointing to parent key
    to: ['CostCenter']       -- key fields of parent
  }
}]
```
