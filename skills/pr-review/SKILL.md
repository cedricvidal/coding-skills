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

First, determine whether the current workspace already contains the PR's repository:

- **If yes** — create a worktree directly:
  ```bash
  git fetch origin <head-branch>
  git worktree add .worktrees/review-<short-name> <head-branch>
  cd .worktrees/review-<short-name>
  ```
- **If no** — check whether the repo is cloned elsewhere in the workspace (e.g. a monorepo with multiple top-level folders). If the location is obvious from context, `cd` there. If not, **ask the user** where to find or clone the repo before proceeding.

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

## 7. NEVER delete a review without explicit user confirmation

**CRITICAL:** Deleting a pending or submitted review is a destructive, irreversible action. **NEVER** delete a review (via `deletePullRequestReview` mutation or any other method) without first asking the user for explicit confirmation and explaining what will be deleted.

If a pending review blocks submitting a new one, inform the user and ask whether they want to delete it — do NOT delete it automatically.

## 8. Review techniques for complex PRs

### Data structure comparison across layers

For PRs that modify types or schemas, compare structures across boundaries (API input → API response → MongoDB/storage) and across time (main vs PR). This surfaces redundancy, unnecessary complexity, and dead fields that code-level review alone misses.

### Trace data flow end-to-end

Follow data from client input through API logic to storage to queue/consumers. This reveals:
- Dead fields with no downstream consumer
- Redundant data duplicated across layers
- Design inconsistencies between input and output contracts

### Constructive counter-proposals

Beyond identifying issues, propose concrete alternative designs with a clear rationale. Show the "before and after" so the author can evaluate the tradeoff.

### "Table it" as valid feedback

When a sub-feature isn't fully baked (e.g. a CLI UX that doesn't match the project's idiom), suggest deferring it to a follow-up rather than blocking the whole PR or accepting half-baked work.

### Iterate fully on the draft before posting

For complex reviews, keep refining the draft locally through multiple rounds of analysis until you have one cohesive comment that covers: the problem, the counter-proposal, and a summary table showing current → proposed → suggested. Avoid posting incremental comments that force the author to piece together feedback from multiple threads.

### Include a data structure summary for schema-changing PRs

When a PR modifies types/schemas, the review draft should include a comparison table showing the structures on main, as proposed, and as suggested — scoped only to the fields relevant to the discussion. This gives the author immediate clarity on the cumulative impact of the feedback.
