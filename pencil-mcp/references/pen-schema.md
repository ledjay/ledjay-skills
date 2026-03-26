# .pen Format — TypeScript Schema

<!-- last_verified: 2026-03-26 -->
<!-- sources: docs.pencil.dev/for-developers/the-pen-format (2026-03-10) -->
<!-- stability: LOW — schema actively evolving, "we reserve the right to introduce breaking changes" -->

> ⚠️ **CRITICAL: This schema is for UNDERSTANDING only — NOT for writing files!**
> 
> Writing `.pen` JSON directly will produce an **empty canvas** in Pencil.
> 
> **To create content, use MCP tools:** `batch_design`, `set_variables`, etc.
> 
> This reference helps you understand the internal structure, debug issues,
> or parse `.pen` files for analysis.

Authoritative reference from https://docs.pencil.dev/for-developers/the-pen-format

## Overview

- `.pen` files = JSON describing an object tree (like HTML/SVG)
- Each object has unique `id` (no slashes) and `type` field
- Top-level objects on infinite 2D canvas (need `x`, `y`)
- Nested objects positioned relative to parent's top-left

## Document Structure

```typescript
interface Document {
  version: string;
  themes?: { [axis: string]: string[] };
  imports?: { [alias: string]: string };  // path to imported .pen files
  variables?: { [name: string]: VariableDef };
  children: (Frame | Group | Rectangle | Ellipse | Line | Polygon |
             Path | Text | Note | Context | Prompt | IconFont | Ref)[];
}
```

## Variable Definition

```typescript
interface VariableDef {
  type: "color" | "number" | "string";
  value: string | number | ConditionalValue[];
}

interface ConditionalValue {
  value: string | number;
  theme: { [axis: string]: string };  // e.g., {"Mode": "Dark"}
}
```

## Theming

Multi-axis theming confirmed working (March 2026):

```json
{
  "themes": {
    "Mode": ["Light", "Dark"],
    "Contrast": ["Normal", "High"]
  },
  "variables": {
    "background": {
      "type": "color",
      "value": [
        {"value": "#FFFFFF", "theme": {"Mode": "Light"}},
        {"value": "#1A1A1A", "theme": {"Mode": "Dark"}}
      ]
    }
  }
}
```

## Frame

```typescript
interface Frame {
  id: string;
  type: "frame";
  name?: string;
  x?: number;
  y?: number;
  width?: number | string;  // number or "fill_container"
  height?: number | string;  // number or "fit_content(n)"
  layout?: "vertical" | "horizontal";
  gap?: number;
  padding?: number | [number, number, number, number];
  cornerRadius?: number | [number, number, number, number];
  fill?: string | { type: "image"; url: string };
  stroke?: { fill: string; thickness: number; align: "inside" | "center" | "outside" };
  children?: Node[];
  reusable?: boolean;        // Makes this a component
  slot?: string[];           // Component IDs for auto-population
}
```

## Text

```typescript
interface Text {
  id: string;
  type: "text";
  content: string;
  fontSize?: number;
  fontWeight?: number | "normal" | "bold";
  fontFamily?: string;       // ⚠️ Variables DON'T work here!
  textAlign?: "left" | "center" | "right" | "justify";
  textGrowth?: "auto" | "fixed-width" | "fixed-width-height";
  fill?: string;
  x?: number;
  y?: number;
}
```

## Ref (Component Instance)

```typescript
interface Ref {
  id: string;
  type: "ref";
  ref: string;               // ID of the source component
  name?: string;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  fill?: string;             // Override
  stroke?: Stroke;           // Override
  reusable?: boolean;        // If true, this ref becomes a component itself
  descendants?: { [nodeId: string]: Partial<Node> };  // Deep overrides
}
```

## Complete Node Types

| Type | Description |
|------|-------------|
| `frame` | Container, component, or slot |
| `text` | Text content |
| `ref` | Component instance |
| `rectangle` | Rectangle shape |
| `ellipse` | Circle/oval |
| `line` | Line |
| `polygon` | Polygon |
| `path` | SVG path |
| `note` | Annotation |
| `context` | Context setting |
| `prompt` | AI prompt |
| `icon_font` | Icon from font (Lucide, etc.) |

## Why Direct JSON Writing Fails

Pencil's MCP server maintains internal state for:
- WebSocket connections
- Active document tracking
- Variable resolution cache
- Component relationship graph

When you write JSON directly, these internal structures aren't initialized,
resulting in an empty canvas even though the file "opens" successfully.

**Always use MCP tools to create content.**
