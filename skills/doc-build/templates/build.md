# Template: doc-build

> **Reference spec** for the `/doc-build` skill. `SKILL.md` (pre-flight + invocation +
> reporting) and `workflow.js` (execution) are the executable form; this file carries
> the full role prompts, quality bars, and report formats the workflow encodes.

**Purpose:** Build a full documentation suite from scratch using a scaffold-then-write pattern: one agent sets up the structure and verifies the build, then parallel domain-based writer agents fill in the content, then commits are serialized and the build is verified once.

**When to use:**
- Writing a new docs suite (MkDocs, Quarto, Sphinx, etc.) for an existing project
- Documenting a large codebase where no documentation exists yet
- Rebuilding docs from scratch after a major refactor
- Any docs task with 10+ files that can be split by source-code domain

**Key design principle:** Assign writers by **source file domain** (which files they need to read), not by output doc type. This eliminates repeated reads of the same source files across agents.

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

**If source files are concentrated in one domain:** Collapse to 2 writers. If spread across 5+ distinct modules: expand to 4-5 writers. Never assign the same source file — or the same doc file — to two different writers.

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
| Write | one per writer | files_written, approx_lines, corrections_vs_plan, gaps |
| Commit | `commit-serializer` | commits (writer, hash, files), skipped |
| Verify | `verifier` | build_clean, errors, link_notices_on_new_pages, fixes_applied, fix_commit |

**Why writers do not commit or build:** all writers share one checkout. Concurrent commits race on `.git/index.lock`; concurrent builds corrupt each other's output directory. Serializing both into dedicated phases preserves the per-writer commit history without the race.

`status: complete` requires: build clean, no dead writers, no declared gaps, and (in a git repo) no skipped commits. Anything less returns `complete_with_issues` or `failed`.

---

## Role Prompts

Canonical prompt text lives in `workflow.js`; the versions below carry the full quality bars for reference and adaptation.

### Scaffold

```
You are the scaffold agent for the "{feature}" documentation suite.

Read the implementation plan first: {plan_path}

Then, IN ORDER:
1. Create the directory structure exactly as specified in the plan.
2. Write the main config file (mkdocs.yml / _quarto.yml / etc.) with:
   - All nav entries pre-populated (even for files that don't exist yet)
   - Theme, plugins, and extensions as specified in the plan
3. Write stub files for every doc listed in the plan nav:
   - Each stub contains: frontmatter (if required), an H1 heading, and one line "TODO: content"
   - Use the exact file paths from the plan
4. Run: {build_cmd}
   - It must pass with zero errors. If it fails, fix the cause (usually: missing
     file in nav, bad YAML syntax, wrong path) and re-run until clean.
5. Write docs/README.md (or equivalent index): 1-paragraph overview + a table
   linking each major section.
6. Commit ONLY the new docs files, pathspec-scoped:
   git add <paths> && git commit -m "docs: scaffold {feature} structure with N stubs" -- <paths>
   (Skip this step if not a git repository.)

Report build_clean only from actual command output, never from inference.

Structured output: build_clean, build_errors, stub_count, commit.
```

### Writers (core / feature / reference)

Common frame, per-writer assignment filled from the domain split:

```
You are {writer-name} for the "{feature}" documentation suite.

Read the implementation plan first: {plan_path}

Your assignment (files outside this list are off-limits — another writer owns them):
- Files to write: [from domain split]
- Source files to read: [from domain split]

For each doc:
1. Read the relevant source files — document the actual implementation, not the
   intended one.
2. If the plan and the source code disagree, follow the source code and record
   the discrepancy in corrections_vs_plan.
3. Cross-reference sibling docs with relative links — but ONLY within {docs_root}.
   A link to a file outside the docs dir cannot be a doc link; render such
   references as inline code.

Quality bar:
- Every factual claim must be verifiable from the source you read.
- Reference code by symbol name (`ClassName.method()`, `module.function()`) —
  never file:line; line numbers go stale on the next edit.
- No placeholder text. If you lack information for an assigned file, leave its
  stub intact and record it in gaps.

HARD RULES (shared checkout):
- Do NOT run git commit, git add, or any git-mutating command.
- Do NOT run {build_cmd} or any docs build.
- Write ONLY the files in your assignment.

Structured output: files_written, approx_lines, corrections_vs_plan, gaps.
```

Per-writer additions:

- **core-writer:** include code examples from the actual source where helpful.
- **feature-writer:** prefer concrete examples over abstract descriptions; use numbered lists or Mermaid flowcharts for algorithms and multi-step processes (diagram render is confirmed by the Verify phase).
- **reference-writer:** reference docs must reflect the actual interface — document every endpoint/parameter/response shape, every config option with type/default/example, every CLI command and flag; use tables for option lists.

### Commit Serializer

```
First run git status --porcelain. If ANY path is unmerged (UU, AA, DD, AU, UA,
DU, UD), STOP — git refuses all commits repo-wide; report every writer as
skipped with the unmerged paths listed.

Otherwise create ONE commit per writer, in order, each scoped with explicit
pathspecs so nothing pre-staged or unrelated leaks in:
  git add -- <writer's files_written> && git commit -m "<writer's commit_message>" -- <files>

Omit missing files from a commit and note them; skip a writer whose entire file
list is missing. Verify each commit landed via git log --oneline before
reporting its hash.

Structured output: commits (writer, hash, files count), skipped.
```

Commit message convention per writer: `docs(core): <brief>`, `docs(features): <brief>`, `docs(reference): <brief>`.

### Verifier

```
1. Run {build_cmd}, capture the FULL output to a log file, and check the exit
   code directly — no piping that masks it.
2. Collect every error.
3. Sweep the log for link/validation notices (INFO and WARNING included —
   --strict passes some silently) that reference this suite's pages, matched
   via new_page_globs.
4. Fix what is unambiguous (broken relative link, wrong anchor, out-of-docs-dir
   link that must become inline code). Re-run the build after fixing.
5. Commit fixes as ONE pathspec-scoped commit: "docs: fix link/build issues
   found in verification". (Skip if not a git repository.)
6. Do NOT fix pre-existing notices on pages outside new_page_globs.

Structured output: build_clean, errors, link_notices_on_new_pages,
fixes_applied, fix_commit.
```

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

Never exceed 5 writers. If the scope is larger, run two sequential doc-build invocations on different subsections.
