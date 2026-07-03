# M1-003 — WORKFLOW.md

Version: 1.0  
Status: ACTIVE  
Layer: M1 Governance System  

---

# 1. Purpose

This document defines the **end-to-end execution workflow** of YuMatrix Studio.

It governs:

- Feature development lifecycle
- Sprint execution lifecycle
- AI collaboration flow
- Review & release flow

---

# 2. Core Principle

> All work must follow a deterministic workflow.  
> No ad-hoc execution is allowed.

---

# 3. System Workflow Overview

All work MUST follow this pipeline:


Idea
↓
ADR (if needed)
↓
Sprint Planning
↓
Implementation
↓
Standards Validation
↓
Governance Check
↓
Review
↓
Release


---

# 4. Development Workflow

## 4.1 Step 1 — Idea Creation

All changes begin as:

- Feature request
- Bug fix
- Architecture improvement

If structural → MUST create ADR first.

---

## 4.2 Step 2 — ADR Decision Gate

If any of the following are involved:

- Architecture change
- Module boundary change
- Data flow change
- IPC change

👉 MUST create ADR before implementation.

If no ADR → task is INVALID.

---

## 4.3 Step 3 — Sprint Allocation

All work MUST be assigned to a sprint:

- sprint-0 → setup
- sprint-1 → core system
- sprint-2+ → feature development

No work exists outside sprint system.

---

## 4.4 Step 4 — Implementation

During implementation:

MUST follow:

- MODULE_RULES.md
- CODING_STANDARDS.md
- IPC_STANDARD.md

Forbidden:

- Cross-module access
- Direct architecture modification
- Bypassing core APIs

---

## 4.5 Step 5 — Standards Validation

Before review:

MUST validate:

- Code structure compliance
- Module boundary rules
- Security constraints
- IPC correctness

If validation fails → return to implementation.

---

## 4.6 Step 6 — Governance Check

System checks:

- ENFORCEMENT.md compliance
- ADR consistency
- Architecture alignment

Violation = Sprint INVALID

---

## 4.7 Step 7 — Review Process

All changes MUST be reviewed:

### Review types:
- Manual review
- AI-assisted review
- Governance validation review

Approval required before merge.

---

## 4.8 Step 8 — Release

Only approved sprint outputs can be released.

Release requires:

- PASS review
- PASS governance check
- No ADR violations

---

# 5. AI Execution Workflow

AI assistants MUST follow:


Request
↓
Check ADR requirement
↓
Check standards
↓
Propose implementation
↓
Wait for validation
↓
Execute within constraints


AI MUST NOT:

- Skip ADR step
- Modify architecture freely
- Ignore governance rules

---

# 6. Sprint Lifecycle Workflow

Each sprint follows:


Planning
↓
Design (ADR if needed)
↓
Execution
↓
Validation
↓
Review
↓
Completion


Sprint is NOT complete until ALL steps pass.

---

# 7. Violation Handling Workflow

If violation occurs:

1. Stop execution
2. Mark sprint as INVALID
3. Create ADR explaining issue
4. Update standards if needed
5. Re-run workflow

---

# 8. Governance Enforcement Flow

Every action is validated against:


CONTRIBUTING.md
↓
STANDARDS
↓
ADR
↓
ENFORCEMENT.md


Failure at any level = rejection

---

# 9. System Rule

> No workflow bypass is allowed under any condition.

---

# 10. Final Definition

> If it is not in workflow, it cannot be executed.

---

# END OF DOCUMENT