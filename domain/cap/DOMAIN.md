# CAP Domain — Router & Rules

## When to Read This File

Activate when the user mentions: `CAP`, `Cloud Application Programming Model`, `@sap/cds`,
`cds-dk`, `cds watch`, `cds init`, `cds add`, `cds deploy`, `cds import`, `cds.connect.to`,
`srv.on`, `srv.before`, `srv.after`, `req.error`, `req.reject`, `CQL`, `SELECT.from`,
`@restrict`, `@requires`, `cuid`, `managed`, `aspect`, `@odata.draft.enabled`,
`remote service`, `EDMX`, `mashup`, `hybrid testing`, `cds bind`, `@sap/cds-mtxs`,
`multitenancy`, `@cap-js/hana`, `@cap-js/sqlite`, `@cap-js/postgres`, CAP Java.

CAP CDS is **not** ABAP CDS: `define view entity`, `@AbapCatalog`, `$projection` are ABAP;
`aspect`, `cuid`, `managed`, `service { entity … as projection on … }` are CAP. Never mix them.
ABAP CDS questions → `domain/cds/DOMAIN.md`.

---

## MANDATORY Rules for ALL CAP Responses

### Rule R1 — Check the CAP Version

CAP ships a major release about yearly. Read `@sap/cds` from `package.json` and check the capire
release notes before quoting APIs, plugins or defaults (database services, auth kinds, CLI).

### Rule R2 — Validate in `before`, Implement in `on`, Never Concatenate CQL

`before` handlers reject bad input (`req.reject` / `req.error`), `on` implements or replaces
the default, `after` post-processes. CQL tagged templates bind values as parameters; never
build CQL or SQL strings from request data.

### Rule R3 — Propagate Remote (SAP OData) Errors, Don't Swallow Them

```js
// [CAP Node.js] remote S/4HANA service
const s4 = await cds.connect.to('API_BUSINESS_PARTNER')   // destination-backed, no hard-coded URL
this.on('READ', 'Suppliers', async (req) => {
  try {
    return await s4.run(req.query)
  } catch (err) {
    const status = err.reason?.response?.status ?? err.statusCode ?? 502
    // Log the technical detail; send a safe, actionable message to the client.
    cds.log('s4').error('S/4HANA call failed', err)
    req.error(status >= 500 ? 502 : status, 'Supplier service is unavailable or rejected the request')
  }
})
// ❌ .catch(() => []) — the Fiori table shows "no data" and nobody learns the back end failed
```

Map 5xx/timeouts to 502/503/504 for the client; pass through 4xx validation messages only when
they are meant for end users. Never return raw back-end payloads (system names, internals).

### Rule R4 — Authorization Lives in the Model

Declare `@requires` / `@restrict` on services and entities; generate `xs-security.json` from
the model instead of hand-editing it. Use mock users locally, never real credentials.

---

## Domain File Routing

| User asks about... | Read file |
|---|---|
| Project skeleton, entities, services, Node.js/Java event handlers, CQL | `references/models-handlers.md` |
| `@restrict`, roles, draft, Fiori annotations, remote services, messaging, MTX, DBs, tests, deploy | `references/auth-capabilities.md` |

**Cross-domain routing:**
- Deploying to Cloud Foundry/Kyma, destinations, XSUAA/IAS → `domain/btp/DOMAIN.md`
- Fiori elements UI on a CAP service → `domain/fiori-sapui5/DOMAIN.md`
- Consumed S/4HANA OData service behaviour (ETag, `$batch`, errors) → `domain/odata/DOMAIN.md`
- HANA Cloud / HDI specifics → `domain/hana-sqlscript/DOMAIN.md`

---

## Quick Anti-Pattern Guard

| Pattern found | Problem | Fix |
|---|---|---|
| SQL/CQL built by string concatenation with request data | Injection | Tagged templates / CQN builders |
| `.catch(() => [])` around a remote call | Silent failure, empty UI | `req.error()` with a mapped status |
| Raw back-end error text returned to the browser | Leaks internals | Log details, return a safe message |
| `throw new Error()` for business errors | Generic 500 | `req.reject(4xx, msg)` / `req.error()` |
| Hard-coded URLs/credentials for remote services | Breaks per landscape, leaks secrets | `cds.requires.<srv>` + destination |
| DB entities exposed directly | No API boundary | Service projections |
| Hand-written `xs-security.json` | Drifts from `@restrict` | Generate from the model |
| ABAP CDS syntax in `.cds` files (or CAP syntax in ADT) | Won't compile | Use the right CDS dialect |

---

## Sources

| Topic | URL |
|---|---|
| CAP documentation (capire) | https://cap.cloud.sap/docs/ |
| CAP release notes | https://cap.cloud.sap/docs/releases/ |
| Consuming remote services | https://cap.cloud.sap/docs/guides/using-services |
| CAP samples | https://github.com/SAP-samples/cloud-cap-samples |
