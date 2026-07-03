---
name: postmortem
description: Use when something failed — agent got stuck, team coordination broke down, tests broke, pipeline errored, server wouldn't start — and you need to understand why. Also use when another skill recommends it after detecting a failure.
---

# Postmortem: $ARGUMENTS

Analyze a failure through triage-first adaptive investigation. Quick classification decides depth — trivial failures get an inline fix, complex ones get subagent investigation and a structured report.

## Step 1: Triage (inline, no subagents)

Read conversation context. Classify the failure:

| Category | Signals | Route |
|----------|---------|-------|
| **Trivial** | Typo, missing permission, wrong port, obvious config error | Inline fix + optional chore |
| **Agent/logic** | Agent stuck, wrong output, went off-task, rationalized past instructions, test failures, algorithm bug | 5 Whys (Step 2a) |
| **Infra/pipeline** | DB permissions, server won't start, dependency mismatch, build broke, CI failed | SRE Report (Step 2b) |
| **Team coordination** | Role boundary violation, file ownership conflict, communication breakdown | 5 Whys (Step 2a) |

**Decision rule:** *Why something did the wrong thing* → 5 Whys. *Why something couldn't run at all* → SRE Report.

**If trivial:** Print the fix, file a `/chore` if it's a recurring pattern, stop. No report needed.

## Step 2: Investigate (subagents, parallel)

Dispatch Explore subagents in parallel to gather evidence. DO NOT analyze from memory alone — read actual files.

**Subagent 1 — Timeline:** Read conversation history, git log, agent messages. Produce ordered timeline of events.

**Subagent 2 — Evidence:** Read source files at fault, test output, server logs (`/tmp/*.log`), task list state. Produce evidence with file:line references.

**Subagent 3 — Context** (agent/team failures only): Read active skill files, CLAUDE.md, HANDOFF.md. Produce gap analysis: what instructions existed vs what the agent did.

## Step 3: Report

Synthesize subagent findings into the routed template. Save to `docs/reports/postmortem/YYYY-MM-DD-<slug>.md`.

**Keep reports short.** Under 50 lines. 3-5 action items max. If you're writing 10 action items for a 1-line bug, you're over-engineering.

### 5 Whys Template (agent + code/logic + team failures)

```markdown
# Postmortem: <title>
**Date:** YYYY-MM-DD  **Category:** agent | code-logic | team  **Severity:** low | medium | high

## What Failed
One sentence: expected vs actual.

## Timeline
- HH:MM — <event> (source: git/conversation/log)

## 5 Whys
1. **Why did it fail?** — <direct cause>
2. **Why?** — <contributing factor>
3. **Why?** — ...
4. **Why?** — ...
5. **Why?** — <root cause>

## Root Cause
Single paragraph. The systemic issue, not the symptom.

## Action Items
- [ ] <fix> — filed as chore #NN
```

### SRE Report Template (infra + pipeline failures)

```markdown
# Postmortem: <title>
**Date:** YYYY-MM-DD  **Category:** infra | pipeline  **Severity:** low | medium | high

## Summary
What broke, impact, duration.

## Timeline
- HH:MM — <event>

## Root Cause
What environmental/config/infra condition caused the failure.

## Resolution
What fixed it (or what would fix it).

## Prevention
How to prevent recurrence.

## Action Items
- [ ] <fix> — filed as chore #NN
```

## Step 4: File Chores

Each action item gets filed via `/chore` with:
- Reference to the postmortem report path
- Priority from severity: high → `!high`, medium → default, low → `!low`

Example: `/chore "Fix sid_height calculation — see docs/reports/postmortem/2026-02-15-overlapping-bubbles.md (!high @bugfix)"`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Analyzing from memory without reading files | Always dispatch evidence-gathering subagents |
| Writing 10+ action items for a simple bug | 3-5 max. YAGNI applies to postmortems too |
| Skipping triage, going straight to deep analysis | Trivial failures don't need a report |
| Same analysis format for all failure types | Route: logic failures → 5 Whys, infra → SRE |
| Action items as prose that nobody tracks | File as `/chore` entries — they surface in `/review` and `/handoff` |
