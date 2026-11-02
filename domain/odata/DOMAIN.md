# OData Domain — Router & Rules

## When to Read This File

Activate when the user mentions: `OData`, `V2`, `V4`, `$metadata`, `service definition`,
`service binding`, `expose`, `SEGW`, `Gateway`, `/IWFND/`, `/IWBEP/`, `$batch`, `changeset`,
`$filter`, `$expand`, `$apply`, `$select`, `ETag`, `If-Match`, `412`, `428`, `CSRF`,
`X-CSRF-Token`, `deep insert`, `function import`, `bound action`, `IsActiveEntity`,
`draft protocol`, `delta link`, `sap-message`, `Business Accelerator Hub API`.

Non-SAP OData (ASP.NET, Olingo without SAP context) is out of scope for this skill.

---

## MANDATORY Rules for ALL OData Responses

### Rule R1 — Pick the Service Model from the Environment

```
ECC / NetWeaver Gateway        → OData V2 via SEGW (MPC/DPC_EXT classes)
S/4HANA 2020+ (RAP)            → service definition + service binding, OData V4 (UI or Web API)
S/4HANA Cloud / BTP ABAP Env   → RAP service binding only (SEGW not available)
Consumer needs V2 (old UI5 app, SAP Analytics Cloud live, 3rd party) → V2 binding of the RAP service
Never: @OData.publish: true for new development
```

### Rule R2 — Binding Type Decides the Contract

- `OData V4 - UI`: Fiori elements, draft, side effects, value helps.
- `OData V4 - Web API`: system-to-system, no UI annotations / draft semantics.
- Publishing: on-premise via `/IWFND/V4_ADMIN` (V4 service groups) or `/IWFND/MAINT_SERVICE` (V2);
  in ABAP Cloud the binding's *Publish* button plus a communication scenario for external access.

### Rule R3 — Concurrency and CSRF Are Not Optional

- Modifying requests need an ETag (`If-Match`) when the BO defines `etag master`; a missing one
  → 428, a stale one → 412. Re-read the entity, then retry.
- SAP Gateway requires `X-CSRF-Token` for modifying requests: fetch with `X-CSRF-Token: Fetch`
  on a GET, reuse the token and the session cookies.

### Rule R4 — Errors Travel as Messages, Not Dumps

RAP handlers fill `failed`/`reported`; the framework maps them to the OData error body and the
`sap-messages` header. Never raise an unhandled exception in a handler (→ HTTP 500). Consumers
(CAP, UI5) must read `error.details` / `innererror` and show the message, not swallow it.

---

## Domain File Routing

| User asks about... | Read file |
|---|---|
| Draft protocol, `IsActiveEntity`, Edit/Activate/Prepare/Discard over HTTP | `references/draft-protocol.md` |
| `$apply` aggregation, `$batch` (V4 JSON / V2 multipart), changesets, delta links | `references/apply-batch-delta.md` |
| ETag, `If-Match`, 412/428, bound vs unbound actions and functions | `references/etag-actions.md` |
| Error payloads, severities, HTTP status codes, CSRF, `Prefer` | `references/errors-headers.md` |
| Deep insert, POST via navigation property, V2 vs V4 comparison | `references/deep-insert-navigation.md` |

**Cross-domain routing:**
- Behavior behind the service (actions, validations, draft) → `domain/rap/DOMAIN.md`
- CDS projection / annotations exposed by the service → `domain/cds/DOMAIN.md`
- Consuming the service from CAP → `domain/cap/DOMAIN.md`; from UI5 → `domain/fiori-sapui5/DOMAIN.md`
- Connectivity (destinations, Cloud Connector, communication arrangements) → `domain/btp/DOMAIN.md`

---

## Quick Anti-Pattern Guard

| Pattern found | Problem | Fix |
|---|---|---|
| `@OData.publish: true` | Legacy, not RAP | Service definition + binding |
| New SEGW project on S/4HANA 2020+ | Classic, not clean core | RAP service binding (V4, or V2 if required) |
| PATCH without `If-Match` on an ETag-enabled entity | 428 Precondition Required | Send the ETag from the last GET |
| Ignoring 412 and retrying blindly | Overwrites concurrent changes | Re-read, merge, retry |
| `$batch` without changesets for dependent writes | No atomicity | Group writes in one changeset |
| Expanding many levels in one request | Slow, large payloads | `$select` + targeted `$expand` |
| Hard-coded service URL with client/credentials | Breaks across landscapes, leaks secrets | Destination / communication arrangement |

---

## Sources

| Topic | URL |
|---|---|
| CDS service definitions (keyword docs) | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_SERVICE_DEFINITIONS.html |
| OData V4 protocol (OASIS) | https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html |
| OData V4 data aggregation (`$apply`) | https://docs.oasis-open.org/odata/odata-data-aggregation-ext/v4.0/odata-data-aggregation-ext-v4.0.html |
| SAP Gateway Service Builder (SEGW) | https://help.sap.com/docs/ABAP_PLATFORM_NEW/68bf513362174d54b58cddec28794093/cddd22512c312314e10000000a44176d.html |
| SAP Business Accelerator Hub | https://api.sap.com |
