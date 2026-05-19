# SAP Developer Resources — Complete Reference Database

All official and community sources for SAP development.
Claude must cite from these sources in every technical response.
Last verified: 2025

---

## Table of Contents

- [SAP Developer Resources — Complete Reference Database](#sap-developer-resources--complete-reference-database)
  - [Table of Contents](#table-of-contents)
  - [1. Primary Official Documentation](#1-primary-official-documentation)
  - [2. ABAP \& RAP](#2-abap--rap)
    - [ABAP Language \& Syntax](#abap-language--syntax)
    - [RAP (RESTful ABAP Programming Model)](#rap-restful-abap-programming-model)
    - [ABAP Cloud \& Clean Core](#abap-cloud--clean-core)
    - [BAPI \& Function Modules](#bapi--function-modules)
  - [3. CDS \& Data Modeling](#3-cds--data-modeling)
  - [4. OData](#4-odata)
  - [5. CAP (Cloud Application Programming Model)](#5-cap-cloud-application-programming-model)
    - [Official CAP Documentation](#official-cap-documentation)
    - [CAP + SAP OData Integration (Your Workflow)](#cap--sap-odata-integration-your-workflow)
    - [CAP GitHub Samples](#cap-github-samples)
  - [6. SAP Fiori \& SAPUI5](#6-sap-fiori--sapui5)
  - [7. SAP BTP \& Cloud](#7-sap-btp--cloud)
  - [8. HANA \& SQLScript](#8-hana--sqlscript)
  - [9. SAP Integration Suite \& CPI](#9-sap-integration-suite--cpi)
  - [10. Lookup Databases — Tables, T-Codes, Fields](#10-lookup-databases--tables-t-codes-fields)
    - [Primary Lookup Sites](#primary-lookup-sites)
    - [Direct URL Patterns for Lookups](#direct-url-patterns-for-lookups)
    - [Common SAP Tables Quick Reference](#common-sap-tables-quick-reference)
    - [Common T-Code Quick Reference](#common-t-code-quick-reference)
  - [11. GitHub — Official SAP Samples](#11-github--official-sap-samples)
  - [12. Community \& Blogs](#12-community--blogs)
    - [Official SAP Community](#official-sap-community)
    - [High-Quality Third-Party Resources](#high-quality-third-party-resources)
  - [13. Release Notes \& What's New](#13-release-notes--whats-new)
  - [14. Tools \& IDEs](#14-tools--ides)

---

## 1. Primary Official Documentation

| Source | URL | Use For |
|---|---|---|
| SAP Help Portal | https://help.sap.com | Primary reference for all SAP products |
| SAP Developer Center | https://developers.sap.com | Tutorials, missions, hands-on guides |
| SAP Business Accelerator Hub | https://api.sap.com | Released APIs, OData metadata, BAPI specs |
| SAP Community | https://community.sap.com | Q&A, blog posts, real-world patterns |
| SAP Learning | https://learning.sap.com | Official courses, certifications |
| SAP GitHub Samples | https://github.com/SAP-samples | Official code samples for all topics |

**Citation rule**: Always prefer help.sap.com over community posts. Always prefer developers.sap.com tutorials over third-party blogs.

---

## 2. ABAP & RAP

### ABAP Language & Syntax

| Resource | URL |
|---|---|
| ABAP Keyword Documentation (latest) | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENABAP.html |
| ABAP Keyword Docs — Cloud Development | https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/ABENABAP.html |
| Clean ABAP Style Guide (GitHub) | https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md |
| ABAP Cheat Sheets (executable examples) | https://github.com/SAP-samples/abap-cheat-sheets |
| Released ABAP Classes reference | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/22_Released_ABAP_Classes.md |
| ABAP Release News (all versions) | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/33_ABAP_Release_News.md |
| ABAP for Cloud Development cheat sheet | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/19_ABAP_for_Cloud_Development.md |
| ABAP Community Hub | https://pages.community.sap.com/topics/abap |
| Discovering ABAP (knowledge portal) | https://discoveringabap.com |
| ABAP Academy | https://abapacademy.com |

### RAP (RESTful ABAP Programming Model)

| Resource | URL |
|---|---|
| RAP Overview | https://help.sap.com/docs/abap-cloud/abap-rap/abap-restful-application-programming-model |
| RAP Development Guide | https://help.sap.com/docs/abap-cloud/abap-rap/development-guide-for-rap |
| BDEF Syntax Reference | https://help.sap.com/docs/abap-cloud/abap-rap/behavior-definition |
| BDL Cheat Sheet (GitHub) | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/36_RAP_Behavior_Definition_Language.md |
| EML Cheat Sheet (GitHub) | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/08_EML_ABAP_for_RAP.md |
| RAP Behavior Implementation | https://help.sap.com/docs/abap-cloud/abap-rap/behavior-implementation-class |
| RAP Managed Scenario | https://help.sap.com/docs/abap-cloud/abap-rap/managed-scenario |
| RAP Unmanaged Scenario | https://help.sap.com/docs/abap-cloud/abap-rap/unmanaged-scenario |
| RAP Draft Handling | https://help.sap.com/docs/abap-cloud/abap-rap/draft-concept |
| RAP Actions | https://help.sap.com/docs/abap-cloud/abap-rap/actions |
| RAP Determinations | https://help.sap.com/docs/abap-cloud/abap-rap/determinations |
| RAP Validations | https://help.sap.com/docs/abap-cloud/abap-rap/validations |
| RAP Side Effects | https://help.sap.com/docs/abap-cloud/abap-rap/side-effects |
| RAP Business Events | https://help.sap.com/docs/abap-cloud/abap-rap/business-events |
| RAP Authorization | https://help.sap.com/docs/abap-cloud/abap-rap/authorization |
| EML (Entity Manipulation Language) | https://help.sap.com/docs/abap-cloud/abap-rap/entity-manipulation-language-eml |
| RAP FAQ | https://community.sap.com/t5/application-development-blog-posts/faq-abap-restful-application-programming-model-rap/ba-p/13411696 |
| RAP Workshops (GitHub samples) | https://github.com/SAP-samples/abap-platform-rap-workshops |
| SFlight RAP Reference Scenario | https://github.com/SAP-samples/abap-platform-refscen-flight |
| RAP Tutorial (Developer Center) | https://developers.sap.com/group.abap-env-restful-managed.html |

### ABAP Cloud & Clean Core

| Resource | URL |
|---|---|
| ABAP Cloud Overview | https://help.sap.com/docs/abap-cloud/abap-cloud/what-is-abap-cloud |
| Clean Core Overview | https://help.sap.com/docs/clean-core |
| ATC Cloud Readiness Check | https://help.sap.com/docs/abap-cloud/abap-rap/atc-check-for-cloud-readiness |
| ATC Cloudification Repository (GitHub) | https://github.com/SAP/abap-atc-cr-cv-s4hc |
| Released APIs for S/4HANA On-Prem | https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/29a8a6e18e844e41af9b45ebf2cfcdf4.html |
| ABAP Platform What's New | https://help.sap.com/whats-new/cf0cb2cb149647329b5d02aa96303f56 |

### BAPI & Function Modules

| Resource | URL |
|---|---|
| BAPI Explorer (SAP Accelerator Hub) | https://api.sap.com (search by business object) |
| BAPI reference (sapdatasheet) | https://www.sapdatasheet.org/abap/func/ |
| BAPI transaction in system | T-code: BAPI |

---

## 3. CDS & Data Modeling

| Resource | URL |
|---|---|
| CDS View Entity (ABAP Cloud) | https://help.sap.com/doc/abapdocu/latest/en-US/index.htm?file=abencds_v2_view.htm |
| CDS Annotations Overview (S/4 On-Prem) | https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/630ce9b386b84e80bfade96779fbaeec.html |
| @UI Annotations | https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/b3b02cf03c894498b1f01a303ec81e0e.html |
| @Search Annotations | https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/f38a7477f7b2421fad05002d5b98e5a3.html |
| @ObjectModel Annotations | https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/45f1db921be04abb89dad8ab9ca6c3de.html |
| @AccessControl / DCL | https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/4f826dad6c034ff0b7dfc82cc79ad5f9.html |
| VDM (Virtual Data Model) | https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/8a8cee943ef944fe8936f4a60d28e86e.html |
| ABAP Data Models Guide | https://help.sap.com/docs/abap-cloud/abap-rap/abap-data-models |
| CDS Cheat Sheet (GitHub) | https://github.com/SAP-samples/abap-cheat-sheets (search CDS files) |

---

## 4. OData

| Resource | URL |
|---|---|
| OData V4 — SAP ABAP | https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/sap-abap-for-odata |
| OData V4 Supported Features | https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/d8ef08c2dc0844ef97d06acf14a0d5be.html |
| Service Definition Syntax | https://help.sap.com/docs/abap-cloud/abap-rap/service-definition |
| Service Binding Types | https://help.sap.com/docs/abap-cloud/abap-rap/service-binding |
| OData V2 Adapter (ABAP) | https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/fc4c71aa50014fd1b43721701471913d/bc3db7428e4b4f01ade4ab35e63e7e64.html |
| OData.org Spec (V4) | https://www.odata.org/documentation/ |
| SEGW — SAP Gateway Service Builder | T-code: SEGW |
| /IWFND/ERROR_LOG — OData Error Log | T-code: /IWFND/ERROR_LOG |
| /IWFND/MAINT_SERVICE — Service Maintenance | T-code: /IWFND/MAINT_SERVICE |

---

## 5. CAP (Cloud Application Programming Model)

### Official CAP Documentation

| Resource | URL |
|---|---|
| CAP Documentation (capire) | https://cap.cloud.sap/docs/ |
| CAP Getting Started | https://cap.cloud.sap/docs/get-started/ |
| CAP Node.js Service SDK | https://cap.cloud.sap/docs/node.js/ |
| CAP Node.js — Remote Services | https://cap.cloud.sap/docs/guides/using-services |
| CAP Node.js — Error Handling | https://cap.cloud.sap/docs/node.js/core-services#error-handling |
| CAP CDS Language Reference | https://cap.cloud.sap/docs/cds/ |
| CAP CDS Annotations | https://cap.cloud.sap/docs/cds/annotations |
| CAP Security (XSUAA, IAS) | https://cap.cloud.sap/docs/guides/security/ |
| CAP Hybrid Testing | https://cap.cloud.sap/docs/advanced/hybrid-testing |
| CAP MTA Deployment | https://cap.cloud.sap/docs/guides/deployment/to-cf |
| CAP What's New | https://cap.cloud.sap/docs/releases/ |

### CAP + SAP OData Integration (Your Workflow)

| Resource | URL |
|---|---|
| Consuming SAP S/4HANA Services in CAP | https://cap.cloud.sap/docs/guides/using-services#external-service-api |
| Importing OData V2/V4 (cds import) | https://cap.cloud.sap/docs/guides/using-services#cds-import |
| BTP Destination Service with CAP | https://cap.cloud.sap/docs/guides/using-services#destinations |
| Hybrid Mode (local + remote) | https://cap.cloud.sap/docs/advanced/hybrid-testing |
| CAP Fiori Elements annotations | https://cap.cloud.sap/docs/advanced/fiori |
| req.error / req.reject patterns | https://cap.cloud.sap/docs/node.js/core-services#req-error |

### CAP GitHub Samples

| Resource | URL |
|---|---|
| CAP Official GitHub org | https://github.com/cap-js |
| SFlight — CAP + Fiori Elements sample | https://github.com/SAP-samples/cap-sflight |
| CAP BTP Developer's Guide | https://github.com/SAP-samples/btp-developer-guide-cap |
| CAP Local Dev Workshop (2025) | https://github.com/SAP-samples/cap-local-development-workshop |
| CAP + SAPUI5 TypeScript fullstack | https://github.com/SAP-samples/cloud-cap-fullstack-ts |
| CAP Node.js JS Basics | https://github.com/SAP-samples/cloud-cap-with-javascript-basics |
| CAP Audit Logging plugin | https://github.com/cap-js/audit-logging |
| CAP Notifications plugin | https://github.com/cap-js/notifications |
| CAP Event Broker plugin | https://github.com/cap-js/event-broker |

---

## 6. SAP Fiori & SAPUI5

| Resource | URL |
|---|---|
| Fiori Design Guidelines | https://experience.sap.com/fiori-design-web/ |
| SAPUI5 SDK & API Reference | https://ui5.sap.com |
| SAPUI5 API Reference | https://ui5.sap.com/#/api |
| Fiori Elements Documentation | https://help.sap.com/docs/SAP_FIORI_tools |
| Fiori Tools (BAS/VSCode extension) | https://help.sap.com/docs/SAP_FIORI_tools |
| Fiori Launchpad | https://help.sap.com/docs/SAP_FIORI_LAUNCHPAD |
| Fiori Apps Reference Library | https://fioriappslibrary.hana.ondemand.com/sap/fix/externalViewer/ |
| Fiori Apps Library (FLP URL lookup) | https://pr.alm.me.sap.com/launchpad#FALApp-display&/apps |
| openSAP — Fiori Elements course | https://open.sap.com/courses/fiori-elements |
| Fiori Tools Samples (GitHub) | https://github.com/SAP-samples/fiori-tools-samples |

---

## 7. SAP BTP & Cloud

| Resource | URL |
|---|---|
| BTP Documentation Hub | https://help.sap.com/docs/btp |
| BTP ABAP Environment | https://help.sap.com/docs/sap-btp-abap-environment |
| BTP Developer Guide | https://help.sap.com/docs/btp/btp-developer-s-guide/btp-developer-s-guide |
| BTP Connectivity Service | https://help.sap.com/docs/connectivity |
| BTP Destination Service | https://help.sap.com/docs/destination-service |
| XSUAA / Authorization | https://help.sap.com/docs/cp-uaa-reuse-service |
| BTP Cockpit | https://cockpit.btp.cloud.sap |
| BTP Trial | https://developers.sap.com/tutorials/hcp-create-trial-account.html |
| Cloud Foundry on BTP | https://help.sap.com/docs/btp/sap-business-technology-platform/cloud-foundry-environment |
| MTA Archive Builder | https://help.sap.com/docs/btp/sap-business-technology-platform/multitarget-application-mta |
| BTP Samples (GitHub) | https://github.com/SAP-samples/btp-developer-guide-cap |

---

## 8. HANA & SQLScript

| Resource | URL |
|---|---|
| HANA Cloud Documentation | https://help.sap.com/docs/hana-cloud |
| SQLScript Reference | https://help.sap.com/docs/SAP_HANA_PLATFORM/de2486ee947e43e684d39702027f8a94/28f2d64d4fab4e789ee0070be418aa5b.html |
| AMDP (ABAP Managed DB Procedures) | https://help.sap.com/doc/abapdocu/latest/en-US/index.htm?file=abenamdp.htm |
| AMDP Cheat Sheet (GitHub) | https://github.com/SAP-samples/abap-cheat-sheets (AMDP file) |
| HANA Cloud — What's New | https://help.sap.com/whats-new/0e0c8a4e95f2449a9558cab32b2a5527 |
| HDI (HANA Deployment Infrastructure) | https://help.sap.com/docs/SAP_HANA_PLATFORM/3823b0f33420468ba5f1cf7f59bd6bd9/3ef0ee9da11440e4b01708455b8497a9.html |
| HANA Academy (YouTube) | https://www.youtube.com/@SAPHANAacademy |

---

## 9. SAP Integration Suite & CPI

| Resource | URL |
|---|---|
| Integration Suite Documentation | https://help.sap.com/docs/integration-suite |
| Cloud Integration (CPI) Overview | https://help.sap.com/docs/cloud-integration |
| iFlow Development Guide | https://help.sap.com/docs/cloud-integration/sap-cloud-integration/development |
| Groovy Script API Reference | https://help.sap.com/docs/cloud-integration/sap-cloud-integration/sdk-api |
| Adapter Guide | https://help.sap.com/docs/cloud-integration/sap-cloud-integration/connectivity-options |
| API Management | https://help.sap.com/docs/sap-api-management |
| Integration Suite What's New | https://help.sap.com/whats-new/cf0cb2cb149647329b5d02aa96303f56?product=integration-suite |
| Integration Suite Community | https://community.sap.com/t5/technology-blog-posts-by-sap/bg-p/technology-blog-sap/label-name/integration%20suite |
| Integration Suite samples (GitHub) | https://github.com/SAP-samples?q=integration-suite |

---

## 10. Lookup Databases — Tables, T-Codes, Fields

These are the fastest way to verify SAP object metadata. Always include these links when answering lookup questions.

### Primary Lookup Sites

| Site | URL | Best For |
|---|---|---|
| **SAP Datasheet** | https://www.sapdatasheet.org | Tables, fields, data elements, FMs, classes |
| **SAP T-Codes** | https://www.sap-tcodes.org | Transaction codes lookup |
| **SAP Tables** | https://www.sap-tables.org | Table structures, fields |
| **SAP Codes** | https://sapcodes.com | Code patterns and examples |
| **Laurix SAP Blog** | https://www.laurix.com/post | Practical SAP tips & tricks |
| **SAP ABAP Programming Blog** | https://sapabap-programming.blogspot.com | ABAP coding examples |
| **School of SAP** | https://schoolofsap.blogspot.com | SAP learning resources |

### Direct URL Patterns for Lookups

```
Tables:
  https://www.sapdatasheet.org/abap/tabl/[TABLE].html
  Example: https://www.sapdatasheet.org/abap/tabl/mara.html

Data Elements:
  https://www.sapdatasheet.org/abap/dtel/[ELEMENT].html
  Example: https://www.sapdatasheet.org/abap/dtel/matnr.html

Domains:
  https://www.sapdatasheet.org/abap/doma/[DOMAIN].html

Function Modules:
  https://www.sapdatasheet.org/abap/func/[FM_NAME].html
  Example: https://www.sapdatasheet.org/abap/func/bapi_salesorder_createfromdat2.html

ABAP Classes:
  https://www.sapdatasheet.org/abap/clas/[CLASS].html

T-Codes:
  https://www.sap-tcodes.org/tcode/[TCODE]
  Example: https://www.sap-tcodes.org/tcode/se80

SAP Tables (alternative):
  https://www.sap-tables.org/tables/[TABLE]
  Example: https://www.sap-tables.org/tables/mara
```

### Common SAP Tables Quick Reference

| Area | Key Tables |
|---|---|
| Materials | MARA, MARC, MARD, MAKT, MBEW |
| Sales | VBAK, VBAP, VBFA, VBKD |
| Purchasing | EKKO, EKPO, EKET, EKES |
| Finance | BKPF, BSEG, SKA1, SKB1 |
| HR | PA0001, PA0002, T001P |
| Plant Maintenance | EQUI, IFLOT, AUFK |
| Production | AFKO, AFPO, RESB |
| Transport | E070, E071, TRSTATUS |
| DDIC metadata | DD02L, DD03L, DD04T |
| Authorization | AGR_USERS, USR02, USOBT_C |

### Common T-Code Quick Reference

| Area | T-Codes |
|---|---|
| ABAP Development | SE80, SE24, SE11, SE38, SE37 |
| CDS / Eclipse | ADT (Eclipse plugin) |
| OData | SEGW, /IWFND/MAINT_SERVICE, /IWFND/ERROR_LOG |
| Fiori Launchpad | /UI2/FLP, /UI2/FLPD_CONF |
| Transport | STMS, SE01, SE09, SE10 |
| Performance | ST05, SM50, SM66, SAT |
| Debugging | SAAB (breakpoints), SM21 (syslog) |
| Authorization | SU01, SU21, SU24, PFCG |
| HANA Studio | DBACOCKPIT, SE16H |
| BTP Connectivity | SM59 (RFC destinations) |

---

## 11. GitHub — Official SAP Samples

| Repository | URL | Content |
|---|---|---|
| SAP Samples org | https://github.com/SAP-samples | All official SAP sample code |
| ABAP Cheat Sheets ⭐ | https://github.com/SAP-samples/abap-cheat-sheets | ABAP, RAP, CDS, EML examples |
| RAP Workshops | https://github.com/SAP-samples/abap-platform-rap-workshops | End-to-end RAP tutorials |
| SFlight (RAP reference) | https://github.com/SAP-samples/abap-platform-refscen-flight | RAP reference scenario |
| CAP SFlight | https://github.com/SAP-samples/cap-sflight | CAP + Fiori Elements |
| BTP Developer Guide CAP | https://github.com/SAP-samples/btp-developer-guide-cap | CAP best practices on BTP |
| Clean ABAP Style Guide | https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md | ABAP code style |
| ATC Cloudification | https://github.com/SAP/abap-atc-cr-cv-s4hc | Cloud readiness ATC config |
| cap-js plugins | https://github.com/cap-js | Official CAP Node.js plugins |
| Fiori Tools Samples | https://github.com/SAP-samples/fiori-tools-samples | Fiori Elements apps |
| ABAP Platform Fusion | https://github.com/SAP-samples/abap-platform-fusion-development-sap-cloud-erp-sap-btp | ABAP + BTP fusion |

---

## 12. Community & Blogs

### Official SAP Community

| Resource | URL |
|---|---|
| ABAP Development Community | https://pages.community.sap.com/topics/abap |
| ABAP Blog Posts | https://community.sap.com/t5/abap-blog-posts/bg-p/abapblog-board |
| App Dev & Automation Blogs | https://community.sap.com/t5/application-development-and-automation-blog-posts/bg-p/application-developmentblog-board |
| CAP Community | https://community.sap.com/t5/technology-blogs-by-sap/bg-p/technology-blog-sap/label-name/CAP |
| Integration Suite Community | https://community.sap.com/t5/technology-blog-posts-by-sap/bg-p/technology-blog-sap/label-name/integration%20suite |
| SAP Q&A | https://community.sap.com/t5/forums/ct-p/forums |

### High-Quality Third-Party Resources

| Resource | URL | Best For |
|---|---|---|
| Discovering ABAP | https://discoveringabap.com | ABAP Cloud, RAP, CDS, OData tutorials |
| ABAP Academy | https://abapacademy.com | ABAP best practices |
| Laurix SAP Blog | https://www.laurix.com/post | Practical tips |
| SAP ABAP Programming Blog | https://sapabap-programming.blogspot.com | Code examples |
| School of SAP | https://schoolofsap.blogspot.com | Learning materials |
| SAP Codes | https://sapcodes.com | Code patterns |

---

## 13. Release Notes & What's New

| Resource | URL |
|---|---|
| S/4HANA On-Premise What's New | https://help.sap.com/whats-new/cf0cb2cb149647329b5d02aa96303f56 |
| S/4HANA Cloud What's New | https://help.sap.com/whats-new/5006a24e60044b2999c41dc6b9e06b22 |
| ABAP Platform Release News | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/33_ABAP_Release_News.md |
| ABAP Platform PAM | https://support.sap.com/en/release-upgrade-maintenance.html |
| CAP What's New | https://cap.cloud.sap/docs/releases/ |
| BTP What's New | https://help.sap.com/whats-new/cf0cb2cb149647329b5d02aa96303f56?product=73554900100800003832 |
| Integration Suite What's New | https://help.sap.com/whats-new/cf0cb2cb149647329b5d02aa96303f56?product=integration-suite |
| HANA Cloud What's New | https://help.sap.com/whats-new/0e0c8a4e95f2449a9558cab32b2a5527 |
| SAP Support Notes | https://launchpad.support.sap.com (requires login) |

---

## 14. Tools & IDEs

| Tool | URL | Purpose |
|---|---|---|
| ADT (ABAP Dev Tools for Eclipse) | https://tools.hana.ondemand.com/#abap | Primary IDE for ABAP/RAP/CDS |
| SAP Business Application Studio | https://help.sap.com/docs/bas | Cloud IDE for CAP, Fiori, BTP |
| VS Code + CDS extension | https://cap.cloud.sap/docs/get-started/tools | CAP development in VS Code |
| abapGit | https://abapgit.org | Git for ABAP |
| abaplint | https://github.com/abaplint/abaplint | ABAP static analysis |
| SAP Fiori Tools (VS Code ext) | https://marketplace.visualstudio.com/items?itemName=SAPSE.sap-ux-fiori-tools-extension-pack | Fiori app generator |
| CF CLI | https://docs.cloudfoundry.org/cf-cli | Deploy to BTP CF |
| MTA Build Tool | https://help.sap.com/docs/btp/sap-business-technology-platform/multitarget-application-mta | Build MTA archives |
| HANA Database Explorer | https://help.sap.com/docs/hana-cloud/sap-hana-cloud-sap-hana-database-developer-guide-for-cloud-foundry-multitarget-applications/sap-hana-database-explorer | Browse HANA schema |