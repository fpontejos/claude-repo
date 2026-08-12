# Template: interactive pre-flight (`--interactive`)

> **Reference spec** for the `--interactive` flag of the `/doc-build` skill. `SKILL.md`
> §Step 1 holds the short form (mode resolution, precedence, fail-loud conditions); this
> file carries the full gate definitions, question text, manifest format, and the args-file
> contract. Self-contained: it does not depend on the `clarify` skill being installed,
> though it follows the same questioning pattern.

**Purpose:** Under `--interactive`, the pre-flight is the product. Guided questioning
resolves the judgment calls that inference would otherwise guess at, a manifest confirms
the fully resolved arguments, and the confirmed args are written to
`doc-build-args.json`. Launching the workflow is a separate, always-non-interactive act
that consumes that file — in the same session on confirmation, or in a later one.

**Scope boundary:** This file governs Step 1 (pre-flight) and the Step 3 post-run branch.
It does not change `workflow.js`, any role prompt, or any schema. The interactive path
and the non-interactive path converge on an identical args object.

---

## The constraint

The workflow runs in the background and returns via task notification. Its agents have no
channel to the user. Every question must therefore be asked and answered inline, before
`Workflow()` is called.

Consequence: `--interactive` does not make the run interactive. It makes the pre-flight
interactive and adds one decision point after results arrive. A gate that would need to
fire mid-run is out of scope for this flag — encode it as an arg instead.

---

## Invocation and modes

```
/doc-build <plan-path> [--interactive | -i]
```

| Mode | Behaviour |
|---|---|
| Default | Never asks. Resolves args by precedence (below); an ambiguity inference cannot resolve fails loudly with the open question named and `--interactive` suggested. |
| `--interactive` | Gates A/B/C fire, manifest confirmation required, confirmed args written to `doc-build-args.json`, then launch on yes. |

**Precedence (default mode):** explicit invocation args > `doc-build-args.json` in the
plan directory > inference via the SKILL.md pre-flight steps. An args file is used only
after its staleness check passes (§Args file).

Execution never asks, in either mode — all questions live in the `--interactive`
pre-flight. Autonomous callers (subagents, `/spawn-team doc-build`, headless runs)
therefore need no special flag: they invoke plainly, consume an args file when a human
session has produced one, and otherwise fall back to inference or fail loudly.
`--interactive` is meaningful only where a user can answer; subagents never pass it.

---

## Fail-loud conditions

Each condition is a case where inference would otherwise guess. In default mode, hitting
one stops the invocation with the question stated and `--interactive` named as the
resolution path. Under `--interactive`, the listed gate resolves it.

| Condition | Default-mode behaviour | Resolved by |
|---|---|---|
| No plan at `plan_path` | Stop, recommend `writing-plans` | Gate A, then hand output to `writing-plans` |
| Domain split needs more than 5 writers | Stop; partition is the open question | Gate A |
| `build_cmd` resolves to zero or multiple candidates | Stop; candidates listed | Manifest question |
| Plan nav contains pages with no plausible source domain | Stop; pages listed | Gate B follow-up |
| Two prose writers share source files, or any two writers share doc files | Stop; overlap listed (the ADR writer's cross-domain reads are exempt) | Gate B |
| Args file present but stale (§Args file) | Stop; drift named | Re-run of the affected gate |

---

## Gate order

```
Gate A: Scope        → fires when the plan is absent, or nav exceeds one run
    ↓
Gate B: Split        → fires whenever --interactive is set
    ↓
Gate C: Finish line  → fires whenever --interactive is set
    ↓
Manifest             → single explicit confirmation → write doc-build-args.json → Workflow()
```

Three `AskUserQuestion` calls is the ceiling. Batch up to 4 questions per call. More
turns than this and the user would have been faster editing the plan directly.

Where options are not yet clear, open with a free-form question instead — structured
options presented before context is established produce answers to the wrong question.

---

## Gate A: Scope

**Fires when:** no plan exists, or the plan nav is larger than one invocation can hold
(more than 5 writer domains).

**Opener (conversational, not `AskUserQuestion`):**

> What does this suite need to cover, and who reads it?

**Then one batch:**

```yaml
questions:
  - question: "What does this run cover?"
    header: "Coverage"
    options:
      - label: "Whole plan nav"
        description: "One suite, one invocation"
      - label: "Named subsection"
        description: "First of several sequential runs"
      - label: "Undocumented areas only"
        description: "Fill gaps in an existing suite"
    multiSelect: false

  - question: "Primary reader?"
    header: "Audience"
    options:
      - label: "Contributor"
        description: "Reads source alongside; favours reference depth"
      - label: "Integrator"
        description: "Consumes the interface; favours concepts and examples"
      - label: "Both"
        description: "Separate tracks, more pages"
    multiSelect: false

  - question: "Include decision records?"
    header: "ADRs"
    options:
      - label: "No"
        description: "Present-tense documentation only"
      - label: "Yes"
        description: "Adds an adr-writer slot and a history-scope question"
    multiSelect: false
```

**Wiring:**

- *Coverage = Named subsection* → the subsection name scopes the domain split, and the
  writer table is checked for disjointness against any prior run's persisted args
  (§Args file).
- *Audience* biases the split, not the writer count: Contributor weights the reference
  writer's file allocation upward; Integrator weights the core and feature writers.
- *ADRs = Yes* → run the decision-inventory pre-flight (SKILL.md Step 1.5) and add the
  `adr-writer` slot, which counts against the 5-writer ceiling. Follow up
  conversationally for `history_scope` (release tag, commit count, or date).

**No plan:** if Gate A ran because no plan exists, stop after it. Hand the answers to
`writing-plans` and re-invoke doc-build against the plan it produces. Do not proceed to
Gate B — a domain split derived from a conversation rather than a written plan has no
artifact the writers can read.

---

## Gate B: Split

**Fires when:** `--interactive` is set, or a fail-loud condition names it.

This is the highest-value gate. The domain split determines whether writers can ground
their claims, and it is the one pre-flight output the user is better positioned to judge
than inference is.

**Present first, ask second.** Print the computed partition as a table before asking
anything:

```
Proposed split — {N} writers

| Writer | Writes | Reads | Boundary rationale |
|---|---|---|---|
| core-writer | {files} | {source} | {why the boundary falls here} |
| ... | | | |

Disjointness: files_to_write disjoint across all writers; source_files disjoint
across prose writers (the ADR writer, if present, reads history across domains
by design).
Unassigned plan pages: {list, or "none"}
```

**Then one question** (the tool adds an "Other" option automatically — do not supply
one; free-text through it captures a custom partition):

```yaml
question: "Does this split hold?"
header: "Split"
options:
  - label: "Accept"
    description: "{N} writers as shown"
  - label: "Merge two domains"
    description: "Fewer, broader writers"
  - label: "Split a domain"
    description: "One writer's scope is too wide"
multiSelect: false
```

**On any answer other than Accept:** recompute and re-present the table. Do not ask a
second structured question about the same partition — showing the revised split
communicates more than another set of options, and the user has already stated the
direction of the change.

**On unassigned plan pages:** ask conversationally whether to drop them, reassign them to
a named writer, or accept them as narrative pages with no source domain. Do not leave a
page unassigned at invocation — the scaffold agent will stub it, no writer will fill it,
and it surfaces as a stub in the audit rather than as a decision.

---

## Gate C: Finish line

**Fires when:** `--interactive` is set.

Choices that are cheap now and expensive after a background run completes.

```yaml
questions:
  - question: "Writing register?"
    header: "Register"
    options:
      - label: "Default"
        description: "Writers use the built-in quality bar"
      - label: "Objective spec, polish pass"
        description: "Fresh agents apply polish.md after the build; one extra commit"
    multiSelect: false

  - question: "After the build?"
    header: "Follow-up"
    options:
      - label: "Audit"
        description: "Three read-only reviewers, PASS / PASS WITH NOTES / FAIL verdict"
      - label: "Stop and report"
        description: "Decide when you see the result"
    multiSelect: false
```

**Push is not offered here.** The skill proposes push on explicit ask only.
Pre-authorising a push before a background run has produced anything removes the point at
which the user sees what would be pushed.

---

## What not to ask

| Item | Why not | Instead |
|---|---|---|
| `new_page_globs` | Derived from the split; the user has no better information | Derive, show in manifest |
| `commit_message` per writer | Convention-driven (`docs(core): …`) | Derive, show in manifest |
| `build_cmd` | Usually detectable from the project | Detect; ask only on zero or multiple candidates |
| `is_git`, `repo_root`, `docs_root` | Facts, not preferences | Resolve, show in manifest |
| Per-file assignments | Output of the split, not an input to it | Gate B operates on domains |

Asking about any of these converts a confirmation into an interrogation, and trains the
user to accept the manifest without reading it — which defeats the manifest.

---

## Manifest

Print the fully resolved args and take one explicit confirmation before writing the args
file and invoking.

```
## doc-build {feature} — ready to invoke

Plan:       {plan_path}   (sha256 {short-hash}, stamped into the args file)
Build:      {build_cmd}   ({tool} {version}, verified installed)
Docs root:  {docs_root}
Repo:       {repo_root}   (git: {yes/no}, HEAD {short-hash}, unmerged paths: {none/list})
Register:   {default | objective-spec polish pass}
Follow-up:  {audit | stop and report}

| Writer | Files | Source files | Commit message |
|---|---|---|---|
| {name} | {N} | {N} | {message} |

new_page_globs: {list}
Sequential-run context: {prior subsections from persisted args, or "first run"}

Proceed?
```

Rationale: the run is expensive and asynchronous. A wrong `build_cmd` is not discovered
until the scaffold gate fails, several minutes in. The manifest is the last point at
which a wrong argument costs nothing.

Take a plain confirmation, not an `AskUserQuestion` — a yes/no is faster asked directly.
On yes: write the args file, then invoke `Workflow()` immediately. On no (or "later"):
write the args file anyway and stop — a later plain `/doc-build <plan>` finds it and
launches from it without re-running the gates.

---

## Args file

The flag's durable output. At manifest confirmation, write the resolved args to:

```
docs/plans/YYYY-MM-DD-<feature>/doc-build-args.json
```

Contents: the exact `Workflow()` args object, plus a `_provenance` block — plan-file
sha256, HEAD commit at confirmation, confirmation timestamp, and the Gate A/C answers.

**Staleness check** (performed by any invocation that consumes the file):

- **Plan hash mismatch** — the plan changed after confirmation. Hard: default mode
  stops naming the drift; `--interactive` re-runs Gate B against the revised plan
  (Gate A/C answers carry over unless the plan's scope changed).
- **HEAD drift** — the repo moved on. Soft: proceed, but surface the drift in the
  launch report; a large drift is grounds to re-confirm the split manually. (For an
  ADR writer, HEAD drift also moves the candidate inventory — re-check it.)

**Three uses:**

1. **Launch and resume.** A plain invocation launches from the file without gates; a
   `resumeFromRunId` relaunch after a transient failure reads it instead of re-running
   the pre-flight.
2. **Sequential runs.** A second invocation on the next subsection reads the prior
   writer table and checks cross-invocation disjointness — the gap the 5-writer ceiling
   otherwise leaves to the user. A detected collision is a fail-loud condition in
   default mode and a Gate B re-present under `--interactive`.
3. **Audit.** `accuracy-checker` needs the domain split for its sampling; reading it is
   more reliable than reconstructing it from commit history.

The doc-build workflow's commits are all pathspec-scoped, so the file can never leak
into a docs commit. Whether the host project commits plan directories varies; committing
the args file is the user's call, on explicit ask.

Record the Gate A and Gate C answers in `.claude/memorybank/` if that directory exists.
Skip silently if it does not — the gates function without it.

---

## Post-run branch

The one decision point after the workflow returns. Applies to `SKILL.md` Step 3, and
fires only when a user is present to answer — an autonomous session just reports.

| Returned status | Interactive behaviour |
|---|---|
| `complete` | Offer only what Gate C did not settle. If Gate C selected audit, run it; do not re-ask. |
| `complete_with_issues` | Report gaps, dead writers, and skipped commits **first**, as Step 3 already requires. Then ask: resume after fixing a named cause / accept and proceed to polish or audit / stop. |
| `failed` at the scaffold gate | Do not ask. The cause is a config or plan defect, it is named in `build_errors`, and there is one correct action. |
| `failed` with all writers dead | Do not ask. Report `dead_writers` and the journal path; the decision requires evidence the user does not yet have. |

The general rule: offer a choice only where more than one action is defensible on the
evidence already reported. A question asked where the answer is determined reads as
process rather than help.

---

## Summary

`--interactive` moves five inferences — scope, split, unassigned pages, register, and
follow-up — from guess to answer, confirms them in one manifest, and persists them as
`doc-build-args.json`; execution consumes the file and never asks, in any mode. It
touches Step 1 and Step 3 of `SKILL.md`. It does not touch `workflow.js`, the role
prompts, the schemas, `build.md`, `audit.md`, or `polish.md`, and both paths produce the
same args object.
