import { createHash } from "node:crypto";
import { createQuestionBankLoader } from "./lib/question-bank.mjs";
import { createCorrectionService } from "./lib/correction-service.mjs";

const questionBankLoader = createQuestionBankLoader();
const service = createCorrectionService({ questionBankLoader });
export const handler = createHandler({ service });

export function createHandler({ env = process.env, fetchImpl = fetch, service: correctionService = service, now = Date.now } = {}) {
  const requests = new Map();
  const corrections = new Map();

  return async function correctionHandler(event) {
    if (event.httpMethod !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" });

    let user;
    try {
      user = await authorize(event.headers || {}, env, fetchImpl);
    } catch (error) {
      const code = String(error?.message || "AUTH_UNAVAILABLE");
      if (code === "AUTH_REQUIRED") return reply(401, { error: code });
      if (code === "ACCESS_NOT_AUTHORIZED") return reply(403, { error: code });
      console.error("INTERVIEWPLUS_CORRECTION_ERROR", "AUTH_UNAVAILABLE");
      return reply(500, { error: "INTERNAL_ERROR" });
    }

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return reply(400, { error: "INVALID_JSON" });
    }

    const idempotencyKey = correctionKey(user.id, payload, event.body || "");
    const cached = idempotencyKey && corrections.get(idempotencyKey);
    if (cached && cached.expiresAt > now()) return cached.response;
    if (cached) corrections.delete(idempotencyKey);

    if (!consumeRateLimit(requests, user.id, env, now())) return reply(429, { error: "RATE_LIMITED" });

    const pending = runCorrection(correctionService, payload);
    if (idempotencyKey) corrections.set(idempotencyKey, { expiresAt: now() + 10 * 60_000, response: pending });
    const response = await pending;
    if (idempotencyKey && response.statusCode === 200) corrections.set(idempotencyKey, { expiresAt: now() + 10 * 60_000, response });
    else if (idempotencyKey) corrections.delete(idempotencyKey);
    return response;
  };
}

async function runCorrection(correctionService, payload) {
  try {
    return reply(200, await correctionService.correct(payload));
  } catch (error) {
    const code = String(error?.message || "CORRECTION_UNAVAILABLE");
    if (code === "OPENROUTER_UNAVAILABLE") return reply(502, { error: code });
    if (isValidationError(code)) return reply(400, { error: code });
    console.error("INTERVIEWPLUS_CORRECTION_ERROR", safeErrorCode(code));
    return reply(500, { error: "INTERNAL_ERROR" });
  }
}

async function authorize(headers, env, fetchImpl) {
  if (env.CORRECTION_AUTH_MODE === "local") return { id: "local" };
  const authorization = String(headers.authorization || headers.Authorization || "");
  if (!authorization.startsWith("Bearer ") || authorization.length > 8200) throw new Error("AUTH_REQUIRED");
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!baseUrl || !serviceKey) throw new Error("AUTH_UNAVAILABLE");
  const signal = AbortSignal.timeout(Number(env.SUPABASE_AUTH_TIMEOUT_MS || 5000));
  const authResponse = await fetchImpl(`${baseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: authorization },
    signal,
  });
  if (!authResponse.ok) throw new Error("AUTH_REQUIRED");
  const user = await authResponse.json();
  if (!user?.id || !user?.email) throw new Error("AUTH_REQUIRED");
  const query = new URLSearchParams({ select: "email", email: `eq.${String(user.email).toLowerCase()}`, active: "eq.true", limit: "1" });
  const accessResponse = await fetchImpl(`${baseUrl}/rest/v1/authorized_users?${query}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    signal: AbortSignal.timeout(Number(env.SUPABASE_AUTH_TIMEOUT_MS || 5000)),
  });
  if (!accessResponse.ok) throw new Error("AUTH_UNAVAILABLE");
  const rows = await accessResponse.json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("ACCESS_NOT_AUTHORIZED");
  return { id: user.id };
}

function correctionKey(userId, payload, rawBody) {
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";
  if (!sessionId || sessionId.length > 128) return "";
  return `${userId}:${sessionId}:${createHash("sha256").update(rawBody).digest("base64url")}`;
}

function consumeRateLimit(requests, userId, env, timestamp) {
  const configured = Number(env.CORRECTION_MAX_REQUESTS_PER_MINUTE || 10);
  const limit = Number.isFinite(configured) && configured >= 1 ? configured : 10;
  const recent = (requests.get(userId) || []).filter((time) => timestamp - time < 60_000);
  if (recent.length >= limit) return false;
  recent.push(timestamp);
  requests.set(userId, recent);
  return true;
}

function safeErrorCode(code) {
  if (code.startsWith("PRIVATE_QUESTION_FILE_UNAVAILABLE:")) return "PRIVATE_QUESTION_FILE_UNAVAILABLE";
  if (code.startsWith("QUESTION_BANK_")) return "QUESTION_BANK_ERROR";
  return "CORRECTION_INTERNAL_ERROR";
}

function isValidationError(code) {
  return ["INVALID_CORRECTION_TYPE", "INVALID_CORRECTION_ITEMS", "INVALID_CORRECTION_ITEM", "TOO_MANY_ITEMS", "ANSWER_TOO_LONG", "CORRECTION_PAYLOAD_TOO_LARGE", "UNKNOWN_QUESTION", "INVALID_CASE_THEME", "INVALID_CASE_DIFFICULTY", "INVALID_CASE_SEED", "INVALID_CASE_ANSWERS", "TOO_MANY_CASE_ANSWERS", "INVALID_CASE_ANSWER", "INVALID_CASE_RECOMMENDATION"].includes(code);
}

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
