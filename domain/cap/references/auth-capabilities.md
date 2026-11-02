# CAP Authorization & Frequent Capabilities

Read for: `@requires`/`@restrict`, XSUAA/IAS roles, mock users, draft, Fiori annotations, remote services, messaging, multitenancy, databases, testing, deploy.

---

## 4. Authorization

```cds
service AdminService @(requires: 'admin') {
  entity Books @(restrict: [
    { grant: 'READ',  to: 'authenticated-user' },
    { grant: ['CREATE','UPDATE','DELETE'], to: 'admin' },
    { grant: 'UPDATE', to: 'vendor', where: 'createdBy = $user' }
  ]) as projection on my.Books;
}
```

Roles map to XSUAA scopes/role templates (`cds add xsuaa` generates
`xs-security.json`) or to IAS/AMS policies. Mock users for local dev in
`package.json` → `cds.requires.auth`.

---

## 5. Frequent capabilities

| Need | How |
|---|---|
| Fiori draft | `annotate CatalogService.Books with @odata.draft.enabled;` |
| Fiori UI | annotations in `app/*/annotations.cds` (see `domain/fiori-sapui5/references/annotations-ui.md`) |
| Consume S/4HANA API | `cds import <edmx>` → `cds.connect.to('API_BUSINESS_PARTNER')`, destination on BTP |
| Messaging / events | `cds.connect.to('messaging')` with Event Mesh; `srv.emit` / `srv.on('event')` |
| Multitenancy / SaaS | `@sap/cds-mtxs`, `cds add multitenancy` (subscription, tenant upgrade, extensibility) |
| Localized data | `localized` keyword + `_texts` entities, i18n bundles |
| Databases | `@cap-js/sqlite` (dev), `@cap-js/hana`, `@cap-js/postgres` |
| Testing | `cds.test(__dirname + '/..')` with Jest/Mocha, `GET/POST` helpers |
| Deploy | `cds build`, `mbt build`, `cf deploy` (CF) or `cds add helm` (Kyma) |
