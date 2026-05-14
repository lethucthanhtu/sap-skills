# 🤖 SAP Skills for Claude.ai

> A curated set of reference documents that help Claude.ai handle SAP development tasks with greater accuracy — covering ABAP CDS, RAP, OData, and more.

---

## 📋 Table of Contents

- [About](#-about)
- [Folder Structure](#-folder-structure)
- [Installation & Usage](#-installation--usage)
- [How to Add Documents to a Skill](#-how-to-add-documents-to-a-skill)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🧩 About

**SAP Skills** is a collection of technical reference files organized by topic, designed to be integrated into the **Skills** system of [Claude.ai](https://claude.ai). Once loaded, Claude will use these documents to:

- Generate ABAP/CDS/RAP code accurately for the correct environment (ECC, S/4HANA On-Prem, ABAP Cloud)
- Identify and warn about deprecated APIs or syntax
- Apply SAP best practices instead of guessing from outdated training data

---

## 📁 Folder Structure

```
sap-skills/
├── sap-abap-cds/         # CDS Views, annotations, associations
├── sap-abap-rap/         # RAP (RESTful ABAP Programming Model)
├── sap-odata/            # OData V2/V4, service bindings
└── README.md
```

Each skill folder contains:
- `SKILL.md` — The main entry point that Claude reads first
- Supporting reference files (`.md`) linked from `SKILL.md`

---

## 🚀 Installation & Usage

### Step 1 — Download the Skills

Download the latest release of all skills as a single package:

**[⬇️ Download — cdn.lttt.dev/sap/claude-skills@latest](https://cdn.lttt.dev/sap/claude-skills@latest)**

Extract the archive. You will find all skill folders ready to use.

---

### Step 2 — Upload to Claude.ai

1. Go to [claude.ai](https://claude.ai) and sign in
2. Navigate to **Settings** → **Skills**, or open a **Project**
3. Click **"Add Skill"** / **"Upload files"**
4. Upload the skill folder you need (e.g. `sap-abap-cds/`), including `SKILL.md` and all accompanying reference files
5. Claude will automatically recognize `SKILL.md` as the entry point

---

### Step 3 — Activate the Skill

After uploading, the skill activates automatically when you ask SAP-related questions. You can also invoke it explicitly:

```
"Using the SAP skill, write a CDS view for..."
"According to the RAP skill, how do I declare a BDEF?"
```

---

## 📝 How to Add Documents to a Skill

To expand Claude's knowledge on a specific SAP topic, you can add new reference files to an existing skill.

### 1. Create a new reference file

Create a `.md` file inside the relevant skill folder, for example:

```
sap-abap-cds/
├── SKILL.md
├── references/
│   ├── annotations.md          ← existing file
│   └── access-control.md       ← new file you want to add
```

Follow this structure for the new document:

```markdown
# [Topic Name] — Reference

## Applicable Version / Environment
- S/4HANA 2023+
- ABAP Cloud

## Key Concepts
...

## Code Example
\`\`\`abap
...
\`\`\`

## Notes / Limitations
...

## Sources
- https://help.sap.com/...
```

---

### 2. Register the file in `SKILL.md`

Open the skill's `SKILL.md` and add a reference to the new file under `## References` or `## Documents`:

```markdown
## References

- [CDS Annotations](references/annotations.md)
- [Access Control (DCL)](references/access-control.md)   ← add this line
```

This step is critical — Claude only reads documents that are explicitly linked from `SKILL.md`.

---

### 3. Add a short description (optional but recommended)

In `SKILL.md`, add a short note so Claude knows when to consult the new file:

```markdown
### When to read `access-control.md`
Read this file when the question involves DCL, `@MappingRole`, `DEFINE ROLE`,
or access control in CDS views.
```

---

### 4. Re-upload the skill

After editing, re-upload the entire skill folder to Claude.ai to apply your changes (see [Step 2](#step-2--upload-to-claudeai)).

---

## 🤝 Contributing

Contributions are welcome! You can:

- Open an **Issue** to report a bug or suggest a new topic
- Submit a **Pull Request** to add documents or improve existing content
- Star the repo if you find it useful ⭐

When submitting a PR, please make sure:
- Documents are written in standard Markdown
- Content is sourced and cited from SAP Help Portal or SAP Community
- `SKILL.md` has been updated with a reference to any new file

---

## 📄 License

This project is distributed under the **GPL-3.0** license. See [LICENSE](LICENSE) for details.

---
