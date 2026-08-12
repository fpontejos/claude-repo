---
name: doc-build
description: Build a full documentation suite (MkDocs, Quarto, Sphinx) from an implementation plan via a deterministic workflow - scaffold gate, parallel domain writers, serialized commits, strict-build verify. Use for new docs suites, documenting an undocumented codebase, or rebuilding docs after a major refactor - any docs task with 10+ files splittable by source-code domain. Requires a written plan; if none exists, route through writing-plans first.
---

# Doc-Build: $ARGUMENTS

Build a documentation suite from scratch using a scaffold-then-write pattern, executed as a **Workflow script** (`~/.claude/skills/doc-build/workflow.js`). You do the pre-flight and domain split inline; the workflow runs the agents deterministically. Reference specs live in `templates/`: `build.md` (domain-split guidance, per-writer quality bars, and report formats — consult it when the summary below leaves a judgment call open; role prompt text lives only in `workflow.js`), `audit.md` (the optional post-build audit: three independent reviewers → verdict), `polish.md` (the objective-specification writing register — the quality bar for the optional Polish phase), and `interactive.md` (the `--interactive` pre-flight: gates, manifest, and the `doc-build-args.json` contract).

**Key design principle:** assign writers by **source-file domain** (which files they must read), not by output doc type. No doc file is ever assigned to two writers; no source file is read by two prose writers. (The optional ADR writer relaxes the read side only — see Step 1.5. Read-disjointness is a cost optimization; write-disjointness is the safety property.)

**Execution model** (encodes the 2026-07 doc-build run lessons):
- Scaffold is a hard gate — writers launch only after a verified passing build.
- Writers share one checkout, write disjoint files, and do **not** commit or build — concurrent commits race on `.git/index.lock` and concurrent strict builds corrupt each other's output dir.
- A single commit-serializer agent creates one pathspec-scoped commit per writer afterward (same git-history shape, no race).
- The final verifier sweeps the build log for link notices touching the new pages, because MkDocs `--strict` silently tolerates out-of-`docs_dir` relative links.

## Step 1: Pre-flight (inline, before invoking Workflow)

**Mode.** Parse `--interactive` / `-i` from `$ARGUMENTS`. Full spec: `templates/interactive.md`.

- **Default (no flag): never ask.** Resolve args by precedence: explicit invocation args > a `doc-build-args.json` in the plan directory (use it only after its staleness check passes — plan-hash mismatch stops loudly naming the drift) > inference via the numbered steps below. An ambiguity inference cannot resolve (no plan, >5 writers with no given partition, zero/multiple `build_cmd` candidates, unassignable nav pages, doc-file overlap between any two writers, source overlap between prose writers, a stale args file, cross-run collision with a prior args file) **fails loudly with the open question named and `--interactive` suggested — never guess, never ask.** Autonomous callers need no flag; execution never asks in any mode.
- **`--interactive`: the pre-flight is the product.** Run the numbered steps to compute proposals, then Gates A/B/C and the manifest per the template; at confirmation write `doc-build-args.json` (args + `_provenance`: plan hash, HEAD, Gate answers) and launch on yes — on no, the file persists for a later plain invocation. Subagent/headless callers never pass this flag.

1. **Plan.** Resolve `plan_path` from `$ARGUMENTS` or conversation context. Read it. A written plan is required; if none exists, stop and recommend `writing-plans` (under `--interactive`: Gate A runs first and its answers hand off to `writing-plans`; do not proceed to Gate B without a written plan).
2. **Git state.** `git rev-parse --is-inside-work-tree` → sets `is_git`. If a git repo, run `git status --porcelain` and check for unmerged paths (`UU`, `AA`, `DD`, `AU`, `UA`, `DU`, `UD`). If any exist, **stop and surface to the user** — an unmerged path blocks all commits repo-wide and is not fixable from inside a docs task.
3. **Build command.** Resolve `build_cmd` from the plan or project (e.g. `mkdocs build --strict`, `uv run quarto render docs/`). Verify the tool is installed before spawning anything.
4. **Domain split.** From the plan nav + source tree, partition into 2–5 writers:

   | Codebase size | Writers | Split |
   |---|---|---|
   | < 5 source modules | 2 | core + reference |
   | 5–10 modules | 3 | core + features + reference |
   | 10–20 modules | 4 | core + pipeline + features + reference |
   | 20+ modules | 5 | one per major subsystem; keep reference separate |

   Never exceed 5 writers — larger scopes run as two sequential doc-build invocations on different subsections (under `--interactive`, Gate A resolves the partition; sequential runs check disjointness against the prior run's `doc-build-args.json`, when one exists). Verify disjointness of `files_to_write` across all writers, and of `source_files` across prose writers.
5. **ADR writer (optional).** To add Architecture Decision Records, include one `adr-writer` whose source domain is repository history rather than files at HEAD. It counts against the 5-writer ceiling. Pre-flight for it:
   - **Bound the history.** Resolve `history_scope`: since the last major release tag, the last N commits, or since a plan-specified date. Full history on a mature repo is unaffordable and mostly noise.
   - **Enumerate candidates** with read-only history queries: `git log --oneline --no-merges <scope>` for the spine plus `git log --merges` for PR-shaped rationale; `--diff-filter=A`/`--diff-filter=D` on directory adds/deletes; `git log -S'<symbol>'` to date a construct; `--grep='revert\|Revert'` (a revert followed by a reland is a decision with two data points); `--follow` on high-churn files; dependency-manifest changes across the scope.
   - **Size the result.** Cluster into 5–15 decisions. Fewer than 5 → fold the ADRs into `core-writer`; more than 15 → narrow `history_scope`.
   - **Number globally.** Read the highest existing ADR number under the ADR directory and continue from it — a later doc-build invocation must not restart at 0001.
   - **Writer entry:** `source_files: []`, plus `history_scope` and `decision_candidates` (`{slug, anchors, paths}` each); `files_to_write` lists the concrete `adr/NNNN-<slug>.md` pages plus `adr/index.md`; add `"adr/"` to `new_page_globs` (directory-qualified, so it satisfies the fragment constraint in step 6).

   Known limits: cross-run supersession would require editing a prior run's files, which write-disjointness forbids — surface it to the user instead; squash-merged history lowers rationale recovery, so expect a longer `unrecorded_rationale`.
6. **New-page globs.** Derive `new_page_globs` — path fragments that identify this suite's pages in a build log (e.g. `["concepts/", "fields/"]`). The verifier uses these to separate our link notices from pre-existing corpus noise — so avoid fragments that match pre-existing pages (`index.md` matches every index page in the corpus; use a directory-qualified form instead).
7. **Specialist agents (optional).** If a custom agent type clearly fits a writer's domain (per `.claude/agents/` definitions), set that writer's `agent_type`. Default: omit (general-purpose workflow agent).

## Step 2: Invoke the workflow

```
Workflow({
  scriptPath: "~/.claude/skills/doc-build/workflow.js",   // expand ~ to the absolute home path
  args: {
    feature, plan_path, build_cmd, docs_root, repo_root, is_git,
    new_page_globs: [...],
    writers: [
      { name: "core-writer", files_to_write: [...], source_files: [...],
        commit_message: "docs(core): <brief>" },
      // optional ADR writer (Step 1.5) — decision_candidates selects the ADR role prompt:
      { name: "adr-writer", files_to_write: ["docs/adr/index.md", "docs/adr/0001-<slug>.md", ...],
        source_files: [], history_scope: "since v2.0.0",
        decision_candidates: [{ slug: "...", anchors: ["<hash>", ...], paths: [...] }, ...],
        commit_message: "docs(adr): decision records for <feature>" },
      ...
    ]
  }
})
```

The workflow runs in the background; its result arrives as a task notification. Do not poll — continue with other work or wait for the notification.

**Resume:** if a phase fails on a transient error, first stop the prior run if it is still registered (`ToolSearch("select:TaskList,TaskStop")`, then `TaskStop` its task id — the Workflow tool requires the prior run stopped before resuming), fix the cause, and relaunch with `Workflow({scriptPath, resumeFromRunId})` — completed phases return cached results.

## Step 3: Report

The workflow returns structured results. Report to the user in this shape — statuses come from the returned data, never inferred:

```
## Doc-build {feature} — {status}

Build: {build_cmd} — {clean / N errors}
Commits: N | Files: N | Lines: ~N

| Agent | Commit | Files | Lines |
|-------|--------|-------|-------|
| scaffold | <hash> | N stubs + config | — |
| <writer> | <hash> | N | N |
| verify fixes | <hash or none> | — | — |

Corrections vs. plan: [from writers' corrections_vs_plan, or "None"]
Unrecorded rationale: [from adr-writer, if present — a finding about the repository, not a run defect; does not affect status]
Gaps / dead writers: [lead with these if any — partial-green is not green]
Link notices on new pages: [from verifier]
```

If `status` is `complete_with_issues`, lead with what is not done (gaps, dead writers, skipped or missing commits, unresolved notices) before the wins.

**Proposed next step:** push (on explicit ask only), a polish pass (§Polish), or a docs audit per `templates/audit.md` — three parallel read-only reviewers (coverage vs plan, accuracy vs source, reader walkthrough) synthesized into a PASS / PASS WITH NOTES / FAIL verdict.

**Interactive post-run branch** (only in a session where a user can answer; spec: `templates/interactive.md` §Post-run branch): on `complete`, offer only what Gate C did not settle — if Gate C selected audit, run it without re-asking. On `complete_with_issues`, report the issues first as above, then ask: resume after fixing a named cause / accept and proceed to polish or audit / stop. On `failed` (scaffold gate or all writers dead), do not ask — the returned data already names the one correct action.

## Polish (optional)

After a `complete` build, or on request for an existing suite: launch **fresh agents** — agents that did not write the content — to review and edit the produced docs for register and clarity against `templates/polish.md`.

1. **Dispatch** one general-purpose agent per writer domain, in a single parallel message. Each agent's assignment is that writer's `files_to_write` from the build's domain split — disjoint files, so no isolation is needed. Each prompt includes:
   - The full text (or at minimum the Core moves, Tone, and Language sections) of `templates/polish.md` as the editing standard.
   - The assigned file list, with files outside it off-limits.
   - Hard constraints: edit register and clarity only — do NOT change factual content, code examples, symbol references, tables' data, or nav/structure; do NOT run git commands or the docs build.
   - ADR pages: exclude the `adr/` directory from the dispatch, or declare Context and Provenance sections off-limits within it — polish's licence to smooth prose is exactly what would erode "Rationale not recorded in commit history" statements into text that reads better and asserts more.
   - Output contract: per file, a one-line summary of what changed (or "no changes needed").
2. **Verify** after all agents return: run `{build_cmd}` once and confirm it is clean (polish edits can break anchors or Mermaid fences).
3. **Commit** (git repos only) all polish edits as one pathspec-scoped commit: `docs: polish register per objective-spec voice`.
4. **Report:** files touched per domain, one-line change summaries, build status, commit hash. A polish pass that changes nothing is a valid outcome — report it as such.

Polish and audit are independent: polish edits the suite, audit judges it. When running both, polish first, then audit the polished result.

## Failure handling

| Scenario | Action |
|---|---|
| Scaffold gate fails | Workflow returns early with `build_errors`. Fix the plan/config issue, resume the run. |
| A writer returns null (died) | Reported in `dead_writers` (all writers dead → `status: failed` before commit/verify). If the run is still registered, stop it first (`TaskStop`) — a run that returned normally needs no stop. Check the journal (`<transcriptDir>/journal.jsonl`), then re-invoke with `resumeFromRunId` — surviving results are cached. |
| Unmerged git paths discovered mid-run | Commit serializer reports all writers skipped. Surface to the user; after they resolve, resume — writer output is on disk, only commits re-run. |
| Plan and source disagree | Writers follow source and record it in `corrections_vs_plan`; relay these to the user verbatim. |
