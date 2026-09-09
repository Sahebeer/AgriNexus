const { spawn } = require("child_process");
const path = require("path");

const rootDir = __dirname;
const isWin = process.platform === "win32";

console.log("\n=======================================================");
console.log("   🌾 AgriNexus AI - Smart Farm Operating System");
console.log("=======================================================\n");
console.log("  * FastAPI Gateway:      http://localhost:8000");
console.log("  * Swagger Documentation: http://localhost:8000/docs");
console.log("  * Next.js Web Console:   http://localhost:3000\n");

// 1. Start Python FastAPI Backend
const backendCmd = "python";
const backendArgs = [
  "-m",
  "uvicorn",
  "app.main:app",
  "--host",
  "0.0.0.0",
  "--port",
  "8000",
  "--reload",
  "--app-dir",
  "apps/backend",
];

const backend = spawn(backendCmd, backendArgs, {
  cwd: rootDir,
  shell: isWin,
  stdio: ["inherit", "pipe", "pipe"],
});

backend.stdout.on("data", (data) => {
  process.stdout.write(`\x1b[36m[Backend]\x1b[0m ${data}`);
});

backend.stderr.on("data", (data) => {
  process.stderr.write(`\x1b[33m[Backend]\x1b[0m ${data}`);
});

backend.on("error", (err) => {
  console.error(`\x1b[31m[Backend Error]\x1b[0m ${err.message}`);
});

// 2. Start Next.js Web Frontend
const npmCmd = isWin ? "npm.cmd" : "npm";
const webArgs = ["run", "dev", "--workspace=apps/web"];

const web = spawn(npmCmd, webArgs, {
  cwd: rootDir,
  shell: isWin,
  stdio: ["inherit", "pipe", "pipe"],
});

web.stdout.on("data", (data) => {
  process.stdout.write(`\x1b[32m[Frontend]\x1b[0m ${data}`);
});

web.stderr.on("data", (data) => {
  process.stderr.write(`\x1b[35m[Frontend]\x1b[0m ${data}`);
});

web.on("error", (err) => {
  console.error(`\x1b[31m[Frontend Error]\x1b[0m ${err.message}`);
});

// Clean shutdown handler
function cleanup() {
  console.log("\nShutting down AgriNexus AI services...");
  try {
    backend.kill();
  } catch (e) {}
  try {
    web.kill();
  } catch (e) {}
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
