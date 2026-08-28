---
name: spoken-progress
type: utility
description: >-
  MUST activate whenever conducting any non-trivial task. Speak concise progress
  updates aloud at the start and at meaningful milestones, then speak the final
  verified outcome. Use for multi-step work, investigation, research, tool use,
  code or document changes, browser automation, and tasks involving waiting or
  validation. Do not use for a simple factual answer or brief confirmation.
metadata:
  author: Cedric Vidal
  version: "1.0.0"
---

# Spoken Progress

Keep the user informed without requiring them to watch the transcript. For every
non-trivial task, say the plan, meaningful progress changes, and the final
outcome aloud using the available voice-conversation tool.

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

Before beginning substantive work, speak one short update that states:

- what will be done;
- the immediate approach; and
- how completion will be checked.

Do not recite a long plan or narrate obvious individual tool calls.

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

## Voice Tool Behavior

- Use the available voice-conversation tool for every spoken update.
- Use a one-way call for status updates and final summaries; do not listen for a
  response unless asking the user a genuine question.
- Keep the floor only when the next voice turn is part of the same immediate
  spoken exchange.
- If transcript echo is enabled, print the exact spoken message using the host's
  required voice-echo format.
- If voice synthesis is unavailable, provide the update in text and mention the
  voice failure once. Continue the task rather than silently abandoning it.

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

