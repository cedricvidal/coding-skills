---
name: standup-notes
type: utility
description: Creates daily standup notes. Use when the user asks to write standup notes, daily standup notes, a daily update, or a daily status update. Supports multiple projects, carries over goals from previous standup notes, and checks GitHub activity for completeness.
metadata:
  author: Cedric Vidal
  version: "1.0.0"
---

# Standup Notes

## Usage

**USE FOR:**
- User asks to create standup notes, daily standup notes, a daily update, or a status update
- User asks to update or edit existing standup notes

**DO NOT USE FOR:**
- General note-taking unrelated to standup notes
- Retrospectives or sprint reviews

## Configuration

Each project has a `standup.config.md` file that sits as a sibling to the standups folder.

**Example layout:**
```
<project-root>/
  standup.config.md
  standups/            # or daily-standups/ or "Daily standups/"
    2026-03-06/
      standup.md
    2026-03-05/
      standup.md
```

**Example `standup.config.md`:**
```markdown
# Standup Configuration

## Project
My Project

## Sections
- Yesterday's Progress
- Today's Goals

## Sources
- https://github.com/org/repo-one/
- https://github.com/org/repo-two/
```

- **Project**: The project display name.
- **Sections**: Which sections to include by default. Common values: "Yesterday's Progress", "Today's Goals", "Summary", "Blockers / Impediments", "Questions / Discussion".
- **Sources**: GitHub repository URLs to check for recent activity. This list is progressively built (see Step 6).
- **GitHub Tool** (optional): Either `gh` or `mcp`. Controls whether to use the `gh` CLI or GitHub MCP server tools for querying GitHub activity. If not set, defaults to `gh` with fallback to MCP if available. If the user expresses a preference during conversation, save it here.

## Workflow

### 1. Discover projects

- Scan the workspace recursively for files named `standup.config.md`.
- Build a list of available projects. For each config found, read the **Project** name from it.
- If the user specifies which project the standup notes are for, match it against discovered projects.
- If multiple projects exist and the user hasn't specified one, ask which project they want to create standup notes for, listing the discovered project names.
- If the user mentions a project that has no `standup.config.md`, proceed to **Step 9 (First-time setup)** to create one, then continue.

### 2. Locate the standups folder

- The standups folder is a sibling of `standup.config.md`.
- Look for a folder matching any of these names (case-insensitive): `standups`, `daily-standups`, `daily standups`.
- If no matching folder exists, create one named `standups/` as a sibling of the config file.

### 3. Resolve standup notes date

- If the user specifies a date, use that.
- Otherwise, infer the target date using the current time of day and whether standup notes already exist for today:
  - **Morning (before noon local time)**: Default to today. The user is likely preparing today's standup notes.
  - **Afternoon or later (noon or after)**: Default to the **next business day** (skip weekends). The user is likely drafting tomorrow's notes at the end of the work day. If no notes exist for today, default to today.
- Present the resolved date to the user and let them confirm or change it before proceeding.
- If standup notes already exist for the target date, inform the user and ask whether to overwrite or edit them.

### 4. Find previous standup notes and carry over goals

- List date folders in the standups directory, sorted descending.
- Find the most recent standup notes **before** the target date.
- Read that file's `standup.md` and extract the **"Today's Goals"** section content.
- Use the extracted goals as a **draft** for the new standup notes' **"Yesterday's Progress"** section.
- Present this draft to the user and ask:
  - What did you actually accomplish from these goals?
  - What changed, what should be added or removed?
  - Any additional progress not listed here?
- Incorporate the user's corrections and additions into "Yesterday's Progress".

### 5. Check GitHub sources

- Read the **Sources** section from `standup.config.md` to get the list of GitHub repository URLs.
- If no sources are configured, ask the user which GitHub repos they've been working on. Save any repos they mention to the config (see Step 6).
- Determine the date of the previous standup notes (from Step 4). Use that as the "since" date for activity queries.
- **Tool selection**: Check the **GitHub Tool** setting in `standup.config.md`. If set to `gh`, use the `gh` CLI. If set to `mcp`, use GitHub MCP server tools. If not set, prefer the `gh` CLI and fall back to GitHub MCP server tools if `gh` is not available. If the user expresses a preference for one or the other during the conversation, save it to the config under a `## GitHub Tool` section.
- For each GitHub repository, extract the owner and repo name from the URL, then check:
  - **Commits**: `gh api` or `list_commits` to find commits since the last standup notes date.
  - **Pull requests**: `gh pr list` or `list_pull_requests`/`search_pull_requests` to find PRs created, merged, or updated since the last standup notes.
  - **Issues**: `gh issue list` or `search_issues` to find issues created, closed, or updated since the last standup notes.
  - **Milestones**: Check for milestone progress if relevant.
- Compile a list of noteworthy activity the user may have missed.
- Present the suggestions to the user and ask which ones to include in the standup notes. Do not include items the user declines.

### 6. Remember new repos (progressive source discovery)

This step applies **throughout the entire conversation**, not just at a specific point in the workflow:

- Whenever the user mentions a GitHub repository they've been working on (by URL, by `owner/repo` shorthand, or by referencing PRs/issues like `repo#123`), check if that repo is already listed in the project's `standup.config.md` Sources section.
- If the repo is **not** already listed, append it to the Sources section in `standup.config.md` and confirm the addition to the user.
- This ensures the sources list grows organically as the user works across repos.

### 7. Ask about blockers and questions

After drafting progress and goals:

- Ask the user: "Do you have any **blockers or impediments** to raise?"
- Ask the user: "Any **questions or discussion points** for the team?"
- If the user provides content for either, include the corresponding section(s) in the standup notes, even if those sections are not listed in the default config. Use the section names "Blockers / Impediments" and "Questions / Discussion".
- If the user has nothing to raise, omit those sections (do not write "None").

### 8. Finalize and write the standup notes

- Assemble the standup notes using the sections from the config, plus any additional sections with content (blockers, questions).
- Section order: Summary (if configured) > Yesterday's Progress > Today's Goals > Blockers / Impediments (if content) > Questions / Discussion (if content).
- Title format: `# Standup Notes - YYYY-MM-DD`
- Create the date directory: `<standups-folder>/YYYY-MM-DD/`
- Write the file as `standup.md` inside that directory.
- Show the user the final standup notes for confirmation before writing. If they want changes, revise and ask again.

### 9. First-time setup

When no `standup.config.md` exists for a project:

1. Ask the user for the **project name**.
2. Ask where the standups folder should live (suggest creating it alongside where the config will go).
3. Ask which **sections** to include. Offer these options with defaults marked:
   - Yesterday's Progress (default: included)
   - Today's Goals (default: included)
   - Summary
   - Blockers / Impediments
   - Questions / Discussion
4. Ask which **GitHub repositories** they work on for this project. Accept URLs or `owner/repo` shorthand.
5. Create the `standup.config.md` file with the provided information.
6. Create the standups folder if it doesn't exist.
7. Continue with the normal workflow from Step 3.
