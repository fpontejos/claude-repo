# Postmortem-Lite Template

Inline triage emitted by the autopilot loop after retries-exhausted. Prints **after** the escalation block from `failure-patches.md` and **before** the loop stops. The user reads both together and decides next steps.

**Constraints:**

- **≤ 20 lines total.** Hard cap. If you can't say it in 20 lines, the situation needs the full `postmortem` skill, not this template.
- **No file output.** This is inline text only. No `docs/reports/postmortem/*.md`.
- **No subagent dispatch.** The orchestrator writes this from the wave state it already has (two attempts' modes, patches, results, evidence).
- **Step 1 of `postmortem` only.** Triage classification, no 5 Whys, no SRE report, no timeline reconstruction.
- **No fix proposals beyond the routing recommendation.** The user decides; this template only routes.

## Output template

Print this block verbatim with `{placeholders}` filled. Keep section headers exactly as shown — the user scans for them.

````markdown
## Postmortem-lite — Wave {N}

**Category:** {agent | code-logic | team | infra}
**Triage signal:** {one-line summary of what the two failures have in common, or "modes diverged" if they don't}

**Attempt 1 → Attempt 2:**
- `{mode_1}` → `{mode_2}`  ({"same mode" | "different modes" | "escalated on safety check"})
- Load-bearing evidence: `{file}:{lines}` — {one phrase}

**Why this exited the loop:**
{one of:
  - "Same mode twice — prompt patch from failure-patches.md was insufficient."
  - "Different modes — wave design is the likely cause, not the dispatch."
  - "Safety check fired — {gate gap | legitimate refusal | scope expansion needed | low-confidence verdict}."}

**Routing recommendation** (user picks one):
- **A.** Edit `waves.md` — wave {N} needs re-scoping or splitting.
- **B.** Edit `agent-plan.md` — execution rules need to change (e.g., add cross-boundary test to gate).
- **C.** Expand SCOPE CONTRACT and re-approve — the wave needs paths it doesn't currently have.
- **D.** Run full `/postmortem` — situation exceeds 20-line triage budget.
- **E.** Accept partial completion — close wave {N} with what shipped, document the gap.

**State preserved:** Wave {N} not committed. Retry count reset on next `proceed`.
````

## Routing options — what each means

- **A (re-scope wave):** Use when modes diverged or the wave attempted too much. Editing `waves.md` lets the user split a too-large wave into two or change its acceptance criteria.
- **B (execution rules):** Use when the gate itself was the problem — unit-tests-only when cross-boundary needed, missing integration test, wrong test runner. Edit `agent-plan.md`.
- **C (scope expansion):** Use when a `scope_creep` patch hit its escalation condition (`BLOCKED: scope conflict`). The user reviews and may approve a wider boundary, which requires a new SCOPE CONTRACT approval.
- **D (full postmortem):** Use when the triage block keeps wanting to grow past 20 lines, or when the same failure pattern is showing up across multiple sessions (memory bank check warranted).
- **E (accept partial):** Use when the wave's incomplete output is still net-positive and the remaining work can be tracked as a follow-up (file via `/chore` or `/file-issue`).

## Anti-patterns

| Don't | Do instead |
|---|---|
| Exceed 20 lines to "be thorough" | Route to option D (full postmortem) |
| Propose a specific code fix | Patches are gone; modes failed twice. The user redesigns. |
| Re-dispatch the verifier or another classifier | Both attempts' modes are already in wave state — use them |
| Write a markdown file | Inline only; full postmortem writes files |
| Recommend "just try again" without changing anything | Same prompt + same plan = same failure |
| Hide the load-bearing evidence | Keep `{file}:{lines}` line; it's what the user verifies |

## When to escalate from postmortem-lite to full `postmortem`

If, while filling out this template, you find that:

- The triage signal needs more than one sentence to explain, OR
- The load-bearing evidence spans more than 2-3 files, OR
- Modes diverged AND neither has a clean routing recommendation, OR
- The pattern matches a recurring issue logged in `~/.claude/projects/*/memory/`,

→ Route to option D and stop. The full `postmortem` skill exists for these.

## Example (filled)

```markdown
## Postmortem-lite — Wave 3

**Category:** agent
**Triage signal:** Same mode twice — `scope_creep` patch did not bind the agent.

**Attempt 1 → Attempt 2:**
- `scope_creep` → `scope_creep`  (same mode)
- Load-bearing evidence: `frontend/src/pages/foo/index.tsx:1-40` — agent rewrote sibling page outside allowed paths both times.

**Why this exited the loop:**
Same mode twice — prompt patch from failure-patches.md was insufficient.

**Routing recommendation** (user picks one):
- **A.** Edit `waves.md` — wave 3 needs re-scoping or splitting.
- **B.** Edit `agent-plan.md` — execution rules need to change.
- **C.** Expand SCOPE CONTRACT and re-approve.
- **D.** Run full `/postmortem`.
- **E.** Accept partial completion.

**State preserved:** Wave 3 not committed. Retry count reset on next `proceed`.
```

That example is 18 lines — at budget. If your situation needs more, route to D.
