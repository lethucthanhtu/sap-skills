# Extension Options: Key User, Developer, Side-by-Side, Classic

Read for: choosing an extension style, on-stack vs side-by-side, and how to extend standard fields, logic, behavior and data models.

---

## 1. Decide the extension style first

| Style | Who / where | Typical artefacts | Available in |
|---|---|---|---|
| **Key user (in-app)** | Business expert in Fiori apps | Custom Fields, Custom Logic (cloud BAdIs), Custom CDS Views, Custom Business Objects, Custom Analytical Queries | S/4HANA Cloud Public & Private, on-prem (≥1709, varies by app) |
| **Developer (on-stack, ABAP Cloud)** | ABAP developer in ADT | RAP BOs, CDS view entities, released-API consumers, BAdI implementations, view/BDEF extensions | Public cloud (developer extensibility), Private/on-prem (≥2022, *ABAP Cloud* language version), BTP ABAP Environment |
| **Side-by-side** | Developer on SAP BTP | CAP or RAP (BTP ABAP Env) apps, Integration Suite flows, events, Build apps | Any S/4HANA edition, also ECC via remote APIs |
| **Classic ABAP** | ABAP developer in SE80/ADT | Reports, user exits, classic BAdIs, modifications, direct table access | ECC, S/4HANA private / on-prem only |

Rule of thumb: key user → developer on-stack → side-by-side → classic, in that order,
unless the requirement clearly needs something further down. Write down *why* a lower
option was ruled out.

**On-stack vs side-by-side heuristics**
- Tight transactional coupling with SAP data (same LUW, posting, validation in the
  standard UI) → on-stack.
- Independent lifecycle, different users (partners, mobile), heavy UI, non-ABAP skills,
  or several back-ends → side-by-side on BTP.
- Event-driven reactions to standard BOs (business partner created, sales order changed)
  → side-by-side, consuming SAP-published business events.

---

## 4. Extending standard SAP objects (developer extensibility)

- **Fields**: add via key-user *Custom Fields* where possible (gets UI, OData, CDS and
  API propagation for free). Developer route: extension include / `EXTEND VIEW ENTITY`
  on a C0-released extension point.
- **Logic**: implement a released (cloud) BAdI. Find them in the Custom Logic app or
  ADT → *Released Objects* → enhancement spots. Classic BAdIs/user exits are classic
  ABAP only.
- **Behavior**: RAP BDEF extensions (`extension;` on the base BDEF, then
  `extend behavior for …`) only where SAP has enabled extensibility for that BO.
- **Data model**: CDS entity extensions on extensible released views; no direct
  appends to SAP tables from ABAP Cloud.
- **New apps on SAP data**: build your own RAP BO on released `I_*` views, or consume
  the released OData API remotely.
