---
description: Research an SAP question against official documentation and return a sourced answer with confidence. Run as /sap:research <question>.
argument-hint: <SAP question, e.g. "is CL_ABAP_REGEX released for ABAP Cloud?">
---

# SAP research

Research this question: **$ARGUMENTS**

1. If the question doesn't name the product, environment and release, and the answer
   depends on them, ask the user one short question first (e.g. "S/4HANA on-prem 2023 or
   BTP ABAP Environment?").
2. Delegate the research to the `sap-researcher` subagent with a self-contained brief:
   the question, the environment/release, what would count as proof, and any constraints.
   Don't paste proprietary code, system names or credentials into the brief unless the
   user explicitly asks for them to be analysed.
3. Relay the subagent's answer in the format from
   `${CLAUDE_PLUGIN_ROOT}/references/research-workflow.md` (Answer, Applies to,
   Confidence, Details, Sources, Open questions). Don't add claims the subagent didn't
   verify; if you add context from memory, label it as unverified.
