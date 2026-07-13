# ABAP Core — BAdIs & the Enhancement Framework

Business Add-Ins (BAdIs) are the object-oriented way to enhance standard SAP or
custom functionality **without modifying the underlying source code**. This file
covers the modern **kernel-based BAdI** concept end to end (define, implement,
consume — statically and dynamically), the environment rules that decide which
enhancement technique is even allowed, and — at a conceptual level — the older
**classic BAdI / enhancement framework** you still meet in ECC and On-Premise.

> **Read this file when:** the user mentions `BAdI`, `Business Add-In`,
> `enhancement spot`, `enhancement implementation`, `GET BADI`, `CALL BADI`,
> `IF_BADI_INTERFACE`, `IF_BADI_CONTEXT`, `CL_BADI_BASE`, `fallback class`,
> `filter BAdI`, `single use` / `multiple use` BAdI, `kernel BAdI`, `classic BAdI`,
> `SE18`, `SE19`, `enhancement point`, `enhancement section`, `implicit`/`explicit`
> `enhancement`, `customer exit`, `CMOD`, `SMOD`, `object plug-in`, or asks *how to
> enhance standard SAP behavior without a modification* / *how to make code
> extensible*.

---

## Table of Contents

1. [Enhancement Options at a Glance](#1-enhancement-options-at-a-glance)
2. [Kernel BAdI Anatomy](#2-kernel-badi-anatomy)
3. [BAdI Properties](#3-badi-properties)
4. [Consuming a BAdI — GET BADI / CALL BADI](#4-consuming-a-badi--get-badi--call-badi)
5. [Dynamic GET BADI / CALL BADI](#5-dynamic-get-badi--call-badi)
6. [Exception Handling for BAdI Calls](#6-exception-handling-for-badi-calls)
7. [Full Walkthrough — Building Your Own Kernel BAdI](#7-full-walkthrough--building-your-own-kernel-badi)
8. [Classic BAdI & the Classic Enhancement Framework](#8-classic-badi--the-classic-enhancement-framework)
9. [Environment Differences](#9-environment-differences)
10. [Finding Standard BAdIs to Enhance](#10-finding-standard-badis-to-enhance)
11. [Anti-Patterns](#11-anti-patterns)
12. [Sources](#12-sources)

---

## 1. Enhancement Options at a Glance

An **enhancement** adds behavior at a predefined position without touching (and
without needing repair/modification keys for) the original code. SAP offers several
mechanisms; which one you may use depends heavily on the environment.

| Technique | Mechanism | Tooling | Cloud-ready? |
|---|---|---|---|
| **Kernel BAdI** | Object plug-in: an implementing class plugs into an enhancement spot at runtime | ADT (Eclipse) | ✅ Yes — the recommended technique |
| **Classic BAdI** | Older BAdI framework | SAP GUI: `SE18` (define) / `SE19` (implement) | ❌ No — classic ABAP only |
| **Explicit enhancement point/section** | `ENHANCEMENT-POINT` / `ENHANCEMENT-SECTION` inserted by SAP in source | SE80 / enhancement builder | ❌ No — classic ABAP only |
| **Implicit enhancement** | Predefined implicit positions (method start/end, etc.) | Enhancement builder | ❌ No — classic ABAP only |
| **Customer/user exits** | `CMOD`/`SMOD` function-module exits, screen/menu exits | SAP GUI | ❌ No — legacy, ECC-era |

> The cheat-sheet material this file is verified against explicitly states that the
> BAdI-related ABAP **syntax** (`GET BADI`, `CALL BADI`, `IF_BADI_INTERFACE`, …)
> belongs to the **kernel-based** BAdI concept, and that legacy classic BAdIs "found
> in classic ABAP" use the BAdI builder with transactions `SE18` / `SE19`. Everything
> in sections 2–7 is the kernel concept; section 8 covers the classic world at a
> conceptual level only.

### BAdI vs modification — the golden rule

```
❌ WRONG — modifying standard SAP source (needs SSCR key, breaks on upgrade,
           adjustment via SPAU/SPDD forever after)
  * inside a standard SAP include *
  ... your custom line here ...

✅ CORRECT — implement the BAdI the standard code already calls
  " In your own enhancement implementation class:
  METHOD zif_some_standard_badi~do_something.
    " your custom logic, upgrade-stable
  ENDMETHOD.
```

A BAdI is *stable across upgrades* because SAP owns the definition (the interface
and the call site); you only own the implementation class.

---

## 2. Kernel BAdI Anatomy

A kernel BAdI is assembled from five repository objects. Understanding the roles is
the key to both building and consuming BAdIs.

```
Enhancement Spot  (container)
   └── BAdI (definition)          ← name + properties (filters, use, fallback, instantiation)
         └── BAdI Interface       ← includes IF_BADI_INTERFACE, declares the BAdI methods
   
Enhancement Implementation (container)
   └── BAdI Implementation        ← binds one implementing class (+ filter values)
         └── Implementation Class ← implements the BAdI interface = the actual logic
```

### 2.1 Enhancement spot

The **enhancement spot** is only a container. It groups one or more BAdI definitions.
Naming: `Z_ES_...` or `ZES_...` (spot), created in ADT via *New → Other ABAP
Repository Object → BAdI Enhancement Spot*.

### 2.2 BAdI (definition)

The **BAdI definition** carries the name callers reference and all behavioral
properties: filters, single/multiple use, fallback class, and instantiation mode
(see section 3). It must be assigned to an enhancement spot.

### 2.3 BAdI interface

The BAdI interface is an ordinary ABAP interface that **must include the predefined
tag interface `IF_BADI_INTERFACE`** and declares the BAdI methods. Implementation
classes will implement this interface.

```abap
✅ CORRECT
INTERFACE zif_demo_abap_calculator
  PUBLIC.
  INTERFACES if_badi_interface.        " mandatory tag interface

  METHODS calculate
    IMPORTING num1          TYPE i
              num2          TYPE i
    RETURNING VALUE(result) TYPE string.
ENDINTERFACE.
```

```abap
❌ WRONG — missing the tag interface; this is not a valid BAdI interface
INTERFACE zif_demo_abap_calculator
  PUBLIC.
  METHODS calculate IMPORTING num1 TYPE i num2 TYPE i
                    RETURNING VALUE(result) TYPE string.
ENDINTERFACE.
```

> **Constraint:** the specification of *variable attributes* is not allowed in a BAdI
> interface. Declare methods (and, if needed, constants/types), not stateful data.

### 2.4 Enhancement implementation & implementation class

The **enhancement implementation** is again a container. Inside it you create one or
more **BAdI implementations**, each of which points to an **implementation class**
that implements the BAdI interface. The class holds the concrete enhancement logic.

```abap
✅ CORRECT — an implementation class
CLASS zcl_demo_abap_calculator_subtr DEFINITION
  PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_badi_interface.          " tag interface
    INTERFACES zif_demo_abap_calculator.   " the BAdI interface
  PROTECTED SECTION.
  PRIVATE SECTION.
ENDCLASS.

CLASS zcl_demo_abap_calculator_subtr IMPLEMENTATION.
  METHOD zif_demo_abap_calculator~calculate.
    result = |{ num1 - num2 }|.
  ENDMETHOD.
ENDCLASS.
```

Multiple implementation classes can be assigned to a single BAdI — that is the basis
of "multiple use" and of filter-driven selection (section 3).

---

## 3. BAdI Properties

Four properties on the BAdI definition determine how the BAdI behaves at runtime.

### 3.1 Single use vs multiple use

**Single use** — only one implementation is active in an internal session, and one
implementation must be found per call. Because exactly one implementation runs, its
methods **may have output parameters** (`RETURNING` / `EXPORTING`). It is advisable to
provide a **fallback class** for the case where no implementation matches (see 3.3).

**Multiple use** — several implementations (or none) can run in parallel; the runtime
executes all of them sequentially. Restrictions follow directly from "several run in
sequence":

- The method parameter interface may contain **only `IMPORTING` and `CHANGING`
  parameters**.
- There can be **no single output parameter** (`RETURNING` / `EXPORTING`), because
  there is no single implementation to produce it.
- `CHANGING` parameters carry both input and output, letting each implementation alter
  the same data object in turn.

```abap
✅ CORRECT — multiple-use BAdI method: importing + changing only
METHODS convert
  IMPORTING content TYPE any
            out     TYPE REF TO if_oo_adt_classrun_out.   " passed in, not returned
```

```abap
❌ WRONG — multiple-use BAdI method must not declare a single output
METHODS convert
  IMPORTING content       TYPE any
  RETURNING VALUE(result) TYPE string.   " not allowed for multiple use
```

### 3.2 Filters

Filters let callers pick which implementation runs. You define one or more filter
names on the BAdI definition and associate each with a basic type (e.g. character,
integer, string). Each BAdI implementation declares the filter value(s) it responds
to. At runtime the caller supplies filter values via `GET BADI ... FILTERS ...` and
the matching implementation is selected.

```
BAdI ZBADI_DEMO_ABAP_CALCULATOR
  filter OPERATOR : Character
    implementation ...CALC_SUB  → filter value '-'
    implementation ...CALC_DIV  → filter value '/'
    (no match)                  → fallback class → '+'
```

If a BAdI defines filters, `GET BADI` **must** specify `FILTERS`; if it defines none,
`FILTERS` **must not** be specified. Getting this wrong raises `cx_badi_filter_error`
(section 6).

### 3.3 Fallback class

For single-use BAdIs it is advisable to specify and implement an **optional fallback
class**. It is used when no (default) implementation is found, or when the caller's
filter values match no existing filter combination.

```abap
✅ CORRECT — fallback provides a safe default (addition here)
CLASS zcl_demo_abap_calculator_fb IMPLEMENTATION.
  METHOD zif_demo_abap_calculator~calculate.
    result = |{ num1 + num2 }|.   " default behavior when no filter matches
  ENDMETHOD.
ENDCLASS.
```

Without a fallback and without a matching implementation, a single-use call has no
implementation to run — design for that case explicitly.

### 3.4 Instantiation: context-free vs context-dependent

- **New instance creation** or **instance reuse** → the BAdI is *context-free*.
- **Context-dependent** instantiation means a context object controls instantiation:
  only one instance exists per context and implementing class. The prerequisite is
  that the implementation implements the tag interface **`IF_BADI_CONTEXT`**, and
  `GET BADI` uses the `CONTEXT` addition.

> ⚠️ The detailed syntax and lifecycle of the `CONTEXT` addition and `IF_BADI_CONTEXT`
> are **not verified this session** beyond the outline above (the verified source
> notes the feature exists and points to the ABAP Keyword Documentation for details).
> Treat context-dependent BAdIs as a concept here and confirm signatures in
> `ABAPGET_BADI` docs before coding.

---

## 4. Consuming a BAdI — GET BADI / CALL BADI

Two statements consume a kernel BAdI:

- **`GET BADI`** — creates a BAdI object and assigns its reference to a BAdI reference
  variable. The runtime searches active implementation classes matching the filter
  criteria; if none match it looks for standard implementations, then the fallback
  class if available.
- **`CALL BADI`** — calls a BAdI method through that reference, binding actual to
  formal parameters.

### 4.1 Multiple-use BAdI (no filter)

```abap
✅ CORRECT
" Reference variable typed with the multiple-use BAdI definition name
DATA badi_conv TYPE REF TO zbadi_demo_abap_converter.

" No filters defined → FILTERS must NOT be specified
GET BADI badi_conv.

" All active implementations run in sequence (e.g. XML + JSON converters)
CALL BADI badi_conv->convert
  EXPORTING
    content = `Hello world`
    out     = out.
```

### 4.2 Single-use BAdI (with filter, output parameter)

```abap
✅ CORRECT
DATA badi_calc TYPE REF TO zbadi_demo_abap_calculator.

" Filter defined → FILTERS is mandatory; selects the '-' implementation
GET BADI badi_calc FILTERS operator = '-'.

" Single use → the method may return an output parameter
CALL BADI badi_calc->calculate
  EXPORTING
    num1   = 10
    num2   = 8
  RECEIVING
    result = DATA(res).       " res = '2'
```

```abap
❌ WRONG — filter BAdI called without FILTERS → cx_badi_filter_error
GET BADI badi_calc.                 " missing FILTERS on a filtered BAdI
```

```abap
❌ WRONG — specifying FILTERS on a BAdI that defines none → cx_badi_filter_error
GET BADI badi_conv FILTERS operator = '-'.
```

The reference variable is typed with the **BAdI definition name** (e.g.
`zbadi_demo_abap_calculator`) in the static form. That type binding is what makes the
static form convenient but also what forbids the dynamic `TYPE (...)` addition on it
(section 5).

---

## 5. Dynamic GET BADI / CALL BADI

When the BAdI name, method name, or filter values are only known at runtime, use the
dynamic variants. The reference variable's static type **must be `CL_BADI_BASE`**, the
superclass of all BAdI classes.

### 5.1 Dynamic GET BADI with TYPE + FILTERS

```abap
✅ CORRECT
DATA(badi_name)   = 'ZBADI_DEMO_ABAP_CALCULATOR'.
DATA(method_name) = 'CALCULATE'.
DATA result       TYPE string.

" Static type MUST be cl_badi_base for the dynamic form
DATA badi_dyn TYPE REF TO cl_badi_base.

GET BADI badi_dyn TYPE (badi_name) FILTERS operator = '-'.

CALL BADI badi_dyn->(method_name)
  EXPORTING num1 = 10
            num2 = 8
  RECEIVING result = result.
```

```abap
❌ WRONG — dynamic TYPE (...) requires cl_badi_base, not the concrete BAdI type
DATA badi_calc TYPE REF TO zbadi_demo_abap_calculator.
GET BADI badi_calc TYPE (badi_name) FILTERS operator = '-'.   " syntax error
```

### 5.2 FILTER-TABLE (dynamic filter binding)

When filter names/values are dynamic, use `FILTER-TABLE` with a table of type
`badi_filter_bindings`. Its components are `name` (type `c` length 30, filter name in
uppercase) and `value` (type `REF TO data`, a pointer to a matching data object).

```abap
✅ CORRECT
DATA op               TYPE c LENGTH 1 VALUE '/'.
DATA badi_filter_name TYPE badi_filter_name VALUE 'OPERATOR'.

DATA(filter_tab) = VALUE badi_filter_bindings(
  ( name  = badi_filter_name
    value = REF #( op ) ) ).

GET BADI badi_dyn TYPE (badi_name) FILTER-TABLE filter_tab.
```

### 5.3 PARAMETER-TABLE (dynamic parameter binding)

Like dynamic `CALL METHOD`, dynamic `CALL BADI` can bind parameters via a table of
type `abap_parmbind_tab`. Each row names the formal parameter, its kind
(`cl_abap_objectdescr=>exporting` / `=>importing` / `=>changing` / `=>returning`), and
a reference to the actual data object.

```abap
✅ CORRECT
DATA(ptab) = VALUE abap_parmbind_tab(
  ( name = 'NUM1'   kind = cl_abap_objectdescr=>exporting value = NEW i( 10 ) )
  ( name = 'NUM2'   kind = cl_abap_objectdescr=>exporting value = NEW i( 5 ) )
  ( name = 'RESULT' kind = cl_abap_objectdescr=>returning value = REF #( result ) ) ).

CALL BADI badi_dyn->(method_name) PARAMETER-TABLE ptab.
```

> Note on `kind`: `RESULT` above is bound as `returning` because `calculate` declares a
> `RETURNING` parameter. Match the `kind` to the actual parameter category or you will
> get a dynamic-call parameter exception (section 6).

---

## 6. Exception Handling for BAdI Calls

`GET BADI` and `CALL BADI` can raise several catchable exceptions. Wrap dynamic calls
in `TRY ... CATCH` and catch the *specific* classes rather than `cx_root`.

| Exception | Raised when | Typical cause |
|---|---|---|
| `cx_badi_filter_error` | `GET BADI` with wrong/missing filter binding | Filter not bound, `FILTERS` missing on a filtered BAdI, unknown BAdI name in dynamic form |
| `cx_badi_initial_reference` | `CALL BADI` on an initial reference of a **single-use** BAdI | Reference cleared / never assigned |
| `cx_sy_dyn_call_param_missing` | Dynamic `CALL BADI` with wrong/missing parameters | Passing parameter names the method does not declare |
| `cx_sy_dyn_call_illegal_method` | Dynamic `CALL BADI` naming a method that does not exist | Wrong dynamic method name |

```abap
✅ CORRECT — catch specific BAdI exceptions
DATA error TYPE REF TO cx_root.

TRY.
    GET BADI badi_dyn TYPE (badi_name) FILTER-TABLE filter_tab.
  CATCH cx_badi_filter_error INTO error.
    out->write( error->get_text( ) ).
ENDTRY.

TRY.
    CALL BADI badi_calc->calculate
      EXPORTING num1 = 3 num2 = 2
      RECEIVING result = DATA(r).
  CATCH cx_badi_initial_reference INTO error.
    out->write( error->get_text( ) ).
ENDTRY.
```

> **Multiple-use nuance:** calling a method on an *initial* reference whose static type
> is a **multiple-use** BAdI has no effect and raises **no** exception — nothing runs.
> Only **single-use** initial references raise `cx_badi_initial_reference`. Do not rely
> on an exception to detect an unbound multiple-use reference; check `IS BOUND` if it
> matters.

```abap
❌ WRONG — swallowing everything hides filter/param bugs
TRY.
    GET BADI badi_dyn TYPE (badi_name) FILTERS operator = op.
    CALL BADI badi_dyn->(method_name) EXPORTING num1 = a num2 = b RECEIVING result = r.
  CATCH cx_root.
    " empty — you will never learn the filter or method was wrong
ENDTRY.
```

---

## 7. Full Walkthrough — Building Your Own Kernel BAdI

A complete, self-contained example: a calculator BAdI that is enhanceable by adding
new operators. Single use, one `OPERATOR` filter, with a fallback class. All objects
use the `Z_` namespace.

### 7.1 Repository objects

```
Enhancement spot     : ZES_DEMO_ABAP_CALCULATOR
BAdI definition      : ZBADI_DEMO_ABAP_CALCULATOR   (single use, filter OPERATOR, fallback)
BAdI interface       : ZIF_DEMO_ABAP_CALCULATOR
Fallback class       : ZCL_DEMO_ABAP_CALCULATOR_FB  ("+")
Enhancement impl     : ZEI_DEMO_ABAP_CALCULATOR
  ├── impl ZBADI_IMPL_DEMO_ABAP_CALC_SUB → class ZCL_DEMO_ABAP_CALCULATOR_SUBTR  (filter '-')
  └── impl ZBADI_IMPL_DEMO_ABAP_CALC_DIV → class ZCL_DEMO_ABAP_CALCULATOR_DIV    (filter '/')
```

### 7.2 The BAdI interface

```abap
INTERFACE zif_demo_abap_calculator
  PUBLIC.
  INTERFACES if_badi_interface.

  METHODS calculate
    IMPORTING num1          TYPE i
              num2          TYPE i
    RETURNING VALUE(result) TYPE string.
ENDINTERFACE.
```

### 7.3 The fallback class (default = addition)

```abap
CLASS zcl_demo_abap_calculator_fb DEFINITION
  PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_badi_interface.
    INTERFACES zif_demo_abap_calculator.
ENDCLASS.

CLASS zcl_demo_abap_calculator_fb IMPLEMENTATION.
  METHOD zif_demo_abap_calculator~calculate.
    result = |{ num1 + num2 }|.
  ENDMETHOD.
ENDCLASS.
```

### 7.4 Implementation classes

```abap
" Subtraction — bound to filter OPERATOR = '-'
CLASS zcl_demo_abap_calculator_subtr DEFINITION
  PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_badi_interface.
    INTERFACES zif_demo_abap_calculator.
ENDCLASS.

CLASS zcl_demo_abap_calculator_subtr IMPLEMENTATION.
  METHOD zif_demo_abap_calculator~calculate.
    result = |{ num1 - num2 }|.
  ENDMETHOD.
ENDCLASS.

" Division — bound to filter OPERATOR = '/', with zero-divide guard
CLASS zcl_demo_abap_calculator_div DEFINITION
  PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_badi_interface.
    INTERFACES zif_demo_abap_calculator.
ENDCLASS.

CLASS zcl_demo_abap_calculator_div IMPLEMENTATION.
  METHOD zif_demo_abap_calculator~calculate.
    TRY.
        IF num1 = 0 AND num2 = 0.
          RAISE EXCEPTION TYPE cx_sy_zerodivide.
        ENDIF.
        result = |{ CONV decfloat34( num1 / num2 ) STYLE = SIMPLE }|.
      CATCH cx_sy_zerodivide.
        result = |Dividing { num1 } by { num2 } is not possible.|.
    ENDTRY.
  ENDMETHOD.
ENDCLASS.
```

### 7.5 Consuming it (single use, filter-driven, fallback demo)

```abap
DATA badi_calc TYPE REF TO zbadi_demo_abap_calculator.

" '-' → subtraction implementation
GET BADI badi_calc FILTERS operator = '-'.
CALL BADI badi_calc->calculate
  EXPORTING num1 = 10 num2 = 8
  RECEIVING result = DATA(res_minus).      " '2'

" '/' → division implementation
GET BADI badi_calc FILTERS operator = '/'.
CALL BADI badi_calc->calculate
  EXPORTING num1 = 10 num2 = 8
  RECEIVING result = DATA(res_div).        " '1.25'

" '?' → no matching filter → fallback class → addition
GET BADI badi_calc FILTERS operator = '?'.
CALL BADI badi_calc->calculate
  EXPORTING num1 = 3 num2 = 2
  RECEIVING result = DATA(res_fb).         " '5' (from fallback)
```

### 7.6 A multiple-use BAdI (converters)

Contrast: a converter BAdI defined for **multiple use**, no filter, no fallback. Two
implementations (XML and JSON) both run per call. Method signature is importing-only
(the `out` reference is passed in, not returned).

```abap
INTERFACE zif_demo_abap_converter
  PUBLIC.
  INTERFACES if_badi_interface.
  METHODS convert
    IMPORTING content TYPE any
              out     TYPE REF TO if_oo_adt_classrun_out.
ENDINTERFACE.
```

```abap
DATA badi_conv TYPE REF TO zbadi_demo_abap_converter.
GET BADI badi_conv.                        " no FILTERS (none defined)

" Runs BOTH the XML and JSON implementation classes in sequence
CALL BADI badi_conv->convert
  EXPORTING content = struct
            out     = out.
```

---

## 8. Classic BAdI & the Classic Enhancement Framework

> ⚠️ **Verification note:** the detailed syntax in this section
> (`ENHANCEMENT-POINT`, `ENHANCEMENT-SECTION`, implicit enhancement positions,
> `CMOD`/`SMOD` exits, function/menu/screen exits) is **not verified this session** —
> it could not be confirmed against a GitHub primary source. The one verified fact is
> that classic BAdIs are *classic ABAP* and are maintained with **`SE18`** (define) and
> **`SE19`** (implement). Everything else below is conceptual background; confirm exact
> syntax against the SAP Help Portal before relying on it in code.

### 8.1 Classic BAdI (SE18/SE19)

The older BAdI framework predates the kernel concept and is maintained in SAP GUI:

- `SE18` — define the BAdI (interface + properties).
- `SE19` — create an implementation.

Classic BAdIs are part of classic ABAP, so they are **available in ECC and On-Premise
only** and are **not permitted in ABAP Cloud / S/4HANA Cloud Public / BTP ABAP
Environment**. When targeting Cloud, use a kernel BAdI instead.

### 8.2 Explicit enhancement points and sections (conceptual)

SAP developers can insert explicit enhancement options into standard source:

- **`ENHANCEMENT-POINT`** — a position where customer code can be *added*.
- **`ENHANCEMENT-SECTION`** — a block of standard code that can be *replaced*.

Customers fill these via enhancement implementations in the enhancement builder. These
are classic-ABAP constructs and are **not available in ABAP Cloud**.

### 8.3 Implicit enhancements (conceptual)

Even where SAP inserted no explicit option, the runtime exposes **implicit**
enhancement positions (for example, the start/end of methods, function modules, or
form routines, and the end of structures). Like the explicit variants, these are
classic-ABAP only.

### 8.4 Customer/user exits (legacy)

The oldest mechanisms — function-module customer exits managed with `CMOD`/`SMOD`, plus
menu and screen exits — are ECC-era techniques. They are superseded by BAdIs and are
not part of Cloud development. Encounter them mostly when maintaining legacy ECC code.

### 8.5 Choosing a technique (decision guide)

```
Targeting ABAP Cloud / S/4HANA Cloud Public / BTP?
  └── Yes → Kernel BAdI (the only supported option here). If none exists,
            request/register a released enhancement point from SAP.
  └── No (ECC / On-Premise) →
        Does a released kernel BAdI exist for the use case?
          └── Yes → prefer the kernel BAdI (upgrade-stable, Cloud-portable later)
          └── No  → classic BAdI (SE18/SE19) → else explicit enhancement point/
                    section → else implicit enhancement (last resort)
        Never modify standard source directly.
```

---

## 9. Environment Differences

| Capability | ECC (≤ 7.52) | S/4HANA On-Premise | S/4HANA Cloud Public / BTP |
|---|---|---|---|
| Kernel BAdI (`GET BADI`/`CALL BADI`) | ⚠️ modern releases only | ✅ | ✅ (recommended) |
| Classic BAdI (`SE18`/`SE19`) | ✅ | ✅ | ❌ classic ABAP — forbidden |
| Explicit enhancement point/section | ✅ | ✅ | ❌ |
| Implicit enhancements | ✅ | ✅ | ❌ |
| Customer/user exits (`CMOD`/`SMOD`) | ✅ | ⚠️ legacy | ❌ |
| Enhance via released API/BAdI only | not enforced | recommended | ✅ mandatory (C1 contract) |

> ⚠️ The exact minimum on-premise release for the kernel BAdI syntax is **not verified
> this session**; the verified demo material runs on the SAP BTP ABAP Environment.
> Treat "modern releases" as "confirm in your system" rather than a hard version claim.

**Cloud rule of thumb:** in ABAP for Cloud Development you may only consume BAdIs (and
enhancement spots) that SAP has *released* for cloud use (release contract C1). If a
BAdI or spot is not released, it cannot be used — look for a released alternative or an
extension point exposed by the corresponding RAP business object.

---

## 10. Finding Standard BAdIs to Enhance

Before building anything, discover whether SAP already offers a BAdI at the point you
need:

- **SAP Business Accelerator Hub** — <https://api.sap.com/> → *Explore* → *Categories*
  → *Business Add-Ins (BAdIs)*, then filter by the business object/area. This is the
  primary catalog of released, cloud-eligible BAdIs.
- **ADT (Eclipse)** — search for enhancement spots and BAdI definitions in the target
  application; inspect the release contract to confirm it is usable in your
  environment.
- **In classic systems** — `SE18` lets you browse BAdI definitions and their
  documentation; `SE84` (Repository Information System) helps locate enhancement
  spots/BAdIs by application component.

When enhancing existing functionality, you *consume* the existing BAdI: create your own
enhancement implementation + implementation class against SAP's BAdI definition — you
never redefine SAP's interface.

---

## 11. Anti-Patterns

**1. Using a classic BAdI (SE18/SE19) or enhancement point in ABAP Cloud.**
Classic enhancement constructs are classic ABAP and are rejected in
Cloud/BTP/S-4 Cloud Public. Use a released **kernel BAdI** instead. Symptom: the object
type is simply not creatable/usable in ADT for the cloud system.

**2. Modifying standard SAP source instead of implementing the provided BAdI.**
Direct modification requires repair keys, breaks on every upgrade (SPAU/SPDD churn), and
is disallowed in Cloud entirely. If SAP calls a BAdI at that point, implement the BAdI;
that is exactly what it is for.

**3. Mismatched `FILTERS` usage.**
Specifying `FILTERS` on a BAdI that defines none — or omitting `FILTERS` on a filtered
BAdI — raises `cx_badi_filter_error`. Match the `GET BADI` statement to the BAdI's
filter definition.

**4. Declaring an output parameter on a multiple-use BAdI method.**
Multiple implementations run in sequence, so `RETURNING`/`EXPORTING` is not allowed;
only `IMPORTING` and `CHANGING`. Use a `CHANGING` parameter if each implementation must
contribute to a result.

**5. Ignoring the initial-reference difference between single and multiple use.**
Calling a method on an initial *single-use* reference raises
`cx_badi_initial_reference`; the same on a *multiple-use* reference silently does
nothing. Do not assume an exception will flag an unbound multiple-use reference — test
`IS BOUND` where correctness depends on it.

**6. Using the dynamic `TYPE (...)` form with a concrete BAdI reference type.**
The dynamic variant requires the reference variable's static type to be `CL_BADI_BASE`.
Using `TYPE REF TO zbadi_...` with `GET BADI ... TYPE (name)` is a syntax error.

**7. Omitting a fallback for a single-use BAdI that can be called with unmatched filters.**
If no implementation matches and there is no fallback class, a single-use call has
nothing to execute. Provide a fallback (a safe default) whenever unmatched filter values
are reachable.

**8. `CATCH cx_root` around `GET BADI` / `CALL BADI`.**
A blanket catch hides `cx_badi_filter_error`, `cx_sy_dyn_call_param_missing`, and
`cx_sy_dyn_call_illegal_method`, turning real wiring bugs into silent no-ops. Catch the
specific classes, log, and re-raise or handle deliberately.

---

## 12. Sources

### Verified live in this session (fetched from GitHub)

| Topic | Source |
|---|---|
| Kernel BAdI concept, anatomy, properties (single/multiple use, filters, fallback, context), all `GET BADI`/`CALL BADI` syntax (static + dynamic), `IF_BADI_INTERFACE`, `IF_BADI_CONTEXT`, `CL_BADI_BASE`, `badi_filter_bindings`, `abap_parmbind_tab`, BAdI exceptions, calculator + converter examples | `SAP-samples/abap-cheat-sheets` → `35_BAdIs.md` (branch `main`) |
| Confirmation that classic BAdIs are classic ABAP, maintained via `SE18`/`SE19` | `SAP-samples/abap-cheat-sheets` → `35_BAdIs.md`, "About BAdIs" note (branch `main`) |
| DDIC extensibility annotations (`@AbapCatalog.enhancement.category`) — context for enhancement vocabulary | `SAP-samples/abap-cheat-sheets` → `22_Released_ABAP_Classes.md`, `33_ABAP_Release_News.md` (branch `main`) |

### Official references — not fetched this session (help.sap.com unreachable in this environment)

| Topic | URL | Status |
|---|---|---|
| Enhancements Using BAdIs (ABAP Keyword Documentation) | <https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenbadi_enhancement.htm> | cited, not fetched |
| `GET BADI` statement reference | <https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/ABAPGET_BADI.html> | cited, not fetched |
| `CALL BADI` statement reference | <https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/ABAPCALL_BADI.html> | cited, not fetched |
| Business Add-Ins (BAdIs) — SAP Help Portal (classic-ABAP context) | <https://help.sap.com/docs/ABAP_PLATFORM_NEW/46a2cfc13d25463b8b9a3d2a3c3ba0d9/8ff2e540f8648431e10000000a1550b0.html> | cited, not fetched |
| Extend S/4HANA in cloud and on premise with ABAP extensions | <https://www.sap.com/documents/2022/10/52e0cd9b-497e-0010-bca6-c68f7e60039b.html> | cited, not fetched |
| SAP Business Accelerator Hub — browse released BAdIs | <https://api.sap.com/> | cited, not fetched |
| Classic enhancement framework (`ENHANCEMENT-POINT`/`SECTION`, implicit enhancements) | <https://help.sap.com/doc/abapdocu_cp_index_htm/CLOUD/en-US/index.htm?file=abenenhancements.htm> | ⚠️ syntax not verified this session |

---

*Cross-domain:* for enhancing RAP business objects (augmentation, additional save,
side effects) read `domain/rap/DOMAIN.md`; for the released-API / C1 contract rules that
govern what BAdIs you may consume in Cloud, read `references/released-classes.md` and
`references/cloud-restrictions.md`.