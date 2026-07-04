---
name: worktree-teardown
description: Remove a git worktree and clean up its branch, project-specific resources (from .claude/worktree.md Teardown extras), and port allocation. Safe by default — refuses if unmerged or dirty unless --force. Generic protocol — if the project ships its own /teardown-worktree skill, prefer that instead.
argument-hint: "<worktree-name> [--force]"
---

# Worktree Teardown: $ARGUMENTS

Remove a git worktree and clean up associated resources: branch, project-specific resources (Docker volumes, caches — whatever `.claude/worktree.md` declares), port allocations.

**Scope note:** Generic protocol. If the project has its own `/teardown-worktree` skill, use that instead.

## Usage

```
/worktree-teardown <name>            Safe — refuses if unmerged commits or dirty tree
/worktree-teardown <name> --force    Remove even with unmerged commits / dirty tree
/worktree-teardown                   List active worktrees and ask which to remove
```

Argument provided: "$ARGUMENTS"

---

## Step 0: Parse & Resolve

- **Empty** → list worktrees, ask the user to pick one.
- **`<name>`** → safe mode. **`<name> --force`** → force mode.

```bash
BRANCH=$(git -C .worktrees/<name> branch --show-current)
DEFAULT=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
[ -z "$DEFAULT" ] && DEFAULT=$(git branch --list main master --format='%(refname:short)' | head -1)
```

Read `.claude/worktree.md` if present — the `## Teardown extras` section lists project cleanup to run first.

## Step 1: Pre-Teardown Checks

### 1.1 Worktree Exists

```bash
git worktree list --porcelain | grep -A2 ".worktrees/<name>"
```

Not found → report and stop.

### 1.2 Unmerged Work

```bash
git log "$DEFAULT".."$BRANCH" --oneline
```

Unmerged commits exist:
- **Safe mode:** stop — "Branch has N unmerged commits. `/worktree-merge <name>` first, or use `--force`."
- **Force mode:** warn, list the commits, proceed.

### 1.3 Uncommitted Changes

```bash
git -C .worktrees/<name> status --porcelain
```

Dirty: safe mode → stop; force mode → warn and proceed.

## Step 2: Teardown

### 2.1 Project Cleanup (config: `## Teardown extras`)

Run the configured cleanup commands (e.g. `docker compose … down -v`, volume removal). Skip if no config or no section. Tolerate already-stopped resources (`|| true`).

### 2.2 Remove Worktree and Branch

```bash
git worktree remove .worktrees/<name> --force
git branch -d "$BRANCH" 2>/dev/null || git branch -D "$BRANCH"
```

`-d` first (fails if unmerged); fall back to `-D` only in force mode.

## Step 3: Report

```
Worktree removed.

Worktree: .worktrees/<name>/
Branch:   <branch> (deleted)
Cleanup:  <teardown extras run, or "none configured">
Ports:    freed (<from .env.worktree, if it existed>)

Active worktrees remaining:
<output of git worktree list>
```

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Worktree not found | "Worktree `.worktrees/<name>/` not found." |
| Unmerged commits (safe mode) | "Use `--force` or `/worktree-merge <name>` first." |
| Uncommitted changes (safe mode) | "Commit, stash, or use `--force`." |
| Currently on the worktree branch | "Switch to the default branch first." |
| No argument, no worktrees | "No active worktrees found. Nothing to tear down." |

## Checklist

- [ ] Validated worktree exists
- [ ] Checked unmerged commits (safe mode)
- [ ] Checked uncommitted changes (safe mode)
- [ ] Ran project teardown extras (if configured)
- [ ] Removed worktree and deleted branch
- [ ] Reported cleanup summary with remaining worktrees
