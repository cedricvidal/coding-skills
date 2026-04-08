---
name: pr-review
type: workflow
description: >-
  PR review workflow — use when the user asks to review a pull request. Covers
  correct diffing against the merge base, drafting reviews locally before
  posting, and verifying findings against the actual PR diff. Apply these rules
  whenever reviewing PRs via `gh pr review`, `gh pr comment`, or similar.
metadata:
  author: Cedric Vidal
  version: "1.0.0"
---

# PR Review Workflow

Structured workflow for reviewing pull requests correctly and avoiding false findings.

## 1. Fetch PR metadata

```bash
GH_PAGER=cat gh pr view <number> --json title,body,headRefName,baseRefName,state,files,author,labels,additions,deletions,changedFiles
```

## 2. Set up a worktree for review

```bash
git fetch origin <head-branch>
git worktree add .worktrees/review-<short-name> <head-branch>
cd .worktrees/review-<short-name>
```

## 3. Diff against the merge base — NOT against latest `origin/main`

**CRITICAL:** `origin/main` may have moved since the PR was branched. Diffing against it produces false positives — changes that appear in the diff but were not introduced by the PR.

Always compute the merge base first:

```bash
git fetch origin main
MERGE_BASE=$(git merge-base origin/main HEAD)
git diff $MERGE_BASE..HEAD
```

This shows exactly the same changes GitHub displays in the PR Files tab.

**NEVER diff against `origin/main` directly:**

```bash
# WRONG — will show changes from main that are not part of the PR
git diff origin/main..HEAD

# RIGHT — only shows changes introduced by the PR
MERGE_BASE=$(git merge-base origin/main HEAD)
git diff $MERGE_BASE..HEAD
```

When checking specific files:

```bash
git diff $MERGE_BASE..HEAD -- path/to/file.ts
```

## 4. Read and understand the changed code

- Read all changed files in the worktree
- Run the test suite to verify tests pass
- Identify which test failures are pre-existing vs introduced by the PR

## 5. Draft the review locally — do NOT post immediately

**NEVER post a review without showing the user the draft first.** Present the review text in the conversation and wait for the user to approve or request edits before posting to GitHub.

This prevents embarrassing corrections and retracted reviews.

## 6. Post the review only after user approval

```bash
# Write review body to a temp file (never pass long markdown inline)
GH_PAGER=cat gh pr review <number> --approve --body-file /tmp/pr-review.md
# or
GH_PAGER=cat gh pr review <number> --request-changes --body-file /tmp/pr-review.md
# or
GH_PAGER=cat gh pr review <number> --comment --body-file /tmp/pr-review.md
```

## Common Mistakes

### False finding: "this PR renames X to Y"

If a value was already changed on the branch's base and then main reverted it, the diff against latest `origin/main` will show the change as if the PR introduced it. **Always verify against the merge base.**

### Bundled unrelated changes

Before flagging changes as "unrelated to the PR", verify they are actually from the PR's commit(s) and not inherited from the merge base. Use:

```bash
MERGE_BASE=$(git merge-base origin/main HEAD)
git diff $MERGE_BASE..HEAD -- <file>
```

If the file shows no diff against the merge base, the change is not from this PR.
