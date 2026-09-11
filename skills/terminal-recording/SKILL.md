---
name: terminal-recording
description: >-
  Record real CLI and TUI sessions as MP4 walkthroughs through ttyd, xterm.js,
  Playwright, and headless Chrome. Use for "record a terminal demo", "CLI
  walkthrough video", "TUI recording", or mixed terminal/web-app demos.
  Use attention-cues alongside this skill for visual guidance. Works without
  screen-capture, and composes with it for persistent terminal/web-app beats.
compatibility: macOS or Linux, Node 20+, Bash, ttyd with DOM renderer, Playwright, Chrome/Chromium, ffmpeg and ffprobe
metadata:
  version: "1.0.0"
allowed-tools: Bash(node:*) Bash(bash:*) Bash(ttyd:*) Bash(ffmpeg:*) Bash(ffprobe:*) Read Write Edit Glob Grep
---

# Terminal recording

Record real commands through a PTY:

`command -> PTY -> ttyd -> xterm.js DOM rows -> headless Chrome -> WebM -> MP4`

This skill owns the complete terminal-only workflow: dependency checks, terminal
setup, browser capture, screenshots, frame-aligned cuts, MP4 encoding, and
cleanup. You do not need screen-capture or any of its files.

Load **attention-cues alongside this skill** for guided demos. Follow that skill
when writing your session-local scenario, using the preparation hooks below.
The shipped recorder has no caption or highlight implementation and does not
import, discover, or require either companion. Without configured cues, describe
the result as an unannotated recording, not a captioned walkthrough.

## Dependencies and defaults

Reuse installed tools. Check `node --version`, `bash --version`, `ttyd --version`,
`ffmpeg -version`, and `ffprobe -version`. Use Node 20 or later and a ttyd build
with writable mode, origin checking, and `rendererType=dom`.

The recorder never installs software. If a native tool is missing, explain the
missing dependency and install only that tool with the user's permission.
Prefer **Homebrew when available on either macOS or Linux**, for example
`brew install ttyd` or `brew install ffmpeg`. On Linux without brew, use existing
distribution packages or approved user-local binaries; do not run root package
installation from this workflow. A system administrator can provision missing
distribution packages separately.

Reuse Playwright from the working directory or supply
`--playwright /absolute/path/to/playwright/index.mjs`. If none exists, install it
explicitly in a session scratch directory, not the repository root. For the
browser, choose one:

- `--browser /absolute/path/to/chrome`: an installed full Chrome/Chromium binary.
- `--channel chrome`: a locally installed Chrome channel.
- Neither: the full Chromium executable reported by the installed Playwright.

The recorder prints the selected executable/channel and browser version. It
does not scan hardcoded cache versions or download a browser. If Playwright's
matching binary is absent, supply an installed binary or explicitly install
its matching Chromium in scratch setup.

The standalone recorder uses **headless Chrome/Chromium**, a **1440x900** viewport
and video, **deviceScaleFactor: 1**, a dark terminal, and portable monospace
fallbacks. DPR 2 can enlarge screenshots; it does not turn a 1440x900
`recordVideo.size` into a 2880x1800 video.

## Plan and capture a standalone take

Keep scenarios, screenshots, WebMs, manifests, and MP4s in the session artifact
directory, outside git. The output directory must be new; create its parent
first. Scenarios are trusted JavaScript with full browser, filesystem, and shell
access. Read them before running them.

Plan a short sequence of actions, expected output, captions, and readable dwells.
Capture all intended actions **inside `beat()`**. Actions outside beats will not
appear in the final MP4, but their resulting state will. Set a caption before
calling `beat()` if it must appear from the first frame of that beat. Await every
hook, action, and beat; do not overlap beats or start fire-and-forget scenario work.

Create a session-local ES module with a required `run` export:

```js
export async function prepareContext({ context, outDir }) {
  // Optional: install the visual guidance you configured in your session.
  // This runs before any page creation or navigation.
}

export async function preparePage({ page, context, outDir }) {
  // Optional: add page init scripts before terminal navigation.
  // Do not navigate this page or change capture settings here.
}

export async function run({ terminal, page, context, beat, outDir }) {
  await beat(async () => {
    await terminal.command("printf '%s\\n' terminal-ready", {
      until: /^terminal-ready\s*$/m,
    });
    // Apply your companion-skill caption/highlight here, then dwell.
    await page.waitForTimeout(1800);
    await terminal.screenshot('01-output.png');
  });
}
```

```bash
node /path/to/terminal-recording/scripts/record-terminal.mjs \
  --scenario /session/files/scenario.mjs \
  --out /session/files/take-1 \
  --cwd /path/to/working-directory \
  --playwright /path/to/playwright/index.mjs \
  --browser /path/to/chrome
```

Optional native overrides: `--ttyd`, `--bash`, `--ffmpeg`, and `--ffprobe`, each
followed by an executable name or absolute path. Run either script with `--help`
for its CLI interface. Missing dependencies and invalid options fail explicitly.

On success, the directory contains `terminal.mp4`, `terminal.mp4.json` with
measured frame ranges, `result.json`, `beats.json`, source WebMs, marker paint
screenshots, scenario screenshots, and a ttyd log. The wrapper flushes the owned
context, stops ttyd, closes its browser, then assembles one MP4. On failure it
retains sources and diagnostics, writes `failure.json` once capture setup has
created the output directory, and exits nonzero.

## Terminal actions and readiness

`createTerminalSession()` and the standalone scenario expose the same helpers:

| Helper | Contract |
|--------|----------|
| `command(line, { until, delay = 25, timeout = 15000 })` | Type one shell input line, press Enter, wait for the required string/RegExp in visible DOM rows. |
| `waitForText(stringOrRegExp, { timeout = 15000 })` | Wait for visible terminal output. |
| `type(text, { delay = 25 })` | Type literal characters into the terminal. |
| `key('Enter')`, `key('Escape')`, `key('Control+c')` | Send control keys. |
| `text()` | Read visible DOM rows, separated by newlines. |
| `screenshot('01-state.png')` | Save the viewport in the session output directory. |
| `close()` | Stop this session's ttyd and write its log; leave borrowed capture resources open. Idempotent. |

The helpers wait for the initial clean `demo $` prompt and verify DOM-rendered
rows. After that, you own application readiness. Match fresh output, not the
echoed command, an old result, or a prompt left in scrollback. `command()` does
not infer process exit status or completion from text; check the expected result
and, where needed, wait for a returned prompt or application-specific state.
Use anchored output patterns and unique values for repeated commands.

For TUIs, wait for a known screen or state change. A continuously updating TUI
will never become silent. Use `await terminal.type('M')` or
`await page.keyboard.type('P')` for literal uppercase shortcuts, not `Shift+m`.
Use key presses for Enter, Escape, and control combinations.

Prefer bounded, non-streaming log excerpts and confirm that the excerpt contains
the evidence you intend to show. Add short dwells *after* readiness checks for
readability; a dwell does not prove readiness.

With attention-cues, verify the highlight target resolves before starting it.
Use `.xterm-rows > div` only after DOM-renderer readiness. For output that scrolls,
highlight the terminal container rather than a row that may be recycled. Keep
captions away from relevant output and inspect their position in encoded frames.
Use the loaded companion's implementation and styling in your scenario; do not
copy a second HUD into this skill.

## Mixed terminal and web-app recordings

You may use screen-capture alongside this skill for web-app walkthrough guidance.
Choose **one capture owner** before starting. For this combined workflow, use
headless mode, 1440x900 capture, and DPR 1 by default, unless the user chooses
headed mode. These settings apply to this workflow, not unrelated screen-capture
sessions. Configure guidance through your session-local hooks.

Keep **two persistent pages in one context**: one for ttyd and one for the app.
Do not navigate either away to select the other view. This retains the PTY,
shell variables, running TUI, WebSocket connection, web-app JavaScript state,
and unsaved form fields.

Playwright records a **separate video per page**. Focusing a tab does not select a
shared video stream. Do not call `page.bringToFront()`: in the tested headless
Chrome 145 build it clipped 87 pixels from recorded frames even though screenshots
looked correct. Address the two page objects directly; the beat timeline chooses
the final view. The MP4 switches between page content, not a browser tab bar.

Use the composable API from a trusted session-local capture owner:

```js
import {
  captureDefaults, createTerminalSession, launchBrowser,
} from '/path/to/terminal-recording/scripts/record-terminal.mjs';
import {
  createTimeline, assembleBeats,
} from '/path/to/terminal-recording/scripts/assemble-beats.mjs';

// Supply outDir, dependency overrides, and scenario actions in your own module.
const browser = await launchBrowser({ playwrightPath, executablePath });
let context;
let terminal;
let manifestPath;
try {
  context = await browser.newContext({
    ...captureDefaults,
    recordVideo: { dir: `${outDir}/sources`, size: captureDefaults.viewport },
  });
  // Install your session's guidance here, before either page navigates.
  const terminalPage = await context.newPage();
  const webPage = await context.newPage();
  terminal = await createTerminalSession({
    page: terminalPage, cwd, outDir,
    // Optional preparePage({ page, context }) runs before ttyd navigation.
  });
  await webPage.goto(appUrl);
  // Await the app's ready state. Both pages stay alive until capture ends.
  const timeline = await createTimeline({
    views: { terminal: terminalPage, web: webPage },
    manifestPath: `${outDir}/beats.json`,
  });
  await timeline.beat('terminal', async () => { /* shell action + cues + dwell */ });
  await timeline.beat('web', async () => { /* edit unsaved form + cues + dwell */ });
  await timeline.beat('terminal', async () => { /* retained shell state */ });
  await timeline.beat('web', async () => { /* retained unsaved form */ });
  manifestPath = await timeline.finish();
} finally {
  // Nested finally blocks also release resources if an earlier close fails.
  try { await context?.close(); }
  finally {
    try { await terminal?.close(); }
    finally { await browser.close(); }
  }
}
// Only the owner flushes videos and calls assembly, once capture succeeded.
await assembleBeats({ manifestPath, outputPath: `${outDir}/mixed.mp4` });
```

`createTerminalSession({ page, outDir, cwd, preparePage, ttydPath, bashPath,
timeoutMs, signal })` requires a designated fresh `about:blank` page and borrows
its context. It does not create, close, resize, or change recording options on
the caller's page/context/browser, and does not transcode its video. It only
navigates the designated terminal page during setup. Its `close()` stops its
own ttyd and detaches its own listeners. The page and context remain usable.
The owner must provide `finally` cleanup and handle SIGINT/SIGTERM; a supplied
AbortSignal interrupts readiness waits but does not transfer capture ownership.
The standalone CLI handles these signals for its owned resources.

### Encoded-frame synchronization and assembly

`createTimeline({ views, manifestPath, ffmpeg })` returns `beat(view, action)` and
`finish()`. Supply a new manifest path and recorded, persistent pages with unique
names. The helper refuses to overwrite an existing manifest. Do not change
their viewport, recording settings, or lifecycle during a take.

For each beat, the helper paints a full-frame magenta boundary, waits for two
animation frames, captures and checks a screenshot, holds for 800ms, removes it,
and allows 120ms for repaint before running the action. It repeats the boundary
after the action. The manifest records the view and the two marker indices.
These are capture markers, not visual guidance. Avoid full-frame magenta content
in your demo; it would make synchronization ambiguous.

After you close the capture context, the assembly helper decodes **each source**
and measures marker ranges in that video's frame sequence. It does not assume
that videos start together, or use browser-context creation time as a video
origin. It rejects missing/extra/short marker ranges, empty/overlapping beats,
unpaired boundaries, and mismatched dimensions or frame rates.

Every cut uses `[end of opening marker, start of closing marker)` in integer
frames. Each beat starts at zero on the concatenation timeline, so unselected-page
time stays out of the MP4 and clock drift cannot accumulate. The helper retains
all clean frames inside the boundaries, including the short repaint dwell; it
does not impose a requested wall-clock duration or silently shorten actions.
The supported source format is constant **25fps** Playwright video, with matching
even dimensions. Other source rates fail instead of guessing an alignment.

```bash
node /path/to/terminal-recording/scripts/assemble-beats.mjs \
  --manifest /session/files/take-1/beats.json \
  --out /session/files/take-1/mixed.mp4
```

The helper encodes H.264/yuv420p with faststart, checks frame count, duration,
dimensions and marker exclusion, and publishes the MP4 and its `.mp4.json`
alignment report without overwriting existing files. It never closes browser
resources. Keep source recordings and the manifest until assembly succeeds;
the scripts retain them even after success. On encoding failure, inspect the
reported `assembly-*` diagnostic directory and retry with the same sources.

## Safety and final inspection

ttyd exposes a real shell. The recorder binds to `127.0.0.1`, checks WebSocket
origins, limits access to one client, and selects a kernel-allocated port. Do not
forward that port or publish the shell. Loopback access is not protection from
other local users; run only on a trusted machine.

The recorder starts non-login Bash with its own rc, disables history, bypasses
user inputrc/startup scripts and inherited Bash functions, and uses noninteractive
pagers. It does not force a locale, change global configuration, or isolate the
commands from the host. Review commands and output for secrets, personal paths,
tokens, and unrelated process arguments. Avoid commands that daemonize; the
terminal session owns ttyd and its PTY job, not independently detached services.

The standalone owner releases its resources on success, failure, SIGINT, and
SIGTERM. Borrowed-session owners must do the same. Forced termination and SIGKILL
cannot guarantee application cleanup; inspect the retained ttyd log if shutdown
reports a failure. Never kill unrelated processes to clean up a recording.

If you create extra recorded pages in your capture owner, navigate and allow
them to paint before closing them. With the tested Playwright/Chrome combination,
closing an unused `about:blank` recording page left its video encoder waiting for
input. The terminal setup navigates its designated page; avoid unused probe tabs.

Before delivering:

1. Read `result.json` or the alignment report, and use ffprobe to confirm nonzero
   duration, expected resolution, H.264, yuv420p, and 25fps.
2. Decode the MP4 with ffmpeg. Inspect representative **encoded frames**, including
   first/last frames of cuts, real output, highlight targets, and the bottom
   caption area. Screenshots alone cannot reveal recorded-stream cropping.
3. Confirm that the final video has no markers or setup frames, that commands
   reached the intended state, and that captions remain readable through cuts.
4. For mixed takes, check a retained shell value, the same WebSocket connection,
   and an unsaved form value after switching. Check borrowed-resource usability
   after terminal cleanup. Deliver artifact paths without opening a player.

Version-specific alternative-browser note: the tested Homebrew Obscura 0.2.2
package lacked rendering, and the tested official release had a WebSocket stub
that prevented ttyd use. Those observations do not describe future releases.
Use full Chrome/Chromium for this workflow.
