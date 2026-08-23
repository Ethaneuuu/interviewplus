import { deepEqual, equal, ok } from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const port = 48000 + process.pid % 1000;
const server = spawn(process.execPath, ["serve-local.mjs", "--port", String(port)], { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] });
const serverExit = once(server, "exit");
let output = "";
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });

try {
  await waitForServer();
  const token = await signUp(port);

  const method = await fetch(`http://127.0.0.1:${port}/api/correct`);
  equal(method.status, 405);
  deepEqual(await method.json(), { error: "METHOD_NOT_ALLOWED" });

  const anonymous = await fetch(`http://127.0.0.1:${port}/api/correct`, { method: "POST", body: "{}" });
  equal(anonymous.status, 401);
  deepEqual(await anonymous.json(), { error: "AUTH_REQUIRED" });

  const malformed = await fetch(`http://127.0.0.1:${port}/api/correct`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: "{" });
  equal(malformed.status, 400);
  deepEqual(await malformed.json(), { error: "INVALID_JSON" });

  const unexpected = await fetch(`http://127.0.0.1:${port}/api/correct`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: "x".repeat(1_000_001) });
  equal(unexpected.status, 500);
  deepEqual(await unexpected.json(), { error: "INTERNAL_ERROR" });

  await verifyUnavailableWorkbook();

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

async function verifyUnavailableWorkbook() {
  const fixtureRoot = await fs.mkdtemp(path.join(tmpdir(), "interviewplus-missing-workbook-"));
  const fixturePort = port + 1000;
  let fixtureServer;
  let fixtureExit;
  let fixtureOutput = "";
  try {
    await fs.mkdir(path.join(fixtureRoot, "assets"), { recursive: true });
    await Promise.all([
      fs.cp(path.join(projectRoot, "serve-local.mjs"), path.join(fixtureRoot, "serve-local.mjs")),
      fs.cp(path.join(projectRoot, "netlify"), path.join(fixtureRoot, "netlify"), { recursive: true }),
      fs.cp(path.join(projectRoot, "assets", "js"), path.join(fixtureRoot, "assets", "js"), { recursive: true }),
    ]);
    fixtureServer = spawn(process.execPath, ["serve-local.mjs", "--port", String(fixturePort)], { cwd: fixtureRoot, stdio: ["ignore", "pipe", "pipe"] });
    fixtureExit = once(fixtureServer, "exit");
    fixtureServer.stdout.on("data", (chunk) => { fixtureOutput += chunk; });
    fixtureServer.stderr.on("data", (chunk) => { fixtureOutput += chunk; });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (fixtureOutput.includes("InterviewPlus available")) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    ok(fixtureOutput.includes("InterviewPlus available"), `FIXTURE_SERVER_START_FAILED:${fixtureOutput}`);
    const token = await signUp(fixturePort);
    const caseResponse = await fetch(`http://127.0.0.1:${fixturePort}/api/correct`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "case", sessionId: "case-without-workbook", theme: "dcf", difficulty: "easy", seed: 1, answers: {} }),
    });
    equal(caseResponse.status, 200, "A deterministic case must not load the question workbook");
    const response = await fetch(`http://127.0.0.1:${fixturePort}/api/correct`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "questions", items: [{ questionId: "1", language: "fr", answer: "answer" }] }),
    });
    equal(response.status, 500);
    const body = await response.text();
    deepEqual(JSON.parse(body), { error: "INTERNAL_ERROR" });
    ok(!body.includes("ENOENT"), "Local correction must not expose a loader error");
  } finally {
    if (fixtureServer?.exitCode === null) fixtureServer.kill();
    if (fixtureExit) await fixtureExit;
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  }
}

async function signUp(serverPort) {
  const response = await fetch(`http://127.0.0.1:${serverPort}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", email: `test-${serverPort}@example.com`, password: "password123" }),
  });
  equal(response.status, 200);
  return (await response.json()).token;
}
