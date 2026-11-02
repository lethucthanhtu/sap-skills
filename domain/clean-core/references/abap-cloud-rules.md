# ABAP Cloud Rules, Release Contracts & Clean Core Levels

Read for: what ABAP Cloud allows and forbids, release contracts C0–C4, how to check an API's release state, the 3-tier model vs clean core levels A–D.

---

## 2. ABAP Cloud in one page

ABAP Cloud = ABAP language version *ABAP for Cloud Development* + released APIs only +
ADT as the only IDE + RAP/CDS as the programming model.

- **Language version** is set per package / software component. Classic ABAP objects
  can't be called from ABAP Cloud objects unless released.
- **Released APIs** carry a *release contract*:
  - **C0** – extend: enhancement fields can be added at the specified extension options
  - **C1** – use system-internally: stable interface inside the AS ABAP (the one you check most often)
  - **C2** – use as remote API: stable interface for use outside the AS ABAP
  - **C3** – manage configuration content: stable persistence for configuration content
  - **C4** – use in AMDP: stable interface of AMDP methods for use in other AMDP methods
- Check an object's state in ADT → *Properties → API State*, or on the
  **Cloudification Repository** (`github.com/SAP/abap-atc-cr-cv-s4hc`), which lists
  released objects and their successors per S/4HANA release. The ABAP MCP server's
  `sap_search_objects` / `sap_get_object_details` tools query the same data.
- Not available in ABAP Cloud (non-exhaustive): `WRITE`/lists, dynpros, `SUBMIT`,
  `CALL TRANSACTION`, direct access to unreleased SAP tables, unreleased function
  modules/classes, `OPEN DATASET` on the app server, native SQL. Use console apps
  (`IF_OO_ADT_CLASSRUN`), RAP/Fiori, released CDS views (`I_*`), released classes.
- Available (often wrongly assumed missing): `AUTHORITY-CHECK` (with your own or
  released auth objects), CDS table functions/AMDP, your *own* function modules in an
  ABAP Cloud package (verify for your release), `CL_ABAP_CONTEXT_INFO` for system data,
  `CL_SYSTEM_UUID`, application jobs, application logs (`CL_BALI_*`), number ranges
  (`CL_NUMBERRANGE_RUNTIME`), bgPF (`CL_BGMC_*`). Always verify the release state.

### Clean core models — two vocabularies in use

| Older 3-tier model | Clean core levels (ABAP Extensibility Guide, from Aug 2025) |
|---|---|
| Tier 1: ABAP Cloud, released APIs | **A** – ABAP Cloud + released APIs (upgrade-safe) |
| Tier 2: classic ABAP wrapper released for Tier 1 | **B** – classic ABAP using SAP-documented *classic APIs* (BAPIs etc.) |
| Tier 3: classic extensions | **C** – uses internal/unreleased SAP objects (upgrade risk) |
| — | **D** – not recommended: modifications, writes to SAP tables, implicit enhancements |

Ask which vocabulary the team uses. Don't present the levels as stricter or looser
than SAP's own definition; quote the guide when the distinction matters.
