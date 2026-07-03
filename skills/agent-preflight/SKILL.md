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

---

## Gate 2: Post-Flight Check

After every Agent/Task call returns, check before acting on the result:

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
| `silent_failure` | Empty return, no artifact, no error text | Fresh agent, same prompt, log the empty return in your reply to the user so they know it happened |
| `permission_gap` | Output describes what it *would* do, but file missing | Check `subagent_type` tool list — was `Write`/`Edit`/`Bash` missing? Re-dispatch with correct type |
| `wrong_tool` | Agent used `cat` instead of Read, `find` instead of Glob, etc. | Prompt explicitly: "Use Read tool, not bash cat. Use Glob, not find." Re-dispatch fresh |
| `scope_creep` | Agent edited files outside allowed paths | Revert those edits, re-dispatch with explicit "DO NOT touch X, Y, Z" |
| `context_overflow` | Truncated output, "I'll continue in next response", agent hit limits | Smaller scope per dispatch; split into two agents with distinct files |
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
| Embed tool-usage rules only in the spawn prompt for `spawn-team` agents | Send them as the first SendMessage too (per spawn-team) |

---

## Integration with hooks

A `PostToolUse` hook on `Agent` can detect silent failures mechanically (empty output, missing artifact) and inject a system-reminder. The hook handles the *detection*; this skill handles the *classification and retry*. If the hook is installed (`~/.claude/hooks/agent-postflight.sh`), Gate 2.1 / 2.2 will fire automatically — but apply Gate 3 in either case.

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

After Agent() returns:
  7. Output present and non-truncated?
  8. Declared artifact exists?
  9. Scope respected (no off-limits edits)?
  10. Quality plausible vs contract?

On failure:
  11. Classify against taxonomy
  12. Apply matched fix
  13. Fresh retry, max 2
  14. Escalate after 2 failures
```
