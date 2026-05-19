# SAP Environment Compatibility Matrix

Detailed comparison of all SAP environments relevant to development decisions.
Claude must check this file when environment-specific syntax, APIs, or features are in question.

> ⚠️ Always verify release-specific features at:
> - https://help.sap.com/whats-new/cf0cb2cb149647329b5d02aa96303f56
> - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/abap-platform-for-sap-s-4hana-2023/ba-p/13573791
> - https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/abap-platform-in-sap-s-4hana-cloud-private-edition-and-sap-s-4hana-2025/ba-p/14289979

---

## Table of Contents
1. [Environment Overview & Maintenance Timeline](#1-environment-overview--maintenance-timeline)
2. [ABAP Language Features Matrix](#2-abap-language-features-matrix)
3. [RAP Features Matrix](#3-rap-features-matrix)
4. [CDS Features Matrix](#4-cds-features-matrix)
5. [OData & Service Matrix](#5-odata--service-matrix)
6. [CAP Integration Matrix](#6-cap-integration-matrix)
7. [ABAP Version Mapping](#7-abap-version-mapping)
8. [Extensibility Model (A–D Rating)](#8-extensibility-model-ad-rating)
9. [Migration Decision Guide](#9-migration-decision-guide)

---

## 1. Environment Overview & Maintenance Timeline

### Five Environments at a Glance

| | ECC | S/4 On-Prem 2020/21 | S/4 On-Prem 2022/23 | S/4 On-Prem 2025 | S/4 Cloud Public |
|---|---|---|---|---|---|
| **DB** | Any (Oracle, DB2...) | HANA only | HANA only | HANA only | HANA only |
| **ABAP Version** | ≤ 7.52 | 7.54 / 7.56 | 7.57 / 7.58 | 8.16 | Continuous |
| **BASIS** | NetWeaver 7.x | SAP_BASIS 754/756 | SAP_BASIS 757/758 | SAP_BASIS 816 | Always latest |
| **Mainstream Maintenance** | Until 2027 ⚠️ | 2025 / 2026 | 2027 / 2030 | 2030+ | Quarterly updates |
| **Upgrade Frequency** | Annual SPs | Annual SPs | Biennial + FPS | Biennial + FPS | Quarterly |
| **Clean Core Required** | ❌ | Recommended | Strongly Recommended | Mandatory (Cloud) | ✅ Mandatory |
| **HANA Features** | Limited / none | Full | Full | Full + AI | Full + AI |

> 🆕 **S/4HANA 2025** (ABAP Platform 8.16, released Oct 2025): Now the latest On-Prem/Private Cloud release. Includes AI-assisted ABAP development (SAP Joule), CDS Table Entities, collaborative draft, cross-BO scenarios.
> Source: https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/abap-platform-in-sap-s-4hana-cloud-private-edition-and-sap-s-4hana-2025/ba-p/14289979

### ECC Maintenance Warning
> ⚠️ **ECC mainstream maintenance ends December 31, 2027.** Extended maintenance until 2030 at premium cost. No new innovations. S/4HANA 2025 is the recommended migration target.
> Source: https://avotechs.com/blog/new-features-sap-s4hana/

---

## 2. ABAP Language Features Matrix

### Core Syntax

| Feature | ECC (≤7.52) | S/4 2020/21 (7.54/56) | S/4 2022/23 (7.57/58) | S/4 2025 (8.16) | S/4 Cloud Public |
|---|---|---|---|---|---|
| Inline declarations `DATA(x)` | ✅ (7.40+) | ✅ | ✅ | ✅ | ✅ |
| `VALUE #` constructor | ✅ (7.40+) | ✅ | ✅ | ✅ | ✅ |
| `COND #` / `SWITCH #` | ✅ (7.40+) | ✅ | ✅ | ✅ | ✅ |
| `FILTER #` | ✅ (7.40+) | ✅ | ✅ | ✅ | ✅ |
| `REDUCE #` | ✅ (7.50+) | ✅ | ✅ | ✅ | ✅ |
| String templates `\| \|` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CORRESPONDING #` | ✅ (7.40+) | ✅ | ✅ | ✅ | ✅ |
| Secondary table keys | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exception classes | ✅ | ✅ | ✅ | ✅ | ✅ |
| ABAP Unit Testing | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CL_ABAP_TESTDOUBLE` | ❌ (7.50+) | ✅ | ✅ | ✅ | ✅ |
| ABAP Cloud syntax (`@DATA`) | ❌ | ✅ | ✅ | ✅ | ✅ |
| `AUTHORITY-CHECK` | ✅ | ✅ | ✅ | ✅ | ❌ use IAM |
| `WRITE` / classic reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| `SUBMIT` report | ✅ | ✅ | ✅ | ✅ | ❌ |
| `CALL TRANSACTION` | ✅ | ✅ | ✅ | ✅ | ❌ |
| Direct file I/O (`OPEN DATASET`) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Unreleased Function Modules | ✅ | ✅ | ✅ | ✅ | ❌ ATC blocks |

### ABAP SQL

| Feature | ECC | S/4 2020/21 | S/4 2022/23 | S/4 2025 | S/4 Cloud |
|---|---|---|---|---|---|
| `SELECT * FROM` | ✅ | ✅ | ✅ | ✅ | ❌ ATC warning |
| `INTO TABLE` without `@` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `INTO @DATA(...)` | ❌ | ✅ | ✅ | ✅ | ✅ |
| CTE (`WITH ... AS`) | ❌ (7.54+) | ✅ | ✅ | ✅ | ✅ |
| Window functions | ❌ (7.54+) | ✅ | ✅ | ✅ | ✅ |
| `CASE` in SELECT | ✅ | ✅ | ✅ | ✅ | ✅ |
| `COALESCE`, `NULLIF` | ✅ (7.50+) | ✅ | ✅ | ✅ | ✅ |
| Inline host expressions `@(...)` | ❌ | ✅ | ✅ | ✅ | ✅ |
| Join cardinality syntax | ❌ | ❌ | ✅ (7.58) | ✅ | ✅ |

### ABAP AI & Tools (2025+)

| Feature | ECC | S/4 2022/23 | S/4 2025 | S/4 Cloud |
|---|---|---|---|---|
| SAP Joule copilot in ADT | ❌ | ❌ | ✅ | ✅ |
| Predictive code completion | ❌ | ❌ | ✅ | ✅ |
| AI unit test generation | ❌ | ❌ | ✅ | ✅ |
| AI RAP BO generation | ❌ | ❌ | ✅ | ✅ |
| ATC Clean Core Level concept | ❌ | Partial | ✅ | ✅ |

> Source: https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/abap-platform-in-sap-s-4hana-cloud-private-edition-and-sap-s-4hana-2025/ba-p/14289979

---

## 3. RAP Features Matrix

| Feature | ECC | S/4 2020 (7.54) | S/4 2021 (7.56) | S/4 2022 (7.57) | S/4 2023 (7.58) | S/4 2025 (8.16) | S/4 Cloud Public |
|---|---|---|---|---|---|---|---|
| RAP (basic) | ❌ (1909+) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Managed scenario | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Unmanaged scenario | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Draft handling | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Actions & Validations | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Determinations | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `strict(2)` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Augmentation | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Precheck | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Late numbering | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| EML Test Doubles | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Business Events (local) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Business Events (Event Mesh BTP) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Background Processing (bgPF) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| CDS Scalar Functions in BDEF | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| CDS Table Entity as persistence | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (8.16) | ✅ |
| Collaborative draft (multi-user) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (8.16) | ✅ |
| Cross-BO scenarios | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (8.16) | ✅ |
| Tree view in Fiori (RAP) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (8.16) | ✅ |
| Event-driven side effects | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (8.16) | ✅ |
| Standard BO extension | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| RAP Generator (ADT wizard) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ + AI | ✅ + AI |
| BOPF (legacy BO) | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ deprecated | ❌ |

> Source: https://help.sap.com/docs/abap-cloud/abap-rap/abap-restful-application-programming-model
> Source: https://github.com/SAP-samples/abap-platform-refscen-flight (branches: ABAP-platform-2023, ABAP-platform-2025)

---

## 4. CDS Features Matrix

| Feature | ECC | S/4 2020/21 | S/4 2022/23 | S/4 2025 | S/4 Cloud |
|---|---|---|---|---|---|
| CDS View Entity (V2) | ✅ (7.40+) | ✅ | ✅ | ✅ | ✅ |
| `@UI` annotations | ❌ | ✅ | ✅ | ✅ | ✅ |
| `@ObjectModel` annotations | ❌ | ✅ | ✅ | ✅ | ✅ |
| `@AccessControl` / DCL | ❌ | ✅ | ✅ | ✅ | ✅ |
| `@Search` annotations | ❌ | ✅ | ✅ | ✅ | ✅ |
| CDS Parameters | ✅ | ✅ | ✅ | ✅ | ✅ |
| Table Functions | ✅ | ✅ | ✅ | ✅ | ❌ |
| Aggregation views | ✅ | ✅ | ✅ | ✅ | ✅ |
| CDS Hierarchy | ❌ (7.50+) | ✅ | ✅ | ✅ | ✅ |
| View Extensions | ✅ | ✅ | ✅ | ✅ | ⚠️ released only |
| Abstract Entities | ❌ (7.54+) | ✅ | ✅ | ✅ | ✅ |
| Custom Entities | ❌ (7.54+) | ✅ | ✅ | ✅ | ✅ |
| Virtual Elements | ❌ (7.50+) | ✅ | ✅ | ✅ | ✅ |
| Metadata Extensions (DDLX) | ❌ (7.50+) | ✅ | ✅ | ✅ | ✅ |
| CDS Test Doubles | ❌ | ❌ | ✅ (7.56+) | ✅ | ✅ |
| CDS Scalar Functions | ❌ | ❌ | ✅ (7.58) | ✅ | ✅ |
| CDS Simple/Enumerated Types | ❌ | ❌ | ✅ (7.58) | ✅ | ✅ |
| CDS Table Entities (persistence) | ❌ | ❌ | ❌ | ✅ (8.16) | ✅ |
| DCL on projection views | ❌ | ❌ | ✅ (7.58) | ✅ | ✅ |
| Join cardinality annotation | ❌ | ❌ | ✅ (7.58) | ✅ | ✅ |
| VDM (released I_ views) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Analytical CDS (Cube/Dimension) | ❌ | ✅ | ✅ | ✅ | ✅ |

> Source: https://www.absoft.co.uk/abap-cds-views-all-you-need-to-know/
> Source: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/630ce9b386b84e80bfade96779fbaeec.html

---

## 5. OData & Service Matrix

| Feature | ECC | S/4 On-Prem | S/4 2022+ | S/4 Cloud | BTP/Steampunk |
|---|---|---|---|---|---|
| OData V2 via SEGW | ✅ | ✅ | ✅ ⚠️legacy | ⚠️ legacy | ⚠️ legacy |
| OData V4 via RAP | ❌ | ✅ (1909+) | ✅ | ✅ | ✅ |
| Service Definition (SRVD) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Service Binding (SRVB) | ❌ | ✅ | ✅ | ✅ | ✅ |
| `@OData.publish: true` | ✅ (deprecated) | ⚠️ deprecated | ⚠️ deprecated | ❌ | ❌ |
| OData V4 Draft protocol | ❌ | ✅ | ✅ | ✅ | ✅ |
| OData V4 `$apply` aggregation | ❌ | ✅ | ✅ | ✅ | ✅ |
| OData V4 Delta links | ❌ | ✅ | ✅ | ✅ | ✅ |
| CSRF token (V2 required) | ✅ | ✅ | ✅ | ✅ | ✅ |
| /IWFND/MAINT_SERVICE | ✅ | ✅ | ✅ | ❌ cloud managed | ❌ |
| /IWFND/ERROR_LOG | ✅ | ✅ | ✅ | ❌ | ❌ |
| Local API service binding | ❌ | ✅ | ✅ | ✅ | ✅ |

### OData Version Decision Guide
```
ECC system          → V2 only (SEGW-based)
S/4 On-Prem < 2020  → V2 preferred, V4 experimental
S/4 On-Prem ≥ 2020  → V4 strongly recommended for new dev; V2 for legacy
S/4 Cloud Public    → V4 mandatory for new services
BTP / Steampunk     → V4 mandatory
CAP consuming SAP   → V2 or V4 depending on SAP source system
```

---

## 6. CAP Integration Matrix

How CAP connects to different SAP environments:

| Capability | ECC | S/4 On-Prem 2020+ | S/4 Cloud Public | BTP |
|---|---|---|---|---|
| CAP consume OData V2 | ✅ via dest | ✅ via dest | ✅ via dest | ✅ |
| CAP consume OData V4 | ❌ | ✅ via dest | ✅ via dest | ✅ |
| `cds import` EDMX V2 | ✅ | ✅ | ✅ | ✅ |
| `cds import` EDMX V4 | ❌ | ✅ | ✅ | ✅ |
| BTP Destination Service required | ✅ On-Prem | ✅ On-Prem | ✅ | — |
| Cloud Connector (SCC) required | ✅ | ✅ | ❌ | ❌ |
| XSUAA / IAS Auth | ✅ | ✅ | ✅ | ✅ |
| User propagation (principal prop.) | ✅ | ✅ | ✅ | ✅ |
| CSRF auto-handling (CAP config) | ✅ | ✅ | ✅ | ✅ |
| Local mock development | ✅ | ✅ | ✅ | ✅ |
| Hybrid mode (`cds bind`) | ✅ | ✅ | ✅ | ✅ |

### CAP Destination Config by Environment
```json
// ECC / S/4 On-Premise via Cloud Connector
"MY_ECC_SERVICE": {
  "kind": "odata-v2",
  "destination": "ECC_DEST",  // proxyType: OnPremise in BTP
  "csrf": true,
  "csrfInBatch": true
}

// S/4 Cloud Public (direct internet)
"MY_S4C_SERVICE": {
  "kind": "odata-v4",
  "destination": "S4C_DEST",  // proxyType: Internet in BTP
  "csrf": true
}

// Local dev mock (no real SAP system needed)
"MY_SERVICE": {
  "[development]": { "kind": "odata", "model": "srv/external/MY_SERVICE" },
  "[production]":  { "kind": "odata-v4", "destination": "S4_DEST" }
}
```
> Source: https://cap.cloud.sap/docs/guides/using-services#destinations

---

## 7. ABAP Version Mapping

Critical for knowing which syntax features are available:

| S/4HANA Release | ABAP Platform | SAP_BASIS | Key New Features |
|---|---|---|---|
| ECC 6.0 (EHP8) | ABAP 7.52 | 752 | Baseline |
| S/4HANA 1909 | ABAP 7.54 | 754 | RAP introduced, CTE, Window functions, inline declarations enhanced |
| S/4HANA 2020 | ABAP 7.54 SP | 754 | RAP improvements, CDS enhancements |
| S/4HANA 2021 | ABAP 7.56 | 756 | `strict(2)`, Augmentation, Precheck, EML Test Doubles |
| S/4HANA 2022 | ABAP 7.57 | 757 | Business Events, bgPF, RAP BAdI-like extensions |
| S/4HANA 2023 | ABAP 7.58 | 758 | CDS Scalar Functions, join cardinality, DCL on projection views, CDS simple types |
| S/4HANA 2025 | ABAP 8.16 | 816 | CDS Table Entities, collaborative draft, cross-BO, tree views, SAP Joule AI |
| S/4HANA Cloud Public | Always latest | Continuous | All features + AI, quarterly updates |
| BTP ABAP Env. | ABAP Cloud | Latest | Strictest cloud restrictions, released APIs only |

> Source: https://github.com/SAP-samples/abap-platform-refscen-flight (branches ABAP-platform-2023, ABAP-platform-2025)
> Source: https://github.com/SAP-samples/abap-cheat-sheets/blob/main/33_ABAP_Release_News.md

### Quick Version Check in System
```abap
" Check ABAP version programmatically
DATA(lv_version) = cl_abap_context_info=>get_release( ).
" Or check: T-code SYSTEM → System → Status → SAP_BASIS component version
```

---

## 8. Extensibility Model (A–D Rating)

SAP introduced the **A–D Rating Extensibility Model** in August 2025 to classify extensions by clean-core alignment:

| Rating | Type | Description | Upgrade Safety |
|---|---|---|---|
| **A** | Key User Extension | Low-code/no-code via Fiori apps (custom fields, logic, pages) | ✅ Fully safe |
| **B** | Developer Extension (Cloud) | ABAP Cloud, released APIs only, side-by-side on BTP | ✅ Safe |
| **C** | Developer Extension (Classic) | Classic ABAP on S/4, uses some unreleased APIs | ⚠️ Risk at upgrade |
| **D** | Modification | Modifying SAP standard objects directly | ❌ High risk |

**Target state**: All new development should be **A or B** for long-term upgrade safety.

> Source: https://avotechs.com/blog/new-features-sap-s4hana/
> Source: https://help.sap.com/docs/clean-core

### Compatibility Pack Warning
> ⚠️ **S/4HANA 2023 is the last release with compatibility packs** (ECC legacy code bridges).
> Compatibility packs expired: December 31, 2025 (most), December 31, 2030 (CS, LE-TRA, PP-PI exceptions only).
> Custom code using compatibility pack objects will break in S/4HANA 2025+.
> Source: https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/sap-s-4hana-compatibility-packs/ba-p/14064509

---

## 9. Migration Decision Guide

### If building NEW development today:

```
Target S/4 Cloud Public or BTP?
  → ABAP Cloud strict mode, released APIs only (Rating B)
  → RAP strict(2), OData V4, no AUTHORITY-CHECK

Target S/4 On-Prem 2025?
  → ABAP Cloud preferred (Rating B), classic allowed for migration
  → RAP with all 2025 features (collaborative draft, CDS Table Entities)
  → OData V4 via RAP for all new services

Target S/4 On-Prem 2022/2023?
  → RAP strict(2) (ABAP 7.57/7.58)
  → Business Events available (2022+)
  → OData V4 strongly preferred
  → CDS Scalar Functions available (2023+)

Target S/4 On-Prem 2020/2021?
  → RAP strict(1) only (no strict(2) until 7.56)
  → No business events, no precheck, no augmentation (check 2021 for these)
  → OData V4 available but verify service binding support

Still on ECC?
  → Classic ABAP, SEGW for OData V2
  → Plan migration to S/4HANA 2025 (direct upgrade path available)
  → Start building new dev using ABAP Cloud patterns to ease future migration
```

### CAP Workflow Decision by Source System:

```
SAP source is ECC?
  → cds import EDMX (V2 from SEGW)
  → Set csrf: true, csrfInBatch: true in CAP config
  → Use Cloud Connector + BTP Destination (proxyType: OnPremise)
  → No V4 features available from source

SAP source is S/4 On-Prem 2020+?
  → V2 (SEGW legacy) or V4 (RAP-based) — check what service is exposed
  → Cloud Connector required for On-Prem connectivity
  → V4 preferred for new SAP services (better $expand, $apply, draft support)

SAP source is S/4 Cloud Public?
  → V4 preferred, direct internet connection
  → No Cloud Connector needed
  → Use SAP API Business Hub to find pre-built APIs

Both V2 and V4 in same CAP project?
  → Separate cds.requires entries per service
  → V2: kind: "odata-v2", csrf: true
  → V4: kind: "odata-v4", csrf: true (V4 still needs CSRF for writes in SAP)
```

---

## Sources

| Topic | URL |
|---|---|
| S/4HANA 2025 ABAP Platform blog | https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/abap-platform-in-sap-s-4hana-cloud-private-edition-and-sap-s-4hana-2025/ba-p/14289979 |
| S/4HANA 2023 ABAP Platform blog | https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/abap-platform-for-sap-s-4hana-2023/ba-p/13573791 |
| S/4HANA New Features (2026 updated) | https://avotechs.com/blog/new-features-sap-s4hana/ |
| ABAP Release News cheat sheet | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/33_ABAP_Release_News.md |
| RAP Overview | https://help.sap.com/docs/abap-cloud/abap-rap/abap-restful-application-programming-model |
| Clean Core | https://help.sap.com/docs/clean-core |
| S/4HANA Compatibility Packs | https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/sap-s-4hana-compatibility-packs/ba-p/14064509 |
| S/4HANA What's New viewer | https://help.sap.com/whats-new/cf0cb2cb149647329b5d02aa96303f56 |
| ECC vs S/4HANA technical | https://blog.sap-press.com/sap-ecc-vs-sap-s4hana-technical-foundations |
| CAP destinations guide | https://cap.cloud.sap/docs/guides/using-services#destinations |
| CDS 7.58 new features | https://www.absoft.co.uk/abap-cds-views-all-you-need-to-know/ |