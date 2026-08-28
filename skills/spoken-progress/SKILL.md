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

## Principle

Assume the user cannot see the screen, terminal, or transcript. Spoken updates
must stand alone and convey what is happening, what meaningfully changed, and
what happens next. Name the relevant task, phase, artifact, or result; avoid
visual references such as “as you can see,” “this,” or “here” when their meaning
depends on the screen. Provide situational awareness, not exhaustive narration.

## Activation

- **MUST activate for every non-trivial task:** multi-step work or any task using
  tools to investigate, research, edit, automate, build, test, wait, validate, or
  persist results.
- Skip only simple factual answers, brief confirmations, or when the user
  disables speech. When uncertain, activate.

## Cadence

- **Kickoff:** Before substantive work, naturally give enough context to
  understand the task, general approach, and completion signal. Do not recite
  labeled fields, a long plan, or obvious tool calls.
- **Progress:** Speak only at meaningful transitions: a new phase, material
  finding or approach change, noticeable wait, blocker or failure, needed user
  decision, or the move from implementation to validation. Prefer “I found X, so
  I’m doing Y” over “I’m still working.”
- **Final:** After verification and before completion, summarize the outcome,
  most important change or finding, and any real limitation or required next
  step. Never claim success before verification.

## Delivery

- **Say updates out loud** using any available native voice feature, MCP server,
  extension, or text-to-speech tool. Express the intent as “say this out loud”;
  never require a specific provider or mechanism.
- Use one-way speech unless asking a genuine question. If turn coordination
  exists, hold the floor only for an immediate follow-up. Honor the host's
  transcript-echo convention when enabled.
- If speech is unavailable, tell the user once, stop attempting spoken updates,
  and continue the task without substitute text-only progress narration.

## Style and Safety

Be concise, conversational, outcome-oriented, and natural in the user's
language. Expand ambiguous acronyms on first use. Do not duplicate the written
response or speak secrets, credentials, personal data, full stack traces, or
large code blocks; summarize verbose or sensitive details safely.
