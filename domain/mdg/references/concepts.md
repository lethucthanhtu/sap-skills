# MDG Core Concepts

Read for: data models, reuse vs flex mode, change requests, rule-based workflow, editions, validations/derivations, key mapping, DRF, consolidation and mass processing.

---

## 2. Core concepts

- **Data model** – entity types, attributes, relationships (`MDGIMG` → *General Settings
  → Data Modeling*). SAP-delivered: `BP` (business partner), `MM` (material/product),
  `0G` (financials). Custom objects use your own data model (flex mode).
- **Reuse vs flex mode** – reuse active area = SAP standard tables (e.g. BP, material);
  flex mode = MDG-generated tables for the active area (custom objects, some financial
  entities). Staging area always holds the change-request data until activation.
- **Change request (CR)** – the governed unit of change. CR **type** defines the data
  model, main entity, single/multiple objects, the UI and the workflow.
- **Workflow** – usually the **rule-based workflow** (BRF+ decision tables per CR type:
  single value, user agent, non-user agent decision tables). Classic SAP Business
  Workflow templates are still possible. Steps, agents, statuses and *step actions*
  (approve, reject, send back) are configured per CR type.
- **Editions** – time-dependent validity for financial data (e.g. cost centers in `0G`).
- **Validations & derivations** – BRF+ rules (`USMD_RULE`-style configuration under
  *Data Quality and Search*), plus the rule-service BAdI for ABAP checks. Derivation
  scenarios are configurable on recent releases.
- **Key mapping & value mapping** – link IDs across systems; needed for hub deployments.
- **Data Replication Framework (DRF)** – replication models, outbound implementations,
  filters (`DRFIMG` Customizing, `DRFOUT` manual replication). Transport: SOA services,
  IDocs, or RFC depending on object.
- **Consolidation & mass processing** – load/standardize/match/best-record/activate
  process for data from several sources (MDC apps); mass change with validation.
