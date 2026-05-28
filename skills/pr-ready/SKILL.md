---
name: pr-ready
type: workflow
description: >-
  Use when the user wants to finalize a draft PR for review. Triggers include:
  "get this PR ready", "monitor CI and fix issues", "finalize the PR",
  "mark as ready for review", or any request to shepherd a PR from draft to
  review-ready state.
metadata:
  author: Cedric Vidal
  version: "1.0.0"
---

# PR Ready Workflow

End-to-end workflow for taking a draft PR from "just pushed" to "ready for review."

## Prerequisites

- A pull request already exists (draft or otherwise) on the current branch.
- The branch has been pushed to origin.

---

## Phase 1: Monitor CI and Fix Failures

### 1.1 Identify the CI run

```bash
gh run list --branch <current-branch> --limit 1 --json databaseId,status,conclusion
```

### 1.2 Watch the run

Poll or watch the CI run until it completes:

```bash
gh run view <run-id> --json status,conclusion,jobs \
  --jq '{status: .status, conclusion: .conclusion, failed_jobs: [.jobs[] | select(.conclusion == "failure") | .name]}'
```

### 1.3 On failure: diagnose and fix

For each failed job:

1. **Retrieve logs:**
   ```bash
   gh run view <run-id> --log-failed 2>&1 | tail -80
   ```
2. **Identify the root cause** from the logs.
3. **Fix the code** — make targeted changes to resolve the failure.
4. **Commit and push** — create a new commit (never amend) and push.
5. **Repeat** — wait for the new CI run and check again.

### 1.4 Non-obvious checks

Beyond the GitHub Actions workflow runs, also check for GitHub status checks and any required checks that may not appear as workflow jobs. Use:

```bash
gh api repos/<owner>/<repo>/commits/<sha>/check-runs --jq '.check_runs[] | {name, status, conclusion}'
gh api repos/<owner>/<repo>/commits/<sha>/status --jq '.statuses[] | {context, state, description}'
```

Some checks are external (e.g., deployment gates, third-party integrations) and won't show up in `gh run list`.

### 1.5 Loop until green

Repeat 1.2–1.4 until ALL required checks pass (or are skipped by design). Non-required checks that remain pending or failed can be noted but should not block the workflow.

---

## Phase 2: Update PR Title and Description

### 2.1 Compute the net diff

**CRITICAL:** Diff against the merge base, not the base branch tip directly. First, get the PR's base branch and merge base from the GitHub API:

```bash
# Get the PR's base ref and merge base commit
PR_BASE=$(gh api repos/<owner>/<repo>/pulls/<number> --jq '.base.ref')
MERGE_BASE=$(gh api repos/<owner>/<repo>/compare/${PR_BASE}...<head-branch> --jq '.merge_base_commit.sha')
git diff $MERGE_BASE..HEAD --stat
```

This shows the net effect of the PR — back-and-forth commits that cancel each other out are invisible in this diff.

### 2.2 Understand the change holistically

- Read the diff stat and key file changes.
- Focus on the **net result**, not the commit history. If commits A, B, C introduced something and commit D reverted half of it, describe only what remains.
- Identify: what problem is solved, what approach was taken, what key decisions were made.
- **Incorporate context from the conversation.** The user may have explained motivations, constraints, or design rationale during the session that are not apparent from the diff alone. These details belong in the PR description.

### 2.3 Write the title

- Describe the outcome, not the process.

### 2.4 Write the description

Structure:

1. **Motivation** — 1-2 sentences on why this change exists. Include context the user provided about the problem or goal, even if it's not visible in the code. Link the source issue if applicable.
2. **Approach** — summarize the key design decisions and how pieces fit together. Don't list files.
3. **Key decisions** — call out non-obvious trade-offs, temporary workarounds, or areas needing careful review. Include rationale the user shared for why certain approaches were chosen or rejected.
4. **Scope** — one line: files changed count, tests passing.

Guidelines:
- Keep length proportional to change size.
- Use plain ASCII punctuation (no smart quotes, em dashes).
- If back-and-forth happened in the commit history (e.g., a schema rename that was later reverted), do NOT mention it — describe only the final state.
- If the PR resolves an issue, include `Resolves owner/repo#N` on its own line for auto-closing.
- **Retain user-provided context** — if the user explained why something was done a certain way, or called out future work, or provided acceptance criteria, include that in the description even if the diff alone wouldn't tell that story.

### 2.5 Update the PR

```bash
gh api repos/<owner>/<repo>/pulls/<number> -X PATCH \
  -f title='<new title>' \
  -f body='<new body>'
```

Use the REST API with `-f body=@/tmp/pr-body.md` for long descriptions to avoid shell quoting issues.

---

## Phase 3: Mark Ready and Assign Reviewer

### 3.1 Mark as ready for review

```bash
gh pr ready <number>
```

### 3.2 Ask the user who should review

**ALWAYS ask the user** who should be assigned as reviewer. Do not assume. Present the question clearly:

> "The PR is now ready for review. Who should I request a review from?"

If the user provides a name (not a GitHub username), look up collaborators:

```bash
gh api /repos/<owner>/<repo>/collaborators --jq '.[].login'
```

Match the name to a username and confirm with the user if ambiguous.

### 3.3 Request the review

```bash
gh api /repos/<owner>/<repo>/pulls/<number>/requested_reviewers \
  -X POST -f 'reviewers[]=<username>'
```

If assigning fails due to token scope limitations, inform the user and provide a direct link to assign manually.

---

## Error Handling

- **Token scope errors** (`read:org` required): Fall back to REST API endpoints. If those also fail, inform the user with the specific permission needed.
- **CI stuck/queued for too long**: After 30 minutes of no progress, inform the user rather than waiting indefinitely.
- **Flaky tests**: If a test fails, passes on retry, then fails again, flag it as potentially flaky and ask the user whether to proceed or investigate.
- **Merge conflicts**: If CI fails due to merge conflicts with the base branch, inform the user — do not auto-rebase without explicit approval.
