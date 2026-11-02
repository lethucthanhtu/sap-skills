# HANA / SQLScript Domain — Router & Rules

## When to Read This File

Activate when the user mentions: `HANA`, `HANA Cloud`, `HANA 2.0`, `SQLScript`, `procedure`,
`.hdbprocedure`, `.hdbtable`, `.hdbcalculationview`, `HDI`, `HDI container`,
`calculation view`, `AMDP`, `BY DATABASE PROCEDURE`, `BY DATABASE FUNCTION`,
`if_amdp_marker_hdb`, `EXPLAIN PLAN`, `PlanViz`, `SQL Analyzer`, `M_SQL_PLAN_CACHE`,
`M_EXPENSIVE_STATEMENTS`, `column store`, `delta merge`, `NSE`, `partitioning`,
`analytic privilege`, `Database Explorer`.

---

## MANDATORY Rules for ALL HANA Responses

### Rule R1 — Which HANA, and Who Owns the Data?

| | HANA Cloud | HANA 2.0 (on-prem / private) | HANA under S/4HANA (ABAP) |
|---|---|---|---|
| App access | HDI containers, CAP, SQL | HDI (XSA) or classic catalog | ABAP SQL, CDS, AMDP |
| Artefacts | `.hdbtable`, `.hdbview`, `.hdbprocedure`, `.hdbcalculationview` … | same, or legacy XS classic | ABAP Dictionary / CDS / AMDP |
| Tools | BAS, Database Explorer, HANA Cloud Central | BAS / Web IDE, Cockpit, HANA Studio (legacy) | ADT |

HANA Cloud ships quarterly (QRC) and differs from HANA 2.0 SPS — confirm the product before
quoting features. For data owned by an ABAP application, never create HDI or native objects:
use ABAP SQL / CDS first, AMDP only when they cannot express the logic.

### Rule R2 — Set-Based, Bound, Least Privilege

- Table variables (`lt_x = SELECT …`), no cursors or row loops where a set operation works.
- `READS SQL DATA` for read-only procedures; `SQL SECURITY INVOKER` unless definer rights are intended.
- Dynamic SQL only with bound parameters or `APPLY_FILTER`; never concatenate input.

### Rule R3 — AMDP Specifics

Every used object is listed in `USING`; AMDP does no implicit client handling (filter the
client or use the CDS session client option where available); in ABAP Cloud only released or
own objects may appear in `USING`, and AMDP methods reused by other AMDPs need contract C4.

---

## Domain File Routing

| User asks about... | Read file |
|---|---|
| SQLScript procedures/functions, AMDP classes, client handling, dynamic SQL | `references/sqlscript-amdp.md` |
| Calculation views, pruning, analytic privileges, plan analysis, monitoring views, NSE | `references/calcviews-performance.md` |

**Cross-domain routing:**
- CDS table functions implemented by AMDP → `domain/cds/references/table-functions-hierarchies.md`
- ABAP SQL pushdown before reaching for AMDP → `domain/abap-core/references/abap-sql.md`
- CAP on HANA Cloud (`@cap-js/hana`, HDI deploy) → `domain/cap/DOMAIN.md`

---

## Quick Anti-Pattern Guard

| Pattern found | Problem | Fix |
|---|---|---|
| Cursor / row-by-row loop | Slow, blocks parallelism | Set-based SQL, `MAP_MERGE` |
| `EXEC` / `EXECUTE IMMEDIATE` with concatenated input | SQL injection | Bound parameters, `APPLY_FILTER` |
| AMDP without client filter | Cross-client data | Client condition / session client option |
| HDI/native objects for ABAP-owned data | Bypasses ABAP authorization and lifecycle | ABAP SQL / CDS / AMDP |
| Reading S/4HANA tables directly from HANA | Bypasses authorizations, unsupported | Released APIs / CDS |
| Scripted calculation views | Deprecated | Graphical calculation views or SQLScript table functions |
| Feature assumed identical in HANA Cloud and HANA 2.0 | Different capabilities | Check the product-specific docs |

---

## Sources

| Topic | URL |
|---|---|
| SAP HANA Cloud documentation | https://help.sap.com/docs/hana-cloud |
| SAP HANA Platform (2.0) documentation | https://help.sap.com/docs/SAP_HANA_PLATFORM |
| AMDP (ABAP keyword docs) | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/index.htm?file=abenamdp.htm |
