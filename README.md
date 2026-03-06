# Coding Skills

A collection of [agent skills](https://agentskills.io/specification) for software development workflows.

## Installation

```bash
npx skills add cedricvidal/coding-skills
```

## Skills

### WTM — Worktree PR Merge

The **WTM** skill orchestrates a git-worktree-based development workflow. When invoked, it:

1. Determines the base branch and fetches the latest from origin.
2. Creates a new worktree and feature branch in isolation.
3. Implements the requested changes inside the worktree.
4. Commits incrementally (with merge-guard checks if a PR already exists).
5. Pushes and creates a pull request via `gh`.
6. Merges the PR and cleans up the worktree on confirmation.

See [skills/wtm/SKILL.md](skills/wtm/SKILL.md) for the full workflow definition.

### Standup Notes

The **Standup Notes** skill creates daily standup documents. When invoked, it:

1. Discovers projects by scanning for `standup.config.md` files in the workspace.
2. Carries over previous standup's "Today's Goals" as a draft for "Yesterday's Progress".
3. Asks the user what actually happened and incorporates corrections.
4. Checks GitHub repos (commits, PRs, issues, milestones) for activity since the last standup and suggests additions.
5. Asks about blockers and questions to raise.
6. Writes the standup to `<standups-folder>/YYYY-MM-DD/standup.md`.

The skill progressively learns which GitHub repos belong to each project: whenever the user mentions a repo, it is saved to the project's config for future standups.

See [skills/standup-notes/SKILL.md](skills/standup-notes/SKILL.md) for the full workflow definition.

### Git Guardrails

The **Git Guardrails** skill enforces safety constraints for all git operations. It ensures:

- Explicit file staging (never `git add .`)
- Incremental commits after each logical step
- No automatic pushing — requires explicit user approval
- No force pushing — non-negotiable
- No amending unless the user explicitly asks
- Consistent branching conventions (`feat/<name>`, `fix/<name>`)
- Standardized worktree paths (`<workspace-root>/.worktrees/<name>`)

See [skills/git-guardrails/SKILL.md](skills/git-guardrails/SKILL.md) for the full rule set.

### GitHub CLI

The **GitHub CLI** skill provides best practices for using the `gh` CLI. It covers:

- Sandboxed terminal workarounds (`GH_PAGER=cat`, temp files for long content)
- Always fetching available metadata (labels, milestones, issue types, projects) before assigning
- A batch GraphQL query to fetch all metadata in a single call
- Required token scopes for private vs. public repositories
- Inferring and applying metadata when creating issues and PRs

See [skills/github-cli/SKILL.md](skills/github-cli/SKILL.md) for the full reference.
