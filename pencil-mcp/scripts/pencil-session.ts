#!/usr/bin/env npx tsx
/**
 * Pencil Session CLI - Interactive persistent MCP connection
 * 
 * Keeps the MCP connection open and reads commands from stdin.
 * Useful for CLI agents that need to make multiple calls without
 * reconnecting each time.
 * 
 * Usage:
 *   node pencil-session.cjs
 * 
 * Then type commands (one per line):
 *   open_document {"filePath": "design.pen"}
 *   set_variables {"variables": {"primary": {"type": "color", "value": "#3D7A4F"}}}
 *   batch_design {"operations": "card=I(document,{type:\"frame\"})"}
 *   get_screenshot {"nodeId": "xxx", "outputPath": "out.png"}
 *   quit
 * 
 * Output: JSON result for each command.
 */

import * as readline from 'readline'
import { PencilClient } from './pencil.js'

const pencil = new PencilClient()
let activeFile: string | undefined

async function handleCommand(line: string): Promise<void> {
  const trimmed = line.trim()
  
  if (!trimmed || trimmed.startsWith('#')) {
    return // Skip empty lines and comments
  }
  
  if (trimmed === 'quit' || trimmed === 'exit') {
    console.log(JSON.stringify({ success: true, message: 'Goodbye!' }))
    await pencil.disconnect()
    process.exit(0)
  }
  
  // Parse command: tool_name json_args
  const spaceIndex = trimmed.indexOf(' ')
  const toolName = spaceIndex > 0 ? trimmed.slice(0, spaceIndex) : trimmed
  const argsStr = spaceIndex > 0 ? trimmed.slice(spaceIndex + 1) : '{}'
  
  let args: Record<string, unknown>
  try {
    args = JSON.parse(argsStr)
  } catch (e: any) {
    console.log(JSON.stringify({ success: false, error: `Invalid JSON: ${e.message}` }))
    return
  }
  
  // Auto-add filePath if not present and we have an active file
  if (activeFile && !args.filePath && toolName !== 'open_document') {
    args.filePath = activeFile
  }
  
  // Track file context
  if (toolName === 'open_document' && args.filePath) {
    activeFile = args.filePath as string
  }
  
  try {
    const result = await pencil.call(toolName, args)
    const text = result.content?.[0]?.text || ''
    
    // Parse insertedIds from batch_design
    let capturedIds: string[] | undefined
    if (toolName === 'batch_design') {
      capturedIds = [...text.matchAll(/Inserted node `(\w+)`/g)].map(m => m[1])
    }
    
    console.log(JSON.stringify({
      success: true,
      tool: toolName,
      result: text.match(/^\{/) ? JSON.parse(text) : text,
      capturedIds,
    }))
    
  } catch (e: any) {
    console.log(JSON.stringify({
      success: false,
      tool: toolName,
      error: e.message,
    }))
  }
}

async function main() {
  console.error('[pencil-session] Connecting to Pencil MCP...')
  await pencil.connect()
  console.error('[pencil-session] Connected! Type commands (one per line), or "quit" to exit.')
  console.error('[pencil-session] Format: tool_name {"arg": "value"}')
  console.log(JSON.stringify({ success: true, message: 'Connected' }))
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  })
  
  for await (const line of rl) {
    await handleCommand(line)
  }
  
  // Clean exit if stdin closes
  await pencil.disconnect()
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
