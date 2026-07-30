---
name: agent-preflight
description: Use before any Agent/Task tool dispatch — verify required tools, pick the correct subagent_type, and apply silent-failure + scope-drift detection on return. Required prerequisite for orchestrating-agent-waves and spawn-team. Symptoms - about to call Agent or Task tool, dispatching a sub-agent for any reason, or a previous dispatch returned empty / drifted / failed and needs re-dispatch.
---

# Agent Preflight

## Overview

Every Agent/Task dispatch goes through three gates: **before launch** (preflight), **after return** (post-flight), and **on failure** (classify + retry). Skipping these gates is the root cause of recurring dispatch failures: agents launched without required tools, empty returns misread as user rejection, scope creep landing silent edits in wrong files.

This skill owns the dispatch hygiene rules. The orchestration skills (`orchestrating-agent-waves`, `spawn-team`) handle the *what* and *when*; this skill handles the *how* of each individual Agent call.

## When to use

- **Always**, before any call to the `Agent` or `Task` tool.
- **Always**, after such a call returns — even if it looks successful.
- When a dispatch failed and you're deciding whether to retry.

Skip only for tools that are not Agent/Task dispatches (Read, Edit, Bash, etc).

---

## Gate 1: Pre-Flight Checklist

Before emitting an `Agent(...)` or `Task(...)` call, confirm each item. If any answer is "unknown", stop and resolve before dispatching.

### 1.1 Required tools declared

State explicitly which tools the agent needs:

- **Read-only research?** → `Read`, `Grep`, `Glob`, optionally `WebFetch`, `WebSearch`
- **Will produce a file?** → must include `Write`
- **Will edit existing files?** → must include `Edit`
- **Will run tests / git / shell?** → must include `Bash`

The single most common silent failure is dispatching an agent that needs `Write` to a subagent_type that lacks it. Do not skip this check.

### 1.2 subagent_type matches required tools

| Need | Use |
|---|---|
| Read-only codebase search, no edits | `Explore` (read-only by design) |
| Plan/design only, no code changes | `Plan` |
| Produces files, runs tests, general work | `general-purpose` |
| Named specialist (e.g. `react-specialist`, `postgres-pro`) | Check its tool list in its `.md` file first |

Mismatches: do not dispatch `Explore` for a task that needs to write a file — it will produce text in its response but never create the file. Do not dispatch `Plan` and then expect edits.

### 1.3 Output contract is concrete

Before dispatching, state in one line:

- **What artifact must exist on success?** (file path, or "summary in returned text")
- **What is the expected length / shape?** (rough word count, sections, structure)
- **What does failure look like?** (empty return, missing file, wrong scope)

If the agent's only deliverable is "text in the response", that's fine — but say so explicitly so post-flight checks the right thing.

### 1.4 Scope is bounded

- **Allowed paths:** which directories/files may the agent create or modify?
- **Off-limits paths:** anything outside the worktree, gitignored docs/plans, packages it doesn't own.
- **No dependencies on conversation context** the agent can't see — pass facts explicitly in the prompt.

### 1.5 Prompt is self-contained and bounded

- Target ≤ 10K tokens of prompt input.
- Briefs the agent like a smart colleague walking in cold: goal, what's been ruled out, exact file paths.
- Tells the agent what *not* to do as well as what to do (see anti-patterns).
- For one-shot tasks: states the expected output format and length.

### 1.6 Fresh agent (default)

Spawn a fresh agent unless explicitly continuing prior work via `SendMessage`. Resumed agents accumulate context and degrade in quality.

`SendMessage` is a **deferred** tool — its schema is not in the base toolset. Run `ToolSearch("select:SendMessage")` before the first call, or it fails with `InputValidationError`.

### 1.6b Dispatch mode: background vs foreground (decide explicitly)

**The Agent tool backgrounds by default.** From the tool description: *"Subagents run in the background by default; you'll be notified when one completes. Pass `run_in_background: false` for a synchronous run when you need the result before continuing."*

State which mode you want before dispatching — never leave it implicit:

| Situation | Setting |
|---|---|
| You need the result before you can continue (wave workers, verifiers, anything you will gate on) | `run_in_background: false` **explicitly** |
| Genuinely fire-and-forget work you will pick up from a later notification | omit the flag (background) |

Omitting the flag when you meant foreground is the most common cause of *"the agent went idle and never delivered its report"*: the agent detaches, the orchestrator moves on without a result, and under the agent-teams harness the detached agent lingers as a teammate instead of reaping. See `orchestrating-agent-waves` §Dispatch Model.

Two corollaries:

- **A pending agent is not a failed agent.** If a background dispatch has not reported yet, do not classify it, do not re-dispatch it, and never write the completion notification yourself. Wait for the notification.
- **Passing a `name` keeps the agent alive** and addressable via `SendMessage`. Omit `name` for throwaway workers.

### 1.7 Runtime budget for long commands (>100s)

If the task includes any command expected to run >100s (full test suites, builds, bakes):

- **State the expected runtime and the required Bash `timeout` value in the prompt.** The harness silently auto-backgrounds any foreground Bash call that exceeds its default 120s timeout ("Command did not complete within its 120s timeout and was moved to the background (ID: …)") — subagents then end their turn "waiting" and never deliver their report.
- **A command expected to exceed 600s (the max foreground timeout) must NOT be assigned to a subagent as a foreground gate at all** — it is structurally impossible to complete as instructed. Keep it orchestrator-owned, or split it into scoped selections the agent can finish.
- Tell the agent: if a command is auto-backgrounded, never re-issue it unchanged — raise `timeout`, narrow scope, or report back.

(Origin: a wave that stalled three times on a ~615s full-suite gate assigned to a subagent as a foreground command.)

---

## Gate 2: Post-Flight Check

Run these checks when the agent's result is **actually in hand**, before acting on it. When that moment arrives depends on the dispatch mode chosen in Gate 1.6b:

- **`run_in_background: false`** → the result returns inline as the tool result. Check it immediately.
- **Background dispatch** → there is no inline return. The result arrives later as a task notification. Gate 2 fires **on the notification**, not on the dispatch call.

**Do not run Gate 2 against a still-pending agent.** An agent that has not reported yet has not failed — it has not finished. Treating "no result yet" as `silent_failure` produces a spurious re-dispatch and a duplicate agent. If you need to inspect a background agent mid-flight, load and use `TaskOutput` / `TaskList` (`ToolSearch("select:TaskList,TaskOutput")`) rather than inferring.

### 2.1 Output present?

- **Empty/null return** → this is a **silent failure**, not a user rejection. Do not interpret as "the user said no". Re-dispatch (see Gate 3).
- **Truncated output** (ends mid-sentence, tool result cuts off) → silent failure, re-dispatch with smaller scope.
- **Output exists but says "I cannot do this"** → the agent refused; read the reason, do not blindly retry.

### 2.2 Declared artifact exists?

If the preflight contract said "agent writes `path/to/foo.md`":

- Run `ls path/to/foo.md` or equivalent. If missing despite "success" → silent failure: the agent likely lacked `Write` or wrote to the wrong place.
- If the file exists but is empty or stub-only → scope/quality failure, not silent.

### 2.3 Scope respected?

Diff the actual changes against the declared allowed paths. If the agent edited off-limits files → scope creep; revert, re-dispatch with tighter scope.

### 2.4 Output quality plausible?

Eyeball: does it match the expected length and shape from the contract? A 100-word response when 1000 was expected is a failure signal even if non-empty.

---

## Gate 3: Failure-Mode Classification & Retry

If Gate 2 finds a problem, classify before retrying. Apply the matched fix. Cap at **2 retries** before escalating to the user.

### Failure-mode taxonomy

| Mode | Symptoms | Fix |
|---|---|---|
| `silent_failure` | Empty return, no artifact, no error text | Fresh agent, same prompt, log the empty return in your reply to the user so they know it happened. First rule out `detached_dispatch` below — a pending agent is not an empty one |
| `detached_dispatch` | No result at all; the agent is still listed as running/idle in `TaskList`; `run_in_background` was omitted on a call you meant to be synchronous | Not a failure — the agent was backgrounded by default (Gate 1.6b). Wait for its notification, or `TaskStop` it and re-dispatch with explicit `run_in_background: false`. Do NOT classify as `silent_failure` and do NOT re-dispatch a second concurrent copy |
| `permission_gap` | Output describes what it *would* do, but file missing | Check `subagent_type` tool list — was `Write`/`Edit`/`Bash` missing? Re-dispatch with correct type |
| `wrong_tool` | Agent used `cat` instead of Read, `find` instead of Glob, etc. | Prompt explicitly: "Use Read tool, not bash cat. Use Glob, not find." Re-dispatch fresh |
| `scope_creep` | Agent edited files outside allowed paths | Revert those edits, re-dispatch with explicit "DO NOT touch X, Y, Z" |
| `context_overflow` | Truncated output, "I'll continue in next response", agent hit limits | Smaller scope per dispatch; split into two agents with distinct files |
| `timeout_stall` | Final message is "waiting for background task …"; Bash result shows "moved to the background" | NOT agent-chosen backgrounding — the harness timed out a foreground call (Gate 1.7). Take over the long command yourself, or re-dispatch with an explicit `timeout` / narrower gate. Do not instruct "don't spawn background jobs" — the agent never did |
| `wrong_understanding` | Output is coherent but solves a different problem | Prompt was ambiguous — rewrite with concrete examples, file paths, expected output sample |
| `quality_below_bar` | Output exists, in scope, but shallow / generic | Add specificity to the prompt: required sections, citations, file:line refs. Fresh agent |
| `legitimate_refusal` | Agent says "I can't / won't do X" with a reason | Do not retry. Read the reason, adjust the request, or escalate |

### Retry rules

1. **Max 2 retries per logical task.** After 2 failures, stop and report to the user — do not loop indefinitely.
2. **Fresh agent on every retry** — never resume a failed agent.
3. **The retry prompt must change** — same prompt + same agent = same failure. State explicitly what the fix is.
4. **Log the failure mode** in your text response so the user can see the classification (e.g., "Wave 1 silent_failure on first dispatch; re-dispatching with general-purpose instead of Explore").

---

## Anti-patterns

| Don't | Do instead |
|---|---|
| Dispatch Agent without declaring required tools | Run Gate 1.1 every time |
| Use `Explore` for a task that produces a file | Use `general-purpose` (has Write) |
| Treat empty Agent output as user rejection | Treat it as silent failure → retry |
| Retry with the same prompt | Change something; classify first |
| Retry more than twice | Escalate to user after 2 failures |
| Resume a failed agent via SendMessage | Spawn fresh — failed context is poisoned |
| Trust "success" without checking the artifact | Always verify declared output exists |
| Omit `run_in_background` on a dispatch you will gate on | Pass `run_in_background: false` explicitly — the tool backgrounds by default |
| Treat a still-pending background agent as a silent failure | Wait for the notification; classify `detached_dispatch`, not `silent_failure` |
| Call `SendMessage` / `TaskList` / `TaskStop` / `TaskOutput` directly | `ToolSearch("select:...")` first — all are deferred tools |
| Embed tool-usage rules only in the spawn prompt for `spawn-team` agents | Send them as the first SendMessage too (per spawn-team) |

---

## Integration with hooks

A `PostToolUse` hook on `Agent` can detect silent failures mechanically (tool reports success, output is empty/whitespace) and inject a system-reminder. The hook handles the *detection*; this skill handles the *classification and retry*.

**Registration in `settings.json`** (the script path is whatever you name it — this skill assumes `detect-agent-failure.sh`):

```json
"PostToolUse": [
  {
    "matcher": "Agent",
    "hooks": [
      { "type": "command", "command": "~/.claude/hooks/detect-agent-failure.sh" }
    ]
  }
]
```

Write the hook to fail open: on missing `jq` or malformed input, emit a no-op response so it can never block a dispatch.

**Limits — do not rely on it as the only check.** It fires on the *tool result*, so it catches empty inline returns from `run_in_background: false` dispatches. It does **not** detect: a missing declared artifact (Gate 2.2), scope creep (Gate 2.3), thin-but-non-empty output (Gate 2.4), or a detached background agent that never reports. Run Gates 2 and 3 manually regardless of hook state.

See `~/.claude/hooks/` for current hook scripts.

---

## Quick reference

```
Before Agent():
  1. List required tools
  2. Pick subagent_type that has those tools
  3. State output contract (artifact path + shape)
  4. Bound the scope (allowed/off-limits paths)
  5. Self-contained prompt ≤ 10K tokens
  6. Fresh agent (no resume)
  7. Dispatch mode EXPLICIT — run_in_background: false if you will gate on the result
     (the Agent tool BACKGROUNDS BY DEFAULT; omitting the flag detaches the agent)
  8. Commands >100s: state runtime + timeout; >600s: orchestrator-owned, never a subagent foreground gate

When the result is in hand (inline for foreground; on the task notification for background):
  9.  Output present and non-truncated?
  10. Declared artifact exists?
  11. Scope respected (no off-limits edits)?
  12. Quality plausible vs contract?
  (A still-pending agent has NOT failed — do not run these against it.)

On failure:
  13. Classify against taxonomy (rule out detached_dispatch before silent_failure)
  14. Apply matched fix
  15. Fresh retry, max 2
  16. Escalate after 2 failures

Deferred tools — ToolSearch("select:...") before first use:
  SendMessage, TaskList, TaskStop, TaskOutput
```
