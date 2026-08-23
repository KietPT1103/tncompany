import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const processes = [];
let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of processes) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(exitCode);
  }, 500);
}

function startProcess(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
      stopAll(1);
      return;
    }

    if ((code ?? 0) !== 0) {
      console.log(`[${name}] exited with code ${code}`);
      stopAll(code ?? 1);
    }
  });

  processes.push(child);
  return child;
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

console.log("Starting Vite with /api proxied to https://tnservice.vn (production data)");
startProcess(
  "vite",
  isWindows ? "cmd.exe" : "npm",
  isWindows
    ? ["/d", "/s", "/c", "npm run vite:dev -- --host 127.0.0.1"]
    : ["run", "vite:dev", "--", "--host", "127.0.0.1"]
);
