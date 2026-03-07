---
name: git-guardrails
type: safety
description: >-
  Safety guardrails for git operations. Enforces explicit file staging, prevents
  force pushes, controls when pushing and amending are allowed, and standardizes
  branching and worktree conventions. Apply these rules whenever performing git
  commits, pushes, branch creation, or worktree operations.
metadata:
  author: Cedric Vidal
  version: "1.0.1"
---

# Git Guardrails

Always-on safety constraints for any git operation. These rules apply universally — override only when a repository's own instructions explicitly say otherwise.

## Staging & Committing

**NEVER use `git add .` or `git add -A`.** Always explicitly list the files to stage:

```bash
git add path/to/file1 path/to/file2
```

This prevents accidentally committing unrelated files (IDE settings, local configs, build artifacts, secrets).

**Commit incrementally** — after each logical step, not in one giant batch. Small, focused commits are easier to review, bisect, and revert.

## Pre-Commit Checklist

Before EVERY `git commit` command, verify ALL of the following:

1. **Files are explicitly staged** — no `git add .` or `git add -A`
2. **No `--amend` flag** — unless the user explicitly asked to amend
3. **No `--no-verify` flag** — unless the user explicitly asked to skip hooks

## Amending

**NEVER amend commits** unless the user explicitly asks to amend.

Always create a new commit instead. Amending rewrites history and, if the commit has been pushed, forces collaborators to deal with diverged branches.

### Common Trap: Fixing a Build Error After Committing

When a build or test fails right after committing, the instinct is to amend.
**Do NOT amend.** Create a new commit:

```bash
# WRONG — do not do this
git commit --amend --no-edit

# RIGHT — always a new commit
git commit -m "fix: correct the issue"
```

## Pushing

**NEVER push to a remote automatically.** Only run `git push` when the user explicitly asks to push.

Commits can be made freely — they are local and safe. Pushing affects the remote and requires explicit user approval.

## Force Pushing

**NEVER force push. This is non-negotiable.**

Do not use:
- `git push --force`
- `git push -f`
- `git push --force-with-lease`
- Any variant that rewrites remote history

If history needs to be rewritten, the user will do it manually. There are no exceptions to this rule.

## Branching Convention

Branch names follow the pattern:

```
feat/<feature-name>
fix/<fix-name>
```

> **Note:** Conventions vary by repository. Always check repo-level instructions first — they take precedence over this default.

## Pull Requests

When creating a pull request, **always specify `--base` explicitly**:

```bash
gh pr create --base <target-branch> ...
```

The target branch should follow the repository's convention (common patterns: `main`, `dev`, `develop`). Never assume a default — check repo instructions or ask the user.
