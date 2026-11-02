# Freestyle SAPUI5 Baseline & Tooling

Read for: Component/manifest, async loading, TypeScript, bindings, deprecated APIs, SAP Fiori tools, UI5 Tooling, tests (QUnit, OPA5, wdi5).

---

## 3. Freestyle UI5 — modern baseline

- App = **Component** + **`manifest.json`** (models, data sources, routing, dependencies).
- Use `sap.ui.define` modules, **async** loading everywhere (`"async": true` in
  routing/root view, `data-sap-ui-async="true"`), XML views, and the OData V4 model.
- Consider **TypeScript** (`ui5-tooling-transpile`, `@types/openui5`/`@sapui5/types`).
- Bindings: property `{Name}`, expression `{= ${Price} > 100 }`, i18n `{i18n>title}`.
- Controllers stay thin: formatting in formatters, logic in services, no DOM access.
- Accessibility & i18n: every text in `i18n.properties`, labels for inputs, keyboard nav.

**Deprecated / to avoid** (check deprecation list for your version): synchronous loading,
`jQuery.sap.*`, global names (`sap.m.Button` without module import),
`sap.ui.getCore()` in new code (UI5 2.x direction), `sap.ui.commons`, `sap.ui.ux3`.

---

## 4. Tooling

- **SAP Fiori tools** (VS Code extensions / SAP Business Application Studio): app
  generator (`@sap/generator-fiori`), Page Map, Guided Development, annotation LSP,
  service modeler, mock server.
- **UI5 Tooling** (`@ui5/cli`): `ui5 serve`, `ui5 build`, `ui5.yaml`, middlewares
  (`fiori-tools-proxy` for back-end proxying).
- Tests: QUnit (unit), OPA5 (integration), wdi5 (E2E with WebdriverIO).
