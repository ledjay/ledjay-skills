#!/usr/bin/env npx tsx
/**
 * Pencil Batch CLI - Execute multiple operations in ONE connection
 * 
 * Features:
 * - Auto-starts Pencil if not running
 * - Creates new .pen files if they don't exist
 * - Single MCP connection for all steps
 * - Variable substitution: ${name} references captured IDs
 * - user_action step: signals that manual intervention is needed (non-blocking)
 *   Returns captured IDs and remaining steps for easy resumption
 */

import { PencilClient } from './pencil.js'
import { execSync } from 'child_process'
import { writeFileSync, existsSync } from 'fs'
import { dirname } from 'path'

interface WorkflowStep {
  tool: string
  args?: Record<string, unknown>
  capture?: string
  message?: string
}

interface Workflow {
  filePath?: string
  steps: WorkflowStep[]
  timeout?: number
  autoStartPencil?: boolean
  pencilInitDelay?: number
  createFileIfNotExists?: boolean
  capturedIds?: Record<string, string>  // Pre-populated captured IDs for resuming
}

interface BatchResult {
  success: boolean
  step: number
  tool: string
  result?: unknown
  capturedIds?: string[]
  capturedAs?: string
  error?: string
  message?: string
}

// ─── Resume Info (returned when user_action is hit) ───────────────────────────

interface ResumeInfo {
  userActionRequired: string
  capturedIds: Record<string, string>
  remainingSteps: WorkflowStep[]
  resumeHint: string
}

// ─── Minimal .pen Template ───────────────────────────────────────────────────

const EMPTY_PEN_TEMPLATE = {
  version: "1.0",
  children: []
}

// ─── Pencil App Management ───────────────────────────────────────────────────

function isPencilRunning(): boolean {
  try {
    const result = execSync('pgrep -x Pencil', { encoding: 'utf-8' })
    return result.trim().length > 0
  } catch {
    return false
  }
}

function startPencil(initDelayMs: number = 3000): void {
  console.error('[pencil-batch] Starting Pencil.app...')
  try {
    if (process.platform === 'darwin') {
      execSync('open -a Pencil', { timeout: 5000 })
    } else if (process.platform === 'win32') {
      execSync('start Pencil', { shell: true, timeout: 5000 })
    } else {
      execSync('pencil &', { shell: true, timeout: 5000 })
    }
    
    console.error('[pencil-batch] Waiting for Pencil to initialize...')
    let attempts = 0
    while (!isPencilRunning() && attempts < 30) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
      attempts++
    }
    
    if (isPencilRunning()) {
      console.error(`[pencil-batch] Pencil started, waiting ${initDelayMs}ms for MCP server...`)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, initDelayMs)
      console.error('[pencil-batch] Ready!')
    } else {
      console.error('[pencil-batch] Warning: Pencil may not have started')
    }
  } catch (e: any) {
    console.error('[pencil-batch] Could not start Pencil:', e.message)
  }
}

// ─── File Management ─────────────────────────────────────────────────────────

function ensurePenFileExists(filePath: string): boolean {
  if (!filePath.endsWith('.pen')) {
    console.error('[pencil-batch] Warning: filePath does not end with .pen')
    return false
  }
  
  if (existsSync(filePath)) {
    return true
  }
  
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    execSync(`mkdir -p "${dir}"`)
  }
  
  console.error(`[pencil-batch] Creating new file: ${filePath}`)
  writeFileSync(filePath, JSON.stringify(EMPTY_PEN_TEMPLATE, null, 2))
  
  return true
}

// ─── Variable Substitution ───────────────────────────────────────────────────

function substituteVariables(value: unknown, captured: Map<string, string>, capturedList: string[]): unknown {
  if (typeof value === 'string') {
    let result = value
    for (let i = 0; i < capturedList.length; i++) {
      result = result.replace(new RegExp(`\\$\\{${i}\\}`, 'g'), capturedList[i])
    }
    for (const [name, id] of captured.entries()) {
      result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), id)
    }
    return result
  }
  if (Array.isArray(value)) {
    return value.map(v => substituteVariables(v, captured, capturedList))
  }
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = substituteVariables(v, captured, capturedList)
    }
    return result
  }
  return value
}

// ─── Workflow Execution ───────────────────────────────────────────────────────

async function runWorkflow(workflow: Workflow): Promise<{ results: BatchResult[], resume?: ResumeInfo }> {
  const pencil = new PencilClient()
  const timeout = workflow.timeout || 90000
  const initDelay = workflow.pencilInitDelay || 3000
  
  if (workflow.filePath && workflow.createFileIfNotExists !== false) {
    ensurePenFileExists(workflow.filePath)
  }
  
  if (workflow.autoStartPencil !== false) {
    if (!isPencilRunning()) {
      startPencil(initDelay)
    }
  }
  
  // Initialize captured from input (for resuming)
  const captured = new Map<string, string>()
  const capturedList: string[] = []
  
  if (workflow.capturedIds) {
    for (const [name, id] of Object.entries(workflow.capturedIds)) {
      if (name.startsWith('$')) {
        // Positional capture: $0, $1, etc.
        const idx = parseInt(name.slice(1))
        capturedList[idx] = id
      } else {
        // Named capture
        captured.set(name, id)
      }
    }
    console.error('[pencil-batch] Pre-populated captured IDs:', workflow.capturedIds)
  }

  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Workflow timeout')), timeout)
  )

  try {
    await Promise.race([
      pencil.connect(),
      timeoutPromise
    ])

    const results: BatchResult[] = []
    let activeFile = workflow.filePath

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i]
      const stepStart = Date.now()

      // Handle user_action step - return immediately with resume info
      if (step.tool === 'user_action') {
        const message = step.message || 'Please perform the required action.'
        const remaining = workflow.steps.slice(i + 1)
        
        // Build captured IDs object
        const capturedIdsObj: Record<string, string> = {}
        for (const [name, id] of captured.entries()) {
          capturedIdsObj[name] = id
        }
        capturedList.forEach((id, idx) => {
          if (id) capturedIdsObj[`$${idx}`] = id
        })
        
        const resumeInfo: ResumeInfo = {
          userActionRequired: message,
          capturedIds: capturedIdsObj,
          remainingSteps: remaining,
          resumeHint: JSON.stringify({
            filePath: workflow.filePath,
            capturedIds: capturedIdsObj,
            steps: remaining
          }, null, 2),
        }
        
        results.push({
          success: false,
          step: i,
          tool: 'user_action',
          message: `⏸️  USER ACTION REQUIRED: ${message}`,
          error: `Resume with ${remaining.length} remaining steps`,
        })
        
        console.error(`[pencil-batch] ⏸️  USER ACTION REQUIRED: ${message}`)
        console.error(`[pencil-batch] Captured IDs:`, capturedIdsObj)
        console.error(`[pencil-batch] Remaining steps: ${remaining.length}`)
        
        return { results, resume: resumeInfo }
      }

      try {
        let args = step.args ? { ...step.args } : {}
        
        if (step.tool === 'open_document' && args.filePathOrTemplate) {
          const filePath = args.filePathOrTemplate as string
          if (filePath !== 'new' && !existsSync(filePath)) {
            ensurePenFileExists(filePath)
          }
        }
        
        if (activeFile && !args.filePath && step.tool !== 'open_document') {
          args.filePath = activeFile
        }

        args = substituteVariables(args, captured, capturedList) as Record<string, unknown>

        if (step.tool === 'open_document' && args.filePathOrTemplate) {
          const fp = args.filePathOrTemplate as string
          if (fp !== 'new') activeFile = fp
        }

        const result = await pencil.call(step.tool, args)
        const text = result.content?.[0]?.text || ''
        
        let stepCapturedIds: string[] | undefined
        if (step.tool === 'batch_design') {
          stepCapturedIds = [...text.matchAll(/Inserted node `(\w+)`/g)].map(m => m[1])
          if (step.capture && stepCapturedIds.length > 0) {
            captured.set(step.capture, stepCapturedIds[0])
          }
          capturedList.push(...stepCapturedIds)
        }

        results.push({
          success: true,
          step: i,
          tool: step.tool,
          result: text.match(/^\{/) ? JSON.parse(text) : text,
          capturedIds: stepCapturedIds,
          capturedAs: step.capture,
        })

        console.error(`[pencil-batch] Step ${i + 1}/${workflow.steps.length}: ${step.tool} (${Date.now() - stepStart}ms)`)

      } catch (e: any) {
        results.push({
          success: false,
          step: i,
          tool: step.tool,
          error: e.message,
        })
        console.error(`[pencil-batch] Step ${i + 1} failed: ${e.message}`)
      }
    }

    return { results }

  } finally {
    await pencil.disconnect()
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.error(`
Usage: pencil-batch <workflow.json | json-string>

Features:
  - Auto-starts Pencil if not running
  - Creates new .pen files if they don't exist
  - Single MCP connection for all steps
  - Variable substitution: \${name} references captured IDs
  - user_action step: signals that manual intervention is needed

When user_action is encountered, returns:
{
  "results": [...],
  "resume": {
    "userActionRequired": "Please save the file (Cmd+S)",
    "capturedIds": { "card": "ABC123", ... },
    "remainingSteps": [...],
    "resumeHint": "JSON to copy-paste for continuing"
  }
}

The LLM should ask the user to perform the action, then continue with:
{
  "filePath": "...",
  "capturedIds": { "card": "ABC123", ... },  // From resume.capturedIds
  "steps": [...]  // From resume.remainingSteps
}
`)
    process.exit(1)
  }

  let workflow: Workflow
  
  try {
    const input = args[0]
    if (input.endsWith('.json')) {
      const fs = await import('fs')
      workflow = JSON.parse(fs.readFileSync(input, 'utf-8'))
    } else {
      workflow = JSON.parse(input)
    }
  } catch (e: any) {
    console.error('Failed to parse workflow:', e.message)
    process.exit(1)
  }

  console.error(`[pencil-batch] Running ${workflow.steps.length} steps...`)
  const startTime = Date.now()

  try {
    const { results, resume } = await runWorkflow(workflow)
    
    console.error(`[pencil-batch] Completed in ${Date.now() - startTime}ms`)
    
    if (resume) {
      console.error(`[pencil-batch] ⏸️  Stopped for user action`)
      console.log(JSON.stringify({ results, resume }, null, 2))
      process.exit(42)
    } else {
      console.log(JSON.stringify(results, null, 2))
      const hasError = results.some(r => !r.success)
      process.exit(hasError ? 1 : 0)
    }
    
  } catch (e: any) {
    console.error('[pencil-batch] Workflow failed:', e.message)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
