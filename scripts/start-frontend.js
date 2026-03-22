#!/usr/bin/env node
const { spawn } = require("node:child_process")
const path = require("node:path")
const dotenv = require("dotenv")

const envPath = path.resolve(process.cwd(), ".env")
dotenv.config({ path: envPath })

const port = process.env.FRONTEND_PORT || "3001"
process.env.PORT = port

// Fix ECONNRESET on Node 22 / Windows – force IPv4 DNS resolution first
const existing = process.env.NODE_OPTIONS || ""
if (!existing.includes("--dns-result-order")) {
  process.env.NODE_OPTIONS = `${existing} --dns-result-order=ipv4first`.trim()
}

const child = spawn("npm", ["--prefix", "frontend", "run", "start"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
  } else {
    process.exit(code ?? 0)
  }
})

child.on("error", (error) => {
  console.error(error)
  process.exit(1)
})
