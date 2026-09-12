# Herdr Workspace Title

Keep a Herdr workspace synchronized with the coding-agent session running in it.
The workspace name follows the agent's terminal title, including later session
renames, using the pattern `<session name> | <project name>`.

## Requirements

- macOS, because the watcher is managed by `launchd`
- [Herdr](https://herdr.dev)
- `jq`
- The Herdr integration for your coding agent

Install the relevant Herdr integration before enabling the plugin:

```sh
herdr integration install codex
herdr integration install claude
herdr integration install copilot
```

Only install the integrations for agents you use.

## Installation

### Codex

```sh
codex plugin marketplace add cedricvidal/coding-skills
codex plugin add herdr-workspace-title@coding-skills
```

Start a new Codex session and approve the hook when prompted.

### Claude Code

```sh
claude plugin marketplace add cedricvidal/coding-skills
claude plugin install herdr-workspace-title@coding-skills
```

### Copilot CLI

```sh
copilot plugin marketplace add cedricvidal/coding-skills
copilot plugin install herdr-workspace-title@coding-skills
```

## Behavior

The `SessionStart` hook launches one watcher for the current Herdr pane. The
watcher verifies the coding-agent session identity and continuously reads the
agent's terminal title from Herdr. Every valid title change is copied to the
containing workspace.

The watcher stops when the pane changes to another coding-agent session, when
session metadata remains unavailable, or when the workspace has been renamed
outside the plugin. Restarting or resuming the agent replaces the watcher for
that pane.

## Updating and removal

Update the marketplace, then update or reinstall the plugin with your coding
agent's plugin commands. Removing the plugin prevents new watchers from being
created; an existing watcher exits when its coding-agent session ends.
