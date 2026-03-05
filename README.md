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
