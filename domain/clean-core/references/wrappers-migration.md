# Wrapping Unreleased APIs & Custom-Code Migration

Read for: the Tier-2 / level-B wrapper pattern (private cloud and on-premise only) and the ATC-driven path from classic custom code to ABAP Cloud.

---

## 3. Wrapping an unreleased API (Tier 2 / level B pattern)

Only on S/4HANA private cloud / on-premise. Not possible in public cloud or the BTP
ABAP Environment (no classic ABAP there).

1. Search for a released successor first (Cloudification Repository, *Released Objects*
   view in ADT, api.sap.com). Prefer it even if it needs more code.
2. Create a classic-ABAP package (language version *Standard ABAP*) for the wrapper.
3. Write a small class with an interface that exposes **only what you need**, using
   your own types, not the SAP structures.
4. Release the wrapper interface/class for *Use in Cloud Development* (C1) in ADT.
5. Consume the wrapper from the ABAP Cloud package. Record the wrapped API so it can be
   replaced when SAP releases a successor.

```abap
" [Environment: S/4HANA on-premise / private cloud — classic ABAP wrapper package]
INTERFACE zif_sales_order_wrapper PUBLIC.
  TYPES: BEGIN OF ty_item, material TYPE matnr, quantity TYPE kwmeng, END OF ty_item,
         tt_items TYPE STANDARD TABLE OF ty_item WITH EMPTY KEY.
  METHODS create
    IMPORTING iv_customer TYPE kunnr iv_sales_org TYPE vkorg it_items TYPE tt_items
    RETURNING VALUE(rv_order) TYPE vbeln
    RAISING   zcx_sales_order_wrapper.
ENDINTERFACE.
```

Inside the implementation call the classic API, convert `BAPIRET2` messages into the
exception, and leave commit handling to the caller (in RAP, never commit — see
`domain/rap/DOMAIN.md`).

---

## 5. Custom-code migration toward ABAP Cloud

1. Inventory: usage data (SUSG/SCMON) to delete unused code first.
2. ATC with the cloud readiness variant (e.g. `ABAP_CLOUD_READINESS`, or the
   Cloudification-Repository-based check *Usage of Released APIs*) on a central ATC
   system or with the *Custom Code Migration* app.
3. Triage findings: (a) released successor exists → replace; (b) no successor → wrap
   (level B) or redesign; (c) language-construct findings (`WRITE`, dynpro) → re-platform
   UI to Fiori/RAP.
4. Move cleaned objects into ABAP Cloud packages incrementally; keep the ATC check in
   the transport release gate.
5. Re-run quarterly — SAP keeps releasing successors, which retires wrappers.
