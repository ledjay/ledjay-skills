# Pencil Gotchas

Critical pitfalls from real-world usage. Organized by severity.

## Critical (Design Breaks)

### `critical-no-direct-json`

**NEVER write `.pen` JSON files directly.**

The `.pen` format is an internal schema. Writing JSON manually will open in Pencil but show an **empty canvas**.

❌ **Wrong:**
```json
// Writing this to design.pen → empty canvas!
{
  "version": "1.0",
  "children": [{ "type": "frame", "name": "Card" }]
}
```

✅ **Correct:**
```bash
# Use MCP tools to create content
node pencil.cjs call batch_design '{"operations":"card=I(document,{type:\"frame\"})"}'
```

---

### `critical-hex-colors`

**Use hex colors only.** OKLCH renders invisible.

❌ **Wrong:**
```typescript
fill: "oklch(0.7 0.15 150)"  // → invisible!
```

✅ **Correct:**
```typescript
fill: "#3D7A4F"  // hex only
fill: "#RRGGBBAA"  // with alpha
```

---

### `critical-pencil-running`

**Pencil MUST be running before MCP calls.**

The MCP server is embedded in the Pencil desktop app. If Pencil isn't running, MCP calls fail.

```bash
# Check if running
pgrep -x Pencil

# Start if needed (macOS)
open -a Pencil
```

**Batch mode auto-starts Pencil** if not running.

---

### `critical-save-new-files`

**New files require manual save.**

Pencil MCP has no `save_document` tool. After creating a new file:

1. Batch script creates minimal `.pen` on disk
2. MCP operations work in memory
3. **User MUST save (Cmd+S)** to persist
4. Use `user_action` step to pause and ask

---

## Workflow Gotchas

### `gotcha-max-25-ops`

**Max 25 operations per `batch_design`.**

Beyond 25, operations become unstable.

```typescript
// ❌ Wrong: 30 operations in one batch
batch_design({ operations: "..." })  // 30 ops → unstable

// ✅ Correct: Split into multiple batches
batch_design({ operations: "..." })  // 15 ops
batch_design({ operations: "..." })  // 15 ops
```

---

### `gotcha-max-10-tokens`

**Max 5-10 tokens per `set_variables`.**

Large token sets cause timeout.

```typescript
// ❌ Wrong: 50 tokens in one call
set_variables({ variables: { ...50 tokens... } })

// ✅ Correct: Split into batches
set_variables({ variables: { ...10 tokens... } })
set_variables({ variables: { ...10 tokens... } })
```

---

### `gotcha-no-font-variables`

**Variables don't work in `fontFamily`.**

Use literal strings.

❌ **Wrong:**
```typescript
fontFamily: "$font-primary"  // → doesn't resolve
```

✅ **Correct:**
```typescript
fontFamily: "Inter"  // literal string
```

---

### `gotcha-relative-paths`

**Use relative paths for `filePath`.**

Absolute paths cause timeout.

❌ **Wrong:**
```json
{ "filePath": "/Users/name/projects/design.pen" }
```

✅ **Correct:**
```json
{ "filePath": "design.pen" }
```

---

### `gotcha-ephemeral-bindings`

**Bindings die between CLI calls.**

Each `pencil.cjs` invocation = new connection = fresh context.

```bash
# CLI mode: bindings LOST between calls
node pencil.cjs call batch_design '{"operations":"card=I(...)"}'
# → Returns: card = "ABC123"

node pencil.cjs call get_screenshot '{"nodeId":"${card}"}'  # ❌ ${card} unknown!
```

**Solution:** Use returned IDs or batch mode.

---

## Performance Gotchas

### CLI Mode Overhead

Each CLI call = new connection ≈ 1-2 seconds.

| Mode | 5 operations | Overhead |
|------|--------------|----------|
| CLI | 5 × 1.5s | ~7.5s |
| Batch | 1 × 0.1s | ~0.1s |

**Use batch mode for 2+ operations.**

---

### `opt-cache-nodes`

**Cache nodes once, reuse for lookups.**

```typescript
// ✅ Cache once
const nodes = await getNodes(pencil)  // ~700 tokens
const btn = findNode(nodes, 'Button')  // 0 tokens (sync)

// ❌ Naive: reads every time
const btn = await findNode(pencil, 'Button')  // ~1700 tokens each
```

---

### `opt-use-compiled`

**Use compiled `pencil.cjs` (10x faster).**

```bash
# ❌ Slow: tsx interprets each time
npx tsx pencil.ts call ...

# ✅ Fast: compiled bundle
node pencil.cjs call ...
```

Build: `npm run build`

---

## Layout Gotchas

### Flex Children Ignore x/y

Children of flex containers ignore `x` and `y` properties.

Use `layoutPosition: "absolute"` to position freely.

---

### `fill_container` Needs Parent Layout

`width: "fill_container"` only works when parent has `layout` set.

---

### `clip: false` on Parent

For child overflow effects, set `clip: false` on the **parent**.

---

## Component Gotchas

### No Figma-Style Variants

Pencil doesn't have Figma variants. Use **Shell Pattern** instead.

See `references/components.md` for details.

---

### Shell + Variants = 2 Batches

Create shell and variants in **separate** `batch_design` calls.

```typescript
// Batch 1: Create shell
batch_design({ operations: "shell=I(document,{reusable:true,...})" })

// Batch 2: Create variants (using shell ID)
batch_design({ operations: "variant=I(document,{type:\"ref\",ref:\"SHELL_ID\"})" })
```

---

### `descendants` Uses Node ID

When overriding slot content, use the **node ID**, not name.

```typescript
// Always batch_get first to find slot ID
const nodes = await batch_get({ patterns: [{ name: "slot-name" }] })
const slotId = nodes[0].id

// Then use ID in descendants
U(instanceId, { descendants: { [slotId]: { children: [...] } } })
```

---

## MCP Token Costs

| Tool | Tokens | Recommendation |
|------|--------|----------------|
| `get_editor_state` | ~9,500 | ❌ Avoid — schema tax |
| `batch_get` depth 0 | ~700 | ✅ Node list |
| `batch_get` depth 3 | ~26,000 | ⚠️ Only if needed |
| `batch_design` | ~400 | ✅ Efficient |
| `get_screenshot` | ~4,300 | Use sparingly |

---

## Full Reference

See also:
- `references/dsl.md` — Complete DSL syntax
- `references/components.md` — Shell Pattern, slots
- `references/mcp-optimization.md` — Token cost audit
