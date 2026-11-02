# BTP Account Model & Runtimes

Read for: global account / directory / subaccount, entitlements, trust, BTP CLI and Terraform, choosing Cloud Foundry vs Kyma vs ABAP Environment.

---

## 1. Account model

```
Global account (contract)
└── Directory (optional grouping, can manage entitlements)
    └── Subaccount (region + environment; unit of isolation)
        ├── Cloud Foundry org → spaces → apps / service instances
        ├── Kyma cluster → namespaces → workloads
        └── ABAP Environment system (service instance of "abap")
```

- **Entitlements** are assigned to subaccounts; a missing entitlement is the most common
  reason a service "doesn't exist" in the cockpit.
- **Trust configuration** is per subaccount: default SAP ID service, or a custom IdP —
  SAP recommends **SAP Cloud Identity Services – Identity Authentication (IAS)** as the
  central IdP / proxy.
- Automate with the **BTP CLI** (`btp …`), the Terraform provider for SAP BTP, and
  `cf` / `kubectl` for the runtimes.

---

## 2. Runtimes — pick one per workload

| Runtime | Use when | Typical stack |
|---|---|---|
| **Cloud Foundry** | Standard business apps and extensions, simplest ops | CAP (Node.js/Java), approuter, HTML5 repo, MTA |
| **Kyma** (managed Kubernetes) | Containers, event-driven microservices, need K8s control | CAP or any container, Helm, serverless functions |
| **ABAP Environment** ("Steampunk") | ABAP skills, RAP apps, ABAP side-by-side extensions | RAP, CDS, ABAP Cloud only (no classic ABAP) |

Embedded Steampunk (ABAP Cloud inside S/4HANA) is *not* a BTP runtime — it's
developer extensibility in S/4HANA (see `domain/clean-core/DOMAIN.md`).
