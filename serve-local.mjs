import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCorrectionService } from "./netlify/functions/lib/correction-service.mjs";
import { createQuestionBankLoader } from "./netlify/functions/lib/question-bank.mjs";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const port = Number(readArg("--port") || process.env.PORT || 4173);

const dataDir = path.join(projectRoot, "data");
const dbPath = path.join(dataDir, "interviewplus-db.json");
const modernRoot = path.join(projectRoot, "Nouveau site", "dist");
const publicRootFiles = new Set([
  "index.html",
  "auth.html",
  "new-session.html",
  "setup.html",
  "session.html",
  "results.html",
  "profile.html",
  "case-setup.html",
  "case-session.html",
  "Questions_InterviewPlus_Bilingual.xlsx",
]);
let localQuestionBankLoader;
const localCorrectionService = createCorrectionService({ questionBankLoader: loadLocalQuestionBank, env: process.env });

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".sql": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".toml": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApiRoute(request, response, url.pathname);
      return;
    }

    await serveStaticFile(response, url.pathname);
  } catch (error) {
    json(response, 500, { error: "INTERNAL_ERROR" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`InterviewPlus available at http://localhost:${port}/`);
  console.log("Evaluation: OpenRouter with deterministic case grading");
});

async function handleApiRoute(request, response, pathname) {
  const method = request.method || "GET";

  if (pathname === "/api/correct") {
    if (method !== "POST") {
      json(response, 405, { error: "METHOD_NOT_ALLOWED" });
      return;
    }

    const db = await readDatabase();
    if (!getAuthUser(request, db)) {
      json(response, 401, { error: "AUTH_REQUIRED" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      json(response, String(error?.message) === "INVALID_JSON" ? 400 : 500, { error: String(error?.message) === "INVALID_JSON" ? "INVALID_JSON" : "INTERNAL_ERROR" });
      return;
    }

    try {
      const result = await localCorrectionService.correct(body);
      json(response, 200, result);
    } catch (error) {
      const code = String(error?.message || "CORRECTION_UNAVAILABLE");
      if (code === "OPENROUTER_UNAVAILABLE") json(response, 502, { error: code });
      else if (correctionValidationError(code)) json(response, 400, { error: code });
      else json(response, 500, { error: "INTERNAL_ERROR" });
    }
    return;
  }

  const body = method === "GET" ? null : await readJsonBody(request);

  const db = await readDatabase();

  if (method === "POST" && pathname === "/api/auth/signup") {
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      json(response, 400, { error: "INVALID_FORM" });
      return;
    }
    if (db.users.some((user) => user.email === email)) {
      json(response, 409, { error: "EMAIL_ALREADY_EXISTS" });
      return;
    }

    const salt = crypto.randomUUID().replaceAll("-", "");
    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordSalt: salt,
      passwordHash: passwordHash(password, salt),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    const token = crypto.randomUUID().replaceAll("-", "");
    db.tokens[token] = user.id;
    await saveDatabase(db);
    json(response, 200, { user: publicUser(user), token });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/signin") {
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const user = db.users.find((item) => item.email === email);

    if (!user || !passwordMatches(password, user)) {
      json(response, 401, { error: "INVALID_CREDENTIALS" });
      return;
    }

    if (!String(user.passwordHash || "").startsWith("scrypt:")) {
      user.passwordHash = passwordHash(password, user.passwordSalt);
    }

    const token = crypto.randomUUID().replaceAll("-", "");
    db.tokens[token] = user.id;
    await saveDatabase(db);
    json(response, 200, { user: publicUser(user), token });
    return;
  }

  const authUser = getAuthUser(request, db);
  if (!authUser) {
    json(response, 401, { error: "AUTH_REQUIRED" });
    return;
  }

  if (method === "GET" && pathname === "/api/me") {
    json(response, 200, { user: publicUser(authUser) });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/signout") {
    revokeToken(request, db);
    await saveDatabase(db);
    json(response, 200, { ok: true });
    return;
  }

  if (method === "GET" && pathname === "/api/sessions") {
    const sessions = db.sessions
      .filter((session) => session.userId === authUser.id)
      .sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));
    json(response, 200, { sessions });
    return;
  }

  if (method === "POST" && pathname === "/api/sessions") {
    const session = body?.session;
    if (!session?.id) {
      json(response, 400, { error: "INVALID_SESSION" });
      return;
    }

    session.userId = authUser.id;
    db.sessions = db.sessions.filter((item) => item.id !== session.id);
    db.sessions.push(session);
    await saveDatabase(db);
    json(response, 200, { session });
    return;
  }

  json(response, 404, { error: "NOT_FOUND" });
}

async function serveStaticFile(response, pathname) {
  const isModernRequest = pathname === "/modern" || pathname.startsWith("/modern/");
  if (isModernRequest && !(await directoryHasIndex(modernRoot))) {
    text(response, 404, "Modern prototype is not built");
    return;
  }

  const staticRoot = isModernRequest ? modernRoot : projectRoot;
  const publicPath = isModernRequest ? pathname.replace(/^\/modern\/?/, "") : pathname.replace(/^\/+/, "");
  const relativePath = publicPath || "index.html";

  if (!isModernRequest && relativePath === "assets/js/config.js") {
    javascript(response, 200, 'window.INTERVIEWPLUS_CONFIG = { backendMode: "server", restrictedAccess: true, allowPublicSignup: true, allowGuestAccess: false };\n');
    return;
  }

  if (!isModernRequest && !isPublicLegacyPath(relativePath)) {
    text(response, 404, "Not Found");
    return;
  }

  const absolutePath = path.resolve(staticRoot, relativePath);
  const relativeResolvedPath = path.relative(staticRoot, absolutePath);

  if (relativeResolvedPath.startsWith("..") || path.isAbsolute(relativeResolvedPath)) {
    text(response, 403, "Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    response.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    response.end(body);
  } catch {
    if (isModernRequest) {
      try {
        const body = await fs.readFile(path.join(modernRoot, "index.html"));
        response.writeHead(200, { "Content-Type": contentTypes[".html"] });
        response.end(body);
        return;
      } catch {
        text(response, 404, "Not Found");
        return;
      }
    }
    text(response, 404, "Not Found");
  }
}

async function loadLocalQuestionBank() {
  if (!localQuestionBankLoader) {
    localQuestionBankLoader = createQuestionBankLoader({
      workbookBytes: await fs.readFile(path.join(projectRoot, "Questions_InterviewPlus_Bilingual.xlsx")),
    });
  }
  return localQuestionBankLoader();
}

function isPublicLegacyPath(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/");
  return publicRootFiles.has(normalized) || normalized.startsWith("assets/");
}

async function directoryHasIndex(directory) {
  try {
    await fs.access(path.join(directory, "index.html"));
    return true;
  } catch {
    return false;
  }
}

async function readDatabase() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      tokens: parsed.tokens && typeof parsed.tokens === "object" ? parsed.tokens : {},
    };
  } catch {
    const db = { users: [], sessions: [], tokens: {} };
    await saveDatabase(db);
    return db;
  }
}

async function saveDatabase(db) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new Error("REQUEST_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function getAuthUser(request, db) {
  const authorization = String(request.headers.authorization || "");
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  const tokenRecord = db.tokens[token];
  const userId = typeof tokenRecord === "string" ? tokenRecord : tokenRecord?.userId;
  return db.users.find((user) => user.id === userId) || null;
}

function revokeToken(request, db) {
  const authorization = String(request.headers.authorization || "");
  if (!authorization.toLowerCase().startsWith("bearer ")) return;
  delete db.tokens[authorization.slice(7).trim()];
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function passwordHash(password, salt) {
  return `scrypt:${crypto.scryptSync(password, salt, 64).toString("base64")}`;
}

function passwordMatches(password, user) {
  const stored = String(user.passwordHash || "");
  if (stored.startsWith("scrypt:")) {
    const expected = Buffer.from(stored.slice(7), "base64");
    const actual = crypto.scryptSync(password, user.passwordSalt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  const legacy = crypto.createHash("sha256").update(`${user.passwordSalt}:${password}`).digest("base64");
  const expected = Buffer.from(stored);
  const actual = Buffer.from(legacy);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function json(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function text(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

function javascript(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/javascript; charset=utf-8" });
  response.end(body);
}

function correctionValidationError(code) {
  return ["INVALID_CORRECTION_TYPE", "INVALID_CORRECTION_ITEMS", "INVALID_CORRECTION_ITEM", "TOO_MANY_ITEMS", "ANSWER_TOO_LONG", "CORRECTION_PAYLOAD_TOO_LARGE", "UNKNOWN_QUESTION", "INVALID_CASE_THEME", "INVALID_CASE_DIFFICULTY", "INVALID_CASE_SEED", "INVALID_CASE_ANSWERS", "TOO_MANY_CASE_ANSWERS", "INVALID_CASE_ANSWER", "INVALID_CASE_RECOMMENDATION"].includes(code);
}
