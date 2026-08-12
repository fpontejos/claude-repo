# Template: doc-build

> **Reference spec** for the `/doc-build` skill. `SKILL.md` (pre-flight + invocation +
> reporting) and `workflow.js` (execution) are the executable form; this file carries
> the domain-split guidance, per-writer quality bars, and report formats. Role prompt
> text lives ONLY in `workflow.js` — it is the single source; do not mirror it here.

**Purpose:** Build a full documentation suite from scratch using a scaffold-then-write pattern: one agent sets up the structure and verifies the build, then parallel domain-based writer agents fill in the content, then commits are serialized and the build is verified once.

**When to use:**
- Writing a new docs suite (MkDocs, Quarto, Sphinx, etc.) for an existing project
- Documenting a large codebase where no documentation exists yet
- Rebuilding docs from scratch after a major refactor
- Any docs task with 10+ files that can be split by source-code domain

**Key design principle:** Assign writers by **source file domain** (which files they need to read), not by output doc type. This eliminates repeated reads of the same source files across agents. Write-disjointness (no doc file owned by two writers) is the safety property; read-disjointness is a cost optimization, relaxed only for the optional ADR writer, whose source domain is repository history rather than files at HEAD.

---

## Args (resolved by SKILL.md pre-flight, passed to the workflow)

| Arg | How to resolve |
|-----|----------------|
| `feature` | The project or docs suite name (e.g. `ingestion-pipeline`, `cable-engine`) |
| `plan_path` | Absolute path to the implementation plan file |
| `build_cmd` | Docs build/verify command (e.g. `mkdocs build --strict`, `uv run quarto render docs/`) |
| `docs_root` | Root of the docs directory (e.g. `docs/`, `site/docs/`) |
| `repo_root` | Absolute path to the repository root |
| `is_git` | From `git rev-parse --is-inside-work-tree`; false strips all commit steps |
| `new_page_globs` | Path fragments identifying this suite's pages in build logs (e.g. `["concepts/", "fields/"]`) |
| `writers[]` | Domain split output: name, files_to_write, source_files, commit_message per writer |
| `writers[].history_scope` | ADR writer only: bounded history window (release tag, last N commits, or plan-specified date) |
| `writers[].decision_candidates` | ADR writer only: pre-flight decision inventory (`{slug, anchors, paths}` each); presence selects the ADR role prompt |

Pre-flight also checks for unmerged git paths (`UU` etc.) — an unmerged path blocks all commits repo-wide; stop and surface it before invoking the workflow.

---

## Pre-Flight: Analyze Domain Split

Read `plan_path` and analyze the source code to determine the domain split. The goal is **one writer per source-code domain**, so each agent reads a distinct set of files.

**Default 3-writer split** (scale up to 5 based on codebase complexity):

| Writer | Reads | Writes |
|--------|-------|--------|
| `core-writer` | Main data models, schemas, core library | Architecture, data model, core concepts docs |
| `feature-writer` | Feature modules, algorithms, domain logic | Feature specs, how-it-works, KB articles |
| `reference-writer` | Config, CLI, API endpoints, deployment | Reference docs, configuration guides, API surface |

**If source files are concentrated in one domain:** Collapse to 2 writers. If spread across 5+ distinct modules: expand to 4-5 writers. Never assign the same doc file to two writers; never assign the same source file to two prose writers (the ADR writer reads across domains by design).

### Optional: ADR writer (decision-record inventory)

One additional writer whose inputs are repository history. Requires its own pre-flight, run between the domain split and the new-page globs:

1. **Bound the history** (`history_scope`): since the last major release tag, the last N commits, or since a plan-specified date. Full history on a mature repo is unaffordable and mostly noise.
2. **Enumerate candidates** with read-only queries:
   - `git log --oneline --no-merges <scope>` for the narrative spine; `git log --merges` for PR-shaped work where the merge body carries the rationale.
   - `git log --diff-filter=A` on directory adds, `--diff-filter=D` on deletes — an introduced or removed module is almost always a decision.
   - `git log -S'<symbol>' --oneline` (pickaxe) to date a specific construct.
   - `git log --grep='revert\|Revert'` — a revert followed by a reland is a decision with two data points.
   - `git log --format='%H %s' --follow <path>` on high-churn files; churn marks contested choices.
   - Dependency manifests (`pyproject.toml`, `package.json`, lockfiles) across the scope — a dependency added or dropped is a decision with a legible date.
3. **Size:** cluster into 5–15 decisions. Fewer than 5 → fold into `core-writer`; more than 15 → narrow the scope. The ADR writer counts against the 5-writer ceiling.
4. **Number globally:** continue from the highest existing ADR number on disk — a later invocation must not restart at 0001.
5. `files_to_write` = concrete `adr/NNNN-<slug>.md` pages + `adr/index.md`; `source_files: []`; add `"adr/"` to `new_page_globs`.

The ADR writer returns the standard writer fields plus `unrecorded_rationale`: written ADRs whose Context states the reasoning was never captured. Distinct from `gaps` (unwritten files); a finding about the repository, not a run defect — reported, never status-affecting.

Known limits: cross-run supersession would require editing an earlier run's files, which write-disjointness forbids — surface it instead; squash-merged history lowers rationale recovery, lengthening `unrecorded_rationale`.

---

## Execution Phases

The workflow runs four phases. Each agent returns schema-validated structured output; the script gates and branches on that data — there is no message passing between agents.

```
Phase 1: Scaffold      → gate: {build_cmd} passes with 0 errors, or the run
                          returns status: failed and writers never launch
             ↓
Phase 2: Write         → all writers parallel, shared checkout, disjoint files;
                          writers do NOT commit and do NOT run the build
             ↓
Phase 3: Commit        → one commit-serializer agent: one pathspec-scoped
                          commit per writer, in order (skipped if not a git repo)
             ↓
Phase 4: Verify        → one verifier agent: final {build_cmd} + link-notice
                          sweep over new_page_globs; unambiguous fixes committed
                          as one fix commit
```

| Phase | Agent(s) | Returns |
|-------|----------|---------|
| Scaffold | `scaffold` | build_clean, build_errors, stub_count, commit |
| Write | one per writer | files_written, approx_lines, corrections_vs_plan, gaps (+ unrecorded_rationale for the ADR writer) |
| Commit | `commit-serializer` | commits (writer, hash, files), skipped |
| Verify | `verifier` | build_clean, errors, link_notices_on_new_pages, fixes_applied, fix_commit |

**Why writers do not commit or build:** all writers share one checkout. Concurrent commits race on `.git/index.lock`; concurrent builds corrupt each other's output directory. Serializing both into dedicated phases preserves the per-writer commit history without the race.

`status: complete` requires: build clean, no unresolved link notices on new pages, no dead writers, no declared gaps, and (in a git repo) no skipped commits. Anything less returns `complete_with_issues` or `failed`.

---

## Role Prompts

Canonical prompt text lives ONLY in `workflow.js` (scaffold, prose writer, ADR writer,
commit serializer, verifier). Earlier revisions mirrored the full prompts here; the
mirror drifted from the script twice, so it was removed — read the script for the
prompts. This section carries only what the workflow does not encode.

**Per-writer additions** (fold into a writer's plan section or its `agent_type`
selection; the common prompt in `workflow.js` already covers the shared quality bar):

- **core-writer:** include code examples from the actual source where helpful.
- **feature-writer:** prefer concrete examples over abstract descriptions; use numbered lists or Mermaid flowcharts for algorithms and multi-step processes (diagram render is confirmed by the Verify phase).
- **reference-writer:** reference docs must reflect the actual interface — document every endpoint/parameter/response shape, every config option with type/default/example, every CLI command and flag; use tables for option lists.

**Commit message convention** per writer: `docs(core): <brief>`, `docs(features): <brief>`, `docs(reference): <brief>`, `docs(adr): <brief>`.

---

## Completion Report Format

Populated from the workflow's returned data (see SKILL.md Step 3):

```
## Doc-build {feature} — {status}

Build: {build_cmd} — {clean / N errors}
Commits: N | Files: N | Lines: ~N

| Agent | Commit | Files | Lines |
|-------|--------|-------|-------|
| scaffold | <hash> | N stubs + config | — |
| core-writer | <hash> | N files | N |
| feature-writer | <hash> | N files | N |
| reference-writer | <hash> | N files | N |
| verify fixes | <hash or none> | — | — |

Corrections vs. plan: [from writers, or "None"]
Unrecorded rationale: [from adr-writer, if present — reported, never status-affecting]
Gaps / dead writers / skipped commits: [lead with these if any]
Link notices on new pages: [from verifier]
```

**Proposed next step:** push (on explicit ask only), or a docs audit per `audit.md` in this directory.

---

## Scaling Guidelines

| Codebase size | Writers | Split strategy |
|---------------|---------|----------------|
| < 5 source modules | 2 | core + reference |
| 5–10 modules | 3 | core + features + reference |
| 10–20 modules | 4 | core + pipeline + features + reference |
| 20+ modules | 5 | Add one writer per major subsystem; keep reference separate |

Never exceed 5 writers. If the scope is larger, run two sequential doc-build invocations on different subsections. An ADR writer, if used, counts against the ceiling — fold ADRs into `core-writer` when the decision inventory is under 5.
