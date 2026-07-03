# M1-002 — CONTRIBUTING.md

Version: 1.0  
Status: ACTIVE  
Layer: M1 Governance System  

---

# 1. Purpose

This document defines the **mandatory development behavior rules** for YuMatrix Studio.

It governs:

- Human developers
- AI assistants (Claude / ChatGPT / automation agents)
- Sprint execution process
- Code contribution lifecycle

---

# 2. Core Principle

> This is not a guideline.  
> This is a **behavior enforcement contract**.

All contributions MUST comply.

---

# 3. System Philosophy

YuMatrix Studio is governed by:

- Governance Layer (rules)
- Standards Layer (constraints)
- ADR Layer (decisions)
- Execution Layer (sprints)

Contributors MUST NOT bypass any layer.

---

# 4. Contribution Rules

## 4.1 No Direct Architecture Changes

❌ Forbidden:
- Modifying core architecture without ADR
- Changing module boundaries
- Introducing new system layers

✔ Allowed:
- Proposing changes via ADR

---

## 4.2 Mandatory ADR Requirement

Any of the following MUST create an ADR:

- Architecture change
- Module boundary change
- Data flow change
- IPC rule change

If no ADR exists → change is INVALID.

---

## 4.3 Sprint Execution Rules

Every Sprint MUST:

- Reference governance rules
- Follow MODULE_RULES
- Pass enforcement validation
- Be reviewed before completion

Sprint without review = INVALID

---

## 4.4 AI Contribution Rules

AI assistants MUST:

- Follow ENFORCEMENT.md
- Never bypass module boundaries
- Never modify architecture without ADR
- Respect single source of truth

AI output is considered **proposed work**, not final truth.

---

## 4.5 Code Ownership Rules

All code must belong to:

- A module (src/modules/*)
- Or core system (src/core/*)
- Or platform adapter (src/platforms/*)

❌ Forbidden:
- Orphan files
- Logic outside module boundaries
- Shared uncontrolled utilities

---

## 4.6 Review Requirement

All contributions MUST pass:

- Code review (manual or simulated)
- Governance compliance check
- Standards validation

---

# 5. Git Workflow

## 5.1 Branch Strategy

- main → stable release
- develop → integration
- sprint/* → active work

---

## 5.2 Commit Rules

Commit messages MUST include:

- Scope
- Type
- Context

Example:


[core/database] fix initialization race condition


---

## 5.3 Merge Rules

❌ No direct merge to main  
✔ Only via reviewed sprint completion  

---

# 6. Definition of Done (DoD)

A task is ONLY complete if:

- Code implemented
- Standards followed
- ADR updated (if needed)
- Sprint rules passed
- No governance violation

---

# 7. Violation Handling

If a violation occurs:

1. Mark sprint INVALID
2. Roll back change
3. Create ADR explaining violation
4. Add rule update if needed

---

# 8. AI Collaboration Protocol

AI MUST:

- Treat all instructions as constrained execution
- Prefer safety over completion
- Ask for ADR when uncertain
- Never assume architectural intent

---

# 9. System Integrity Rule

> No feature is more important than system integrity.

If a change breaks governance → it is rejected automatically.

---

# 10. Final Rule

> If it is not in governance → it does not exist.

---

# END OF DOCUMENT