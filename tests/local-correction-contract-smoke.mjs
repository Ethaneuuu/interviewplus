import { deepEqual, equal } from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const port = 48000 + process.pid % 1000;
const server = spawn(process.execPath, ["serve-local.mjs", "--port", String(port)], { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] });
const serverExit = once(server, "exit");
let output = "";
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });

try {
  await waitForServer();

  const method = await fetch(`http://127.0.0.1:${port}/api/correct`);
  equal(method.status, 405);
  deepEqual(await method.json(), { error: "METHOD_NOT_ALLOWED" });

  const malformed = await fetch(`http://127.0.0.1:${port}/api/correct`, { method: "POST", body: "{" });
  equal(malformed.status, 400);
  deepEqual(await malformed.json(), { error: "INVALID_JSON" });

  const unexpected = await fetch(`http://127.0.0.1:${port}/api/correct`, { method: "POST", body: "x".repeat(1_000_001) });
  equal(unexpected.status, 500);
  deepEqual(await unexpected.json(), { error: "INTERNAL_ERROR" });

  console.log(JSON.stringify({ ok: true, contract: "local-correction" }));
} finally {
  if (server.exitCode === null) server.kill();
  await serverExit;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (output.includes("InterviewPlus available")) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`LOCAL_SERVER_START_FAILED:${output}`);
}
