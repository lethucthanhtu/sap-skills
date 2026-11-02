# CDS Parameters & Aggregation Views

Read for: `with parameters`, `$parameters`, defaults via `@Environment.systemField`, `GROUP BY`/`HAVING`, analytics annotations (cube/dimension).

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
-- Cube view: no GROUP BY here; the analytic engine aggregates at query time
@Analytics.dataCategory: #CUBE
define view entity Z_I_SalesCube
  as select from zsales as S
  association [0..1] to Z_I_Product as _Product
    on $projection.ProductId = _Product.ProductId
{
  key S.sales_doc    as SalesDocument,

  @ObjectModel.foreignKey.association: '_Product'
  S.product_id       as ProductId,
  S.company_code     as CompanyCode,

  @Aggregation.default: #SUM
  @Semantics.amount.currencyCode: 'Currency'
  S.net_amount       as TotalAmount,

  S.currency         as Currency,

  _Product
}

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
