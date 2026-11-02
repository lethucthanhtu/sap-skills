# BTP Connectivity & Security

Read for: destinations, Cloud Connector, communication arrangements, XSUAA vs IAS/AMS, technical users, secrets, approuter.

---

## 3. Connectivity

- **Destination service**: named endpoints + auth (BasicAuthentication,
  OAuth2SAMLBearerAssertion, OAuth2ClientCredentials, PrincipalPropagation,
  OAuth2JWTBearer, …). Apps look up destinations at runtime; never hard-code URLs or
  credentials.
- **Connectivity service + Cloud Connector**: reach on-premise systems (S/4HANA, ECC)
  from BTP. Cloud Connector exposes *virtual hosts* with an allowlist of resources;
  principal propagation maps the BTP user to the back-end user.
- **ABAP Environment / S/4HANA Cloud** use **communication scenarios → communication
  systems → communication arrangements** instead of raw destinations for inbound and
  outbound integration.
- Calling S/4HANA APIs: discover them on api.sap.com (Business Accelerator Hub), import
  the EDMX into CAP (`cds import`) or generate a client with the SAP Cloud SDK.

---

## 4. Security

| Topic | Guidance |
|---|---|
| App auth (CF/Kyma) | **XSUAA** service with `xs-security.json` (scopes, role templates, role collections) is the established path; SAP is moving apps toward **IAS + Authorization Management Service (AMS)** — check which the landscape uses |
| Human users | Federate via IAS to the corporate IdP; assign role collections (BTP) or business roles (ABAP Env/S/4HANA Cloud) |
| Technical users | OAuth client credentials or communication users; scope them to one scenario |
| Secrets | Service bindings / credential store, never in `mta.yaml`, `manifest.yml` or Git |
| Approuter | Handles login, CSRF and routing for UI apps (`xs-app.json`) |
