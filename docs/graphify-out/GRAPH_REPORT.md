# Graph Report - cyberia-audio  (2026-10-29)

## Corpus Check
- 126 files · ~33,820 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 598 nodes · 861 edges · 48 communities (45 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `041131e8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generate-module.js
- validation.js
- resolveParams
- render
- render
- render
- render
- concrete/manifest.json
- exploration/manifest.json
- craft/manifest.json
- desert/manifest.json
- death/manifest.json
- footsteps/manifest.json
- level-up/manifest.json
- victory/manifest.json
- boss/manifest.json
- coin/manifest.json
- drop/manifest.json
- explosion/manifest.json
- heal/manifest.json
- item-pickup/manifest.json
- portal/manifest.json
- shoot/manifest.json
- ui-click/manifest.json
- render
- **berlin**
- **berlin**
- combat
- **concrete-pulse**
- craft
- desert-pulse
- exploration
- mystery
- portal-cooldown
- coin
- **death**
- explosion
- footsteps
- heal
- hit
- item-pickup
- **level-up**
- shoot
- ui-click
- victory
- boss/README.md
- drop/README.md
- portal/README.md

## God Nodes (most connected - your core abstractions)
1. `resolveParams()` - 48 edges
2. `generateModule()` - 24 edges
3. `verifyModule()` - 9 edges
4. `render()` - 8 edges
5. `render()` - 8 edges
6. `render()` - 8 edges
7. `render()` - 8 edges
8. `dispatch()` - 8 edges
9. `render()` - 7 edges
10. `record()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `getParams()` --calls--> `resolveParams()`  [EXTRACTED]
  src/audio-module/music/berlin/params.js → src/validation.js
- `getParams()` --calls--> `resolveParams()`  [EXTRACTED]
  src/audio-module/music/boss/params.js → src/validation.js
- `getParams()` --calls--> `resolveParams()`  [EXTRACTED]
  src/audio-module/music/combat/params.js → src/validation.js
- `getParams()` --calls--> `resolveParams()`  [EXTRACTED]
  src/audio-module/music/concrete/params.js → src/validation.js
- `getParams()` --calls--> `resolveParams()`  [EXTRACTED]
  src/audio-module/music/craft/params.js → src/validation.js

## Import Cycles
- None detected.

## Communities (48 total, 3 thin omitted)

### Community 0 - "generate-module.js"
Cohesion: 0.07
Nodes (46): GEMINI_API_BASE, GEMINI_DEFAULT_MODEL, GeminiClient, objectSpans(), parseJsonLoose(), PERMANENT_STATUS, sleep(), BAR_CHOICES (+38 more)

### Community 1 - "validation.js"
Cohesion: 0.11
Nodes (23): dispatch(), listAssets(), resolveAudioModule(), root, routes(), buildManifest(), manifestPathFor(), missing() (+15 more)

### Community 2 - "resolveParams"
Cohesion: 0.09
Nodes (22): render(), author, bus, duration, id, tags, version, getParams() (+14 more)

### Community 3 - "render"
Cohesion: 0.14
Nodes (18): frequency(), render(), clap(), darkStab(), hat(), kick(), place(), synth() (+10 more)

### Community 4 - "render"
Cohesion: 0.13
Nodes (18): frequency(), render(), bass(), hat(), kick(), lead(), place(), snare() (+10 more)

### Community 5 - "render"
Cohesion: 0.14
Nodes (18): frequency(), render(), bass(), club(), glass(), pad(), place(), theremin() (+10 more)

### Community 6 - "render"
Cohesion: 0.14
Nodes (17): frequency(), render(), drone(), place(), pluck(), riser(), tick(), render() (+9 more)

### Community 7 - "concrete/manifest.json"
Cohesion: 0.14
Nodes (14): midiToFreq(), render(), SVFilter, synthesize(), render(), author, bus, duration (+6 more)

### Community 8 - "exploration/manifest.json"
Cohesion: 0.15
Nodes (16): frequency(), render(), bass(), chime(), pad(), place(), render(), author (+8 more)

### Community 9 - "craft/manifest.json"
Cohesion: 0.14
Nodes (13): frequency(), render(), field(), render(), author, bus, duration, id (+5 more)

### Community 10 - "desert/manifest.json"
Cohesion: 0.15
Nodes (12): render(), synthesize(), render(), author, bus, duration, id, tags (+4 more)

### Community 11 - "death/manifest.json"
Cohesion: 0.15
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 12 - "footsteps/manifest.json"
Cohesion: 0.15
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 13 - "level-up/manifest.json"
Cohesion: 0.15
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 14 - "victory/manifest.json"
Cohesion: 0.15
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 15 - "boss/manifest.json"
Cohesion: 0.16
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 16 - "coin/manifest.json"
Cohesion: 0.16
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 17 - "drop/manifest.json"
Cohesion: 0.16
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 18 - "explosion/manifest.json"
Cohesion: 0.16
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 19 - "heal/manifest.json"
Cohesion: 0.16
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 20 - "item-pickup/manifest.json"
Cohesion: 0.16
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 21 - "portal/manifest.json"
Cohesion: 0.16
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 22 - "shoot/manifest.json"
Cohesion: 0.16
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 23 - "ui-click/manifest.json"
Cohesion: 0.16
Nodes (11): render(), render(), author, bus, duration, id, tags, version (+3 more)

### Community 24 - "render"
Cohesion: 0.44
Nodes (9): frequency(), onePole(), render(), clap(), darkStab(), hat(), kick(), place() (+1 more)

### Community 25 - "**berlin**"
Cohesion: 0.40
Nodes (4): **berlin**, **Parameters and output**, **Sound design**, **Usage**

### Community 26 - "**berlin**"
Cohesion: 0.40
Nodes (4): **berlin**, **Parameters and output**, **Sound design**, **Usage**

### Community 27 - "combat"
Cohesion: 0.40
Nodes (4): combat, Parameters and output, Sound design, Usage

### Community 28 - "**concrete-pulse**"
Cohesion: 0.40
Nodes (4): **concrete-pulse**, **Parameters and Output**, **Sound Design & Musical Structure**, **Usage**

### Community 29 - "craft"
Cohesion: 0.40
Nodes (4): craft, Parameters and output, Sound design, Usage

### Community 30 - "desert-pulse"
Cohesion: 0.40
Nodes (4): desert-pulse, Parameters and output, Sound design, Usage

### Community 31 - "exploration"
Cohesion: 0.40
Nodes (4): exploration, Parameters and output, Sound design, Usage

### Community 32 - "mystery"
Cohesion: 0.40
Nodes (4): mystery, Parameters and output, Sound design, Usage

### Community 33 - "portal-cooldown"
Cohesion: 0.40
Nodes (4): Parameters and output, portal-cooldown, Sound design, Usage

### Community 34 - "coin"
Cohesion: 0.40
Nodes (4): coin, Parameters and output, Sound design, Usage

### Community 35 - "**death**"
Cohesion: 0.40
Nodes (4): **death**, **Parameters and output**, **Sound design**, **Usage**

### Community 36 - "explosion"
Cohesion: 0.40
Nodes (4): explosion, Parameters and output, Sound design, Usage

### Community 37 - "footsteps"
Cohesion: 0.40
Nodes (4): footsteps, Parameters and output, Sound design, Usage

### Community 38 - "heal"
Cohesion: 0.40
Nodes (4): heal, Parameters and output, Sound design, Usage

### Community 39 - "hit"
Cohesion: 0.40
Nodes (4): hit, Parameters and output, Sound design, Usage

### Community 40 - "item-pickup"
Cohesion: 0.40
Nodes (4): item-pickup, Parameters and output, Sound design, Usage

### Community 41 - "**level-up**"
Cohesion: 0.40
Nodes (4): **level-up**, **Parameters and output**, **Sound design**, **Usage**

### Community 42 - "shoot"
Cohesion: 0.40
Nodes (4): Parameters and output, shoot, Sound design, Usage

### Community 43 - "ui-click"
Cohesion: 0.40
Nodes (4): Parameters and output, Sound design, ui-click, Usage

### Community 44 - "victory"
Cohesion: 0.40
Nodes (4): Parameters and output, Sound design, Usage, victory

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `resolveParams()` connect `resolveParams` to `validation.js`, `render`, `render`, `render`, `render`, `concrete/manifest.json`, `exploration/manifest.json`, `craft/manifest.json`, `desert/manifest.json`, `death/manifest.json`, `footsteps/manifest.json`, `level-up/manifest.json`, `victory/manifest.json`, `boss/manifest.json`, `coin/manifest.json`, `drop/manifest.json`, `explosion/manifest.json`, `heal/manifest.json`, `item-pickup/manifest.json`, `portal/manifest.json`, `shoot/manifest.json`, `ui-click/manifest.json`?**
  _High betweenness centrality (0.350) - this node is a cross-community bridge._
- **Should `generate-module.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06848357791754019 - nodes in this community are weakly interconnected._
- **Why does `getParams()` connect `render` to `resolveParams`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `validation.js` be split into smaller, more focused modules?**
  _Cohesion score 0.112375533428165 - nodes in this community are weakly interconnected._
- **Why does `getParams()` connect `render` to `resolveParams`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `resolveParams` be split into smaller, more focused modules?**
  _Cohesion score 0.08620689655172414 - nodes in this community are weakly interconnected._
- **Should `render` be split into smaller, more focused modules?**
  _Cohesion score 0.13852813852813853 - nodes in this community are weakly interconnected._