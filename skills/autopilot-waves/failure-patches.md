# Failure-Mode → Prompt-Patch Library

Executable patches for the autopilot wave loop. When a wave's verifier returns `{verdict: fail, failure_mode: <mode>}`, look up the mode here and apply the patch to the **next dispatch prompt** before re-launching a fresh agent.

**Source taxonomy:** `agent-preflight` Gate 3 + `test_regression` (added from wave-execution telemetry).

**Hard rules (apply to every mode):**

- Fresh agent on every retry — never resume.
- Max **2 retries per wave**. After that, escalate via `escalation-block` (bottom of this file).
- If retry #2 fails with a **different** mode than retry #1, escalate immediately — the plan is likely broken, not the prompt.
- Never auto-heal a wave whose gate lacks a cross-boundary test (see `orchestrating-agent-waves` §Gate Design). Surface the gate gap to the user instead.
- Patches expand the prompt; they do **not** expand the SCOPE CONTRACT. If a patch would require touching paths outside the approved scope, escalate.

---

## Patch Library

Each entry has the same shape:

- **Detection** — what the verifier sees
- **Root cause** — one line
- **Patch** — concrete edit to splice into the re-dispatch prompt
- **subagent_type override** — when the fix requires a different agent type
- **Don't** — anti-pattern that looks like a fix but isn't
- **Escalate if** — second-failure exit condition specific to this mode

---

### `silent_failure`

**Detection:** Empty return, truncated mid-sentence, or "success" with no declared artifact on disk.

**Root cause:** Wrong `subagent_type` (lacks needed tool), context overflow before first tool call, or model-side dispatch error.

**Patch — prepend to prompt:**

```text
## Output contract (re-dispatch after silent failure)

You MUST produce: {artifact_path}
- Create it with the Write tool as your final action.
- If you cannot create it, STOP and return one sentence explaining why.
- Do not return an empty response. An empty response is treated as failure.

First action: confirm the Write tool is available by listing the directory:
  Glob: {artifact_dir}/*
```

**subagent_type override:** If prior dispatch was `Explore` or `Plan`, switch to `general-purpose`. These two lack `Write` and are the #1 cause of silent failures on file-producing tasks.

**Don't:** Re-dispatch with the identical prompt and hope. Same prompt + same agent type = same silent failure.

**Escalate if:** Second dispatch also returns empty with `general-purpose` — likely a harness/API issue, not a prompt problem.

---

### `permission_gap`

**Detection:** Output describes what the agent *would* do ("I would create X with..."), but the file is missing or unchanged.

**Root cause:** `subagent_type` lacks `Write`, `Edit`, or `Bash` for what the task needs.

**Patch — replace `subagent_type` and prepend:**

```text
## Tool requirements (re-dispatch after permission gap)

This task requires: {Write | Edit | Bash}.
Confirm at start by attempting a no-op of each required tool. If any tool
returns "not available", STOP and report which tool is missing — do not
continue with workarounds.

Required artifact: {artifact_path}
Action expected: {create | edit | run+commit}
```

**subagent_type override:** Always switch to `general-purpose` unless a specialist (`react-specialist`, `postgres-pro`, etc.) is verified to have the missing tool in its `.md`.

**Don't:** Tell the agent to "use bash heredoc to write the file" as a workaround — this violates the tool-discipline rule (spawned agents use Read/Edit/Write/Glob/Grep, never heredocs) and can trigger permission hooks that silently kill the agent.

**Escalate if:** Second dispatch reports the tool *is* available but still doesn't produce the artifact — this is now `silent_failure`, not `permission_gap`. Re-classify, don't loop.

---

### `wrong_tool`

**Detection:** Agent used `cat`/`sed`/`find`/`echo`/`grep` via Bash instead of Read/Edit/Glob/Grep. Often paired with permission-hook kills in subagent transcripts.

**Root cause:** Spawn-prompt tool rules were ignored (known issue: rules embedded in spawn prompt alone are unreliable; must arrive as first SendMessage).

**Patch — prepend to prompt as section #1:**

```text
## TOOL DISCIPLINE (read before any action)

Use ONLY these tools for file operations. The bash equivalents are blocked by
permission hooks and will silently kill this agent.

| Need                  | Use         | NOT          |
|-----------------------|-------------|--------------|
| Read a file           | Read        | cat, head, tail |
| Edit a file           | Edit        | sed, awk     |
| Create a file         | Write       | echo >, heredoc |
| Find files            | Glob        | find         |
| Search content        | Grep        | grep         |

Bash is reserved for: git, tests, build commands, package managers. Nothing else.

Acknowledge this section by listing the three tools you will use most for
this task as your first sentence.
```

**subagent_type override:** None — this is a prompt-discipline issue, not a tool-availability issue.

**Don't:** Add the rule only to the spawn prompt for `spawn-team` agents — send it as the first `SendMessage` after spawn too (per `spawn-team` doctrine).

**Escalate if:** Second dispatch also reaches for bash equivalents — the task may genuinely require bash (e.g., complex sed pipeline). Surface to user and ask whether to relax tool discipline for this specific dispatch.

---

### `scope_creep`

**Detection:** Diff shows edits to files/directories outside the SCOPE CONTRACT's allowed paths.

**Root cause:** Agent inferred related work needed fixing and "helpfully" expanded scope. Sometimes triggered by ambiguous prompts ("fix the foo system" → agent rewrites bar too).

**Patch — pre-action:**

1. **Revert the off-limits edits first** (`git checkout -- <off-limits-paths>`). Do this before re-dispatching.
2. **Prepend to prompt:**

```text
## SCOPE LOCK (re-dispatch after scope creep)

Allowed paths (you may create/modify ONLY these):
{allowed_paths_from_scope_contract}

OFF-LIMITS (do not touch — previous attempt was reverted):
{off_limits_paths}
{specific_files_agent_touched_last_time}

If you believe an off-limits file MUST change to complete this task, STOP
and return: "BLOCKED: scope conflict — need to touch {path} because {reason}".
Do not edit it.

Your previous attempt edited: {file_list}. These were reverted. Do not repeat.
```

**subagent_type override:** None.

**Don't:** Just re-dispatch with the same prompt expecting the agent to "remember" the boundary — it won't, fresh agents have no memory of prior dispatches.

**Escalate if:** Second dispatch reports `BLOCKED: scope conflict` — the SCOPE CONTRACT may be wrong. Surface to user; they may need to expand allowed paths or split the wave.

---

### `context_overflow`

**Detection:** Output truncated, "I'll continue in next response", agent emitted partial file, tool result cut off mid-stream.

**Root cause:** Prompt + reference material exceeded the agent's effective context, OR the task itself produces too much output for one dispatch.

**Patch — split, don't re-dispatch whole:**

1. **Bisect the task.** Identify two independent halves that write to distinct files.
2. **Re-dispatch as two parallel agents in a single message**, each with ~half the original prompt.
3. **Prepend to each:**

```text
## Bounded scope (split after context overflow)

You are agent {N}/2 of a split. Your half is: {description}.
Output ONLY: {artifact_path}
Do NOT attempt the other half ({other_description} → other_path) — another
agent is handling it in parallel.

Target output size: ≤ {N} lines / ≤ {N} tokens. If your task naturally
exceeds this, STOP and report — do not continue past the limit.
```

**subagent_type override:** None.

**Don't:** Re-dispatch the same prompt with "be more concise" added — context overflow is structural, not stylistic.

**Escalate if:** Even after bisection, halves still overflow — the wave is mis-sized; surface to user to re-plan with more (smaller) waves.

---

### `wrong_understanding`

**Detection:** Output is coherent, well-scoped, in-bounds — but solves a different problem than the wave's acceptance criteria specify.

**Root cause:** Ambiguous prompt. Often the original prompt described *what* without enough *why* or concrete examples.

**Patch — rewrite, don't append:**

````text
## Concrete spec (re-dispatch after wrong-understanding)

Previous attempt produced: {summary_of_wrong_output}
This solved the wrong problem. Specifically: {what_it_solved_vs_what_we_need}

What we actually need:
- Input:  {concrete_input_example}
- Output: {concrete_output_example}
- Acceptance test (must pass):
  ```
  {one_executable_test_or_assertion}
  ```

If the acceptance test cannot pass with your implementation, STOP and report
the gap — do not produce something that doesn't satisfy it.
````

**subagent_type override:** None.

**Don't:** Add more words to the original prompt hoping clarity emerges. Replace it with a concrete input/output pair and an executable acceptance test.

**Escalate if:** Second dispatch also solves a different problem — the acceptance criteria themselves are ambiguous. Surface to user to clarify the wave's intent before retrying.

---

### `quality_below_bar`

**Detection:** Output exists, in scope, matches acceptance shape — but is shallow, generic, missing required file:line refs, or fails the verifier's quality check.

**Root cause:** Prompt under-specified what "good" looks like.

**Patch — append required-elements checklist:**

```text
## Quality bar (re-dispatch after quality_below_bar)

Previous attempt was {accepted_shape_but_failed_quality}. To pass this wave,
your output must include:

- [ ] {specific_required_element_1} (e.g., file:line citations for every claim)
- [ ] {specific_required_element_2} (e.g., 3+ concrete examples per pattern)
- [ ] {specific_required_element_3} (e.g., before/after diff for every change)
- [ ] {specific_required_element_4} (e.g., test command + expected output)

Self-check before returning: read your own output and confirm each box is
checkable. If any is not, fix it before responding.
```

**subagent_type override:** None.

**Don't:** Re-dispatch with "be more thorough" — give the agent a literal checklist of elements that must appear.

**Escalate if:** Second dispatch is still shallow — the prompt may not have enough source material for depth. Surface and ask whether to add reference files to the prompt or accept the current quality level.

---

### `test_regression`

**Detection:** Wave's code-level acceptance passed (artifact exists, scope respected), but the integration gate's test suite has new failures vs the parent commit.

**Root cause:** Agent's change broke a behavior its own tests didn't exercise. Common when a wave touches shared utilities or contract types.

**Patch — orchestrator fixes, does NOT re-dispatch agent:**

This is the one mode where the rule from `orchestrating-agent-waves` overrides the patch library:

> **Never re-launch an agent to fix a gate failure — the orchestrator has full context and fixes are typically 1-3 lines.**

The orchestrator should:

1. Read the failing test output.
2. Distinguish **pre-existing** vs **introduced** failure (stash + checkout parent commit to verify).
3. If introduced: fix inline, re-run gate, commit fix as a **separate atomic commit** following the wave's main commit.
4. If pre-existing: document in wave summary, do not block the wave.

**Only re-dispatch an agent if** the fix requires substantial new code (>10 lines) that the agent could write more accurately than the orchestrator. Even then, send a tightly-scoped fix-task, not a re-do of the wave.

**Patch (when re-dispatch IS warranted):**

```text
## Test regression fix (targeted)

Wave {N}'s integration gate failed with these tests:
{failing_test_names_and_output}

These tests passed on the parent commit and fail on the wave's commit.
Your task is ONLY to make them pass without reverting the wave's work.

Files in the wave: {wave_files}
Failing test files: {test_files}

Read both, identify the regression, fix it minimally. Do not refactor.
Do not add new tests. Do not touch files outside {wave_files ∪ test_files}.
```

**Don't:** Commit the fix into the same commit as the wave's main work — that violates atomic-commit doctrine (see global rules).

**Escalate if:** Second fix attempt also fails the gate — the wave's design conflicts with an existing invariant. Surface; the wave may need to be re-planned.

---

### `fixture_oracle_mismatch`

**Detection:** Wave's gate passes (unit/integration tests green, synthetic fixtures match), but the **canonical real-world fixture** the user pinned as the acceptance oracle still produces a wrong result. Symptom: code looks correct, tests are green, but running the pipeline end-to-end against the user's reference input contradicts the test assertions.

**Root cause:** Tests were written against fabricated inputs (mocked data, shape-only fixtures, fresh-seeded DBs) that don't exercise the actual failure path. The real fixture has properties (ink darkness, threshold edge values, encoded payload variations) the synthetic data lacked. Gate passed because it asked the wrong question.

**Patch — re-dispatch with the canonical fixture pinned:**

```text
## Acceptance oracle (re-dispatch after fixture_oracle_mismatch)

The previous attempt passed its tests but produced the wrong result on the
canonical fixture: {fixture_path}

Expected behavior on this fixture:
{concrete_expected_observation — e.g., "score == 16/20", "Q3 detected_state == filled"}

Actual behavior on this fixture:
{what_we_observed — e.g., "score == 0/20, all marks classified as blank"}

Before writing any code, run a read-only probe against {fixture_path}:
1. Ingest or load the fixture into a known state.
2. Dump the intermediate values your fix depends on (per-mark fill_ratio,
   resolved variant_id, key letter, etc.) into a table.
3. Cross-check the table against the expected behavior above.

Only then propose the fix. Your test suite MUST include an assertion that runs
against {fixture_path} (not a synthetic substitute) and asserts the expected
behavior above. A test that mocks the input does not satisfy this wave.
```

**subagent_type override:** None — this is a methodology patch, not a tool-availability issue.

**Don't:** Re-run the same tests with the same synthetic fixtures hoping a code tweak fixes it. The gate was structurally wrong; loosening or rewriting the assertion without changing the fixture is a false-green trap.

**Don't:** Accept the wave on the basis that "the fix should also work on the real fixture" without actually running it. Predicted equivalence is not observed equivalence.

**Escalate if:** Second dispatch produces a correct probe table but still can't make the real-fixture assertion pass — the fix may require changes outside the SCOPE CONTRACT (e.g., threshold constants in an off-limits engine module, schema migration), or the fixture itself reveals a design flaw. Surface to user with the probe table as evidence.

**Related:** This is the canonical companion to `templates/dry-run-probe.md`. Use that pattern proactively when a wave's acceptance depends on numerical oracles or real-world artifact behavior; use this patch reactively when the probe was skipped and a synthetic-fixture wave shipped broken.

---

### `legitimate_refusal`

**Detection:** Agent returns a coherent message explaining why it cannot or will not do the task (security, ambiguity, missing precondition, ethical concern).

**Root cause:** The agent identified a real problem with the request.

**Patch — DO NOT auto-retry.**

This is the one mode that breaks the autopilot loop. Read the refusal carefully:

- Is the agent identifying a precondition we missed (e.g., "the file you reference doesn't exist")? → Fix the precondition, re-dispatch.
- Is it flagging an ambiguity? → Treat as `wrong_understanding`, apply that patch.
- Is it refusing on policy/safety grounds? → Surface to user immediately. Do not engineer around it.

**Escalation block (always, never auto-retry):**

```text
WAVE {N} REFUSED by agent
Reason given: {refusal_text}
Recommended next action: {one_of: fix_precondition | clarify_request | accept_refusal_and_replan}
```

---

## Escalation Block (after 2 failed retries)

When the loop exhausts retries, the orchestrator prints this block and **stops**:

```markdown
## SELF-HEALING LOOP EXHAUSTED — Wave {N}

**Attempts:** 2 retries, both failed.

**Attempt 1:**
- Failure mode: {mode_1}
- Patch applied: {patch_1_summary}
- Result: {still_failed_because}

**Attempt 2:**
- Failure mode: {mode_2}  ({"same as #1" | "different from #1"})
- Patch applied: {patch_2_summary}
- Result: {still_failed_because}

**Diagnosis:**
{one_of:
  - "Same mode twice: prompt patch insufficient; suggest plan revision"
  - "Different modes: wave design likely flawed; recommend re-planning this wave"
  - "Cross-boundary gate missing: cannot safely self-heal without it"}

**Recommended next action:**
{specific_action: edit_waves.md | expand_scope_contract | add_cross_boundary_test | accept_partial_completion}

Awaiting user direction.
```

---

## Maintenance

When a new failure mode is observed in the wild:

1. Add an entry here with all six sections (Detection, Root cause, Patch, subagent_type, Don't, Escalate if).
2. Add the mode to `agent-preflight` Gate 3 taxonomy table.
3. Update the verifier prompt's `failure_mode` enum.
4. Run one real wave with the new mode to validate the patch before relying on it in auto-mode.

**Do not** add a mode without a concrete failure example — speculative modes pollute the loop.
