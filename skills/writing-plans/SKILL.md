---
name: writing-plans
description: "Use when leaving planning for execution and a grounded design + task-by-task implementation plan must land in docs/plans/YYYY-MM-DD-<feature>/ (design.md + plan.md). Works from an approved spec/contract, or writes design.md first from codebase analysis if none exists. Symptoms - ready to implement, contract-driven-planning just emitted designs+contract, /plan identified a phase that needs detailed breakdown, or a plan is about to be finalized via ExitPlanMode/inline chat (use this instead)."
---

# Writing Plans

## Overview

Translate an approved spec, design doc, or contract into a concrete implementation plan that another agent (or a future session) can execute without re-reading the source codebase. The plan is the handoff artifact between *deciding what to build* and *building it*.

This skill is the spec→plan-document step. It is **not** the same as `/plan`:

| Skill | Scope | Output |
|---|---|---|
| `/plan` | Whole-project roadmap from memory bank | Updates `.claude/memorybank/session.md` |
| `writing-plans` (this skill) | Single feature/component, spec→tasks | `design.md` + `plan.md` in `docs/plans/YYYY-MM-DD-<feature>/` |
| `contract-driven-planning` | Multi-component design + contract | Designs + contract; then invokes this skill per component |

## When to Use

- An approved design doc or spec exists (from brainstorming, `/clarify`, or `contract-driven-planning`)
- OR requirements are clear but no design doc exists yet — this skill writes `design.md` first (see "design.md — When No Approved Spec Exists"); if requirements themselves are unclear, use `/clarify` first
- You are about to leave planning and start execution
- The work will span multiple files / sessions / agents and needs a written handoff
- A `/plan` phase needs to be decomposed into concrete tasks before dispatching waves

**When NOT to use:**

- Single trivial edit (just do it)
- The spec is still being negotiated (use `/clarify` first)
- You're mid-execution and the plan already exists (update it inline, don't rewrite)

## Output Location

```
docs/plans/YYYY-MM-DD-<feature>/design.md
docs/plans/YYYY-MM-DD-<feature>/plan.md
```

- One directory per feature — `design.md` (the grounded design/spec) and `plan.md` (the task breakdown) live together, so the dir is a self-contained handoff artifact
- Multi-component features (from `contract-driven-planning`): designs and contract sit in the same dir; one `<component>-plan.md` per component replaces the single `plan.md`
- Plan dirs are typically **gitignored**; the committed index is `docs/plans/progress.md` (append a row pointing to the new dir)
- If `docs/plans/` doesn't exist in this project, create it
- Plans are finalized as these files — never via ExitPlanMode or inline in chat (see global CLAUDE.md § Planning / Workflow)

## design.md — When No Approved Spec Exists

If no approved spec or design doc exists yet, do not skip to tasks. First analyze the codebase and write `design.md` in the same directory:

- Ground every claim in current source — file:line references, or commands re-run locally
- **Re-derive all numbers** (counts, coverage, sizes, timings) from source; never copy them from orphaned prototypes, prior session outputs, or chat context
- State the approach, key decisions, and explicit out-of-scope items
- Get the design approved (explicit "proceed") before writing `plan.md`

If an approved spec already exists elsewhere (e.g. from `contract-driven-planning`), reference its path in the plan header as usual — no duplicate `design.md` needed.

## progress.md — Plan-Local Tracker (Multi-Wave Plans)

If the Execution handoff is a wave skill (`orchestrating-agent-waves` or `autopilot-waves`), scaffold a plan-local `progress.md` in the plan directory **at plan-save time**. The executor updates it at every wave close — this skill only creates it, pre-filled from the plan:

```
docs/plans/YYYY-MM-DD-<feature>/
├── design.md      # grounded design/spec
├── plan.md        # task breakdown (<component>-plan.md per component if multi-component)
└── progress.md    # plan-local tracker — scaffolded here, updated by the executor
```

Scaffold structure (matches what the wave skills expect — see `orchestrating-agent-waves` § "progress.md — Wave-Level Tracking" and `autopilot-waves` § "Plan-local progress tracker"):

```markdown
# <Feature> — Progress

Last updated: YYYY-MM-DD

## Planning Phase (complete)

| Deliverable | Status |
|-------------|--------|
| Design | Done → `design.md` |
| Plan | Done → `plan.md` |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| (seed from design.md's key decisions) | | |

## Implementation Phase

| Wave | Agents | What | Status |
|------|--------|------|--------|
| (one row per wave/phase from plan.md, all Pending) | | | Pending |
```

- **Distinct from the top-level index.** `docs/plans/progress.md` is the committed index across plans; the plan-local `progress.md` is the live-state cache for one plan and lives inside the (typically gitignored) plan dir. Complementary, not redundant.
- **Skip for inline execution.** Single-session plans (<5 sequential tasks, no waves) don't need it — `plan.md`'s status indicators suffice.

## Plan Document Header

Every plan starts with this header:

```markdown
# <Feature Name> Implementation Plan

**Source spec:** `<path/to/design.md>` (or contract: `<path/to/contract.md>`)
**Goal:** <one sentence — what this builds>
**Architecture:** <2-3 sentences — approach, tech stack, key decisions>
**Out of scope:** <explicit deferrals — what this plan does NOT cover>

**Execution handoff:** <which orchestration skill — see Execution Handoff section>

---
```

The **Out of scope** line is load-bearing. Silent scope reduction is a refused pattern — deferrals must be explicit so they can be challenged. If the spec authorizes a clean rewrite, say so here; downstream tasks should not include compatibility shims or migration scaffolding the user did not ask for.

## File Structure

Before defining tasks, list every file that will be created or modified, and what each one owns. This is where decomposition gets locked in.

```markdown
## Files

- **Create:** `backend/scripts/seed_widgets.py` — one-off seeder, deleted after run
- **Modify:** `backend/models/widget.py` — add `archived_at` column + index
- **Modify:** `backend/api/widgets.py:42-78` — extend list endpoint with archive filter
- **Create:** `tests/api/test_widgets_archive.py` — endpoint test against real DB
```

Rules:

- One responsibility per file. Split by responsibility, not by layer.
- In existing codebases, follow established patterns. If a file you're touching is unwieldy, a split is reasonable — call it out as its own task.
- Inline-script threshold: investigation / data-fix / test logic ≥ 3 lines or anything mutating on-disk state → write a real file under `backend/scripts/` (or project equivalent), not a heredoc.

## Approval Gates (Flag, Don't Assume)

The following changes require explicit user approval **regardless of plan size**. Mark them with `<APPROVAL-GATE>` in the plan; the executor must stop and confirm before crossing them:

- New API endpoints
- New engine / service-layer methods on shared abstractions
- Schema / ORM / migration changes
- Dependency additions or version bumps
- Anything that changes a public contract

Mark like this in the task list:

```markdown
### Task 3: Add `/widgets/archive` endpoint  <APPROVAL-GATE>

This adds a new backend surface. Confirm before implementing.
```

## Task Structure

Each task is a self-contained chunk of work that ends in a verified, committable state. Each step inside a task is 2–5 minutes of execution.

````markdown
### Task N: <Component Name>

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test_thing.py`

**Depends on:** Task N-1 (or `—` if none)
**Status:** ○ pending

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = widget_archive(widget_id="w1", at=fixed_now())
    assert result.archived_at == fixed_now()
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `uv run pytest tests/api/test_widgets_archive.py::test_specific_behavior -v`
Expected: FAIL — `widget_archive` not defined

- [ ] **Step 3: Minimal implementation**

```python
def widget_archive(widget_id: str, at: datetime) -> Widget:
    widget = Widget.get(widget_id)
    widget.archived_at = at
    widget.save()
    return widget
```

- [ ] **Step 4: Re-run and confirm pass**

Run: `uv run pytest tests/api/test_widgets_archive.py -v`
Expected: PASS

- [ ] **Step 5: Verify gate**

- `uv run pytest` — full suite passes
- (Frontend tasks: `npm run build` — required; `tsc --noEmit` alone is insufficient)
- (Docs tasks: `uv run quarto render` — no warnings)

- [ ] **Step 6: Commit (atomic)**

```bash
git add backend/models/widget.py backend/api/widgets.py tests/api/test_widgets_archive.py
git commit -m "feat(widgets): add archive endpoint"
```

If the verify gate surfaced fixes, those are a **separate commit** — never bundle deliverable + fix.
````

## Phase Gates (Not Just Task Gates)

When tasks span a contract boundary (producer → consumer, backend → frontend, schema → renderer), the phase that ships the boundary MUST include a cross-boundary test that pushes a representative seeded artifact through the producer's full pipeline into the consumer's actual validator. See `contract-driven-planning` § "Contract Enforcement: The Lock-Step Test".

**Partial-green is not green.** A phase is not complete when its unit tests pass — it is complete when an end-to-end exercise of its deliverable against the real downstream consumer passes. If a phase ships intentional stubs, the un-stub task is listed explicitly as a follow-up in `docs/plans/progress.md` — never silently rolled into a later phase.

## No Placeholders

Every step must be executable as-written. These are plan failures:

- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "handle edge cases" without showing what
- "Write tests for the above" without actual test code
- "Similar to Task N" — the executor may read tasks out of order; repeat the code
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Status Indicators

Use the same indicators as `/plan` for consistency across both skills:

| Indicator | Meaning |
|---|---|
| ○ | Pending |
| ◐ | In progress |
| ● | Complete |
| ⊘ | Blocked |
| ↷ | Deferred (recorded in progress.md) |

## Self-Review

After writing the plan, re-read the source spec with fresh eyes and check:

1. **Spec coverage** — point to a task for every requirement. List any gaps. Add tasks for them.
2. **Placeholder scan** — search for the "No Placeholders" patterns above. Fix inline.
3. **Type / name consistency** — `clearLayers()` in Task 3 and `clearFullLayers()` in Task 7 is a bug. Names must match across tasks.
4. **Approval gates flagged** — every backend surface change has `<APPROVAL-GATE>`.
5. **Verify gates present** — every task has a Step that runs the appropriate verify command (`uv run pytest`, `npm run build`, `uv run quarto render`, etc.).
6. **Out-of-scope honest** — anything the spec asked for that this plan defers is in the "Out of scope" line of the header, not silently dropped.
7. **Grounding** — every number, count, or claim in `design.md`/`plan.md` traces to a file:line reference or a locally re-run command. Nothing inherited from orphaned prototypes, prior sessions, or chat context.

Fix issues inline; no need to re-review.

## Memory Bank Sync

After saving the plan:

- **`session.md`** — under "Current Plan", add a one-line pointer: `docs/plans/YYYY-MM-DD-<feature>/plan.md (<N tasks, M phases>)`
- **`progress.md`** — only if this is a significant new direction, add a "Planning" entry under the current session
- **`docs/plans/progress.md`** — append a row: `| YYYY-MM-DD | <feature> | <component> | <status> |` (top-level index across plans — distinct from the plan-local `progress.md` inside the plan dir)

## Execution Handoff

After saving, recommend the right execution skill — don't auto-dispatch. The user picks.

| Situation | Recommend |
|---|---|
| 10+ tasks, multi-phase, intra-phase parallelism, user is at the keyboard | `orchestrating-agent-waves` |
| Same as above, user authorized auto-proceed across waves | `autopilot-waves` (delta on waves) |
| Tasks need agents to coordinate / validate each other / share state | `spawn-team` |
| <5 sequential tasks, single feature, user wants to drive | inline execution (no orchestration skill needed) |
| Any of the above | **prerequisite:** `agent-preflight` per dispatch |

Format the handoff like this:

```
Plan saved: docs/plans/2026-05-21-widget-archive/backend-plan.md
- 4 phases, 11 tasks, 2 approval gates
- Plan-local progress.md scaffolded (4 waves pending)
- Suggested execution: orchestrating-agent-waves (Phases 2 & 3 have parallel tasks)
- Prerequisite: agent-preflight before each dispatch

Proceed?
```

Wait for explicit `proceed` / `yes` before launching anything. After-plan-mode handoff is a hard gate — see global rules.

## Quick Reference

| Step | Action |
|---|---|
| 1 | Confirm spec/design is approved — if none exists, write `design.md` from codebase analysis and get it approved first |
| 2 | Output path: `docs/plans/YYYY-MM-DD-<feature>/design.md` + `plan.md` (`<component>-plan.md` per component if multi-component) |
| 3 | Write header (Goal / Architecture / Out of scope / Execution handoff) |
| 4 | List Files section — exact paths, responsibilities |
| 5 | Decompose into phases → tasks → 2-5 min steps |
| 6 | Flag `<APPROVAL-GATE>` on backend surface changes |
| 7 | Include verify gate + atomic commit step in every task |
| 8 | Multi-wave plan → scaffold plan-local `progress.md` (all waves Pending) |
| 9 | Self-review (7 checks above) |
| 10 | Update memory bank + top-level `docs/plans/progress.md` index |
| 11 | Recommend execution skill; wait for `proceed` |

## Key Principles

- **Spec→tasks, not spec→prose.** Each step is an action with the code or command in-line.
- **Verify before commit, always.** Every task's last step before commit runs the project's verify command.
- **Atomic commits.** Deliverable / verification fixes / improvements = separate commits.
- **Flag approval gates; don't assume.** Backend surface changes wait for explicit go-ahead.
- **Out of scope is explicit.** Silent scope reduction is a refused pattern.
- **Plan in `docs/plans/`, index in `docs/plans/progress.md`.** Memory bank gets a pointer, not the plan.
- **Hand off, don't dispatch.** Recommend the orchestration skill; user says proceed.
