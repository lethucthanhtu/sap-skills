# SQLScript & AMDP

Read for: set-based SQLScript procedures, security/read-only options, dynamic SQL rules, AMDP classes, `USING`, client handling, C4 contract.

---

## 2. SQLScript essentials

```sql
-- [Environment: SAP HANA Cloud / HANA 2.0 HDI]  file: db/src/get_top_customers.hdbprocedure
PROCEDURE "get_top_customers" (
  IN  iv_year   INTEGER,
  IN  iv_top    INTEGER,
  OUT et_result TABLE ( customer_id NVARCHAR(10), revenue DECIMAL(15,2) ) )
  LANGUAGE SQLSCRIPT SQL SECURITY INVOKER READS SQL DATA AS
BEGIN
  lt_orders = SELECT customer_id, amount FROM "orders" WHERE YEAR(order_date) = :iv_year;
  et_result = SELECT customer_id, SUM(amount) AS revenue
                FROM :lt_orders GROUP BY customer_id
                ORDER BY revenue DESC LIMIT :iv_top;
END;
```

- Think in **table variables** (`lt_x = SELECT …`), not loops; the optimizer inlines them.
- `READS SQL DATA` for read-only procedures allows more optimization and parallelism.
- `SQL SECURITY INVOKER` unless definer rights are deliberately needed.
- Dynamic SQL (`EXEC`, `EXECUTE IMMEDIATE`) only with `APPLY_FILTER` or bound
  parameters — never concatenate user input.
- Avoid cursors and row-by-row loops; use `MAP_MERGE` / set operations instead.

---

## 3. AMDP (from ABAP)

```abap
" [Environment: S/4HANA (any) / BTP ABAP Env — check AMDP availability for your release]
CLASS zcl_top_customers DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_amdp_marker_hdb.
    TYPES: BEGIN OF ty_row, customer TYPE kunnr, revenue TYPE netwr, END OF ty_row,
           tt_rows TYPE STANDARD TABLE OF ty_row WITH EMPTY KEY.
    CLASS-METHODS get IMPORTING VALUE(iv_top) TYPE i EXPORTING VALUE(et_rows) TYPE tt_rows.
ENDCLASS.

CLASS zcl_top_customers IMPLEMENTATION.
  METHOD get BY DATABASE PROCEDURE FOR HDB LANGUAGE SQLSCRIPT
             OPTIONS READ-ONLY USING zsales_order_tab.
    et_rows = SELECT customer, SUM(net_amount) AS revenue
                FROM zsales_order_tab GROUP BY customer
                ORDER BY revenue DESC LIMIT :iv_top;
  ENDMETHOD.
ENDCLASS.
```

- Every table/view/AMDP used must be listed in `USING`. AMDP does no implicit client
  handling: filter on the client yourself (e.g. `SESSION_CONTEXT('CLIENT')`) or use the
  `AMDP OPTIONS CDS SESSION CLIENT` addition where the release supports it.
- In ABAP Cloud only released objects (or your own) may appear in `USING`; AMDP
  methods reusable by other AMDPs need the C4 contract.
- CDS table functions are implemented by AMDP functions (`BY DATABASE FUNCTION`), see
  `domain/cds/references/table-functions-hierarchies.md`.
