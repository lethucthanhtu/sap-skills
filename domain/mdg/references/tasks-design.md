# MDG Common Tasks & Design Guidance

Read for: where to configure common MDG tasks (add a field, new CR type, rule-based workflow, agent BAdI, replication, programmatic CRs) and design guidance. Every transaction, BAdI and class name is a search hint to confirm in the system.

---

## 3. Common tasks → where to look

| Task | Typical route (verify for your release and mode) |
|---|---|
| Add a field to BP / product governance | Extend the data model (entity attribute), generate structures, extend the UI (FPM/UIBB or Fiori app adaptation), map to the active area (reuse: SMT mapping / BAdI), adjust replication |
| New CR type | `MDGIMG` → *Process Modeling → Change Requests → Create Change Request Type*; assign entity, UI, workflow |
| Rule-based workflow | `MDGIMG` → *Process Modeling → Workflow → Rule-Based Workflow → Configure Rule-Based Workflow* (transaction `USMD_SSW_RULE` on many releases) |
| Dynamic agent determination | Rule-based workflow BAdI for dynamic agent selection (enhancement spot of the rule-based workflow; search "USMD_SSW" in SE18 / ADT) |
| ABAP validation | Rule-service BAdI (search "USMD_RULE_SERVICE") or BRF+ rules |
| Field properties (read-only, mandatory) | BRF+ decision tables or the field-property BAdI for your domain |
| Replicate to ERP/third party | `DRFIMG` replication model + outbound implementation + filter; monitor with `DRFLOG` / SOA Manager / `WE02` for IDocs |
| Programmatic CR creation | MDG governance API (classes such as `CL_USMD_GOV_API` / convenience API `CL_USMD_CONV_SOM_GOV_API` on many releases) — confirm availability and signatures in ADT before use |

Treat every transaction code, BAdI and class name in this table as a *search hint*:
confirm in the system (SE93, SE18, ADT) or on help.sap.com for the user's release.

---

## 4. Design guidance

- **Model the process, not the screen**: define CR types around business events
  (create supplier, change bank data, block customer), each with its own approval path.
- **Keep validations close to data**: BRF+ for business-maintained rules, BAdI for
  complex/technical checks; avoid duplicating the same check in the UI.
- **Agents**: prefer organizational/rule-based agent determination over hard-coded
  user IDs; keep a fallback agent.
- **Replication**: design filters and key mapping before go-live; test re-replication
  and error handling (DRF messages, SOA/IDoc reprocessing).
- **Clean core**: on S/4HANA prefer configuration, BRF+ and released extension points;
  modifications to MDG standard are the last resort. In cloud-ready mode and the cloud
  edition, many classic enhancement options don't exist.
- **Data quality**: combine governance (prevent bad data) with consolidation/mass
  processing (fix existing data); define match/duplicate checks early.
