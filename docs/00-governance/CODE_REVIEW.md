# M1-004 — CODE_REVIEW.md

Version: 1.0  
Status: ACTIVE  
Layer: M1 Governance System  

---

# 1. Purpose

This document defines the **mandatory code review system** for YuMatrix Studio.

It ensures:

- Code correctness
- Architecture compliance
- Governance enforcement
- System stability

---

# 2. Core Principle

> No code is valid until it passes review.

---

# 3. Review Types

All code changes MUST go through one or more of the following:

## 3.1 Governance Review

Checks:

- ENFORCEMENT.md compliance
- WORKFLOW.md compliance
- CONTRIBUTING.md compliance

---

## 3.2 Architecture Review

Checks:

- Module boundaries
- Core dependency rules
- Data flow correctness
- IPC compliance

---

## 3.3 Standards Review

Checks:

- Coding standards
- Documentation standards
- Security standards
- Testing standards

---

## 3.4 ADR Review

Checks:

- Is ADR required?
- Is ADR present?
- Does implementation match ADR?
- Are consequences respected?

---

# 4. Review Checklist (MANDATORY)

Every review MUST verify:

## 4.1 Structure

- [ ] Code is inside correct module
- [ ] No orphan files exist
- [ ] No cross-module imports

---

## 4.2 Architecture

- [ ] No core layer violation
- [ ] No platform coupling violation
- [ ] No renderer bypass

---

## 4.3 Governance

- [ ] CONTRIBUTING.md followed
- [ ] WORKFLOW.md followed
- [ ] ENFORCEMENT.md respected

---

## 4.4 ADR Compliance

- [ ] ADR exists (if required)
- [ ] Implementation matches ADR
- [ ] No silent architecture change

---

## 4.5 Quality

- [ ] Code is readable
- [ ] No duplicated logic
- [ ] No unsafe patterns
- [ ] Error handling present

---

# 5. Review Failure Rules

If ANY rule fails:

- ❌ Code MUST be rejected
- ❌ Sprint cannot be completed
- ❌ Change must be reverted or fixed

---

# 6. AI Review Rules

AI reviewers MUST:

- Be strict (not permissive)
- Prioritize system integrity over feature delivery
- Reject ambiguous architecture
- Enforce module boundaries

---

# 7. Human Review Rules

Human reviewers MUST:

- Follow same checklist
- Not bypass governance rules
- Not approve incomplete ADRs

---

# 8. Automated Review (Future Ready)

System SHOULD support:

- Static analysis checks
- Import boundary validation
- ADR matching validation
- Rule violation detection

---

# 9. Definition of Done (DoD)

A change is ONLY considered DONE if:

- Code passes all review layers
- No governance violations exist
- ADR is updated (if needed)
- Workflow is fully followed

---

# 10. System Rule

> If it does not pass review, it does not exist in the system.

---

# END OF DOCUMENT