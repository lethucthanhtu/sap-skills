# BTP Domain — Router & Rules

## When to Read This File

Activate when the user mentions: `BTP`, `Business Technology Platform`, `global account`,
`subaccount`, `entitlement`, `Cloud Foundry`, `cf deploy`, `Kyma`, `ABAP Environment`,
`Steampunk`, `destination`, `Cloud Connector`, `principal propagation`, `XSUAA`,
`xs-security.json`, `role collection`, `IAS`, `AMS`, `approuter`, `xs-app.json`, `MTA`,
`mta.yaml`, `mbt build`, `HTML5 repository`, `Work Zone`, `Event Mesh`, `Discovery Center`,
`btp CLI`, `Terraform provider for SAP BTP`, `communication arrangement`.

---

## MANDATORY Rules for ALL BTP Responses

### Rule R1 — One Runtime per Workload, Chosen on Purpose

```
Standard business app / extension, simplest ops → Cloud Foundry (CAP, approuter, MTA)
Containers, K8s control, event-driven services  → Kyma
ABAP skills, RAP apps                           → ABAP Environment (ABAP Cloud only)
Embedded Steampunk                              → not BTP: developer extensibility inside S/4HANA
```

### Rule R2 — Check Availability, Don't Assume

Services, plans and regions differ. Verify in the SAP Discovery Center (or the ABAP MCP
`sap_discovery_center_search` tool) and in the subaccount's entitlements before recommending
a service. Never quote prices; point to Discovery Center or the user's contract.

### Rule R3 — No Credentials in Code or Descriptors

Destinations, service bindings and the credential store hold secrets. Nothing secret in
`mta.yaml`, `manifest.yml`, `default-env.json`, `.env` or Git. On-premise access always goes
through Cloud Connector; S/4HANA Cloud and the ABAP Environment use communication arrangements.

### Rule R4 — Separate Landscapes

Dev/test/prod in separate subaccounts with a transport path (Cloud Transport Management or
CI/CD). Federate users through IAS to the corporate IdP.

---

## Domain File Routing

| User asks about... | Read file |
|---|---|
| Account model, entitlements, trust, CLI/Terraform, CF vs Kyma vs ABAP Env | `references/account-runtimes.md` |
| Destinations, Cloud Connector, communication arrangements, XSUAA/IAS/AMS, approuter | `references/connectivity-security.md` |
| MTA, HTML5 repo, Work Zone, CI/CD, transport, logging, Integration Suite, events | `references/deploy-integration.md` |

**Cross-domain routing:**
- CAP apps on BTP → `domain/cap/DOMAIN.md`
- UI deployment and launchpad → `domain/fiori-sapui5/DOMAIN.md`
- iFlows, API Management → `domain/integration-suite/DOMAIN.md`
- Extension style decision (key user vs on-stack vs side-by-side) → `domain/clean-core/DOMAIN.md`

---

## Quick Anti-Pattern Guard

| Pattern found | Problem | Fix |
|---|---|---|
| Credentials in `manifest.yml` / `mta.yaml` / `default-env.json` in Git | Secret leak | Service bindings, destinations, credential store |
| Direct internet call to an on-premise host | Insecure, usually impossible | Cloud Connector + destination |
| One subaccount for dev/test/prod | No isolation, no transport path | Separate subaccounts + CTMS / CI/CD |
| "Service X exists everywhere" | Region/plan specific | Check Discovery Center |
| Classic ABAP planned on BTP ABAP Environment | Not supported | ABAP Cloud, or keep it on-stack |
| Hand-maintained `xs-security.json` drifting from CAP `@restrict` | Wrong authorizations | Regenerate (`cds add xsuaa` / `cds compile --to xsuaa`) |

---

## Sources

| Topic | URL |
|---|---|
| SAP BTP documentation | https://help.sap.com/docs/btp |
| BTP CLI | https://help.sap.com/docs/btp/sap-business-technology-platform/sap-btp-command-line-interface-btp-cli |
| Connectivity (destinations, Cloud Connector) | https://help.sap.com/docs/connectivity |
| SAP Discovery Center | https://discovery-center.cloud.sap/ |
| SAP Business Accelerator Hub | https://api.sap.com |
