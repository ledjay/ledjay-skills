---
name: pencil-mcp
description: Control Pencil.dev design tool via MCP to create, inspect, and export UI designs programmatically. Covers batch_design DSL, design tokens, components, and code sync. Use when working with .pen files, Pencil MCP, design systems, or mockups.
version: 2.3.0
compatible-agents:
  - letta-code
  - codex
  - claude-code
  - cursor
tags:
  - pencil
  - mcp
  - design
  - tokens
  - batch_design
  - components
author:
  name: Jérémie Gisserot
  url: https://jeremie-gisserot.net
license: MIT
---

# Using Pencil

Control **Pencil** (pencil.dev) via its MCP server. Create designs, manage tokens, build components, and export assets — all from the CLI.

## When to Use

**DO use this skill when:**
- Working with `.pen` files (Pencil's native format)
- Creating designs programmatically via MCP
- Building design systems (tokens, components, variants)
- Exporting assets (PNG, JPEG, PDF)
- Debugging Pencil MCP issues

**DON'T use for:**
- General design tasks (use Pencil desktop app directly)
- Non-Pencil design tools (Figma, Sketch, etc.)

## Rule Categories

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | **Critical** | Design breaks | `critical-` |
| 2 | **Workflow** | Performance | `workflow-` |
| 3 | **Gotchas** | Unexpected behavior | `gotcha-` |
| 4 | **Optimization** | Token costs | `opt-` |

## Quick Reference

### 1. Critical Rules (MUST follow)

- `critical-no-direct-json` — NEVER write `.pen` JSON directly, use MCP tools
- `critical-hex-colors` — Use hex only (`#RRGGBB`), OKLCH renders invisible
- `critical-pencil-running` — Pencil desktop app MUST be running before MCP calls
- `critical-save-new-files` — New files require manual save (Cmd+S) before MCP works

### 2. Workflow Rules

- `workflow-choose-mode` — CLI (1 call) / Batch (2-5 calls) / Library (6+ calls)
- `workflow-always-screenshot` — Call `get_screenshot` after every `batch_design`
- `workflow-user-action` — Use `user_action` step when manual intervention needed
- `workflow-capture-ids` — Capture IDs for resuming across user actions

### 3. Gotcha Rules

- `gotcha-max-25-ops` — Max 25 operations per `batch_design`
- `gotcha-max-10-tokens` — Max 5-10 tokens per `set_variables`
- `gotcha-no-font-variables` — Use literal strings for `fontFamily`, not variables
- `gotcha-relative-paths` — Use relative paths for `filePath` (absolute = timeout)
- `gotcha-ephemeral-bindings` — Bindings die between CLI calls, use returned IDs

### 4. Optimization Rules

- `opt-cache-nodes` — Cache nodes with `batch_get` depth 0, reuse for lookups
- `opt-use-compiled` — Use `pencil.cjs` (10x faster than `tsx`)
- `opt-batch-mode` — Batch mode = 5x+ faster than CLI for multiple operations

## Mode Selection

```
How many MCP operations?
├─ 1 → CLI mode: node pencil.cjs call <tool> '<json>'
├─ 2-5 → Batch mode: node pencil-batch.cjs '{"steps":[...]}'
└─ 6+ → Library mode: import { PencilClient } from './pencil.ts'
```

## CLI Mode (single operation)

```bash
# Each call = new connection (bindings lost!)
node <skill-path>/scripts/pencil.cjs call set_variables '{
  "variables": {"primary": {"type": "color", "value": "#3D7A4F"}}
}'
```

## Batch Mode (multiple operations, one connection)

> 🏆 **Recommended for 2-5 operations** — 5x+ faster than CLI.

```bash
node <skill-path>/scripts/pencil-batch.cjs '{
  "filePath": "design.pen",
  "steps": [
    { "tool": "open_document", "args": { "filePathOrTemplate": "design.pen" } },
    { "tool": "set_variables", "args": { "variables": {...} } },
    { "tool": "batch_design", "args": { "operations": "..." }, "capture": "card" },
    { "tool": "user_action", "message": "Please save the file (Cmd+S)" },
    { "tool": "get_screenshot", "args": { "nodeId": "${card}", "outputPath": "out.png" } }
  ]
}'
```

**Features:**
- Single MCP connection for all steps
- Auto-injects `filePath` where needed
- Variable substitution: `${name}` → captured node ID
- `user_action` step: pauses for manual intervention
- Returns `capturedIds` + `remainingSteps` for resuming

### user_action Step

When manual intervention is needed (e.g., saving a new file):

```json
{ "tool": "user_action", "message": "Please save the file (Cmd+S), then tell me to continue" }
```

**Returns:**
```json
{
  "resume": {
    "userActionRequired": "Please save...",
    "capturedIds": { "card": "ABC123" },
    "remainingSteps": [...],
    "resumeHint": "JSON to copy-paste for continuing"
  }
}
```

**As LLM:** Ask user to perform action, then continue with:
```json
{
  "filePath": "...",
  "capturedIds": { "card": "ABC123" },
  "steps": [...]  // from resume.remainingSteps
}
```

## Library Mode (complex workflows)

For 6+ operations, write a TypeScript script:

```typescript
import { PencilClient } from './pencil.js'
import { batch, screenshot, getNodes, setTokens } from './helpers.js'

const pencil = new PencilClient()
await pencil.connect()

const nodes = await getNodes(pencil)  // Cache once
await setTokens(pencil, { 'primary': { type: 'color', value: '#3D7A4F' } })

const { insertedIds } = await batch(pencil, `
  card=I(document,{type:"frame",name:"Card"})
  I(card,{type:"text",content:"Hello"})
`)

await screenshot(pencil, insertedIds[0], './card.png')
await pencil.disconnect()
```

## New File Limitation

> ⚠️ **Pencil MCP cannot save files programmatically.**
> 
> When creating a new file:
> 1. Batch script creates minimal `.pen` on disk
> 2. Pencil opens it but content is "Untitled"
> 3. **User MUST manually save (Cmd+S)**
> 4. Use `user_action` step to pause and ask user
> 5. Continue after user confirms

## Tool Reference

| Tool | Use for | Gotcha |
|------|---------|--------|
| `open_document` | Open/create file | Use `filePathOrTemplate` |
| `batch_design` | Create/modify nodes | Max 25 ops |
| `batch_get` | Read nodes | Use depth 0 to avoid tax |
| `get_screenshot` | Visual verification | ALWAYS call after design |
| `set_variables` | Create tokens | Max 5-10 per call |
| `export_nodes` | Export PNG/JPEG/PDF | — |

## Reference Files

| File | Content |
|------|---------|
| `references/dsl.md` | Complete batch_design DSL syntax |
| `references/components.md` | Shell Pattern, slots, variants |
| `references/tokens.md` | 2-level token architecture |
| `references/gotchas.md` | Complete pitfalls list |
| `references/mcp-optimization.md` | Token cost audit |
| `references/pen-schema.md` | `.pen` schema (READ ONLY!) |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty canvas | Wrote `.pen` JSON directly — use MCP tools |
| "wrong .pen file" | Add `filePath` or use batch mode |
| Invisible colors | Used OKLCH — use hex only |
| Timeout | Relative path, timeout 60s |
| Bindings not found | Ephemeral in CLI — use returned IDs |
| New file won't export | User must save (Cmd+S) first |
