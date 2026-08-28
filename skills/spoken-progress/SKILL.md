---
name: spoken-progress
type: utility
description: >-
  Provides spoken progress updates and final summaries. MUST activate for any
  non-trivial task.
metadata:
  author: Cedric Vidal
  version: "1.0.0"
---

# Spoken Progress

Keep the user informed without requiring them to watch the transcript. For every
non-trivial task, say the plan, meaningful progress changes, and the final
outcome out loud.

## Operating Perspective

Assume the user cannot see the screen, terminal, or transcript. Spoken updates
must stand on their own and give the user enough context to understand:

- what is happening now;
- what meaningfully changed or was discovered; and
- what will happen next.

Name the relevant task, phase, artifact, or result instead of relying on visual
context. Avoid phrases such as “as you can see,” “this,” or “here” when the
referent would be unclear without the screen. The goal is useful situational
awareness, not exhaustive narration.

## Activation

**MUST USE FOR:**

- Work requiring two or more substantive steps.
- Any task that uses tools to investigate, research, edit, automate, build, test,
  validate, wait for, or persist a result.
- Code, configuration, document, spreadsheet, presentation, browser, deployment,
  or repository changes.
- Tasks where an approach changes, a material finding appears, or a blocker needs
  to be communicated.

**DO NOT USE FOR:**

- A simple factual answer that needs no investigation or tools.
- A brief acknowledgment or confirmation.
- A user request to stop speaking or disable voice updates.

When uncertain, treat the task as non-trivial and activate this skill.

## Required Spoken Updates

### 1. Kickoff

Before beginning substantive work, give a short, natural update that leaves the
user with enough context to understand what you are about to do, the general
approach, and how you will know it is complete.

Weave that context into conversational language; do not mechanically announce
three separate fields or sound as though you are reading a checklist. Do not
recite a long plan or narrate obvious individual tool calls.

### 2. Meaningful progress

Speak again only when one of these occurs:

- the task enters a new major phase;
- a finding materially changes the approach or expected result;
- an operation will take noticeable time;
- a blocker, failure, or user decision must be surfaced;
- implementation is complete and validation is beginning.

Keep each update concise and outcome-oriented. Prefer “I found X, so I’m doing Y”
over generic status such as “I’m still working.”

### 3. Final summary

After verification and before marking the task complete, speak a concise final
summary containing:

- the result;
- the most important change or finding;
- any unresolved limitation or required next step, only when one exists.

Never speak a success claim before the expected outcome has been verified.

## Say Updates Out Loud

- Say every required update out loud using any speech capability available in
  the user's environment, such as a native voice feature, MCP server, extension,
  or text-to-speech tool.
- Express the intent as **“say this out loud”**. Do not hard-code or require a
  specific speech tool, provider, server, or extension.
- For status updates and final summaries, use one-way speech when supported. Do
  not listen for a response unless asking the user a genuine question.
- If the speech capability coordinates turns, keep the floor only when the next
  spoken turn is part of the same immediate exchange.
- If transcript echo is enabled, print the exact spoken message using the host's
  required echo format.
- If no speech capability is available, tell the user once that spoken progress
  is unavailable, stop attempting spoken updates, and continue the requested
  task. Do not substitute text-only progress updates for the unavailable speech.

## Content Safety and Clarity

- Do not read secrets, credentials, tokens, personal data, full stack traces, or
  large code blocks aloud.
- Summarize sensitive or verbose technical details at a safe, useful level.
- Pronounce acronyms naturally or expand them on first use when ambiguity is
  likely.
- Match the user's language and keep spoken updates shorter than the written
  technical detail.
- Do not duplicate every written sentence aloud; speak the high-signal summary.

## Checklist

- [ ] Spoken kickoff delivered before substantive work.
- [ ] Spoken updates delivered at each meaningful phase or material change.
- [ ] Routine tool calls were not narrated.
- [ ] No sensitive or unnecessarily verbose content was spoken.
- [ ] Outcome was verified.
- [ ] Final result and any real limitation were spoken aloud.
