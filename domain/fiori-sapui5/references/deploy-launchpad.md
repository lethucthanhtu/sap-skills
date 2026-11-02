# Fiori Deployment & Launchpad

Read for: deploying to the ABAP repository, public cloud or BTP HTML5 repository, and exposing apps via launchpad / Work Zone.

---

## 5. Deploy & launch

| Back end | Deploy target | Launch |
|---|---|---|
| S/4HANA on-prem / private | ABAP repository (BSP app via `npm run deploy` / `deploy-to-abap`, or `/UI5/UI5_REPOSITORY_LOAD`) | Fiori launchpad: catalog, group/space & page, target mapping (semantic object + action) |
| S/4HANA public cloud | Developer extensibility app deploy or key-user UI adaptation | Business catalog + business role |
| BTP | HTML5 Application Repository via MTA | SAP Build Work Zone (standard/advanced) |

Find standard apps, their IDs, OData services and required roles in the
**SAP Fiori apps reference library**.
