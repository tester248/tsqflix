#!/usr/bin/env node
const { spawn } = require("node:child_process")
const path = require("node:path")
const dotenv = require("dotenv")

const envPath = path.resolve(process.cwd(), ".env")
dotenv.config({ path: envPath })

const port = process.env.FRONTEND_PORT || "3001"
process.env.PORT = port

const child = spawn("npm", ["--prefix", "frontend", "run", "dev"], {
  stdio: "inherit",
  env: process.env,
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
