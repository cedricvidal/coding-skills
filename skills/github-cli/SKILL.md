---
name: github-cli
type: reference
description: >-
  Best practices for using the GitHub CLI (`gh`). Covers sandboxed terminal
  workarounds, metadata fetching before creating issues or PRs, required token
  scopes, and reliable patterns for passing large content. Apply these rules
  whenever using `gh` commands, creating issues, creating pull requests, or
  managing labels, milestones, and projects.
metadata:
  author: Cedric Vidal
  version: "1.0.0"
---

# GitHub CLI Best Practices

Reference guide for using the `gh` CLI reliably and correctly.

## Sandboxed Terminal Workarounds

VS Code and other sandboxed terminals can mangle commands with complex quoting. Follow these rules:

1. **Always disable the pager** — prefix commands with `GH_PAGER=cat` to prevent alternate-buffer hangs:
   ```bash
   GH_PAGER=cat gh pr list
   ```

2. **Use single quotes** for simple string arguments:
   ```bash
   GH_PAGER=cat gh pr create --title 'Add CSV export'
   ```

3. **Never pass long markdown inline** via `--body '...'` — it will be garbled by the shell.

4. **Write complex content to a temp file first**, then reference it:
   ```bash
   # For gh pr create — use --body-file
   GH_PAGER=cat gh pr create --draft --body-file /tmp/pr-body.md --title 'Add CSV export'

   # For gh pr edit — --body-file may be ignored; use the API instead
   GH_PAGER=cat gh api repos/OWNER/REPO/pulls/NUMBER -X PATCH -F body=@/tmp/pr-body.md
   ```

5. **`gh api` with `-F field=@file`** is the most reliable way to set large text fields.

## Metadata: Always Fetch First

When working with labels, milestones, issue types, or projects, **always fetch the available options first**. Never assume what they could be.

### Batch Query (Recommended)

Fetch labels, milestones, issue types, and projects in a single GraphQL call:

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    labels(first: 100) {
      nodes { id name description color }
    }
    milestones(first: 100) {
      nodes { id title description state dueOn closedAt }
    }
    issueTypes(first: 100) {
      nodes { id name description }
    }
    projectsV2(first: 100) {
      nodes { id title shortDescription }
    }
  }
}
' -f owner='<owner>' -f repo='<repo>'
```

### Individual Fallback Commands

- **Labels:** `gh label list`
- **Milestones:** `gh api repos/:owner/:repo/milestones | jq '.[] | {id, title, description, state, due_on, closed_at}'`
- **Projects:** `gh project list`

Check repository-specific configurations before creating or assigning metadata.

## Creating Issues and Pull Requests

When creating new issues or pull requests:

1. **Fetch available metadata first** using the batch GraphQL query above.
2. **Analyze the conversation context** to determine the most relevant:
   - Labels (e.g., package-specific, component-specific, priority)
   - Milestone (based on priority or timeline mentioned)
   - Issue type (Task, Bug, Feature, or custom types)
   - Project (if applicable)
3. **Apply the inferred metadata** to the new issue or PR to ensure proper categorization and tracking.
4. **Always create pull requests as drafts** — use the `--draft` flag:
   ```bash
   GH_PAGER=cat gh pr create --draft --title 'Add CSV export' --body-file /tmp/pr-body.md
   ```
