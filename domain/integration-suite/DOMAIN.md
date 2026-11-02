# Integration Suite Domain — Router & Rules

## When to Read This File

Activate when the user mentions: `Integration Suite`, `Cloud Integration`, `CPI`, `HCI`,
`iFlow`, `integration flow`, `integration package`, `adapter`, `SOAP adapter`,
`IDoc adapter`, `OData adapter`, `HTTP adapter`, `SFTP`, `AS2`, `message mapping`,
`XSLT mapping`, `Groovy script`, `content modifier`, `router`, `splitter`,
`exception subprocess`, `JMS queue`, `data store`, `message monitoring`, `MPL`,
`API Management`, `API proxy`, `policy`, `Event Mesh`, `Advanced Event Mesh`,
`Integration Advisor`, `Trading Partner Management`, `Edge Integration Cell`,
`PI/PO migration`, `migration assessment`.

This domain is a compact router: it sets the rules and points to SAP documentation. It has
no local reference files yet, so research release-specific details (adapter options, Groovy
APIs, policy types) with `references/research-workflow.md` before answering.

---

## MANDATORY Rules for ALL Integration Suite Responses

### Rule R1 — Choose the Right Integration Style

| Need | Choose |
|---|---|
| Process-to-process mediation, mapping, protocol conversion | Cloud Integration (iFlow) |
| Expose / secure / throttle / monetise APIs | API Management (API proxy + policies) |
| Asynchronous, decoupled notifications (business events) | Event Mesh / Advanced Event Mesh |
| B2B / EDI message implementation guidelines | Integration Advisor + Trading Partner Management |
| Data must stay in the customer's own runtime | Edge Integration Cell (check the licence and sizing) |
| Simple point-to-point call from a CAP or RAP app | Direct consumption via destination — no iFlow needed |

Prefer SAP-delivered integration content from the SAP Business Accelerator Hub over
building flows from scratch.

### Rule R2 — Credentials and Keys Live in the Tenant, Never in the Flow

Use security material (user credentials, OAuth2 client credentials, keystore entries) and
reference it by alias. Never hard-code passwords, tokens or private keys in iFlows, Groovy
scripts, externalised parameters or Git.

### Rule R3 — Design for Failure

Every flow handles errors explicitly: exception subprocess, meaningful error responses,
retry with JMS / data store for asynchronous scenarios, idempotency for re-delivered
messages. Do not log full payloads with personal data in the message processing log
(MPL) or attachments in production.

### Rule R4 — Keep Groovy Small and Testable

Use standard steps (content modifier, mapping, converter, router) first. Groovy only for
logic the standard steps cannot express; keep scripts short, null-safe, and free of
blocking calls. Check the supported Groovy and Java versions of the tenant.

---

## Domain File Routing

| User asks about... | Read |
|---|---|
| Destinations, Cloud Connector, XSUAA/IAS, BTP subaccount setup | `domain/btp/DOMAIN.md` |
| OData service behaviour consumed by an iFlow (ETag, `$batch`, errors) | `domain/odata/DOMAIN.md` |
| RAP business events consumed via Event Mesh | `domain/rap/references/business-events.md` |
| MDG replication (DRF) vs middleware | `domain/mdg/DOMAIN.md` |
| Released APIs and clean-core integration choices | `domain/clean-core/DOMAIN.md` |
| Finding current adapter/policy docs | `references/research-workflow.md` |

---

## Quick Anti-Pattern Guard

| Pattern found | Problem | Fix |
|---|---|---|
| Passwords / tokens in iFlow properties or Groovy | Secret leak | Security material, referenced by alias |
| No exception subprocess | Silent failures, lost messages | Explicit error handling + alerting |
| Full payload logging in production | Personal data in logs, storage limits | Log IDs and status; trace only temporarily |
| Large Groovy scripts duplicating standard steps | Hard to maintain | Standard steps; small scripts |
| iFlow for a single synchronous call between two BTP apps | Extra hop, cost | Destination-based direct call |
| Accessing S/4HANA via unreleased RFCs from the cloud | Clean-core violation | Released OData/SOAP APIs or events |
| Copying SAP-delivered content and editing it | Loses updates | Configure / extend via the supported options |

---

## Sources

| Topic | URL |
|---|---|
| SAP Integration Suite documentation | https://help.sap.com/docs/integration-suite |
| SAP Business Accelerator Hub (APIs, integration content) | https://api.sap.com/ |
| SAP Discovery Center (service availability, plans) | https://discovery-center.cloud.sap/ |
