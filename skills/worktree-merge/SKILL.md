---
name: worktree-merge
description: Merge a worktree feature branch back to the default branch in any project. Strips the worktree CLAUDE.md header, runs the project's test gate (from .claude/worktree.md), merges --no-ff, and verifies post-merge. Generic protocol — if the project ships its own /merge-worktree skill, prefer that instead.
argument-hint: "<worktree-name>"
---

# Worktree Merge: $ARGUMENTS

Merge a worktree feature branch back to the default branch safely: CLAUDE.md header stripping, test verification, clean merge commit.

**Scope note:** Generic protocol. If the project has its own `/merge-worktree` skill, use that instead.

## Usage

```
/worktree-merge <name>    Merge .worktrees/<name>/ branch back to the default branch
/worktree-merge           List active worktrees and ask which to merge
```

Argument provided: "$ARGUMENTS"

---

## Step 0: Parse & Resolve

- **Empty argument** → list worktrees (`git worktree list --porcelain`), ask the user to pick one.
- **`<name>`** → worktree dirname (not branch name).

Resolve context:

```bash
BRANCH=$(git -C .worktrees/<name> branch --show-current)
DEFAULT=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
# Fallback if no remote HEAD is set:
[ -z "$DEFAULT" ] && DEFAULT=$(git branch --list main master --format='%(refname:short)' | head -1)
```

Validate: `.worktrees/<name>/` exists; `$BRANCH` is not `$DEFAULT`.

Read `.claude/worktree.md` if present — the `## Test command` section defines the merge gate. If there is no config and no test command, ask the user once for the test command, or get explicit confirmation to merge without a test gate. Never silently skip testing.

## Step 1: Pre-Merge Checks (all must pass)

### 1.1 Clean Working Trees

```bash
git -C .worktrees/<name> status --porcelain
git status --porcelain
```

Either dirty → report the files and stop: "Commit or stash changes before merging."

### 1.2 Test Gate on the Worktree

Run the configured test command **inside the worktree** (via `-C`/`--project`-style flags or a subshell — never a bare `cd`). Tests fail → report and stop. Partial-green is not green.

### 1.3 Strip the Worktree CLAUDE.md Header

```bash
grep -c '<!-- WORKTREE CONTEXT' .worktrees/<name>/CLAUDE.md 2>/dev/null || true
```

If present:

```bash
(cd .worktrees/<name> && sed -i '' '/<!-- WORKTREE CONTEXT/,/<!-- END WORKTREE CONTEXT -->/d' CLAUDE.md)
git -C .worktrees/<name> add CLAUDE.md
git -C .worktrees/<name> commit -m "chore: strip worktree header from CLAUDE.md"
```

## Step 2: Merge

```bash
git checkout "$DEFAULT"
git pull --rebase origin "$DEFAULT" 2>/dev/null || true
git merge --no-ff "$BRANCH"
```

If `CLAUDE.md` conflicts or still carries worktree artifacts, restore the default branch's version (back up the branch copy first):

```bash
cp CLAUDE.md CLAUDE.md.worktree-backup 2>/dev/null || true
git checkout "$DEFAULT" -- CLAUDE.md
git add CLAUDE.md
git commit --amend --no-edit
```

## Step 3: Post-Merge Verification

Run the same test command on the default branch checkout. Then:

```bash
git status --porcelain
git log --oneline -3
```

## Step 4: Report

```
Merge complete.

Branch:       <branch> → <default>
Merge commit: <hash>
Tests:        <pre-merge result> / <post-merge result>
CLAUDE.md:    clean (worktree header stripped | no header found)

Next steps:
- /worktree-teardown <name> to remove the worktree
- git push origin <default> to publish (confirm first — never push unprompted)
```

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Worktree not found | "Worktree `.worktrees/<name>/` not found. Run `git worktree list`." |
| Uncommitted changes | "Commit or stash changes before merging." List the dirty files. |
| Tests fail | "Fix failing tests before merging." Show the failing output. |
| Merge conflict | Report conflicting files: "Resolve conflicts, then `git merge --continue`." |
| No test command configured | Ask for one, or get explicit confirmation to merge ungated. |
| No argument, no worktrees | "No active worktrees found. Nothing to merge." |

## Checklist

- [ ] Resolved worktree, branch, and default branch
- [ ] Test gate identified (config, user-provided, or explicitly waived)
- [ ] Both working trees clean
- [ ] Tests pass on worktree
- [ ] CLAUDE.md worktree header stripped (if present)
- [ ] Merged with `--no-ff`
- [ ] Tests pass on default branch post-merge
- [ ] Reported merge commit hash and next steps
