# Calculation Views & HANA Performance

Read for: calculation view design and pruning, analytic privileges, EXPLAIN PLAN / SQL Analyzer / PlanViz, monitoring views, NSE.

---

## 4. Calculation views

- Graphical modelling of projections, joins, unions, aggregations, rank, star joins;
  data category CUBE (with star join) / DIMENSION / DEFAULT.
- Prefer calculation views over SQLScript-based scripted views (deprecated).
- Pruning: mark unions with constant mapping, use `Optimize join columns` carefully,
  declare cardinalities on joins to enable join pruning.
- Analytic privileges (`.hdbanalyticprivilege`) for row-level security.

---

## 5. Performance analysis

| Tool | Use |
|---|---|
| `EXPLAIN PLAN FOR …` / SQL Analyzer (BAS/Database Explorer) | Plan shape, operators, engines |
| PlanViz (on-prem) / SQL Analyzer (Cloud) | Actual execution with timings |
| `M_SQL_PLAN_CACHE`, `M_EXPENSIVE_STATEMENTS`, `M_ACTIVE_STATEMENTS` | Find hot statements |
| `M_CS_TABLES`, `M_TABLE_PERSISTENCE_STATISTICS` | Table size, memory, delta merge |
| Native Storage Extension (NSE) | Page-loadable warm data to cut memory (`ALTER TABLE … PAGE LOADABLE`) |

Typical fixes: push filters down before joins, avoid `SELECT *`, avoid implicit type
conversions in join/where conditions, partition very large tables, check delta-merge state.
