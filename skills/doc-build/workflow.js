export const meta = {
  name: 'doc-build',
  description: 'Build a docs suite: scaffold gate, parallel domain writers, serialized commits, strict build verify',
  whenToUse: 'Invoked by the /doc-build skill (or /spawn-team doc-build) after the orchestrator has resolved args. Not for ad-hoc use without the pre-flight the skill performs.',
  phases: [
    { title: 'Scaffold', detail: 'structure, config, stubs, first passing build' },
    { title: 'Write', detail: 'one writer per source-code domain, disjoint files, no commits' },
    { title: 'Commit', detail: 'serialized pathspec-scoped commits, one per writer' },
    { title: 'Verify', detail: 'final strict build + link-notice sweep over new pages' },
  ],
}

// args contract (resolved by the /doc-build skill before invocation):
// {
//   feature:      string   — suite name, used in commit messages and labels
//   plan_path:    string   — absolute path to the implementation plan
//   build_cmd:    string   — docs build/verify command (e.g. "mkdocs build --strict")
//   docs_root:    string   — docs directory root (e.g. "docs/")
//   repo_root:    string   — absolute path to the repository root
//   is_git:       boolean  — false strips all commit steps
//   new_page_globs: string[] — path fragments identifying THIS suite's pages in build logs
//                              (e.g. ["concepts/", "fields/"]; avoid fragments that match
//                              pre-existing pages, like a bare "index.md")
//   writers: [{
//     name:            string   — e.g. "core-writer"
//     files_to_write:  string[] — doc paths from the plan nav (disjoint across writers)
//     source_files:    string[] — source files this writer reads (disjoint across writers)
//     commit_message:  string   — e.g. "docs(core): concepts and data model"
//     agent_type?:     string   — optional custom subagent type
//   }]
// }
//
// Invariants the skill must guarantee before calling:
// - No source file and no doc file assigned to two writers.
// - git status has no unmerged (UU) paths — an unmerged path blocks ALL commits repo-wide.
// - 2–5 writers (collapse or split domains to fit).

const SCAFFOLD_SCHEMA = {
  type: 'object',
  properties: {
    build_clean: { type: 'boolean' },
    build_errors: { type: 'array', items: { type: 'string' } },
    stub_count: { type: 'number' },
    commit: { type: 'string', description: 'commit hash, or "none" if is_git=false' },
  },
  required: ['build_clean', 'build_errors', 'stub_count', 'commit'],
}

const WRITER_SCHEMA = {
  type: 'object',
  properties: {
    files_written: { type: 'array', items: { type: 'string' } },
    approx_lines: { type: 'number' },
    corrections_vs_plan: {
      type: 'array',
      items: { type: 'string' },
      description: 'places where source code contradicted the plan; empty if none',
    },
    gaps: {
      type: 'array',
      items: { type: 'string' },
      description: 'assigned files NOT completed and why; empty if none',
    },
  },
  required: ['files_written', 'approx_lines', 'corrections_vs_plan', 'gaps'],
}

const COMMIT_SCHEMA = {
  type: 'object',
  properties: {
    commits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          writer: { type: 'string' },
          hash: { type: 'string' },
          files: { type: 'number' },
        },
        required: ['writer', 'hash', 'files'],
      },
    },
    skipped: { type: 'array', items: { type: 'string' } },
  },
  required: ['commits', 'skipped'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    build_clean: { type: 'boolean' },
    errors: { type: 'array', items: { type: 'string' } },
    link_notices_on_new_pages: {
      type: 'array',
      items: { type: 'string' },
      description:
        'build-log link/validation notices referencing the new pages (even ones --strict tolerates) that remain UNRESOLVED after fixes; resolved notices belong in fixes_applied',
    },
    fixes_applied: { type: 'array', items: { type: 'string' } },
    fix_commit: { type: 'string', description: 'hash of the verification-fix commit, or "none"' },
  },
  required: ['build_clean', 'errors', 'link_notices_on_new_pages', 'fixes_applied', 'fix_commit'],
}

const gitNote = args.is_git
  ? ''
  : 'This is NOT a git repository — skip every commit instruction; report commit as "none".'

// ---------------------------------------------------------------------------
// Phase 1: Scaffold (blocking gate — nothing runs until the build passes)
// ---------------------------------------------------------------------------
phase('Scaffold')
log(`Scaffolding ${args.feature} docs (${args.writers.length} writers queued)`)

const scaffold = await agent(
  `You are the scaffold agent for the "${args.feature}" documentation suite.
Repository root: ${args.repo_root}
Docs root: ${args.docs_root}

Read the implementation plan first: ${args.plan_path}

Then, IN ORDER:
1. Create the directory structure exactly as the plan specifies.
2. Write the main config file (mkdocs.yml / _quarto.yml / conf.py / etc.) with ALL nav
   entries pre-populated — including pages that do not exist yet — plus theme, plugins,
   and extensions as specified in the plan.
3. Write a stub for EVERY doc in the plan nav: frontmatter (if the tool requires it),
   an H1 heading, and one line "TODO: content". Use the exact paths from the plan.
4. Run: ${args.build_cmd}
   It must pass with zero errors. If it fails, fix the cause (usually a nav entry with
   no file, bad YAML, or a wrong path) and re-run until clean.
5. Write the docs index/README: one-paragraph overview + a table linking each major section.
6. ${args.is_git ? `Commit ONLY the new docs files, pathspec-scoped so pre-staged unrelated files never leak in:
   git add <explicit paths> && git commit -m "docs: scaffold ${args.feature} structure with N stubs" -- <explicit paths>` : 'Do not commit (not a git repository).'}
${gitNote}

Quality bar: the build MUST be verified passing by you, with the actual command output —
do not report build_clean=true from inference.

Your structured output: build_clean, build_errors (empty if clean), stub_count, commit hash.`,
  { label: 'scaffold', phase: 'Scaffold', schema: SCAFFOLD_SCHEMA },
)

if (!scaffold) {
  return { status: 'failed', reason: 'scaffold agent died or was skipped', results: null }
}
if (!scaffold.build_clean) {
  return {
    status: 'failed',
    reason: 'scaffold build did not pass — writers not launched',
    build_errors: scaffold.build_errors,
  }
}
log(`Scaffold gate passed: ${scaffold.stub_count} stubs, build clean (commit ${scaffold.commit})`)

// ---------------------------------------------------------------------------
// Phase 2: Writers — parallel, shared checkout, disjoint files.
// Writers do NOT commit (concurrent commits race on .git/index.lock) and do
// NOT run the build (concurrent strict builds corrupt each other's output
// dir). Phase 4 owns both.
// ---------------------------------------------------------------------------
phase('Write')

const writerResults = await parallel(
  args.writers.map((w) => () =>
    agent(
      `You are ${w.name} for the "${args.feature}" documentation suite.
Repository root: ${args.repo_root}

Read the implementation plan first: ${args.plan_path}

Your assignment (files OUTSIDE this list are off-limits — another writer owns them):
- Files to write: ${JSON.stringify(w.files_to_write, null, 2)}
- Source files to read: ${JSON.stringify(w.source_files, null, 2)}

For each doc:
1. Read the relevant source files — document the actual implementation, not the intended one.
2. If the plan and the source code disagree, follow the source code and record the
   discrepancy in corrections_vs_plan.
3. Include real code examples from the source where helpful; use tables for option/endpoint
   lists; use Mermaid for multi-step processes if the build supports it.
4. Cross-reference sibling docs with relative links — but ONLY within ${args.docs_root}.
   A link from inside the docs dir to a file outside it cannot be a doc link; render such
   references as inline code instead.

Quality bar:
- Every factual claim must be verifiable from the source you read.
- Reference code by symbol name (\`ClassName.method()\`, \`module.function()\`) — never
  file:line; line numbers go stale on the next edit.
- No placeholder text. If you lack information for an assigned file, leave its stub intact
  and record it in gaps.

HARD RULES (shared checkout — violating these corrupts other writers' work):
- Do NOT run git commit, git add, or any git-mutating command. Commits are serialized later.
- Do NOT run ${args.build_cmd} or any docs build. The final build runs after all writers finish.
- Write ONLY the files in your assignment.

Your structured output: files_written, approx_lines, corrections_vs_plan, gaps.`,
      { label: w.name, phase: 'Write', schema: WRITER_SCHEMA, ...(w.agent_type ? { agentType: w.agent_type } : {}) },
    ),
  ),
)

const liveWriters = writerResults
  .map((r, i) => ({ writer: args.writers[i], result: r }))
  .filter((x) => x.result !== null)
const deadWriters = args.writers.filter((_, i) => writerResults[i] === null).map((w) => w.name)
if (deadWriters.length) log(`WARNING: writers with no result (died/skipped): ${deadWriters.join(', ')}`)
const allGaps = liveWriters.flatMap((x) => x.result.gaps.map((g) => `${x.writer.name}: ${g}`))
log(`Writers done: ${liveWriters.length}/${args.writers.length}, ${allGaps.length} declared gaps`)

if (!liveWriters.length) {
  return {
    status: 'failed',
    reason: 'all writer agents died or were skipped — commit and verify phases not run',
    scaffold: { stub_count: scaffold.stub_count, commit: scaffold.commit },
    writers: [],
    dead_writers: deadWriters,
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Serialized commits — one agent, one commit per writer, explicit
// pathspecs. Preserves the per-section git-history shape without the race.
// ---------------------------------------------------------------------------
phase('Commit')

let commitResult = { commits: [], skipped: [], serializer_failed: false }
if (args.is_git) {
  const serialized = await agent(
    `You are the commit serializer for the "${args.feature}" documentation suite.
Repository root: ${args.repo_root}

First run: git status --porcelain
If ANY path shows unmerged status (UU, AA, DD, AU, UA, DU, UD), STOP — git refuses all
commits repo-wide while a path is unmerged. Report every writer as skipped with the
unmerged paths listed.

Otherwise, create ONE commit per writer, in this order, each scoped with explicit
pathspecs so nothing pre-staged or unrelated leaks in:
${liveWriters
  .map(
    (x) => `
- Writer ${x.writer.name}: message "${x.writer.commit_message}"
  assigned files: ${JSON.stringify(x.writer.files_to_write)}
  reported written: ${JSON.stringify(x.result.files_written)}
  command shape: git add -- <files> && git commit -m "<message>" -- <files>`,
  )
  .join('\n')}

Commit ONLY files that appear in the writer's assigned list (treat an obvious
path-form variant of an assigned entry — e.g. with vs without the docs-root prefix —
as that entry). A reported file outside the assignment is scope drift: do NOT commit
it; record it in skipped as "<writer>: out-of-scope <path>".

If a listed file does not exist on disk, omit it from that commit and note it. If a
writer's entire file list is missing, skip that writer's commit and record it in skipped.
Verify each commit landed via git log --oneline before reporting its hash.

Your structured output: commits (writer, hash, files count), skipped.`,
    { label: 'commit-serializer', phase: 'Commit', schema: COMMIT_SCHEMA },
  )
  if (serialized) {
    commitResult = { ...serialized, serializer_failed: false }
  } else {
    commitResult = { commits: [], skipped: liveWriters.map((x) => x.writer.name), serializer_failed: true }
    log('WARNING: commit-serializer agent died — no commits created')
  }
} else {
  log('Not a git repo — commits skipped')
}

// ---------------------------------------------------------------------------
// Phase 4: Final verify — strict build + link-notice sweep. mkdocs link
// validation is global-only and --strict tolerates out-of-docs-dir relative
// links, so grep the log for notices touching OUR new pages specifically.
// ---------------------------------------------------------------------------
phase('Verify')

const verify = await agent(
  `You are the final verifier for the "${args.feature}" documentation suite.
Repository root: ${args.repo_root}

1. Run ${args.build_cmd} and capture the FULL output to a log file, then read the log.
   Do not pipe through tail/head in a way that masks the exit code — check the exit
   code directly.
2. Collect every error.
3. Separately, sweep the log for link/validation notices (INFO and WARNING included —
   --strict passes some silently) that reference this suite's new pages. New-page path
   fragments: ${JSON.stringify(args.new_page_globs)}.
4. Fix what you find when the fix is unambiguous (broken relative link, wrong anchor,
   out-of-docs-dir link that must become inline code). Re-run the build after fixing.
5. ${args.is_git ? 'If you fixed anything, commit the fixes as ONE pathspec-scoped commit: "docs: fix link/build issues found in verification". Before committing, run git status --porcelain; if any path shows unmerged status (UU, AA, DD, AU, UA, DU, UD), git refuses all commits — leave the fixes uncommitted, report fix_commit as "none", and list the unmerged paths in errors. Otherwise report the commit hash as fix_commit.' : 'Do not commit (not a git repository). Report fix_commit as "none".'}
6. Do NOT fix pre-existing notices on pages outside the new-page fragments — report them
   in link_notices_on_new_pages only if they reference new pages.

Your structured output: build_clean, errors, link_notices_on_new_pages (only notices
still unresolved after your fixes — resolved ones go in fixes_applied), fixes_applied,
fix_commit.`,
  { label: 'verifier', phase: 'Verify', schema: VERIFY_SCHEMA },
)

const commitsOk =
  !args.is_git || (!commitResult.serializer_failed && commitResult.skipped.length === 0)

return {
  status:
    verify &&
    verify.build_clean &&
    verify.link_notices_on_new_pages.length === 0 &&
    deadWriters.length === 0 &&
    allGaps.length === 0 &&
    commitsOk
      ? 'complete'
      : 'complete_with_issues',
  scaffold: { stub_count: scaffold.stub_count, commit: scaffold.commit },
  writers: liveWriters.map((x) => ({
    name: x.writer.name,
    files: x.result.files_written.length,
    approx_lines: x.result.approx_lines,
    corrections_vs_plan: x.result.corrections_vs_plan,
    gaps: x.result.gaps,
  })),
  dead_writers: deadWriters,
  commits: commitResult,
  verify: verify ?? { build_clean: false, errors: ['verifier agent died'], link_notices_on_new_pages: [], fixes_applied: [], fix_commit: 'none' },
}
