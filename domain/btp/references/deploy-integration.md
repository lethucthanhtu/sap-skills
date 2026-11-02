# BTP Deploy, Operate & Integrate

Read for: MTA build/deploy, HTML5 repository, Work Zone, CI/CD and transport, observability, Integration Suite and events overview.

---

## 5. Deploy & operate

- **MTA** (`mta.yaml`) bundles modules (apps, DB deployer, UI content) and resources
  (service instances). Build with `mbt build`, deploy with `cf deploy` (MultiApps CF CLI
  plugin). CAP generates it with `cds add mta`.
- **HTML5 Application Repository** + **SAP Build Work Zone** host and expose Fiori/UI5
  apps on BTP.
- **CI/CD**: SAP Continuous Integration and Delivery service, or GitHub Actions with
  `cf`/`btp` CLIs; **Cloud Transport Management** to move MTAs across subaccounts.
- **Observability**: SAP Cloud Logging (successor of the Application Logging service),
  Alert Notification, SAP Cloud ALM for business-process and integration monitoring.

---

## 6. Integration & events (overview)

- **SAP Integration Suite**: Cloud Integration (iFlows, Groovy scripts, adapters), API
  Management, Integration Advisor, Event Mesh capability, Open Connectors.
- **Events**: S/4HANA publishes business events (e.g. BusinessPartner.Changed); consume
  them with SAP Event Mesh / Advanced Event Mesh, then react in CAP or Kyma.
- Prefer SAP-published, released APIs/events over custom RFC or table replication.
