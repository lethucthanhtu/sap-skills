
# SAP skills for Claude.ai

> A skill set for Claude.ai (Web version) that help handle SAP development task with references, aim for better accuracy.
>
> Purpose: It's easier to use the web version instead of Claude Code since some company policies might not allow to use it.

---

## Table content

- [SAP skills for Claude.ai](#sap-skills-for-claudeai)
  - [Table content](#table-content)
  - [About](#about)
  - [Domain currently support](#domain-currently-support)
  - [Folder Structure](#folder-structure)
  - [Installation \& Usage](#installation--usage)
    - [Step 1 — Download skill](#step-1--download-skill)
    - [Step 2 — Add skill to Claude.ai](#step-2--add-skill-to-claudeai)
    - [Step 3 — Activate skill](#step-3--activate-skill)
  - [Contributing](#contributing)
  - [License](#license)

---

## About

---

## Domain currently support

|Domain|Support|Note|
|-|-|-|
|ABAP Core|✅||
|RAP|✅||
|CDS|✅||
|Odata|✅||
|CAP|✅||
|Fiori/UI5|❌|future|

## Folder Structure

```text
sap-skills/
│
├── SKILL.md
│
├── references/
│   ├── resources.md
│   ├── environment-matrix.md
│   └── anti-patterns.md
│
└── domains/
    ├── abap-core/
    │   ├── DOMAIN.md
    │   └── references/
    │       ├── modern-syntax.md
    │       ├── clean-abap.md
    │       ├── abap-sql.md
    │       ├── exception-classes.md
    │       ├── unit-testing.md
    │       ├── badi-enhancement.md
    │       ├── released-classes.md
    │       └── cloud-restrictions.md
    │
    ├── cds/
    │   ├── DOMAIN.md
    │   └── references/
    │       ├── view-entities.md
    │       ├── annotations.md
    │       ├── access-control.md
    │       ├── table-functions.md
    │       ├── virtual-elements.md
    │       ├── metadata-extensions.md
    │       └── cds-testing.md
    │
    ├── rap/
    │   ├── DOMAIN.md
    │   └── references/
    │       ├── managed.md
    │       ├── unmanaged.md
    │       ├── bapi-wrapper.md
    │       ├── standard-bo-extension.md
    │       ├── draft-handling.md
    │       ├── actions-validations.md
    │       ├── business-events.md
    │       ├── eml-patterns.md
    │       ├── validation-trigger-guide.md
    │       ├── performance.md
    │       ├── environment-diff.md
    │       └── testing-eml.md
    │
    ├── odata/
    │   ├── DOMAIN.md
    │   └── references/
    │       ├── v4-rap-based.md
    │       ├── v2-segw-based.md
    │       ├── draft-protocol.md
    │       ├── batch-etag.md
    │       └── error-handling.md
    │
    ├── cap/
    │   ├── DOMAIN.md
    │   └── references/
    │       ├── remote-services.md
    │       ├── error-propagation.md
    │       ├── hybrid-mashup.md
    │       ├── service-handlers.md
    │       ├── btp-deployment.md
    │       ├── fiori-elements-cap.md
    │       ├── authentication.md
    │       └── local-dev-mock.md
    │
    ├── fiori-sapui5/
    │   ├── DOMAIN.md
    │   └── references/
    │       ├── fiori-elements.md
    │       ├── launchpad.md
    │       └── annotations-ui.md
    │
    ├── hana-sqlscript/
    │   ├── DOMAIN.md
    │   └── references/
    │       ├── sqlscript.md
    │       ├── amdp.md
    │       └── hana-cloud.md
    │
    └── integration-suite/
        ├── DOMAIN.md
        └── references/
            ├── iflow-patterns.md
            ├── groovy-scripts.md
            └── adapters-mapping.md
```

---

## Installation & Usage

### Step 1 — Download skill

- **Stable version**
  **[Download](https://cdn.lttt.dev/sap/claude-skills@stable)**

- **Latest version**
  **[Download](https://cdn.lttt.dev/sap/claude-skills@latest)**

### Step 2 — Add skill to Claude.ai

1. Go to [claude.ai](https://claude.ai) and sign in
2. On **side bar** Navigate to **Customize** → **Skills**, or open a **Project**
3. Click the **+** icon, then **"Create Skill"** -> **"Upload files"**
4. Upload the **zip file**

### Step 3 — Activate skill

There are 2 ways to active the skill:

- Through `/sap` command
- The skill automatically active when prompt have keyword relative to SAP

---

## Contributing

Contributions are welcome! You can:

- Open an **Issue** to report a bug or suggest a new topic
- Submit a **Pull Request** to add documents or improve existing content
- Star the repo if you find it useful ⭐

When submitting a PR, please make sure:

- Documents are written in standard Markdown
- Content is sourced and cited from SAP Help Portal or SAP Community
- `SKILL.md` has been updated with a reference to any new file

---

## License

This project is distributed under the **GPL-3.0** license. See [LICENSE](LICENSE) for details.
