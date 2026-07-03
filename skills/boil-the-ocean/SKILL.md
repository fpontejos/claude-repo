---
name: boil-the-ocean
description: Reminder of the strict boil-the-ocean standard — fix for correctness (not cosmetic green), tests must probe the right thing, and pre-existing failures are a signal to investigate, not an excuse. Use when about to declare a task done, encountering failing tests, or tempted to defer something as out-of-scope.
---

# Boil-the-ocean (strict)

Finish the whole thing in immediate scope. Partial-green is not green.

Read this when:
- About to declare a task complete.
- You hit a failing test and your first instinct is "that was already broken."
- You're tempted to loosen an assertion, skip a case, or mock around a failure to get green.
- You're deciding whether something is "in scope."

## The four rules

1. **Correctness, not cosmetic passing.** Do not tweak tests, loosen assertions, mock around failures, or skip cases to get green. If a test is wrong, fix what it asserts — not its threshold.

2. **Tests must probe the right thing.** A passing test that doesn't actually exercise the behavior under change is *worse* than a failing one — it manufactures false confidence. Before declaring done, read the assertions on each touched test and confirm they probe the changed behavior.

3. **"Pre-existing failure" is not an excuse — it's a signal.** Any failing test you encounter is a trigger to launch a probing agent to find root cause. Do not dismiss as out-of-scope just because it predates the session.

4. **Context may have been cleared between sessions.** "Looks like it was already broken" can mean *you* broke it in a prior session whose context is gone. Default assumption on any failing test: **in-scope** until investigation proves otherwise. Investigate first; *then* decide with evidence whether to fix now or surface explicitly to the user.

## Posture

- Surface scope deferrals **explicitly** — never silently.
- "Probe, don't dismiss" applies to anything anomalous, not just tests: unexplained warnings, skipped cases, flaky behavior, stale fixtures.
- Investigation is cheap; manufactured green is expensive.

## Output

After invoking this skill, briefly acknowledge which of the four rules is load-bearing for the current situation, then continue the task with that posture. Do not restate the whole skill back at the user.
