# RAP — Environment & Release Differences

Which RAP features exist in which environment (ECC / S/4HANA On-Premise 2019→2025 /
S/4HANA Cloud Public / BTP), and how BDEF syntax and behavior implementation change across
releases. **The core matrix in this file is verified empirically**: by comparing the same
business object across the release-specific branches of the ABAP Flight Reference Scenario
(SAP-samples), whose branches are officially labeled with their AS ABAP version.

> **Read this file when:** the question is about "which release supports X", `strict(2)`
> availability, RAP on S/4HANA 2020/2021/2022/2023/2025, ABAP 7.54–8.16, ECC vs S/4 vs
> Cloud differences, when business events / precheck / augmentation / late numbering / draft
> became available, ABAP Cloud restrictions, released-API requirements, or porting a RAP BO
> between on-premise and cloud.

---

## Table of Contents

1. [Overview & how this file was verified](#1-overview--how-this-file-was-verified)
2. [The verified feature-by-release matrix](#2-the-verified-feature-by-release-matrix)
3. [RAP availability & `strict` modes](#3-rap-availability--strict-modes)
4. [Draft & numbering](#4-draft--numbering)
5. [BAPI / unmanaged-save patterns](#5-bapi--unmanaged-save-patterns)
6. [Authorization & precheck](#6-authorization--precheck)
7. [Business events](#7-business-events)
8. [Augmentation](#8-augmentation)
9. [S/4HANA 2025 (ABAP 8.16) additions](#9-s4hana-2025-abap-816-additions)
10. [Cloud vs On-Premise — ABAP Cloud restrictions](#10-cloud-vs-on-premise--abap-cloud-restrictions)
11. ["Which release am I on?" & Anti-Patterns](#11-which-release-am-i-on--anti-patterns)
12. [What is NOT verified in this session](#12-what-is-not-verified-in-this-session)
13. [Sources](#13-sources)

---

## 1. Overview & how this file was verified

**ECC has no RAP.** RAP, BDEF, EML, behavior pools, CDS behavior — none of it exists on
ECC. On ECC you use classic ABAP, BOPF (classic business objects), SEGW-based OData V2, and
PFCG/`AUTHORITY-CHECK`. Everything else in this file concerns S/4HANA On-Premise and Cloud.

The Flight Reference Scenario publishes one branch per AS ABAP release. The branch↔version
mapping below is taken directly from the repository's own README (verified primary source):

| Branch | AS ABAP | S/4HANA On-Premise |
|---|---|---|
| `ABAP-platform-2019` | 7.54 | 1909 |
| `ABAP-platform-2020` | 7.55 | 2020 |
| `ABAP-platform-2021` | 7.56 | 2021 |
| `ABAP-platform-2022` | 7.57 | 2022 |
| `ABAP-platform-2023` | 7.58 | 2023 |
| `ABAP-platform-2025` | 8.16 | 2025 |
| `ABAP-platform-cloud` | — | S/4HANA Cloud Public / BTP ABAP Environment |

**Methodology & its limits.** The matrix in Section 2 records the *first branch in which a
feature actually appears in the reference-scenario source*. That is strong evidence that
the feature is usable at that release. The one caveat: a feature *appearing* in branch N
proves availability at N, but *absence* in branch N‑1 is suggestive, not absolute proof —
SAP may simply not have added the demo earlier. Where a feature is clearly present at N and
absent at N‑1, the file states the boundary; otherwise it says "appears from branch N".

---

## 2. The verified feature-by-release matrix

`✅` = the feature appears in that release's reference-scenario branch (verified by source
inspection). `—` = not present in that branch. Columns are AS ABAP versions.

| RAP feature | 7.54 (2019) | 7.55 (2020) | 7.56 (2021) | 7.57 (2022) | 7.58 (2023) | 8.16 (2025) | Cloud |
|---|---|---|---|---|---|---|---|
| RAP / behavior definition | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `with draft` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `with unmanaged save` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `with additional save` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `determine action` (incl. draft `Prepare`) | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Authorization (`get_*_authorizations`) | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `AUTHORITY-CHECK OBJECT` in behavior pool | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Augmentation (`augment`) | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `precheck` | — | — | — | ✅ | ✅ | ✅ | ✅ |
| Business events (`event` / `RAISE ENTITY EVENT`) | — | — | — | ✅ | ✅ | ✅ | ✅ |
| Late numbering | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `strict ( 2 )` | — | — | — | — | ✅ | ✅ | ✅ |
| Collaborative draft | — | — | — | — | — | ✅ | ✅ |
| `with privileged mode` (BDEF clause) | — | — | — | — | — | ✅ | ✅ |

Source: comparison of the `ABAP-platform-2019 … 2025` and `ABAP-platform-cloud` branches of
SAP-samples/abap-platform-refscen-flight (source inspection). Branch↔version mapping from
that repo's README.

**Reading the matrix at a glance:**

- Everything RAP starts at **7.55 (S/4HANA 2020)** — 7.54/1909 has no RAP in this scenario.
- **Authorization + augmentation** land at **7.56 (2021)**.
- **precheck + business events + late numbering** land at **7.57 (2022)**.
- **`strict ( 2 )`** appears at **7.58 (2023)**.
- **Collaborative draft** and the **`with privileged mode`** BDEF clause appear at **8.16 (2025)**.
- The **Cloud** branch has the full modern feature set — treat it as "latest".

---

## 3. RAP availability & `strict` modes

RAP first appears in the 7.55 (2020) branch. `strict` mode controls how strictly the RAP
framework enforces modern rules; the reference scenario only shows `strict ( 2 )`, appearing
from the 7.58 (2023) branch:

```abap
" Modern greenfield (7.58 / 2023+ and Cloud): always use strict(2)
managed implementation in class zbp_r_travel unique;
strict ( 2 );                       " ✅ appears from 7.58 (2023) branch onward
with draft;
```

Guidance by environment:

```
ECC                     → no RAP at all
S/4 On-Prem 7.55–7.57   → RAP available; strict(2) not seen in scenario until 7.58
S/4 On-Prem 7.58 (2023) → use strict ( 2 ) for new development
S/4 On-Prem 8.16 (2025) → strict ( 2 ) + collaborative draft
Cloud Public / BTP      → strict ( 2 ) is the norm
```

⚠️ The reference scenario never uses `strict ( 1 )` or `strict ( 0 )` — no `strict(1)`
appears in any branch. `strict(2)` is the current recommended level; `strict(1)` exists as
an older/intermediate level but is not demonstrated here, so its exact release boundary is
not verified in this session.

```abap
" ❌ WRONG — omitting strict on a modern system defaults to the least strict behavior
managed implementation in class zbp_r_travel unique;

" ✅ CORRECT — on 7.58 (2023)+ / Cloud
managed implementation in class zbp_r_travel unique;
strict ( 2 );
```

---

## 4. Draft & numbering

**Draft** (`with draft`) appears from **7.55 (2020)** and is present in every later branch:

```abap
managed implementation in class zbp_r_travel unique;
with draft;                         " ✅ from 7.55 (2020) branch onward
```

**Numbering.** Early numbering (keys assigned during the interaction phase) is present from
the earliest RAP branch (7.55). **Late numbering** (keys assigned only in the save sequence)
first appears in the **7.57 (2022)** branch:

```
Early numbering  → available with RAP from 7.55 (2020)
Late numbering   → appears from 7.57 (2022)
```

⚠️ Late numbering has a known incompatibility with draft — see `draft-handling.md`. Because
late numbering appears only from 7.57 in the scenario, on 7.55/7.56 systems prefer early
numbering.

```abap
" Early numbering (7.55+): key assigned in a determination during interaction phase
early numbering;

" Late numbering (appears 7.57 / 2022+): key assigned in the save sequence
late numbering;
```

---

## 5. BAPI / unmanaged-save patterns

Both save-delegation patterns appear from the **7.55 (2020)** branch:

```abap
" Wrapping existing BAPI/FM persistence — appears from 7.55 (2020)
managed with unmanaged save
  implementation in class zbp_r_travel unique;

" Extra side-effects alongside managed persistence — appears from 7.55 (2020)
managed with additional save
  implementation in class zbp_r_travel unique;
```

For the decision between these and for full phase rules, see `bapi-wrapper.md` and
`unmanaged.md`. The point here is only availability: both have been usable since RAP's first
release in the scenario (7.55 / 2020), so environment is rarely the blocker for BAPI
wrapping — the phase rules are.

```abap
" ❌ WRONG — assuming you need a very new release to wrap a BAPI
" ✅ CORRECT — managed with unmanaged save works from 7.55 (2020) onward
```

---

## 6. Authorization & precheck

**Authorization** (`get_global_authorizations` / `get_instance_authorizations`, and
`AUTHORITY-CHECK OBJECT` inside the behavior pool) first appears in the **7.56 (2021)**
branch — the 7.55 (2020) branch only carries a commented-out authorization declaration.

**Precheck** (`create ( precheck )` / `update ( precheck )`) first appears in the **7.57
(2022)** branch.

```
get_*_authorizations + AUTHORITY-CHECK in behavior → appears from 7.56 (2021)
precheck                                            → appears from 7.57 (2022)
```

⚠️ **`AUTHORITY-CHECK OBJECT` is valid in ABAP Cloud.** The Cloud branch (and 7.56+ branches)
use `AUTHORITY-CHECK OBJECT` directly inside `get_*_authorizations`. What ABAP Cloud
forbids is classic transaction-based authorization mechanics, not the `AUTHORITY-CHECK
OBJECT` statement itself. See `authorization.md` for the full patterns.

```abap
" Available from 7.56 (2021) and Cloud — inside a behavior-pool helper
AUTHORITY-CHECK OBJECT 'ZTRVL' ID 'ZCNTRY' FIELD lv_country ID 'ACTVT' FIELD '02'.

" ❌ WRONG — writing precheck on a 7.55/7.56 system
update ( precheck );    " precheck not seen before 7.57 (2022)

" ✅ CORRECT on 7.55/7.56 — enforce in get_instance_authorizations instead
```

---

## 7. Business events

RAP business events — the BDEF `event` declaration and the `RAISE ENTITY EVENT` statement —
first appear in the **7.57 (2022)** branch:

```abap
" BDEF (appears from 7.57 / 2022):
define behavior for Z_R_Travel alias Travel
{
  event travelCreated;
}

" Behavior pool (save sequence): RAISE ENTITY EVENT — appears from 7.57 (2022)
RAISE ENTITY EVENT Z_R_Travel~travelCreated
  FROM VALUE #( ( %key = ... ) ).
```
Source: business-event usage appears only from the 7.57 (2022) branch onward in the
reference scenario. See `business-events.md` for the full event + Event Mesh flow.

```
Business events → appears from 7.57 (2022); available in Cloud
ECC / 7.54–7.56 → not available
```

---

## 8. Augmentation

Augmentation (`augment`, used to enrich standard BO behavior in extension scenarios) first
appears in the **7.56 (2021)** branch:

```
Augmentation (augment) → appears from 7.56 (2021); available in Cloud
```

Augmentation is part of the same 7.56 (2021) wave as authorization. On 7.55 (2020) it is not
present in the scenario. For extending standard SAP RAP BOs, see `standard-bo-extension.md`.

---

## 9. S/4HANA 2025 (ABAP 8.16) additions

Two features appear for the first time in the **8.16 (2025)** branch (and Cloud), not in any
earlier on-premise branch:

- **Collaborative draft** — multiple users editing the same draft. The `collaborative`
  keyword appears from the 8.16 (2025) branch.
- **`with privileged mode`** BDEF clause — appears from the 8.16 (2025) branch.

```
Collaborative draft        → appears from 8.16 (2025); Cloud
with privileged mode clause → appears from 8.16 (2025); Cloud
```

⚠️ Other frequently-cited "2025 / 8.16" features (for example CDS table entities used as RAP
persistence) are **not present in this reference scenario**, so this file does not assert
their release boundary — confirm those in ADT / release notes. Do not read the absence of
`collaborative`/`with privileged mode` in 7.58 as anything other than: they appear from 8.16
in this scenario.

---

## 10. Cloud vs On-Premise — ABAP Cloud restrictions

The `ABAP-platform-cloud` branch carries the full modern feature set (`strict ( 2 )`, draft,
authorization, precheck, events, augmentation, collaborative draft, `with privileged mode`).
The practical difference between Cloud and On-Premise is **not** which RAP features exist —
it is what surrounding ABAP is allowed:

| Aspect | S/4 On-Premise | S/4 Cloud Public / BTP |
|---|---|---|
| Classic ABAP (e.g. `SELECT *`, classic DB access) | allowed (discouraged) | not allowed — ABAP Cloud language scope only |
| Released APIs (C1) | recommended | mandatory — only released objects usable |
| Direct DB-table access | allowed | must go through released CDS |
| `AUTHORITY-CHECK OBJECT` | ✅ | ✅ (released; used in Cloud reference scenario) |
| RAP feature set | tied to release (Section 2) | latest (equivalent to newest branch) |

The single biggest porting concern moving a RAP BO from On-Premise to Cloud is therefore the
**released-API / Clean Core constraint**, not the RAP feature availability — the BDEF and
behavior pool patterns are the same. See the SKILL-level environment matrix and (when
created) the ABAP Core `cloud-restrictions.md` for the full forbidden-statement list.

```abap
" ❌ WRONG in Cloud — unreleased DB table + classic SELECT
SELECT * FROM ztable INTO TABLE @DATA(lt).

" ✅ CORRECT in Cloud — released CDS + field list + @DATA
SELECT field_a, field_b FROM z_c_released_view INTO TABLE @DATA(lt).
```

---

## 11. "Which release am I on?" & Anti-Patterns

Quick way to reason about the target system:

```
Is it ECC?                → no RAP; stop, use classic ABAP / BOPF / SEGW.
Is it S/4 Cloud Public / BTP? → assume latest RAP; ABAP Cloud restrictions apply.
Is it S/4 On-Premise?     → the release (2020/2021/2022/2023/2025) gates features:
   2020 (7.55): RAP, draft, unmanaged/additional save, determine action
   2021 (7.56): + authorization, AUTHORITY-CHECK in behavior, augmentation
   2022 (7.57): + precheck, business events, late numbering
   2023 (7.58): + strict ( 2 )
   2025 (8.16): + collaborative draft, with privileged mode
```

Confirm the exact release in ADT (system info) or with your Basis team before relying on a
boundary feature.

**Anti-Patterns**

**1. Assuming RAP on ECC**

```abap
" ❌ WRONG — there is no RAP, BDEF, or EML on ECC
define behavior for Z_R_Travel ...

" ✅ CORRECT — ECC uses classic ABAP / BOPF; RAP starts at S/4 7.55 (2020)
```

**2. Using `strict ( 2 )` on a pre-7.58 system**

```abap
" ❌ WRONG on 7.55–7.57 — strict(2) appears from 7.58 (2023) in the scenario
strict ( 2 );

" ✅ CORRECT — match strict level to the release; verify in ADT
```

**3. Writing `precheck` / business events before 7.57 (2022)**

```abap
" ❌ WRONG on 7.55/7.56
update ( precheck );
RAISE ENTITY EVENT Z_R_Travel~created FROM ... .

" ✅ CORRECT — these appear from 7.57 (2022); on earlier releases use
"   get_instance_authorizations / determinations instead
```

**4. Assuming `AUTHORITY-CHECK OBJECT` is banned in Cloud**

```abap
" ❌ WRONG assumption — it is used in the Cloud reference scenario
" ✅ CORRECT — AUTHORITY-CHECK OBJECT is valid in ABAP Cloud (see authorization.md)
```

**5. Porting On-Prem RAP to Cloud without fixing classic ABAP**

```abap
" ❌ WRONG — the BDEF ports fine but the behavior pool uses SELECT * / unreleased tables
" ✅ CORRECT — replace with released CDS + field lists before moving to Cloud
```

**6. Treating "absent in an older branch" as proof of unavailability**

```
❌ WRONG — "feature X isn't in the 2021 branch, therefore it's impossible on 7.56"
✅ CORRECT — absence is suggestive; confirm the true boundary in ADT / release notes
```

---

## 12. What is NOT verified in this session

Being explicit about the limits of the evidence:

- **Exact SAP Note / SP-level boundaries** within a release are not verified — the matrix is
  at AS ABAP release granularity only.
- **`strict ( 1 )`** release boundary — not demonstrated in any branch, so not asserted.
- **CDS table entity as RAP persistence** — not present in the reference scenario; release
  boundary not asserted here.
- Any claim requiring **help.sap.com / release notes** — those pages were **not reachable
  from this session** (network reaches GitHub only). Where this file gives a release
  boundary, it is grounded in branch source inspection, not in the official release notes.

Always confirm a boundary feature in ADT (system status) or the official SAP release notes
before committing production code to it.

---

## 13. Sources

### Verified live in this session (fetched directly from GitHub)

The matrix and every boundary in this file come from comparing these branches:

| Source | URL | Content |
|---|---|---|
| Flight Ref Scenario — README (branch↔version map) | https://github.com/SAP-samples/abap-platform-refscen-flight | Official mapping: branch 2019→7.54 … 2025→8.16, cloud |
| Flight Ref Scenario — branch 2019 (7.54) | https://github.com/SAP-samples/abap-platform-refscen-flight/tree/ABAP-platform-2019 | Baseline: no RAP behavior |
| Flight Ref Scenario — branch 2020 (7.55) | https://github.com/SAP-samples/abap-platform-refscen-flight/tree/ABAP-platform-2020 | RAP, draft, unmanaged/additional save, determine action |
| Flight Ref Scenario — branch 2021 (7.56) | https://github.com/SAP-samples/abap-platform-refscen-flight/tree/ABAP-platform-2021 | + authorization, AUTHORITY-CHECK in behavior, augmentation |
| Flight Ref Scenario — branch 2022 (7.57) | https://github.com/SAP-samples/abap-platform-refscen-flight/tree/ABAP-platform-2022 | + precheck, business events, late numbering |
| Flight Ref Scenario — branch 2023 (7.58) | https://github.com/SAP-samples/abap-platform-refscen-flight/tree/ABAP-platform-2023 | + strict ( 2 ) |
| Flight Ref Scenario — branch 2025 (8.16) | https://github.com/SAP-samples/abap-platform-refscen-flight/tree/ABAP-platform-2025 | + collaborative draft, with privileged mode |
| Flight Ref Scenario — branch cloud | https://github.com/SAP-samples/abap-platform-refscen-flight/tree/ABAP-platform-cloud | Full modern feature set (Cloud Public / BTP) |

### Official references — not fetched in this session

⚠️ Not reachable from this session's environment (GitHub only). Open and confirm before
treating as authoritative, especially for exact release/SP boundaries.

| Source (not verified this session) | URL |
|---|---|
| SAP Help — Downloading the ABAP Flight Reference Scenario | https://help.sap.com/docs/abap-cloud/abap-rap/downloading-abap-flight-reference-scenario |
| SAP Help — RAP feature availability / What's New | https://help.sap.com/whats-new |
| SAP Help — ABAP Keyword Documentation (latest) | https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/index.htm |
| SAP Help — RAP overview | https://help.sap.com/docs/abap-cloud/abap-rap/abap-restful-application-programming-model |
| ABAP Cheat Sheets — ABAP Release News | https://github.com/SAP-samples/abap-cheat-sheets/blob/main/33_ABAP_Release_News.md |