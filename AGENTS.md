## Use ASD-STE100 Simplified Technical English

Write comments in simplified technical English.

Key rules:

- Use the approved words of ASD-STE100 when possible.
- Use one word for one idea. Do not use two words for the same thing.
- Write short sentences. Use 20 words or less for instructions.
- Use active voice. Write "Turn the switch", not "The switch must be turned"
- Write short paragraphs. Keep one topic in each paragraph.
- No filler.

The goal is easy reading.

Report back to the user following the same rules.

## Brief comments — no archaeology

Comments state the live invariant in ≤1 line. The reader needs current behavior, nothing more.

- Banned content: bug postmortems, "we tried X but Y broke", "previously", "used to", "added because of", historical justification, restoration sagas.
- Test: "If I delete this comment, will a reader misunderstand the code?" No → delete. Yes → minimum text, present tense.
- Decision rationale and bug-fix narration go in the commit message that introduced the change — there it's dated and attributable; on the line it's stale weight forever.
- Use `TODO:` only for concrete, actionable follow-ups.

## Consistency guardrails

- Keep a single source of truth for asset contracts (manifest.json, params.js), runtime configuration, and CLI commands.
- Reuse existing parameter validation rules from src/validation.js; do not duplicate parameter bounds checks or numeric assertion logic.
- Keep generated output artifacts (records/\*.wav, records/\*.json) as read-only build outputs; never hand-edit generated WAV files or manifests.
- Asset modules in src/audio-module/ must remain strictly isolated: no asset module may import another asset module's DSP or code.
- No dead code, legacy synthesis utilities, or unused dependencies.

## Architecture boundaries

- src/audio-module/<bus-id>/<id>/ owns individual procedural synthesis, parameter ranges, and localized metadata.
- src/runtime/ owns audio playback control (@audio/speaker), 16-bit PCM quantization, native RIFF/WAV encoding, and recorded manifest export.
- src/generator/ owns AI module generation, Gemini staging, repair passes, and contract verification prior to installation.
- src/validation.js owns shared numeric and option validation rules; it contains no DSP or synthesis logic.
- bin/index.js & primary entrypoint (index.js) handle dispatching and public API boundaries; they must remain fully decoupled from specific asset synthesis details.

## Documentation hot paths

- README.md — Core library usage, CLI options, API documentation, and vocabulary table.
- src/audio-module/<bus-id>/<id>/README.md — Individual asset sound design, parameter range specifications, and usage examples.
