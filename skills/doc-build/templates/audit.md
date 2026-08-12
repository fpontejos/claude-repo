# Template: docs audit

> **Reference spec** for the optional audit follow-up to a doc-build run. Adapted
> from the general-purpose implementation-audit pattern, translated for
> documentation suites. No executable workflow script exists yet — dispatch the
> three reviewers as parallel Agent calls per §Execution, or implement
> `audit-workflow.js` from this spec.

**Purpose:** Post-build quality gate. Independent verification of a completed documentation suite against its plan, the source code it documents, and the reader's workflow — producing a PASS / PASS WITH NOTES / FAIL verdict.

**When to use:**
- After a doc-build run returns `complete` and the suite warrants formal review
- Before publishing or announcing a docs suite
- Auditing a suite built earlier — the audit does not depend on a live build run

**Why independent review:** doc-build writers verify their own claims against source. The audit's value is re-checking those claims with agents that did not write the content.

---

## Args

| Arg | How to resolve |
|-----|----------------|
| `feature` | Suite name, matching the build run |
| `plan_path` | The implementation plan the suite was built from |
| `build_cmd` | Same build/verify command as the build run |
| `docs_root` | Root of the docs directory |
| `repo_root` | Absolute path to the repository root |
| `writers[]` | The build run's domain split — each writer's `files_to_write` + `source_files` (drives the accuracy-checker's sampling) |
| `output_dir` | Where reviewer reports and the verdict land (e.g. `docs/plans/<date>-<feature>-docs/audit/`) |
| `conventions_context` | Optional free text: project docs conventions, terminology rules, style decisions to check against |

---

## Roles

| Role | Question | Reads |
|------|----------|-------|
| `coverage-critic` | Does the built suite match the plan? | plan + built docs |
| `accuracy-checker` | Does the content match the source code? | built docs + the writers' `source_files` |
| `reader-voice` | Does the suite serve a first-time reader? | built docs only |
| verdict (orchestrator or 4th agent) | Synthesis | the three reports |

---

## Execution

```
Pre-flight:  run {build_cmd} fresh, capture full output   → shared evidence
                 ↓
Parallel:    coverage-critic | accuracy-checker | reader-voice
             (all read-only against docs + source; each writes its report
              to {output_dir})
                 ↓
Verdict:     read all three reports → write {output_dir}verdict.md
```

All three reviewers receive the fresh build output and the same two rules:

- **Evidence rule:** every finding MUST cite a file:line, build-output line, or specific plan criterion. No evidence = no finding.
- **Severity:** BLOCKER (wrong or missing content a reader would rely on), SIGNIFICANT (gap or deviation), MINOR (observation worth noting).

Reviewers must not modify the docs or the source — reports only.

---

## Reviewer Prompts

### coverage-critic

```
You are the coverage-critic auditing the "{feature}" documentation suite.

Your question: does the built suite match the plan?

Read the plan first: {plan_path}
Docs root: {docs_root}

## Build Output
{paste: fresh {build_cmd} output}

## Your checklist

1. **Nav completeness**: every page in the plan nav exists and is non-stub
   (no "TODO: content", no placeholder sections).
   Table: | Plan page | Exists | Non-stub | Notes |

2. **Coverage per plan section**: for each content requirement in the plan,
   locate where the suite covers it. Report uncovered requirements.
   Table: | Plan requirement | Covered at | Status |

3. **Declared gaps**: the build run's writers declared gaps ({paste: gaps from
   the build result, if available}). Verify each was either resolved or is
   still open — flag still-open gaps as SIGNIFICANT.

4. **Structure deviations**: nav structure, section ordering, or file paths
   that differ from the plan. | Expected | Actual | Severity |

Evidence rule: every finding cites file:line or a specific plan criterion.
Severity: BLOCKER / SIGNIFICANT / MINOR.

Write your findings to: {output_dir}coverage-critic.md
Return a 1-line summary: "Coverage: N/N pages present, N uncovered requirements, N blockers"
```

### accuracy-checker

```
You are the accuracy-checker auditing the "{feature}" documentation suite.

Your question: does the content match the source code?

Docs root: {docs_root}
Repo root: {repo_root}

Per-domain source files (from the build's domain split):
{paste: each writer's files_to_write + source_files}

## Your checklist — sample per docs page, verify against source

1. **Factual claims**: sample the load-bearing claims on each page (behaviors,
   defaults, constraints) and verify each against the source files for that
   domain. | Claim | Page | Source evidence | VERIFIED / WRONG / UNVERIFIABLE |

2. **Symbol references**: every `ClassName.method()` / `module.function()`
   reference must resolve in the codebase. Report dangling references.

3. **Code examples**: examples must match the actual source (signatures,
   field names, return shapes) — not an earlier or imagined version.

4. **Reference tables**: option / endpoint / CLI tables must match the real
   interface: every documented entry exists; note significant interface
   surface the docs omit.

5. **Terminology consistency**: the same concept must carry the same name
   across different writers' sections.
   {paste: conventions_context, if provided}

Evidence rule: every finding cites doc file:line AND the source symbol or file
that contradicts it. Severity: BLOCKER (wrong claim a reader would rely on) /
SIGNIFICANT / MINOR.

Write your findings to: {output_dir}accuracy-checker.md
Return a 1-line summary: "Accuracy: N claims sampled, N wrong, N dangling refs, N blockers"
```

### reader-voice

```
You are the reader-voice auditing the "{feature}" documentation suite.

Your question: does the suite serve a first-time reader?

Docs root: {docs_root}. Read the built suite only — do not read the plan or
source first; encounter the docs as a reader would.

## Your checklist

1. **Entry walkthrough**: start at the index. Can you tell what the suite
   covers and where to go for each major topic?

2. **Question-driven navigation**: pick the 3-5 questions this suite exists to
   answer (from its own index/overview). For each, navigate from the index to
   the answer. Count the hops; note dead ends.

3. **Cross-references**: do internal links land where their anchor text
   promises? Do diagrams render and communicate?

4. **Gap check**: what would a practitioner need that the suite does not
   provide? What would confuse or mislead on first contact?

For each aspect:
**Verdict: [CLEAR | NEUTRAL | CONFUSING]**
[Assessment with reference to specific pages]
**Bottom line:** [one sentence]

End with:
## Overall Assessment
[2-3 sentences]

**Top 2 reader concerns:**
1. [Most important]
2. [Second most important]

Write your findings to: {output_dir}reader-voice.md
Return a 1-line summary: "Reader: [PASS | PASS WITH NOTES | FAIL] — [one sentence]"
```

---

## Verdict

After all three reviewers complete, read the three reports and write `{output_dir}verdict.md`:

```markdown
# Docs Audit: {feature}

**Verdict:** [PASS | PASS WITH NOTES | FAIL]

## Build
{build_cmd} — clean / N errors (fresh run, not the build-time result)

## Coverage (coverage-critic)
{pages table, uncovered requirements, open gaps — or "Complete"}

## Accuracy (accuracy-checker)
{wrong claims, dangling references, interface mismatches — or "No discrepancies found"}

## Reader Experience (reader-voice)
{walkthrough verdicts, top concerns}

## Action Items
| # | Item | Priority | Source |
{synthesized from all three — only if items exist}

## Summary
{2-3 sentences combining all perspectives}
```

Verdict criteria: any BLOCKER → FAIL. No blockers but SIGNIFICANT findings or open action items → PASS WITH NOTES. Otherwise PASS.

---

## Report to User

```
## Docs Audit Complete: {feature}

Verdict: [PASS | PASS WITH NOTES | FAIL]

Coverage: N/N pages, N uncovered requirements
Accuracy: N claims sampled, N wrong, N dangling refs
Reader:   [PASS | PASS WITH NOTES | FAIL] — [one sentence]

Action items: N (or "None")
Report: {output_dir}verdict.md
```

Next-step branch, presented with the verdict:
- PASS → suite is publishable
- PASS WITH NOTES → address action items (listed in verdict.md) first
- FAIL → fix blockers before publishing; one fix task per action item

Committing the audit reports is the caller's decision, on explicit ask.
