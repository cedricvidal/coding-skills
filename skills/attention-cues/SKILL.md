---
name: attention-cues
description: >
  Inject on-screen visual-attention devices into Playwright UX recordings and
  screenshots so the viewer's eye is steered to the exact element each beat is
  about. Provides a drop-in `window.__demo` toolkit: a caption HUD, a magnetised
  highlight ring, a spotlight scrim that dims the rest of the page, a label badge
  that names the target, a synthetic click (so toggles actuate on camera), and
  smooth-scroll framing. Use this skill whenever you record a walkthrough video,
  record "beats", or capture annotated screenshots of a running web app — it is
  the companion to the `screen-capture` skill. Trigger on: "record beats",
  "walkthrough video", "demo video", "annotated screenshots", "highlight the UI",
  "point the viewer at X", "make a captioned recording".
compatibility: macOS or Linux, Node 18+, Playwright (any version in the workspace)
metadata:
  version: "1.0.0"
allowed-tools: Bash(node:*) Bash(ffmpeg:*) Bash(ls:*) Bash(mkdir:*) Bash(rm:*) Read Write Edit Glob Grep
---

# Attention cues for UX recordings & screenshots

A silent screen recording forces the viewer to hunt for what changed. These
**attention cues** turn a recording into a guided tour: each beat highlights one
element, names it, dims everything else, and narrates it. Use them **every time**
you record beats or capture annotated screens.

This skill pairs with `screen-capture` (which handles environment setup,
viewport/DPR, transcoding to MP4, pacing, and PR embedding). This skill owns the
*in-page* layer: what the viewer sees drawn on top of the app.

> Drop-in toolkit: [`scripts/attention-cues.mjs`](scripts/attention-cues.mjs).
> Import it, install once, and call the cues per beat.

## The six devices

| Device | What it does | Why it matters |
|--------|--------------|----------------|
| **Caption HUD** | Floating subtitle pill at bottom-center (`#__hud`), dark translucent + `backdrop-filter: blur`, fades via opacity. | Explains intent. Legible on light **and** dark themes. `pointer-events:none` + top z-index so it never blocks clicks. |
| **Magnetised ring** | Accent outline (amber `#f59e0b`) drawn around the target, re-positioned every frame via `requestAnimationFrame` reading `getBoundingClientRect()`. | Pins attention to one element and **tracks it through scroll/layout**; auto-hides when the target leaves the viewport. |
| **Spotlight scrim** | A giant box-shadow (`0 0 0 9999px rgba(0,0,0,0.2)`) on the ring that dims the rest of the page. | Makes the highlighted element pop without modifying app DOM/CSS. |
| **Label badge** | Small accent tag floating above the target (clamped to the viewport; flips below if no room). | The "pointing finger" — names the thing ("Editable gate prompt", "Build pre-selected & locked"). |
| **Synthetic click** | Dispatches a full `pointerover→pointerdown→mousedown→pointerup→mouseup→click` sequence. | Toggles/checkboxes visibly actuate on camera instead of snapping. |
| **Smooth scroll** | `scrollIntoView({block:'center'})` before highlighting. | The showcased element is always centered when the ring appears. |

All six are injected as a single `window.__demo` controller via
`addInitScript`, so they survive SPA navigations and never touch the app's code.

## Quick start

```js
import { installAttentionCues, cues } from '/abs/path/to/attention-cues.mjs';

const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await installAttentionCues(context);          // BEFORE first navigation
const page = await context.newPage();
const ui = cues(page);

await page.goto(BASE + '/runs/new', { waitUntil: 'domcontentloaded' });
await ui.scrollTo({ selector: '#task' });
await page.fill('#task', 'Create a TicTacToe Vite TS game');
await ui.hlStart({ selector: '#task' }, 'Task = Select gate prompt');
await ui.caption('Start with the task — the Select gate prompt', 3200);
await ui.hlStop();
```

## The per-beat pattern (use this rhythm for every beat)

```
hlStop()                         // 1. clear the previous highlight
→ scrollTo(target)               // 2. center the next target
→ action  (fill / clickEl / nav) // 3. perform the visible change
→ hlStart(target, 'Label')       // 4. ring + scrim + badge
→ caption('One-line narration')  // 5. subtitle + dwell
```

Then the next beat opens with `hlStop()` again. Keep one element highlighted per
beat — competing rings dilute attention.

### A beat array (data-driven recordings)

```js
const BEATS = [
  { run: async () => { await ui.scrollTo({ text: 'Gate pipeline', climb: 1 });
                       await ui.hlStart({ text: 'Gate pipeline', climb: 1 }, 'Gate pipeline'); },
    caption: 'Runs flow through ordered gates: Select → Build → Test → Run → Deploy', ms: 3600 },
  { run: async () => { await ui.hlStop();
                       await ui.clickEl({ scopeText: 'Project builds / compiles successfully',
                                          scopeClosest: '[class*="rounded-md"]', selector: '[role="checkbox"]' }); },
    caption: 'Enable a phase gate — here, Build', ms: 3000 },
];
for (const b of BEATS) { await b.run(); await ui.caption(b.caption, b.ms); }
```

## Selector spec (the `resolve` engine)

Every cue takes a **spec object**, resolved in-page (no brittle XPaths):

| Spec | Meaning |
|------|---------|
| `{ selector }` | First **visible** CSS match |
| `{ selector, nth }` | The nth visible match |
| `{ selector, text }` | CSS match whose trimmed text matches `/text/i` |
| `{ text }` | Smallest visible element whose text matches `/text/i` |
| `{ …, closest: '.card' }` | Climb to nearest ancestor matching a CSS selector |
| `{ …, climb: 2 }` | Climb N `parentElement`s (frame a wrapper/card) |
| `{ scopeText, scopeClosest, selector }` | Scope the search to a region first, then match inside it |

Visibility-filtered throughout (width/height > 1, not `hidden`/`display:none`)
and text matches prefer the **smallest** element, so labels land tightly on the
real control. Probe first with `await ui.resolves(spec)` if a selector is risky.

## Using cues for annotated **screenshots**

The same ring/scrim/badge make great static callouts — highlight, then shoot:

```js
await ui.scrollTo({ selector: '#build-prompt' });
await ui.hlStart({ selector: '#build-prompt' }, 'Editable gate prompt');
await page.waitForTimeout(180);                       // let the ring fade in
await page.screenshot({ path: 'out/05-build-prompt.png', fullPage: false });
await ui.hlStop();
```

Hide the caption HUD (`ui.hideCaption()`) for clean screenshots if you only want
the ring + badge.

## Theming (light/dark decks, brand accent)

`installAttentionCues(target, theme)` accepts overrides — defaults are amber +
dark HUD, which read well on both themes:

```js
await installAttentionCues(context, {
  accent: 'rgba(59,130,246,0.95)',     // ring color (blue)
  accentSolid: 'rgba(59,130,246,0.97)',// badge bg
  accentText: '#fff',                  // badge text
  hudBg: 'rgba(15,15,17,0.82)',        // caption pill bg
  scrim: 0.28,                         // 0..1 — how hard to dim the rest
});
```

## Checklist

- [ ] `installAttentionCues(context)` called **before** the first `goto`.
- [ ] Every beat follows `hlStop → scrollTo → action → hlStart → caption`.
- [ ] Exactly one ring on screen at a time.
- [ ] Badge labels are short noun phrases (≤4 words), not sentences — the caption
      carries the sentence.
- [ ] Toggles/checkboxes use `clickEl` (synthetic sequence), not just `page.click`,
      so they actuate on camera.
- [ ] `headless: false` while recording — fonts, blur, and hover states differ in
      headless.
- [ ] For screenshots, dwell ~180 ms after `hlStart` so the ring/badge finish
      fading in before the shot.

## Anti-patterns

- ❌ Leaving a ring up across multiple beats (stale highlight → viewer confusion).
- ❌ Two rings at once — attention splits.
- ❌ Putting a whole sentence in the badge — that's the caption's job.
- ❌ Highlighting then navigating without `hlStop()` — the ring chases a detached node.
- ❌ Brittle absolute selectors; prefer `{ text }` / `{ scopeText, selector }` specs.
