#!/usr/bin/env npx tsx
/**
 * Pencil MCP Client (Cross-Platform)
 *
 * Dual-use: importable library + CLI tool.
 * Supports macOS (ARM64/x64), Windows, and Linux.
 *
 * Setup: cd scripts && npm install && npm run build
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ─── Cross-Platform Config ───────────────────────────────────────────────────

function getPencilCommand(): string {
  const platform = process.platform;
  const arch = process.arch;

  // Allow override via environment variable
  if (process.env.PENCIL_MCP_PATH) {
    return process.env.PENCIL_MCP_PATH;
  }

  if (platform === "darwin") {
    const base = "/Applications/Pencil.app/Contents/Resources/app.asar.unpacked/out";
    if (arch === "arm64") {
      return `${base}/mcp-server-darwin-arm64`;
    }
    return `${base}/mcp-server-darwin-x64`;
  }

  if (platform === "win32") {
    // Common Windows install locations
    const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
    const localAppData = process.env["LOCALAPPDATA"] || "C:\\Users\\Default\\AppData\\Local";
    
    // Try Program Files first, then LocalAppData
    const paths = [
      `${programFiles}\\Pencil\\resources\\app.asar.unpacked\\out\\mcp-server-win32-x64.exe`,
      `${localAppData}\\Programs\\Pencil\\resources\\app.asar.unpacked\\out\\mcp-server-win32-x64.exe`,
    ];
    
    for (const path of paths) {
      try {
        const fs = require("fs");
        if (fs.existsSync(path)) return path;
      } catch {}
    }
    
    // Default fallback
    return `${programFiles}\\Pencil\\resources\\app.asar.unpacked\\out\\mcp-server-win32-x64.exe`;
  }

  if (platform === "linux") {
    // Common Linux install locations
    const paths = [
      "/opt/Pencil/resources/app.asar.unpacked/out/mcp-server-linux-x64",
      "/usr/lib/pencil/resources/app.asar.unpacked/out/mcp-server-linux-x64",
      "/usr/share/pencil/resources/app.asar.unpacked/out/mcp-server-linux-x64",
      // For AppImage, the mcp-server is typically extracted to a temp location
      // Users should set PENCIL_MCP_PATH env var for AppImage installs
    ];

    for (const path of paths) {
      try {
        const fs = require("fs");
        if (fs.existsSync(path)) return path;
      } catch {}
    }

    // Default fallback
    return "/opt/Pencil/resources/app.asar.unpacked/out/mcp-server-linux-x64";
  }

  throw new Error(`Unsupported platform: ${platform} ${arch}. Set PENCIL_MCP_PATH environment variable to the MCP server binary path.`);
}

const PENCIL_ARGS = ["--app", "desktop"];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

// ─── PencilClient ─────────────────────────────────────────────────────────────

export class PencilClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  async connect(): Promise<void> {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }

    const command = getPencilCommand();
    console.error(`[pencil] Connecting to MCP server: ${command}`);

    this.transport = new StdioClientTransport({
      command,
      args: PENCIL_ARGS,
      env,
      stderr: "pipe",
    });

    if (this.transport.stderr) {
      this.transport.stderr.on("data", (chunk: Buffer) => {
        process.stderr.write(`[pencil] ${chunk.toString()}`);
      });
    }

    this.client = new Client({ name: "pencil-client", version: "1.0.0" }, {
      capabilities: {},
    });

    await this.client.connect(this.transport);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
    }
  }

  async call(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (!this.client) {
      throw new Error("Not connected. Call connect() first.");
    }

    const result = await this.client.callTool({
      name: toolName,
      arguments: args,
    });

    return result as ToolResult;
  }

  async listTools(): Promise<unknown[]> {
    if (!this.client) {
      throw new Error("Not connected. Call connect() first.");
    }

    const response = await this.client.listTools();
    return response.tools;
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  const pencil = new PencilClient();
  await pencil.connect();

  try {
    if (command === "list-tools") {
      const tools = await pencil.listTools();
      console.log(JSON.stringify(tools, null, 2));
    } else if (command === "info") {
      const toolName = rest[0];
      const tools = await pencil.listTools();
      const tool = (tools as any[]).find((t: any) => t.name === toolName);
      if (tool) {
        console.log(JSON.stringify(tool, null, 2));
      } else {
        console.error(`Tool not found: ${toolName}`);
        process.exit(1);
      }
    } else if (command === "call") {
      const [toolName, jsonArgs] = rest;
      const parsedArgs = jsonArgs ? JSON.parse(jsonArgs) : {};
      const result = await pencil.call(toolName, parsedArgs);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error("Usage: pencil <command> [args]");
      console.error("Commands:");
      console.error("  list-tools              List available tools");
      console.error("  info <tool>             Show tool schema");
      console.error("  call <tool> '<json>'    Call a tool");
      process.exit(1);
    }
  } finally {
    await pencil.disconnect();
  }
}

// Only run main() when executed directly, not when imported
// @ts-ignore - process.argv[1] may be undefined in some environments
const isMainModule = process.argv[1]?.includes('pencil.ts') || process.argv[1]?.includes('pencil.cjs');
if (isMainModule) {
  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
